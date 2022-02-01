import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'

import { TOKENS } from '../scripts/my_tokens'
const { DAI, USDC } = TOKENS
import { TestExposedExchangerDispatcher } from '../typechain/TestExposedExchangerDispatcher'
import { ExchangerMock__factory as ExchangerMockFactory } from '../typechain'
import { BigNumber } from '@ethersproject/bignumber'

describe('ExchangerDispatcher', function () {
  const fromToken = DAI.address
  const toToken = USDC.address
  const fromAmount = 342786
  const minToAmount = 342333
  const txData = '0x1234'
  let testDispatcher: TestExposedExchangerDispatcher, mockExchangerFactory: ExchangerMockFactory

  before(async function () {
    const dispatcherFactory = await ethers.getContractFactory('TestExposedExchangerDispatcher')
    const dispatcher = await dispatcherFactory.deploy()
    await dispatcher.deployed()
    testDispatcher = dispatcher as TestExposedExchangerDispatcher
    const exchangerFactory = await ethers.getContractFactory('ExchangerMock')
    mockExchangerFactory = exchangerFactory as ExchangerMockFactory
  })

  it('dispatches arguments to mock', async function () {
    const mockExchanger = await mockExchangerFactory.deploy(0)
    await mockExchanger.deployed()

    await expect(
      testDispatcher.test_exchange(mockExchanger.address, fromToken, toToken, fromAmount, minToAmount, txData)
    )
      .to.emit(testDispatcher, 'Exchange')
      .withArgs(fromToken, toToken, fromAmount, minToAmount, txData)
  })

  it('forwards return value from mock', async function () {
    async function testReturnValue(returnValue: BigNumber) {
      const mockExchanger = await mockExchangerFactory.deploy(returnValue)
      await mockExchanger.deployed()
      expect(
        await testDispatcher.callStatic.test_exchange(
          mockExchanger.address,
          fromToken,
          toToken,
          fromAmount,
          minToAmount,
          txData
        )
      ).to.equal(returnValue)
    }
    for (let value of [121, 435433]) {
      await testReturnValue(ethers.BigNumber.from(value))
    }
  })

  // TODO: I think the following 2 tests are not necessary because Address from OpenZeppelin is tested by them
  // It also doesn't improve coverage
  it('reverts when calling non contract', async function () {
    const eoa = waffle.provider.getWallets()[0].address
    await expect(
      testDispatcher.test_exchange(eoa, fromToken, toToken, fromAmount, minToAmount, txData)
    ).to.be.revertedWith('Address: delegate call to non-contract')
  })

  it('reverts when calling non contract', async function () {
    const nonExchanger = DAI.address
    await expect(
      testDispatcher.test_exchange(nonExchanger, fromToken, toToken, fromAmount, minToAmount, txData)
    ).to.be.revertedWith('Address: low-level delegate call failed')
  })
})
