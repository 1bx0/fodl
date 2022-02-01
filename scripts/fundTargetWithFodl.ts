import { ethers } from 'hardhat'
import { FodlToken__factory } from '../typechain'

const fodlTokenAddress = process.env.FODL_TOKEN_ADDRESS || ''
const target = process.env.TARGET || ''
const amount = ethers.utils.parseUnits(process.env.AMOUNT || '100', 18)

async function main(): Promise<any> {
  const fodl = FodlToken__factory.connect(fodlTokenAddress, ethers.provider.getSigner())
  console.log(`${target} balance before funding is: ${await fodl.balanceOf(target)}`)
  await fodl.transfer(target, amount)
  console.log(`${target} balance after funding is: ${await fodl.balanceOf(target)}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
