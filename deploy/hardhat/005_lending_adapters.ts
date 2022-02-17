import { DeployResult } from 'hardhat-deploy/dist/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {
  AAVE_PLATFORM,
  AAVE_PLATFORM_DATA_PROVIDER,
  AAVE_PLATFORM_INCENTIVES_CONTROLLER,
  COMPOUND_PLATFORM,
} from '../../constants/deploy'
import { WETH } from '../../constants/tokens'
import { FoldingRegistry } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const connectAdapter = async (platformAddress: string, adapter: DeployResult) => {
    if (adapter.newlyDeployed) {
      const existingAdapter = await foldingRegistry.callStatic.getPlatformAdapter(platformAddress).catch(() => null)
      if (!existingAdapter) {
        await foldingRegistry.addPlatformWithAdapter(platformAddress, adapter.address)
      } else {
        await foldingRegistry.changePlatformAdapter(platformAddress, adapter.address)
      }
    }
  }

  const compoundAdapter = await deployContract(hre, 'CompoundForksLendingAdapter', [
    WETH.address,
    foldingRegistry.address,
  ])

  const aaveAdapter = await deployContract(hre, 'AaveLendingAdapter', [
    AAVE_PLATFORM,
    AAVE_PLATFORM_DATA_PROVIDER,
    AAVE_PLATFORM_INCENTIVES_CONTROLLER,
  ])

  await connectAdapter(COMPOUND_PLATFORM, compoundAdapter)

  await connectAdapter(AAVE_PLATFORM, aaveAdapter)
}

export default func
func.tags = ['LendingAdapters']
func.dependencies = ['FoldingRegistry']
