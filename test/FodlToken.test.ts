import { expect } from 'chai'
import { deployMockContract } from 'ethereum-waffle'
import { deployments, waffle } from 'hardhat'
import { FODL_TOKEN_INITIAL_AMOUNT } from '../constants/deploy'
import { FodlToken, IERC677Receiver__factory } from '../typechain'

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture(['FodlToken'])

  const fodlToken = (await ethers.getContract('FodlToken')) as FodlToken
  return { fodlToken }
})

describe('FodlToken', () => {
  const [wallet, walletTo] = waffle.provider.getWallets()
  let fodlToken: FodlToken

  beforeEach(async () => {
    ;({ fodlToken } = await fixture())
  })

  it('Assigns initial balance', async () => {
    expect(await fodlToken.balanceOf(wallet.address)).to.equal(FODL_TOKEN_INITIAL_AMOUNT)
  })

  it('Transfer adds amount to destination account', async () => {
    await fodlToken.transfer(walletTo.address, 7)
    expect(await fodlToken.balanceOf(walletTo.address)).to.equal(7)
  })

  it('Transfer emits event', async () => {
    await expect(fodlToken.transfer(walletTo.address, 7))
      .to.emit(fodlToken, 'Transfer')
      .withArgs(wallet.address, walletTo.address, 7)
  })

  it('Cannot transfer above the amount', async () => {
    await expect(fodlToken.transfer(walletTo.address, FODL_TOKEN_INITIAL_AMOUNT.add(1))).to.be.reverted
  })

  it('Cannot transfer from empty account', async () => {
    const fodlTokenFromOtherWallet = fodlToken.connect(walletTo)
    await expect(fodlTokenFromOtherWallet.transfer(wallet.address, 1)).to.be.reverted
  })

  it('Can transferAndCall when receiver is contract', async () => {
    const mockContract = await deployMockContract(wallet, IERC677Receiver__factory.abi)
    const transferData = '0x1234'
    const transferAmount = 100
    await mockContract.mock.onTokenTransfer.withArgs(wallet.address, transferAmount, transferData).returns()
    await expect(fodlToken.transferAndCall(mockContract.address, transferAmount, transferData))
      .to.emit(fodlToken, 'TransferAndCall')
      .withArgs(wallet.address, mockContract.address, transferAmount, transferData)
  })

  it('Can transferAndCall when received is not contract', async () => {
    const transferData = '0x1234'
    const transferAmount = 100
    await expect(fodlToken.transferAndCall(walletTo.address, transferAmount, transferData))
      .to.emit(fodlToken, 'TransferAndCall')
      .withArgs(wallet.address, walletTo.address, transferAmount, transferData)
  })
})
