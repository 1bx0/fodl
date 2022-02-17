import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { PANCAKE_ROUTER, USE_PANCAKESWAP_EXCHANGE } from '../../constants/deploy'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = await hre.ethers.getContract('FoldingRegistry')

  const pancakeExchanger = await deployContract(hre, 'PancakeswapExchangerAdapter', [PANCAKE_ROUTER])
  if (pancakeExchanger.newlyDeployed)
    await foldingRegistry.addExchangerWithAdapter(USE_PANCAKESWAP_EXCHANGE, pancakeExchanger.address)
}

export default func
func.tags = ['Exchangers']
