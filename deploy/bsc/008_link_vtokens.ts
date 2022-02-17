import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { VENUS_PLATFORM, VENUS_TOKENS_TO_VTOKENS } from '../../constants/deploy'
import { FoldingRegistry } from '../../typechain'
import { linkPlatformCTokens } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await linkPlatformCTokens(foldingRegistry, hre.network.name, 'venus', VENUS_PLATFORM, VENUS_TOKENS_TO_VTOKENS)
}

export default func
func.tags = ['VTokens']
