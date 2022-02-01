import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { SUSHI_ROUTER, UNI_ROUTER, USE_SUSHISWAP_EXCHANGE, USE_UNISWAP_EXCHANGE } from '../constants/deploy'
import { deployContract } from '../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const foldingRegistry = await hre.ethers.getContract('FoldingRegistry')

  const uniswapExchanger = await deployContract(hre, 'UniswapExchangerAdapter', [UNI_ROUTER])
  if (uniswapExchanger.newlyDeployed)
    await foldingRegistry.addExchangerWithAdapter(USE_UNISWAP_EXCHANGE, uniswapExchanger.address)

  const sushiswapExchanger = await deployContract(hre, 'SushiswapExchangerAdapter', [SUSHI_ROUTER])
  if (sushiswapExchanger.newlyDeployed)
    await foldingRegistry.addExchangerWithAdapter(USE_SUSHISWAP_EXCHANGE, sushiswapExchanger.address)
}

export default func
func.tags = ['Exchangers']
func.dependencies = ['FoldingRegistry']
