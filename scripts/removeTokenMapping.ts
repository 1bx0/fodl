import { ChainId } from '@sushiswap/sdk'
import { Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { COMPOUND_PLATFORM, VENUS_PLATFORM } from '../constants/deploy'
import { FoldingRegistry__factory } from '../typechain'

const { FOLDING_REGISTRY, DEPLOYER_SECRET_KEY, PRIVATE_KEY, TOKEN } = process.env
const privateKey = DEPLOYER_SECRET_KEY || PRIVATE_KEY

const main = async () => {
  const wallet = new Wallet(privateKey!, ethers.provider)
  const registry = FoldingRegistry__factory.connect(FOLDING_REGISTRY!, wallet)

  const { chainId } = await ethers.provider.getNetwork()

  let platform: string

  switch (chainId) {
    case ChainId.MAINNET:
      platform = COMPOUND_PLATFORM
      break
    case ChainId.BSC:
      platform = VENUS_PLATFORM
      break
    default:
      throw new Error(`Wrong chain id ${chainId}`)
  }

  await registry.removeCTokenFromPlatform(platform, TOKEN!).then((tx) => tx.wait())

  console.log(`${TOKEN} removed`)
}

main()
  .catch(console.error)
  .finally(() => process.exit())
