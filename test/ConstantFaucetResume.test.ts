import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { ConstantFaucet, ConstantFaucetResume } from '../typechain'

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture(['UpgradeStakingTreasury'])

  const faucet = (await ethers.getContract('ConstantFaucet')) as ConstantFaucet
  const faucetResume = (await ethers.getContract('ConstantFaucetResume')) as ConstantFaucetResume

  return { faucet, faucetResume }
})

describe('ConstantFaucetResume', () => {
  let faucetResume: ConstantFaucetResume, faucet: ConstantFaucet

  before(async () => {
    ;({ faucet, faucetResume } = await fixture())
  })

  describe('Constructor & Settings', () => {
    it('fodl address is copied from previous faucet', async () => {
      expect(await faucetResume.fodl()).to.be.equal(await faucet.fodl())
    })

    it('treasury address is copied from previous faucet', async () => {
      expect(await faucetResume.treasury()).to.be.equal(await faucet.treasury())
    })

    it('lastUpdateTime is copied from previous faucet', async () => {
      expect(await faucetResume.lastUpdateTime()).to.be.equal(await faucet.lastUpdateTime())
    })

    it('finishTime is copied from previous faucet', async () => {
      expect(await faucetResume.finishTime()).to.be.equal(await faucet.finishTime())
    })

    it('target address is copied from previous faucet', async () => {
      expect(await faucetResume.target()).to.be.equal(await faucet.target())
    })
  })

  describe('changeTreasury', () => {
    it('only current treasury can change treasury', async () => {
      const randomAddress = ethers.Wallet.createRandom().address
      await expect(faucetResume.changeTreasury(randomAddress)).to.be.revertedWith('Only treasury allowed to call!')

      const treasuryAddress = await faucet.treasury()
      await network.provider.send('hardhat_impersonateAccount', [treasuryAddress])
      const treasury = await ethers.getSigner(treasuryAddress)

      await expect(faucetResume.connect(treasury).changeTreasury(randomAddress)).to.not.be.reverted
    })
  })
})
