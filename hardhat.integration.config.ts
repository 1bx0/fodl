import config from './hardhat.config'

// This improves 1inch response and hardhat state so that less error happen due to differences between mainnet (1inch) state and forked state
if (!!config.networks?.hardhat?.forking?.blockNumber) config.networks.hardhat.forking.blockNumber = undefined

export default config
