import { parseEther } from '@ethersproject/units'
import { BigNumber, BigNumberish, BytesLike, PopulatedTransaction } from 'ethers'
import { isAddress } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'
import { find, values } from 'lodash'
import * as Tokens from '../constants/tokens'
import { POLY, TokenData } from '../constants/tokens'
import { MCD_WARD } from '../test/shared/constants'
import { float2SolidityTokenAmount } from '../test/shared/utils'
import {
  ERC20,
  IDAI,
  IDOLA,
  IERC20,
  IUSDC,
  IUSDT,
  IUSDT__factory,
  IWBTC,
  IWETH__factory,
  MultiSigWallet,
  TimelockController,
} from '../typechain'
import { IBTCB__factory } from '../typechain/factories/IBTCB__factory'
import { TOKENS } from './my_tokens'
const { DAI, DOLA, USDC, USDT, WBNB, WBTC, WETH } = Tokens

export async function getERC20Token(symbol: string) {
  symbol = symbol.trim().toUpperCase()
  return (await ethers.getContractAt('ERC20', TOKENS[symbol].address)) as IERC20
}
/**
 *
 * @param tokenDataOrContract
 * @param recipient
 * @param amount if float, it will be converted to BigNumber via decimals information of token
 */
export async function sendToken(tokenDataOrContract: TokenData | IERC20, recipient: string, amount?: BigNumberish) {
  const tokens = [...values(Tokens), ...Object.values(POLY).map((t) => t())]
  const search = find(tokens, (token) => {
    token = token as TokenData
    return (
      !!token.address &&
      isAddress(token.address) &&
      token.address.toLowerCase() === tokenDataOrContract.address.toLowerCase()
    )
  })
  if (!search) {
    throw new Error(`Could not find token ${tokenDataOrContract.address}`)
  }

  const tokenData = search as TokenData

  const token = tokenData.contract.connect(ethers.provider)
  const providerAddress = tokenData.provider

  if (!providerAddress) throw new Error(`No provider for token ${tokenData.symbol}`)

  const defaultVolatileCoinAmount = 100
  const defaultStableCoinAmount = 100_000_000

  if (!!amount && typeof amount === 'number') amount = float2SolidityTokenAmount(tokenData, amount)

  switch (token.address.toLowerCase()) {
    case WBTC.address.toLowerCase():
      const wbtc = (await ethers.getContractAt('IWBTC', WBTC.address)) as IWBTC
      const wbtcOwnerAddress = await wbtc.owner()

      if (!amount) amount = float2SolidityTokenAmount(WBTC, defaultVolatileCoinAmount)

      await impersonateAndFundWithETH(wbtcOwnerAddress)

      const wbtcOwnerSigner = ethers.provider.getSigner(wbtcOwnerAddress)
      await wbtc.connect(wbtcOwnerSigner).mint(recipient, amount)

      break
    case USDC.address.toLowerCase():
      const usdc = (await ethers.getContractAt('IUSDC', USDC.address)) as IUSDC
      await impersonateAndFundWithETH(providerAddress)

      const ownerAddress = await usdc.callStatic.owner()
      const owner = await impersonateAndFundWithETH(ownerAddress)

      await usdc.connect(owner).updateMasterMinter(ownerAddress)
      await usdc.connect(owner).configureMinter(ownerAddress, ethers.constants.MaxUint256)

      if (!amount) amount = float2SolidityTokenAmount(USDC, defaultStableCoinAmount)
      await usdc.connect(owner).mint(recipient, amount)

      break
    case POLY.USDT().address.toLowerCase():
    case POLY.USDC().address.toLowerCase():
    case POLY.DAI().address.toLowerCase():
      const erc20Poly = (await ethers.getContractAt('ERC20', token.address)) as ERC20

      if (!amount) amount = float2SolidityTokenAmount(tokenData, defaultStableCoinAmount)

      const usdtPolyProvider = tokenData.provider
      if (!usdtPolyProvider) throw new Error(`add 'provider' property to token: ${token.name}`)

      const signer = await impersonateAndFundWithETH(usdtPolyProvider)
      // await erc20Poly.connect(signer).issue(amount)
      await erc20Poly.connect(signer).transfer(recipient, amount)
      break
    case USDT.address.toLowerCase():
      const usdt = (await ethers.getContractAt('IUSDT', USDT.address)) as IUSDT
      const usdtOwnerAddress = await usdt.getOwner()

      if (!amount) amount = float2SolidityTokenAmount(USDT, defaultStableCoinAmount)

      await impersonateAndFundWithETH(usdtOwnerAddress)

      const usdtOwnerSigner = ethers.provider.getSigner(usdtOwnerAddress)
      await usdt.connect(usdtOwnerSigner).issue(amount)
      await usdt.connect(usdtOwnerSigner).transfer(recipient, amount)

      break
    case WETH.address.toLowerCase():
    case WBNB.address.toLowerCase():
    case POLY.WMATIC().address.toLowerCase():
      const wrapper = IWETH__factory.connect(token.address, ethers.provider)
      const funder = (await ethers.getSigners())[5]

      if (!amount) amount = float2SolidityTokenAmount(WETH, defaultVolatileCoinAmount)

      await wrapper.connect(funder).deposit({ value: amount })
      await wrapper.connect(funder).transfer(recipient, amount)
      break
    case Tokens.BSCUSDC.address.toLowerCase():
    case Tokens.BSCETH.address.toLowerCase():
      const bscUsdcMinterAddress = await IUSDT__factory.connect(tokenData.address, ethers.provider).getOwner()
      const bscUsdcMinter = await impersonateAndFundWithETH(bscUsdcMinterAddress)

      if (!amount) amount = float2SolidityTokenAmount(tokenData, defaultVolatileCoinAmount)

      await IBTCB__factory.connect(tokenData.address, bscUsdcMinter).mint(amount)
      await IBTCB__factory.connect(tokenData.address, bscUsdcMinter).transfer(recipient, amount)

      break
    case Tokens.BTCB.address.toLowerCase():
    case Tokens.BSCUSDT.address.toLowerCase():
    case Tokens.BSCDAI.address.toLowerCase():
    case Tokens.XRP.address.toLowerCase():
    case Tokens.ADA.address.toLowerCase():
    case Tokens.BCH.address.toLowerCase():
    case Tokens.DOT.address.toLowerCase():
    case Tokens.LTC.address.toLowerCase():
    case Tokens.DOGE.address.toLowerCase():
    case Tokens.SXP.address.toLowerCase():
    case Tokens.BETH.address.toLowerCase():
      const contract = IBTCB__factory.connect(tokenData.address, ethers.provider)

      const minterAddress = await contract.owner()
      const minter = await impersonateAndFundWithETH(minterAddress)

      if (!amount) amount = float2SolidityTokenAmount(tokenData, defaultVolatileCoinAmount)

      await contract.connect(minter).mint(amount)
      await contract.connect(minter).transfer(recipient, amount)

      break
    case DAI.address.toLowerCase():
      const dai = (await ethers.getContractAt('IDAI', DAI.address)) as IDAI

      if (!amount) amount = float2SolidityTokenAmount(DAI, defaultStableCoinAmount)

      const daiOwnerAddress = MCD_WARD
      await impersonateAndFundWithETH(daiOwnerAddress)
      const daiWardSigner = ethers.provider.getSigner(daiOwnerAddress)
      await dai.connect(daiWardSigner).mint(recipient, amount)
      break
    case DOLA.address.toLowerCase():
      const dola = (await ethers.getContractAt('IDOLA', DOLA.address)) as IDOLA
      await impersonateAndFundWithETH(providerAddress)
      const dolaOperator = await ethers.provider.getSigner(providerAddress)

      if (!amount) amount = float2SolidityTokenAmount(DOLA, defaultStableCoinAmount)

      await dola.connect(dolaOperator).mint(recipient, amount)
      break
    default:
      await impersonateAndFundWithETH(providerAddress)
      const provider = await ethers.provider.getSigner(providerAddress)
      const tokenS = token.connect(provider)
      const balance = await tokenS.balanceOf(providerAddress)

      if (!amount) {
        amount = balance
      } else if (amount > balance) {
        amount = balance
        console.error('Cannot supply so many tokens from this provider')
      }
      await tokenS.transfer(recipient, amount)
      break
  }
}

/**
 * @description Gets the last wallet available and sends funds to the impersonated account
 * @param address account to be impersonated and funded
 * @returns the impersonated account Signer object
 */
export async function impersonateAndFundWithETH(address: string) {
  const wallets = await ethers.getSigners()
  const funder = wallets[wallets.length - 1]

  const ForceSend = await ethers.getContractFactory('ForceSend')

  await ForceSend.connect(funder).deploy(address, { value: parseEther('0.5') })
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  })

  return ethers.provider.getSigner(address)
}

export async function submitMultiSigTimelockTx(
  populatedTx: PopulatedTransaction,
  delay: BigNumberish,
  timelock: TimelockController,
  governanceMultiSig: MultiSigWallet
): Promise<{ operationID: BigNumber; operationReadyAt: BigNumber }> {
  if (!populatedTx.to) throw new Error('populatedTx.to is empty')
  const txOpts: [string, BigNumberish, BytesLike, BytesLike, BytesLike] = [
    populatedTx.to,
    populatedTx.value || 0,
    populatedTx.data || '0x',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    ethers.utils.randomBytes(32),
  ]
  // console.log('Options:', txOpts)

  const txSchedule = await timelock.schedule(
    ...([...txOpts, delay] as [string, BigNumberish, BytesLike, BytesLike, BytesLike, BigNumberish])
  )
  const operationID = await timelock.hashOperation(...txOpts)
  const readyTimestamp = await timelock.getTimestamp(operationID)
  // console.log(txSchedule)
  // console.log('Waiting for tx')
  const txScheduleReceipt = await txSchedule.wait()
  // console.log(txScheduleReceipt)

  const txExectute = await timelock.populateTransaction.execute(...txOpts)
  const txSubmitId = await governanceMultiSig.callStatic.submitTransaction(timelock.address, 0, txExectute.data || '0x')
  const txSubmit = await governanceMultiSig.submitTransaction(timelock.address, 0, txExectute.data || '0x')
  // console.log(txSubmit)
  // console.log('Waiting for tx')
  const txSubmitReceipt = await txSubmit.wait()
  // console.log(txSubmitReceipt)

  return { operationID: txSubmitId, operationReadyAt: readyTimestamp }
}
