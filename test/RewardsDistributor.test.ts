import { expect } from 'chai'
import { parseUnits } from 'ethers/lib/utils'
import { deployments, ethers, waffle } from 'hardhat'
import { REWARDS_TAXING_PERIOD_SECONDS } from '../constants/deploy'
import { TokenData } from '../constants/tokens'
import { FodlToken, RewardsDistributor } from '../typechain'
import { MerkleDistributorInfo, parseBalanceMap } from '../utils/merkleTree'
import { expectApproxBalanceChanges, fastForward, solidityTokenAmount2Float } from './shared/utils'
const { BigNumber } = ethers

const fixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture(['RewardsDistributor'])

  const fodlToken = (await ethers.getContract('FodlToken')) as FodlToken
  const distributor = (await ethers.getContract('RewardsDistributor')) as RewardsDistributor
  return { fodlToken, distributor }
})

const merkleRootsPublishedFixture = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture(['RewardsDistributor'])

  const fodlToken = (await ethers.getContract('FodlToken')) as FodlToken
  const distributor = (await ethers.getContract('RewardsDistributor')) as RewardsDistributor
  const fodlTokenData = await TokenData.makeFrom(fodlToken)
  await fodlToken.transfer(distributor.address, parseUnits('1000'))

  const user = waffle.provider.getWallets()[1]

  const merkleInfos = Array.from({ length: 10 }).map(() => {
    const randomBalanceMap = Object.fromEntries(
      Array.from({ length: 100 }).map(() => [
        waffle.provider.createEmptyWallet().address,
        parseUnits(Math.random().toFixed(2).toString()),
      ])
    )
    randomBalanceMap[user.address] = parseUnits('100')
    return parseBalanceMap(randomBalanceMap)
  })
  await Promise.all(
    merkleInfos.map((info) => distributor.publishMerkleRoot(info.merkleRoot, REWARDS_TAXING_PERIOD_SECONDS, ''))
  )
  return { distributor, fodlToken, fodlTokenData, user, merkleInfos }
})

describe('RewardsDistributor', () => {
  let [wallet0, wallet1, wallet2] = waffle.provider.getWallets()
  let fodlToken: FodlToken, distributor: RewardsDistributor

  before(async () => {
    ;({ fodlToken, distributor } = await fixture())
  })

  describe('token()', () => {
    it('returns the token address', async () => {
      expect(await distributor.token()).to.eq(fodlToken.address)
    })
  })

  describe('treasury()', () => {
    it('returns the initial treasury address', async () => {
      expect(await distributor.treasury()).to.eq(wallet0.address)
    })

    it('cannot set treasury to 0', async () => {
      await expect(distributor.setTreasury(ethers.constants.AddressZero)).to.be.revertedWith('Cannot set treasury to 0')
    })

    it('owner can set treasury', async () => {
      await expect(distributor.connect(wallet0).setTreasury(wallet1.address)).to.not.be.reverted
      expect(await distributor.treasury()).to.eq(wallet1.address)
    })

    it('non-owner cannot set treasury', async () => {
      await expect(distributor.connect(wallet1).setTreasury(wallet0.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('recoverERC20()', () => {
    it('non owner cannot call', async () => {
      await expect(distributor.connect(wallet1).recoverERC20(fodlToken.address, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('owner can call', async () => {
      await fodlToken.transfer(distributor.address, 100)
      await expect(distributor.recoverERC20(fodlToken.address, 0)).to.not.be.reverted

      await expect(() => distributor.recoverERC20(fodlToken.address, 10)).to.changeTokenBalance(fodlToken, wallet0, 10)
    })
  })

  describe('merkle roots', () => {
    let merkleRootOf3: string, merkleRootOf100: string
    let claimsOf3: {
      [account: string]: {
        amount: string
        proof: string[]
      }
    }
    let claimsOf100: {
      [account: string]: {
        amount: string
        proof: string[]
      }
    }

    before(async () => {
      const balanceMapOf3 = {
        [wallet0.address]: parseUnits('300'),
        [wallet1.address]: parseUnits('300'),
        [wallet2.address]: parseUnits('250'),
      }

      const balanceMapOf100 = Object.fromEntries(
        Array.from({ length: 100 }).map((i) => [waffle.provider.createEmptyWallet().address, parseUnits('100')])
      )
      balanceMapOf100[wallet1.address] = parseUnits('100')
      ;({ merkleRoot: merkleRootOf3, claims: claimsOf3 } = parseBalanceMap(balanceMapOf3))
      ;({ merkleRoot: merkleRootOf100, claims: claimsOf100 } = parseBalanceMap(balanceMapOf100))
    })

    describe('publishing and schedule', () => {
      it('schedule for inexistent merkle root is 0', async () => {
        expect(await distributor.schedule(merkleRootOf3)).to.deep.eq([BigNumber.from(0), BigNumber.from(0)])
      })

      it('non owner cannot publish merkle root', async () => {
        await expect(
          distributor.connect(wallet1).publishMerkleRoot(merkleRootOf3, REWARDS_TAXING_PERIOD_SECONDS, 'first epoch')
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('publishing merkle root sets schedule', async () => {
        await expect(distributor.publishMerkleRoot(merkleRootOf3, REWARDS_TAXING_PERIOD_SECONDS, 'first epoch'))
          .to.emit(distributor, 'NewMerkleRoot')
          .withArgs(merkleRootOf3, 'first epoch')

        const lastBlockTime = (await ethers.provider.getBlock('latest')).timestamp
        expect(await distributor.schedule(merkleRootOf3)).to.deep.eq([
          BigNumber.from(lastBlockTime),
          BigNumber.from(REWARDS_TAXING_PERIOD_SECONDS),
        ])
      })

      it('cannot publish same merkle root', async () => {
        await expect(
          distributor.publishMerkleRoot(merkleRootOf3, REWARDS_TAXING_PERIOD_SECONDS, 'second epoch')
        ).to.be.revertedWith('Merkle root duplicate')
      })

      it('publishing another merkle root sets schedule', async () => {
        await expect(distributor.publishMerkleRoot(merkleRootOf100, REWARDS_TAXING_PERIOD_SECONDS, 'second epoch'))
          .to.emit(distributor, 'NewMerkleRoot')
          .withArgs(merkleRootOf100, 'second epoch')
        const lastBlockTime = (await ethers.provider.getBlock('latest')).timestamp
        expect(await distributor.schedule(merkleRootOf100)).to.deep.eq([
          BigNumber.from(lastBlockTime),
          BigNumber.from(REWARDS_TAXING_PERIOD_SECONDS),
        ])
      })
    })

    describe('claiming a single merkle root', () => {
      let fodlTokenData: TokenData
      beforeEach(async () => {
        ;({ fodlToken, distributor } = await fixture())
        fodlTokenData = await TokenData.makeFrom(fodlToken)
        await fodlToken.transfer(distributor.address, parseUnits('1000'))
        await distributor.publishMerkleRoot(merkleRootOf3, REWARDS_TAXING_PERIOD_SECONDS, 'first epoch')
      })

      it('cannot claim with unpublished merkle root', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        await expect(
          distributor.connect(wallet1).claim(ethers.constants.MaxUint256, [
            {
              merkleRoot: merkleRootOf100,
              amountAvailable: BigNumber.from(claimsOf100[wallet1.address].amount),
              merkleProof: claimsOf100[wallet1.address].proof,
            },
          ])
        ).to.be.revertedWith('This merkle root does not exist')
      })

      it('cannot claim with invalid proof', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        await expect(
          distributor.connect(wallet1).claim(ethers.constants.MaxUint256, [
            {
              merkleRoot: merkleRootOf100,
              amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
              merkleProof: claimsOf3[wallet1.address].proof,
            },
          ])
        ).to.be.revertedWith('Invalid merkle proof')
      })

      it('can fully claim before the taxing period end', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(ethers.constants.MaxUint256, [
              {
                merkleRoot: merkleRootOf3,
                amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
                merkleProof: claimsOf3[wallet1.address].proof,
              },
            ]),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [
            solidityTokenAmount2Float(fodlTokenData, BigNumber.from(claimsOf3[wallet1.address].amount).div(2)),
            solidityTokenAmount2Float(fodlTokenData, BigNumber.from(claimsOf3[wallet1.address].amount).div(2)),
          ],
          0.0001
        )
      })

      it('cannot claim same root twice ', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        await distributor.connect(wallet1).claim(ethers.constants.MaxUint256, [
          {
            merkleRoot: merkleRootOf3,
            amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
            merkleProof: claimsOf3[wallet1.address].proof,
          },
        ])

        await expect(
          distributor.connect(wallet1).claim(ethers.constants.MaxUint256, [
            {
              merkleRoot: merkleRootOf3,
              amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
              merkleProof: claimsOf3[wallet1.address].proof,
            },
          ])
        ).to.be.revertedWith('This merkle root was already claimed')
      })

      it('can partially claim before the taxing period end', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        const amountToClaim = BigNumber.from(claimsOf3[wallet1.address].amount).div(2)

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(amountToClaim, [
              {
                merkleRoot: merkleRootOf3,
                amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
                merkleProof: claimsOf3[wallet1.address].proof,
              },
            ]),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [
            solidityTokenAmount2Float(fodlTokenData, amountToClaim.div(2)),
            solidityTokenAmount2Float(fodlTokenData, amountToClaim.div(2)),
          ],
          0.0001
        )
      })

      it('can claim more after a partial claim before the taxing period end', async () => {
        const amountToClaim = BigNumber.from(claimsOf3[wallet1.address].amount).div(2)

        await distributor.connect(wallet1).claim(amountToClaim, [
          {
            merkleRoot: merkleRootOf3,
            amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
            merkleProof: claimsOf3[wallet1.address].proof,
          },
        ])

        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(amountToClaim, [
              {
                merkleRoot: merkleRootOf3,
                amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
                merkleProof: claimsOf3[wallet1.address].proof,
              },
            ]),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [
            solidityTokenAmount2Float(fodlTokenData, amountToClaim.div(2)),
            solidityTokenAmount2Float(fodlTokenData, amountToClaim.div(2)),
          ],
          0.0001
        )
      })

      it('can fully claim after the taxing period end', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS)

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(ethers.constants.MaxUint256, [
              {
                merkleRoot: merkleRootOf3,
                amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
                merkleProof: claimsOf3[wallet1.address].proof,
              },
            ]),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [solidityTokenAmount2Float(fodlTokenData, BigNumber.from(claimsOf3[wallet1.address].amount)), 0],
          0.0001
        )
      })

      it('can partially claim after the taxing period end', async () => {
        const amountToClaim = BigNumber.from(claimsOf3[wallet1.address].amount).div(2)
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS)

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(amountToClaim, [
              {
                merkleRoot: merkleRootOf3,
                amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
                merkleProof: claimsOf3[wallet1.address].proof,
              },
            ]),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [solidityTokenAmount2Float(fodlTokenData, amountToClaim), 0],
          0.0001
        )
      })

      it('can claim more after a partial claim after the taxing period end', async () => {
        const amountToClaim = BigNumber.from(claimsOf3[wallet1.address].amount).div(2)

        await distributor.connect(wallet1).claim(amountToClaim, [
          {
            merkleRoot: merkleRootOf3,
            amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
            merkleProof: claimsOf3[wallet1.address].proof,
          },
        ])

        await fastForward(REWARDS_TAXING_PERIOD_SECONDS)

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(amountToClaim, [
              {
                merkleRoot: merkleRootOf3,
                amountAvailable: BigNumber.from(claimsOf3[wallet1.address].amount),
                merkleProof: claimsOf3[wallet1.address].proof,
              },
            ]),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [solidityTokenAmount2Float(fodlTokenData, amountToClaim), 0],
          0.0001
        )
      })
    })

    describe('claiming multiple merkle roots', () => {
      let fodlTokenData: TokenData
      let merkleInfos: MerkleDistributorInfo[]

      //fixture
      beforeEach(async () => {
        ;({ distributor, fodlToken, fodlTokenData, user: wallet1, merkleInfos } = await merkleRootsPublishedFixture())
      })

      it('can fully claim before the taxing period end', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        const amountAvailableAgg = merkleInfos.reduce(
          (acc, cur) => acc.add(BigNumber.from(cur.claims[wallet1.address].amount)),
          BigNumber.from(0)
        )

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(
              ethers.constants.MaxUint256,
              merkleInfos.map((info) => ({
                merkleRoot: info.merkleRoot,
                amountAvailable: BigNumber.from(info.claims[wallet1.address].amount),
                merkleProof: info.claims[wallet1.address].proof,
              }))
            ),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [
            solidityTokenAmount2Float(fodlTokenData, amountAvailableAgg.div(2)),
            solidityTokenAmount2Float(fodlTokenData, amountAvailableAgg.div(2)),
          ],
          0.0001
        )
      })

      it('can partially claim before the taxing period end', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS / 2)

        const amountAvailableAgg = merkleInfos.reduce(
          (acc, cur) => acc.add(BigNumber.from(cur.claims[wallet1.address].amount)),
          BigNumber.from(0)
        )

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(
              amountAvailableAgg.div(2),
              merkleInfos.map((info) => ({
                merkleRoot: info.merkleRoot,
                amountAvailable: BigNumber.from(info.claims[wallet1.address].amount),
                merkleProof: info.claims[wallet1.address].proof,
              }))
            ),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [
            solidityTokenAmount2Float(fodlTokenData, amountAvailableAgg.div(4)),
            solidityTokenAmount2Float(fodlTokenData, amountAvailableAgg.div(4)),
          ],
          0.0001
        )
      })

      it('can fully claim after the taxing period end', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS)

        const amountAvailableAgg = merkleInfos.reduce(
          (acc, cur) => acc.add(BigNumber.from(cur.claims[wallet1.address].amount)),
          BigNumber.from(0)
        )

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(
              ethers.constants.MaxUint256,
              merkleInfos.map((info) => ({
                merkleRoot: info.merkleRoot,
                amountAvailable: BigNumber.from(info.claims[wallet1.address].amount),
                merkleProof: info.claims[wallet1.address].proof,
              }))
            ),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [solidityTokenAmount2Float(fodlTokenData, amountAvailableAgg), 0],
          0.0001
        )
      })

      it('can partially claim after the taxing period end', async () => {
        await fastForward(REWARDS_TAXING_PERIOD_SECONDS)

        const amountAvailableAgg = merkleInfos.reduce(
          (acc, cur) => acc.add(BigNumber.from(cur.claims[wallet1.address].amount)),
          BigNumber.from(0)
        )

        await expectApproxBalanceChanges(
          () =>
            distributor.connect(wallet1).claim(
              amountAvailableAgg.div(2),
              merkleInfos.map((info) => ({
                merkleRoot: info.merkleRoot,
                amountAvailable: BigNumber.from(info.claims[wallet1.address].amount),
                merkleProof: info.claims[wallet1.address].proof,
              }))
            ),
          fodlTokenData,
          [wallet1.address, wallet0.address],
          [solidityTokenAmount2Float(fodlTokenData, amountAvailableAgg.div(2)), 0],
          0.0001
        )
      })
    })
  })
})
