import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FeeAmount } from '@uniswap/v3-sdk'
import { expect } from 'chai'
import { BigNumber, BigNumberish } from 'ethers'
import { COMPOUND_PLATFORM } from '../constants/deploy'
import { TokenData, WETH, WBTC, USDC, USDT, DAI } from '../constants/tokens'
import {
  AllConnectors,
  CompoundPriceOracleMock,
  FoldingRegistry,
  IncreaseWithV3FlashswapMultihopConnector__factory,
} from '../typechain'
import { MANTISSA } from './shared/constants'
import { simplePositionFixture } from './shared/fixtures'
import {
  encodePath,
  float2SolidityTokenAmount,
  getCompoundBalanceOfUnderlying,
  getCompoundQuote,
  solidityTokenAmount2Float,
} from './shared/utils'
import { map } from 'lodash'
import { sendToken } from '../scripts/utils'

describe('IncreasePositionWithFlashswapMultihop', () => {
  const principalToken: TokenData = WBTC
  const borrowToken: TokenData = DAI

  const tokenPath = [principalToken, WETH, USDT, USDC, borrowToken]
  const feePath = [FeeAmount.MEDIUM, FeeAmount.MEDIUM, FeeAmount.LOW, FeeAmount.LOW]
  const path = encodePath(map(tokenPath, 'address'), feePath)

  const platform = COMPOUND_PLATFORM
  const maxSlippageMantissa = BigNumber.from(MANTISSA).mul(90).div(100) // 90%

  let price: number // price of principalToken denominated in borrowToken
  let principalAmount: BigNumberish
  let supplyAmount: BigNumberish
  let flashLoanAmount: BigNumberish
  let borrowAmount: BigNumberish
  let leverage: number

  let alice: SignerWithAddress
  let mallory: SignerWithAddress
  let account: AllConnectors
  let compoundPriceOracleMock: CompoundPriceOracleMock
  let foldingRegistry: FoldingRegistry

  beforeEach('load fixture', async () => {
    ;({ account, compoundPriceOracleMock, alice, mallory, foldingRegistry } = await simplePositionFixture())
    await sendToken(principalToken.contract, alice.address)
    await principalToken.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
  })

  before('get uniswap price', async () => {
    const { amountOut_float } = await getCompoundQuote(platform, principalToken, borrowToken, 1)
    price = amountOut_float
  })

  describe('increasePositionWithV3Flashswap', () => {
    it('allows to open a leveraged position with random parameters and increase leverage afterwards', async () => {
      /////////////////////////////
      // Open leveraged position
      ////////////////////////////

      /**
       * Define a position setup: principal and leverage are randomized, then
       * supply and flash loan needed are computed
       */

      // principalAmount = 10 * (1 + Math.random()) // Random amount of ETH in [10, 20) range
      // leverage = Math.random() * 2 // get a random leverage in the [0, 2] range

      principalAmount = 1
      leverage = 1
      supplyAmount = principalAmount * (1 + leverage)
      flashLoanAmount = supplyAmount - principalAmount
      borrowAmount = price * flashLoanAmount

      /**
       * Now convert to weis / satoshi / atomic unit of reference
       */

      principalAmount = float2SolidityTokenAmount(principalToken, principalAmount)
      flashLoanAmount = float2SolidityTokenAmount(principalToken, flashLoanAmount)
      borrowAmount = float2SolidityTokenAmount(borrowToken, borrowAmount)
      supplyAmount = principalAmount.add(flashLoanAmount)

      /**
       * Finally open the position
       */
      await account.increasePositionWithV3FlashswapMultihop({
        supplyToken: principalToken.address,
        borrowToken: borrowToken.address,
        principalAmount,
        supplyAmount,
        maxBorrowAmount: borrowAmount.mul(MANTISSA).div(maxSlippageMantissa),
        platform,
        path,
      })
      const collateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
      expect(collateralUsageFactor).to.be.gte(0)

      const { balance: actualSuppliedAmount } = await getCompoundBalanceOfUnderlying(principalToken, account.address)

      expect(actualSuppliedAmount).to.be.gte(supplyAmount.sub(1)) // Sub 1 for rounding errors

      // Check no leftovers in contract
      for (const token of tokenPath)
        expect(await token.contract.connect(ethers.provider).balanceOf(account.address)).to.be.equal(0)

      /////////////////////////////
      // Increase position leverage
      ////////////////////////////

      let additionalSupplyAmount = actualSuppliedAmount.div(10)
      let additionalBorrowAmount = float2SolidityTokenAmount(
        borrowToken,
        price * solidityTokenAmount2Float(principalToken, additionalSupplyAmount)
      )

      await account.increasePositionWithV3FlashswapMultihop({
        supplyToken: principalToken.address,
        borrowToken: borrowToken.address,
        principalAmount: 0,
        supplyAmount: additionalSupplyAmount,
        maxBorrowAmount: additionalBorrowAmount.mul(MANTISSA).div(maxSlippageMantissa),
        platform,
        path,
      })

      const { balance: actualSuppliedAmountAfterLeverageIncrease } = await getCompoundBalanceOfUnderlying(
        principalToken,
        account.address
      )
      const expectedSuppliedAmountAfterLeverageIncrease = actualSuppliedAmount.add(additionalSupplyAmount).sub(1) // Sub 1 for rounding errors

      expect(actualSuppliedAmountAfterLeverageIncrease).to.be.gte(expectedSuppliedAmountAfterLeverageIncrease)

      // Check CUF has increased
      const newCollateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
      expect(newCollateralUsageFactor).to.be.gte(collateralUsageFactor)

      // Check no leftovers in contract
      for (const token of tokenPath)
        expect(await token.contract.connect(ethers.provider).balanceOf(account.address)).to.be.equal(0)
    })

    it('allows to open positions against the same token', async () => {
      const principalAmount = float2SolidityTokenAmount(principalToken, 100)
      const supplyAmount = principalAmount.mul(2)
      const tokenPath = [WBTC, WETH]

      await account.increasePositionWithV3FlashswapMultihop({
        principalAmount,
        supplyAmount,
        maxBorrowAmount: 0,
        platform,
        supplyToken: principalToken.address,
        borrowToken: principalToken.address,
        path: encodePath(
          tokenPath.map((token) => token.address),
          [FeeAmount.LOW]
        ),
      })

      const collateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
      expect(collateralUsageFactor).to.be.gte(0)

      const { balance: actualSuppliedAmount } = await getCompoundBalanceOfUnderlying(principalToken, account.address)

      expect(actualSuppliedAmount).to.be.gte(supplyAmount.sub(1)) // Sub 1 for rounding errors

      for (const token of tokenPath)
        expect(await token.contract.connect(ethers.provider).balanceOf(account.address)).to.be.equal(0)

      const additionalSupplyAmount = actualSuppliedAmount.div(100)

      await account.increasePositionWithV3FlashswapMultihop({
        principalAmount: 0,
        supplyAmount: additionalSupplyAmount,
        maxBorrowAmount: 0,
        platform,
        supplyToken: principalToken.address,
        borrowToken: principalToken.address,
        path: encodePath(
          tokenPath.map((token) => token.address),
          [FeeAmount.LOW]
        ),
      })

      const { balance: actualSuppliedAmountAfterLeverageIncrease } = await getCompoundBalanceOfUnderlying(
        principalToken,
        account.address
      )
      const expectedSuppliedAmountAfterLeverageIncrease = actualSuppliedAmount.add(additionalSupplyAmount).sub(1) // Sub 1 for rounding errors

      expect(actualSuppliedAmountAfterLeverageIncrease).to.be.gte(expectedSuppliedAmountAfterLeverageIncrease)

      // Check CUF has increased
      const newCollateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
      expect(newCollateralUsageFactor).to.be.gte(collateralUsageFactor)

      // Check no leftovers in contract
      for (const token of tokenPath)
        expect(await token.contract.connect(ethers.provider).balanceOf(account.address)).to.be.equal(0)
    })

    it('reverts when supplyAmount < principalAmount', async () => {
      await expect(
        account.increasePositionWithV3FlashswapMultihop({
          supplyToken: principalToken.address,
          borrowToken: borrowToken.address,
          principalAmount: 1,
          supplyAmount: 0,
          maxBorrowAmount: 0,
          platform,
          path,
        })
      ).to.be.revertedWith('IWV3FMC1')
    })

    it('reverts when slippage is not correctly set', async () => {
      /**
       * Define a position setup: principal and leverage are randomized, then
       * supply and flash loan needed are computed
       */

      // principalAmount = 10 * (1 + Math.random()) // Random amount of ETH in [10, 20) range
      // leverage = Math.random() * 2 // get a random leverage in the [0, 2] range

      principalAmount = 1
      leverage = 1
      supplyAmount = principalAmount * (1 + leverage)
      flashLoanAmount = supplyAmount - principalAmount
      borrowAmount = price * flashLoanAmount

      /**
       * Now convert to weis / satoshi / atomic unit of reference
       */

      principalAmount = float2SolidityTokenAmount(principalToken, principalAmount)
      flashLoanAmount = float2SolidityTokenAmount(principalToken, flashLoanAmount)
      borrowAmount = float2SolidityTokenAmount(borrowToken, borrowAmount)
      supplyAmount = principalAmount.add(flashLoanAmount)

      /**
       * Finally open the position
       */
      await expect(
        account.increasePositionWithV3FlashswapMultihop({
          supplyToken: principalToken.address,
          borrowToken: borrowToken.address,
          principalAmount,
          supplyAmount,
          maxBorrowAmount: borrowAmount,
          platform,
          path,
        })
      ).to.be.revertedWith('IWV3FMC4')
    })

    it('reverts if called by non-owner', async () => {
      await expect(
        account.connect(mallory).increasePositionWithV3FlashswapMultihop({
          supplyToken: principalToken.address,
          borrowToken: borrowToken.address,
          principalAmount: 0,
          supplyAmount: 0,
          maxBorrowAmount: 0,
          platform,
          path,
        })
      ).to.be.revertedWith('FA4')
    })

    it('reverts if last token is not borrow token', async () => {
      const badPath = encodePath(
        tokenPath.map((token) => token.address).slice(0, tokenPath.length - 1),
        feePath.slice(0, feePath.length - 1)
      )

      /**
       * Define a position setup: principal and leverage are randomized, then
       * supply and flash loan needed are computed
       */

      // principalAmount = 10 * (1 + Math.random()) // Random amount of ETH in [10, 20) range
      // leverage = Math.random() * 2 // get a random leverage in the [0, 2] range

      principalAmount = 1
      leverage = 1
      supplyAmount = principalAmount * (1 + leverage)
      flashLoanAmount = supplyAmount - principalAmount
      borrowAmount = price * flashLoanAmount

      /**
       * Now convert to weis / satoshi / atomic unit of reference
       */

      principalAmount = float2SolidityTokenAmount(principalToken, principalAmount)
      flashLoanAmount = float2SolidityTokenAmount(principalToken, flashLoanAmount)
      borrowAmount = float2SolidityTokenAmount(borrowToken, borrowAmount)
      supplyAmount = principalAmount.add(flashLoanAmount)

      /**
       * Finally open the position
       */
      await expect(
        account.increasePositionWithV3FlashswapMultihop({
          supplyToken: principalToken.address,
          borrowToken: borrowToken.address,
          principalAmount,
          supplyAmount,
          maxBorrowAmount: borrowAmount.mul(MANTISSA).div(maxSlippageMantissa),
          platform,
          path: badPath,
        })
      ).to.be.revertedWith('IWV3FMC5')
    })
  })

  describe('uniswapV3SwapCallback', () => {
    it('reverts when called by unathorized address mid-transaction')
    it('reverts if pools are empty (IWV3FMC2 & 3) - Cannot be tested trivially')
    it('is not accesible via direct call', async () => {
      const _account = IncreaseWithV3FlashswapMultihopConnector__factory.connect(account.address, alice)
      await expect(_account.uniswapV3SwapCallback(0, 0, '0x00')).to.be.revertedWith('FR2')
    })
  })

  describe('uniswapV3FlashCallback', () => {
    it('reverts when called by unathorized address mid-transaction')
    it('reverts if pools are empty (IWV3FMC2 & 3) - Cannot be tested trivially')
    it('is not accesible via direct call', async () => {
      const _account = IncreaseWithV3FlashswapMultihopConnector__factory.connect(account.address, alice)
      await expect(_account.uniswapV3FlashCallback(0, 0, '0x00')).to.be.revertedWith('FR2')
    })
  })
})
