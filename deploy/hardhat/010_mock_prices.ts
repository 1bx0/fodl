import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { AAVE_PLATFORM, COMPOUND_PLATFORM, UNI_ROUTER, USE_CONTROLLED_EXCHANGE } from '../../constants/deploy'
import { overrideAavePriceOracle, overrideCompoundPriceOracle } from '../../test/shared/utils'
import {
  AavePriceOracleMock,
  CompoundPriceOracleMock,
  FoldingRegistry,
  IAaveLendingPoolProvider__factory,
  IComptroller__factory,
} from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // This script should only be run for dev/sit/test networks
  if ((await hre.getChainId()) == '1') return

  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const controlledExchanger = await deployContract(hre, 'ControlledExchanger', [UNI_ROUTER])

  const controlledExchangerAdapter = await deployContract(hre, 'ControlledExchangerAdapter', [
    controlledExchanger.address,
  ])
  if (controlledExchangerAdapter.newlyDeployed)
    await foldingRegistry.addExchangerWithAdapter(USE_CONTROLLED_EXCHANGE, controlledExchangerAdapter.address)

  await deployContract(hre, 'CompoundPriceOracleMock', [])
  await deployContract(hre, 'AavePriceOracleMock', [])

  const compoundPriceOracleMock = (await hre.ethers.getContract('CompoundPriceOracleMock')) as CompoundPriceOracleMock
  const aavePriceOracleMock = (await hre.ethers.getContract('AavePriceOracleMock')) as AavePriceOracleMock

  const comptroller = IComptroller__factory.connect(COMPOUND_PLATFORM, ethers.provider)
  const aave = IAaveLendingPoolProvider__factory.connect(AAVE_PLATFORM, ethers.provider)
  await compoundPriceOracleMock.setOriginalOracle(await comptroller.callStatic.oracle())
  await aavePriceOracleMock.setOriginalOracle(await aave.callStatic.getPriceOracle())

  await overrideCompoundPriceOracle(COMPOUND_PLATFORM, compoundPriceOracleMock.address)
  await overrideAavePriceOracle(AAVE_PLATFORM, aavePriceOracleMock.address)
}

export default func
func.tags = ['ControlledExchanger']
func.dependencies = ['FoldingRegistry']
