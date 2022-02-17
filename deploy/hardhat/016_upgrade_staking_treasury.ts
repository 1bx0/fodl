import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ConstantFaucet, LPStakingAutomation } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const lpStakingAutomation = (await hre.ethers.getContract('LPStakingAutomation')) as LPStakingAutomation
  const constantFaucet = (await hre.ethers.getContract('ConstantFaucet')) as ConstantFaucet
  await deployContract(hre, 'ConstantFaucetResume', [constantFaucet.address])
  await deployContract(hre, 'LPStakingAutomationResume', [lpStakingAutomation.address])
}

export default func
func.dependencies = ['LPStakingAutomation', 'ConstantFaucet']
func.tags = ['UpgradeStakingTreasury']
