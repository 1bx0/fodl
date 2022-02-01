import { expect } from 'chai'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { deployments, ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { AAVE_PLATFORM } from '../constants/deploy'
import { USDT, WETH } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { FoldingRegistry } from '../typechain'
import { AllConnectors } from '../typechain/AllConnectors'
import { IERC20 } from '../typechain/IERC20'
import { IWETH } from '../typechain/IWETH'

const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hre
  await deployments.fixture()
  const { deployer } = await getNamedAccounts()

  const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const accountAddress = await foldingRegistry.callStatic.createAccount()
  await foldingRegistry.createAccount()
  const account = (await ethers.getContractAt('AllConnectors', accountAddress)) as AllConnectors

  const positionEntrypoint = (await ethers.getContractAt('AllConnectors', foldingRegistry.address)) as AllConnectors

  const weth = (await ethers.getContractAt('IWETH', WETH.address)) as IWETH
  const usdt = (await ethers.getContractAt('IERC20', USDT.address)) as IERC20

  await weth.approve(account.address, parseEther('100'))

  await sendToken(weth, deployer, parseUnits('100', WETH.decimals))
  await sendToken(usdt, deployer, parseUnits('10000', USDT.decimals))

  return { usdt, weth, foldingRegistry, account, positionEntrypoint }
})

describe('SimplePositionLendingConnector', async () => {
  let foldingRegistry: FoldingRegistry,
    positionEntrypoint: AllConnectors,
    account: AllConnectors,
    weth: IWETH,
    usdt: IERC20

  before(async () => {
    ;({ account, foldingRegistry, positionEntrypoint, weth, usdt } = await fixture())
  })

  describe('increaseSimplePositionWithFunds()', async function () {
    it('can only supply', async function () {
      await expect(
        account.increaseSimplePositionWithFunds(AAVE_PLATFORM, WETH.address, parseEther('1'), USDT.address, 0)
      ).to.not.be.reverted

      expect(await account.callStatic.getSupplyBalance()).to.be.closeTo(parseEther('1'), 2)
    })

    it('can only borrow', async function () {
      await expect(
        account.increaseSimplePositionWithFunds(
          AAVE_PLATFORM,
          WETH.address,
          0,
          USDT.address,
          parseUnits('100', USDT.decimals)
        )
      ).to.not.be.reverted

      await ethers.provider.send('evm_mine', [])

      expect(await account.callStatic.getBorrowBalance()).to.be.at.least(parseUnits('100', USDT.decimals))
    })

    it('can supply and borrow', async function () {
      await expect(
        account.increaseSimplePositionWithFunds(
          AAVE_PLATFORM,
          WETH.address,
          parseEther('1'),
          USDT.address,
          parseUnits('100', USDT.decimals)
        )
      ).to.not.be.reverted
      expect(await account.callStatic.getCollateralUsageFactor()).gte(0)
    })
  })

  describe('decreaseSimplePositionWithFunds()', async function () {
    it('cannot be called when position not initialised', async function () {
      await expect(
        positionEntrypoint.decreaseSimplePositionWithFunds(AAVE_PLATFORM, WETH.address, 0, USDT.address, 0)
      ).to.be.revertedWith('FA2')
    })

    it('can only redeem supply', async function () {
      await account.decreaseSimplePositionWithFunds(AAVE_PLATFORM, WETH.address, parseEther('0.1'), USDT.address, 0)
    })

    it('can only repay borrow', async function () {
      await usdt.approve(account.address, parseUnits('10', USDT.decimals))
      await account.decreaseSimplePositionWithFunds(
        AAVE_PLATFORM,
        WETH.address,
        0,
        USDT.address,
        parseUnits('10', USDT.decimals)
      )
    })

    it('can redeem supply and repay borrow', async function () {
      await usdt.approve(account.address, parseUnits('10', USDT.decimals))
      await account.decreaseSimplePositionWithFunds(
        AAVE_PLATFORM,
        WETH.address,
        parseEther('0.1'),
        USDT.address,
        parseUnits('10', USDT.decimals)
      )
    })
  })

  describe('claimRewards()', async function () {
    before(async () => {
      const accountAddress = await foldingRegistry.callStatic.createAccount()
      await foldingRegistry.createAccount()
      account = (await ethers.getContractAt('AllConnectors', accountAddress)) as AllConnectors
    })

    it('cannot claim rewards before initialising simple position', async function () {
      await expect(account.claimRewards()).to.be.revertedWith('SP1')
    })

    it('can claim rewards after initialising simple position', async function () {
      await weth.approve(account.address, parseEther('100'))

      await account.increaseSimplePositionWithFunds(AAVE_PLATFORM, WETH.address, parseEther('1'), USDT.address, 0)
      await expect(account.claimRewards()).to.not.be.reverted
    })
  })
})
