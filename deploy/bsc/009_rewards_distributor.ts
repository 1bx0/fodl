import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FODL_BSC_ADDRESS } from '../../constants/deploy'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await deployContract(hre, 'RewardsDistributor', [FODL_BSC_ADDRESS])
}

export default func
func.tags = ['RewardsDistributor']
