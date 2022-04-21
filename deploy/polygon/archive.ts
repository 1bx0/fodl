import { DeployResult } from 'hardhat-deploy/dist/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { archiveArtifacts } from '../../utils/deploy'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const timestamp = new Date().toISOString().split('.')[0]
  const name = hre.network.name
  const { deployments } = hre

  for (let d of Object.values(await deployments.all())) {
    let result = d as DeployResult

    if (result.newlyDeployed ?? true) {
      archiveArtifacts(name, timestamp)
      break
    }
  }
}

export default func
func.runAtTheEnd = true
