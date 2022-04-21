import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { cloneDeep, last } from 'lodash'
import { AAVE_PLATFORM_POLYGON, QUICKSWAP_ROUTER, USE_QUICKSWAP_EXCHANGE } from '../constants/deploy'
import { POLY, TokenData } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { MANTISSA } from '../test/shared/constants'
import { CHAIN_ID, findBestRoute, PROTOCOL } from '../test/shared/routeFinder'
import { float2SolidityTokenAmount, solidityTokenAmount2Float } from '../test/shared/utils'
import {
  AllConnectorsPolygon,
  AllConnectorsPolygon__factory,
  FodlNFT,
  FodlNFT__factory,
  FoldingRegistry,
  FoldingRegistry__factory,
  LendingPlatformLens,
  LendingPlatformLens__factory,
  PancakeswapRouter,
  PancakeswapRouter__factory,
} from '../typechain'

const MATIC_PRINCIPAL_AMOUNT = 1_000
const USD_PRINCIPAL_AMOUNT = 100_000

const MAX_DEVIATION = 0.4

describe.only('SimplePositionPolygonFoldingConnector', () => {
  const inAave = {
    platform: AAVE_PLATFORM_POLYGON,
    platformName: 'AAVE',
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
    {
      ...inAave,
      principalToken: POLY.WMATIC(),
      borrowToken: POLY.USDC(),
      principalAmount: MATIC_PRINCIPAL_AMOUNT,
      leverage: 2,
    },
  ]

  let alice: SignerWithAddress
  let account: AllConnectorsPolygon
  let lens: LendingPlatformLens
  let registry: FoldingRegistry
  let nft: FodlNFT
  let router: PancakeswapRouter
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
    router = PancakeswapRouter__factory.connect(QUICKSWAP_ROUTER, ethers.provider)

    account = AllConnectorsPolygon__factory.connect(await registry.callStatic.createAccount(), alice)
    await registry.createAccount()

    await sendToken(POLY.WMATIC(), alice.address, MATIC_PRINCIPAL_AMOUNT * 100)
    // await sendToken(POLY.USDT(), alice.address, USD_PRINCIPAL_AMOUNT * 100)
    // await sendToken(POLY.DAI(), alice.address, USD_PRINCIPAL_AMOUNT * 100)
    await sendToken(POLY.USDC(), alice.address, USD_PRINCIPAL_AMOUNT * 100)

    await POLY.WMATIC().contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    // await POLY.USDT().contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    // await POLY.DAI().contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    await POLY.USDC().contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
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
          [AAVE_PLATFORM_POLYGON, AAVE_PLATFORM_POLYGON],
          [principalToken.address, borrowToken.address]
        )

      {
        await principalToken.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
        const principalAmountBN = float2SolidityTokenAmount(principalToken, principalAmount)
        const supplyAmountBN = float2SolidityTokenAmount(principalToken, principalAmount * leverage)
        const minSupplyAmountBN = BigNumber.from(0)
        const price = principalTokenPrice.mul(MANTISSA).div(borrowTokenPrice)
        const borrowAmountBN = supplyAmountBN.sub(principalAmountBN).mul(price).div(MANTISSA)

        ;({ tokenPath } = await findBestRoute(
          PROTOCOL.POLYGON_QUICKSWAP,
          CHAIN_ID.POLYGON,
          borrowToken,
          principalToken,
          borrowAmountBN
        ))

        const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
          ['bytes1', 'address[]'],
          [USE_QUICKSWAP_EXCHANGE, tokenPath]
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

      // // Increase leverage
      // {
      //   const targetLeverage = 3
      //   const positionValue = solidityTokenAmount2Float(principalToken, await account.callStatic.getPositionValue())

      //   const targetSupplyAmount = positionValue * targetLeverage
      //   const targetSupplyAmount_BN = float2SolidityTokenAmount(principalToken, targetSupplyAmount)

      //   const supplyAmountBN = targetSupplyAmount_BN.sub(await account.callStatic.getSupplyBalance())
      //   const borrowAmount_BN = supplyAmountBN.mul(principalTokenPrice).div(borrowTokenPrice)
      //   const slippage = MANTISSA.mul(80).div(100)
      //   const minSupplyAmountBN = supplyAmountBN.mul(slippage).div(MANTISSA)

      //   const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
      //     ['bytes1', 'address[]'],
      //     [USE_QUICKSWAP_EXCHANGE, tokenPath]
      //   )

      //   await account.increaseSimplePositionWithLoop(
      //     platform,
      //     principalToken.address,
      //     0,
      //     minSupplyAmountBN,
      //     borrowToken.address,
      //     borrowAmount_BN,
      //     encodedExchangeData
      //   )
      // }

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
          [USE_QUICKSWAP_EXCHANGE, _tokenPath]
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
          [USE_QUICKSWAP_EXCHANGE, _tokenPath]
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

        const _tokenPath = cloneDeep(tokenPath).reverse()

        const encodedExchangeData = ethers.utils.defaultAbiCoder.encode(
          ['bytes1', 'address[]'],
          [USE_QUICKSWAP_EXCHANGE, _tokenPath]
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
