import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { formatEther } from 'ethers/lib/utils'
import { deployments, ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { last } from 'lodash'
import { PANCAKE_ROUTER, VENUS_PLATFORM } from '../constants/deploy'
import { BSCUSDT, TokenData, WBNB } from '../constants/tokens'
import { MANTISSA } from '../test/shared/constants'
import { CHAIN_ID, findBestRoute, PROTOCOL } from '../test/shared/routeFinder'
import { float2SolidityTokenAmount, solidityTokenAmount2Float } from '../test/shared/utils'
import {
  FodlNFT,
  FodlNFT__factory,
  FoldingRegistry,
  FoldingRegistry__factory,
  IVComptroller__factory,
  LendingPlatformLens,
  LendingPlatformLens__factory,
  PancakeswapRouter,
  PancakeswapRouter__factory,
} from '../typechain'

const BNB_PRINCIPAL_AMOUNT = 100

describe('Price Impact', () => {
  const inVenus = {
    platform: VENUS_PLATFORM,
    platformName: 'VENUS',
  }

  // Max leverage for a coin: CF / (1-CF) where CF = Collateral Factor
  interface ITEST_TABLE {
    platformName: string
    platform: string
    principalToken: TokenData
    borrowToken: TokenData
    principalAmount: number
  }

  const TESTS_TABLE: ITEST_TABLE[] = [
    // Venus test cases

    { ...inVenus, principalToken: WBNB, borrowToken: BSCUSDT, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: BSCUSDC, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: BSCDAI, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: BTCB, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: BUSD, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: BETH, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: ADA, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: XRP, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: LTC, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: BCH, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: DOGE, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: DOT, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: SXP, principalAmount: BNB_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: WBNB, borrowToken: CAKE, principalAmount: BNB_PRINCIPAL_AMOUNT },

    // { ...inVenus, principalToken: BUSD, borrowToken: BSCUSDT, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: BSCUSDC, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: BSCDAI, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: BTCB, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: WBNB, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: BETH, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: ADA, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: XRP, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: LTC, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: BCH, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: DOGE, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: DOT, principalAmount: USD_PRINCIPAL_AMOUNT },
    // { ...inVenus, principalToken: BUSD, borrowToken: SXP, principalAmount: USD_PRINCIPAL_AMOUNT },
  ]

  let alice: SignerWithAddress
  let lens: LendingPlatformLens
  let registry: FoldingRegistry
  let nft: FodlNFT
  let router: PancakeswapRouter
  let comptroller = IVComptroller__factory.connect(VENUS_PLATFORM, ethers.provider)
  let priceImpact: number = 0

  const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
    const signers = await hre.ethers.getSigners()
    alice = signers[0]

    const {
      FoldingRegistry_Proxy: { address: registryAddress },
      FodlNFT: { address: fodlNFTAddress },
      LendingPlatformLens: { address: lensAddress },
    } = await deployments.fixture()

    registry = FoldingRegistry__factory.connect(registryAddress, alice)
    nft = FodlNFT__factory.connect(fodlNFTAddress, alice)
    lens = LendingPlatformLens__factory.connect(lensAddress, hre.ethers.provider)
    router = PancakeswapRouter__factory.connect(PANCAKE_ROUTER, hre.ethers.provider)
  })

  const getPriceImpact = async (amountIn: number, tokenIn: TokenData, tokenOut: TokenData, tokenPath: string[]) => {
    const one = float2SolidityTokenAmount(tokenIn, 1)

    const currentVirtualPrice = await router
      .getAmountsOut(one, tokenPath)
      .then(last)
      .then((amountOut_BN) => {
        return solidityTokenAmount2Float(tokenOut, amountOut_BN!)
      })

    const amountIn_BN = float2SolidityTokenAmount(tokenIn, amountIn)
    const amountOut_BN = last(await router.getAmountsOut(amountIn_BN, tokenPath))

    if (!amountOut_BN) throw new Error(`Could not quote on pancake router`)
    const amountOut = solidityTokenAmount2Float(tokenOut, amountOut_BN)

    const executionPrice = amountOut / amountIn
    const difference = 100 * Math.abs(1 - executionPrice / currentVirtualPrice)

    return difference
  }

  beforeEach('deploy system', async () => {
    priceImpact = 0
    await fixture()
  })

  TESTS_TABLE.forEach(({ platform, platformName, principalToken, borrowToken, principalAmount }) => {
    it(`${platformName}\t${principalToken.symbol}\t${borrowToken.symbol}`, async () => {
      let tokenPath: string[] = []

      const [{ referencePrice: principalTokenPrice, collateralFactor }, { referencePrice: borrowTokenPrice }] =
        await lens.callStatic.getAssetMetadata([platform, platform], [principalToken.address, borrowToken.address])

      const leverageBN = MANTISSA.mul(collateralFactor).div(MANTISSA.sub(collateralFactor))
      const leverage = parseFloat(formatEther(leverageBN))

      const principalAmountBN = float2SolidityTokenAmount(principalToken, principalAmount)
      const supplyAmountBN = float2SolidityTokenAmount(principalToken, principalAmount * leverage)
      const price = principalTokenPrice.mul(MANTISSA).div(borrowTokenPrice)
      const borrowAmountBN = supplyAmountBN.sub(principalAmountBN).mul(price).div(MANTISSA)

      ;({ tokenPath } = await findBestRoute(
        PROTOCOL.PANCAKESWAP_V2,
        CHAIN_ID.BSC,
        borrowToken,
        principalToken,
        borrowAmountBN
      ))

      priceImpact = await getPriceImpact(
        solidityTokenAmount2Float(borrowToken, borrowAmountBN),
        borrowToken,
        principalToken,
        tokenPath
      )
    })
  })

  afterEach('print price impact', async () => {
    console.log(`\t> Price impact: ${priceImpact.toFixed(2)}%`)
  })
})
