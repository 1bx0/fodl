import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { TOKEN_URI_SIGNER_ADDRESS } from '../constants/deploy'
import { FoldingRegistry } from '../typechain'
import { deployConnector } from '../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const registry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await deployConnector(hre, registry, 'SetTokenURIConnector', 'ISetTokenURIConnector', [TOKEN_URI_SIGNER_ADDRESS])
}

export default func
func.tags = ['SetTokenURI']
