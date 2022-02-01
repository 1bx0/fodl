import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { COMPOUND_PLATFORM, COMPOUND_TOKENS_TO_CTOKENS } from '../constants/deploy'
import { FoldingRegistry } from '../typechain'
import { addDeploymentChange } from '../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await linkPlatformCTokens(
    foldingRegistry,
    hre.network.name,
    'compound',
    COMPOUND_PLATFORM,
    COMPOUND_TOKENS_TO_CTOKENS
  )
}

const linkPlatformCTokens = async (
  registry: FoldingRegistry,
  deploymentName: string,
  platformName: string,
  platformAddress: string,
  cTokensMapping: { [token: string]: string }
) => {
  const tokens = {}
  for (const token in cTokensMapping) {
    try {
      const ctoken = await registry.callStatic.getCToken(platformAddress, token)
      if (ctoken.toLowerCase() != cTokensMapping[token].toLowerCase()) {
        console.warn(
          `Warning: Trying to upgrade token ${token} from cToken: ${ctoken} to ${cTokensMapping[token]} is not currently supported`
        )
      }
      continue
    } catch {}
    await registry.addCTokenOnPlatform(platformAddress, token, cTokensMapping[token])
    tokens[token] = cTokensMapping[token]
  }
  addDeploymentChange(deploymentName, `${platformName}CTokenMapping`, tokens)
}

export default func
func.tags = ['CTokens']
func.dependencies = ['FoldingRegistry']
