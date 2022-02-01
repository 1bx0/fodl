import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FODL_TOKEN_INITIAL_AMOUNT } from '../constants/deploy'
import { deployContract } from '../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await deployContract(hre, 'FodlToken', [FODL_TOKEN_INITIAL_AMOUNT])
}
export default func
func.tags = ['FodlToken']
