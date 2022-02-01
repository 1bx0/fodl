import dotenv from 'dotenv'
import { mine } from '../test/shared/utils'

dotenv.config()

const numberOfBlocks: number = parseInt(process.env.MINE || '0')

export const mineBlocks = async () => {
  await mine(numberOfBlocks)
}

mineBlocks().catch(console.error)
