import { expect } from 'chai'
import { BigNumberish } from 'ethers'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { deployments, ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { SUSHI_ROUTER, UNI_ROUTER } from '../constants/deploy'
import { USDT, WETH } from '../constants/tokens'
import { ERC20, IERC20, IWETH, UniswapExchangerAdapter } from '../typechain'
import { deployContract } from '../utils/deploy'
import {
  getSushiswapInputAmount,
  getSushiswapOutputAmount,
  getUniswapInputAmount,
  getUniswapOutputAmount,
} from './shared/utils'

const fixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre
  await deployments.fixture()

  const weth = (await ethers.getContractAt('IWETH', WETH.address)) as IWETH
  const usdt = (await ethers.getContractAt('IERC20', USDT.address)) as ERC20

  const deploy = async (exchanger: string, address: string) => {
    await deployContract(hre, exchanger, [address])
    return (await hre.ethers.getContract(exchanger)) as UniswapExchangerAdapter
  }

  return { deploy, hre, usdt, weth }
})

const fixtureAdapter = async (name: string) => {
  const { deploy, hre, weth, usdt } = await fixture()
  const { ethers } = hre

  const uniswapExchangeAdapter = (await ethers.getContract(name)) as UniswapExchangerAdapter

  return { deploy, exchangerAdapter: uniswapExchangeAdapter, usdt, weth }
}

describe('UniswapExchangerAdapter', () => {
  let exchangerAdapter: UniswapExchangerAdapter
  let deploy

  let weth: IWETH
  let usdt: IERC20

  const platforms = [
    {
      name: 'UniswapExchangerAdapter',
      router: UNI_ROUTER,
      getOutputAmountFn: getUniswapOutputAmount,
      getInputAmountFn: getUniswapInputAmount,
    },
    {
      name: 'SushiswapExchangerAdapter',
      router: SUSHI_ROUTER,
      getOutputAmountFn: getSushiswapOutputAmount,
      getInputAmountFn: getSushiswapInputAmount,
    },
  ]

  platforms.forEach(({ name, router, getOutputAmountFn, getInputAmountFn }) => {
    describe(name, async () => {
      beforeEach('load fixture', async () => {
        ;({ deploy, exchangerAdapter, usdt, weth } = await fixtureAdapter(name))
      })

      describe('constructor()', async () => {
        it('sets immutables correctly', async () => {
          expect(await exchangerAdapter.ROUTER()).to.be.equal(router)
        })

        it('reverts if passing address 0x0 as UNI_ROUTER address', async () => {
          await expect(deploy(name, ethers.constants.AddressZero)).to.be.revertedWith('ICP0')
        })
      })

      describe('exchange()', async () => {
        let amount: BigNumberish
        beforeEach('send ether to exchanger adapter', async () => {
          amount = parseEther(Math.ceil(Math.random() * 10).toString())

          /**
           * Fund exchange adapter with WETH
           */
          await weth.deposit({ value: amount })
          await weth.transfer(exchangerAdapter.address, amount)
        })
        it('swaps the amount and resets allowance', async () => {
          const daiBalanceBefore = await usdt.balanceOf(exchangerAdapter.address)

          expect(daiBalanceBefore).to.be.equal(ethers.constants.Zero)

          await exchangerAdapter.exchange(weth.address, usdt.address, amount, 0, ethers.constants.HashZero)

          const wethBalance = await weth.balanceOf(exchangerAdapter.address)

          expect(wethBalance).to.be.equal(ethers.constants.Zero)

          const daiBalanceAfter = await usdt.balanceOf(exchangerAdapter.address)

          expect(daiBalanceAfter).to.be.gt(ethers.constants.Zero)

          const allowance = await weth.allowance(exchangerAdapter.address, await exchangerAdapter.ROUTER())

          expect(allowance).to.be.equal(ethers.constants.Zero)
        })
        it('gets amount of output token for given amount of input token', async () => {
          const wethAmount = parseUnits('10', WETH.decimals)
          const usdtAmount = await getOutputAmountFn(wethAmount.toString(), WETH, USDT)

          expect(await exchangerAdapter.callStatic.getAmountOut(WETH.address, USDT.address, wethAmount)).to.be.equal(
            parseUnits(usdtAmount.toExact(), USDT.decimals)
          )
        })
        it('gets amount of input token required to get given amount of output token', async () => {
          const usdtAmount = parseUnits('100', USDT.decimals)
          let wethAmount = await getInputAmountFn(usdtAmount.toString(), WETH, USDT)

          expect(await exchangerAdapter.callStatic.getAmountIn(WETH.address, USDT.address, usdtAmount)).to.be.equal(
            parseUnits(wethAmount.toExact(), WETH.decimals)
          )
        })
      })
    })
  })
})
