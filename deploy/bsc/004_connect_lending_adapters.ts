import { DeployResult } from 'hardhat-deploy/dist/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { VENUS_PLATFORM } from '../../constants/deploy'
import { WBNB } from '../../constants/tokens'
import { FoldingRegistry } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const venusAdapter = await hre.ethers.getContract('VenusLendingAdapter')
  const existingAdapter = await foldingRegistry.callStatic.getPlatformAdapter(VENUS_PLATFORM).catch(() => null)

  const tx = existingAdapter
    ? await foldingRegistry.changePlatformAdapter(VENUS_PLATFORM, venusAdapter.address)
    : await foldingRegistry.addPlatformWithAdapter(VENUS_PLATFORM, venusAdapter.address)
  await tx.wait()
}

export default func
func.tags = ['ConnectLendingAdapters']
