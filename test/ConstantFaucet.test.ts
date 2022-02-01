import { parseUnits } from '@ethersproject/units'
import { expect } from 'chai'
import { deployments, waffle, network, ethers } from 'hardhat'
import { SSS_REWARDS_START_TIME, STAKING_TREASURY_ADDRESS } from '../constants/deploy'
import { ConstantFaucet, ConstantFaucet__factory, FodlSingleSidedStaking, FodlToken } from '../typechain'

const REWARDS_AMOUNT = parseUnits('50000000')

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture(['ConstantFaucet'])

  const fodlToken = (await ethers.getContract('FodlToken')) as FodlToken
  const staking = (await ethers.getContract('FodlSingleSidedStaking')) as FodlSingleSidedStaking
  const faucet = (await ethers.getContract('ConstantFaucet')) as ConstantFaucet

  fodlToken.transfer(STAKING_TREASURY_ADDRESS, REWARDS_AMOUNT)

  return { fodlToken, staking, faucet }
})

describe('ConstantFaucet', () => {
  let faucet: ConstantFaucet, fodlToken: FodlToken, staking: FodlSingleSidedStaking
  const DURATION = 94608000

  before(async () => {
    ;({ faucet, fodlToken, staking } = await fixture())
  })

  describe('Constructor & Settings', () => {
    it('should set fodl token on constructor', async () => {
      expect(await faucet.fodl()).to.be.equal(fodlToken.address)
    })

    it('should set treasury token on constructor', async () => {
      expect(await faucet.treasury()).to.be.equal(STAKING_TREASURY_ADDRESS)
    })

    it('should set lastUpdateTime to startTime', async () => {
      expect((await faucet.lastUpdateTime()).toNumber()).to.be.equal(SSS_REWARDS_START_TIME)
    })

    it('should set finishTime to startTime + 3 years', async () => {
      expect((await faucet.finishTime()).toNumber()).to.be.equal(SSS_REWARDS_START_TIME + DURATION)
    })

    it('should set target on constructor', async () => {
      expect(await faucet.target()).to.be.equal(staking.address)
    })
  })

  describe('distributeFodl', () => {
    it('cannot distribute fodl before startTime', async () => {
      await network.provider.request({
        method: 'evm_setNextBlockTimestamp',
        params: [SSS_REWARDS_START_TIME - 1],
      })
      await expect(faucet.distributeFodl()).to.be.revertedWith('SafeMath: subtraction overflow')
    })

    it('cannot distribute fodl without approval from treasury', async () => {
      await network.provider.request({
        method: 'evm_setNextBlockTimestamp',
        params: [SSS_REWARDS_START_TIME + 10],
      })
      await expect(faucet.distributeFodl()).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
    })

    it('can distribute fodl with approval from treasury', async () => {
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [STAKING_TREASURY_ADDRESS],
      })
      await fodlToken
        .connect(ethers.provider.getSigner(STAKING_TREASURY_ADDRESS))
        .approve(faucet.address, REWARDS_AMOUNT)

      const delta1 = 100
      const time1 = SSS_REWARDS_START_TIME + delta1
      await network.provider.request({
        method: 'evm_setNextBlockTimestamp',
        params: [time1],
      })

      await expect(() => faucet.distributeFodl()).to.changeTokenBalance(
        fodlToken,
        staking,
        REWARDS_AMOUNT.mul(delta1).div(DURATION)
      )

      const delta2 = 300
      const time2 = time1 + delta2
      await network.provider.request({
        method: 'evm_setNextBlockTimestamp',
        params: [time2],
      })

      await expect(() => faucet.distributeFodl()).to.changeTokenBalance(
        fodlToken,
        staking,
        REWARDS_AMOUNT.mul(delta2).div(DURATION)
      )
    })

    it('cannot distribute fodl after finishTime', async () => {
      await network.provider.request({
        method: 'evm_setNextBlockTimestamp',
        params: [SSS_REWARDS_START_TIME + DURATION],
      })
      await expect(faucet.distributeFodl()).to.be.revertedWith('Faucet expired!')
    })
  })
})
