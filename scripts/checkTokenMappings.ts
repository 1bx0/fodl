import { ChainId } from '@sushiswap/sdk'
import { ethers } from 'hardhat'
import {
  COMPOUND_PLATFORM,
  COMPOUND_TOKENS_TO_CTOKENS,
  VENUS_PLATFORM,
  VENUS_TOKENS_TO_VTOKENS,
} from '../constants/deploy'
import { FoldingRegistry__factory } from '../typechain'

const { FOLDING_REGISTRY } = process.env

const main = async () => {
  const registry = FoldingRegistry__factory.connect(FOLDING_REGISTRY!, ethers.provider)

  const { chainId } = await ethers.provider.getNetwork()

  let tokenMappings: { [address: string]: string } = {}
  let platform: string

  switch (chainId) {
    case ChainId.MAINNET:
      tokenMappings = COMPOUND_TOKENS_TO_CTOKENS
      platform = COMPOUND_PLATFORM
      break
    case ChainId.BSC:
      tokenMappings = VENUS_TOKENS_TO_VTOKENS
      platform = VENUS_PLATFORM
      break
    default:
      throw new Error(`Wrong chain id ${chainId}`)
  }

  for (const [token, correctCToken] of Object.entries(tokenMappings)) {
    const cToken = await registry.callStatic.getCToken(platform, token).catch(() => {
      return
    })

    if (cToken?.toLowerCase() === correctCToken?.toLowerCase()) {
      console.log(`${token} is correct`)
    } else {
      console.log(`${token} is wrong, got ${cToken}, should ${correctCToken}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit())
