import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { FodlNFT, FoldingRegistry } from '../typechain'

describe('Deployments', () => {
  it('works', async () => {
    await deployments.run()

    const fodlNFT = (await ethers.getContract('FodlNFT')) as FodlNFT
    const registry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

    expect(fodlNFT.address).to.be.equal(await registry.fodlNFT())
  })
})
