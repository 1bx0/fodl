import { expect } from 'chai'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { deployments, ethers, waffle } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { COMPOUND_PLATFORM, SUBSIDY_HOLDER_ADDRESS, SUBSIDY_REWARDS } from '../constants/deploy'
import { COMP, USDT, WETH } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { FoldingRegistry } from '../typechain'
import { AllConnectors } from '../typechain/AllConnectors'
import { MANTISSA } from './shared/constants'

import { expectApproxBalanceChanges, mine, solidityTokenAmount2Float } from './shared/utils'

const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre
  await deployments.fixture()

  const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const accountAddress = await foldingRegistry.callStatic.createAccount()
  await foldingRegistry.createAccount()
  const account = (await ethers.getContractAt('AllConnectors', accountAddress)) as AllConnectors

  return { account }
})

describe('ClaimRewardsConnector', async () => {
  let newAccount: AllConnectors
  const owner = waffle.provider.getWallets()[0]

  before(async () => {
    ;({ account: newAccount } = await fixture())

    await sendToken(WETH.contract, owner.address, parseUnits('100', WETH.decimals))
  })

  describe('claimRewards()', async function () {
    it('cannot claim rewards before initialising simple position', async function () {
      await expect(newAccount.claimRewards()).to.be.revertedWith('SP1')
    })

    it('can claim rewards after initialising simple position', async function () {
      await WETH.contract.connect(owner).approve(newAccount.address, parseEther('100'))

      await newAccount.increaseSimplePositionWithFunds(
        COMPOUND_PLATFORM,
        WETH.address,
        parseEther('1'),
        USDT.address,
        0
      )
      const { rewardToken, rewardPerBlock, rewardBalance } = await getRewardsAndInterest(newAccount)
      expect(rewardToken).to.equal(COMP.address)

      const numberOfBlocks = 10
      await mine(numberOfBlocks)

      const expectedRewards = rewardBalance.add(rewardPerBlock.mul(numberOfBlocks + 1))

      const rewardsTax = solidityTokenAmount2Float(COMP, expectedRewards.mul(SUBSIDY_REWARDS).div(MANTISSA))
      const rewardsCashout = solidityTokenAmount2Float(COMP, expectedRewards) - rewardsTax
      // TODO: Aave rewards are unpredicatable at least... We should investigate how they are computed
      await expectApproxBalanceChanges(
        () => newAccount.claimRewards(),
        COMP,
        [SUBSIDY_HOLDER_ADDRESS, owner.address],
        [rewardsTax, rewardsCashout],
        0.01
      )
    })
  })
})

const getRewardsAndInterest = async (account: AllConnectors) => {
  const [rewardToken, rewardAmountBefore] = await account.callStatic.claimRewards()
  await ethers.provider.send('evm_mine', [])
  const [, rewardBalance] = await account.callStatic.claimRewards()

  const rewardPerBlock = rewardBalance.sub(rewardAmountBefore)
  return {
    rewardToken,
    rewardPerBlock,
    rewardBalance,
  }
}
