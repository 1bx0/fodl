import { expect } from 'chai'
import { deployments } from 'hardhat'
import { AAVE_PLATFORM, COMPOUND_PLATFORM } from '../constants/deploy'
import { USDC, USDT } from '../constants/tokens'
import { FoldingRegistry, LendingPlatformLens } from '../typechain'

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture()

  const lendingPlatformLens = (await ethers.getContract('LendingPlatformLens')) as LendingPlatformLens
  const foldingRegistry = (await ethers.getContract('FoldingRegistry')) as FoldingRegistry

  return { lendingPlatformLens, foldingRegistry }
})

// TODO: Tests don't check all details because this is mostly for UI purposes and each value might change while integrating. However, once established we should add more tests.
describe('LendingPlatformLens', async () => {
  let lendingPlatformLens: LendingPlatformLens
  let foldingRegistry: FoldingRegistry

  before('Deploy', async () => {
    ;({ foldingRegistry, lendingPlatformLens } = await fixture())
  })

  it('Initializes with registry address', async () => {
    expect(await lendingPlatformLens.foldingRegistry()).to.equal(foldingRegistry.address)
  })

  it('Gets a token meta from AAVE', async () => {
    const [metadata] = await lendingPlatformLens.callStatic.getAssetMetadata([AAVE_PLATFORM], [USDT.address])
    //console.log(metadata)
    expect(metadata.assetSymbol).to.equal('USDT')
  })

  it('Gets 2 tokens meta from AAVE', async () => {
    const metadata = await lendingPlatformLens.callStatic.getAssetMetadata(
      [AAVE_PLATFORM, AAVE_PLATFORM],
      [USDT.address, USDC.address]
    )
    expect(metadata.length).to.equal(2)
    expect(metadata[0].assetSymbol).to.equal('USDT')
  })

  it('Gets a token meta from Compound', async () => {
    const [metadata] = await lendingPlatformLens.callStatic.getAssetMetadata([COMPOUND_PLATFORM], [USDT.address])
    //console.log(metadata)
    expect(metadata.assetSymbol).to.equal('USDT')
  })
})
