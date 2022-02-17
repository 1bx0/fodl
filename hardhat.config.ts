import '@atixlabs/hardhat-time-n-mine'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@openzeppelin/hardhat-upgrades'
import '@typechain/hardhat'
import dotenv from 'dotenv'
import { BigNumber, ethers } from 'ethers'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import 'hardhat-gas-reporter'
import 'hardhat-spdx-license-identifier'
import { HardhatUserConfig } from 'hardhat/types'
import 'solidity-coverage'

dotenv.config()

const ANODE_PROVIDER_URL = process.env.ANODE_PROVIDER_URL || 'please set ANODE_PROVIDER_URL to an archival node'
const GAS_PRICE = Number(process.env.GAS_PRICE) || 'auto'
const DEPLOYER_SECRET_KEY = process.env.DEPLOYER_SECRET_KEY
const BSC_DEPLOYMENT = process.env.BSC_DEPLOYMENT

const OPTIMIZER_ON_9999 = {
  version: '0.6.12',
  settings: {
    optimizer: {
      enabled: true,
      runs: 9999,
    },
  },
}

const DEPLOY_HARDHAT = ['./deploy/hardhat']
const DEPLOY_BSC = ['./deploy/bsc']

const DEPLOYMENT = BSC_DEPLOYMENT ? DEPLOY_BSC : DEPLOY_HARDHAT
const CHAIN_ID = BSC_DEPLOYMENT ? 23360 : 13360
const HARDHAT_ENDPOINT = BSC_DEPLOYMENT ? 'bsc' : 'eth'

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.4.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 9999,
          },
        },
      },
      { version: '0.6.12' },
      { version: '0.7.6' },
    ],
    overrides: {
      'contracts/Fodl/connectors/SimplePosition/IncreaseWithV3FlashswapMultihopConnector.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/connectors/SimplePosition/DecreaseWithV3FlashswapMultihopConnector.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/connectors/SimplePosition/LeverageWithV3FlashswapConnector.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/connectors/SimplePosition/SimplePositionLeveragedLendingConnector.sol': OPTIMIZER_ON_9999,
      'contracts/Staking/FodlEthSLPStaking.sol': OPTIMIZER_ON_9999,
      'contracts/Staking/FodlUsdcSLPStaking.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/core/FodlNFT.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/connectors/ResetAccountConnector.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/core/FoldingAccount.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/core/FoldingRegistryV2.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/modules/PNL/PNLStorage.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/connectors/SimplePosition/PNLConnector.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl/connectors/SetTokenURIConnector.sol': OPTIMIZER_ON_9999,
      'contracts/FodlGovernance/TimelockGovernance.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl-Bsc/connectors/SimplePosition/SimplePositionFoldingConnector.sol': OPTIMIZER_ON_9999,
      'contracts/Fodl-Bsc/modules/Exchanger/PancakeswapExchangerAdapter.sol': OPTIMIZER_ON_9999,
    },
  },
  mocha: {
    timeout: 0,
    bail: true,
    retries: 0,
  },
  etherscan: {
    apiKey: 'K2T5PAIGANRS1WCD35PXDNJ1IJB5PV2KQZ',
  },
  networks: {
    hardhat: {
      forking: {
        url: ANODE_PROVIDER_URL,
        blockNumber: parseInt(process.env.BLOCK_NUMBER_FORK || '13614397'),
      },
      blockGasLimit: 15_000_000,
      gasPrice: 'auto',
      gas: 'auto',
      accounts: {
        accountsBalance: ethers.utils.parseEther('100000000000').toString(),
      },
      mining: {
        auto: process.env.AUTOMINE?.toLowerCase() === 'false' ? false : true,
        interval: process.env.MINING_INTERVAL ? parseInt(process.env.MINING_INTERVAL) : undefined,
      },
      chainId: BigNumber.from('0x7a68').toNumber(),
      deploy: DEPLOY_HARDHAT,
    },
    mainnet: {
      url: ANODE_PROVIDER_URL,
      gas: 'auto',
      gasPrice: GAS_PRICE,
      accounts: DEPLOYER_SECRET_KEY ? [DEPLOYER_SECRET_KEY] : [],
      deploy: DEPLOY_HARDHAT,
    },
    bsc: {
      url: ANODE_PROVIDER_URL,
      gas: 'auto',
      gasPrice: Number(process.env.GAS_PRICE) || 'auto',
      accounts: DEPLOYER_SECRET_KEY ? [DEPLOYER_SECRET_KEY] : [],
      deploy: DEPLOY_BSC,
    },
    beta: {
      url: ANODE_PROVIDER_URL,
      gas: 'auto',
      gasPrice: GAS_PRICE,
      accounts: DEPLOYER_SECRET_KEY ? [DEPLOYER_SECRET_KEY] : [],
      deploy: DEPLOY_HARDHAT,
    },
    dev: {
      url: 'https://dev.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      chainId: CHAIN_ID,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    dev1: {
      url: 'https://dev1.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      chainId: CHAIN_ID + 1,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    dev2: {
      url: 'https://dev2.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      chainId: CHAIN_ID + 2,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    dev3: {
      url: 'https://dev3.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      chainId: CHAIN_ID + 3,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    sit1: {
      url: 'https://sit1.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      chainId: CHAIN_ID + 11,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    sit2: {
      chainId: CHAIN_ID + 12,
      url: 'https://sit2.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    sit3: {
      chainId: CHAIN_ID + 13,
      url: 'https://sit3.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    demo1: {
      chainId: CHAIN_ID + 21,
      url: 'https://demo1.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    demo2: {
      chainId: CHAIN_ID + 22,
      url: 'https://demo2.fodl.finance/hardhat/' + HARDHAT_ENDPOINT,
      deploy: DEPLOYMENT,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
  },
  gasReporter: {
    enabled: false,
  },
  namedAccounts: {
    deployer: 0,
    stoplossBotAccount: 1,
  },
}

export default config
