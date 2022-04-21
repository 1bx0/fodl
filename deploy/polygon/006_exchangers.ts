import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { QUICKSWAP_ROUTER, USE_QUICKSWAP_EXCHANGE } from '../../constants/deploy'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = await hre.ethers.getContract('FoldingRegistry')

  const quickExchanger = await deployContract(hre, 'PancakeswapExchangerAdapter', [QUICKSWAP_ROUTER])
  if (quickExchanger.newlyDeployed)
    await foldingRegistry.addExchangerWithAdapter(USE_QUICKSWAP_EXCHANGE, quickExchanger.address)
}

export default func
func.tags = ['Exchangers']
