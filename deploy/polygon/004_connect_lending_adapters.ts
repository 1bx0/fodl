import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { AAVE_PLATFORM_POLYGON } from '../../constants/deploy'
import { FoldingRegistry } from '../../typechain'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const aaveAdapter = await hre.ethers.getContract('AaveLendingPolygonAdapter')
  const existingAdapter = await foldingRegistry.callStatic.getPlatformAdapter(AAVE_PLATFORM_POLYGON).catch(() => null)

  const tx = existingAdapter
    ? await foldingRegistry.changePlatformAdapter(AAVE_PLATFORM_POLYGON, aaveAdapter.address)
    : await foldingRegistry.addPlatformWithAdapter(AAVE_PLATFORM_POLYGON, aaveAdapter.address)
  await tx.wait()
}

export default func
func.tags = ['ConnectLendingAdapters']
