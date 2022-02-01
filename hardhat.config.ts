import '@nomiclabs/hardhat-waffle'
import '@openzeppelin/hardhat-upgrades'
import '@typechain/hardhat'
import dotenv from 'dotenv'
import { BigNumber, ethers } from 'ethers'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import 'hardhat-gas-reporter'
import 'hardhat-spdx-license-identifier'
import '@atixlabs/hardhat-time-n-mine'
import { HardhatUserConfig } from 'hardhat/types'
import 'solidity-coverage'
import '@nomiclabs/hardhat-etherscan'

dotenv.config()

const ANODE_PROVIDER_URL = process.env.ANODE_PROVIDER_URL || 'please set ANODE_PROVIDER_URL to an archival node'
const GAS_PRICE = Number(process.env.GAS_PRICE) || 'auto'
const DEPLOYER_SECRET_KEY = process.env.DEPLOYER_SECRET_KEY

const OPTIMIZER_ON_9999 = {
  version: '0.6.12',
  settings: {
    optimizer: {
      enabled: true,
      runs: 9999,
    },
  },
}
const config: HardhatUserConfig = {
  solidity: {
    compilers: [{ version: '0.6.12' }, { version: '0.7.6' }],
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
    },
  },
  mocha: {
    timeout: 0,
    bail: false,
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
      blockGasLimit: 15000000,
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
    },
    mainnet: {
      url: ANODE_PROVIDER_URL,
      gas: 'auto',
      gasPrice: GAS_PRICE,
      accounts: DEPLOYER_SECRET_KEY ? [DEPLOYER_SECRET_KEY] : [],
    },
    beta: {
      url: ANODE_PROVIDER_URL,
      gas: 'auto',
      gasPrice: GAS_PRICE,
      accounts: DEPLOYER_SECRET_KEY ? [DEPLOYER_SECRET_KEY] : [],
    },
    dev: {
      url: 'https://dev.fodl.finance/hardhat',
      chainId: 13360,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    dev1: {
      url: 'https://dev1.fodl.finance/hardhat',
      chainId: 13361,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    dev2: {
      url: 'https://dev2.fodl.finance/hardhat',
      chainId: 13362,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    dev3: {
      url: 'https://dev3.fodl.finance/hardhat',
      chainId: 13363,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    sit1: {
      url: 'https://sit1.fodl.finance/hardhat',
      chainId: 13371,
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    sit2: {
      chainId: 13372,
      url: 'https://sit2.fodl.finance/hardhat',
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    sit3: {
      chainId: 13373,
      url: 'https://sit3.fodl.finance/hardhat',
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    demo1: {
      chainId: 13381,
      url: 'https://demo1.fodl.finance/hardhat',
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
    demo2: {
      chainId: 13382,
      url: 'https://demo2.fodl.finance/hardhat',
      ...(DEPLOYER_SECRET_KEY && { accounts: [DEPLOYER_SECRET_KEY] }),
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS?.toLowerCase() === 'true',
    gasPrice: 1,
  },
  namedAccounts: {
    deployer: 0,
    stoplossBotAccount: 1,
  },
}

export default config
