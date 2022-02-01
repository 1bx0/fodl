import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { AAVE_PLATFORM, AAVE_PLATFORM_DATA_PROVIDER } from '../constants/deploy'
import { TOKENS } from '../scripts/my_tokens'
import { IAaveDataProvider, IAaveLendingPoolProvider, IAavePriceOracleGetter, AaveLendingAdapter } from '../typechain'

const { BigNumber } = ethers

const DAI = TOKENS['DAI'].address

const AAVE_CONFIG_DATA_FACTOR = BigNumber.from('100000000000000')

const fixture = deployments.createFixture(async ({ deployments }) => {
  await deployments.fixture()

  const aaveLendingAdapter = (await ethers.getContract('AaveLendingAdapter')) as AaveLendingAdapter

  const aaveDataProvider = (await ethers.getContractAt(
    'IAaveDataProvider',
    AAVE_PLATFORM_DATA_PROVIDER
  )) as IAaveDataProvider

  const aavePoolProvider = (await ethers.getContractAt(
    'IAaveLendingPoolProvider',
    AAVE_PLATFORM
  )) as IAaveLendingPoolProvider

  const aavePriceOracle = (await ethers.getContractAt(
    'IAavePriceOracleGetter',
    await aavePoolProvider.getPriceOracle()
  )) as IAavePriceOracleGetter

  return { aaveLendingAdapter, aaveDataProvider, aavePriceOracle }
})

describe('AAVE platform metadata', async () => {
  let aaveLendingAdapter: AaveLendingAdapter
  let aaveDataProvider: IAaveDataProvider
  let aavePriceOracle: IAavePriceOracleGetter

  before(async () => {
    ;({ aaveLendingAdapter, aaveDataProvider, aavePriceOracle } = await fixture())
  })

  it('Returns correct data for DAI reserves', async () => {
    const daiData = await aaveLendingAdapter.callStatic.getAssetMetadata(AAVE_PLATFORM, DAI)

    const configData = await aaveDataProvider.getReserveConfigurationData(DAI)
    const { decimals, ltv, liquidationThreshold } = configData
    const correctCollateralFactor = ltv.mul(AAVE_CONFIG_DATA_FACTOR).toString()
    const correctLiquidationFactor = liquidationThreshold.mul(AAVE_CONFIG_DATA_FACTOR).toString()

    const reserveData = await aaveDataProvider.getReserveData(DAI)
    const { availableLiquidity, totalStableDebt, totalVariableDebt, liquidityRate, variableBorrowRate } = reserveData

    const correctTotalDebt = totalStableDebt.add(totalVariableDebt)
    const correctTotalSupply = availableLiquidity.add(correctTotalDebt)
    const correctSupplyAPY = liquidityRate.div(1e9)
    const correctBorrowAPY = variableBorrowRate.div(1e9)

    const correctReferencePrice = await aavePriceOracle.getAssetPrice(DAI)

    expect(daiData.referencePrice).to.equal(correctReferencePrice)
    expect(daiData.collateralFactor).to.equal(correctCollateralFactor)
    expect(daiData.liquidationFactor).to.equal(correctLiquidationFactor)
    expect(daiData.canBorrow).to.equal(true)
    expect(daiData.canSupply).to.equal(true)

    expect(daiData.totalSupply).to.equal(correctTotalSupply)
    expect(daiData.totalBorrow).to.equal(correctTotalDebt)

    expect(daiData.supplyAPR).to.equal(correctSupplyAPY)
    expect(daiData.borrowAPR).to.equal(correctBorrowAPY)

    expect(daiData.assetAddress).to.equal(DAI)
    expect(daiData.assetSymbol).to.equal('DAI')
    expect(daiData.assetDecimals).to.equal(decimals.toNumber())
  })
})
