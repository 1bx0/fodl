import { MockContract } from '@ethereum-waffle/mock-contract'
import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { ERC20__factory, LPStakingAutomation, LPStakingAutomation__factory, LPStaking__factory } from '../typechain'
import { currentTime } from './shared/utils'

const { deployContract, deployMockContract } = waffle

const HOUR = 60 * 60
const getRewardAmount = (x: number) => {
  x++
  const rewardEquation = (746.827165404148 * (1200 - x) * Math.pow(1 + x, -Math.exp(1) / 10)) / 2
  const rewardAmount = Math.round(rewardEquation)
  return ethers.utils.parseUnits(rewardAmount.toString())
}

describe('LPstakingAutomation', () => {
  const [signer, treasury, alice] = waffle.provider.getWallets()

  let rewardNumber = 0

  let token: MockContract,
    automation: LPStakingAutomation,
    ethFodlLPStaking: MockContract,
    usdcFodlLPStaking: MockContract

  before(async () => {
    ethFodlLPStaking = await deployMockContract(signer, LPStaking__factory.abi)
    usdcFodlLPStaking = await deployMockContract(signer, LPStaking__factory.abi)
    token = await deployMockContract(signer, ERC20__factory.abi)

    automation = (await deployContract(signer, LPStakingAutomation__factory, [
      token.address,
      treasury.address,
      ethFodlLPStaking.address,
      usdcFodlLPStaking.address,
      rewardNumber,
    ])) as LPStakingAutomation
  })

  describe('Constructor & Settings', () => {
    it('should set fodl token on constructor', async () => {
      expect(await automation.fodlToken()).to.be.equal(token.address)
    })

    it('should set treasury on constructor', async () => {
      expect(await automation.treasury()).to.be.equal(treasury.address)
    })

    it('should set fodlEthSLPStaking on constructor', async () => {
      expect(await automation.fodlEthSLPStaking()).to.be.equal(ethFodlLPStaking.address)
    })

    it('should set fodlUsdcSLPStaking on constructor', async () => {
      expect(await automation.fodlUsdcSLPStaking()).to.be.equal(usdcFodlLPStaking.address)
    })

    it('should set rewardNumber on constructor', async () => {
      expect((await automation.rewardNumber()).toNumber()).to.be.equal(rewardNumber)
    })
  })

  describe('notifyRewards', () => {
    it('cannot distribute fodl more than an hour before periodFinish', async () => {
      await ethFodlLPStaking.mock.periodFinish.returns((await currentTime()) + 1.5 * HOUR)
      await usdcFodlLPStaking.mock.periodFinish.returns((await currentTime()) + 1.5 * HOUR)

      await expect(automation.notifyRewards()).to.be.revertedWith('Too early to send rewards')
    })

    it('cannot distribute fodl more than 12 hours after periodFinish', async () => {
      await ethFodlLPStaking.mock.periodFinish.returns((await currentTime()) - 12.5 * HOUR)
      await usdcFodlLPStaking.mock.periodFinish.returns((await currentTime()) - 12.5 * HOUR)

      await expect(automation.notifyRewards()).to.be.revertedWith('Too late to send rewards')
    })

    it('cannot distribute fodl due to fodl transfer issue', async () => {
      await ethFodlLPStaking.mock.periodFinish.returns((await currentTime()) + 15)
      await usdcFodlLPStaking.mock.periodFinish.returns((await currentTime()) - 600)

      const reason = 'Some random reason'
      await token.mock.transferFrom.revertsWithReason(reason)

      await expect(automation.notifyRewards()).to.be.revertedWith(reason)
    })

    it('cannot distribute fodl due to revert in notifyRewardAmount on staking contract', async () => {
      await ethFodlLPStaking.mock.periodFinish.returns((await currentTime()) + 15)
      await usdcFodlLPStaking.mock.periodFinish.returns((await currentTime()) - 600)

      await token.mock.transferFrom.returns(true)

      const reason = 'Some weird reason in staking contract'
      await ethFodlLPStaking.mock.notifyRewardAmount.revertsWithReason(reason)
      await usdcFodlLPStaking.mock.notifyRewardAmount.revertsWithReason(reason)

      await expect(automation.notifyRewards()).to.be.revertedWith(reason)
    })

    it('distributes the right amount of fodl for given epoch', async () => {
      await ethFodlLPStaking.mock.periodFinish.returns((await currentTime()) + 15)
      await usdcFodlLPStaking.mock.periodFinish.returns((await currentTime()) - 600)

      await token.mock.transferFrom.revertsWithReason('Not initialised for exact parameters')

      await ethFodlLPStaking.mock.notifyRewardAmount.returns()
      await usdcFodlLPStaking.mock.notifyRewardAmount.returns()

      for (let rewardNumber = 0; rewardNumber < 156; rewardNumber += 1) {
        const expectedAmount = getRewardAmount(rewardNumber)

        await token.mock.transferFrom.withArgs(treasury.address, ethFodlLPStaking.address, expectedAmount).returns(true)
        await token.mock.transferFrom
          .withArgs(treasury.address, usdcFodlLPStaking.address, expectedAmount)
          .returns(true)

        await expect(automation.notifyRewards()).to.not.be.reverted
      }
    })
  })

  describe('transferLPStakingOwnership', () => {
    it('reverts on error in transferOwnership', async () => {
      const reason = 'some reason'
      await ethFodlLPStaking.mock.transferOwnership.revertsWithReason(reason)
      await usdcFodlLPStaking.mock.transferOwnership.revertsWithReason(reason)

      await expect(automation.transferLPStakingOwnership(ethFodlLPStaking.address, alice.address)).to.be.revertedWith(
        reason
      )
      await expect(automation.transferLPStakingOwnership(usdcFodlLPStaking.address, alice.address)).to.be.revertedWith(
        reason
      )
    })

    it('only runs if called by owner', async () => {
      await ethFodlLPStaking.mock.transferOwnership.returns()
      await usdcFodlLPStaking.mock.transferOwnership.returns()

      await expect(
        automation.connect(alice).transferLPStakingOwnership(ethFodlLPStaking.address, alice.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
      await expect(
        automation.connect(alice).transferLPStakingOwnership(usdcFodlLPStaking.address, alice.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('can set transferOwnership', async () => {
      await ethFodlLPStaking.mock.transferOwnership.returns()
      await usdcFodlLPStaking.mock.transferOwnership.returns()

      await expect(automation.transferLPStakingOwnership(ethFodlLPStaking.address, alice.address)).to.not.be.reverted
      await expect(automation.transferLPStakingOwnership(usdcFodlLPStaking.address, alice.address)).to.not.be.reverted
    })
  })
})
