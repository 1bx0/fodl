import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { parseEther } from 'ethers/lib/utils'
import { deployments, ethers } from 'hardhat'
import { UNI_ROUTER } from '../constants/deploy'
import { USDC, WBTC } from '../constants/tokens'
import { sendToken } from '../scripts/utils'
import { IUniswapRouterV2 } from '../typechain'
import { ControlledExchanger } from '../typechain/ControlledExchanger'
import { expectApproxBalanceChanges, float2SolidityTokenAmount, solidityTokenAmount2Float } from './shared/utils'

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture()
  const controlledExchanger = (await ethers.getContract('ControlledExchanger')) as ControlledExchanger
  const uniswapExchanger = (await ethers.getContractAt('IUniswapRouterV2', UNI_ROUTER)) as IUniswapRouterV2
  const alice = (await ethers.getSigners())[0]

  return { controlledExchanger, uniswapExchanger, alice }
})

describe('ControlledExchanger', () => {
  const tableTests = [
    {
      path: [WBTC, USDC],
      priceUpdates: [parseEther('1'), parseEther('1')],
    },
    {
      path: [WBTC, USDC],
      priceUpdates: [parseEther('1.4'), parseEther('1')],
    },
  ]

  for (const test of tableTests) {
    describe(`[${test.path[0].symbol}, ${test.path[1].symbol}] with price updates: ${test.priceUpdates}`, async () => {
      let controlledExchanger: ControlledExchanger, uniswapExchanger: IUniswapRouterV2
      let alice: SignerWithAddress

      before('setup controlled router and uniswap router', async () => {
        ;({ controlledExchanger, uniswapExchanger, alice } = await fixture())
        for (const i in [0, 1]) {
          await test.path[i].contract.connect(alice).approve(controlledExchanger.address, ethers.constants.MaxUint256)

          await sendToken(
            test.path[i].contract.connect(alice),
            controlledExchanger.address,
            float2SolidityTokenAmount(test.path[i], 1000000000)
          )
          await controlledExchanger.setPriceUpdate(test.path[i].address, test.priceUpdates[i])
        }
      })

      it('getAmountsIn', async () => {
        const amountOut = float2SolidityTokenAmount(test.path[1], Math.random() * 1000)

        const pair = test.path.map((e) => e.address)

        const amountsGot = await controlledExchanger.callStatic.getAmountsIn(amountOut, pair)
        let amountsExpected = await uniswapExchanger.callStatic.getAmountsIn(amountOut, pair)

        expect(amountsGot).to.deep.equal([
          amountsExpected[0].mul(test.priceUpdates[1]).div(test.priceUpdates[0]),
          amountsExpected[1],
        ])
      })

      it('getAmountsOut', async () => {
        const amountIn = float2SolidityTokenAmount(test.path[0], Math.random() * 1000)

        const pair = test.path.map((e) => e.address)

        const amountsGot = await controlledExchanger.callStatic.getAmountsOut(amountIn, pair)
        let amountsExpected = await uniswapExchanger.callStatic.getAmountsOut(amountIn, pair)

        expect(amountsGot).to.deep.equal([
          amountsExpected[0],
          amountsExpected[1].mul(test.priceUpdates[0]).div(test.priceUpdates[1]),
        ])
      })

      it('swapExactTokensForTokens', async () => {
        const amountIn = float2SolidityTokenAmount(test.path[0], 123)
        const pair = test.path.map((e) => e.address)
        const amountsOut = await uniswapExchanger.callStatic.getAmountsOut(amountIn, pair)
        await sendToken(test.path[0].contract, alice.address, amountIn)
        await expectApproxBalanceChanges(
          () => controlledExchanger.connect(alice).swapExactTokensForTokens(amountIn, 0, pair, alice.address, 0),
          test.path[1],
          [alice.address],
          [solidityTokenAmount2Float(test.path[1], amountsOut[1].mul(test.priceUpdates[0]).div(test.priceUpdates[1]))],
          0
        )
      })

      it('swapTokensForExactTokens', async () => {
        const amountOut = float2SolidityTokenAmount(test.path[1], Math.random() * 1000)
        const pair = test.path.map((e) => e.address)
        const amountsIn = await uniswapExchanger.callStatic.getAmountsIn(amountOut, pair)
        await sendToken(
          test.path[0].contract,
          alice.address,
          amountsIn[0].mul(test.priceUpdates[1]).div(test.priceUpdates[0])
        )
        await expectApproxBalanceChanges(
          () =>
            controlledExchanger
              .connect(alice)
              .swapTokensForExactTokens(amountOut, ethers.constants.MaxUint256, pair, alice.address, 0),
          test.path[0],
          [alice.address],
          [-solidityTokenAmount2Float(test.path[0], amountsIn[0].mul(test.priceUpdates[1]).div(test.priceUpdates[0]))],
          0
        )
      })
    })
  }
})
