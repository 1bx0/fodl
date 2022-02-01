import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'

/**
 * Amounts
 */

export const ONE_ETH = parseUnits('1', 'ether')

export const MANTISSA = BigNumber.from(10).pow(18)

export const MCD_WARD = '0x9759a6ac90977b93b58547b4a71c78317f391a28'
