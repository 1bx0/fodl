import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FodlToken } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const fodlToken = (await hre.ethers.getContract('FodlToken')) as FodlToken
  await deployContract(hre, 'FodlSingleSidedStaking', [fodlToken.address])
}

export default func
func.tags = ['FodlSingleSidedStaking']
func.dependencies = ['FodlToken']
