import { BigNumber } from '@ethersproject/bignumber'
import { Token } from '@uniswap/sdk-core'
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk'
import axios from 'axios'
import { ethers, providers } from 'ethers'
import { find, map } from 'lodash'

import { UNI_V3_FACTORY } from '../../constants/deploy'
import { BAT, COMP, DAI, LINK, TokenData, TUSD, UNI, USDC, USDT, WBTC, WETH, ZRX } from '../../constants/tokens'
import { FEE_AMOUNTS } from '../../constants/uniswap_fees'
import { encodePath, float2SolidityTokenAmount } from '../../test/shared/utils'
import { IUniswapV3Pool__factory } from '../../typechain'
export enum PROTOCOL {
  UNISWAP_V2 = 'UNISWAP_V2',
  UNISWAP_V3 = 'UNISWAP_V3',
  SUSHI = 'SUSHI',
}

const AddressZero = '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5'
const OneInchETHAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

interface IOneInchResponseToken {
  symbol: string
  name: string
  address: string
  decimals: number
}

interface IOneInchResponseRoutePart {
  name: string
  part: number
  fromTokenAddress: string
  toTokenAddress: string
}

export interface IOneInchResponse {
  fromToken: IOneInchResponseToken
  toToken: IOneInchResponseToken
  toTokenAmount: string
  fromTokenAmount: string
  protocols: IOneInchResponseRoutePart[][][]
}

export async function queryOneInch(
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string | BigNumber,
  protocol: PROTOCOL,
  maxNumberOfSwaps: number
) {
  amount = amount.toString()
  try {
    const query =
      `https://api.1inch.exchange/v3.0/1/swap?` +
      `fromTokenAddress=${fromTokenAddress.toLowerCase()}` +
      `&toTokenAddress=${toTokenAddress.toLowerCase()}` +
      `&amount=${amount}` +
      `&fromAddress=${AddressZero}` +
      `&protocols=${protocol}` +
      `&slippage=10` +
      `&disableEstimate=true` +
      `&mainRouteParts=1` + // disallow parallel swaps, make it all linear
      `&parts=1` // disallow parallel swaps, make it all linear

    const response = await axios.get<IOneInchResponse>(query)

    if (response.status != 200) {
      throw new Error(JSON.stringify(response))
    }
    return response.data
  } catch (error) {
    console.error(error)
  }
}

export async function computeBestPool(provider: providers.Provider, pools: string[]) {
  const liquidities = await Promise.all(
    pools.map((pool) =>
      IUniswapV3Pool__factory.connect(pool, provider)
        .callStatic.liquidity()
        .catch(() => ethers.constants.Zero)
    )
  )

  const best = pools.reduce((best, _, index) => (liquidities[index].gte(liquidities[best]) ? index : best), 0)
  return pools[best]
}

export async function deriveUniswapV3Path(
  tokenIn: TokenData,
  tokenOut: TokenData,
  oneInchResponse: IOneInchResponse,
  provider: providers.Provider
) {
  let tokenPath: string[] = [tokenIn.address]
  let feePath: FeeAmount[] = []

  for (let [{ fromTokenAddress, toTokenAddress }] of oneInchResponse.protocols[0]) {
    if (fromTokenAddress === OneInchETHAddress) fromTokenAddress = WETH.address.toLowerCase()
    if (toTokenAddress === OneInchETHAddress) toTokenAddress = WETH.address.toLowerCase()

    const factoryAddress = UNI_V3_FACTORY
    const tokenA = new Token(1, fromTokenAddress, 18)
    const tokenB = new Token(1, toTokenAddress, 18)

    const pools = FEE_AMOUNTS.map((fee) => {
      return { address: computePoolAddress({ factoryAddress, tokenA, tokenB, fee }).toLowerCase(), fee }
    })
    const bestPool = await computeBestPool(provider, map(pools, 'address'))

    let { address: pool, fee: feeTier } = find(pools, ({ address }) => address === bestPool)!
    if (!pool) throw new Error(`Could not find suitable pool inside 1inch 's reponse`)

    if (!pool)
      throw new Error(`Invalid 1inch response: no valid pool in tx calldata, looking for one of: ${pools.join(',')}`)

    if (tokenPath.indexOf(toTokenAddress) != -1) {
      console.error(JSON.stringify(oneInchResponse))
      throw new Error(`Invalid 1inch response: token ${toTokenAddress} has been repeated along the path`)
    }

    tokenPath.push(toTokenAddress)
    feePath.push(feeTier)

    if (toTokenAddress.toLowerCase() === tokenOut.address.toLowerCase()) break
  }

  // Since we are doing this with exact outputs, we need to reverse the path
  tokenPath = tokenPath.reverse()
  feePath = feePath.reverse()

  if (tokenPath[0].toLowerCase() != tokenOut.address.toLowerCase())
    throw new Error(`Token mismatch: start of path must be ${tokenOut.address}. Got ${tokenPath[0]}`)

  return { tokenPath, feePath }
}

export async function findBestUniswapV3Route(
  tokenIn: TokenData,
  tokenOut: TokenData,
  amountIn: number | BigNumber,
  provider: providers.Provider,
  maxNumberOfSwaps = 5
) {
  if (typeof amountIn === 'number') amountIn = float2SolidityTokenAmount(tokenIn, amountIn)

  if (amountIn.isNegative()) throw new Error(`amountIn cannot be negative`)

  const oneInchResponse = await queryOneInch(
    tokenIn.address,
    tokenOut.address,
    amountIn,
    PROTOCOL.UNISWAP_V3,
    maxNumberOfSwaps
  )

  if (!oneInchResponse || oneInchResponse.protocols.length != 1)
    throw new Error(`Invalid oneInch response\n${JSON.stringify(oneInchResponse)}`)
  const expectedAmountOut = BigNumber.from(oneInchResponse.toTokenAmount)
  const { tokenPath, feePath } = await deriveUniswapV3Path(tokenIn, tokenOut, oneInchResponse, provider)

  const encodedPath = encodePath(tokenPath, feePath)
  return { encodedPath, tokenPath, feePath, expectedAmountOut, oneInchResponse }
}

export function findBestFlashPair(token: string) {
  token = token.toLowerCase()
  let tokenPath: string[]
  let feePath: FeeAmount[]

  switch (token) {
    case WETH.address.toLowerCase():
    case USDC.address.toLowerCase():
      tokenPath = [WETH.address, USDC.address]
      feePath = [FeeAmount.LOW]
      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      }

    case WBTC.address.toLowerCase():
      tokenPath = [WBTC.address, WETH.address]
      feePath = [FeeAmount.LOW]

      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      }
    case DAI.address.toLowerCase():
      tokenPath = [USDC.address, DAI.address]
      feePath = [FeeAmount.LOW]
      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      } // DAI-USDC-0.05%
    case LINK.address.toLowerCase():
      tokenPath = [WETH.address, LINK.address]
      feePath = [FeeAmount.MEDIUM]
      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      } // LINK-WETH-0.3%
    case COMP.address.toLowerCase():
      tokenPath = [WETH.address, COMP.address]
      feePath = [FeeAmount.MEDIUM]

      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      } // COMP-WETH-0.3%
    case BAT.address.toLowerCase():
      tokenPath = [WETH.address, BAT.address]
      feePath = [FeeAmount.MEDIUM]
      ethers.constants.AddressZero
      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      } // BAT-WETH-0.3%
    case UNI.address.toLowerCase():
      tokenPath = [WETH.address, UNI.address]
      feePath = [FeeAmount.MEDIUM]

      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      } // UNI-WETH-0.3%
    case ZRX.address.toLowerCase():
      tokenPath = ['0x3b94440c8c4f69d5c9f47bab9c5a93064df460f5', ZRX.address]
      feePath = [FeeAmount.MEDIUM]

      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      } //ZRX-RNG-0.3%
    case TUSD.address.toLowerCase():
      tokenPath = [TUSD.address, USDT.address]
      feePath = [FeeAmount.LOW]

      return {
        encodedPath: encodePath(tokenPath, feePath),
        tokenPath,
        feePath,
        expectedAmountOut: BigNumber.from(0),
      } //TUSD-USDT-0.05%
    default:
      throw new Error(`Invalid token ${token}`)
  }
}
