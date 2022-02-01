import { MockContract } from '@ethereum-waffle/mock-contract'
import { expect } from 'chai'
import { utils } from 'ethers'
import { ethers, network, waffle } from 'hardhat'
import { ONE_DAY_SECONDS, STAKING_EPOCH_DURATION_SEC } from '../constants/deploy'
import { ERC20__factory, LPStaking, LPStaking__factory } from '../typechain'
import { currentTime, fastForward, mine } from './shared/utils'
const { deployContract, deployMockContract } = waffle

describe('staking', () => {
  let rewardToken: MockContract, stakingToken: MockContract, staking: LPStaking
  const signer = waffle.provider.getWallets()[0]
  const alice = waffle.provider.getWallets()[2]

  before(async () => {
    rewardToken = await deployMockContract(signer, ERC20__factory.abi)
    await rewardToken.mock.balanceOf.returns(ethers.constants.MaxUint256)

    stakingToken = await deployMockContract(signer, ERC20__factory.abi)
    await stakingToken.mock.transferFrom.returns(true)

    staking = (await deployContract(signer, LPStaking__factory, [
      rewardToken.address,
      stakingToken.address,
      STAKING_EPOCH_DURATION_SEC,
    ])) as LPStaking
  })

  describe('Constructor & Settings', () => {
    it('should set rewards token on constructor', async () => {
      expect(await staking.rewardsToken()).to.be.equal(rewardToken.address)
    })

    it('should set staking token on constructor', async () => {
      expect(await staking.stakingToken()).to.be.equal(stakingToken.address)
    })

    it('should set rewards duration on constructor', async () => {
      expect(await staking.rewardsDuration()).to.be.equal(STAKING_EPOCH_DURATION_SEC)
    })

    it('should set owner on constructor', async () => {
      expect(await staking.owner()).to.be.equal(signer.address)
    })
  })

  describe('Pausable', async () => {
    it('should revert calling stake() when paused', async () => {
      await staking.pauseStaking()
      await expect(staking.stake(utils.parseEther('100'))).to.be.revertedWith('Pausable: paused')
    })

    it('should not revert calling stake() when unpaused', async () => {
      await staking.unpauseStaking()
      await expect(staking.stake(utils.parseEther('100'))).to.not.be.reverted
    })
  })

  describe('External Rewards Recovery', () => {
    it('should revert if recovering staking token', async () => {
      await expect(staking.recoverERC20(stakingToken.address, 100000)).to.be.revertedWith(
        'Cannot withdraw the staking token'
      )
    })
    it('should retrieve external token from staking and reduce contracts balance', async () => {
      await rewardToken.mock.transfer.returns(true)
      await expect(staking.recoverERC20(rewardToken.address, 100000)).to.not.be.reverted
    })
  })

  describe('lastTimeRewardApplicable()', () => {
    it('should return 0 before any interaction', async () => {
      expect(await staking.lastTimeRewardApplicable()).to.be.equal(ethers.BigNumber.from(0))
    })

    describe('when updated', () => {
      it('should equal current timestamp', async () => {
        await staking.notifyRewardAmount(10000)

        const cur = await currentTime()

        const lastTimeReward = await staking.lastTimeRewardApplicable()

        expect(cur.toString()).to.be.equal(lastTimeReward.toString())
      })
    })
  })

  describe('rewardPerToken()', () => {
    it('should return 0', async () => {
      expect(await staking.rewardPerToken()).to.be.equal(ethers.BigNumber.from(0))
    })

    it('should be > 0', async () => {
      await staking.stake(utils.parseEther('1231231'))

      const totalSupply = await staking.totalSupply()
      expect(totalSupply.gt(0)).true

      await staking.notifyRewardAmount(utils.parseEther('1231231'))

      await fastForward(ONE_DAY_SECONDS)

      const rewardPerToken = await staking.rewardPerToken()
      expect(rewardPerToken.gt(0)).true
    })
  })

  describe('stake()', () => {
    it('staking increases staking balance', async () => {
      const totalToStake = utils.parseEther('1231231')

      const initialStakeBal = await staking.balanceOf(alice.address)

      await staking.connect(alice).stake(totalToStake)

      const postStakeBal = await staking.balanceOf(alice.address)

      expect(postStakeBal.gt(initialStakeBal)).true
    })

    it('cannot stake 0', async () => {
      await expect(staking.stake('0')).to.be.revertedWith('Cannot stake 0')
    })
  })

  describe('freshState', async () => {
    beforeEach(async () => {
      rewardToken = await deployMockContract(signer, ERC20__factory.abi)
      await rewardToken.mock.balanceOf.returns(ethers.constants.MaxUint256)
      await rewardToken.mock.transfer.returns(true)

      stakingToken = await deployMockContract(signer, ERC20__factory.abi)
      await stakingToken.mock.transferFrom.returns(true)
      await stakingToken.mock.transfer.returns(true)

      staking = (await deployContract(signer, LPStaking__factory, [
        rewardToken.address,
        stakingToken.address,
        STAKING_EPOCH_DURATION_SEC,
      ])) as LPStaking
    })
    describe('earned()', () => {
      it('should be 0 when not staking', async () => {
        expect(await staking.earned(alice.address)).to.be.equal(ethers.BigNumber.from(0))
      })

      it('should be > 0 when staking', async () => {
        const totalToStake = utils.parseEther('1231231')

        await staking.connect(alice).stake(totalToStake)

        await staking.notifyRewardAmount(utils.parseEther('10000'))

        await fastForward(ONE_DAY_SECONDS)

        const earned = await staking.earned(alice.address)

        expect(earned.isZero()).false
      })

      it('rewardRate should increase if new rewards come before DURATION ends', async () => {
        const totalToDistribute = utils.parseEther('5000')

        await staking.notifyRewardAmount(totalToDistribute)

        const rewardRateInitial = await staking.rewardRate()

        await staking.notifyRewardAmount(totalToDistribute)

        const rewardRateLater = await staking.rewardRate()

        expect(rewardRateLater.gt(rewardRateInitial)).true
      })

      it('rewards token balance should rollover after DURATION', async () => {
        const totalToStake = utils.parseEther('100')
        const totalToDistribute = utils.parseEther('5000')

        await staking.connect(alice).stake(totalToStake)

        await staking.notifyRewardAmount(totalToDistribute)

        await fastForward(STAKING_EPOCH_DURATION_SEC + 10)
        const earnedFirst = await staking.earned(alice.address)

        await staking.notifyRewardAmount(totalToDistribute)

        await fastForward(STAKING_EPOCH_DURATION_SEC + 10)
        const earnedSecond = await staking.earned(alice.address)

        expect(earnedSecond).to.be.equal(earnedFirst.add(earnedFirst))
      })
    })

    describe('getReward()', () => {
      it('should increase rewards token balance', async () => {
        const totalToStake = utils.parseEther('100')
        const totalToDistribute = utils.parseEther('5000')

        await staking.connect(alice).stake(totalToStake)

        await staking.notifyRewardAmount(totalToDistribute)

        await fastForward(STAKING_EPOCH_DURATION_SEC + 10)

        const lol = await staking.earned(alice.address)
        await rewardToken.mock.transfer.withArgs(alice.address, lol).returns(true)

        await expect(staking.connect(alice).getReward()).to.not.be.reverted
      })
    })

    describe('setRewardsDuration()', () => {
      const sevenDays = ONE_DAY_SECONDS * 7
      const seventyDays = ONE_DAY_SECONDS * 70
      it('should increase rewards duration before starting distribution', async () => {
        await staking.setRewardsDuration(seventyDays)
        const newDuration = await staking.rewardsDuration()
        expect(newDuration).to.be.equal(seventyDays)
      })

      it('should revert when setting setRewardsDuration before the period has finished', async () => {
        const totalToStake = utils.parseEther('100')
        const totalToDistribute = utils.parseEther('5000')

        await staking.stake(totalToStake)

        await staking.notifyRewardAmount(totalToDistribute)

        await fastForward(ONE_DAY_SECONDS)

        await expect(staking.setRewardsDuration(seventyDays)).to.be.revertedWith(
          'Previous rewards period must be complete before changing the duration for the new period'
        )
      })

      it('should update when setting setRewardsDuration after the period has finished', async () => {
        const totalToStake = utils.parseEther('100')
        const totalToDistribute = utils.parseEther('5000')

        await staking.stake(totalToStake)

        await staking.notifyRewardAmount(totalToDistribute)

        await fastForward(ONE_DAY_SECONDS * 8)

        await expect(staking.setRewardsDuration(seventyDays))
          .to.emit(staking, 'RewardsDurationUpdated')
          .withArgs(seventyDays)
      })

      it('should update when setting setRewardsDuration after the period has finished', async () => {
        const totalToStake = utils.parseEther('100')
        const totalToDistribute = utils.parseEther('5000')

        await staking.stake(totalToStake)

        await staking.notifyRewardAmount(totalToDistribute)

        await fastForward(ONE_DAY_SECONDS * 4)
        await staking.getReward()
        await fastForward(ONE_DAY_SECONDS * 4)

        // New Rewards period much lower
        await expect(staking.setRewardsDuration(seventyDays))
          .to.emit(staking, 'RewardsDurationUpdated')
          .withArgs(seventyDays)
      })
    })

    describe('getRewardForDuration()', () => {
      it('should increase rewards token balance', async () => {
        const totalToDistribute = utils.parseEther('5000')
        await staking.notifyRewardAmount(totalToDistribute)

        const rewardForDuration = await staking.getRewardForDuration()

        const duration = await staking.rewardsDuration()
        const rewardRate = await staking.rewardRate()

        expect(rewardForDuration.isZero()).false
        expect(rewardForDuration.eq(duration.mul(rewardRate))).true
      })
    })

    describe('withdraw()', () => {
      it('cannot withdraw if nothing staked', async () => {
        await expect(staking.withdraw(utils.parseEther('100'))).to.be.revertedWith('SafeMath: subtraction overflow')
      })

      it('should increases lp token balance and decreases staking balance', async () => {
        const totalToStake = utils.parseEther('100')

        await staking.stake(totalToStake)

        await expect(staking.withdraw(totalToStake))
          .to.emit(staking, 'Withdrawn')
          .withArgs(signer.address, totalToStake)
      })

      it('cannot withdraw 0', async () => {
        await expect(staking.withdraw('0')).to.be.revertedWith('Cannot withdraw 0')
      })
    })

    describe('exit()', () => {
      it('should retrieve all earned and increase rewards bal', async () => {
        const totalToStake = utils.parseEther('100')

        await staking.stake(totalToStake)

        await staking.notifyRewardAmount(utils.parseEther('5000.0'))

        await fastForward(ONE_DAY_SECONDS)
        await expect(staking.exit()).to.emit(staking, 'RewardPaid')
      })
    })
  })
})
