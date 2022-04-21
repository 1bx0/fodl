import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { LPStakingAutomationResume } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const lpStakingAutomation = (await hre.ethers.getContract('LPStakingAutomationResume')) as LPStakingAutomationResume
  await deployContract(hre, 'LPStakingAutomationResumeV2', [lpStakingAutomation.address])
}

export default func
func.tags = ['LPStakingAutomationV2']
