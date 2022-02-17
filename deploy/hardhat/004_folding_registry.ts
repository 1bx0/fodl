import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { deployProxy } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const fodlNFT = await hre.ethers.getContract('FodlNFT')

  const deployment = await deployProxy(hre, 'FoldingRegistry', 'initialize', [fodlNFT.address], 'FoldingRegistryV2')

  if (deployment.newlyDeployed) {
    await fodlNFT.transferOwnership(deployment.address)
  }
}

export default func
func.tags = ['FoldingRegistry']
func.dependencies = ['FodlNFT']
