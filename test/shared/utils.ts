import {
  Fetcher as SushiFetcher,
  BigintIsh as SushiBigIntish,
  Token as SushiToken,
  TokenAmount as SushiTokenAmount,
} from '@sushiswap/sdk'
import { BigintIsh as UniswapBigIntish, ChainId, Fetcher, Route, Token, TokenAmount } from '@uniswap/sdk'
import { FeeAmount, Pool, Trade } from '@uniswap/v3-sdk'
import { expect } from 'chai'
import { BigNumber, BigNumberish, ContractTransaction, Signer, providers } from 'ethers'
import { formatUnits, hexZeroPad, parseUnits } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'
import {
  COMPOUND_PLATFORM,
  COMPOUND_TOKENS_TO_CTOKENS,
  SUBSIDY_PRINCIPAL,
  SUBSIDY_PROFIT,
  UNI_V3_QUOTERV2,
} from '../../constants/deploy'
import { TokenData, WETH } from '../../constants/tokens'
import { impersonateAndFundWithETH } from '../../scripts/utils'
import {
  AllConnectors,
  AllConnectors__factory,
  CompoundPriceOracleMock,
  FodlNFT__factory,
  FoldingRegistry,
  IAaveLendingPoolProvider__factory,
  IComptroller__factory,
  ICToken__factory,
  QuoterV2,
} from '../../typechain'
import { AavePriceOracleMock } from '../../typechain/AavePriceOracleMock'
import { IAaveLendingPoolProvider } from '../../typechain/IAaveLendingPoolProvider'
import { IAavePriceOracleGetter } from '../../typechain/IAavePriceOracleGetter'
import { ICompoundPriceOracle } from '../../typechain/ICompoundPriceOracle'
import { IComptroller } from '../../typechain/IComptroller'
import { MANTISSA } from './constants'

import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'

export async function getUniswapPair(token0: TokenData, token1: TokenData) {
  const _token0 = new Token(ChainId.MAINNET, token0.address, token0.decimals)
  const _token1 = new Token(ChainId.MAINNET, token1.address, token1.decimals)

  const pair = await Fetcher.fetchPairData(_token0, _token1, ethers.provider)
  return pair
}

export async function getSushiswapPair(token0: TokenData, token1: TokenData) {
  const _token0 = new SushiToken(ChainId.MAINNET, token0.address, token0.decimals)
  const _token1 = new SushiToken(ChainId.MAINNET, token1.address, token1.decimals)

  const pair = await SushiFetcher.fetchPairData(_token0, _token1, ethers.provider)
  return pair
}

/**
 * @description gets price of token0 denominated in token1 ( TOKEN1 / TOKEN0 )
 * @param token0
 * @param token1
 * @returns
 */
export async function getUniswapPrice(token0: TokenData, token1: TokenData) {
  const pair = await getUniswapPair(token0, token1)
  const route = new Route([pair], pair.token1)

  if (new Token(ChainId.MAINNET, token0.address, 0).sortsBefore(new Token(ChainId.MAINNET, token1.address, 0))) {
    return parseFloat(route.midPrice.invert().toSignificant(6))
  } else {
    return parseFloat(route.midPrice.toSignificant(6))
  }
}

/**
 * @description gets price of token0 denominated in token1 ( TOKEN1 / TOKEN0 )
 * @param token0
 * @param token1
 * @returns
 */
export async function getUniswapV3Price(token0: TokenData, token1: TokenData, fee: FeeAmount) {
  const quoterContract = (await ethers.getContract('QuoterV2')) as QuoterV2

  const [amountOut_BN] = (await quoterContract.callStatic.quoteExactInputSingle({
    tokenIn: token0.address,
    tokenOut: token1.address,
    amountIn: float2SolidityTokenAmount(token0, 1),
    fee,
    sqrtPriceLimitX96: 0,
  })) as Array<BigNumber>
  const amountOut = solidityTokenAmount2Float(token1, amountOut_BN)

  return amountOut
}

export async function getUniswapV3AmountInSingle(
  tokenIn: TokenData,
  tokenOut: TokenData,
  fee: FeeAmount,
  amountOut: BigNumber | number
) {
  const quoterContract = (await ethers.getContract('QuoterV2')) as QuoterV2

  if (typeof amountOut === 'number') amountOut = float2SolidityTokenAmount(tokenOut, amountOut)

  const [amountIn_BN] = (await quoterContract.callStatic.quoteExactOutputSingle({
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amount: amountOut,
    fee,
    sqrtPriceLimitX96: 0,
  })) as Array<BigNumber>
  const amountIn_float = solidityTokenAmount2Float(tokenIn, amountIn_BN)

  return { amountIn_BN, amountIn_float }
}

/**
 * @description given a desired amount out, return the needed amount in
 * @param tokenIn
 * @param tokenOut
 * @param amountOut
 * @param path
 * @returns
 */
export async function v3QuoteExactOutput(
  tokenIn: TokenData,
  tokenOut: TokenData,
  amountOut: BigNumber | number,
  path: string
) {
  const quoterContract = (await ethers.getContract('QuoterV2')) as QuoterV2
  if (typeof amountOut === 'number') amountOut = float2SolidityTokenAmount(tokenOut, amountOut)

  const [amountIn_BN] = (await quoterContract.callStatic.quoteExactOutput(path, amountOut)) as Array<BigNumber>
  const amountIn_float = solidityTokenAmount2Float(tokenIn, amountIn_BN)

  return { amountIn_BN, amountIn_float }
}

export async function getUniswapV3AmountOutSingle(
  tokenIn: TokenData,
  tokenOut: TokenData,
  fee: FeeAmount,
  amountIn: BigNumber | number
) {
  const quoterContract = (await ethers.getContract('QuoterV2')) as QuoterV2

  if (typeof amountIn === 'number') amountIn = float2SolidityTokenAmount(tokenIn, amountIn)

  const [amountOut_BN] = (await quoterContract.callStatic.quoteExactInputSingle({
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn,
    fee,
    sqrtPriceLimitX96: 0,
  })) as Array<BigNumber>
  const amountOut_float = solidityTokenAmount2Float(tokenOut, amountOut_BN)

  return { amountOut_BN, amountOut_float }
}

export async function getSushiswapOutputAmount(amount0: SushiBigIntish, token0: TokenData, token1: TokenData) {
  const pair = await getSushiswapPair(token0, token1)
  const token0Amount = new SushiTokenAmount(pair.token0, amount0)
  const [amount1] = pair.getOutputAmount(token0Amount)
  return amount1
}

export async function getUniswapOutputAmount(amount0: UniswapBigIntish, token0: TokenData, token1: TokenData) {
  const pair = await getUniswapPair(token0, token1)
  const ta = new TokenAmount(pair.token0, amount0)
  const [amount1] = pair.getOutputAmount(ta)
  return amount1
}

export async function getSushiswapInputAmount(amount1: SushiBigIntish, token0: TokenData, token1: TokenData) {
  const pair = await getSushiswapPair(token0, token1)
  const token1Amount = new SushiTokenAmount(pair.token1, amount1)
  const [amount0] = pair.getInputAmount(token1Amount)
  return amount0
}

export async function getUniswapInputAmount(amount1: UniswapBigIntish, token0: TokenData, token1: TokenData) {
  const pair = await getUniswapPair(token0, token1)
  const ta = new TokenAmount(pair.token1, amount1)

  const [amount0] = pair.getInputAmount(ta)
  return amount0
}

export function solidityTokenAmount2Float(token: TokenData, value: BigNumberish) {
  if (typeof value === 'number') return value
  return parseFloat(formatUnits(value, token.decimals))
}

export function float2SolidityTokenAmount(token: TokenData, float: number) {
  return parseUnits(`${float.toFixed(token.decimals)}`, token.decimals)
}

/**
 *
 * @param comptroller address or contract of the target comptroller
 * @param token0
 * @param token1
 * @returns price of token0 denominated in token1 (e.g. token0 = ETH, token1 = DAI, price = DAI/ETH)
 */
export async function getCompoundPrice(comptroller: string | IComptroller, token0: TokenData, token1: TokenData) {
  if (typeof comptroller === 'string') {
    comptroller = IComptroller__factory.connect(comptroller, ethers.provider)
  }

  const oracleAddress = await comptroller.oracle()
  const oracle = (await ethers.getContractAt('ICompoundPriceOracle', oracleAddress)) as ICompoundPriceOracle

  const price_0 = await oracle.getUnderlyingPrice(COMPOUND_TOKENS_TO_CTOKENS[token0.address])
  const price_1 = await oracle.getUnderlyingPrice(COMPOUND_TOKENS_TO_CTOKENS[token1.address])

  return price_0.mul(MANTISSA).div(price_1) // Price of token0 denominated in token1
}

export async function getCompoundQuote(
  comptroller: string | IComptroller,
  tokenIn: TokenData,
  tokenOut: TokenData,
  amountIn: number | BigNumber
) {
  const price = await getCompoundPrice(comptroller, tokenIn, tokenOut)

  if (typeof amountIn === 'number') amountIn = float2SolidityTokenAmount(tokenIn, amountIn)

  const amountOut_BN = amountIn.mul(price).div(MANTISSA)
  const amountOut_float = solidityTokenAmount2Float(tokenOut, amountOut_BN)
  return { amountOut_BN, amountOut_float }
}

export async function getCompoundBalanceOfUnderlying(
  underlyingToken: TokenData,
  address: string,
  platform = COMPOUND_PLATFORM,
  foldingRegistry?: FoldingRegistry
) {
  if (!foldingRegistry) foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const balance = await foldingRegistry
    .getCToken(platform, underlyingToken.address)
    .then((cTokenAddress) =>
      ICToken__factory.connect(cTokenAddress, ethers.provider).callStatic.balanceOfUnderlying(address)
    )

  return { balance, balance_float: solidityTokenAmount2Float(underlyingToken, balance) }
}
/**
 *
 * @param aave address or contract of the target aave platform
 * @param token0
 * @param token1
 * @returns price of token0 denominated in token1 (e.g. token0 = ETH, token1 = DAI, price = DAI/ETH)
 */
export async function getAavePrice(aave: string | IAaveLendingPoolProvider, token0: TokenData, token1: TokenData) {
  if (typeof aave === 'string') {
    aave = IAaveLendingPoolProvider__factory.connect(aave, ethers.provider)
  }

  const oracleAddress = await aave.getPriceOracle()
  const oracle = (await ethers.getContractAt('IAavePriceOracleGetter', oracleAddress)) as IAavePriceOracleGetter

  const price_0 = (await oracle.getAssetPrice(token0.address))
    .mul(MANTISSA)
    .div(BigNumber.from(10).pow(token0.decimals))
  const price_1 = (await oracle.getAssetPrice(token1.address))
    .mul(MANTISSA)
    .div(BigNumber.from(10).pow(token1.decimals))

  return price_0.mul(MANTISSA).div(price_1) // Price of token0 denominated in token1
}

export async function getAaveQuote(
  aave: string | IAaveLendingPoolProvider,
  tokenIn: TokenData,
  tokenOut: TokenData,
  amountIn: number | BigNumber
) {
  const price = await getAavePrice(aave, tokenIn, tokenOut)

  if (typeof amountIn === 'number') amountIn = float2SolidityTokenAmount(tokenIn, amountIn)

  const amountOut_BN = amountIn.mul(price).div(MANTISSA)
  const amountOut_float = solidityTokenAmount2Float(tokenOut, amountOut_BN)
  return { amountOut_BN, amountOut_float }
}

/**
 * @description Changes the current Compound price oracle for a mocked one that is capable of giving
 * fake price quotes (when a fake price is set) and original prices quotes (when a fake price is not set)
 * @param comptrollerAddress
 * @param newOracle
 * @returns the fake oracle contract instance
 */
export async function overrideCompoundPriceOracle(comptrollerAddress: string, newOracle: string) {
  const comptroller = (await ethers.getContractAt('IComptroller', comptrollerAddress)) as IComptroller

  const admin = await impersonateAndFundWithETH(await comptroller.admin())

  await comptroller.connect(admin)._setPriceOracle(newOracle)
  const fakeOracle = (await ethers.getContractAt('CompoundPriceOracleMock', newOracle)) as CompoundPriceOracleMock

  return fakeOracle
}

/**
 * @description Undo overrideCompoundPriceOracle
 * @param comptrollerAddress
 */
export async function restoreCompoundPriceOracle(comptrollerAddress: string) {
  try {
    const comptroller = (await ethers.getContractAt('IComptroller', comptrollerAddress)) as IComptroller

    const currentOracle = (await ethers.getContractAt(
      'CompoundPriceOracleMock',
      await comptroller.oracle()
    )) as CompoundPriceOracleMock
    const originalOracleAddress = await currentOracle.originalOracle()

    const admin = await impersonateAndFundWithETH(await comptroller.admin())
    await comptroller.connect(admin)._setPriceOracle(originalOracleAddress)
  } catch (e) {
    // If this call fails it is probably because the original oracle is already restored
  }
}

/**
 *
 * @description refer to overrideCompoundPriceOracle
 */
export async function overrideAavePriceOracle(aaveAddress: string, newOracle: string) {
  const aave = (await ethers.getContractAt('IAaveLendingPoolProvider', aaveAddress)) as IAaveLendingPoolProvider
  const owner = await impersonateAndFundWithETH(await aave.callStatic.owner())

  await aave.connect(owner).setPriceOracle(newOracle)

  const fakeOracle = (await ethers.getContractAt('AavePriceOracleMock', newOracle)) as AavePriceOracleMock

  return fakeOracle
}

/**
 *
 * @description refer to overrideAavePriceOracle
 */
export async function restoreAavePriceOracle(aaveAddress: string) {
  try {
    const aave = (await ethers.getContractAt('IAaveLendingPoolProvider', aaveAddress)) as IAaveLendingPoolProvider

    const currentOracle = (await ethers.getContractAt(
      'AavePriceOracleMock',
      await aave.getPriceOracle()
    )) as AavePriceOracleMock

    const originalOracleAddress = await currentOracle.originalOracle()

    const owner = await impersonateAndFundWithETH(await aave.owner())
    await aave.connect(owner).setPriceOracle(originalOracleAddress)
  } catch (e) {
    // If this call fails it is probably because the original oracle is already restored
  }
}

export function getRandomBigNumberBoundedByMantissa() {
  return BigNumber.from(10).pow(1 + Math.floor(Math.random() * 17))
}

export function randomNotZero() {
  let r: number = 0
  do {
    r = Math.random()
  } while (r === 0)

  return r
}

export function toMantissa(value: number) {
  value = Math.floor(value * 1e18)
  return BigNumber.from(`${value}`)
}

/**
 * @description Caution: mining a lot of blocks can take a lot of time. Allows to mine new blocks in hardhat
 *
 * @param numberOfBlocks by default 1. Advances the blockchain by this amount of blocks
 */
export async function mine(numberOfBlocks = 1) {
  for (let i = 0; i < numberOfBlocks; i++) {
    await network.provider.send('evm_mine')
  }
}

export const currentTime = async () => {
  const { timestamp } = await ethers.provider.getBlock('latest')
  return timestamp
}

export const fastForward = async (seconds: number) => {
  await network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [(await currentTime()) + seconds],
  })
  await mine()
}

/**
 * From https://github.com/Uniswap/uniswap-v3-periphery/blob/main/test/shared/path.ts
 * Utility function to encode a path for a multihop trade in Uniswap V3
 */

const ADDR_SIZE = 20
const FEE_SIZE = 3
const OFFSET = ADDR_SIZE + FEE_SIZE

export function encodePath(path: string[], fees: FeeAmount[]): string {
  if (path.length != fees.length + 1) {
    throw new Error('path/fee lengths do not match')
  }

  let encoded = '0x'
  for (let i = 0; i < fees.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2)
    // 3 byte encoding of the fee
    encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2)

  return encoded.toLowerCase()
}

export const createFoldingAccount = async (foldingRegistry: FoldingRegistry, accountOwner?: Signer) => {
  if (accountOwner) foldingRegistry = foldingRegistry.connect(accountOwner)
  const fodlNFT = FodlNFT__factory.connect(await foldingRegistry.fodlNFT(), foldingRegistry.provider)

  const tx = await foldingRegistry.createAccount().then((tx) => tx.wait(1))

  // Extract address from event
  const filter = fodlNFT.filters.Transfer(ethers.constants.AddressZero)
  const {
    args: { tokenId },
  } = (await fodlNFT.queryFilter(filter, tx.blockHash))[0]

  const account = AllConnectors__factory.connect(bigNumber2Address(tokenId), foldingRegistry.signer)
  return { account, tx }
}

export const expectETHBalanceChanges = async (
  runnablePromise: any,
  wallets: string[],
  balances: number[],
  delta: number
) => {
  const balancesBefore = await Promise.all(wallets.map((wallet) => ethers.provider.getBalance(wallet)))

  await runnablePromise()

  const balancesAfter = await Promise.all(wallets.map((wallet) => ethers.provider.getBalance(wallet)))

  const balanceChanges = wallets.map((_, i) => solidityTokenAmount2Float(WETH, balancesAfter[i].sub(balancesBefore[i])))

  balanceChanges.forEach((change, i) => {
    expect(change).to.be.closeTo(balances[i], delta)
  })
}

export const expectApproxBalanceChanges = async (
  runnablePromise: any,
  token: TokenData,
  wallets: string[],
  balances: number[],
  delta: number
) => {
  const balancesBefore = await Promise.all(
    wallets.map((wallet) => token.contract.connect(ethers.provider).callStatic.balanceOf(wallet))
  )

  await runnablePromise()
  const balancesAfter = await Promise.all(
    wallets.map((wallet) => token.contract.connect(ethers.provider).callStatic.balanceOf(wallet))
  )

  const balanceChanges = wallets.map((_, i) =>
    solidityTokenAmount2Float(token, balancesAfter[i].sub(balancesBefore[i]))
  )

  balanceChanges.forEach((change, i) => {
    expect(change).to.be.closeTo(balances[i], balances[i] * delta, `Failed at index ${i}`)
  })
}

export const getBalanceDeltas = async (
  runnablePromise: () => Promise<ContractTransaction>,
  token: TokenData,
  wallets: string[]
) => {
  const balancesBefore = await Promise.all(
    wallets.map((wallet) =>
      token.contract
        .connect(ethers.provider)
        .callStatic.balanceOf(wallet)
        .then((value) => solidityTokenAmount2Float(token, value))
    )
  )

  await runnablePromise()

  const balancesAfter = await Promise.all(
    wallets.map((wallet) =>
      token.contract
        .connect(ethers.provider)
        .callStatic.balanceOf(wallet)
        .then((value) => solidityTokenAmount2Float(token, value))
    )
  )

  return wallets.map((_, i) => solidityTokenAmount2Float(token, balancesAfter[i] - balancesBefore[i]))
}

export const bigNumber2Address = (value: BigNumber) => {
  return hexZeroPad(value.toHexString(), 20).toLowerCase()
}

export const getExpectedCashoutAndTax = async (supplyToken: TokenData, account: AllConnectors) => {
  const positionValue = await account.callStatic.getPositionValue()
  const principalValue = await account.callStatic.getPrincipalValue()
  const profitValue = positionValue.gt(principalValue) ? positionValue.sub(principalValue) : BigNumber.from(0)

  const principalTax = principalValue.mul(SUBSIDY_PRINCIPAL).div(MANTISSA)
  const profitTax = profitValue.mul(SUBSIDY_PROFIT).div(MANTISSA)
  const expectedTax = principalTax.add(profitTax)

  const floatExpectedPrincipalTax = solidityTokenAmount2Float(supplyToken, principalTax)
  const floatExpectedProfitTax = solidityTokenAmount2Float(supplyToken, profitTax)
  const floatExpectedTax = solidityTokenAmount2Float(supplyToken, expectedTax)
  const floatExpectedCashout = solidityTokenAmount2Float(supplyToken, positionValue.sub(expectedTax))

  return { floatExpectedCashout, floatExpectedTax, floatExpectedPrincipalTax, floatExpectedProfitTax }
}
