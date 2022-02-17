import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { UNI_V3_FACTORY } from '../../constants/deploy'
import { WETH } from '../../constants/tokens'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await deployContract(hre, 'QuoterV2', [UNI_V3_FACTORY, WETH.address])
}

export default func
// Do not deploy on mainnet, this is just for local
func.skip = async (hre) => (await hre.getChainId()) == '1'
