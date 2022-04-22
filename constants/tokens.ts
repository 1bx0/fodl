import { Contract, ethers } from 'ethers'
import { ERC20, ERC20__factory } from '../typechain'

export interface TokenDataConstructorParams {
  address: string
  symbol: string
  decimals: number
  provider?: string
}

export class TokenData {
  address: string
  symbol: string
  decimals: number
  provider?: string

  get contract() {
    return new Contract(this.address, ERC20__factory.createInterface()) as ERC20
  }

  constructor({ address, symbol, decimals, provider }: TokenDataConstructorParams) {
    this.address = address
    this.symbol = symbol
    this.decimals = decimals
    this.provider = provider
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
  provider: '0x98c63b7b319dfbdf3d811530f2ab9dfe4983af9d',
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
  provider: '0x1a9c8182c09f50c8318d769245bea52c32be35bc',
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
  provider: '0x206376e8940e42538781cd94ef024df3c1e0fd43',
})

export const DAI = new TokenData({
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  symbol: 'DAI',
  decimals: 18,
  provider: '0x7566126f2fD0f2Dddae01Bb8A6EA49b760383D5A',
})

export const USDC = new TokenData({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  decimals: 6,
  provider: '0x95Ba4cF87D6723ad9C0Db21737D862bE80e93911',
})

export const USDT = new TokenData({
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  symbol: 'USDT',
  decimals: 6,
  provider: '0x5754284f345afc66a98fbB0a0Afe71e0F007B949',
})

export const TUSD = new TokenData({
  address: '0x0000000000085d4780B73119b644AE5ecd22b376',
  symbol: 'TUSD',
  decimals: 18,
  provider: '0xf977814e90da44bfa03b6295a0616a897441acec',
})

export const WBTC = new TokenData({
  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  symbol: 'WBTC',
  decimals: 8,
  provider: '0x701bd63938518d7DB7e0f00945110c80c67df532',
})

export const WETH = new TokenData({
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  symbol: 'WETH',
  decimals: 18,
  provider: '0xAaE0633E15200bc9C50d45cD762477D268E126BD',
})

export const BAT = new TokenData({
  address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
  symbol: 'BAT',
  decimals: 18,
  provider: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8',
})
export const DOLA = new TokenData({
  address: '0x865377367054516e17014CcdED1e7d814EDC9ce4',
  symbol: 'DOLA',
  decimals: 18,
  provider: '0x926dF14a23BE491164dCF93f4c468A50ef659D5B',
})
export const COMP = new TokenData({
  symbol: 'COMP',
  address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
  decimals: 18,
  provider: '0x2775b1c75658be0f640272ccb8c72ac986009e38',
})

export const FODL = new TokenData({
  symbol: 'FODL',
  address: '0x4C2e59D098DF7b6cBaE0848d66DE2f8A4889b9C3',
  decimals: 18,
  provider: '0x139aa9232a37a2172b8a66cdedf019a8eaa9fbc5',
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

/**
 * BSC - Binance Smart Chain Tokens
 */

export const XVS = new TokenData({
  address: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63',
  symbol: 'XVS',
  decimals: 18,
})

export const WBNB = new TokenData({
  address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  symbol: 'WBNB',
  decimals: 18,
  provider: ethers.constants.AddressZero,
})

export const BTCB = new TokenData({
  address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  symbol: 'BTCB',
  decimals: 18, // as stated in contract
  provider: ethers.constants.AddressZero,
})

export const BSCUSDT = new TokenData({
  address: '0x55d398326f99059fF775485246999027B3197955',
  symbol: 'USDT',
  decimals: 18, // as stated in contract
  provider: ethers.constants.AddressZero,
})

export const BSCUSDC = new TokenData({
  address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  symbol: 'USDC',
  decimals: 18, // as stated in contract
  provider: ethers.constants.AddressZero,
})

export const BSCDAI = new TokenData({
  address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
  symbol: 'DAI',
  decimals: 18,
  provider: ethers.constants.AddressZero,
})

export const BUSD = new TokenData({
  address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  symbol: 'BUSD',
  decimals: 18,
  provider: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3',
})

export const BSCETH = new TokenData({
  address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  symbol: 'ETH',
  provider: ethers.constants.AddressZero,
  decimals: 18,
})

export const BETH = new TokenData({
  address: '0x250632378E573c6Be1AC2f97Fcdf00515d0Aa91B',
  symbol: 'BETH',
  provider: ethers.constants.AddressZero,
  decimals: 18,
})

export const XRP = new TokenData({
  address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',
  symbol: 'XRP',
  provider: '',
  decimals: 18,
})
export const ADA = new TokenData({
  address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47',
  symbol: 'ADA',
  provider: '',
  decimals: 18,
})
export const LTC = new TokenData({
  address: '0x4338665CBB7B2485A8855A139b75D5e34AB0DB94',
  symbol: 'LTC',
  provider: '',
  decimals: 18,
})
export const BCH = new TokenData({
  address: '0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf',
  symbol: 'BCH',
  provider: '',
  decimals: 18,
})
export const DOGE = new TokenData({
  address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43',
  symbol: 'DOGE',
  provider: '',
  decimals: 8,
})
export const DOT = new TokenData({
  address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',
  symbol: 'DOT',
  provider: '',
  decimals: 18,
})
export const SXP = new TokenData({
  address: '0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A',
  symbol: 'SXP',
  provider: '',
  decimals: 18,
})

export const CAKE = new TokenData({
  address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  symbol: 'CAKE',
  decimals: 18,
})

/**
 * vTokens on VENUS
 */

export const vBNB = new TokenData({
  address: '0xA07c5b74C9B40447a954e1466938b865b6BBea36',
  symbol: 'vBNB',
  decimals: 8, // as stated in contract
})

export const vBUSD = new TokenData({
  address: '0x95c78222B3D6e262426483D42CfA53685A67Ab9D',
  symbol: 'vBUSD',
  decimals: 8, // as stated in contract
})

export const vUSDC = new TokenData({
  address: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8',
  symbol: 'vUSDC',
  decimals: 8, // as stated in contract
})

export const vXVS = new TokenData({
  address: '0x151B1e2635A717bcDc836ECd6FbB62B674FE3E1D',
  symbol: 'vXVS',
  decimals: 8, // as stated in contract
})

export const vUSDT = new TokenData({
  address: '0xfd5840cd36d94d7229439859c0112a4185bc0255',
  symbol: 'vUSDT',
  decimals: 8,
})

export const vDAI = new TokenData({
  address: '0x334b3ecb4dca3593bccc3c7ebd1a1c1d1780fbf1',
  symbol: 'vDAI',
  decimals: 8,
})

export const vBTC = new TokenData({
  address: '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B',
  symbol: 'vBTC',
  decimals: 8,
})

export const vETH = new TokenData({
  address: '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8',
  symbol: 'vETH',
  provider: '',
  decimals: 8,
})

export const vBETH = new TokenData({
  address: '0x972207A639CC1B374B893cc33Fa251b55CEB7c07',
  symbol: 'vBETH',
  provider: '',
  decimals: 8,
})

export const vXRP = new TokenData({
  address: '0xB248a295732e0225acd3337607cc01068e3b9c10',
  symbol: 'vXRP',
  decimals: 8,
})

export const vADA = new TokenData({
  address: '0x9A0AF7FDb2065Ce470D72664DE73cAE409dA28Ec',
  symbol: 'vADA',
  decimals: 8,
})

export const vLTC = new TokenData({
  address: '0x57A5297F2cB2c0AaC9D554660acd6D385Ab50c6B',
  symbol: 'vLTC',
  decimals: 8,
})

export const vBCH = new TokenData({
  address: '0x5F0388EBc2B94FA8E123F404b79cCF5f40b29176',
  symbol: 'vBCH',
  decimals: 8,
})

export const vDOGE = new TokenData({
  address: '0xec3422Ef92B2fb59e84c8B02Ba73F1fE84Ed8D71',
  symbol: 'vDOGE',
  decimals: 8,
})

export const vDOT = new TokenData({
  address: '0x1610bc33319e9398de5f57B33a5b184c806aD217',
  symbol: 'vDOT',
  decimals: 8,
})

export const vSXP = new TokenData({
  address: '0x2fF3d0F6990a40261c66E1ff2017aCBc282EB6d0',
  symbol: 'vSXP',
  decimals: 8,
})

export const vCAKE = new TokenData({
  address: '0x86aC3974e2BD0d60825230fa6F355fF11409df5c',
  symbol: 'vCAKE',
  decimals: 8,
})
export const POLY = {
  WMATIC: () =>
    new TokenData({
      symbol: 'WMATIC',
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      decimals: 18,
      provider: ethers.constants.AddressZero,
    }),
  WBTC: () =>
    new TokenData({
      symbol: 'WBTC',
      address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      decimals: 8,
      provider: ethers.constants.AddressZero,
    }),
  WETH: () =>
    new TokenData({
      symbol: 'WETH',
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      decimals: 18,
      provider: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    }),
  USDC: () =>
    new TokenData({
      symbol: 'USDC',
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      provider: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    }),
  USDT: () =>
    new TokenData({
      symbol: 'USDT',
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      provider: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe',
    }),
  DAI: () =>
    new TokenData({
      symbol: 'DAI',
      address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      decimals: 18,
      provider: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    }),

  aMATIC: () =>
    new TokenData({ symbol: 'aMATIC', address: '0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4', decimals: 18 }),
  aUSDC: () => new TokenData({ symbol: 'aUSDC', address: '0x1a13F4Ca1d028320A707D99520AbFefca3998b7F', decimals: 6 }),
  aWETH: () => new TokenData({ symbol: 'aWETH', address: '0x28424507fefb6f7f8E9D3860F56504E4e5f5f390', decimals: 18 }),
  aWBTC: () => new TokenData({ symbol: 'aWBTC', address: '0x5c2ed810328349100A66B82b78a1791B101C9D61', decimals: 8 }),
  aDAI: () => new TokenData({ symbol: 'aDAI', address: '0x27F8D03b3a2196956ED754baDc28D73be8830A6e', decimals: 18 }),
  aUSDT: () => new TokenData({ symbol: 'aUSDT', address: '0x60D55F02A771d515e077c9C2403a1ef324885CeC', decimals: 6 }),
}
