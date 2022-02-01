import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FoldingRegistry } from '../typechain'
import { deployConnector } from '../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await deployConnector(hre, foldingRegistry, 'PNLConnector', 'IPNLConnector', [])
}

export default func
func.tags = ['PNLConnector']
func.dependencies = ['FoldingRegistry', 'Connectors']
// Do not deploy on mainnet yet as UI integration is not complete
func.skip = async (hre) => (await hre.getChainId()) == '1'
