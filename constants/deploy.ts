import { parseUnits } from 'ethers/lib/utils'
import {
  BAT,
  cBAT,
  cCOMP,
  cDAI,
  cETH,
  cLINK,
  COMP,
  cTUSD,
  cUNI,
  cUSDC,
  cUSDT,
  cWBTC2,
  cZRX,
  DAI,
  LINK,
  TUSD,
  UNI,
  USDC,
  USDT,
  WBTC,
  WETH,
  ZRX,
} from './tokens'

export const ERC721_NAME = 'TEST_NAME'
export const ERC721_SYMBOL = 'TEST'

export const LP_USDC_FODL_STAKING_ADDRESS = '0xF958a023d5B1e28c32373547bDdE001cAD17E9B4'
export const LP_ETH_FODL_STAKING_ADDRESS = '0xA7453338ccc29E4541e6C6B0546A99Cc6b9EB09a'
export const FIRST_LP_STAKING_REWARD_INDEX = 6
export const STAKING_TREASURY_ADDRESS = '0xaA2312935201146555078E2a6C0B0FeaAEE43452'
export const SSS_REWARDS_START_TIME = 1638338400 // 1st December 6am
export const SUBSIDY_HOLDER_ADDRESS = '0xfF6062AAc9A6367Ce2F02C826C544a130baBCf32' // mainnet tax address
export const SUBSIDY_PROFIT = parseUnits('0.025', 18)
export const SUBSIDY_PRINCIPAL = parseUnits('0.001', 18)
export const SUBSIDY_REWARDS = parseUnits('0.1', 18) // TODO: What percentage should we use here? 10% now

export const FODL_TOKEN_INITIAL_AMOUNT = parseUnits('1000000000', 18)

export const FODL_NFT_NAME = 'FODL Positions'
export const FODL_NFT_SYMBOL = 'FODL-POS'

export const ONE_DAY_SECONDS = 24 * 60 * 60
export const STAKING_EPOCH_DURATION_SEC = 7 * ONE_DAY_SECONDS
export const REWARDS_TAXING_PERIOD_SECONDS = 365 * ONE_DAY_SECONDS

export const COMPOUND_PLATFORM = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B'
export const COMPOUND_TOKENS_TO_CTOKENS = {
  [USDC.address]: cUSDC.address,
  [DAI.address]: cDAI.address,
  [WETH.address]: cETH.address,
  [WBTC.address]: cWBTC2.address,
  [USDT.address]: cUSDT.address,
  [UNI.address]: cUNI.address,
  [COMP.address]: cCOMP.address,
  [TUSD.address]: cTUSD.address,
  [ZRX.address]: cZRX.address,
  [LINK.address]: cLINK.address,
  [BAT.address]: cBAT.address,
}

export const AAVE_PLATFORM = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5'
export const AAVE_PLATFORM_DATA_PROVIDER = '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d'
export const AAVE_PLATFORM_INCENTIVES_CONTROLLER = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5'

export const ONE_INCH_EXCHANGE = '0x111111125434b319222CdBf8C261674aDB56F3ae'

export const UNI_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
export const UNI_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
export const UNI_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
export const UNI_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
export const UNI_V3_QUOTERV2 = '0x0209c4Dc18B2A1439fD2427E34E7cF3c6B91cFB9'
export const SUSHI_ROUTER = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'

export const DYDX_SOLO = '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e'

/**
 * Flags to use Uniswap or 1inch when swapping flash loans
 */

export const USE_ONEINCH_EXCHANGE = '0x00'
export const USE_UNISWAP_EXCHANGE = '0x01'
export const USE_SUSHISWAP_EXCHANGE = '0x02'
export const USE_CONTROLLED_EXCHANGE = '0xff'

export const TOKEN_URI_SIGNER_ADDRESS = '0x7E771C0DB0233f8f06361a7FAa9B7637E0bd39F4'
