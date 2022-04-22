import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FoldingRegistry } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await deployContract(hre, 'LendingPlatformLens', [foldingRegistry.address])
  await deployContract(hre, 'SimplePositionLens')
}

export default func
func.tags = ['Lens']
