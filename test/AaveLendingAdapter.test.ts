import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { formatUnits, parseEther, parseUnits } from 'ethers/lib/utils'
import { deployments, ethers, waffle } from 'hardhat'

import { AAVE_PLATFORM } from '../constants/deploy'
import { DAI, DOLA, USDC, USDT, WBTC, WETH } from '../constants/tokens'
import { getERC20Token, sendToken } from '../scripts/utils'
import {
  AaveLendingAdapter,
  AaveLendingAdapter__factory as AaveLendingAdapterFactory,
  IERC20,
  ILendingPlatform,
} from '../typechain'

import { MANTISSA } from './shared/constants'
import { expectApproxBalanceChanges, getUniswapPrice, solidityTokenAmount2Float } from './shared/utils'

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture()

  const aaveLendingAdapter = (await ethers.getContract('AaveLendingAdapter')) as AaveLendingAdapter

  const dai = await getERC20Token('DAI')
  await sendToken(dai, aaveLendingAdapter.address, parseEther('100'))
  const usdt = await getERC20Token('USDT')
  await sendToken(usdt, aaveLendingAdapter.address, parseEther('100'))

  return { aaveLendingAdapter, dai, usdt }
})

describe('Aave Lender Module', async () => {
  let aaveLendingAdapter: ILendingPlatform

  let dai: IERC20
  let usdt: IERC20

  before(async () => {
    ;({ aaveLendingAdapter, dai, usdt } = await fixture())
  })

  describe('Constructor', async () => {
    let [wallet1, wallet2, wallet3] = waffle.provider.getWallets()
    let aaveLendingAdapterFactory: AaveLendingAdapterFactory

    before(async () => {
      aaveLendingAdapterFactory = (await ethers.getContractFactory('AaveLendingAdapter')) as AaveLendingAdapterFactory
    })

    it('sets addresses correctly', async () => {
      const aaveLendingAdapter = (await aaveLendingAdapterFactory.deploy(
        wallet1.address,
        wallet2.address,
        wallet3.address
      )) as AaveLendingAdapter

      expect(await aaveLendingAdapter.PoolProvider()).to.be.equal(wallet1.address)
      expect(await aaveLendingAdapter.DataProvider()).to.be.equal(wallet2.address)
      expect(await aaveLendingAdapter.Incentives()).to.be.equal(wallet3.address)
    })

    it('reverts when intialising with 0 address', async function () {
      await expect(
        aaveLendingAdapterFactory.deploy(ethers.constants.AddressZero, wallet1.address, wallet2.address)
      ).to.be.revertedWith('ICP0')

      await expect(
        aaveLendingAdapterFactory.deploy(wallet2.address, ethers.constants.AddressZero, wallet3.address)
      ).to.be.revertedWith('ICP0')

      await expect(
        aaveLendingAdapterFactory.deploy(wallet2.address, wallet3.address, ethers.constants.AddressZero)
      ).to.be.revertedWith('ICP0')
    })
  })

  describe('getReferencePrice', async () => {
    it('returns correct value for WETH', async () => {
      const token = WETH
      const price = await aaveLendingAdapter.callStatic.getReferencePrice(AAVE_PLATFORM, token.address)
      const expectedPrice = MANTISSA

      expect(price).to.be.equal(expectedPrice)
    })

    it('returns correct value for WBTC', async () => {
      const token = WBTC
      const price = await aaveLendingAdapter.callStatic.getReferencePrice(AAVE_PLATFORM, token.address)

      // Need to workaround Javascript precision issues with bignumbers
      const expectedPrice = BigNumber.from(Math.floor((await getUniswapPrice(token, WETH)) * 1e9)).mul(
        BigNumber.from(10).pow(9 + 18 - token.decimals)
      )

      // Expect 2% price deviation at most (1/50)
      expect(price).to.be.gte(expectedPrice.sub(expectedPrice.div(50)))
      expect(price).to.be.lte(expectedPrice.add(expectedPrice.div(50)))
    })
    it('returns correct value for USDC', async () => {
      const token = USDC
      const price = await aaveLendingAdapter.callStatic.getReferencePrice(AAVE_PLATFORM, token.address)

      // Need to workaround Javascript precision issues with bignumbers
      const expectedPrice = BigNumber.from(Math.floor((await getUniswapPrice(token, WETH)) * 1e9)).mul(
        BigNumber.from(10).pow(9 + 18 - token.decimals)
      )

      // Expect 1% price deviation at most (1/50)
      expect(price).to.be.gte(expectedPrice.sub(expectedPrice.div(100)))
      expect(price).to.be.lte(expectedPrice.add(expectedPrice.div(100)))
    })
  })

  describe('supply and borrow', async () => {
    it('can supply DAI collateral', async () => {
      const startingBalance = await dai.balanceOf(aaveLendingAdapter.address)
      const amount = parseUnits('50', DAI.decimals)
      await aaveLendingAdapter.supply(AAVE_PLATFORM, DAI.address, amount)
      expect(await aaveLendingAdapter.callStatic.getSupplyBalance(AAVE_PLATFORM, DAI.address))
        .to.be.at.least(amount.sub(2))
        .to.be.at.most(amount.add(2))
      expect(await dai.balanceOf(aaveLendingAdapter.address)).to.equal(startingBalance.sub(amount))
      expect(await aaveLendingAdapter.callStatic.getCollateralUsageFactor(AAVE_PLATFORM)).to.equal(0)
    })

    it('should not be able to supply not supported token', async () => {
      const dola = await getERC20Token('DOLA')
      await sendToken(dola, aaveLendingAdapter.address, parseUnits('10', DOLA.decimals))
      await expect(aaveLendingAdapter.supply(AAVE_PLATFORM, DOLA.address, parseUnits('10', DOLA.decimals))).to.be
        .reverted
    })

    it('should be able to borrow dai', async () => {
      const supplyAmount = parseUnits('50', DAI.decimals)
      const borrowAmount = parseUnits('25', DAI.decimals)
      const borrowLimit = supplyAmount.mul(80).div(100)

      await aaveLendingAdapter.borrow(AAVE_PLATFORM, DAI.address, borrowAmount)
      expect(await aaveLendingAdapter.callStatic.getBorrowBalance(AAVE_PLATFORM, DAI.address)).to.be.closeTo(
        borrowAmount,
        2
      )

      const borrowed = borrowAmount.mul(1000).div(borrowLimit).mul(1e15)
      expect(await aaveLendingAdapter.callStatic.getCollateralUsageFactor(AAVE_PLATFORM))
        .to.be.at.least(borrowed.sub(1e15))
        .to.be.at.most(borrowed.add(1e15))
    })

    it('should be able to repay borrowed dai', async () => {
      const startingBalance = await dai.balanceOf(aaveLendingAdapter.address)
      const repayAmount = parseUnits('25', DAI.decimals)
      await aaveLendingAdapter.repayBorrow(AAVE_PLATFORM, DAI.address, repayAmount)

      const finalBalance = await dai.balanceOf(aaveLendingAdapter.address)
      expect(startingBalance.sub(finalBalance)).to.equal(repayAmount)
      const debtLeft = await aaveLendingAdapter.callStatic.getBorrowBalance(AAVE_PLATFORM, DAI.address)
      await aaveLendingAdapter.repayBorrow(AAVE_PLATFORM, DAI.address, debtLeft.add(300))
      expect(await aaveLendingAdapter.callStatic.getCollateralUsageFactor(AAVE_PLATFORM)).to.equal(0)
    })

    it('can supply USDT collateral', async () => {
      const startingBalance = await usdt.balanceOf(aaveLendingAdapter.address)
      const amount = parseUnits('50', USDT.decimals)
      await aaveLendingAdapter.supply(AAVE_PLATFORM, USDT.address, amount)
      expect(await aaveLendingAdapter.callStatic.getSupplyBalance(AAVE_PLATFORM, USDT.address))
        .to.be.at.least(amount.sub(2))
        .to.be.at.most(amount.add(2))
      expect(await usdt.balanceOf(aaveLendingAdapter.address)).to.equal(startingBalance.sub(amount))
      expect(await aaveLendingAdapter.callStatic.getCollateralUsageFactor(AAVE_PLATFORM)).to.equal(0)
    })

    it('should be able to borrow usdt', async () => {
      const borrowAmount = parseUnits('25', USDT.decimals)
      await aaveLendingAdapter.borrow(AAVE_PLATFORM, USDT.address, borrowAmount)
      expect(await aaveLendingAdapter.callStatic.getBorrowBalance(AAVE_PLATFORM, USDT.address))
        .to.be.at.most(borrowAmount.add(2))
        .to.be.at.least(borrowAmount.sub(2))

      const cuf = parseFloat(formatUnits(await aaveLendingAdapter.callStatic.getCollateralUsageFactor(AAVE_PLATFORM)))
      expect(cuf).to.be.closeTo(0.6, 0.1)
    })

    it('should be able to repay borrowed usdt', async () => {
      const startingBalance = await usdt.balanceOf(aaveLendingAdapter.address)
      const repayAmount = parseUnits('1', USDT.decimals)
      await aaveLendingAdapter.repayBorrow(AAVE_PLATFORM, USDT.address, repayAmount)

      const finalBalance = await usdt.balanceOf(aaveLendingAdapter.address)
      expect(startingBalance.sub(finalBalance)).to.equal(repayAmount)

      const debtLeft = await aaveLendingAdapter.callStatic.getBorrowBalance(AAVE_PLATFORM, USDT.address)
      await aaveLendingAdapter.repayBorrow(AAVE_PLATFORM, USDT.address, debtLeft.add(300))
      expect(await aaveLendingAdapter.callStatic.getCollateralUsageFactor(AAVE_PLATFORM)).to.equal(0)
    })

    it('should be able to redeem supplied dai', async () => {
      const supply = await aaveLendingAdapter.callStatic.getSupplyBalance(AAVE_PLATFORM, DAI.address)

      await expectApproxBalanceChanges(
        () => aaveLendingAdapter.redeemSupply(AAVE_PLATFORM, DAI.address, supply),
        DAI,
        [aaveLendingAdapter.address],
        [solidityTokenAmount2Float(DAI, supply)],
        0.01
      )
    })

    it('should be able to redeem supplied usdt', async () => {
      const supply = await aaveLendingAdapter.callStatic.getSupplyBalance(AAVE_PLATFORM, USDT.address)
      await expectApproxBalanceChanges(
        () => aaveLendingAdapter.redeemSupply(AAVE_PLATFORM, USDT.address, supply),
        USDT,
        [aaveLendingAdapter.address],
        [solidityTokenAmount2Float(USDT, supply)],
        0.01
      )
    })
  })

  describe('getCollateralFactorForAsset()', () => {
    it('correctly retrieves collateral factor for ETH', async () => {
      const AAVE_WETH_COLLATERAL_FACTOR = MANTISSA.mul(85).div(100) // Aave sets this collateral factor for ETH deposits. Currently set at 85%

      const collateralFactor = await aaveLendingAdapter.callStatic.getCollateralFactorForAsset(
        AAVE_PLATFORM,
        WETH.address
      )
      expect(collateralFactor).to.be.equal(AAVE_WETH_COLLATERAL_FACTOR)
    })
  })
})
