import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {
  FIRST_LP_STAKING_REWARD_INDEX,
  LP_ETH_FODL_STAKING_ADDRESS,
  LP_USDC_FODL_STAKING_ADDRESS,
  STAKING_TREASURY_ADDRESS,
} from '../constants/deploy'
import { FodlToken } from '../typechain'
import { deployContract } from '../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const fodlToken = (await hre.ethers.getContract('FodlToken')) as FodlToken
  await deployContract(hre, 'LPStakingAutomation', [
    fodlToken.address,
    STAKING_TREASURY_ADDRESS,
    LP_ETH_FODL_STAKING_ADDRESS,
    LP_USDC_FODL_STAKING_ADDRESS,
    FIRST_LP_STAKING_REWARD_INDEX,
  ])
}

export default func
func.tags = ['LPStakingAutomation']
func.dependencies = ['FodlToken']
