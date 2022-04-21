import { expect } from 'chai'
import { BigNumber, BigNumberish } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { AAVE_PLATFORM, COMPOUND_PLATFORM, COMPOUND_TOKENS_TO_CTOKENS } from '../constants/deploy'
import { DAI, TokenData, USDC, WETH } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { CompoundPriceOracleMock } from '../typechain'
import { AavePriceOracleMock } from '../typechain/AavePriceOracleMock'
import { AllConnectors } from '../typechain/AllConnectors'
import { MANTISSA } from '../test/shared/constants'
import { simplePositionFixture } from '../test/shared/fixtures'
import {
  encodePath,
  float2SolidityTokenAmount,
  getAavePrice,
  getCompoundPrice,
  randomNotZero,
  toMantissa,
  v3QuoteExactOutput,
} from '../test/shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { deriveUniswapV3Path } from './utils/RouteFinders'
import { OneInchResponses } from './test-artifacts/oneInchResponses'

const MAX_UNWIND_FACTOR_BN = MANTISSA

// This is a tolerance factor of 2% used to increase v3 quotes due to interest rates
// and desync of pools & lending platforms
const v3QuoterErrorFactor = BigNumber.from(50)

describe('SimplePositionStopLossConnector', () => {
  /**
   * Involved addresses:
   *
   * Owner: admin of the Fodl ecosystem
   * user : main user of fodl, opens positions
   * bot: secondary user (stop loss executor)
   * Mallory: malicious user
   */

  let alice: SignerWithAddress
  let bot: SignerWithAddress

  let account: AllConnectors
  let compoundPriceOracleMock: CompoundPriceOracleMock
  let aavePriceOracleMock: AavePriceOracleMock

  beforeEach('load fixture', async () => {
    ;({ account, alice, bot, compoundPriceOracleMock, aavePriceOracleMock } = await simplePositionFixture())
  })

  describe('executeStopLoss()', () => {
    const getPlatformPrice = async (platform: string, principalToken: TokenData, borrowToken: TokenData) => {
      if (platform === COMPOUND_PLATFORM) return await getCompoundPrice(COMPOUND_PLATFORM, principalToken, borrowToken)
      if (platform === AAVE_PLATFORM) return await getAavePrice(AAVE_PLATFORM, principalToken, borrowToken)
      throw `Invalid platform ${platform}`
    }

    const overridePlatformPrice = async (platform: string, token: TokenData, priceUpdate: BigNumber) => {
      if (platform === COMPOUND_PLATFORM) {
        return await compoundPriceOracleMock.setPriceUpdate(COMPOUND_TOKENS_TO_CTOKENS[token.address], priceUpdate)
      }
      if (platform === AAVE_PLATFORM) {
        return await aavePriceOracleMock.setPriceUpdate(token.address, priceUpdate)
      }
      throw `Invalid platform ${platform}`
    }

    const inCompound = { platform: COMPOUND_PLATFORM, platformName: 'COMPOUND' }
    const inAave = { platform: AAVE_PLATFORM, platformName: 'AAVE' }

    // Max leverage for a coin: CF / (1-CF) where CF = Collateral Factor
    interface ITEST_TABLE {
      platformName: string
      platform: string
      principalToken: TokenData
      borrowToken: TokenData
      principalAmount: BigNumber | number
    }

    const TESTS_TABLE: ITEST_TABLE[] = [
      // Compound test cases
      { ...inCompound, principalToken: WETH, borrowToken: DAI, principalAmount: 10 },
      { ...inCompound, principalToken: WETH, borrowToken: USDC, principalAmount: 10 },
      { ...inCompound, principalToken: DAI, borrowToken: WETH, principalAmount: 10_000 },
      { ...inCompound, principalToken: DAI, borrowToken: USDC, principalAmount: 10_000 },
      { ...inCompound, principalToken: USDC, borrowToken: WETH, principalAmount: 10_000 },
      { ...inCompound, principalToken: USDC, borrowToken: DAI, principalAmount: 10_000 },
      // Aave test cases
      { ...inAave, principalToken: WETH, borrowToken: DAI, principalAmount: 10 },
      { ...inAave, principalToken: WETH, borrowToken: USDC, principalAmount: 10 },
      { ...inAave, principalToken: DAI, borrowToken: WETH, principalAmount: 10_000 },
      { ...inAave, principalToken: DAI, borrowToken: USDC, principalAmount: 10_000 },
      { ...inAave, principalToken: USDC, borrowToken: WETH, principalAmount: 10_000 },
      { ...inAave, principalToken: USDC, borrowToken: DAI, principalAmount: 10_000 },
    ]

    TESTS_TABLE.forEach(({ platform, platformName, principalToken, borrowToken, principalAmount }) => {
      describe(`${platformName} - ${principalToken.symbol} / ${borrowToken.symbol}`, () => {
        let supplyAmount: BigNumberish
        let flashLoanAmount: BigNumberish
        let borrowAmount: BigNumberish
        let leverage: number
        let price: BigNumber

        beforeEach('take a loan', async () => {
          price = await getPlatformPrice(platform, principalToken, borrowToken)
          leverage = 2

          /**
           * Now convert to weis / satoshi / atomic unit of reference
           */
          const principalAmountBN = float2SolidityTokenAmount(principalToken, principalAmount as number)
          flashLoanAmount = principalAmountBN.mul(leverage)
          supplyAmount = principalAmountBN.add(flashLoanAmount)
          borrowAmount = price.mul(flashLoanAmount).div(MANTISSA)

          /**
           * Fund the operation
           */
          await sendToken(principalToken.contract, alice.address, principalAmountBN)
          await principalToken.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)

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
              flashLoanAmount,
              encodedPath
            )
            maxBorrowAmount = simulatedBorrowAmount.add(simulatedBorrowAmount.div(v3QuoterErrorFactor))
          } catch (e) {
            console.error(`Failed trying to quote flash amount. Path: Out <= ${tokenPath.join(' - ')} <= In`)
            throw e
          }

          /**
           * Finally open the position
           */
          try {
            await account.increasePositionWithV3FlashswapMultihop({
              supplyToken: principalToken.address,
              borrowToken: borrowToken.address,
              principalAmount: principalAmountBN,
              supplyAmount,
              maxBorrowAmount,
              platform,
              path: encodedPath,
            })
          } catch (e) {
            console.error(`Failed trying to open. Path: Out <= ${tokenPath.join(' - ')} <= In`)
            throw e
          }
        })

        it('reverts if borrow usage limit is under the configured threshold', async () => {
          // Configure stop loss with random parameters, with a limit equal to current
          // collateral usagee
          const unwindFactor = randomNotZero() // Random unwind in range (0, 1)
          const slippageIncentive = randomNotZero() // Random unwind in range (0, 1)
          const collateralUsageLimit = (await account.callStatic.getCollateralUsageFactor()).mul(101).div(100)
          await account.configureStopLoss(toMantissa(unwindFactor), toMantissa(slippageIncentive), collateralUsageLimit)

          await overridePlatformPrice(platform, principalToken, parseEther('1.01'))

          // Check effects of price increase
          const collateralUsageAfterIncrease = await account.callStatic.getCollateralUsageFactor()
          expect(collateralUsageAfterIncrease).to.be.lt(collateralUsageLimit)

          await expect(account.connect(bot).executeStopLoss()).to.be.revertedWith('SLC5')
        })

        /**
         * In this scenario we recreate an environment where the user
         * wants to derisk but not close position completely
         */
        it('allows to trigger stop loss when collateral usage goes above limit', async () => {
          // Configure stop loss with random parameters, with a limit close to current
          // collateral usage
          const unwindFactor = toMantissa(randomNotZero()) // Random unwind in range (0, 1)
          const slippageIncentive = toMantissa(0.01 + randomNotZero() / 20) // Random incentive in range (0.01, 0.05)
          const collateralUsageBeforeDrop = await account.callStatic.getCollateralUsageFactor()
          const collateralUsageLimit = collateralUsageBeforeDrop.mul(101).div(100)
          await account.configureStopLoss(unwindFactor, slippageIncentive, collateralUsageLimit)

          // Force a collateral usage increase by decreasing principal value
          await overridePlatformPrice(platform, principalToken, parseEther('0.99'))

          // Check effects of price drop
          const collateralUsageAfterDrop = await account.callStatic.getCollateralUsageFactor()
          expect(await getPlatformPrice(platform, principalToken, borrowToken)).to.be.lt(price)
          expect(collateralUsageAfterDrop).to.be.gt(collateralUsageBeforeDrop).and.gt(collateralUsageLimit)

          // Update price
          price = await getPlatformPrice(platform, principalToken, borrowToken)

          /**
           * trigger stop loss
           */
          // Get current state and compute expected state
          const borrowBalance = await account.callStatic.getBorrowBalance()

          // The repaid amount is borrowBalance * unwindFactor
          const repayAmount = borrowBalance.mul(unwindFactor).div(MANTISSA)

          // Compute redeem amount

          // Note: MANTISSA.add(slippageIncentive) is (1 + incentive) which accounts for the bot's tip
          // but scaled by 1e18. Since price is also scaled by 1e18, they cancel out
          const expectedRedeemAmount = repayAmount
            .mul(MANTISSA.add(slippageIncentive)) // here we add incentive by multiplying by (1 + incentive)
            .div(price) // divide by the price to convert BORROW TOKEN to PRINCIPAL TOKEN

          const expectedBorrowBalanceAfterStopLoss = borrowBalance.sub(repayAmount)

          // Send repay tokens to the contract
          await sendToken(
            borrowToken.contract,
            account.address,
            repayAmount.mul(1001).div(1000) // A small increase for possible interest accruals
          )

          const botBalanceBeforeExecution = await principalToken.contract.connect(alice).balanceOf(bot.address)

          await account.connect(bot).executeStopLoss()
          const botBalanceDelta = (await principalToken.contract.connect(alice).balanceOf(bot.address)).sub(
            botBalanceBeforeExecution
          )

          expect(botBalanceDelta).to.be.gte(expectedRedeemAmount.mul(99).div(100))
          expect(botBalanceDelta).to.be.lte(expectedRedeemAmount.mul(101).div(100))

          const newBorrowBalance = await account.callStatic.getBorrowBalance()
          expect(newBorrowBalance).to.be.gte(expectedBorrowBalanceAfterStopLoss.mul(99).div(100))
          expect(newBorrowBalance).to.be.lte(expectedBorrowBalanceAfterStopLoss.mul(101).div(100))
        })

        /**
         * In this scenario we recreate an environment where the user
         * wants to fully exit its position when stop loss is activated
         */
        it('allows to trigger stop loss when collateral usage goes above limit, full unwind', async () => {
          // Configure stop loss with random parameters, with a limit close to current
          // collateral usage
          const unwindFactor = MAX_UNWIND_FACTOR_BN // Random unwind in range (0, 1)
          const slippageIncentive = toMantissa(0.01 + randomNotZero() / 20) // Random incentive in range (0.01, 0.05)
          const collateralUsageBeforeDrop = await account.callStatic.getCollateralUsageFactor()
          const collateralUsageLimit = collateralUsageBeforeDrop.mul(101).div(100)
          await account.configureStopLoss(unwindFactor, slippageIncentive, collateralUsageLimit)

          // Force a collateral usage increase by decreasing principal value
          await overridePlatformPrice(platform, principalToken, parseEther('0.99'))

          // Check effects of price drop
          const collateralUsageAfterDrop = await account.callStatic.getCollateralUsageFactor()
          expect(await getPlatformPrice(platform, principalToken, borrowToken)).to.be.lt(price)
          expect(collateralUsageAfterDrop).to.be.gt(collateralUsageBeforeDrop).and.gt(collateralUsageLimit)

          // Update price
          price = await getPlatformPrice(platform, principalToken, borrowToken)

          /**
           * trigger stop loss
           */
          // Get current state and compute expected state
          const borrowBalance = await account.callStatic.getBorrowBalance()

          // The repaid amount is borrowBalance * unwindFactor
          const repayAmount = borrowBalance.mul(unwindFactor).div(MANTISSA)

          // Compute redeem amount

          // Note: MANTISSA.add(slippageIncentive) is (1 + incentive) which accounts for the bot's tip
          // but scaled by 1e18. Since price is also scaled by 1e18, they cancel out
          const expectedRedeemAmount = repayAmount
            .mul(MANTISSA.add(slippageIncentive)) // here we add incentive by multiplying by (1 + incentive)
            .div(price) // divide by the price to convert BORROW TOKEN to PRINCIPAL TOKEN

          const expectedBorrowBalanceAfterStopLoss = borrowBalance.sub(repayAmount)

          // Send repay tokens to the contract
          await sendToken(
            borrowToken.contract,
            account.address,
            repayAmount.mul(1001).div(1000) // A small increase for possible interest accruals
          )

          const botBalanceBeforeExecution = await principalToken.contract.connect(alice).balanceOf(bot.address)

          await account.connect(bot).executeStopLoss()
          const botBalanceDelta = (await principalToken.contract.connect(alice).balanceOf(bot.address)).sub(
            botBalanceBeforeExecution
          )

          expect(botBalanceDelta).to.be.gte(expectedRedeemAmount.mul(99).div(100))
          expect(botBalanceDelta).to.be.lte(expectedRedeemAmount.mul(101).div(100))

          const newBorrowBalance = await account.callStatic.getBorrowBalance()
          expect(newBorrowBalance).to.be.gte(expectedBorrowBalanceAfterStopLoss.mul(99).div(100))
          expect(newBorrowBalance).to.be.lte(expectedBorrowBalanceAfterStopLoss.mul(101).div(100))
        })
      })
    })
  })
})
