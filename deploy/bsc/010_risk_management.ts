import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FodlNFT, FoldingRegistry } from '../../typechain'
import { deployConnector } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await deployConnector(hre, foldingRegistry, 'WhitelistPNLConnector', 'IWhitelistPNLConnector')
  await deployConnector(hre, foldingRegistry, 'WhitelistStopLossConnector', 'IWhitelistStopLossConnector')
}

export default func
func.tags = ['WhitelistPNL']
