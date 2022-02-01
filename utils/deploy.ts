import { ethers } from 'hardhat'
import { DeployResult, ProxyOptions } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FoldingRegistry } from '../typechain'
const fse = require('fs-extra')

export const deployProxy = async (
  hre: HardhatRuntimeEnvironment,
  contract: string,
  method: string,
  args: any[],
  upgradeTo?: string
): Promise<DeployResult> => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const proxyOptions: ProxyOptions = {
    proxyContract: 'OpenZeppelinTransparentProxy',
    owner: deployer,
    execute: {
      init: {
        methodName: method,
        args: args,
      },
    },
  }

  const deployment = await deploy(contract, {
    from: deployer,
    contract: upgradeTo ?? contract,
    log: true,
    proxy: proxyOptions,
  })

  if (deployment.newlyDeployed) {
    const deploymentName = hre.network.name

    addDeploymentChange(deploymentName, contract, {
      Block: deployment.receipt?.blockNumber,
      ProxyAddress: deployment.address,
      Address: deployment.implementation,
      Method: method,
      Args: args,
    })
  }

  return deployment
}

export const deployContract = async (
  hre: HardhatRuntimeEnvironment,
  name: string,
  args: any[] = []
): Promise<DeployResult> => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const deployment = (await deploy(name, {
    from: deployer,
    args: args,
    log: true,
  })) as DeployResult
  if (deployment.newlyDeployed) {
    const deploymentName = hre.network.name
    addDeploymentChange(deploymentName, name, {
      Block: deployment.receipt?.blockNumber,
      Address: deployment.address,
      Args: args,
    })
  }
  return deployment
}

export const deployConnector = async (
  hre: HardhatRuntimeEnvironment,
  foldingRegistry: FoldingRegistry,
  name: string,
  iface: string,
  args: any[] = []
) => {
  const connector = await deployContract(hre, name, args)
  if (connector.newlyDeployed) {
    await foldingRegistry.addImplementation(connector.address, await getFunctionSigs(iface, connector.address))
  }
}

export const loadJSON = (filename: string) => {
  const data = fse.readFileSync(filename)
  return JSON.parse(data)
}

export const storeJSON = (filename: string, json: Object) => {
  fse.writeFileSync(filename, JSON.stringify(json, null, 2))
}

export const addDeploymentChange = (deploymentName: string, contract: string, body: Object, displayName?: string) => {
  if (deploymentName == 'hardhat') return
  const dest = `./deployments/${deploymentName}/summary.json`
  const summary = fse.existsSync(dest) ? loadJSON(dest) : {}
  summary[displayName ?? contract] = body
  storeJSON(dest, summary)
}

export const archiveArtifacts = (name: string, timestamp) => {
  if (name == 'hardhat') return

  const dest = `./archives/${name}/${timestamp}`
  fse.mkdirSync(dest, { recursive: true })

  console.log(`Archiving artifacts to ${dest}`)
  fse.copySync('./contracts', `${dest}/contracts`)
  fse.copySync(`./deployments/${name}`, `${dest}/artifacts`)
  fse.copySync(`./deploy`, `${dest}/deploy`)
}

export const getFunctionSigs = async (interfaceName: string, address: string) => {
  const connector = await ethers.getContractAt(interfaceName, address)
  return Object.values(connector.interface.functions).map((f: any) => connector.interface.getSighash(f.name))
}
