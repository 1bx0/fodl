import { BigNumber } from '@ethersproject/bignumber'
import axios from 'axios'
import dotenv from 'dotenv'
import { ethers } from 'hardhat'
import { Pool } from 'pg'
import { exit } from 'process'
import { REWARDS_TAXING_PERIOD_SECONDS } from '../constants/deploy'
import { RewardsDistributor__factory } from '../typechain'
import { parseBalanceMap, RewardsDistribution } from '../utils/merkleTree'

dotenv.config()

const prompt = require('prompt-async')

// Start the prompt.
prompt.start()

const rewardsDistributorAddress = '0xdE874ad7cE27b6A01a996a03e5E1b81305aC6837'
const CONFIRMATIONS = 5
const BACKEND_URL = 'https://api.fodl.finance'

const headers = {}
headers['x-forwarded-for'] = process.env.IP

type WeekInput = { fodl: BigNumber; fromBlock: number }

const PERIODS: WeekInput[] = [
  // FIRST ROOT:
  // { fodl: ethers.utils.parseUnits('527409'), fromBlock: 13502421 },
  // { fodl: ethers.utils.parseUnits('2359877'), fromBlock: 13546975 },
  // { fodl: ethers.utils.parseUnits('3112714'), fromBlock: 13591594 },
  // SECOND ROOT:
  // { fodl: ethers.utils.parseUnits('4100992'), fromBlock: 13636021 },
  // { fodl: ethers.utils.parseUnits('4472861'), fromBlock: 13680218 },
  // THIRD ROOT:
  // { fodl: ethers.utils.parseUnits('2335180'), fromBlock: 13724083 },
  // { fodl: ethers.utils.parseUnits('2250052'), fromBlock: 13767793 },
  // { fodl: ethers.utils.parseUnits('2177327'), fromBlock: 13812868 },
  // { fodl: ethers.utils.parseUnits('2114078'), fromBlock: 13858107 },
  // FOURTH ROOT:
  { fodl: ethers.utils.parseUnits('2058281'), fromBlock: 13903355 },
  { fodl: ethers.utils.parseUnits('2008480'), fromBlock: 13948582 },
  { fodl: ethers.utils.parseUnits('1963599'), fromBlock: 13993833 },
  { fodl: ethers.utils.parseUnits('1922819'), fromBlock: 14039104 },
  // FIFTH ROOT:
  { fodl: ethers.utils.parseUnits('1885504'), fromBlock: 14084333 },
]

export const run = async () => {
  const db = new Pool()
  const periodIndexes = Array.from({ length: PERIODS.length - 1 }).map((_, i) => i)
  const distribution: RewardsDistribution = {}

  const safeUVLs = await Promise.all(
    periodIndexes.map((i) => getWeekUVLs(db, PERIODS[i].fromBlock, PERIODS[i + 1].fromBlock, true))
  )
  processWeeks(safeUVLs, 20).forEach((d) => {
    for (let [owner, fodl] of Object.entries(d)) {
      if (!distribution[owner]) distribution[owner] = BigNumber.from(0)
      distribution[owner] = distribution[owner].add(fodl)
    }
  })

  const riskyUVLs = await Promise.all(
    periodIndexes.map((i) => getWeekUVLs(db, PERIODS[i].fromBlock, PERIODS[i + 1].fromBlock, false))
  )
  processWeeks(riskyUVLs, 80).forEach((d) => {
    for (let [owner, fodl] of Object.entries(d)) {
      if (!distribution[owner]) distribution[owner] = BigNumber.from(0)
      distribution[owner] = distribution[owner].add(fodl)
    }
  })

  const merkleInfo = parseBalanceMap(distribution)
  console.log(
    `Distribution: [${Object.entries(merkleInfo.claims).map(
      ([o, v]) => `\n${o} \t ${ethers.utils.formatUnits(BigNumber.from(v.amount))}`
    )}
    ],
    Root: ${merkleInfo.merkleRoot},
    Total: ${ethers.utils.formatUnits(BigNumber.from(merkleInfo.tokenTotal))},
    fromBlock (inclusive): ${PERIODS[0].fromBlock},
    toBlock (exclusive): ${PERIODS[PERIODS.length - 1].fromBlock}`
  )

  const { confirm } = await prompt.get('confirm')
  if (confirm != 'yes') exit()

  const signer = (await ethers.getSigners())[0]
  const rewardsDistributor = RewardsDistributor__factory.connect(rewardsDistributorAddress, signer)

  if ((await rewardsDistributor.callStatic.schedule(merkleInfo.merkleRoot)).startTime.isZero()) {
    console.log(`Publishing merkle root to SC.`)
    const tx = await rewardsDistributor.publishMerkleRoot(
      merkleInfo.merkleRoot,
      REWARDS_TAXING_PERIOD_SECONDS,
      `${PERIODS[0].fromBlock}->${PERIODS[PERIODS.length - 1].fromBlock - 1}`
    )
    console.log(`Waiting for ${CONFIRMATIONS} confirmations for:`, tx)
    await tx.wait(CONFIRMATIONS)
  } else {
    console.log('Root already exists in SC.')
  }

  console.log(`Publishing data to backend service.`)
  const response = await axios.post(BACKEND_URL + `/distribution`, distribution, { headers })
  console.log('status', response.status, 'data', response.data)
  //TODO: we should publish this distribution on IPFS
}

type WeekUVLs = { [block: number]: RewardsDistribution }

// firstBlock is inclusive, but toBlock is exclusive
const getWeekUVLs = async (db: Pool, firstBlock: number, toBlock: number, safe: boolean): Promise<WeekUVLs> => {
  const modifierForSafe = safe ? '' : 'NOT'
  const label = modifierForSafe + ' safe' + Math.random()

  console.time(label)
  const res = await db.query(
    `SELECT block, owner.address as "owner", SUM(value_locked) as "value"
    FROM positions
    LEFT JOIN owners AS owner ON owner.id = positions.owner
    WHERE block >= $1 AND block < $2 
      AND ${modifierForSafe} (supply_token = borrow_token 
        OR (supply_token in (1, 24, 57) AND borrow_token in (1, 24, 57))
      )
    GROUP BY (block, owner.address);
  `,
    [firstBlock, toBlock]
  )
  console.timeEnd(label)
  //console.log(res.rows)

  const week: WeekUVLs = {}
  res.rows.forEach((row) => {
    if (!week[row.block]) week[row.block] = {}
    week[row.block][row.owner] = BigNumber.from(row.value)
  })
  return week
}

function processWeeks(weeks: WeekUVLs[], percentage: number): RewardsDistribution[] {
  return weeks.flatMap((week, i) => {
    const fodlPerBlock = PERIODS[i].fodl.mul(percentage).div(100).div(Object.keys(week).length)
    return Object.values(week).map((uvls: RewardsDistribution) => {
      const tvl = Object.values(uvls).reduce((acc, uvl) => acc.add(uvl), BigNumber.from(0))
      return Object.fromEntries(Object.entries(uvls).map(([owner, uvl]) => [owner, fodlPerBlock.mul(uvl).div(tvl)]))
    })
  })
}

run()
  .catch(console.error)
  .finally(() => process.exit(0))
