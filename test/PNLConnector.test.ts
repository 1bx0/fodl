import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { last } from 'lodash'
import { AAVE_PLATFORM } from '../constants/deploy'
import { DAI, WETH } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { FodlNFT } from '../typechain'
import { AavePriceOracleMock } from '../typechain/AavePriceOracleMock'
import { AllConnectors } from '../typechain/AllConnectors'
import { IERC20 } from '../typechain/IERC20'
import { MANTISSA, ONE_ETH } from './shared/constants'
import { simplePositionFixture } from './shared/fixtures'
import { getAavePrice } from './shared/utils'

const MAX_UNWIND_FACTOR_BN = MANTISSA
const MAX_PERCENTAGE_REWARD_BN = MANTISSA
const FIXED_REWARD_BN = ONE_ETH.div(10) // 0.1 ETH
const PERCENTAGE_REWARD_BN = MANTISSA.div(4) // 20% reward

const SUPPLY_AMOUNT = ONE_ETH.mul(50)

const TEST_TOLERANCE = 5 // Funds received from operations to be within 5% of simulated results
const { MaxUint256 } = ethers.constants

describe('PNLConnector', () => {
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

  let account: AllConnectors
  let fodlNFT: FodlNFT
  let aavePriceOracleMock: AavePriceOracleMock

  const openSimplePositionWithoutLeverage = async (eoa = alice) => {
    const price = await getAavePrice(AAVE_PLATFORM, WETH, DAI)
    const borrowAmount = SUPPLY_AMOUNT.mul(price).div(MANTISSA).div(10)

    await sendToken(WETH.contract, eoa.address, SUPPLY_AMOUNT)
    const weth = (await ethers.getContractAt('IERC20', WETH.address)) as IERC20
    await weth.connect(eoa).approve(account.address, MaxUint256)
    await account.increaseSimplePositionWithFunds(AAVE_PLATFORM, WETH.address, SUPPLY_AMOUNT, DAI.address, borrowAmount)
  }

  beforeEach('load fixture', async () => {
    ;({ account, alice, bot, mallory, aavePriceOracleMock, fodlNFT } = await simplePositionFixture())
  })

  describe('configurePNL()', async () => {
    describe('when position has been open', () => {
      beforeEach('open position', async () => {
        await openSimplePositionWithoutLeverage()
      })

      it('works correctly', async () => {
        const [ethPrice, daiPrice] = await Promise.all([
          aavePriceOracleMock.getAssetPrice(WETH.address),
          aavePriceOracleMock.getAssetPrice(DAI.address),
        ])

        const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
        const takeProfitPriceTarget = currentPriceRatio.add(1)
        await account.configurePNL(
          takeProfitPriceTarget,
          FIXED_REWARD_BN,
          MAX_PERCENTAGE_REWARD_BN,
          MAX_UNWIND_FACTOR_BN,
          true
        )

        let takeProfitSettings = await account.callStatic.getAllPNLSettings()
        expect(takeProfitSettings).to.have.length(1)
        expect(takeProfitSettings[0].priceTarget).to.be.equal(takeProfitPriceTarget)
        expect(takeProfitSettings[0].fixedReward).to.be.equal(FIXED_REWARD_BN)
        expect(takeProfitSettings[0].unwindFactor).to.be.equal(MAX_UNWIND_FACTOR_BN)

        const stoplossPriceTarget = currentPriceRatio.sub(1)
        await account.configurePNL(
          stoplossPriceTarget,
          FIXED_REWARD_BN,
          MAX_PERCENTAGE_REWARD_BN,
          MAX_UNWIND_FACTOR_BN,
          false
        )

        takeProfitSettings = await account.callStatic.getAllPNLSettings()
        expect(takeProfitSettings).to.have.length(2)
        expect(takeProfitSettings[1].priceTarget).to.be.equal(stoplossPriceTarget)
        expect(takeProfitSettings[1].fixedReward).to.be.equal(FIXED_REWARD_BN)
        expect(takeProfitSettings[1].unwindFactor).to.be.equal(MAX_UNWIND_FACTOR_BN)
      })

      it('rejects if trying to configure with unwind factor > 1', async () => {
        const unwindFactor = MAX_UNWIND_FACTOR_BN.add(1)
        const tx = account.configurePNL(0, 0, MAX_PERCENTAGE_REWARD_BN, unwindFactor, true)
        await expect(tx).to.be.revertedWith('TPC1')
      })

      it('rejects if trying to configure with percentage incentive > 1', async () => {
        const percentageIncentive = MAX_PERCENTAGE_REWARD_BN.add(1)
        const tx = account.configurePNL(0, 0, percentageIncentive, MAX_UNWIND_FACTOR_BN, true)
        await expect(tx).to.be.revertedWith('TPC2')
      })

      it('rejects if not called by owner', async () => {
        const tx = account.connect(mallory).configurePNL(0, 0, MAX_PERCENTAGE_REWARD_BN, 0, true)
        await expect(tx).to.be.revertedWith('FA2')
      })

      describe('when takeProfit = true', () => {
        it('rejects price target is higher than current price', async () => {
          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const tx = account.configurePNL(
            currentPriceRatio,
            FIXED_REWARD_BN,
            MAX_PERCENTAGE_REWARD_BN,
            MAX_UNWIND_FACTOR_BN,
            true
          )
          await expect(tx).to.be.revertedWith('TPC3')
        })
      })

      describe('when takeProfit = false', () => {
        it('rejects price target is lower than current price', async () => {
          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const tx = account.configurePNL(
            currentPriceRatio,
            FIXED_REWARD_BN,
            MAX_PERCENTAGE_REWARD_BN,
            MAX_UNWIND_FACTOR_BN,
            false
          )
          await expect(tx).to.be.revertedWith('TPC3')
        })
      })
    })

    describe('when position is not yet open', () => {
      it('fails', async () => {
        const tx = account.configurePNL(
          MaxUint256,
          FIXED_REWARD_BN,
          MAX_PERCENTAGE_REWARD_BN,
          MAX_UNWIND_FACTOR_BN,
          true
        )
        await expect(tx).to.be.revertedWith('SP1')
      })
    })
  })

  describe('pnlStore()', () => {
    it('is deleted on token transfer', async () => {
      await openSimplePositionWithoutLeverage()

      await account
        .connect(alice)
        .configurePNL(MaxUint256, FIXED_REWARD_BN, MAX_PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, true)

      let takeProfitSettings = await account.callStatic.getAllPNLSettings()
      expect(takeProfitSettings).to.have.length(1)
      await fodlNFT.connect(alice).transferFrom(alice.address, alice.address, account.address)

      takeProfitSettings = await account.callStatic.getAllPNLSettings()
      expect(takeProfitSettings).to.have.length(0)
    })
  })

  describe('removePNLSetting()', () => {
    const amountOfTakeProfits = 5

    beforeEach('open position and configure it', async () => {
      await openSimplePositionWithoutLeverage()
      for (let i = 0; i < amountOfTakeProfits; i++) {
        const priceTarget = MaxUint256.sub(i)
        await account
          .connect(alice)
          .configurePNL(priceTarget, FIXED_REWARD_BN, MAX_PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, true)
      }
      const settings = await account.callStatic.getAllPNLSettings()
      expect(settings).to.have.length(amountOfTakeProfits)
    })

    it('rejects if not called by the owner', async () => {
      await expect(account.connect(mallory).removePNLSetting(0)).to.be.revertedWith('FA2')
    })

    it('correctly removes first element', async () => {
      const lastTakeProfit = await account.callStatic.getAllPNLSettings().then(last)

      await account.removePNLSetting(0)
      const settings = await account.callStatic.getAllPNLSettings()
      expect(settings).to.have.length(amountOfTakeProfits - 1)
      expect(settings[0].priceTarget).to.be.equal(lastTakeProfit?.priceTarget)
    })

    it('correctly removes an element in the mid of the array', async () => {
      const lastTakeProfit = await account.callStatic.getAllPNLSettings().then(last)
      const indexToRemove = Math.floor(amountOfTakeProfits / 2)

      await account.removePNLSetting(indexToRemove)

      const settings = await account.callStatic.getAllPNLSettings()
      expect(settings).to.have.length(amountOfTakeProfits - 1)

      expect(settings[indexToRemove].priceTarget).to.be.equal(lastTakeProfit!.priceTarget)
    })

    it('correctly removes the last element of the array', async () => {
      const lastTakeProfit = await account.callStatic.getAllPNLSettings().then(last)

      const indexToRemove = amountOfTakeProfits - 1
      await account.removePNLSetting(indexToRemove)

      const settings = await account.callStatic.getAllPNLSettings()
      expect(settings).to.have.length(amountOfTakeProfits - 1)

      settings.forEach(({ priceTarget }) => {
        expect(priceTarget).to.be.not.equal(lastTakeProfit!.priceTarget)
      })
    })

    it('rejects if index of take profit does not exist', async () => {
      const indexToRemove = amountOfTakeProfits + 1

      await expect(account.connect(alice).removePNLSetting(indexToRemove)).to.be.revertedWith('TPC5')
    })
  })

  describe('removeAllPNLSettings()', async () => {
    it('rejects if not called by the owner', async () => {
      await expect(account.connect(mallory).removeAllPNLSettings()).to.be.revertedWith('FA2')
    })

    it('correctly deletes store', async () => {
      await openSimplePositionWithoutLeverage()
      await account
        .connect(alice)
        .configurePNL(MaxUint256, FIXED_REWARD_BN, MAX_PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, true)
      await account.connect(alice).removeAllPNLSettings()
      const takeProfitSettings = await account.callStatic.getAllPNLSettings()
      expect(takeProfitSettings).to.have.length(0)

      await account.connect(alice).configurePNL(MaxUint256, 0, 0, MAX_UNWIND_FACTOR_BN, true)

      // Allows inserting new PNL settings after deletion
      const pnlSettings = await account.callStatic.getAllPNLSettings()
      expect(pnlSettings).to.have.length(1)

      const [{ priceTarget, fixedReward, percentageReward, unwindFactor }] = pnlSettings

      expect(priceTarget).to.be.equal(MaxUint256)
      expect(fixedReward).to.be.equal(0)
      expect(percentageReward).to.be.equal(0)
      expect(unwindFactor).to.be.equal(MAX_UNWIND_FACTOR_BN)
    })

    it('correctly preserves array pointer if deleting empty array', async () => {
      await openSimplePositionWithoutLeverage()
      await account.connect(alice).removeAllPNLSettings()

      await account.connect(alice).configurePNL(MaxUint256, 0, 0, MAX_UNWIND_FACTOR_BN, true)

      const pnlSettings = await account.callStatic.getAllPNLSettings()
      expect(pnlSettings).to.have.length(1)

      const [{ priceTarget, fixedReward, percentageReward, unwindFactor }] = pnlSettings

      expect(priceTarget).to.be.equal(MaxUint256)
      expect(fixedReward).to.be.equal(0)
      expect(percentageReward).to.be.equal(0)
      expect(unwindFactor).to.be.equal(MAX_UNWIND_FACTOR_BN)
    })
  })

  describe('executePNL()', () => {
    describe('take profit', () => {
      const withApproval = false

      describe('with fixed reward', () => {
        beforeEach('open a position and configure take profit', async () => {
          await openSimplePositionWithoutLeverage()

          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const priceTarget = currentPriceRatio.add(1)
          await account.connect(alice).configurePNL(priceTarget, FIXED_REWARD_BN, 0, MAX_UNWIND_FACTOR_BN, true)
        })

        it('works when price has been reached', async () => {
          const priceIncrease = 0.0001
          await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 + priceIncrease}`))

          let daiToSend = await account.callStatic.getBorrowBalance()
          daiToSend = daiToSend.add(daiToSend.div(1000)) // sends a bit extra to compensate interest

          const expectedEthToReceive = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ]).then(([ethPrice, daiPrice]) => daiToSend.mul(daiPrice).div(ethPrice).add(FIXED_REWARD_BN))

          await sendToken(DAI.contract.connect(ethers.provider), account.address, daiToSend)

          const receivedEth = await account.connect(bot).callStatic.executePNL(0, withApproval)
          await account.connect(bot).executePNL(0, withApproval)

          const expectedEthToReceive_lowerBound = expectedEthToReceive.sub(expectedEthToReceive.div(TEST_TOLERANCE))
          const expectedEthToReceive_upperBound = expectedEthToReceive.add(expectedEthToReceive.div(TEST_TOLERANCE))
          expect(receivedEth).to.be.gte(expectedEthToReceive_lowerBound).and.lte(expectedEthToReceive_upperBound)
        })

        it('rejects if target price has not been reached', async () => {
          await expect(account.connect(mallory).executePNL(0, withApproval)).to.be.revertedWith('TPC4')
        })

        it('rejects if trying to target a take profit index that does not exist', async () => {
          expect(account.connect(mallory).executePNL(1, withApproval)).to.be.reverted
        })
      })

      describe('with percentage reward', () => {
        beforeEach('open a position and configure take profit', async () => {
          await openSimplePositionWithoutLeverage()

          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const priceTarget = currentPriceRatio.add(1)
          await account.connect(alice).configurePNL(priceTarget, 0, PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, true)
        })

        it('works when price has been reached', async () => {
          const priceIncrease = 0.0001
          await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 + priceIncrease}`))

          let daiToSend = await account.callStatic.getBorrowBalance()
          daiToSend = daiToSend.add(daiToSend.div(1000)) // sends a bit extra to compensate interest

          const expectedEthToReceive = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ]).then(([ethPrice, daiPrice]) =>
            daiToSend.mul(daiPrice).mul(MANTISSA.add(PERCENTAGE_REWARD_BN)).div(ethPrice).div(MANTISSA)
          )

          await sendToken(DAI.contract.connect(ethers.provider), account.address, daiToSend)

          const receivedEth = await account.connect(bot).callStatic.executePNL(0, withApproval)
          await account.connect(bot).executePNL(0, withApproval)

          const expectedEthToReceive_lowerBound = expectedEthToReceive.sub(expectedEthToReceive.div(TEST_TOLERANCE))
          const expectedEthToReceive_upperBound = expectedEthToReceive.add(expectedEthToReceive.div(TEST_TOLERANCE))
          expect(receivedEth).to.be.gte(expectedEthToReceive_lowerBound).and.lte(expectedEthToReceive_upperBound)
        })
      })

      describe('with both percentage and fixed reward', () => {
        beforeEach('open a position and configure take profit', async () => {
          await openSimplePositionWithoutLeverage()

          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const priceTarget = currentPriceRatio.add(1)
          await account
            .connect(alice)
            .configurePNL(priceTarget, FIXED_REWARD_BN, PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, true)
        })

        it('works when price has been reached', async () => {
          const priceIncrease = 0.0001
          await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 + priceIncrease}`))

          let daiToSend = await account.callStatic.getBorrowBalance()
          daiToSend = daiToSend.add(daiToSend.div(1000)) // sends a bit extra to compensate interest

          const expectedEthToReceive = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ]).then(([ethPrice, daiPrice]) =>
            daiToSend
              .mul(daiPrice)
              .mul(MANTISSA.add(PERCENTAGE_REWARD_BN))
              .div(ethPrice)
              .div(MANTISSA)
              .add(FIXED_REWARD_BN)
          )

          await sendToken(DAI.contract.connect(ethers.provider), account.address, daiToSend)

          const receivedEth = await account.connect(bot).callStatic.executePNL(0, withApproval)
          await account.connect(bot).executePNL(0, withApproval)

          const expectedEthToReceive_lowerBound = expectedEthToReceive.sub(expectedEthToReceive.div(TEST_TOLERANCE))
          const expectedEthToReceive_upperBound = expectedEthToReceive.add(expectedEthToReceive.div(TEST_TOLERANCE))
          expect(receivedEth).to.be.gte(expectedEthToReceive_lowerBound).and.lte(expectedEthToReceive_upperBound)
        })
      })
    })

    describe('take profit with approval', () => {
      const withApproval = true

      beforeEach('open a position and configure take profit', async () => {
        await openSimplePositionWithoutLeverage()

        const [ethPrice, daiPrice] = await Promise.all([
          aavePriceOracleMock.getAssetPrice(WETH.address),
          aavePriceOracleMock.getAssetPrice(DAI.address),
        ])

        const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
        const priceTarget = currentPriceRatio.add(1)
        await account.connect(alice).configurePNL(priceTarget, FIXED_REWARD_BN, 0, MAX_UNWIND_FACTOR_BN, true)
      })

      it('works when price has been reached', async () => {
        const priceIncrease = 0.0001
        await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 + priceIncrease}`))

        let daiToSend = await account.callStatic.getBorrowBalance()
        daiToSend = daiToSend.add(daiToSend.div(1000)) // sends a bit extra to compensate interest

        const expectedEthToReceive = await Promise.all([
          aavePriceOracleMock.getAssetPrice(WETH.address),
          aavePriceOracleMock.getAssetPrice(DAI.address),
        ]).then(([ethPrice, daiPrice]) => daiToSend.mul(daiPrice).div(ethPrice).add(FIXED_REWARD_BN))

        const dai = DAI.contract.connect(bot)

        await sendToken(dai, bot.address, daiToSend)
        await dai.approve(account.address, MaxUint256)

        const receivedEth = await account.connect(bot).callStatic.executePNL(0, withApproval)
        await account.connect(bot).executePNL(0, withApproval)

        const expectedEthToReceive_lowerBound = expectedEthToReceive.sub(expectedEthToReceive.div(TEST_TOLERANCE))
        const expectedEthToReceive_upperBound = expectedEthToReceive.add(expectedEthToReceive.div(TEST_TOLERANCE))
        expect(receivedEth).to.be.gte(expectedEthToReceive_lowerBound).and.lte(expectedEthToReceive_upperBound)
      })
    })

    describe('stoploss', () => {
      const withApproval = false

      describe('with fixed reward', () => {
        beforeEach('open a position and configure stoploss', async () => {
          await openSimplePositionWithoutLeverage()

          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const priceTarget = currentPriceRatio.sub(1)
          await account.connect(alice).configurePNL(priceTarget, FIXED_REWARD_BN, 0, MAX_UNWIND_FACTOR_BN, false)
        })

        it('works when price has been reached', async () => {
          const priceDecrease = 0.0001
          await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 - priceDecrease}`))

          let daiToSend = await account.callStatic.getBorrowBalance()
          daiToSend = daiToSend.add(daiToSend.div(1000)) // sends a bit extra to compensate interest

          const expectedEthToReceive = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ]).then(([ethPrice, daiPrice]) => daiToSend.mul(daiPrice).div(ethPrice).add(FIXED_REWARD_BN))

          await sendToken(DAI.contract.connect(ethers.provider), account.address, daiToSend)

          const receivedEth = await account.connect(bot).callStatic.executePNL(0, withApproval)
          await account.connect(bot).executePNL(0, withApproval)

          const expectedEthToReceive_lowerBound = expectedEthToReceive.sub(expectedEthToReceive.div(TEST_TOLERANCE))
          const expectedEthToReceive_upperBound = expectedEthToReceive.add(expectedEthToReceive.div(TEST_TOLERANCE))
          expect(receivedEth).to.be.gte(expectedEthToReceive_lowerBound).and.lte(expectedEthToReceive_upperBound)
        })

        it('rejects if target price has not been reached', async () => {
          await expect(account.connect(mallory).executePNL(0, withApproval)).to.be.revertedWith('TPC4')
        })
      })

      describe('with percentage reward', () => {
        beforeEach('open a position and configure stoploss', async () => {
          await openSimplePositionWithoutLeverage()

          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const priceTarget = currentPriceRatio.sub(1)
          await account.connect(alice).configurePNL(priceTarget, 0, PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, false)
        })

        it('works when price has been reached', async () => {
          const priceIncrease = 0.0001
          await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 - priceIncrease}`))

          let daiToSend = await account.callStatic.getBorrowBalance()
          daiToSend = daiToSend.add(daiToSend.div(1000)) // sends a bit extra to compensate interest

          const expectedEthToReceive = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ]).then(([ethPrice, daiPrice]) =>
            daiToSend.mul(daiPrice).mul(MANTISSA.add(PERCENTAGE_REWARD_BN)).div(ethPrice).div(MANTISSA)
          )

          await sendToken(DAI.contract.connect(ethers.provider), account.address, daiToSend)

          const receivedEth = await account.connect(bot).callStatic.executePNL(0, withApproval)
          await account.connect(bot).executePNL(0, withApproval)

          const expectedEthToReceive_lowerBound = expectedEthToReceive.sub(expectedEthToReceive.div(TEST_TOLERANCE))
          const expectedEthToReceive_upperBound = expectedEthToReceive.add(expectedEthToReceive.div(TEST_TOLERANCE))
          expect(receivedEth).to.be.gte(expectedEthToReceive_lowerBound).and.lte(expectedEthToReceive_upperBound)
        })
      })

      describe('with both percentage and fixed reward', () => {
        beforeEach('open a position and configure take profit', async () => {
          await openSimplePositionWithoutLeverage()

          const [ethPrice, daiPrice] = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ])

          const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
          const priceTarget = currentPriceRatio.sub(1)
          await account
            .connect(alice)
            .configurePNL(priceTarget, FIXED_REWARD_BN, PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, false)
        })

        it('works when price has been reached', async () => {
          const priceDecrease = 0.0001
          await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 - priceDecrease}`))

          let daiToSend = await account.callStatic.getBorrowBalance()
          daiToSend = daiToSend.add(daiToSend.div(1000)) // sends a bit extra to compensate interest

          const expectedEthToReceive = await Promise.all([
            aavePriceOracleMock.getAssetPrice(WETH.address),
            aavePriceOracleMock.getAssetPrice(DAI.address),
          ]).then(([ethPrice, daiPrice]) =>
            daiToSend
              .mul(daiPrice)
              .mul(MANTISSA.add(PERCENTAGE_REWARD_BN))
              .div(ethPrice)
              .div(MANTISSA)
              .add(FIXED_REWARD_BN)
          )

          await sendToken(DAI.contract.connect(ethers.provider), account.address, daiToSend)

          const receivedEth = await account.connect(bot).callStatic.executePNL(0, withApproval)
          await account.connect(bot).executePNL(0, withApproval)

          const expectedEthToReceive_lowerBound = expectedEthToReceive.sub(expectedEthToReceive.div(TEST_TOLERANCE))
          const expectedEthToReceive_upperBound = expectedEthToReceive.add(expectedEthToReceive.div(TEST_TOLERANCE))
          expect(receivedEth).to.be.gte(expectedEthToReceive_lowerBound).and.lte(expectedEthToReceive_upperBound)
        })
      })
    })
  })

  describe('PNL Configurations', () => {
    beforeEach('open position and configure some PNL settings', async () => {
      await openSimplePositionWithoutLeverage()

      const [ethPrice, daiPrice] = await Promise.all([
        aavePriceOracleMock.getAssetPrice(WETH.address),
        aavePriceOracleMock.getAssetPrice(DAI.address),
      ])

      const currentPriceRatio = ethPrice.mul(MANTISSA).div(daiPrice)
      const takeProfitPriceTarget = currentPriceRatio.add(1)
      const stoplossPriceTarget = currentPriceRatio.sub(1)

      // Take profit setting
      await account
        .connect(alice)
        .configurePNL(takeProfitPriceTarget, FIXED_REWARD_BN, PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, true)

      // Stop loss setting
      await account.connect(alice).configurePNL(stoplossPriceTarget, 0, 0, MAX_UNWIND_FACTOR_BN, false)

      // Bad take profit setting
      await account
        .connect(alice)
        .configurePNL(takeProfitPriceTarget, SUPPLY_AMOUNT, MAX_PERCENTAGE_REWARD_BN, MAX_UNWIND_FACTOR_BN, true)

      const takeProfitSettings = await account.callStatic.getPNLSettingsAt(0)
      const stoplossSettings = await account.callStatic.getPNLSettingsAt(1)
      const badSettings = await account.callStatic.getPNLSettingsAt(2)

      await expect(account.callStatic.getPNLSettingsAt(4)).to.be.reverted

      expect(takeProfitSettings.isTakeProfit).to.be.equal(true)
      expect(stoplossSettings.isTakeProfit).to.be.equal(false)
      expect(badSettings.isTakeProfit).to.be.equal(true)

      expect(takeProfitSettings.priceTarget).to.be.equal(currentPriceRatio.add(1))
      expect(takeProfitSettings.fixedReward).to.be.equal(FIXED_REWARD_BN)
      expect(takeProfitSettings.percentageReward).to.be.equal(PERCENTAGE_REWARD_BN)
      expect(takeProfitSettings.unwindFactor).to.be.equal(MAX_UNWIND_FACTOR_BN)

      expect(stoplossSettings.priceTarget).to.be.equal(currentPriceRatio.sub(1))
      expect(stoplossSettings.fixedReward).to.be.equal(0)
      expect(stoplossSettings.percentageReward).to.be.equal(0)
      expect(stoplossSettings.unwindFactor).to.be.equal(MAX_UNWIND_FACTOR_BN)
    })

    describe('getPNLState()', () => {
      it('correctly returns PNL state', async () => {
        {
          const { platform, supplyToken, borrowToken, supplyBalance, simulations } =
            await account.callStatic.getPNLState()

          expect(simulations).to.have.length(3)
          expect(platform).to.be.equal(AAVE_PLATFORM)
          expect(supplyToken).to.be.equal(WETH.address)
          expect(borrowToken).to.be.equal(DAI.address)
          expect(supplyBalance).to.be.gte(SUPPLY_AMOUNT)

          simulations.forEach(({ reason }) => {
            expect(reason).to.be.equal('Price target not reached')
          })
        }

        const priceIncrease = 0.0001
        await aavePriceOracleMock.setPriceUpdate(WETH.address, parseEther(`${1 + priceIncrease}`))

        {
          const { simulations } = await account.callStatic.getPNLState()

          expect(simulations).to.have.length(3)

          expect(simulations[0].settings.isTakeProfit).to.be.equal(true)
          expect(simulations[0].canBeTriggered).to.be.equal(true)

          expect(simulations[1].settings.isTakeProfit).to.be.equal(false)
          expect(simulations[1].canBeTriggered).to.be.equal(false)
          expect(simulations[1].reason).to.be.equal('Price target not reached')

          expect(simulations[2].settings.isTakeProfit).to.be.equal(true)
          expect(simulations[2].settings.fixedReward).to.be.equal(SUPPLY_AMOUNT)
          expect(simulations[2].canBeTriggered).to.be.equal(false)
          expect(simulations[2].reason).to.be.equal('Incentive exceeds supply balance')
        }
      })
    })
  })
})
