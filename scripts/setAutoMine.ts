import dotenv from 'dotenv'
import { network } from 'hardhat'

dotenv.config()

function setAutoMine() {
  switch (process.env.AUTOMINE?.toLowerCase()) {
    case 'false':
      return network.provider.send('evm_setAutomine', [false])
    case 'true':
      return network.provider.send('evm_setAutomine', [true])
    default:
      throw new Error(`Undefined env var AUTOMINE ${process.env.AUTOMINE}`)
  }
}

setAutoMine().catch(console.error)
