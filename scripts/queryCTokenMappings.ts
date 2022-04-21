import { ChainId } from '@sushiswap/sdk'
import { ethers } from 'hardhat'
import {
  COMPOUND_PLATFORM,
  COMPOUND_TOKENS_TO_CTOKENS,
  VENUS_PLATFORM,
  VENUS_TOKENS_TO_VTOKENS,
} from '../constants/deploy'
import { FoldingRegistry__factory } from '../typechain'

const fodlTokenAddress = process.env.FOLDING_REGISTRY || ''

async function main(): Promise<any> {
  const registry = FoldingRegistry__factory.connect(fodlTokenAddress, ethers.provider)

  const { chainId } = await ethers.provider.getNetwork()

  let tokenMapping: { [address: string]: string }
  let platform: string
  switch (chainId) {
    case ChainId.MAINNET:
      tokenMapping = COMPOUND_TOKENS_TO_CTOKENS
      platform = COMPOUND_PLATFORM
      break
    case ChainId.BSC:
      tokenMapping = VENUS_TOKENS_TO_VTOKENS
      platform = VENUS_PLATFORM
      break
    default:
      throw new Error(`Invalid chain ID`)
  }

  const promises = Object.keys(tokenMapping).map(async (token) => {
    const registeredMapping = await registry.getCToken(platform, token).catch((error) => {
      if (`${error?.error}`.includes('FR9')) return null
      else throw new Error(error)
    })
    const correctMapping = tokenMapping[token].toLowerCase()
    if (registeredMapping && registeredMapping.toLowerCase() === correctMapping) {
      console.log(`\t> Token ${token} is correctly mapped`)
    } else {
      console.log(
        `\t> Token ${token} is not correctly mapped. Received ${registeredMapping} and should be ${correctMapping}`
      )
    }
  })

  await Promise.all(promises)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
