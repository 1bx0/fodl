import { deployments, ethers } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { BAT, cDAI, cETH, DAI, USDC, USDT, WBTC, WETH } from '../../constants/tokens'
import {
  AaveLendingAdapter,
  AavePriceOracleMock,
  CompoundForksLendingAdapter,
  CompoundPriceOracleMock,
  ERC20,
  FodlNFT,
  FoldingRegistry,
  ICToken,
  IWETH,
} from '../../typechain'
import { createFoldingAccount } from './utils'

export const tokensFixture = async () => {
  const dai = (await ethers.getContractAt('ERC20', DAI.address)) as ERC20
  const wbtc = (await ethers.getContractAt('ERC20', WBTC.address)) as ERC20
  const bat = (await ethers.getContractAt('ERC20', BAT.address)) as ERC20
  const usdt = (await ethers.getContractAt('ERC20', USDT.address)) as ERC20
  const usdc = (await ethers.getContractAt('ERC20', USDC.address)) as ERC20
  const ceth = (await ethers.getContractAt('ICToken', cETH.address)) as ICToken
  const cdai = (await ethers.getContractAt('ICToken', cDAI.address)) as ICToken
  const weth = (await ethers.getContractAt('IWETH', WETH.address)) as IWETH

  return { dai, cdai, wbtc, bat, usdt, usdc, weth, ceth }
}

export const simplePositionFixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre

  const [alice, bot, mallory] = await ethers.getUnnamedSigners()

  await deployments.fixture()

  const fodlNFT = (await ethers.getContract('FodlNFT')) as FodlNFT
  const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

  const { account } = await createFoldingAccount(foldingRegistry, alice)
  const { account: unconfiguredAccount } = await createFoldingAccount(foldingRegistry, alice)

  const aaveLendingAdapter = (await ethers.getContract('AaveLendingAdapter')) as AaveLendingAdapter
  const compoundLendingAdapter = (await ethers.getContract(
    'CompoundForksLendingAdapter'
  )) as CompoundForksLendingAdapter

  const compoundPriceOracleMock = (await ethers.getContract('CompoundPriceOracleMock')) as CompoundPriceOracleMock
  const aavePriceOracleMock = (await ethers.getContract('AavePriceOracleMock')) as AavePriceOracleMock

  return {
    account,
    unconfiguredAccount,
    alice,
    bot,
    mallory,
    foldingRegistry,
    aaveLendingAdapter,
    aavePriceOracleMock,
    compoundLendingAdapter,
    compoundPriceOracleMock,
    fodlNFT,
  }
})
