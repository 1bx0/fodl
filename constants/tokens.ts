import { Contract } from 'ethers'
import { ERC20, ERC20__factory } from '../typechain'

export interface TokenDataConstructorParams {
  address: string
  symbol: string
  decimals: number
}

export class TokenData {
  address: string
  symbol: string
  decimals: number

  get contract() {
    return new Contract(this.address, ERC20__factory.createInterface()) as ERC20
  }

  constructor({ address, symbol, decimals }: TokenDataConstructorParams) {
    this.address = address
    this.symbol = symbol
    this.decimals = decimals
  }

  static async makeFrom(token: ERC20) {
    return new TokenData({ address: token.address, symbol: await token.symbol(), decimals: await token.decimals() })
  }
}

/**
 * cTokens on COMPOUND
 */

export const cAAVE = new TokenData({
  address: '0xe65cdb6479bac1e22340e4e755fae7e509ecd06c',
  symbol: 'cAAVE',
  decimals: 8,
})

export const cBAT = new TokenData({
  address: '0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e',
  symbol: 'cBAT',
  decimals: 8,
})

export const cCOMP = new TokenData({
  address: '0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4',
  symbol: 'cCOMP',
  decimals: 8,
})

export const cDAI = new TokenData({
  address: '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643',
  symbol: 'cDAI',
  decimals: 8,
})

export const cLINK = new TokenData({
  address: '0xface851a4921ce59e912d19329929ce6da6eb0c7',
  symbol: 'cLINK',
  decimals: 8,
})

export const cREP = new TokenData({
  address: '0x158079ee67fce2f58472a96584a73c7ab9ac95c1',
  symbol: 'cREP',
  decimals: 8,
})

export const cSUSHI = new TokenData({
  address: '0x4b0181102a0112a2ef11abee5563bb4a3176c9d7',
  symbol: 'cSUSHI',
  decimals: 8,
})

export const cTUSD = new TokenData({
  address: '0x12392f67bdf24fae0af363c24ac620a2f67dad86',
  symbol: 'cTUSD',
  decimals: 8,
})

export const cUNI = new TokenData({
  address: '0x35a18000230da775cac24873d00ff85bccded550',
  symbol: 'cUNI',
  decimals: 8,
})

export const cWBTC = new TokenData({
  address: '0xc11b1268c1a384e55c48c2391d8d480264a3a7f4',
  symbol: 'cWBTC',
  decimals: 8,
})

export const cWBTC2 = new TokenData({
  address: '0xccf4429db6322d5c611ee964527d42e5d685dd6a',
  symbol: 'cWBTC2',
  decimals: 8,
})

export const cYFI = new TokenData({
  address: '0x80a2ae356fc9ef4305676f7a3e2ed04e12c33946',
  symbol: 'cYFI',
  decimals: 8,
})

export const cZRX = new TokenData({
  address: '0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407',
  symbol: 'cZRX',
  decimals: 8,
})

export const cETH = new TokenData({
  address: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
  symbol: 'cETH',
  decimals: 8,
})

export const cUSDC = new TokenData({
  address: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
  symbol: 'cUSDC',
  decimals: 8,
})

export const cUSDT = new TokenData({
  address: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  symbol: 'cUSDT',
  decimals: 8,
})

/**
 * Standard mainnet tokens that are supported by Fodl
 */

export const AAVE = new TokenData({
  address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  symbol: 'AAVE',
  decimals: 18,
})

export const LINK = new TokenData({
  address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  symbol: 'LINK',
  decimals: 18,
})

export const REP = new TokenData({
  address: '0x1985365e9f78359a9B6AD760e32412f4a445E862',
  symbol: 'REP',
  decimals: 18,
})

export const SUSHI = new TokenData({
  address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
  symbol: 'SUSHI',
  decimals: 18,
})

export const UNI = new TokenData({
  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  decimals: 18,
  symbol: 'UNI',
})

export const YFI = new TokenData({
  address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
  symbol: 'YFI',
  decimals: 18,
})

export const ZRX = new TokenData({
  address: '0xE41d2489571d322189246DaFA5ebDe1F4699F498',
  symbol: 'ZRX',
  decimals: 18,
})

export const DAI = new TokenData({
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  symbol: 'DAI',
  decimals: 18,
})

export const USDC = new TokenData({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  decimals: 6,
})

export const USDT = new TokenData({
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  symbol: 'USDT',
  decimals: 6,
})

export const TUSD = new TokenData({
  address: '0x0000000000085d4780B73119b644AE5ecd22b376',
  symbol: 'TUSD',
  decimals: 18,
})

export const WBTC = new TokenData({
  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  symbol: 'WBTC',
  decimals: 8,
})

export const WETH = new TokenData({
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  symbol: 'WETH',
  decimals: 18,
})

export const BAT = new TokenData({
  address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
  symbol: 'BAT',
  decimals: 18,
})
export const DOLA = new TokenData({
  address: '0x865377367054516e17014CcdED1e7d814EDC9ce4',
  symbol: 'DOLA',
  decimals: 18,
})
export const COMP = new TokenData({
  symbol: 'COMP',
  address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
  decimals: 18,
})

export const FODL = new TokenData({
  symbol: 'FODL',
  address: '0x4C2e59D098DF7b6cBaE0848d66DE2f8A4889b9C3',
  decimals: 18,
})

/**
 * Other relevant tokens
 */
export const stkAAVE = new TokenData({
  address: '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  symbol: 'stkAAVE',
  decimals: 18,
})

/**
 * Fodl LP tokens
 */

export const FODL_ETH_SLP = new TokenData({
  address: '0xCE7E98d4dA6EBdA6Af474eA618C6b175729cD366',
  symbol: 'SLP',
  decimals: 18,
})

export const FODL_USDC_SLP = new TokenData({
  address: '0xA5c475167f03B1556C054E0dA78192cd2779087F',
  symbol: 'SLP',
  decimals: 18,
})
