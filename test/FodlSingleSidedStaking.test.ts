import { expect } from 'chai'
import { deployments, ethers, waffle } from 'hardhat'
import { FodlSingleSidedStaking, FodlToken } from '../typechain'

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture(['FodlSingleSidedStaking'])

  const fodlToken = (await ethers.getContract('FodlToken')) as FodlToken
  const staking = (await ethers.getContract('FodlSingleSidedStaking')) as FodlSingleSidedStaking
  return { fodlToken, staking }
})

describe('FodlSingleSidedStaking', () => {
  let [wallet0, wallet1, wallet2] = waffle.provider.getWallets()
  let fodlToken: FodlToken, staking: FodlSingleSidedStaking

  describe('token()', () => {
    it('returns the token address', async () => {
      ;({ fodlToken, staking } = await fixture())
      expect(await staking.fodlToken()).to.eq(fodlToken.address)
    })
  })

  describe('stake(amount)', () => {
    beforeEach(async () => {
      ;({ fodlToken, staking } = await fixture())
    })

    it('allows user to stake via approve and call when no stakes exist', async () => {
      const amount = ethers.utils.parseUnits('100')
      await fodlToken.approve(staking.address, amount)
      await expect(() => staking.stake(amount)).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount.mul(-1), amount]
      )
      expect(await staking.balanceOf(wallet0.address)).eq(amount)
    })

    it('blocks direct calls to onTokenTransfer', async () => {
      await expect(staking.onTokenTransfer(wallet0.address, 10000, '0x')).to.be.revertedWith(
        'Only accepting FODL transfers.'
      )
    })

    it('allows user to stake via transferAndCall when no stakes exist', async () => {
      const amount = ethers.utils.parseUnits('100')
      await expect(() => fodlToken.transferAndCall(staking.address, amount, '0x')).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount.mul(-1), amount]
      )
      expect(await staking.balanceOf(wallet0.address)).eq(amount)
    })

    it('allows user to stake via transferAndCall when stakes exist and no rewards sent', async () => {
      const amount = ethers.utils.parseUnits('300')
      await fodlToken.transferAndCall(staking.address, amount, '0x')
      await expect(() => fodlToken.transferAndCall(staking.address, amount, '0x')).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount.mul(-1), amount]
      )
      expect(await staking.balanceOf(wallet0.address)).eq(amount.mul(2))
    })

    it('allows user to stake via approve and call when stakes exist and no rewards sent', async () => {
      const amount = ethers.utils.parseUnits('300')
      await fodlToken.approve(staking.address, amount)
      await expect(() => staking.stake(amount)).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount.mul(-1), amount]
      )
      expect(await staking.balanceOf(wallet0.address)).eq(amount)
    })

    it('allows user to stake via approve and call when stakes exist and no rewards were sent', async () => {
      const amount = ethers.utils.parseUnits('300')
      await fodlToken.transferAndCall(staking.address, amount, '0x')

      await fodlToken.approve(staking.address, amount)
      await expect(() => staking.stake(amount)).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount.mul(-1), amount]
      )
      expect(await staking.callStatic.unstake(await staking.balanceOf(wallet0.address))).eq(amount.mul(2))
    })

    it('allows user to stake via transferAndCall when stakes exist and rewards were sent', async () => {
      const amount = ethers.utils.parseUnits('300')
      const rewardsAmount = ethers.utils.parseUnits('10')
      await fodlToken.transferAndCall(staking.address, amount, '0x')
      await fodlToken.transfer(staking.address, rewardsAmount)
      await expect(() => fodlToken.transferAndCall(staking.address, amount, '0x')).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount.mul(-1), amount]
      )
      expect(await staking.callStatic.unstake(await staking.balanceOf(wallet0.address))).eq(
        amount.mul(2).add(rewardsAmount)
      )
    })

    it('allows user to stake via approve and call when stakes exist and rewards were sent', async () => {
      const amount = ethers.utils.parseUnits('300')
      const rewardsAmount = ethers.utils.parseUnits('10')

      await fodlToken.transferAndCall(staking.address, amount, '0x')
      await fodlToken.transfer(staking.address, rewardsAmount)
      await fodlToken.approve(staking.address, amount)
      await expect(() => staking.stake(amount)).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount.mul(-1), amount]
      )
      expect(await staking.callStatic.unstake(await staking.balanceOf(wallet0.address))).eq(
        amount.mul(2).add(rewardsAmount)
      )
    })
  })

  describe('unstake(shares)', () => {
    let amount0, amount1, amount2
    before(async () => {
      ;({ fodlToken, staking } = await fixture())

      amount0 = ethers.utils.parseUnits('100')
      amount1 = ethers.utils.parseUnits('1000')
      amount2 = ethers.utils.parseUnits('3244')

      await fodlToken.transferAndCall(staking.address, amount0, '0x')

      await fodlToken.transfer(wallet1.address, amount1)
      await fodlToken.connect(wallet1).transferAndCall(staking.address, amount1, '0x')

      await fodlToken.transfer(wallet2.address, amount2)
      await fodlToken.connect(wallet2).transferAndCall(staking.address, amount2, '0x')
    })

    it('allows user to unstake partially', async () => {
      const part = amount0.div(2)
      await expect(async () => staking.unstake(part)).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [part, part.mul(-1)]
      )
    })

    it('allows user to unstake fully', async () => {
      const amount = await staking.balanceOf(wallet0.address)
      await expect(async () => staking.unstake(amount)).to.changeTokenBalances(
        fodlToken,
        [wallet0, staking],
        [amount, amount.mul(-1)]
      )
    })
  })
})
