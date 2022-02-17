import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { cloneDeep, last } from 'lodash'
import { PANCAKE_ROUTER, USE_PANCAKESWAP_EXCHANGE, VENUS_PLATFORM } from '../constants/deploy'
import { BSCDAI, BSCUSDC, BSCUSDT, BTCB, BUSD, TokenData, WBNB } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { MANTISSA } from '../test/shared/constants'
import { float2SolidityTokenAmount, solidityTokenAmount2Float } from '../test/shared/utils'
import {
  AllConnectorsBSC,
  AllConnectorsBSC__factory,
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
import { findBestBSCRoute } from './shared/BSCRouteFinder'

const BNB_PRINCIPAL_AMOUNT = 1_000
const BTC_PRINCIPAL_AMOUNT = 10
const USD_PRINCIPAL_AMOUNT = 100_000

const MAX_DEVIATION = 0.4

describe.only('SimplePositionFoldingConnector', () => {
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
    leverage: number
  }

  const TESTS_TABLE: ITEST_TABLE[] = [
    // Venus test cases
    { ...inVenus, principalToken: WBNB, borrowToken: BSCUSDT, principalAmount: BNB_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: WBNB, borrowToken: BSCUSDC, principalAmount: BNB_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: WBNB, borrowToken: BSCDAI, principalAmount: BNB_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: WBNB, borrowToken: BTCB, principalAmount: BNB_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: WBNB, borrowToken: BUSD, principalAmount: BNB_PRINCIPAL_AMOUNT, leverage: 2 },

    // { ...inVenus, principalToken: BTCB, borrowToken: BSCUSDT, principalAmount: BTC_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BTCB, borrowToken: BSCUSDC, principalAmount: BTC_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BTCB, borrowToken: BSCDAI, principalAmount: BTC_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BTCB, borrowToken: WBNB, principalAmount: BTC_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BTCB, borrowToken: BUSD, principalAmount: BTC_PRINCIPAL_AMOUNT, leverage: 2 },

    // { ...inVenus, principalToken: BUSD, borrowToken: BSCUSDT, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BUSD, borrowToken: BSCUSDC, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BUSD, borrowToken: BSCDAI, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BUSD, borrowToken: BTCB, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BUSD, borrowToken: WBNB, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },

    // { ...inVenus, principalToken: BSCDAI, borrowToken: BSCUSDT, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BSCDAI, borrowToken: BSCUSDC, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BSCDAI, borrowToken: WBNB, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BSCDAI, borrowToken: BTCB, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },
    // { ...inVenus, principalToken: BSCDAI, borrowToken: BUSD, principalAmount: USD_PRINCIPAL_AMOUNT, leverage: 2 },

    /**
     * XVS gives troubles due to borrow cap
     */

    // { ...inVenus, principalToken: WBNB, borrowToken: XVS, principalAmount: 10, leverage: 1.2 },
    // { ...inVenus, principalToken: BUSD, borrowToken: XVS, principalAmount: 10, leverage: 2 },
    // { ...inVenus, principalToken: BTCB, borrowToken: XVS, principalAmount: 10, leverage: 2 },
    // { ...inVenus, principalToken: BSCDAI, borrowToken: XVS, principalAmount: 10, leverage: 2 },
  ]

  let alice: SignerWithAddress
  let account: AllConnectorsBSC
  let lens: LendingPlatformLens
  let registry: FoldingRegistry
  let nft: FodlNFT
  let router: PancakeswapRouter
  let comptroller = IVComptroller__factory.connect(VENUS_PLATFORM, ethers.provider)
  let priceImpact: number = 0

  const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
    const signers = await ethers.getSigners()
    alice = signers[0]

    const {
      FoldingRegistry_Proxy: { address: registryAddress },
      FodlNFT: { address: fodlNFTAddress },
      LendingPlatformLens: { address: lensAddress },
    } = await deployments.fixture()

    registry = FoldingRegistry__factory.connect(registryAddress, alice)
    nft = FodlNFT__factory.connect(fodlNFTAddress, alice)
    lens = LendingPlatformLens__factory.connect(lensAddress, ethers.provider)
    router = PancakeswapRouter__factory.connect(PANCAKE_ROUTER, ethers.provider)

    account = AllConnectorsBSC__factory.connect(await registry.callStatic.createAccount(), alice)
    await registry.createAccount()

    await sendToken(WBNB, alice.address, BNB_PRINCIPAL_AMOUNT * 100)
    await sendToken(BTCB, alice.address, BTC_PRINCIPAL_AMOUNT * 100)
    await sendToken(BUSD, alice.address, USD_PRINCIPAL_AMOUNT * 100)
    await sendToken(BSCDAI, alice.address, USD_PRINCIPAL_AMOUNT * 100)
    await sendToken(BSCUSDC, alice.address, USD_PRINCIPAL_AMOUNT * 100)

    await WBNB.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    await BTCB.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    await BUSD.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    await BSCDAI.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    await BSCUSDC.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
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

  TESTS_TABLE.forEach(({ platform, platformName, principalToken, borrowToken, principalAmount, leverage }) => {
    it(`${platformName}\t${principalToken.symbol}\t${borrowToken.symbol}`, async () => {
      let tokenPath: string[] = []

      const [{ referencePrice: principalTokenPrice }, { referencePrice: borrowTokenPrice }] =
        await lens.callStatic.getAssetMetadata(
          [VENUS_PLATFORM, VENUS_PLATFORM],
          [principalToken.address, borrowToken.address]
        )

      {
        await principalToken.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
        const principalAmountBN = float2SolidityTokenAmount(principalToken, principalAmount)
        const supplyAmountBN = float2SolidityTokenAmount(principalToken, principalAmount * leverage)
        const minSupplyAmountBN = BigNumber.from(0)
        const price = principalTokenPrice.mul(MANTISSA).div(borrowTokenPrice)
        const borrowAmountBN = supplyAmountBN.sub(principalAmountBN).mul(price).div(MANTISSA)

        ;({ tokenPath } = await findBestBSCRoute(borrowToken, principalToken, borrowAmountBN))
        const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
          ['bytes1', 'address[]'],
          [USE_PANCAKESWAP_EXCHANGE, tokenPath]
        )

        priceImpact = await getPriceImpact(
          solidityTokenAmount2Float(borrowToken, borrowAmountBN),
          borrowToken,
          principalToken,
          tokenPath
        )

        await account.increaseSimplePositionWithLoop(
          platform,
          principalToken.address,
          principalAmountBN,
          minSupplyAmountBN,
          borrowToken.address,
          borrowAmountBN,
          encodedExchangeData
        )
      }

      // Increase leverage
      {
        const targetLeverage = 3
        const positionValue = solidityTokenAmount2Float(principalToken, await account.callStatic.getPositionValue())

        const targetSupplyAmount = positionValue * targetLeverage
        const targetSupplyAmount_BN = float2SolidityTokenAmount(principalToken, targetSupplyAmount)

        const supplyAmountBN = targetSupplyAmount_BN.sub(await account.callStatic.getSupplyBalance())
        const borrowAmount_BN = supplyAmountBN.mul(principalTokenPrice).div(borrowTokenPrice)
        const slippage = MANTISSA.mul(80).div(100)
        const minSupplyAmountBN = supplyAmountBN.mul(slippage).div(MANTISSA)

        const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
          ['bytes1', 'address[]'],
          [USE_PANCAKESWAP_EXCHANGE, tokenPath]
        )

        await account.increaseSimplePositionWithLoop(
          platform,
          principalToken.address,
          0,
          minSupplyAmountBN,
          borrowToken.address,
          borrowAmount_BN,
          encodedExchangeData
        )
      }

      // Withdraw without changing leverage
      {
        const withdrawAmount = principalAmount / 10
        const withdrawAmount_BN = float2SolidityTokenAmount(principalToken, withdrawAmount)

        const supplyBalance = solidityTokenAmount2Float(principalToken, await account.callStatic.getSupplyBalance())
        const positionValue = solidityTokenAmount2Float(principalToken, await account.callStatic.getPositionValue())

        const targetLeverage = supplyBalance / positionValue
        const targetSupplyAmount = (positionValue - withdrawAmount) * targetLeverage

        if (targetSupplyAmount < 0) throw new Error(`Withdraw amount too high`)

        const targetSupplyAmount_BN = float2SolidityTokenAmount(principalToken, targetSupplyAmount)

        const redeemAmount_BN = (await account.callStatic.getSupplyBalance())
          .sub(targetSupplyAmount_BN)
          .sub(withdrawAmount_BN)

        // Slippage is applied to minRepayAmount: substract slippage percentage
        const minRepayAmount_BN = redeemAmount_BN.mul(principalTokenPrice).div(borrowTokenPrice).mul(80).div(100)

        // const minRepayAmount_BN = BigNumber.from(0)

        const _tokenPath = cloneDeep(tokenPath).reverse()

        const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
          ['bytes1', 'address[]'],
          [USE_PANCAKESWAP_EXCHANGE, _tokenPath]
        )

        await account.decreaseSimplePositionWithLoop(
          platform,
          principalToken.address,
          withdrawAmount_BN,
          redeemAmount_BN,
          borrowToken.address,
          minRepayAmount_BN,
          encodedExchangeData
        )

        const finalSupplyBalance = solidityTokenAmount2Float(
          principalToken,
          await account.callStatic.getSupplyBalance()
        )
        expect(finalSupplyBalance).to.be.closeTo(targetSupplyAmount, targetSupplyAmount * MAX_DEVIATION)
      }

      // // Decrease leverage
      {
        const targetLeverage = 1.02
        const positionValue = solidityTokenAmount2Float(principalToken, await account.callStatic.getPositionValue())
        const targetSupplyAmount = positionValue * targetLeverage
        const targetSupplyAmount_BN = float2SolidityTokenAmount(principalToken, targetSupplyAmount)

        const redeemAmount_BN = (await account.callStatic.getSupplyBalance()).sub(targetSupplyAmount_BN)

        let minRepayAmount_BN = redeemAmount_BN.mul(principalTokenPrice).div(borrowTokenPrice)
        minRepayAmount_BN = minRepayAmount_BN.mul(80).div(100) // Substract slippage

        // findBestBSCRoute(principalToken, borrowToken, minRepayAmount_BN))
        const _tokenPath = cloneDeep(tokenPath).reverse()

        const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
          ['bytes1', 'address[]'],
          [USE_PANCAKESWAP_EXCHANGE, _tokenPath]
        )

        await account.decreaseSimplePositionWithLoop(
          platform,
          principalToken.address,
          0,
          redeemAmount_BN,
          borrowToken.address,
          minRepayAmount_BN,
          encodedExchangeData
        )

        const finalSupplyBalance = solidityTokenAmount2Float(
          principalToken,
          await account.callStatic.getSupplyBalance()
        )
        expect(finalSupplyBalance).to.be.closeTo(targetSupplyAmount, targetSupplyAmount * MAX_DEVIATION)
      }

      // Close position
      {
        const redeemAmount_BN = (await account.callStatic.getSupplyBalance()).sub(
          await account.callStatic.getPositionValue()
        )
        let minRepayAmount_BN = redeemAmount_BN.mul(principalTokenPrice).div(borrowTokenPrice)
        minRepayAmount_BN = minRepayAmount_BN.mul(80).div(100) // Substract slippage

        // findBestBSCRoute(principalToken, borrowToken, minRepayAmount_BN))
        const _tokenPath = cloneDeep(tokenPath).reverse()

        const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
          ['bytes1', 'address[]'],
          [USE_PANCAKESWAP_EXCHANGE, _tokenPath]
        )

        await account.decreaseSimplePositionWithLoop(
          platform,
          principalToken.address,
          ethers.constants.MaxUint256,
          ethers.constants.MaxUint256,
          borrowToken.address,
          minRepayAmount_BN,
          encodedExchangeData
        )

        expect(await account.callStatic.getCollateralUsageFactor()).to.be.equal(0)
      }
    })
  })

  afterEach('print price impact', async () => {
    console.log(`\t> Price impact: ${priceImpact.toFixed(2)}%`)
  })
})
