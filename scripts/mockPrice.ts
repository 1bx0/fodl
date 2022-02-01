import dotenv from 'dotenv'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import {
  AAVE_PLATFORM,
  COMPOUND_PLATFORM,
  COMPOUND_TOKENS_TO_CTOKENS,
  USE_CONTROLLED_EXCHANGE,
} from '../constants/deploy'
import { DAI, USDC, USDT, WBTC, WETH } from '../constants/tokens'
import {
  AavePriceOracleMock,
  CompoundPriceOracleMock,
  FoldingRegistry,
  FoldingRegistry__factory,
  IAaveLendingPoolProvider__factory,
  IComptroller__factory,
  ERC20,
  ControlledExchanger,
  ControlledExchangerAdapter,
} from '../typechain'
import { getERC20Token, sendToken } from './utils'

dotenv.config()

const foldingRegistryAddress = process.env.REGISTRY || ''
const onlyView: boolean = process.env.VIEW == 'true'
const onlyFund: boolean = process.env.FUND == 'true'
const token = process.env.TOKEN || ''
const priceChange = process.env.PRICE || '1'

export const mockPrice = async () => {
  const fr = foldingRegistryAddress
    ? FoldingRegistry__factory.connect(foldingRegistryAddress, ethers.provider)
    : ((await ethers.getContract('FoldingRegistry')) as FoldingRegistry)

  const controlledExchangerAdapter = (await ethers.getContractAt(
    'ControlledExchangerAdapter',
    await fr.callStatic.getExchangerAdapter(USE_CONTROLLED_EXCHANGE)
  )) as ControlledExchangerAdapter

  const controlledExchanger = (await ethers.getContractAt(
    'ControlledExchanger',
    await controlledExchangerAdapter.callStatic.ROUTER()
  )) as ControlledExchanger

  if (onlyFund) {
    const tokensToFund = [WBTC, WETH, DAI, USDC, USDT]
    await Promise.all(
      tokensToFund.map(async (token) => {
        await sendToken(token.contract, controlledExchanger.address)
      })
    )
    return
  }

  const tokenSC = (await getERC20Token(token)) as ERC20
  if (onlyView) {
    console.log((await controlledExchanger.getPriceUpdate(tokenSC.address)).toString())
    return
  }

  const comptroller = IComptroller__factory.connect(COMPOUND_PLATFORM, ethers.provider)
  const compoundPriceOracleMock = (await ethers.getContractAt(
    'CompoundPriceOracleMock',
    await comptroller.callStatic.oracle()
  )) as CompoundPriceOracleMock

  const aave = IAaveLendingPoolProvider__factory.connect(AAVE_PLATFORM, ethers.provider)
  const aavePriceOracleMock = (await ethers.getContractAt(
    'AavePriceOracleMock',
    await aave.callStatic.getPriceOracle()
  )) as AavePriceOracleMock

  const priceUpdate = parseEther(priceChange)
  await compoundPriceOracleMock.setPriceUpdate(COMPOUND_TOKENS_TO_CTOKENS[tokenSC.address], priceUpdate)
  await aavePriceOracleMock.setPriceUpdate(tokenSC.address, priceUpdate)
  await controlledExchanger.setPriceUpdate(tokenSC.address, priceUpdate)
}

mockPrice().catch(console.error)
