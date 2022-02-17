import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { SSS_REWARDS_START_TIME, STAKING_TREASURY_ADDRESS } from '../../constants/deploy'
import { FodlSingleSidedStaking, FodlToken } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const fodlToken = (await hre.ethers.getContract('FodlToken')) as FodlToken
  const sss = (await hre.ethers.getContract('FodlSingleSidedStaking')) as FodlSingleSidedStaking
  await deployContract(hre, 'ConstantFaucet', [
    fodlToken.address,
    STAKING_TREASURY_ADDRESS,
    sss.address,
    SSS_REWARDS_START_TIME,
  ])
}

export default func
func.tags = ['ConstantFaucet']
func.dependencies = ['FodlToken', 'FodlSingleSidedStaking']
