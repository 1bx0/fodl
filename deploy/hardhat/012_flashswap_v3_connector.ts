import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {
  SUBSIDY_HOLDER_ADDRESS,
  SUBSIDY_PRINCIPAL,
  SUBSIDY_PROFIT,
  SUBSIDY_REWARDS,
  UNI_V3_FACTORY,
} from '../../constants/deploy'
import { FoldingRegistry } from '../../typechain'
import { deployConnector } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  await deployConnector(
    hre,
    foldingRegistry,
    'IncreaseWithV3FlashswapMultihopConnector',
    'IIncreaseWithV3FlashswapMultihopConnector',
    [SUBSIDY_PRINCIPAL, SUBSIDY_PROFIT, SUBSIDY_HOLDER_ADDRESS, UNI_V3_FACTORY]
  )

  await deployConnector(
    hre,
    foldingRegistry,
    'DecreaseWithV3FlashswapMultihopConnector',
    'IDecreaseWithV3FlashswapMultihopConnector',
    [SUBSIDY_PRINCIPAL, SUBSIDY_PROFIT, SUBSIDY_REWARDS, SUBSIDY_HOLDER_ADDRESS, UNI_V3_FACTORY]
  )
}

export default func
func.tags = ['V3FlashswapConnector']
func.dependencies = ['FoldingRegistry', 'Connectors']
