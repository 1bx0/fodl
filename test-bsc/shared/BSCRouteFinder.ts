import { BigNumber } from '@ethersproject/bignumber'
import axios from 'axios'
import { first, last } from 'lodash'

import { TokenData, WBNB } from '../../constants/tokens'
import { float2SolidityTokenAmount } from '../../test/shared/utils'

export enum PROTOCOL {
  PANCAKESWAP_V2 = 'PANCAKESWAP_V2',
}

const BSC_CHAIN_ID = 56
const AddressZero = '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5'
const OneInchETHAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

interface IOneInchResponseToken {
  symbol: string
  name: string
  address: string
  decimals: number
  logoUri: string
}

interface IOneInchResponseRoutePart {
  name: string
  part: number
  fromTokenAddress: string
  toTokenAddress: string
}

interface IOneInchResponse {
  fromToken: IOneInchResponseToken
  toToken: IOneInchResponseToken
  toTokenAmount: string
  fromTokenAmount: string
  protocols: IOneInchResponseRoutePart[][][]
  estimatedGas: number
  tx: { data: string }
}

export async function queryOneInch(
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string | BigNumber,
  protocol: PROTOCOL[]
) {
  amount = amount.toString()
  try {
    let query = `https://api.1inch.exchange/v3.0/${BSC_CHAIN_ID}/swap?`
    query += `fromTokenAddress=${fromTokenAddress.toLowerCase()}`
    query += `&toTokenAddress=${toTokenAddress.toLowerCase()}`
    query += `&amount=${amount}`
    query += `&fromAddress=${AddressZero}`
    query += `&protocols=${protocol.join(',')}`
    query += `&slippage=10`
    query += `&disableEstimate=true`
    query += `&mainRouteParts=1`
    query += `&parts=1`

    const response = await axios.get<IOneInchResponse>(query)

    if (response.status != 200) {
      throw new Error(JSON.stringify(response))
    }
    return response.data
  } catch (error) {
    console.error(error)
  }
}

export async function findBestBSCRoute(tokenIn: TokenData, tokenOut: TokenData, amountIn: number | BigNumber) {
  if (typeof amountIn === 'number') amountIn = float2SolidityTokenAmount(tokenIn, amountIn)

  if (amountIn.isNegative()) throw new Error(`amountIn cannot be negative`)

  const oneInchResponse = await queryOneInch(tokenIn.address, tokenOut.address, amountIn, [PROTOCOL.PANCAKESWAP_V2])

  if (!oneInchResponse || oneInchResponse.protocols.length != 1) throw new Error(`Invalid oneInch response`)

  const expectedAmountOut = BigNumber.from(oneInchResponse.toTokenAmount)
  let tokenPath: string[] = [tokenIn.address]

  for (let [{ fromTokenAddress, toTokenAddress }] of oneInchResponse.protocols[0]) {
    if (fromTokenAddress === OneInchETHAddress) fromTokenAddress = WBNB.address.toLowerCase()
    if (toTokenAddress === OneInchETHAddress) toTokenAddress = WBNB.address.toLowerCase()
    tokenPath.push(toTokenAddress.toLowerCase())

    if (toTokenAddress.toLowerCase() === tokenOut.address.toLowerCase()) break
  }

  if (first(tokenPath)?.toLowerCase() != tokenIn.address.toLowerCase())
    throw new Error(`Token mismatch: start of path must be ${tokenIn.address}. Got ${first(tokenPath)}`)

  if (last(tokenPath)?.toLowerCase() != tokenOut.address.toLowerCase())
    throw new Error(`Token mismatch: end of path must be ${tokenOut.address}. Got ${last(tokenPath)}`)

  return { tokenPath, expectedAmountOut, oneInchResponse }
}
