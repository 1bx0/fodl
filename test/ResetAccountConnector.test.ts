import { expect } from 'chai'
import { deployments, waffle } from 'hardhat'
import { AllConnectors, FodlNFT, FoldingRegistry, ResetAccountConnector } from '../typechain'
import { createFoldingAccount } from './shared/utils'

const [owner, alice, bob, mallory] = waffle.provider.getWallets()

const fixture = deployments.createFixture(async (hre) => {
  const { deployments, ethers } = hre
  await deployments.fixture()

  const fodlNFT = (await hre.ethers.getContract('FodlNFT')) as FodlNFT
  const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

  let { account } = await createFoldingAccount(foldingRegistry, alice)
  let resetAccountConnector = (await ethers.getContract('ResetAccountConnector')) as ResetAccountConnector
  resetAccountConnector = resetAccountConnector.attach(account.address)

  return { account, fodlNFT, resetAccountConnector }
})

describe('ResetAccountConnector', () => {
  let account: AllConnectors
  let resetAccountConnector: ResetAccountConnector
  let fodlNFT: FodlNFT

  beforeEach('load fixture', async () => {
    ;({ account, resetAccountConnector, fodlNFT } = await fixture())
  })

  describe('resetAccount()', () => {
    it('is called on token transfer to new owner', async () => {
      await expect(fodlNFT.connect(alice).transferFrom(alice.address, bob.address, account.address))
        .to.emit(resetAccountConnector, 'OwnerChanged')
        .withArgs(alice.address, bob.address)
    })

    it('cannot be called by anyone except fodlNFT', async () => {
      await expect(account.resetAccount(alice.address, alice.address, 0)).to.be.revertedWith('FA3')
      await expect(account.connect(mallory).resetAccount(alice.address, alice.address, 0)).to.be.revertedWith('FA3')
    })
  })
})
