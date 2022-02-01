import { deployments, ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FeeAmount } from '@uniswap/v3-sdk'
import { expect } from 'chai'
import { BigNumber, BigNumberish } from 'ethers'
import { COMPOUND_PLATFORM, COMPOUND_TOKENS_TO_CTOKENS, SUBSIDY_HOLDER_ADDRESS } from '../constants/deploy'
import { TokenData, WETH, WBTC, USDC, USDT, DAI } from '../constants/tokens'
import {
  AaveLendingAdapter,
  AavePriceOracleMock,
  AllConnectors,
  CompoundForksLendingAdapter,
  CompoundPriceOracleMock,
  DecreaseWithV3FlashswapMultihopConnector__factory,
  FodlNFT,
  FoldingRegistry,
} from '../typechain'
import { MANTISSA } from './shared/constants'
import {
  createFoldingAccount,
  encodePath,
  float2SolidityTokenAmount,
  getBalanceDeltas,
  getCompoundQuote,
  getExpectedCashoutAndTax,
  solidityTokenAmount2Float,
} from './shared/utils'
import { map } from 'lodash'
import { sendToken } from '../scripts/utils'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

describe('DecreasePositionWithV3FlashswapMultihopConnector', () => {
  const principalToken: TokenData = WBTC
  const borrowToken: TokenData = DAI

  const tokenPath = [principalToken, WETH, USDT, USDC, borrowToken].reverse()
  const feePath = [FeeAmount.MEDIUM, FeeAmount.MEDIUM, FeeAmount.LOW, FeeAmount.LOW].reverse()
  const path = encodePath(map(tokenPath, 'address'), feePath)

  const platform = COMPOUND_PLATFORM
  const maxSlippageFloat = 0.95
  const MANTISSA_95_PERCENT = BigNumber.from(MANTISSA).mul(95).div(100) // 95%
  const maxPriceImpact = 0.03 // 3%
  const wideMaxPriceImpact = 0.3 // 30%, we cannot mock uniswap prices changes unfortunately

  let price: number // price of principalToken denominated in borrowToken
  let principalAmount: BigNumberish
  let supplyAmount: BigNumberish
  let flashLoanAmount: BigNumberish
  let borrowAmount: BigNumberish
  let leverage: number

  let alice: SignerWithAddress
  let mallory: SignerWithAddress
  let account: AllConnectors
  let sameTokenPositionAccount: AllConnectors
  let compoundPriceOracleMock: CompoundPriceOracleMock
  let foldingRegistry: FoldingRegistry

  const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, ethers } = hre

    const [alice, bot, mallory] = await ethers.getUnnamedSigners()

    await deployments.fixture()

    const fodlNFT = (await ethers.getContract('FodlNFT')) as FodlNFT
    const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

    const { account } = await createFoldingAccount(foldingRegistry, alice)
    const { account: sameTokenPositionAccount } = await createFoldingAccount(foldingRegistry, alice)
    const { account: unconfiguredAccount } = await createFoldingAccount(foldingRegistry, alice)

    const aaveLendingAdapter = (await ethers.getContract('AaveLendingAdapter')) as AaveLendingAdapter
    const compoundLendingAdapter = (await ethers.getContract(
      'CompoundForksLendingAdapter'
    )) as CompoundForksLendingAdapter

    const compoundPriceOracleMock = (await ethers.getContract('CompoundPriceOracleMock')) as CompoundPriceOracleMock
    const aavePriceOracleMock = (await ethers.getContract('AavePriceOracleMock')) as AavePriceOracleMock

    /////////////////////////////
    // Open leveraged position
    ////////////////////////////

    /**
     * Define a position setup: principal and leverage are randomized, then
     * supply and flash loan needed are computed
     */

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

    const path = encodePath(map(tokenPath, 'address').reverse(), feePath.reverse())
    const sameTokenPath = encodePath(map([WETH, WBTC], 'address'), [FeeAmount.LOW])

    await sendToken(principalToken.contract, alice.address)

    await principalToken.contract.connect(alice).approve(account.address, ethers.constants.MaxUint256)
    await account.increasePositionWithV3FlashswapMultihop({
      supplyToken: principalToken.address,
      borrowToken: borrowToken.address,
      principalAmount,
      supplyAmount,
      maxBorrowAmount: borrowAmount.mul(MANTISSA).div(MANTISSA_95_PERCENT),
      platform,
      path,
    })

    await principalToken.contract.connect(alice).approve(sameTokenPositionAccount.address, ethers.constants.MaxUint256)
    await sameTokenPositionAccount.increasePositionWithV3FlashswapMultihop({
      supplyToken: principalToken.address,
      borrowToken: borrowToken.address,
      principalAmount,
      supplyAmount: principalAmount,
      maxBorrowAmount: 0,
      platform,
      path: sameTokenPath,
    })

    return {
      account,
      sameTokenPositionAccount,
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
    ;({ account, sameTokenPositionAccount, compoundPriceOracleMock, alice, mallory, foldingRegistry } = await fixture())
  })

  before('get principal token price quoted in borrow token', async () => {
    const { amountOut_float } = await getCompoundQuote(platform, principalToken, borrowToken, 1)
    price = amountOut_float
  })

  describe('decreasePositionWithV3FlashswapMultihop', () => {
    describe('different token position', () => {
      it('allows to close position completely and taxes it (no profit)', async () => {
        const { floatExpectedCashout, floatExpectedTax } = await getExpectedCashoutAndTax(principalToken, account)

        const withdrawAmount = ethers.constants.MaxUint256
        const borrowTokenRepayAmount = await account.callStatic.getBorrowBalance()
        const borrowTokenRepayAmount_float = solidityTokenAmount2Float(borrowToken, borrowTokenRepayAmount)
        const maxSupplyTokenRepayAmount = float2SolidityTokenAmount(
          principalToken,
          borrowTokenRepayAmount_float / (maxSlippageFloat * price)
        )

        const [aliceBalanceDelta, subsidyBalanceDelta] = await getBalanceDeltas(
          () =>
            account.decreasePositionWithV3FlashswapMultihop({
              withdrawAmount,
              maxSupplyTokenRepayAmount,
              borrowTokenRepayAmount: ethers.constants.MaxUint256,
              platform,
              supplyToken: principalToken.address,
              borrowToken: borrowToken.address,
              path,
            }),
          principalToken,
          [alice.address, SUBSIDY_HOLDER_ADDRESS]
        )

        expect(aliceBalanceDelta).to.be.closeTo(floatExpectedCashout, floatExpectedCashout * maxPriceImpact)
        expect(subsidyBalanceDelta).to.be.closeTo(floatExpectedTax, floatExpectedTax * maxPriceImpact)

        expect(await account.callStatic.getCollateralUsageFactor()).to.be.equal(0)

        // Check no leftovers in contract
        for (const token of tokenPath)
          expect(await token.contract.connect(ethers.provider).balanceOf(account.address)).to.be.equal(0)
      })

      it('allows to close position completely and taxes it (in profit)', async () => {
        const priceChangeFactor = MANTISSA.add(MANTISSA.div(2)) // 1.5x price increase
        await compoundPriceOracleMock.setPriceUpdate(
          COMPOUND_TOKENS_TO_CTOKENS[principalToken.address],
          priceChangeFactor
        )

        const { floatExpectedCashout, floatExpectedTax } = await getExpectedCashoutAndTax(principalToken, account)

        const withdrawAmount = ethers.constants.MaxUint256
        const borrowTokenRepayAmount = await account.callStatic.getBorrowBalance()
        const borrowTokenRepayAmount_float = solidityTokenAmount2Float(borrowToken, borrowTokenRepayAmount)
        const maxSupplyTokenRepayAmount = float2SolidityTokenAmount(
          principalToken,
          borrowTokenRepayAmount_float / (maxSlippageFloat * price)
        )

        const [aliceBalanceDelta, subsidyBalanceDelta] = await getBalanceDeltas(
          () =>
            account.decreasePositionWithV3FlashswapMultihop({
              withdrawAmount,
              maxSupplyTokenRepayAmount,
              borrowTokenRepayAmount: ethers.constants.MaxUint256,
              platform,
              supplyToken: principalToken.address,
              borrowToken: borrowToken.address,
              path,
            }),
          principalToken,
          [alice.address, SUBSIDY_HOLDER_ADDRESS]
        )

        expect(aliceBalanceDelta).to.be.closeTo(floatExpectedCashout, floatExpectedCashout * wideMaxPriceImpact)
        expect(subsidyBalanceDelta).to.be.closeTo(floatExpectedTax, floatExpectedTax * wideMaxPriceImpact)

        expect(await account.callStatic.getCollateralUsageFactor()).to.be.equal(0)

        // Check no leftovers in contract
        for (const token of tokenPath)
          expect(await token.contract.connect(ethers.provider).balanceOf(account.address)).to.be.equal(0)
      })

      it('allows to partially close the position', async () => {
        const debtReductionFactor = 2

        const withdrawAmount = 0
        const borrowTokenRepayAmount = (await account.callStatic.getBorrowBalance()).div(debtReductionFactor)
        const borrowTokenRepayAmount_float = solidityTokenAmount2Float(borrowToken, borrowTokenRepayAmount)
        const maxSupplyTokenRepayAmount = float2SolidityTokenAmount(
          principalToken,
          borrowTokenRepayAmount_float / (maxSlippageFloat * price)
        )

        const previousCollateralUsageFactor = await account.callStatic.getCollateralUsageFactor()
        const expectedCollateralUsageFactorLower = previousCollateralUsageFactor.div(debtReductionFactor) // This will never be achieved, but if it does, it might be signaling an issue

        const [aliceBalanceDelta, subsidyBalanceDelta] = await getBalanceDeltas(
          () =>
            account.decreasePositionWithV3FlashswapMultihop({
              withdrawAmount,
              maxSupplyTokenRepayAmount,
              borrowTokenRepayAmount,
              platform,
              supplyToken: principalToken.address,
              borrowToken: borrowToken.address,
              path,
            }),
          principalToken,
          [alice.address, SUBSIDY_HOLDER_ADDRESS]
        )

        expect(aliceBalanceDelta).to.be.equal(0)
        expect(subsidyBalanceDelta).to.be.equal(0)

        expect(await account.callStatic.getCollateralUsageFactor())
          .to.be.gte(expectedCollateralUsageFactorLower)
          .and.lte(previousCollateralUsageFactor)

        // Check no leftovers in contract
        for (const token of tokenPath)
          expect(await token.contract.connect(ethers.provider).balanceOf(account.address)).to.be.equal(0)
      })
      it('reverts if slippage is over the tolerated threshold', async () => {
        const withdrawAmount = 0
        const borrowTokenRepayAmount = await account.callStatic.getBorrowBalance()
        const borrowTokenRepayAmount_float = solidityTokenAmount2Float(borrowToken, borrowTokenRepayAmount)
        const maxSupplyTokenRepayAmount = float2SolidityTokenAmount(
          principalToken,
          borrowTokenRepayAmount_float / price
        )

        await expect(
          account.decreasePositionWithV3FlashswapMultihop({
            withdrawAmount,
            maxSupplyTokenRepayAmount,
            borrowTokenRepayAmount: ethers.constants.MaxUint256,
            platform,
            supplyToken: principalToken.address,
            borrowToken: borrowToken.address,
            path,
          })
        ).to.be.revertedWith('DWV3FMC5')
      })
      it('reverts if last in path is not supply token', async () => {
        const badPath = encodePath(
          tokenPath.map((token) => token.address).slice(0, tokenPath.length - 1),
          feePath.slice(0, feePath.length - 1)
        )

        const withdrawAmount = ethers.constants.MaxUint256
        const borrowTokenRepayAmount = await account.callStatic.getBorrowBalance()
        const borrowTokenRepayAmount_float = solidityTokenAmount2Float(borrowToken, borrowTokenRepayAmount)
        const maxSupplyTokenRepayAmount = float2SolidityTokenAmount(
          principalToken,
          borrowTokenRepayAmount_float / (maxSlippageFloat * price)
        )

        await expect(
          account.decreasePositionWithV3FlashswapMultihop({
            withdrawAmount,
            maxSupplyTokenRepayAmount,
            borrowTokenRepayAmount: ethers.constants.MaxUint256,
            platform,
            supplyToken: principalToken.address,
            borrowToken: borrowToken.address,
            path: badPath,
          })
        ).to.be.revertedWith('DWV3FMC4')
      })
      it('reverts when called by non-owner', async () => {
        await expect(
          account.connect(mallory).decreasePositionWithV3FlashswapMultihop({
            withdrawAmount: ethers.constants.MaxUint256,
            maxSupplyTokenRepayAmount: 0,
            borrowTokenRepayAmount: ethers.constants.MaxUint256,
            platform,
            supplyToken: principalToken.address,
            borrowToken: borrowToken.address,
            path,
          })
        ).to.be.revertedWith('FA2')
      })

      it('reverts if position has not been opened', async () => {
        const { account } = await createFoldingAccount(foldingRegistry, alice)

        await expect(
          account.decreasePositionWithV3FlashswapMultihop({
            withdrawAmount: ethers.constants.MaxUint256,
            maxSupplyTokenRepayAmount: ethers.constants.MaxUint256,
            borrowTokenRepayAmount: ethers.constants.MaxUint256,
            platform,
            supplyToken: principalToken.address,
            borrowToken: borrowToken.address,
            path,
          })
        ).to.be.revertedWith('SP2')
      })
    })

    describe('same token positions', () => {
      it('allows to completely close the position', async () => {})

      it('allows to partially close the position', async () => {})
    })
  })

  describe('UniswapV3Callback', () => {
    it('reverts when called by unathorized address mid-transaction')
    it('reverts if pools are empty (DWV3FMC2 & 3) - Cannot be tested trivially')
    it('is not accesible via direct call', async () => {
      const _account = DecreaseWithV3FlashswapMultihopConnector__factory.connect(account.address, alice)
      await expect(_account.uniswapV3SwapCallback(0, 0, '0x00')).to.be.revertedWith('FR2')
    })
  })
})
