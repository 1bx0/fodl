declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    timeAndMine: {
      increaseTime(seconds: number): Promise<void>
    }
  }
}

import { formatUnits } from '@ethersproject/units'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { assert } from 'console'
import { BigNumber, BigNumberish } from 'ethers'
import { deployments, ethers, timeAndMine } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { COMPOUND_PLATFORM, AAVE_PLATFORM, SUBSIDY_HOLDER_ADDRESS } from '../constants/deploy'
import { WETH, DAI, USDC, WBTC, USDT, LINK, TokenData, COMP, BAT, UNI, ZRX, TUSD } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { MANTISSA } from '../test/shared/constants'
import {
  createFoldingAccount,
  encodePath,
  float2SolidityTokenAmount,
  getAaveQuote,
  getBalanceDeltas,
  getCompoundQuote,
  getExpectedCashoutAndTax,
  solidityTokenAmount2Float,
  v3QuoteExactOutput,
} from '../test/shared/utils'
import {
  AaveLendingAdapter,
  AavePriceOracleMock,
  AllConnectors,
  CompoundForksLendingAdapter,
  CompoundPriceOracleMock,
  FodlNFT,
  FoldingRegistry,
  IERC20__factory,
} from '../typechain'
import { OneInchResponses } from './test-artifacts/oneInchResponses'
import { findBestFlashPair, deriveUniswapV3Path } from './utils/RouteFinders'

describe('V3FlashswapMultihop', () => {
  const onCompound = {
    platformName: 'COMPOUND',
    platform: COMPOUND_PLATFORM,
  }

  const onAave = {
    platformName: 'AAVE',
    platform: AAVE_PLATFORM,
  }

  let alice: SignerWithAddress
  let account: AllConnectors
  let compoundPriceOracleMock: CompoundPriceOracleMock
  let foldingRegistry: FoldingRegistry

  const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, ethers } = hre

    const [alice, bot, mallory] = await ethers.getUnnamedSigners()

    await deployments.fixture()

    const fodlNFT = (await ethers.getContract('FodlNFT')) as FodlNFT
    const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

    const { account } = await createFoldingAccount(foldingRegistry, alice)
    const { account: unconfiguredAccount } = await createFoldingAccount(foldingRegistry, alice)

    const aaveLendingAdapter = (await ethers.getContract('AaveLendingAdapter')) as AaveLendingAdapter
    const compoundLendingAdapter = (await ethers.getContract(
      'CompoundForksLendingAdapter'
    )) as CompoundForksLendingAdapter

    const compoundPriceOracleMock = (await ethers.getContract('CompoundPriceOracleMock')) as CompoundPriceOracleMock
    const aavePriceOracleMock = (await ethers.getContract('AavePriceOracleMock')) as AavePriceOracleMock

    for (const token of [WETH, DAI, USDC, USDT, WBTC, LINK, COMP, UNI, BAT, ZRX, TUSD]) {
      await sendToken(token.contract, alice.address)
      await token.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    }

    return {
      account,
      unconfiguredAccount,
      alice,
      bot,
      mallory,
      foldingRegistry,
      aaveLendingAdapter,
      aavePriceOracleMock,
      compoundLendingAdapter,
      compoundPriceOracleMock,
      fodlNFT,
    }
  })

  beforeEach('load fixture', async () => {
    ;({ account, compoundPriceOracleMock, alice, foldingRegistry } = await fixture())
  })

  // Configure slippage that can be tolerated by the transactions.
  // WBTC -> DAI has a 3% price impact slippage at 50WBTC volume, for reference
  const maxSlippageNum = 90
  const maxSlippageDen = 50

  const maxSlippageMantissa = BigNumber.from(MANTISSA).mul(maxSlippageNum).div(maxSlippageDen)
  const maxSlippageFloat = maxSlippageNum / maxSlippageDen

  // This increases position by 1% after opening it.
  //  We want to keep it low, as we just want to test increasing the position,
  // and it can be hard if we are very close to the limit
  const increasedPositionFactor = BigNumber.from(50)

  // This is a tolerance factor of 2% used to increase v3 quotes due to interest rates
  // and desync of pools & lending platforms
  const v3QuoterErrorFactor = BigNumber.from(50)

  let supplyAmount: BigNumberish
  let flashAmount: BigNumberish
  let borrowAmount: BigNumberish
  let price: number

  let priceImpactOnOpen: number = 0
  let priceImpactOnClose: number = 0

  afterEach('print results', () => {
    console.log(
      `\t> Price impact\ton open: ${priceImpactOnOpen.toFixed(2)}%\ton close: ${priceImpactOnClose.toFixed(2)}%`
    )
    supplyAmount = 0
    flashAmount = 0
    borrowAmount = 0
    price = 0
    priceImpactOnOpen = 0
    priceImpactOnClose = 0
  })

  describe('when supply token != borrow token', () => {
    // Max leverage for a coin: CF / (1-CF) where CF = Collateral Factor
    interface ITEST_TABLE {
      platformName: string
      platform: string
      principalToken: TokenData
      borrowToken: TokenData
      principalAmount: BigNumber | number
      leverage: number
    }
    const TESTS_TABLE: ITEST_TABLE[] = [
      { ...onCompound, principalToken: WETH, borrowToken: DAI, principalAmount: 50, leverage: 2.5 },
      { ...onCompound, principalToken: WETH, borrowToken: USDC, principalAmount: 50, leverage: 2.5 },
      { ...onCompound, principalToken: WETH, borrowToken: USDT, principalAmount: 50, leverage: 2.5 },
      { ...onCompound, principalToken: WETH, borrowToken: WBTC, principalAmount: 50, leverage: 2.5 },
      { ...onCompound, principalToken: WETH, borrowToken: LINK, principalAmount: 50, leverage: 2 },
      { ...onCompound, principalToken: WBTC, borrowToken: WETH, principalAmount: 10, leverage: 1.2 },
      { ...onCompound, principalToken: WBTC, borrowToken: DAI, principalAmount: 10, leverage: 1.2 },
      { ...onCompound, principalToken: WBTC, borrowToken: USDC, principalAmount: 10, leverage: 1.2 },
      { ...onCompound, principalToken: WBTC, borrowToken: USDT, principalAmount: 10, leverage: 1.2 },
      { ...onCompound, principalToken: WBTC, borrowToken: LINK, principalAmount: 10, leverage: 1.2 },
      { ...onCompound, principalToken: LINK, borrowToken: WETH, principalAmount: 10_000, leverage: 0.3 },
      { ...onCompound, principalToken: LINK, borrowToken: DAI, principalAmount: 10_000, leverage: 0.3 },
      { ...onCompound, principalToken: LINK, borrowToken: USDC, principalAmount: 10_000, leverage: 0.3 },
      { ...onCompound, principalToken: LINK, borrowToken: USDT, principalAmount: 10_000, leverage: 0.3 },
      { ...onCompound, principalToken: LINK, borrowToken: WBTC, principalAmount: 10_000, leverage: 0.3 },
      { ...onCompound, principalToken: DAI, borrowToken: WETH, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: DAI, borrowToken: USDC, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: DAI, borrowToken: USDT, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: DAI, borrowToken: WBTC, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: DAI, borrowToken: LINK, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: USDC, borrowToken: WETH, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: USDC, borrowToken: DAI, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: USDC, borrowToken: USDT, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: USDC, borrowToken: WBTC, principalAmount: 500_000, leverage: 2 },
      { ...onCompound, principalToken: USDC, borrowToken: LINK, principalAmount: 500_000, leverage: 2 },

      { ...onAave, principalToken: WETH, borrowToken: DAI, principalAmount: 50, leverage: 2.5 },
      { ...onAave, principalToken: WETH, borrowToken: USDC, principalAmount: 50, leverage: 2.5 },
      { ...onAave, principalToken: WETH, borrowToken: USDT, principalAmount: 50, leverage: 2.5 },
      { ...onAave, principalToken: WETH, borrowToken: WBTC, principalAmount: 50, leverage: 2.5 },
      { ...onAave, principalToken: WETH, borrowToken: LINK, principalAmount: 50, leverage: 2.5 },
      { ...onAave, principalToken: WBTC, borrowToken: WETH, principalAmount: 10, leverage: 1.5 },
      { ...onAave, principalToken: WBTC, borrowToken: DAI, principalAmount: 10, leverage: 1.5 },
      { ...onAave, principalToken: WBTC, borrowToken: USDC, principalAmount: 10, leverage: 1.5 },
      { ...onAave, principalToken: WBTC, borrowToken: USDT, principalAmount: 10, leverage: 1.5 },
      { ...onAave, principalToken: WBTC, borrowToken: LINK, principalAmount: 10, leverage: 1.5 },
      { ...onAave, principalToken: LINK, borrowToken: WETH, principalAmount: 10_000, leverage: 0.5 },
      { ...onAave, principalToken: LINK, borrowToken: DAI, principalAmount: 10_000, leverage: 0.5 },
      { ...onAave, principalToken: LINK, borrowToken: USDC, principalAmount: 10_000, leverage: 0.5 },
      { ...onAave, principalToken: LINK, borrowToken: USDT, principalAmount: 10_000, leverage: 0.5 },
      { ...onAave, principalToken: LINK, borrowToken: WBTC, principalAmount: 10_000, leverage: 0.5 },
      { ...onAave, principalToken: DAI, borrowToken: WETH, principalAmount: 500_000, leverage: 2 },
      { ...onAave, principalToken: DAI, borrowToken: USDC, principalAmount: 500_000, leverage: 2 },
      { ...onAave, principalToken: DAI, borrowToken: USDT, principalAmount: 500_000, leverage: 2 },
      { ...onAave, principalToken: DAI, borrowToken: WBTC, principalAmount: 500_000, leverage: 2 },
      { ...onAave, principalToken: DAI, borrowToken: LINK, principalAmount: 500_000, leverage: 2 },
      { ...onAave, principalToken: USDC, borrowToken: WETH, principalAmount: 500_000, leverage: 2.5 },
      { ...onAave, principalToken: USDC, borrowToken: DAI, principalAmount: 500_000, leverage: 2.5 },
      { ...onAave, principalToken: USDC, borrowToken: USDT, principalAmount: 500_000, leverage: 2.5 },
      { ...onAave, principalToken: USDC, borrowToken: WBTC, principalAmount: 500_000, leverage: 2.5 },
      { ...onAave, principalToken: USDC, borrowToken: LINK, principalAmount: 500_000, leverage: 2.5 },

      // { ...onAave, principalToken: TUSD, borrowToken: WETH, principalAmount: 50_000, leverage: 2.5 }, // Low liquidity for TUSD on UNIV3
      // { ...onAave, principalToken: TUSD, borrowToken: USDC, principalAmount: 50_000, leverage: 2.5 }, // Low liquidity for TUSD on UNIV3
      // { ...onAave, principalToken: TUSD, borrowToken: DAI, principalAmount: 50_000, leverage: 2.5 }, // Low liquidity for TUSD on UNIV3
      // { ...onAave, principalToken: TUSD, borrowToken: USDT, principalAmount: 50_000, leverage: 2.5 }, // Low liquidity for TUSD on UNIV3
      // { ...onAave, principalToken: TUSD, borrowToken: WBTC, principalAmount: 50_000, leverage: 2.5 }, // Low liquidity for TUSD on UNIV3
      // { ...onAave, principalToken: TUSD, borrowToken: LINK, principalAmount: 50_000, leverage: 2.5 }, // Low liquidity for TUSD on UNIV3
    ]

    TESTS_TABLE.forEach(({ platformName, platform, principalToken, borrowToken, principalAmount, leverage }) => {
      it(`${platformName}\t${principalToken.symbol}\t${borrowToken.symbol}`, async function () {
        // Get price

        switch (platform) {
          case COMPOUND_PLATFORM:
            ;({ amountOut_float: price } = await getCompoundQuote(COMPOUND_PLATFORM, principalToken, borrowToken, 1))

            break
          case AAVE_PLATFORM:
            ;({ amountOut_float: price } = await getAaveQuote(AAVE_PLATFORM, principalToken, borrowToken, 1))
            break
          default:
            throw new Error(`Unimplemented platform ${platform}`)
        }

        flashAmount = (principalAmount as number) * leverage
        borrowAmount = price * flashAmount
        supplyAmount = (principalAmount as number) + flashAmount

        // Enforce typings
        principalAmount = float2SolidityTokenAmount(principalToken, principalAmount as number)
        flashAmount = float2SolidityTokenAmount(principalToken, flashAmount as number)
        borrowAmount = float2SolidityTokenAmount(borrowToken, borrowAmount as number)
        supplyAmount = principalAmount.add(flashAmount)

        ///////////////////////
        // Open the position
        ///////////////////////
        {
          let maxBorrowAmount = BigNumber.from(0)

          const oneInchResponseKey = `${borrowToken.symbol}-${principalToken.symbol}`
          const oneInchResponse = OneInchResponses[oneInchResponseKey]
          if (!oneInchResponse) throw new Error(`Could not find 1inch response artifact for ${oneInchResponseKey}`)

          const { tokenPath, feePath } = await deriveUniswapV3Path(
            borrowToken,
            principalToken,
            oneInchResponse,
            ethers.provider
          )
          const encodedPath = encodePath(tokenPath, feePath)

          try {
            const { amountIn_BN: simulatedBorrowAmount } = await v3QuoteExactOutput(
              borrowToken,
              principalToken,
              flashAmount,
              encodedPath
            )
            priceImpactOnOpen = Math.abs(
              parseFloat(
                formatUnits(simulatedBorrowAmount.sub(borrowAmount).mul(MANTISSA).div(simulatedBorrowAmount), 16)
              )
            )
            maxBorrowAmount = simulatedBorrowAmount.add(simulatedBorrowAmount.div(v3QuoterErrorFactor))
          } catch (e) {
            console.error(`Failed trying to quote flash amount. Path: Out <= ${tokenPath.join(' - ')} <= In`)
            console.error(JSON.stringify(oneInchResponse))
            throw e
          }

          /**
           * Finally open the position
           */
          try {
            await account.increasePositionWithV3FlashswapMultihop({
              supplyToken: principalToken.address,
              borrowToken: borrowToken.address,
              principalAmount,
              supplyAmount,
              maxBorrowAmount,
              platform,
              path: encodedPath,
            })
          } catch (e) {
            console.error(`Failed trying to open. Path: Out <= ${tokenPath.join(' - ')} <= In`)
            throw e
          }
          const collateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
          expect(collateralUsageFactor).to.be.gte(0)

          const actualSuppliedAmount = await account.callStatic.getSupplyBalance()

          expect(actualSuppliedAmount)
            .to.be.gte(supplyAmount.sub(supplyAmount.div(50)))
            .and.lte(supplyAmount.add(supplyAmount.div(50))) // Compound has some really weird roundind errors...

          // Check no leftovers in contract
          for (const address of tokenPath)
            expect(await IERC20__factory.connect(address, alice).balanceOf(account.address)).to.be.equal(0)

          /////////////////////////////
          // Increase position leverage
          /////////////////////////////

          await timeAndMine.increaseTime(600) // Neded so that AAVE does not break with low timeframes

          let additionalSupplyAmount = principalAmount.div(increasedPositionFactor)
          let maxAdditionalBorrowAmount = BigNumber.from(0)

          try {
            const { amountIn_BN: simulatedBorrowAmount } = await v3QuoteExactOutput(
              borrowToken,
              principalToken,
              additionalSupplyAmount,
              encodedPath
            )

            maxAdditionalBorrowAmount = simulatedBorrowAmount.add(simulatedBorrowAmount.div(v3QuoterErrorFactor))
          } catch (e) {
            console.error(`Failed trying to quote flash amount. Path: Out <= ${tokenPath.join(' - ')} <= In`)
            console.error(JSON.stringify(oneInchResponse))
            throw e
          }

          try {
            await account.increasePositionWithV3FlashswapMultihop({
              supplyToken: principalToken.address,
              borrowToken: borrowToken.address,
              principalAmount: 0,
              supplyAmount: additionalSupplyAmount,
              maxBorrowAmount: maxAdditionalBorrowAmount,
              platform,
              path: encodedPath,
            })
          } catch (e) {
            console.error(`Failed trying to increase leverage. Path: Out <= ${tokenPath.join(' - ')} <= In`)
            console.error(JSON.stringify(oneInchResponse))
            throw e
          }

          const actualSuppliedAmountAfterLeverageIncrease = await account.callStatic.getSupplyBalance()

          const expectedSuppliedAmountAfterLeverageIncrease = actualSuppliedAmount.add(
            additionalSupplyAmount.sub(additionalSupplyAmount.div(50))
          ) // Compound has some really weird roungind errors...

          expect(actualSuppliedAmountAfterLeverageIncrease).to.be.gte(expectedSuppliedAmountAfterLeverageIncrease)

          // Check CUF has increased
          const newCollateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
          expect(newCollateralUsageFactor).to.be.gte(collateralUsageFactor)

          // Check no leftovers in contract
          for (const address of tokenPath)
            expect(await IERC20__factory.connect(address, alice).balanceOf(account.address)).to.be.equal(0)
        }

        // ///////////////////////
        // // Close the position
        // ///////////////////////
        {
          const { floatExpectedCashout, floatExpectedTax } = await getExpectedCashoutAndTax(principalToken, account)
          const withdrawAmount = ethers.constants.MaxUint256
          const borrowTokenRepayAmount = await account.callStatic.getBorrowBalance()
          const borrowTokenRepayAmount_float = solidityTokenAmount2Float(borrowToken, borrowTokenRepayAmount)
          const supplyTokenRepayAmount_float = borrowTokenRepayAmount_float / price
          const supplyTokenRepayAmount = float2SolidityTokenAmount(principalToken, supplyTokenRepayAmount_float)

          let maxSupplyTokenRepayAmount = BigNumber.from(0)

          const oneInchResponseKey = `${principalToken.symbol}-${borrowToken.symbol}`

          const oneInchResponse = OneInchResponses[oneInchResponseKey]
          if (!oneInchResponse) throw new Error(`Could not find 1inch response artifact for ${oneInchResponseKey}`)

          const { tokenPath, feePath } = await deriveUniswapV3Path(
            principalToken,
            borrowToken,
            oneInchResponse,
            ethers.provider
          )
          const encodedPath = encodePath(tokenPath, feePath)

          try {
            const { amountIn_BN: simulatedSupplyTokenRepayAmount } = await v3QuoteExactOutput(
              principalToken,
              borrowToken,
              borrowTokenRepayAmount,
              encodedPath
            )

            priceImpactOnClose = Math.abs(
              parseFloat(
                formatUnits(
                  simulatedSupplyTokenRepayAmount
                    .sub(supplyTokenRepayAmount)
                    .mul(MANTISSA)
                    .div(simulatedSupplyTokenRepayAmount),
                  16
                )
              )
            )

            maxSupplyTokenRepayAmount = simulatedSupplyTokenRepayAmount.add(
              simulatedSupplyTokenRepayAmount.div(v3QuoterErrorFactor)
            )
          } catch (e) {
            console.error(`Failed trying to quote flash amount. Path: ${tokenPath.join(',')}`)
            console.error(JSON.stringify(oneInchResponse))
            throw e
          }

          const [aliceBalanceDelta, subsidyBalanceDelta] = await getBalanceDeltas(
            () =>
              account.decreasePositionWithV3FlashswapMultihop({
                withdrawAmount,
                maxSupplyTokenRepayAmount,
                borrowTokenRepayAmount: ethers.constants.MaxUint256,
                platform,
                supplyToken: principalToken.address,
                borrowToken: borrowToken.address,
                path: encodedPath,
              }),
            principalToken,
            [alice.address, SUBSIDY_HOLDER_ADDRESS]
          )

          // Check no leftovers in contract
          expect(await account.callStatic.getCollateralUsageFactor()).to.be.equal(0)
          for (const address of tokenPath)
            expect(await IERC20__factory.connect(address, alice).balanceOf(account.address)).to.be.equal(0)

          // Check taxes
          expect(aliceBalanceDelta).to.be.closeTo(floatExpectedCashout, floatExpectedCashout * 0.5)
          expect(subsidyBalanceDelta).to.be.closeTo(floatExpectedTax, floatExpectedTax * 0.5)
        }
      })
    })
  })

  describe('when supply token == borrow token', () => {
    // Max leverage for a coin: CF / (1-CF) where CF = Collateral Factor
    interface ITEST_TABLE {
      platformName: string
      platform: string
      principalToken: TokenData
      principalAmount: BigNumber | number
      leverage: number
    }
    const TESTS_TABLE: ITEST_TABLE[] = [
      { ...onCompound, principalToken: WETH, principalAmount: 50, leverage: 2 },
      { ...onCompound, principalToken: WBTC, principalAmount: 50, leverage: 1 },
      { ...onCompound, principalToken: USDC, principalAmount: 2_500_000, leverage: 2 },
      { ...onCompound, principalToken: DAI, principalAmount: 2_500_000, leverage: 2 },
      { ...onCompound, principalToken: LINK, principalAmount: 5000, leverage: 0.8 },
      // { ...onCompound, principalToken: COMP, principalAmount: 500, leverage: 0.8 }, market borrow cap issues?
      { ...onCompound, principalToken: BAT, principalAmount: 5000, leverage: 0.8 },
      { ...onCompound, principalToken: UNI, principalAmount: 5000, leverage: 0.8 },
      { ...onCompound, principalToken: ZRX, principalAmount: 5000, leverage: 0.8 },
      { ...onAave, principalToken: WETH, principalAmount: 50, leverage: 2 },
      { ...onAave, principalToken: WBTC, principalAmount: 50, leverage: 1 },
      { ...onAave, principalToken: USDC, principalAmount: 2_500_000, leverage: 2 },
      { ...onAave, principalToken: DAI, principalAmount: 2_500_000, leverage: 2 },
      { ...onAave, principalToken: LINK, principalAmount: 10_000, leverage: 1 },
      // { ...onAave, principalToken: TUSD, principalAmount: 200_000, leverage: 1 },
    ]

    TESTS_TABLE.forEach(({ platform, platformName, principalToken, principalAmount, leverage }) => {
      const borrowToken = principalToken

      it(`${platformName}\t${principalToken.symbol}\t${borrowToken.symbol}`, async () => {
        assert(principalToken.address === borrowToken.address)

        const path = await findBestFlashPair(principalToken.address)
        const { encodedPath, tokenPath } = path

        flashAmount = (principalAmount as number) * leverage
        supplyAmount = (principalAmount as number) + flashAmount
        borrowAmount = 0

        // Enforce typings
        principalAmount = float2SolidityTokenAmount(principalToken, principalAmount as number)
        flashAmount = float2SolidityTokenAmount(principalToken, flashAmount as number)
        borrowAmount = float2SolidityTokenAmount(borrowToken, borrowAmount as number)
        supplyAmount = principalAmount.add(flashAmount)

        ///////////////////////
        // Open the position
        ///////////////////////
        await account.increasePositionWithV3FlashswapMultihop({
          supplyToken: principalToken.address,
          borrowToken: principalToken.address,
          maxBorrowAmount: borrowAmount,
          principalAmount,
          supplyAmount,
          platform,
          path: encodedPath,
        })

        const collateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
        expect(collateralUsageFactor).to.be.gte(0)

        const actualSuppliedAmount = await account.callStatic.getSupplyBalance()

        expect(actualSuppliedAmount)
          .to.be.gte(supplyAmount.sub(supplyAmount.div(50)))
          .and.lte(supplyAmount.add(supplyAmount.div(50))) // Compound has some really weird roungind errors...

        // Check no leftovers in contract
        for (const address of tokenPath)
          expect(await IERC20__factory.connect(address, alice).balanceOf(account.address)).to.be.equal(0)

        await timeAndMine.increaseTime(600) // Neded so that AAVE does not break with low timeframes

        ///////////////////////
        // Close the position
        ///////////////////////
        {
          const { floatExpectedCashout, floatExpectedTax } = await getExpectedCashoutAndTax(principalToken, account)

          const [aliceBalanceDelta, subsidyBalanceDelta] = await getBalanceDeltas(
            () =>
              account.decreasePositionWithV3FlashswapMultihop({
                supplyToken: principalToken.address,
                borrowToken: principalToken.address,
                withdrawAmount: ethers.constants.MaxUint256,
                borrowTokenRepayAmount: ethers.constants.MaxUint256,
                maxSupplyTokenRepayAmount: 0,
                platform,
                path: encodedPath,
              }),
            principalToken,
            [alice.address, SUBSIDY_HOLDER_ADDRESS]
          )

          // Check no leftovers in contract
          expect(await account.callStatic.getCollateralUsageFactor()).to.be.equal(0)
          for (const address of tokenPath)
            expect(await IERC20__factory.connect(address, alice).balanceOf(account.address)).to.be.equal(0)

          // Check taxes
          expect(aliceBalanceDelta).to.be.closeTo(floatExpectedCashout, floatExpectedCashout * 0.5)
          expect(subsidyBalanceDelta).to.be.closeTo(floatExpectedTax, floatExpectedTax * 0.5)
        }
      })
    })
  })
})
