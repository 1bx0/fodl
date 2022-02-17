import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { GOVERNANCE_MIN_REQUIRED, GOVERNANCE_MULTISIG_OWNERS } from '../../constants/deploy'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await deployContract(hre, 'FodlMultiSig', [GOVERNANCE_MULTISIG_OWNERS, GOVERNANCE_MIN_REQUIRED], 'MultiSigWallet')
}

export default func
func.tags = ['FodlMultiSig']
// Only deploy on mainnet
func.skip = async (hre) => (await hre.getChainId()) != '1'
