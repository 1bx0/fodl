import '@openzeppelin/hardhat-upgrades'
import '@typechain/hardhat'
import * as dotenv from 'dotenv'
import { ethers } from 'ethers'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import { HardhatUserConfig } from 'hardhat/types'
import baseConfig from './hardhat.config'
dotenv.config()

const ANODE_PROVIDER_URL = process.env.ANODE_PROVIDER_URL

if (!ANODE_PROVIDER_URL) {
  throw new Error('please set ANODE_PROVIDER_URL to an archival node')
}

const config: HardhatUserConfig = {
  ...baseConfig,
  solidity: {
    compilers: [{ version: '0.6.12' }],
  },
  networks: {
    hardhat: {
      forking: {
        url: ANODE_PROVIDER_URL,
        // blockNumber: parseInt(process.env.BLOCK_NUMBER_FORK || ''),
      },
      accounts: {
        accountsBalance: ethers.utils.parseEther('100000000000').toString(),
      },
      blockGasLimit: parseInt(process.env.BLOCK_GAS_LIMIT || '15000000'),
      gasPrice: 'auto',
      gas: 'auto',
      deploy: ['./deploy/polygon'],
      chainId: 137,
    },
  },
  paths: {
    tests: 'test-polygon',
  },
  namedAccounts: {
    deployer: 0,
    stoplossBotAccount: 1,
  },
  mocha: {
    timeout: 0,
  },
  gasReporter: {
    enabled: false,
    gasPriceApi: 'https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice',
    token: 'MATIC',
  },
}

export default config
