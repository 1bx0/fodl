import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, BigNumberish } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { deployments, ethers } from 'hardhat'
import { AAVE_PLATFORM } from '../constants/deploy'
import { DAI, WETH } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { findBestUniswapV3Route } from '../test-integration/utils/RouteFinders'
import {
  AaveLendingAdapter,
  AllConnectorsBSC,
  AllConnectorsBSC__factory,
  AllConnectors__factory,
  CompoundForksLendingAdapter,
  CompoundPriceOracleMock,
  FodlNFT,
} from '../typechain'
import { AavePriceOracleMock } from '../typechain/AavePriceOracleMock'
import { AllConnectors } from '../typechain/AllConnectors'
import { IERC20 } from '../typechain/IERC20'
import { deployConnector } from '../utils/deploy'
import { MANTISSA, ONE_ETH } from './shared/constants'
import { simplePositionFixture } from './shared/fixtures'
import {
  float2SolidityTokenAmount,
  getAavePrice,
  getUniswapPrice,
  randomNotZero,
  toMantissa,
  v3QuoteExactOutput,
} from './shared/utils'

const MAX_UNWIND_FACTOR_BN = MANTISSA
const MAX_SLIPPAGE_INCENTIVE_BN = MANTISSA

// This is a tolerance factor of 2% used to increase v3 quotes due to interest rates
// and desync of pools & lending platforms
const v3QuoterErrorFactor = BigNumber.from(50)

describe('WhitelistStopLossConnector', () => {
  /**
   * Involved addresses:
   *
   * Owner: admin of the Fodl ecosystem
   * alice : main alice of fodl, opens positions
   * bot: secondary alice (stop loss executor)
   * Mallory: malicious alice
   */
  let alice: SignerWithAddress
  let bot: SignerWithAddress
  let mallory: SignerWithAddress

  let account: AllConnectorsBSC
  let unconfiguredAccount: AllConnectorsBSC
  let fodlNFT: FodlNFT
  let compoundPriceOracleMock: CompoundPriceOracleMock
  let aavePriceOracleMock: AavePriceOracleMock
  let aaveLendingAdapter: AaveLendingAdapter
  let compoundLendingAdapter: CompoundForksLendingAdapter

  const openSimplePositionWithoutLeverage = async (eoa = alice, supplyAmount = ONE_ETH) => {
    const price = await getAavePrice(AAVE_PLATFORM, WETH, DAI)
    const borrowAmount = supplyAmount.mul(price).div(MANTISSA).div(10)

    await sendToken(WETH.contract, eoa.address, ONE_ETH)
    const weth = (await ethers.getContractAt('IERC20', WETH.address)) as IERC20
    await weth.connect(eoa).approve(account.address, ethers.constants.MaxUint256)
    await account.increaseSimplePositionWithFunds(AAVE_PLATFORM, WETH.address, supplyAmount, DAI.address, borrowAmount)
  }

  const fixture = deployments.createFixture(async (hre) => {
    const fixt = await simplePositionFixture()
    let { foldingRegistry, account, unconfiguredAccount, alice } = fixt
    await deployConnector(hre, foldingRegistry, 'WhitelistPNLConnector', 'IWhitelistPNLConnector')
    await deployConnector(hre, foldingRegistry, 'WhitelistStopLossConnector', 'IWhitelistStopLossConnector')
    return {
      ...fixt,
      account: AllConnectorsBSC__factory.connect(account.address, alice),
      unconfiguredAccount: AllConnectorsBSC__factory.connect(unconfiguredAccount.address, alice),
    }
  })

  beforeEach('load fixture', async () => {
    ;({
      account,
      unconfiguredAccount,
      alice,
      bot,
      mallory,
      aaveLendingAdapter,
      compoundLendingAdapter,
      compoundPriceOracleMock,
      aavePriceOracleMock,
      fodlNFT,
    } = await fixture())
  })

  describe('configureStopLoss()', () => {
    describe('when position has not been opened yet', async () => {
      it('reverts', async () => {
        await expect(
          account.configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA, bot.address)
        ).to.be.revertedWith('SP1')
      })
    })

    describe('when position is open but configured limit is over current collateral use', () => {
      it('reverts', async () => {
        await openSimplePositionWithoutLeverage()
        const currentCollateralUsage = await account.callStatic.getCollateralUsageFactor()

        // By the time a new block is mined, new interest will be accrued on borrow and
        // thus collateral use will have increased over the previous currentCollateralUsage
        await expect(
          account.configureStopLoss(
            MAX_UNWIND_FACTOR_BN,
            MAX_SLIPPAGE_INCENTIVE_BN,
            currentCollateralUsage,
            bot.address
          )
        ).to.be.revertedWith('WSLC3')
      })
    })

    describe('when position is open', async () => {
      beforeEach('open a position', async () => {
        await openSimplePositionWithoutLeverage(alice)
      })

      it('allows to change stop loss parameters', async () => {
        await account.configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA, bot.address)

        const { slippageIncentive, unwindFactor, collateralUsageLimit } = await account.getStopLossConfiguration()

        expect(slippageIncentive).to.be.equal(MAX_SLIPPAGE_INCENTIVE_BN)
        expect(unwindFactor).to.be.equal(MAX_UNWIND_FACTOR_BN)
        expect(collateralUsageLimit).to.be.equal(MANTISSA)
      })
      it('reverts if unwindFactor is over 100% (1e18)', async () => {
        await expect(
          account.configureStopLoss(MAX_UNWIND_FACTOR_BN.add(1), MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA, bot.address)
        ).to.be.revertedWith('WSLC1')
      })
      it('reverts if slippageIncentive is over 100% (1e18)', async () => {
        await expect(
          account.configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN.add(1), MANTISSA, bot.address)
        ).to.be.revertedWith('WSLC2')
      })
      it('reverts if collateralUsageLimit is over 100% (1e18)', async () => {
        await expect(
          account.configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA.add(1), bot.address)
        ).to.be.revertedWith('WSLC3')
      })

      it('reverts if called by non owner', async () => {
        await expect(
          account
            .connect(mallory)
            .configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA, bot.address)
        ).to.be.revertedWith('FA2')

        await expect(
          account.connect(bot).configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA, bot.address)
        ).to.be.revertedWith('FA2')

        await fodlNFT.connect(alice).transferFrom(alice.address, bot.address, account.address)

        await expect(
          account.connect(bot).configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA, bot.address)
        ).to.not.be.reverted
      })
    })
  })

  describe('stop loss reset', () => {
    beforeEach('open a position and configure stop loss', async () => {
      await openSimplePositionWithoutLeverage(alice)
      await account.configureStopLoss(MAX_UNWIND_FACTOR_BN, MAX_SLIPPAGE_INCENTIVE_BN, MANTISSA, bot.address)
    })

    it('allows the fodlNFT contract to reset on NFT transfer', async () => {
      await fodlNFT.connect(alice).transferFrom(alice.address, bot.address, account.address)

      const { slippageIncentive, unwindFactor, collateralUsageLimit } = await account.getStopLossConfiguration()

      expect(slippageIncentive).to.be.equal('0')
      expect(unwindFactor).to.be.equal('0')
      expect(collateralUsageLimit).to.be.equal('0')
    })
  })

  describe('executeStopLoss()', () => {
    describe('reverts', () => {
      it('when position is not yet defined', async () => {
        await unconfiguredAccount.setStopLossWhitelistPermission(bot.address, true)
        await expect(unconfiguredAccount.connect(bot).executeStopLoss()).to.be.revertedWith('WSLC8')
      })

      it('reverts if unwind factor is not configured', async () => {
        await openSimplePositionWithoutLeverage()
        await account.setStopLossWhitelistPermission(bot.address, true)
        await expect(account.connect(bot).executeStopLoss()).to.be.revertedWith('WSLC7')
      })

      it('reverts if called by non whitelisted account', async () => {
        await openSimplePositionWithoutLeverage()
        await account.setStopLossWhitelistPermission(bot.address, false)
        await expect(account.executeStopLoss()).to.be.revertedWith('WSLC9')
      })
    })

    describe(`works correctly`, () => {
      const platform = AAVE_PLATFORM
      const principalToken = WETH
      const borrowToken = DAI
      const principalAmount = 10

      let supplyAmount: BigNumberish
      let flashLoanAmount: BigNumberish
      let borrowAmount: BigNumberish
      let leverage: number
      let uniswapPrice: number
      let price: BigNumber

      beforeEach('take a loan', async () => {
        await unconfiguredAccount.setStopLossWhitelistPermission(bot.address, true)

        uniswapPrice = await getUniswapPrice(principalToken, borrowToken)
        price = await getAavePrice(platform, principalToken, borrowToken)
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
        const path = await findBestUniswapV3Route(borrowToken, principalToken, borrowAmount, ethers.provider)
        const { encodedPath, tokenPath } = path

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
          const l1Account = AllConnectors__factory.connect(account.address, alice)
          await l1Account.increasePositionWithV3FlashswapMultihop({
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
        await account.configureStopLoss(
          toMantissa(unwindFactor),
          toMantissa(slippageIncentive),
          collateralUsageLimit,
          bot.address
        )

        await aavePriceOracleMock.setPriceUpdate(principalToken.address, parseEther('1.01'))

        // Check effects of price increase
        const collateralUsageAfterIncrease = await account.callStatic.getCollateralUsageFactor()
        expect(collateralUsageAfterIncrease).to.be.lt(collateralUsageLimit)

        await expect(account.connect(bot).executeStopLoss()).to.be.revertedWith('WSLC5')
      })

      /**
       * In this scenario we recreate an environment where the alice
       * wants to derisk but not close position completely
       */
      it('allows to trigger stop loss when collateral usage goes above limit', async () => {
        // Configure stop loss with random parameters, with a limit close to current
        // collateral usage
        const unwindFactor = toMantissa(randomNotZero()) // Random unwind in range (0, 1)
        const slippageIncentive = toMantissa(0.01 + randomNotZero() / 20) // Random incentive in range (0.01, 0.05)
        const collateralUsageBeforeDrop = await account.callStatic.getCollateralUsageFactor()
        const collateralUsageLimit = collateralUsageBeforeDrop.mul(101).div(100)
        await account.configureStopLoss(unwindFactor, slippageIncentive, collateralUsageLimit, bot.address)

        // Force a collateral usage increase by decreasing principal value
        await aavePriceOracleMock.setPriceUpdate(principalToken.address, parseEther('0.99'))

        // Check effects of price drop
        const collateralUsageAfterDrop = await account.callStatic.getCollateralUsageFactor()
        expect(await getAavePrice(AAVE_PLATFORM, principalToken, borrowToken)).to.be.lt(price)
        expect(collateralUsageAfterDrop).to.be.gt(collateralUsageBeforeDrop).and.gt(collateralUsageLimit)

        // Update price
        price = await getAavePrice(AAVE_PLATFORM, principalToken, borrowToken)

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
       * In this scenario we recreate an environment where the alice
       * wants to fully exit its position when stop loss is activated
       */
      it('allows to trigger stop loss when collateral usage goes above limit, full unwind', async () => {
        // Configure stop loss with random parameters, with a limit close to current
        // collateral usage
        const unwindFactor = MAX_UNWIND_FACTOR_BN // Random unwind in range (0, 1)
        const slippageIncentive = toMantissa(0.01 + randomNotZero() / 20) // Random incentive in range (0.01, 0.05)
        const collateralUsageBeforeDrop = await account.callStatic.getCollateralUsageFactor()
        const collateralUsageLimit = collateralUsageBeforeDrop.mul(101).div(100)
        await account.configureStopLoss(unwindFactor, slippageIncentive, collateralUsageLimit, bot.address)

        // Force a collateral usage increase by decreasing principal value
        await aavePriceOracleMock.setPriceUpdate(principalToken.address, parseEther('0.99'))

        // Check effects of price drop
        const collateralUsageAfterDrop = await account.callStatic.getCollateralUsageFactor()
        expect(await getAavePrice(AAVE_PLATFORM, principalToken, borrowToken)).to.be.lt(price)
        expect(collateralUsageAfterDrop).to.be.gt(collateralUsageBeforeDrop).and.gt(collateralUsageLimit)

        // Update price
        price = await getAavePrice(AAVE_PLATFORM, principalToken, borrowToken)

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
