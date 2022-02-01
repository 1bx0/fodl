import { BigNumber } from '@ethersproject/bignumber'
import { FeeAmount } from '@uniswap/v3-sdk'
import { expect } from 'chai'
import { deployments, ethers, waffle } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { map } from 'lodash'
import { COMPOUND_PLATFORM } from '../constants/deploy'
import { USDC, WETH } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { AllConnectors__factory, FodlNFT__factory } from '../typechain'
import { FodlNFT } from '../typechain/FodlNFT'
import { FoldingRegistry } from '../typechain/FoldingRegistry'
import { FoldingRegistryUpgradedMock } from '../typechain/FoldingRegistryUpgradedMock'
import { deployProxy } from '../utils/deploy'
import { encodePath, float2SolidityTokenAmount, getCompoundQuote } from './shared/utils'

const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  await hre.deployments.fixture()

  const fodlNFT = (await hre.ethers.getContract('FodlNFT')) as FodlNFT
  const foldingRegistry = (await hre.ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const upgrade = async () => {
    await deployProxy(hre, 'FoldingRegistry', 'initialize', [fodlNFT.address], 'FoldingRegistryUpgradedMock')
    return (await ethers.getContract('FoldingRegistry')) as FoldingRegistryUpgradedMock
  }

  return { fodlNFT, foldingRegistry, upgrade }
})

describe('Test FoldingRegistry', function () {
  let foldingRegistry: FoldingRegistry
  let upgrade

  describe('Initialisation and upgrades', async function () {
    let fodlNFT: FodlNFT
    let foldingUpgradedMock: FoldingRegistryUpgradedMock

    before('deploy FoldingRegistry', async () => {
      ;({ fodlNFT, foldingRegistry, upgrade } = await fixture())
    })

    it('should initialize properly', async function () {
      expect(await foldingRegistry.fodlNFT()).to.be.equal(fodlNFT.address)
    })

    it('updates version', async () => {
      foldingUpgradedMock = (await upgrade()) as FoldingRegistryUpgradedMock

      expect(await foldingUpgradedMock.version()).to.be.equal(2)
    })

    it('cannot initialize twice', async () => {
      await expect(foldingUpgradedMock.initialize(fodlNFT.address)).to.be.revertedWith(
        'Initializable: contract is already initialized'
      )
    })

    it('updates functions', async () => {
      expect(await foldingUpgradedMock.newViewFunction()).to.be.equal(true)
    })

    it('allows new storage and behaves like V1', async () => {
      expect(await foldingUpgradedMock.newStorageVariable()).to.be.equal(ethers.constants.Zero)

      const random = Math.floor(Math.random()) * 5000
      await foldingUpgradedMock.setNewStorageVariable(ethers.BigNumber.from(random))

      expect((await foldingUpgradedMock.newStorageVariable()).toString()).to.be.equal(random.toString())
    })

    it('cannot receive ether', async function () {
      await expect(
        waffle.provider.getWallets()[0].sendTransaction({ to: foldingRegistry.address, value: 10 })
      ).to.be.revertedWith('FR13')
    })
  })

  describe('create account', () => {
    let owner = waffle.provider.getWallets()[0]
    let foldingAccountAddress: string

    before('deploy Fodl System', async () => {
      ;({ foldingRegistry } = await fixture())
    })

    it('should create new', async function () {
      foldingAccountAddress = await foldingRegistry.callStatic.createAccount()
      expect(foldingAccountAddress).to.not.equal(0)
      await expect(foldingRegistry.createAccount()).not.to.be.reverted
    })

    it('should set owner properly', async function () {
      expect(await foldingRegistry.callStatic.accountOwner(foldingAccountAddress)).to.equal(owner.address)
    })

    it('allows to predict new account address per owner', async function () {
      const [bob, alice] = await ethers.getSigners()

      const bobNextAccount = await foldingRegistry.connect(bob).callStatic.createAccount()
      const aliceNextAccount = await foldingRegistry.connect(alice).callStatic.createAccount()

      expect(bobNextAccount).not.equal(aliceNextAccount)

      // Create more accounts for alice
      await foldingRegistry.connect(alice).createAccount()
      await foldingRegistry.connect(alice).createAccount()
      await foldingRegistry.connect(alice).createAccount()
      await foldingRegistry.connect(bob).createAccount()

      expect(await foldingRegistry.callStatic.accountOwner(bobNextAccount)).to.equal(bob.address)
      expect(await foldingRegistry.callStatic.accountOwner(aliceNextAccount)).to.equal(alice.address)
    })

    it('transferring an account to another owner does not affect the prediction of new accounts', async function () {
      const [bob, alice] = await ethers.getSigners()

      const bobFirstAccountAddress = await foldingRegistry.connect(bob).callStatic.createAccount()
      await foldingRegistry.connect(bob).createAccount()

      const bobPredictedAccount = await foldingRegistry.connect(bob).callStatic.createAccount()

      const fodlNFT = FodlNFT__factory.connect(await foldingRegistry.connect(bob).fodlNFT(), bob)
      await fodlNFT.transferFrom(bob.address, alice.address, BigNumber.from(bobFirstAccountAddress))

      expect(await foldingRegistry.connect(bob).callStatic.createAccount()).to.equal(bobPredictedAccount)
    })

    it('can open with flashswap v3 connector', async () => {
      const [alice] = await ethers.getSigners()
      const _foldingRegistry = AllConnectors__factory.connect(foldingRegistry.address, alice)

      const account = await foldingRegistry.connect(alice).callStatic.createAccount()
      await sendToken(WETH.contract, alice.address)
      await WETH.contract.connect(alice).approve(account, ethers.constants.MaxUint256)

      const principalAmount = float2SolidityTokenAmount(WETH, 10)
      const supplyAmount = float2SolidityTokenAmount(WETH, 20)
      const { amountOut_BN: borrowAmount } = await getCompoundQuote(COMPOUND_PLATFORM, WETH, USDC, principalAmount)
      const tokenPath = [WETH, USDC]
      const feePath = [FeeAmount.MEDIUM]
      const path = encodePath(map(tokenPath, 'address'), feePath)
      await _foldingRegistry.increasePositionWithV3FlashswapMultihop({
        principalAmount,
        supplyAmount,
        maxBorrowAmount: borrowAmount.add(borrowAmount.div(100)),
        platform: COMPOUND_PLATFORM,
        supplyToken: WETH.address,
        borrowToken: USDC.address,
        path,
      })

      expect(await foldingRegistry.callStatic.accountOwner(account)).to.equal(alice.address)
    })
  })

  describe('implementations', () => {
    const contract1 = ethers.Wallet.createRandom()
    const contract2 = ethers.Wallet.createRandom()
    const signatures1 = ['0x11111111', '0x11110000']
    const signatures2 = ['0x22222222', signatures1[0]]

    it('should link signatures to implementation', async function () {
      await expect(foldingRegistry.addImplementation(contract1.address, signatures1))
        .to.emit(foldingRegistry, 'ImplementationAdded')
        .withArgs(contract1.address, signatures1)

      await Promise.all(
        signatures1.map(async (sig) => expect(await foldingRegistry.getImplementation(sig)).to.equal(contract1.address))
      )
    })

    it('should overwrite implementation for existing signatures', async function () {
      await expect(foldingRegistry.addImplementation(contract2.address, signatures2))
        .to.emit(foldingRegistry, 'ImplementationAdded')
        .withArgs(contract2.address, signatures2)

      await Promise.all(
        signatures1
          .filter((n) => !signatures2.includes(n))
          .map(async (sig) => expect(await foldingRegistry.getImplementation(sig)).to.equal(contract1.address))
      )

      await Promise.all(
        signatures2.map(async (sig) => expect(await foldingRegistry.getImplementation(sig)).to.equal(contract2.address))
      )
    })

    it('should remove implementation when it exists', async function () {
      await expect(foldingRegistry.removeImplementation(signatures2))
        .to.emit(foldingRegistry, 'ImplementationRemoved')
        .withArgs(signatures2)

      await expect(foldingRegistry.getImplementation(signatures2[0])).to.be.revertedWith('FR2')
    })

    it('should revert when FR2', async function () {
      await expect(foldingRegistry.getImplementation('0x12345622')).to.be.revertedWith('FR2')
    })
  })

  describe('platforms', () => {
    let [platform1, platform2, adapter1, adapter2] = waffle.provider.getWallets().slice(5)
    it('should add platform with adapter', async function () {
      await expect(foldingRegistry.addPlatformWithAdapter(platform1.address, adapter1.address))
        .to.emit(foldingRegistry, 'PlatformAdapterLinkUpdated')
        .withArgs(platform1.address, adapter1.address)
    })

    it('should revert when trying to add same platform twice', async function () {
      await expect(foldingRegistry.addPlatformWithAdapter(platform1.address, adapter1.address)).to.be.revertedWith(
        'FR3'
      )
    })

    it('should revert when trying to change platform adapter of non existent platform', async function () {
      await expect(foldingRegistry.changePlatformAdapter(platform2.address, adapter2.address)).to.be.revertedWith('FR5')
    })

    it('should change adapter for existing platform', async function () {
      await expect(foldingRegistry.changePlatformAdapter(platform1.address, adapter2.address))
        .to.emit(foldingRegistry, 'PlatformAdapterLinkUpdated')
        .withArgs(platform1.address, adapter2.address)
      expect(await foldingRegistry.callStatic.getPlatformAdapter(platform1.address)).to.equal(adapter2.address)
    })

    it('should revert when trying to remove non existing platform', async function () {
      await expect(foldingRegistry.removePlatform(platform2.address)).to.revertedWith('FR5')
    })

    it('should remove existing platform', async function () {
      await expect(foldingRegistry.removePlatform(platform1.address))
        .to.emit(foldingRegistry, 'PlatformAdapterLinkUpdated')
        .withArgs(platform1.address, ethers.constants.AddressZero)
    })

    it('should get platform adapter for given platform', async function () {
      await expect(foldingRegistry.addPlatformWithAdapter(platform1.address, adapter1.address))
        .to.emit(foldingRegistry, 'PlatformAdapterLinkUpdated')
        .withArgs(platform1.address, adapter1.address).to.not.be.reverted

      expect(await foldingRegistry.callStatic.getPlatformAdapter(platform1.address)).to.equal(adapter1.address)
    })

    it('should revert when lending adapter not found', async function () {
      await expect(foldingRegistry.callStatic.getPlatformAdapter(platform2.address)).to.be.revertedWith('FR6')
    })

    it('should add platforms for an adapter in a batch', async function () {
      const addresses: string[] = Array.from({ length: 10 }, () => ethers.Wallet.createRandom().address)

      await expect(foldingRegistry.addBatchPlatformsWithAdapter(addresses, platform1.address)).to.not.be.reverted

      addresses.forEach(async (platform) => {
        expect(await foldingRegistry.getPlatformAdapter(platform)).to.be.equal(platform1.address)
      })
    })

    it('should revert when no platforms passed to add in a batch', async function () {
      const addresses: string[] = []

      await expect(foldingRegistry.addBatchPlatformsWithAdapter(addresses, platform1.address)).to.be.revertedWith('FR4')
    })
  })

  describe('CToken', () => {
    let [platform, token, synthToken] = waffle.provider.getWallets()

    it('should add cToken to platform', async function () {
      await expect(foldingRegistry.addCTokenOnPlatform(platform.address, token.address, synthToken.address))
        .to.emit(foldingRegistry, 'TokenOnPlatformUpdated')
        .withArgs(platform.address, token.address, synthToken.address)
    })

    it('should get token from platform', async function () {
      expect(await foldingRegistry.callStatic.getCToken(platform.address, token.address)).to.equal(synthToken.address)
    })

    it('should revert when trying to add token that already exists on given platform', async function () {
      await expect(
        foldingRegistry.addCTokenOnPlatform(platform.address, token.address, synthToken.address)
      ).to.be.revertedWith('FR7')
    })

    it('should remove token from platform', async function () {
      await expect(foldingRegistry.removeCTokenFromPlatform(platform.address, token.address))
        .to.emit(foldingRegistry, 'TokenOnPlatformUpdated')
        .withArgs(platform.address, token.address, ethers.constants.AddressZero)
    })

    it('should revert when cToken mapping not found', async function () {
      await expect(foldingRegistry.getCToken(platform.address, token.address)).to.be.revertedWith('FR9')
    })

    it('should revert when trying to remove non existent token from platform', async function () {
      await expect(foldingRegistry.removeCTokenFromPlatform(platform.address, token.address)).to.be.revertedWith('FR8')
    })
  })

  describe('Exchanger', () => {
    let [adapter1, adapter2] = waffle.provider.getWallets()

    it('should add exchange with adapter', async function () {
      await expect(foldingRegistry.addExchangerWithAdapter('0x12', adapter1.address))
        .to.emit(foldingRegistry, 'ExchangerAdapterLinkUpdated')
        .withArgs('0x12', adapter1.address)
    })

    it('should revert when trying to add exchanger twice', async function () {
      await expect(foldingRegistry.addExchangerWithAdapter('0x12', adapter1.address)).to.be.revertedWith('FR10')
    })

    it('should get exchanger', async function () {
      expect(await foldingRegistry.callStatic.getExchangerAdapter('0x12')).to.equal(adapter1.address)
    })

    it('should revert when exchanger not found', async function () {
      await expect(foldingRegistry.getExchangerAdapter('0x14')).to.be.revertedWith('FR12')
    })

    it('should change exchanger for an existing flag', async function () {
      await expect(foldingRegistry.changeExchangerAdapter('0x11', adapter2.address)).to.be.revertedWith('FR11')

      await expect(foldingRegistry.changeExchangerAdapter('0x12', adapter2.address))
        .to.emit(foldingRegistry, 'ExchangerAdapterLinkUpdated')
        .withArgs('0x12', adapter2.address)
    })

    it('should remove exchanger', async function () {
      await expect(foldingRegistry.removeExchanger('0x12'))
        .to.emit(foldingRegistry, 'ExchangerAdapterLinkUpdated')
        .withArgs('0x12', ethers.constants.AddressZero)
    })

    it('should revert when trying to remove non existent exchanger', async function () {
      await expect(foldingRegistry.removeExchanger('0x12')).to.be.revertedWith('FR11')
    })
  })

  describe('Access Control', () => {
    let [ownerOriginal, otherOwner, testAccount] = waffle.provider.getWallets()

    it('only owner can modify configurations', async () => {
      await expect(
        foldingRegistry.connect(otherOwner).addImplementation(testAccount.address, ['0x12345678'])
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(foldingRegistry.connect(otherOwner).removeImplementation(['0x12345678'])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )

      await expect(
        foldingRegistry.connect(otherOwner).addPlatformWithAdapter(testAccount.address, testAccount.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        foldingRegistry.connect(otherOwner).changePlatformAdapter(testAccount.address, testAccount.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(foldingRegistry.connect(otherOwner).removePlatform(testAccount.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )

      await expect(
        foldingRegistry
          .connect(otherOwner)
          .addCTokenOnPlatform(testAccount.address, testAccount.address, testAccount.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        foldingRegistry.connect(otherOwner).removeCTokenFromPlatform(testAccount.address, testAccount.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        foldingRegistry.connect(otherOwner).addExchangerWithAdapter('0x12', testAccount.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        foldingRegistry.connect(otherOwner).changeExchangerAdapter('0x12', testAccount.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(foldingRegistry.connect(otherOwner).removeExchanger('0x12')).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })
})
