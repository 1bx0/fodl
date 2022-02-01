import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { SUBSIDY_HOLDER_ADDRESS, SUBSIDY_REWARDS } from '../constants/deploy'
import { FodlNFT, FoldingRegistry } from '../typechain'
import { deployConnector } from '../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry
  const fodlNFT = (await hre.ethers.getContract('FodlNFT')) as FodlNFT

  await deployConnector(hre, foldingRegistry, 'ResetAccountConnector', 'IResetAccountConnector', [fodlNFT.address])
  await deployConnector(hre, foldingRegistry, 'SimplePositionBaseConnector', 'ISimplePositionBaseConnector')

  if ((await hre.getChainId()) != '1')
    await deployConnector(hre, foldingRegistry, 'SimplePositionLendingConnector', 'ISimplePositionLendingConnector')

  await deployConnector(hre, foldingRegistry, 'SimplePositionStopLossConnector', 'ISimplePositionStopLossConnector')
  await deployConnector(hre, foldingRegistry, 'ClaimRewardsConnector', 'IClaimRewardsConnector', [
    SUBSIDY_REWARDS,
    SUBSIDY_HOLDER_ADDRESS,
  ])
}

export default func
func.tags = ['Connectors']
func.dependencies = ['FoldingRegistry']
