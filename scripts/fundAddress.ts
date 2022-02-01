import { DAI, FODL, USDC, USDT, WBTC, WETH } from '../constants/tokens'
import { float2SolidityTokenAmount } from '../test/shared/utils'
import { sendToken } from '../scripts/utils'
import { isAddress } from '@ethersproject/address'

function fetchTokenDataByName(tokenName: string) {
  tokenName = tokenName.toUpperCase().trim()
  switch (tokenName) {
    case 'USDC':
      return USDC
    case 'DAI':
      return DAI
    case 'WBTC':
      return WBTC
    case 'ETH':
      return WETH
    case 'WETH':
      return WETH
    case 'USDT':
      return USDT
    case 'FODL':
      return FODL
    default:
      throw new Error(`Unavailable token name ${tokenName}`)
  }
}

async function main(): Promise<any> {
  const tokenName = process.env.TOKEN
  const recipient = process.env.RECIPIENT
  const amount = parseFloat(process.env.AMOUNT || '0')

  if (!tokenName || !recipient || !amount) throw new Error(`Missing inputs`)
  if (!isAddress(recipient)) throw new Error(`${recipient} is not a valid ETH address`)
  const token = fetchTokenDataByName(tokenName)
  await sendToken(token.contract, recipient, float2SolidityTokenAmount(token, amount))
  console.log(`[SUCCESS] Sent ${amount} ${token.symbol} (${token.address}) to ${recipient}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
