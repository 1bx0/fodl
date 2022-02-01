import axios from 'axios'
import { ethers } from 'hardhat'

const SECONDS_IN_AN_HOUR = 60 * 60
const MILLIS = 1000
const HOURS_IN_A_WEEK = 24 * 7
const SECONDS_IN_A_WEEK = HOURS_IN_A_WEEK * SECONDS_IN_AN_HOUR
const FODL_REWARDS_START_TIME = new Date('2021-10-28').getTime() / MILLIS

export const run = async () => {
  const latestBlock = await ethers.provider.getBlock('latest')

  const firstBlockNumber = 13724083
  const firstBlock = await ethers.provider.getBlock(firstBlockNumber)

  // Find the date one week after the firstBlock
  const date = new Date((firstBlock.timestamp + SECONDS_IN_AN_HOUR) * MILLIS)
  date.setUTCHours(0, 0, 0, 0)

  // Timestamps we are interested in
  const timestamps: number[] = []
  while (date.getTime() < latestBlock.timestamp * MILLIS) {
    timestamps.push(Math.floor(date.getTime() / MILLIS))
    date.setUTCHours(HOURS_IN_A_WEEK)
  }
  console.log('timestamps', timestamps)

  const blocks = await Promise.all(timestamps.map((timestamp) => firstBlockAfter(timestamp)))
  console.log(
    blocks.map(
      (block) =>
        `${new Date(block.timestamp * MILLIS).toUTCString()} (${block.number}) -> ${getFodlForWeek(
          Number(block.timestamp)
        )} FODL`
    )
  )
}

const firstBlockAfter = async (timestamp: number) =>
  axios
    .post<{ data: { blocks: { number: number; timestamp: number }[] } }>(
      'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
      {
        query: `query {
          blocks(
            first: 1, 
            orderBy: timestamp, orderDirection: asc, 
            where: {timestamp_gt: ${timestamp}}
          ) {
            number
            timestamp
          }
        }`,
      }
    )
    .then((res) => res.data.data.blocks[0] || { number: 0, timestamp: 0 })

export const getFodlForWeek = (timestamp: number) => {
  const x = Math.ceil((timestamp + SECONDS_IN_A_WEEK / 2 - FODL_REWARDS_START_TIME) / SECONDS_IN_A_WEEK)
  console.log('week number:', x)
  return Math.floor((90000000 / 27114.7073085399) * Math.pow(x + 1, -Math.E / 10) * (1200 - x))
}

run()
  .catch(console.error)
  .finally(() => process.exit(0))
