import { bufferToHex, keccak256 } from 'ethereumjs-util'
import { BigNumber, utils } from 'ethers'

class MerkleTree {
  private readonly elements: Buffer[]
  private readonly bufferElementPositionIndex: { [hexElement: string]: number }
  private readonly layers: Buffer[][]

  constructor(elements: Buffer[]) {
    this.elements = [...elements]
    // Sort elements
    this.elements.sort(Buffer.compare)
    // Deduplicate elements
    this.elements = MerkleTree.bufDedup(this.elements)

    this.bufferElementPositionIndex = this.elements.reduce<{ [hexElement: string]: number }>((memo, el, index) => {
      memo[bufferToHex(el)] = index
      return memo
    }, {})

    // Create layers
    this.layers = this.getLayers(this.elements)
  }

  getLayers(elements: Buffer[]): Buffer[][] {
    if (elements.length === 0) {
      throw new Error('empty tree')
    }

    const layers: Buffer[][] = []
    layers.push(elements)

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]))
    }

    return layers
  }

  getNextLayer(elements: Buffer[]): Buffer[] {
    return elements.reduce<Buffer[]>((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(MerkleTree.combinedHash(el, arr[idx + 1]))
      }

      return layer
    }, [])
  }

  static combinedHash(first: Buffer, second: Buffer): Buffer {
    if (!first) {
      return second
    }
    if (!second) {
      return first
    }

    return keccak256(MerkleTree.sortAndConcat(first, second))
  }

  getRoot(): Buffer {
    return this.layers[this.layers.length - 1][0]
  }

  getHexRoot(): string {
    return bufferToHex(this.getRoot())
  }

  getProof(el: Buffer) {
    let idx = this.bufferElementPositionIndex[bufferToHex(el)]

    if (typeof idx !== 'number') {
      throw new Error('Element does not exist in Merkle tree')
    }

    return this.layers.reduce((proof, layer) => {
      const pairElement = MerkleTree.getPairElement(idx, layer)

      if (pairElement) {
        proof.push(pairElement)
      }

      idx = Math.floor(idx / 2)

      return proof
    }, [])
  }

  getHexProof(el: Buffer): string[] {
    const proof = this.getProof(el)

    return MerkleTree.bufArrToHexArr(proof)
  }

  private static getPairElement(idx: number, layer: Buffer[]): Buffer | null {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1

    if (pairIdx < layer.length) {
      return layer[pairIdx]
    } else {
      return null
    }
  }

  private static bufDedup(elements: Buffer[]): Buffer[] {
    return elements.filter((el, idx) => {
      return idx === 0 || !elements[idx - 1].equals(el)
    })
  }

  private static bufArrToHexArr(arr: Buffer[]): string[] {
    if (arr.some((el) => !Buffer.isBuffer(el))) {
      throw new Error('Array is not an array of buffers')
    }

    return arr.map((el) => '0x' + el.toString('hex'))
  }

  private static sortAndConcat(...args: Buffer[]): Buffer {
    return Buffer.concat([...args].sort(Buffer.compare))
  }
}

export default class BalanceTree {
  private readonly tree: MerkleTree
  constructor(balances: { account: string; amount: BigNumber }[]) {
    this.tree = new MerkleTree(
      balances.map(({ account, amount }) => {
        return BalanceTree.toNode(account, amount)
      })
    )
  }

  public static verifyProof(account: string, amount: BigNumber, proof: Buffer[], root: Buffer): boolean {
    let pair = BalanceTree.toNode(account, amount)
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item)
    }

    return pair.equals(root)
  }

  public static toNode(account: string, amount: BigNumber): Buffer {
    return Buffer.from(utils.solidityKeccak256(['address', 'uint256'], [account, amount]).substr(2), 'hex')
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot()
  }

  // returns the hex bytes32 values of the proof
  public getProof(account: string, amount: BigNumber): string[] {
    return this.tree.getHexProof(BalanceTree.toNode(account, amount))
  }
}

// This is the blob that gets distributed and pinned to IPFS.
// It is completely sufficient for recreating the entire merkle tree.
// Anyone can verify that all air drops are included in the tree,
// and the tree has no additional distributions.
export interface MerkleDistributorInfo {
  merkleRoot: string
  tokenTotal: string
  claims: {
    [account: string]: {
      amount: string
      proof: string[]
    }
  }
}

export type RewardsDistribution = { [account: string]: BigNumber }

export function parseBalanceMap(balances: RewardsDistribution): MerkleDistributorInfo {
  const sortedAddresses = Object.keys(balances).sort()

  // construct a tree
  const tree = new BalanceTree(sortedAddresses.map((address) => ({ account: address, amount: balances[address] })))

  // generate claims
  const claims = sortedAddresses.reduce((memo, address) => {
    const amount = balances[address]
    memo[address] = {
      amount: amount.toHexString(),
      proof: tree.getProof(address, amount),
    }
    return memo
  }, {})

  const tokenTotal: BigNumber = sortedAddresses.reduce((memo, key) => memo.add(balances[key]), BigNumber.from(0))

  return {
    merkleRoot: tree.getHexRoot(),
    tokenTotal: tokenTotal.toHexString(),
    claims,
  }
}
