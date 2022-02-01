import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FodlNFT, FoldingRegistry, FoldingRegistryUpgradedMock } from '../typechain'
import { deployProxy } from '../utils/deploy'

const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  await hre.deployments.fixture(['FoldingRegistry'])

  const fodlNFT = (await hre.ethers.getContract('FodlNFT')) as FodlNFT
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const upgrade = async () => {
    await deployProxy(hre, 'FoldingRegistry', 'initialize', [fodlNFT.address], 'FoldingRegistryUpgradedMock')
    return (await ethers.getContract('FoldingRegistry')) as FoldingRegistryUpgradedMock
  }

  return { foldingRegistry, upgrade }
})

describe('FoldingRegistryUpgradability', () => {
  let foldingRegistry: FoldingRegistry
  let foldingRegistryUpgradedMock: FoldingRegistryUpgradedMock
  let upgrade

  beforeEach('deploy contract', async () => {
    ;({ foldingRegistry, upgrade } = await fixture())

    foldingRegistryUpgradedMock = (await upgrade()) as FoldingRegistryUpgradedMock
  })

  it('updates functions', async () => {
    const result = await foldingRegistryUpgradedMock.newViewFunction()
    expect(result).to.be.equal(true)
  })

  it('allows new storage and behaves like V1', async () => {
    const newStorageVariable_Before = await foldingRegistryUpgradedMock.newStorageVariable()
    expect(newStorageVariable_Before).to.be.equal(ethers.constants.Zero)

    const random = BigNumber.from(Math.floor(Math.random()) * 5000)
    await foldingRegistryUpgradedMock.setNewStorageVariable(random)

    const newStorageVariable_After = await foldingRegistryUpgradedMock.newStorageVariable()
    expect(newStorageVariable_After.toString()).to.be.equal(random.toString())
  })
})
