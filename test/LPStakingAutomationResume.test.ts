import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { LPStakingAutomation, LPStakingAutomationResume } from '../typechain'

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture(['UpgradeStakingTreasury'])

  const automation = (await ethers.getContract('LPStakingAutomation')) as LPStakingAutomation
  const automationResume = (await ethers.getContract('LPStakingAutomationResume')) as LPStakingAutomationResume

  return { automation, automationResume }
})

describe('LPStakingAutomationResume', () => {
  let automationResume: LPStakingAutomationResume, automation: LPStakingAutomation

  before(async () => {
    ;({ automation, automationResume } = await fixture())
  })

  describe('Constructor & Settings', () => {
    it('fodl address is copied from previous automation', async () => {
      expect(await automationResume.fodlToken()).to.be.equal(await automation.fodlToken())
    })

    it('treasury address is copied from previous automation', async () => {
      expect(await automationResume.treasury()).to.be.equal(await automation.treasury())
    })

    it('fodlUsdcSLPStaking is copied from previous automation', async () => {
      expect(await automationResume.fodlUsdcSLPStaking()).to.be.equal(await automation.fodlUsdcSLPStaking())
    })

    it('fodlEthSLPStaking is copied from previous automation', async () => {
      expect(await automationResume.fodlEthSLPStaking()).to.be.equal(await automation.fodlEthSLPStaking())
    })

    it('rewardNumber is copied from previous automation', async () => {
      expect(await automationResume.rewardNumber()).to.be.equal(await automation.rewardNumber())
    })
  })

  describe('changeTreasury', () => {
    it('only current treasury can change treasury', async () => {
      const randomAddress = ethers.Wallet.createRandom().address
      await expect(automationResume.changeTreasury(randomAddress)).to.be.revertedWith('Only treasury allowed to call!')

      const treasuryAddress = await automation.treasury()
      await network.provider.send('hardhat_impersonateAccount', [treasuryAddress])
      const treasury = await ethers.getSigner(treasuryAddress)

      await expect(automationResume.connect(treasury).changeTreasury(randomAddress)).to.not.be.reverted
    })
  })
})
