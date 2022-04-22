import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { GOVERNANCE_MIN_DELAY } from '../../constants/deploy'
import { MultiSigWallet } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const governanceMultiSig = (await hre.ethers.getContract('FodlMultiSig')) as MultiSigWallet

  await deployContract(
    hre,
    'FodlOwnership',
    [GOVERNANCE_MIN_DELAY, [ethers.constants.AddressZero], [governanceMultiSig.address]],
    'TimelockGovernance'
  )

  await deployContract(
    hre,
    'FodlRewardsFund',
    [GOVERNANCE_MIN_DELAY, [ethers.constants.AddressZero], [governanceMultiSig.address]],
    'TimelockGovernance'
  )
}

export default func
func.dependencies = ['FodlMultiSig']
func.tags = ['FodlTimelocks']
