import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FODL_NFT_NAME, FODL_NFT_SYMBOL } from '../../constants/deploy'
import { deployContract } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await deployContract(hre, 'FodlNFT', [FODL_NFT_NAME, FODL_NFT_SYMBOL])
}
export default func
func.tags = ['FodlNFT']
