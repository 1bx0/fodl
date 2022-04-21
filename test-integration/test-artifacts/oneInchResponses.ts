import { IOneInchResponse } from '../utils/RouteFinders'

export const OneInchResponses: { [address: string]: IOneInchResponse } = {
  'DAI-WETH': {
    fromToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toTokenAmount: '347799038059969443489',
    fromTokenAmount: '1004077091704928898252547',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
      ],
    ],
  },
  'WETH-DAI': {
    fromToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toTokenAmount: '997107732613611139476199',
    fromTokenAmount: '346365365981728984934',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      ],
    ],
  },
  'USDC-WETH': {
    fromToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toTokenAmount: '347731294846116768269',
    fromTokenAmount: '1003794792185',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
      ],
    ],
  },
  'WETH-USDC': {
    fromToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toTokenAmount: '997376774484',
    fromTokenAmount: '346419060936173991649',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      ],
    ],
  },
  'USDT-WETH': {
    fromToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toTokenAmount: '124925837829024209799',
    fromTokenAmount: '360834648250',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
      ],
    ],
  },
  'WETH-USDT': {
    fromToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toTokenAmount: '366195444460',
    fromTokenAmount: '127009647531471514981',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
        ],
      ],
    ],
  },
  'WBTC-WETH': {
    fromToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toTokenAmount: '182638258396222556435',
    fromTokenAmount: '1222730222',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
      ],
    ],
  },
  'WETH-WBTC': {
    fromToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toTokenAmount: '1197328811',
    fromTokenAmount: '179492686302748921889',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
          },
        ],
      ],
    ],
  },
  'LINK-WETH': {
    fromToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toTokenAmount: '16525976711870090309',
    fromTokenAmount: '3191574057608055227320',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
      ],
    ],
  },
  'WETH-LINK': {
    fromToken: {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    toToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toTokenAmount: '3003838698839944445295',
    fromTokenAmount: '15691401248355589360',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
          },
        ],
      ],
    ],
  },
  'DAI-WBTC': {
    fromToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toTokenAmount: '2345438941',
    fromTokenAmount: '1015566907991360640153289',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
          },
        ],
      ],
    ],
  },
  'WBTC-DAI': {
    fromToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toTokenAmount: '994598657817538498364598',
    fromTokenAmount: '2315000000',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      ],
    ],
  },
  'USDC-WBTC': {
    fromToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toTokenAmount: '2345320227',
    fromTokenAmount: '1015438484233',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
          },
        ],
      ],
    ],
  },
  'WBTC-USDC': {
    fromToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toTokenAmount: '994723313785',
    fromTokenAmount: '2315000000',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      ],
    ],
  },
  'USDT-WBTC': {
    fromToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toTokenAmount: '1198017315',
    fromTokenAmount: '518137442604',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
          },
        ],
      ],
    ],
  },
  'WBTC-USDT': {
    fromToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toTokenAmount: '530345258712',
    fromTokenAmount: '1232683233',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
        ],
      ],
    ],
  },
  'LINK-WBTC': {
    fromToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toTokenAmount: '110817754',
    fromTokenAmount: '3205492879203843585856',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
          },
        ],
      ],
    ],
  },
  'WBTC-LINK': {
    fromToken: {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    toToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toTokenAmount: '3003970697051290044371',
    fromTokenAmount: '104904000',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
          },
        ],
      ],
    ],
  },
  'DAI-LINK': {
    fromToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toTokenAmount: '67593130697757529361361',
    fromTokenAmount: '1052612682406914420425892',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
          },
        ],
      ],
    ],
  },
  'LINK-DAI': {
    fromToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toTokenAmount: '955848592988970600015430',
    fromTokenAmount: '66220733349361238651909',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      ],
    ],
  },
  'USDC-LINK': {
    fromToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toTokenAmount: '67515784816640876006147',
    fromTokenAmount: '1052311164243',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
          },
        ],
      ],
    ],
  },
  'LINK-USDC': {
    fromToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toTokenAmount: '957027953200',
    fromTokenAmount: '66230999154230143176392',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      ],
    ],
  },
  'USDT-LINK': {
    fromToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toTokenAmount: '3006772259924510538833',
    fromTokenAmount: '45296010000',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
          },
        ],
      ],
    ],
  },
  'LINK-USDT': {
    fromToken: {
      symbol: 'LINK',
      name: 'Chain Link',
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    toToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toTokenAmount: '47967014250',
    fromTokenAmount: '3216370346196055379551',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
            toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
        ],
      ],
    ],
  },
  'USDC-DAI': {
    fromToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toTokenAmount: '1009792697222854778307492',
    fromTokenAmount: '1009919266085',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      ],
    ],
  },
  'DAI-USDC': {
    fromToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toTokenAmount: '1000079214741',
    fromTokenAmount: '1000155024028724525123835',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      ],
    ],
  },
  'USDT-DAI': {
    fromToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toTokenAmount: '999929961004469234589212',
    fromTokenAmount: '999845000000',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      ],
    ],
  },
  'DAI-USDT': {
    fromToken: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    toToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toTokenAmount: '1009560054967',
    fromTokenAmount: '1010056570427416241727769',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
        ],
      ],
    ],
  },
  'USDT-USDC': {
    fromToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toTokenAmount: '1000210320310',
    fromTokenAmount: '1000000000000',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      ],
    ],
  },
  'USDC-USDT': {
    fromToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    toToken: {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    toTokenAmount: '1009352825764',
    fromTokenAmount: '1009772689049',
    protocols: [
      [
        [
          {
            name: 'UNISWAP_V3',
            part: 100,
            fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            toTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
        ],
      ],
    ],
  },
}
