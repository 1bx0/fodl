import { MockContract } from '@ethereum-waffle/mock-contract'
import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import {
  ERC20__factory,
  LPStakingAutomation,
  LPStakingAutomationResumeV2,
  LPStakingAutomationResumeV2__factory,
  LPStakingAutomation__factory,
  LPStaking__factory,
} from '../typechain'

const { deployContract, deployMockContract } = waffle

const HOUR = 60 * 60
const getRewardAmount = (x: number) => {
  x++
  const rewardEquation = (746.827165404148 * (1200 - x) * Math.pow(1 + x, -Math.exp(1) / 10)) / 2
  const rewardAmount = Math.round(rewardEquation)
  return ethers.utils.parseUnits(rewardAmount.toString())
}

const getTimestamp = (x: number) => {
  return new Date('2021-10-28').getTime() / 1000 + x * 7 * 24 * HOUR
}

const getLastBlockTimestamp = async () => (await ethers.provider.getBlock('latest')).timestamp

const getCurrentRewardNumber = async () => {
  const timestamp = await getLastBlockTimestamp()
  const index = Array.from<number>({ length: 164 }).findIndex((_, i) => {
    return getTimestamp(i) > timestamp
  })
  if (index == -1) throw 'all rewards paid'
  return index
}

describe('LPStakingAutomationV2', () => {
  const [signer, treasury, alice] = waffle.provider.getWallets()

  const startRewardNumber = 0
  const endRewardNumber = 163

  let token: MockContract,
    previous: LPStakingAutomation,
    automation: LPStakingAutomationResumeV2,
    ethFodlLPStaking: MockContract,
    usdcFodlLPStaking: MockContract

  const freshSystem = async () => {
    ethFodlLPStaking = await deployMockContract(signer, LPStaking__factory.abi)
    usdcFodlLPStaking = await deployMockContract(signer, LPStaking__factory.abi)
    token = await deployMockContract(signer, ERC20__factory.abi)

    previous = (await deployContract(signer, LPStakingAutomation__factory, [
      token.address,
      treasury.address,
      ethFodlLPStaking.address,
      usdcFodlLPStaking.address,
      startRewardNumber,
    ])) as LPStakingAutomation

    automation = (await deployContract(signer, LPStakingAutomationResumeV2__factory, [
      previous.address,
    ])) as LPStakingAutomationResumeV2
  }

  describe('Constructor & Settings', () => {
    before(freshSystem)

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
      expect((await automation.rewardNumber()).toNumber()).to.be.equal(startRewardNumber)
    })
  })

  describe('notifyRewards', () => {
    before(async () => {
      const rewardNumber = await getCurrentRewardNumber()
      await ethers.provider.send('evm_setNextBlockTimestamp', [getTimestamp(rewardNumber) + 1])
      await ethers.provider.send('evm_mine', [])

      await freshSystem()
    })

    it('cannot distribute fodl due to fodl transfer issue', async () => {
      const reason = 'Some random reason'
      await token.mock.transferFrom.revertsWithReason(reason)

      await expect(automation.notifyRewards()).to.be.revertedWith(reason)
    })

    it('cannot distribute fodl due to revert in notifyRewardAmount on staking contract', async () => {
      await token.mock.transferFrom.returns(true)

      const reason = 'Some weird reason in staking contract'
      await ethFodlLPStaking.mock.notifyRewardAmount.revertsWithReason(reason)
      await usdcFodlLPStaking.mock.notifyRewardAmount.revertsWithReason(reason)

      await expect(automation.notifyRewards()).to.be.revertedWith(reason)
    })

    it('distributes the right amount of fodl for the first rewards number', async () => {
      const last = await getCurrentRewardNumber()
      for (let i = startRewardNumber; i < last!; i++) {
        const amount = getRewardAmount(i)
        await token.mock.transferFrom.withArgs(treasury.address, ethFodlLPStaking.address, amount).returns(true)
        await token.mock.transferFrom.withArgs(treasury.address, ethFodlLPStaking.address, amount).returns(true)
      }

      await ethFodlLPStaking.mock.notifyRewardAmount.returns()
      await usdcFodlLPStaking.mock.notifyRewardAmount.returns()

      await expect(automation.notifyRewards()).to.not.be.reverted
    })

    it('cannot call too early', async () => {
      await token.mock.transferFrom.returns(true)

      await ethFodlLPStaking.mock.notifyRewardAmount.returns()
      await usdcFodlLPStaking.mock.notifyRewardAmount.returns()

      await expect(automation.notifyRewards()).to.be.revertedWith('Too early to call')
    })

    it('distributes the right amounts multiple periods at once', async () => {
      await ethers.provider.send('evm_setNextBlockTimestamp', [getTimestamp(startRewardNumber + 10) + 1])
      await ethers.provider.send('evm_mine', [])

      const last = await getCurrentRewardNumber()
      for (let i = startRewardNumber; i < last!; i++) {
        const amount = getRewardAmount(i)
        await token.mock.transferFrom.withArgs(treasury.address, ethFodlLPStaking.address, amount).returns(true)
        await token.mock.transferFrom.withArgs(treasury.address, ethFodlLPStaking.address, amount).returns(true)
      }

      await ethFodlLPStaking.mock.notifyRewardAmount.returns()
      await usdcFodlLPStaking.mock.notifyRewardAmount.returns()

      await expect(automation.notifyRewards()).to.not.be.reverted
    })

    it('distributes for all periods', async () => {
      await ethers.provider.send('evm_setNextBlockTimestamp', [getTimestamp(startRewardNumber + 164) + 1])
      await ethers.provider.send('evm_mine', [])

      await token.mock.transferFrom.returns(true)

      await ethFodlLPStaking.mock.notifyRewardAmount.returns()
      await usdcFodlLPStaking.mock.notifyRewardAmount.returns()

      await expect(automation.notifyRewards()).to.not.be.reverted // first time should work
      await expect(automation.notifyRewards()).to.be.revertedWith('Rewards ended!') // afterwards there are no more rewards to be paid
    })
  })
})
