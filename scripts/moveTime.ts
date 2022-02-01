import { ethers, network } from 'hardhat'
import { ONE_DAY_SECONDS } from '../constants/deploy'
import { mine } from '../test/shared/utils'

export const run = async () => {
  await network.provider.send('evm_setNextBlockTimestamp', [
    Number(process.env.FF || ONE_DAY_SECONDS * 7) + (await ethers.provider.getBlock('latest')).timestamp,
  ])
  await mine()
  console.log(await ethers.provider.getBlock('latest'))
}

run().catch(console.error)
