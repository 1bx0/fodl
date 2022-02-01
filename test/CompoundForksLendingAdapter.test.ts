import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { deployments, ethers } from 'hardhat'
import { COMPOUND_PLATFORM } from '../constants/deploy'
import { cDAI, cETH, DAI, USDC, USDT, WETH } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import {
  CompoundForksLendingAdapter,
  CompoundForksLendingAdapter__factory as CompoundForksLendingAdapterFactory,
  FoldingRegistry,
  ICToken,
  IERC20,
  ERC20,
  IWETH,
  IComptroller,
} from '../typechain'
import { ILendingPlatform } from '../typechain/ILendingPlatform'
import { MANTISSA } from './shared/constants'

const BLOCKS_PER_YEAR = BigNumber.from(4 * 60 * 24 * 365)

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture()
  const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const compoundLendingAdapter = (await ethers.getContract(
    'CompoundForksLendingAdapter'
  )) as CompoundForksLendingAdapter

  const weth = (await ethers.getContractAt('IWETH', WETH.address)) as IWETH
  const usdt = (await ethers.getContractAt('IERC20', USDT.address)) as IERC20
  const dai = (await ethers.getContractAt('IERC20', DAI.address)) as IERC20

  return { foldingRegistry, compoundLendingAdapter, usdt, weth, dai }
})

async function fixtureWithFunds() {
  const { foldingRegistry, compoundLendingAdapter, usdt, weth, dai } = await fixture()

  await sendToken(weth, compoundLendingAdapter.address, parseUnits('10', WETH.decimals))
  await sendToken(usdt, compoundLendingAdapter.address, parseUnits('10000', USDT.decimals))
  await sendToken(dai, compoundLendingAdapter.address, parseUnits('10000', DAI.decimals))

  return { foldingRegistry, compoundLendingAdapter, usdt, weth, dai }
}

async function fixtureWithPosition() {
  const { foldingRegistry, compoundLendingAdapter, usdt, weth, dai } = await fixtureWithFunds()

  await compoundLendingAdapter.enterMarkets(COMPOUND_PLATFORM, [WETH.address, DAI.address, USDT.address])

  await compoundLendingAdapter.supply(COMPOUND_PLATFORM, WETH.address, parseEther('5'))
  await compoundLendingAdapter.supply(COMPOUND_PLATFORM, DAI.address, parseUnits('500', DAI.decimals))

  await expect(compoundLendingAdapter.borrow(COMPOUND_PLATFORM, WETH.address, parseUnits('1', WETH.decimals))).to.not.be
    .reverted

  await expect(compoundLendingAdapter.borrow(COMPOUND_PLATFORM, USDT.address, parseUnits('1000', USDT.decimals))).to.not
    .be.reverted

  return { foldingRegistry, compoundLendingAdapter, usdt, weth, dai }
}

describe('CompoundForksLendingAdapter', async function () {
  describe('constructor()', async function () {
    const randAddress1 = ethers.Wallet.createRandom().address
    const randAddress2 = ethers.Wallet.createRandom().address

    it('sets immutables correctly', async function () {
      const compoundLendingAdapterFactory = (await ethers.getContractFactory(
        'CompoundForksLendingAdapter'
      )) as CompoundForksLendingAdapterFactory

      const compoundLendingAdapter = (await compoundLendingAdapterFactory.deploy(
        randAddress1,
        randAddress2
      )) as CompoundForksLendingAdapter

      expect(await compoundLendingAdapter.WETH()).to.be.equal(randAddress1)
      expect(await compoundLendingAdapter.cTokenProvider()).to.be.equal(randAddress2)
    })

    it('reverts when intialising with 0 address', async function () {
      const compoundLendingAdapterFactory = (await ethers.getContractFactory(
        'CompoundForksLendingAdapter'
      )) as CompoundForksLendingAdapterFactory

      await expect(compoundLendingAdapterFactory.deploy(ethers.constants.AddressZero, randAddress2)).to.be.revertedWith(
        'ICP0'
      )

      await expect(compoundLendingAdapterFactory.deploy(randAddress1, ethers.constants.AddressZero)).to.be.revertedWith(
        'ICP0'
      )
    })
  })

  describe('enterMarkets()', async function () {
    let compoundLendingAdapter: ILendingPlatform
    let foldingRegistry: FoldingRegistry

    beforeEach(async function () {
      ;({ compoundLendingAdapter, foldingRegistry } = await fixture())
    })

    it('can enter valid markets', async function () {
      await expect(compoundLendingAdapter.enterMarkets(COMPOUND_PLATFORM, [WETH.address, DAI.address])).to.not.be
        .reverted

      const troller = await ethers.getContractAt('IComptroller', COMPOUND_PLATFORM)
      const assets: string[] = await troller.callStatic.getAssetsIn(compoundLendingAdapter.address)

      expect(assets[0].toLowerCase()).equals(cETH.address.toLowerCase())
      expect(assets[1].toLowerCase()).equals(cDAI.address.toLowerCase())
    })

    it('cannot enter when one invalid market', async function () {
      await foldingRegistry.removeCTokenFromPlatform(COMPOUND_PLATFORM, DAI.address)
      await foldingRegistry.addCTokenOnPlatform(COMPOUND_PLATFORM, DAI.address, DAI.address)

      await expect(
        compoundLendingAdapter.enterMarkets(COMPOUND_PLATFORM, [WETH.address, DAI.address])
      ).to.be.revertedWith('CFLA1')
    })
  })

  describe('supply() and borrow()', async function () {
    let compoundLendingAdapter: ILendingPlatform

    beforeEach(async function () {
      ;({ compoundLendingAdapter } = await fixtureWithFunds())
    })

    it('when markets not entered, cannot borrow', async function () {
      await expect(compoundLendingAdapter.supply(COMPOUND_PLATFORM, WETH.address, parseEther('2'))).to.not.be.reverted

      await expect(
        compoundLendingAdapter.borrow(COMPOUND_PLATFORM, USDT.address, parseUnits('10', USDT.decimals))
      ).to.be.revertedWith('CFLA3')
    })

    it('when markets entered, can supply and borrow', async function () {
      await expect(compoundLendingAdapter.supply(COMPOUND_PLATFORM, WETH.address, parseEther('2'))).to.not.be.reverted

      await expect(compoundLendingAdapter.borrow(COMPOUND_PLATFORM, WETH.address, parseUnits('0.5', WETH.decimals))).to
        .not.be.reverted

      await expect(compoundLendingAdapter.borrow(COMPOUND_PLATFORM, USDT.address, parseUnits('10', USDT.decimals))).to
        .not.be.reverted
    })

    it('cannot supply more WETH than balance', async function () {
      await expect(compoundLendingAdapter.supply(COMPOUND_PLATFORM, WETH.address, parseEther('11'))).to.be.revertedWith(
        ''
      )
    })

    it('can supply USDT', async function () {
      await expect(compoundLendingAdapter.supply(COMPOUND_PLATFORM, USDT.address, parseUnits('100', USDT.decimals))).to
        .not.be.reverted
    })

    it('cannot supply more USDT than balance', async function () {
      await expect(
        compoundLendingAdapter.supply(COMPOUND_PLATFORM, USDT.address, parseUnits('10001', USDT.decimals))
      ).to.be.revertedWith('')
    })
  })

  describe('redeem()', async function () {
    let compoundLendingAdapter: ILendingPlatform

    beforeEach(async function () {
      ;({ compoundLendingAdapter } = await fixtureWithPosition())
    })

    it('can redeem small amount', async function () {
      await expect(compoundLendingAdapter.redeemSupply(COMPOUND_PLATFORM, WETH.address, parseEther('1'))).to.not.be
        .reverted

      await expect(compoundLendingAdapter.redeemSupply(COMPOUND_PLATFORM, DAI.address, parseUnits('300', DAI.decimals)))
        .to.not.be.reverted
    })

    it('cannot redeem more than collateral', async function () {
      await expect(
        compoundLendingAdapter.redeemSupply(COMPOUND_PLATFORM, WETH.address, parseEther('4'))
      ).to.be.revertedWith('CFLA4')
    })
  })

  describe('repay()', async function () {
    let compoundLendingAdapter: ILendingPlatform

    beforeEach(async function () {
      ;({ compoundLendingAdapter } = await fixtureWithPosition())
    })

    it('can repay less than borrow balance', async function () {
      await expect(compoundLendingAdapter.repayBorrow(COMPOUND_PLATFORM, WETH.address, parseEther('0.5'))).to.not.be
        .reverted

      await expect(compoundLendingAdapter.repayBorrow(COMPOUND_PLATFORM, USDT.address, parseUnits('50', USDT.decimals)))
        .to.not.be.reverted
    })

    it('cannot repay more than borrowBalance', async function () {
      await expect(
        compoundLendingAdapter.repayBorrow(COMPOUND_PLATFORM, USDT.address, parseUnits('3000', USDT.decimals))
      ).to.be.reverted
    })
  })

  describe('claimRewards()', async function () {
    let compoundLendingAdapter: ILendingPlatform

    beforeEach(async function () {
      ;({ compoundLendingAdapter } = await fixtureWithPosition())
    })

    it('can claim rewards', async function () {
      const before = await compoundLendingAdapter.callStatic.claimRewards(COMPOUND_PLATFORM)

      await expect(compoundLendingAdapter.claimRewards(COMPOUND_PLATFORM)).to.not.be.reverted

      const after = await compoundLendingAdapter.callStatic.claimRewards(COMPOUND_PLATFORM)

      expect(before.rewardsAmount).to.be.at.least(after.rewardsAmount)
    })
  })

  describe('getSupply/BorrowBalance()', async function () {
    let compoundLendingAdapter: ILendingPlatform

    beforeEach(async function () {
      ;({ compoundLendingAdapter } = await fixtureWithPosition())
    })

    it('can get supply balance', async function () {
      await expect(compoundLendingAdapter.getSupplyBalance(COMPOUND_PLATFORM, WETH.address)).to.not.be.reverted

      const before = await compoundLendingAdapter.callStatic.getSupplyBalance(COMPOUND_PLATFORM, WETH.address)

      await ethers.provider.send('evm_mine', [])

      const after = await compoundLendingAdapter.callStatic.getSupplyBalance(COMPOUND_PLATFORM, WETH.address)
      expect(after).to.be.least(before.add(1))
    })

    it('can get borrow balance', async function () {
      await expect(compoundLendingAdapter.getBorrowBalance(COMPOUND_PLATFORM, WETH.address)).to.not.be.reverted

      const before = await compoundLendingAdapter.callStatic.getBorrowBalance(COMPOUND_PLATFORM, WETH.address)

      await ethers.provider.send('evm_mine', [])

      const after = await compoundLendingAdapter.callStatic.getBorrowBalance(COMPOUND_PLATFORM, WETH.address)
      expect(after).to.be.at.least(before.add(1))
    })
  })

  describe('getReferencePrice()', async function () {
    let compoundLendingAdapter: ILendingPlatform

    before(async function () {
      ;({ compoundLendingAdapter } = await fixture())
    })

    it('returns correct value for USDC', async () => {
      const token = USDC
      const price = await compoundLendingAdapter.callStatic.getReferencePrice(COMPOUND_PLATFORM, token.address)
      const expectedPrice = BigNumber.from(10)
        .pow(18 - token.decimals)
        .mul(MANTISSA)

      expect(price).to.be.equal(expectedPrice)
    })

    it('returns value in expected deviation range 2% for DAI', async () => {
      const token = DAI
      const price = await compoundLendingAdapter.callStatic.getReferencePrice(COMPOUND_PLATFORM, token.address)
      const expectedPrice = BigNumber.from(10)
        .pow(18 - token.decimals)
        .mul(MANTISSA)

      // Expect 2% price deviation at most (1/50)
      expect(price).to.be.gte(expectedPrice.sub(expectedPrice.div(50)))
      expect(price).to.be.lte(expectedPrice.add(expectedPrice.div(50)))
    })

    it('returns value in expected deviation range 2% for USDT', async () => {
      const token = USDT
      const price = await compoundLendingAdapter.callStatic.getReferencePrice(COMPOUND_PLATFORM, token.address)
      const expectedPrice = BigNumber.from(10)
        .pow(18 - token.decimals)
        .mul(MANTISSA)

      // Expect 2% price deviation at most (1/50)
      expect(price).to.be.gte(expectedPrice.sub(expectedPrice.div(50)))
      expect(price).to.be.lte(expectedPrice.add(expectedPrice.div(50)))
    })
  })

  describe('getCollateralUsageFactor()', async function () {
    let compoundLendingAdapter: ILendingPlatform

    before(async function () {
      ;({ compoundLendingAdapter } = await fixtureWithFunds())
    })

    it('can get collateralUsageFactor when no supply and borrow', async function () {
      await expect(compoundLendingAdapter.callStatic.getCollateralUsageFactor(COMPOUND_PLATFORM)).to.not.be.reverted

      expect(await compoundLendingAdapter.callStatic.getCollateralUsageFactor(COMPOUND_PLATFORM)).to.be.equal(
        parseEther('0')
      )
    })

    it('can get collateralUsageFactor when only supply', async function () {
      await compoundLendingAdapter.enterMarkets(COMPOUND_PLATFORM, [WETH.address])

      await compoundLendingAdapter.supply(COMPOUND_PLATFORM, WETH.address, parseEther('5'))

      expect(await compoundLendingAdapter.callStatic.getCollateralUsageFactor(COMPOUND_PLATFORM)).to.be.equal(
        parseEther('0')
      )
    })

    it('can get collateralUsageFactor when both supply and borrow', async function () {
      await compoundLendingAdapter.borrow(COMPOUND_PLATFORM, WETH.address, parseEther('1'))

      expect(await compoundLendingAdapter.callStatic.getCollateralUsageFactor(COMPOUND_PLATFORM))
        .to.be.at.least(parseEther('0.26'))
        .to.be.at.most(parseEther('0.27'))
    })
  })

  describe('getCollateralFactorForAsset()', () => {
    let compoundLendingAdapter: ILendingPlatform

    before(async function () {
      ;({ compoundLendingAdapter } = await fixtureWithFunds())
    })

    it('correctly retrieves collateral factor for ETH', async () => {
      const collateralFactor = await compoundLendingAdapter.callStatic.getCollateralFactorForAsset(
        COMPOUND_PLATFORM,
        WETH.address
      )
      expect(collateralFactor).to.be.equal(MANTISSA.mul(75).div(100)) // 75%
    })
  })

  describe('getAssetMetadata()', async () => {
    let troll: any
    let compoundLendingAdapter: ILendingPlatform
    let dai: ERC20

    before(async () => {
      ;({ compoundLendingAdapter } = await fixture())
      dai = (await ethers.getContractAt('ERC20', DAI.address)) as ERC20
      troll = await ethers.getContractAt('IComptroller', COMPOUND_PLATFORM)
    })

    it('Returns correct data for DAI reserves', async () => {
      const daiData = await compoundLendingAdapter.callStatic.getAssetMetadata(COMPOUND_PLATFORM, DAI.address)

      const cDai = (await ethers.getContractAt('ICToken', cDAI.address)) as ICToken

      const comptroller = (await ethers.getContractAt('IComptroller', COMPOUND_PLATFORM)) as IComptroller

      const [, correctCollateralFactor] = await troll.markets(cDAI.address)
      const correctLiquidationFactor = correctCollateralFactor
      const correctReferencePrice = await compoundLendingAdapter.callStatic.getReferencePrice(
        COMPOUND_PLATFORM,
        DAI.address
      )

      expect(daiData.referencePrice).to.equal(correctReferencePrice)
      expect(daiData.collateralFactor).to.equal(correctCollateralFactor)
      expect(daiData.liquidationFactor).to.equal(correctLiquidationFactor)
      expect(daiData.canBorrow).to.equal(true)
      expect(daiData.canSupply).to.equal(true)

      const correctSupplyAPR = (await cDai.supplyRatePerBlock()).mul(BLOCKS_PER_YEAR)
      const correctBorrowAPR = (await cDai.borrowRatePerBlock()).mul(BLOCKS_PER_YEAR)

      // 10% error margin for reserve
      expect(daiData.supplyAPR).to.be.closeTo(correctSupplyAPR, correctSupplyAPR.div(10).toNumber())
      expect(daiData.borrowAPR).to.be.closeTo(correctBorrowAPR, correctBorrowAPR.div(10).toNumber())

      expect(daiData.totalBorrow).to.equal(await cDai.callStatic.totalBorrowsCurrent())

      expect(daiData.assetAddress).to.equal(DAI.address)
      expect(daiData.assetDecimals).to.equal(await dai.decimals())

      expect(daiData.estimatedSupplyRewardsPerYear).to.equal(
        (await comptroller.callStatic.compSupplySpeeds(cDai.address)).mul(BLOCKS_PER_YEAR)
      )
      expect(daiData.estimatedBorrowRewardsPerYear).to.equal(
        (await comptroller.callStatic.compBorrowSpeeds(cDai.address)).mul(BLOCKS_PER_YEAR)
      )
    })
  })
})
