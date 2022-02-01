import { parseEther } from '@ethersproject/units'
import { BigNumberish } from 'ethers'
import { ethers, network } from 'hardhat'
import { DAI, DOLA, USDC, USDT, WBTC, WETH } from '../constants/tokens'
import { MCD_WARD } from '../test/shared/constants'
import { float2SolidityTokenAmount } from '../test/shared/utils'
import { IDAI, IDOLA, IERC20, IUSDC, IUSDT, IWBTC, IWETH } from '../typechain'
import { TOKENS } from './my_tokens'

export async function getERC20Token(symbol: string) {
  symbol = symbol.trim().toUpperCase()
  return (await ethers.getContractAt('ERC20', TOKENS[symbol].address)) as IERC20
}

export function tokenWithAddress(address: string) {
  for (const symbol in TOKENS) {
    if (TOKENS[symbol].address.toLowerCase() === address.toLowerCase()) {
      return TOKENS[symbol]
    }
  }
  throw new Error(`Token with address: ${address} does not exist`)
}

export async function sendToken(token: IERC20, recipient: string, amount?: BigNumberish) {
  const providerAddress = tokenWithAddress(token.address).provider

  const defaultVolatileCoinAmount = 100
  const defaultStableCoinAmount = 100_000_000

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
      const weth = (await ethers.getContractAt('IWETH', WETH.address)) as IWETH

      const funder = (await ethers.getSigners())[5]

      if (!amount) amount = float2SolidityTokenAmount(WETH, defaultVolatileCoinAmount)

      await weth.connect(funder).deposit({ value: amount })
      await weth.connect(funder).transfer(recipient, amount)
      break
    case DAI.address.toLowerCase():
      const dai = (await ethers.getContractAt('IDAI', DAI.address)) as IDAI

      if (!amount) amount = float2SolidityTokenAmount(DAI, defaultStableCoinAmount)

      const daiOwnerAddress = MCD_WARD
      await impersonateAndFundWithETH(daiOwnerAddress)
      const daiWardSigner = ethers.provider.getSigner(daiOwnerAddress)
      await dai.connect(daiWardSigner).mint(recipient, amount)
      break
    case DOLA.address.toLocaleLowerCase():
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
