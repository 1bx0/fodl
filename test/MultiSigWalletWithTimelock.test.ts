import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { deployMockContract } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { GOVERNANCE_MIN_DELAY } from '../constants/deploy'
import { submitMultiSigTimelockTx } from '../scripts/utils'
import { MultiSigWallet, Ownable__factory, TimelockGovernance } from '../typechain'

describe('MultiSigWallet & TimelockGovernance', () => {
  let multisig: MultiSigWallet
  let timelock: TimelockGovernance
  let accounts: SignerWithAddress[]

  before(async () => {
    accounts = await ethers.getSigners()
    multisig = (await (
      await ethers.getContractFactory('MultiSigWallet')
    ).deploy([accounts[0].address, accounts[1].address], 2)) as MultiSigWallet
    timelock = (await (
      await ethers.getContractFactory('TimelockGovernance')
    ).deploy(GOVERNANCE_MIN_DELAY, [ethers.constants.AddressZero], [multisig.address])) as TimelockGovernance
  })

  it('Timelock is self managed', async () => {
    const executorRole = await timelock.EXECUTOR_ROLE()
    const args: [string, string] = [executorRole, accounts[1].address]
    await expect(timelock.grantRole(...args)).to.be.revertedWith('AccessControl: sender must be an admin to grant')

    await expect(timelock.connect(accounts[1]).grantRole(...args)).to.be.revertedWith(
      'AccessControl: sender must be an admin to grant'
    )

    const { operationID, operationReadyAt } = await submitMultiSigTimelockTx(
      await timelock.populateTransaction.grantRole(...args),
      GOVERNANCE_MIN_DELAY,
      timelock,
      multisig
    )

    await ethers.provider.send('evm_setNextBlockTimestamp', [operationReadyAt.toNumber() + 10])
    await ethers.provider.send('evm_mine', [])

    // need to estimate tiny increase in gas due to hardhat estimation issue
    const gasEstimate = await multisig.connect(accounts[1]).estimateGas.confirmTransaction(operationID)
    await expect(
      multisig.connect(accounts[1]).confirmTransaction(operationID, { gasLimit: gasEstimate.mul(13).div(10) })
    ).to.emit(timelock, 'RoleGranted')
  })

  it('Timelock must wait for delay', async () => {
    const executorRole = await timelock.EXECUTOR_ROLE()
    const args: [string, string] = [executorRole, accounts[1].address]

    const { operationID, operationReadyAt } = await submitMultiSigTimelockTx(
      await timelock.populateTransaction.grantRole(...args),
      GOVERNANCE_MIN_DELAY,
      timelock,
      multisig
    )

    await expect(multisig.connect(accounts[1]).confirmTransaction(operationID, { gasLimit: 15000000 }))
      .to.emit(multisig, 'ExecutionFailure')
      .withArgs(operationID)

    await ethers.provider.send('evm_setNextBlockTimestamp', [operationReadyAt.toNumber() + 10])
    await ethers.provider.send('evm_mine', [])

    await expect(multisig.connect(accounts[1]).executeTransaction(operationID, { gasLimit: 15000000 })).to.emit(
      multisig,
      'Execution'
    )
  })

  it('Timelock can give back ownership of ownable contract', async () => {
    const mockOwnable = await deployMockContract(accounts[0], Ownable__factory.abi)
    await mockOwnable.mock.transferOwnership.withArgs(accounts[1].address).returns()

    const { operationID, operationReadyAt } = await submitMultiSigTimelockTx(
      await mockOwnable.populateTransaction.transferOwnership(accounts[1].address),
      GOVERNANCE_MIN_DELAY,
      timelock,
      multisig
    )

    await expect(multisig.connect(accounts[1]).confirmTransaction(operationID, { gasLimit: 15000000 }))
      .to.emit(multisig, 'ExecutionFailure')
      .withArgs(operationID)

    await ethers.provider.send('evm_setNextBlockTimestamp', [operationReadyAt.toNumber() + 10])
    await ethers.provider.send('evm_mine', [])

    await expect(multisig.connect(accounts[1]).executeTransaction(operationID, { gasLimit: 15000000 })).to.emit(
      multisig,
      'Execution'
    )
  })
})
