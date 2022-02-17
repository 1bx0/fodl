import '@typechain/hardhat'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import '@openzeppelin/hardhat-upgrades'
import { HardhatUserConfig } from 'hardhat/types'
import baseConfig from './hardhat.config'
import * as dotenv from 'dotenv'
import { ethers } from 'ethers'
dotenv.config()

const ANODE_PROVIDER_URL = process.env.ANODE_PROVIDER_URL

if (!ANODE_PROVIDER_URL) {
  throw new Error('please set ANODE_PROVIDER_URL to an archival node')
}

const config: HardhatUserConfig = {
  ...baseConfig,
  solidity: {
    compilers: [{ version: '0.6.12' }, { version: '0.7.6' }],
  },
  networks: {
    hardhat: {
      forking: {
        url: ANODE_PROVIDER_URL,
        // blockNumber: parseInt(process.env.BLOCK_NUMBER_FORK || '13614397'),
      },
      accounts: {
        accountsBalance: ethers.utils.parseEther('100000000000').toString(),
      },
      blockGasLimit: 15_000_000,
      gasPrice: 'auto',
      gas: 'auto',
      deploy: ['./deploy/bsc'],
    },
  },
  paths: {
    tests: 'test-bsc',
  },
  namedAccounts: {
    deployer: 0,
    stoplossBotAccount: 1,
  },
  mocha: {
    timeout: 0,
  },
}

export default config
