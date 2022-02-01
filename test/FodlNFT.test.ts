import { expect } from 'chai'
import { deployments, ethers, waffle } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FodlNFT, FodlNFTAccountMock } from '../typechain'
import { ERC721Mock } from '../typechain/ERC721Mock'
import { deployContract } from '../utils/deploy'

const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  const { ethers } = hre

  await deployContract(hre, 'FodlNFT', ['Test NFT', 'TST'])
  const fodlNFT = (await ethers.getContract('FodlNFT')) as FodlNFT

  const nftFactory = await ethers.getContractFactory('ERC721Mock', waffle.provider.getSigner())
  const oldNFT = (await nftFactory.deploy('Old NFT', 'OLD')) as ERC721Mock

  await deployContract(hre, 'FodlNFTAccountMock')
  const testAccount = (await ethers.getContract('FodlNFTAccountMock')) as FodlNFTAccountMock
  return { fodlNFT, testAccount, oldNFT }
})

describe('Test FodlNFT', function () {
  let oldNFT: ERC721Mock, fodlNFT: FodlNFT, testAccount: FodlNFTAccountMock

  before(async function () {
    ;({ fodlNFT, testAccount, oldNFT } = await fixture())
  })

  it('should initialize properly', async function () {
    expect(await fodlNFT.symbol()).to.equal('TST')
    expect(await fodlNFT.name()).to.equal('Test NFT')
  })

  describe('mint nft account', () => {
    let [owner, otherOwner, alice] = waffle.provider.getWallets()

    it('owner can mint', async function () {
      await expect(fodlNFT.mint(alice.address, testAccount.address)).to.not.be.reverted
    })

    it('non-owner cannot mint', async function () {
      await expect(fodlNFT.connect(otherOwner).mint(alice.address, testAccount.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('cannot mint duplicate', async function () {
      await expect(fodlNFT.mint(alice.address, testAccount.address)).to.be.revertedWith('ERC721: token already minted')
    })

    it('should set owner properly', async function () {
      expect(await fodlNFT.ownerOf(ethers.BigNumber.from(testAccount.address))).to.be.equal(alice.address)
    })

    it('tokenUri is empty by default', async function () {
      expect(await fodlNFT.tokenURI(ethers.BigNumber.from(testAccount.address))).to.be.equal('')
    })

    it('tokenUri can be set via account', async function () {
      const newTokenUri = 'some new token uri'
      await expect(testAccount.changeTokenUri(fodlNFT.address, newTokenUri)).to.not.be.reverted
      expect(await fodlNFT.tokenURI(ethers.BigNumber.from(testAccount.address))).to.be.equal(newTokenUri)
    })

    it('tokenUri can be set twice via account', async function () {
      const newTokenUri = 'some other token uri'
      await expect(testAccount.changeTokenUri(fodlNFT.address, newTokenUri)).to.not.be.reverted
      expect(await fodlNFT.tokenURI(ethers.BigNumber.from(testAccount.address))).to.be.equal(newTokenUri)
    })

    it('tokenUri cannot be set without account', async function () {
      const newTokenUri = 'some new token uri'
      await expect(fodlNFT.setTokenUri(newTokenUri)).to.be.revertedWith('ERC721Metadata: URI set of nonexistent token')
    })

    it('migrate nfts', async function () {
      const migrationSize = 30

      for (let i = 0; i < migrationSize; i++) await oldNFT.mint(owner.address, i)
      expect(await oldNFT.totalSupply()).to.eq(migrationSize)

      const batchSize = 9
      for (let i = 0; i < migrationSize; i += batchSize)
        await expect(fodlNFT.migrateLegacyNFT(oldNFT.address, i, i + batchSize)).to.not.be.reverted

      for (let i = 0; i < migrationSize; i++) expect(await fodlNFT.ownerOf(i)).to.equal(await oldNFT.ownerOf(i))
    })
  })
})
