import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {
  AAVE_PLATFORM_DATA_PROVIDER_POLYGON,
  AAVE_PLATFORM_INCENTIVES_CONTROLLER_POLYGON,
  AAVE_PLATFORM_POLYGON,
} from '../../constants/deploy'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await deployContract(hre, 'AaveLendingPolygonAdapter', [
    AAVE_PLATFORM_POLYGON,
    AAVE_PLATFORM_DATA_PROVIDER_POLYGON,
    AAVE_PLATFORM_INCENTIVES_CONTROLLER_POLYGON,
  ])
}

export default func
func.tags = ['LendingAdapters']
