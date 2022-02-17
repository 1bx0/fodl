import { DeployResult } from 'hardhat-deploy/dist/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { VENUS_PLATFORM } from '../../constants/deploy'
import { WBNB } from '../../constants/tokens'
import { FoldingRegistry } from '../../typechain'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry
  await deployContract(hre, 'VenusLendingAdapter', [WBNB.address, foldingRegistry.address])
}

export default func
func.tags = ['LendingAdapters']
