import { expect } from 'chai'
import { Wallet } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { FODL_NFT_NAME, FODL_NFT_SYMBOL } from '../constants/deploy'
import { AllConnectors, FodlNFT, FoldingRegistryV2, SetTokenURIConnector } from '../typechain'
import { getFunctionSigs } from '../utils/deploy'

const [owner, authoriser, bob, mallory] = waffle.provider.getWallets()

describe('SetTokenURIConnector', () => {
  let account: AllConnectors
  let registry: FoldingRegistryV2
  let fodlNFT: FodlNFT
  let tokenURI: SetTokenURIConnector

  before('setup FodlNFT, Registry, ResetAccountConnector, SetTokenURIConnector', async () => {
    fodlNFT = (await (await ethers.getContractFactory('FodlNFT')).deploy(FODL_NFT_NAME, FODL_NFT_SYMBOL)) as FodlNFT
    registry = (await (await ethers.getContractFactory('FoldingRegistryV2')).deploy()) as FoldingRegistryV2
    await registry.initialize(fodlNFT.address)
    await fodlNFT.transferOwnership(registry.address)

    const reset = await (await ethers.getContractFactory('ResetAccountConnector')).deploy(fodlNFT.address)
    await registry.addImplementation(reset.address, await getFunctionSigs('IResetAccountConnector', reset.address))

    tokenURI = (await (
      await ethers.getContractFactory('SetTokenURIConnector')
    ).deploy(authoriser.address)) as SetTokenURIConnector
    await registry.addImplementation(tokenURI.address, await getFunctionSigs('ISetTokenURIConnector', tokenURI.address))

    const accountAddress = await registry.callStatic.createAccount()
    await registry.createAccount()
    account = (await ethers.getContractAt('AllConnectors', accountAddress)) as AllConnectors
  })

  describe('setTokenURI()', () => {
    const someURI = '->some random URI'
    const otherURI = '->some other random URI'
    const getSignature = async (someURI: string, auth: Wallet) => {
      const h = ethers.utils.solidityKeccak256(['address', 'string'], [account.address.toLowerCase(), someURI])
      const hash = ethers.utils.arrayify(h)
      const sig = ethers.utils.splitSignature(await auth.signMessage(hash))
      return sig
    }

    it('can set tokenURI with valid approval', async () => {
      const sig = await getSignature(someURI, authoriser)

      await expect(account.setTokenURI(someURI, sig.v, sig.r, sig.s)).to.not.be.reverted
      expect(await fodlNFT.tokenURI(ethers.BigNumber.from(account.address))).to.eq(someURI)
    })

    it('can set other tokenURI with valid approval', async () => {
      const sig = await getSignature(otherURI, authoriser)

      await expect(account.setTokenURI(otherURI, sig.v, sig.r, sig.s)).to.not.be.reverted
      expect(await fodlNFT.tokenURI(ethers.BigNumber.from(account.address))).to.eq(otherURI)
    })

    it('only owner can call setTokenURI', async () => {
      const sig = await getSignature(someURI, authoriser)

      await expect(account.connect(bob).setTokenURI(someURI, sig.v, sig.r, sig.s)).to.be.revertedWith('FA2')
    })

    it('cannot set tokenURI with invalid approval', async () => {
      const sig = await getSignature(someURI, mallory)

      await expect(account.setTokenURI(someURI, sig.v, sig.r, sig.s)).to.be.revertedWith('Invalid authoriser signature')
    })
  })
})
