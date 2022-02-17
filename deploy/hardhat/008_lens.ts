import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FoldingRegistry } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await deployContract(hre, 'LendingPlatformLens', [foldingRegistry.address])
  // stop deploying SimplePositionLens on mainnet before we update it.
  // The bytecode is different because of dependency on FoldingRegistry
  // which changed the type of one variable from private to internal
  if ((await hre.getChainId()) == '1') return
  await deployContract(hre, 'SimplePositionLens')
}

export default func
func.tags = ['Lens']
func.dependencies = ['FoldingRegistry']
