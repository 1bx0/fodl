# Fodl

This repo contains the code for the Smart Contracts used in the **Fodl** project. **Fodl** provides the following new features:

1. It provides information from lending platforms (Aave, Compound) in a unified view.
2. It allows users to open leveraged positions on these platforms from one common interface.
3. It allows users to configure stop-loss conditions and actions in order to prevent getting liquidated on the underlying platform.
4. It offers a decentralised stop-loss system where bots (anyone really) are incentivised to stop-loss users.

## Instructions to start developing

System Requirements: This repo was tested with the latest node LTS version: `node v14.7.0`.

1. Install dependencies: `npm install`
2. Run tests using hardhat: `npm test` (compiles smart contracts)
3. Compile smart contracts: `npm run compile`
4. Run coverage check using hardhat: `npm run coverage` (compiles smart contracts)
5. Run in dev mode (tests are ran on file save): `npm run dev`

We use the popular **Dotenv** module that loads environment variables from a `.env` file into `process.env`.
To set an env variable you need to create a file `.env` set the env variable there.

Currently the varaibles used in code are:

- `ANODE_PROVIDER_URL` is the url of the archival node that is used for mainnet forking during tests. Please use your own archival node instance.
- `GAS_PRICE` is the price of gas you want to use for mainnet transactions. It defaults to string `"auto"` which detects the current gas price. You may wish to speedup transactions by setting a higher gas price manually (value should be in WEI).
- `DEPLOYER_SECRET_KEY` is the private key of the address that deploys contracts on mainnet. Do not include the `0x` prefix.

## Contributing

To easily accept open source contributions we are using the Forking Workflow. A new developer wanting to implement a feature should:

1. Fork this repository
2. Create a branch for the feature with a suggestive name.
3. Develop said feature including tests
4. Submit a Pull Request (PR) to merge the branch into the master branch of this repo.
5. Wait for 2 reviewers
6. Respond to reviewers' concerns
7. Wait for reviewers to accept the PR

### Style guide and use of automatic formatters

All style is enforced by the `.prettier.rc` file. The following information assumes that you are using either VSCode or an IDE capable of delegating format to a `prettier` implementation.

The project comes with a dev dependency, `prettier-plugin-solidity` that should allow any IDE using prettier to catch the values in `.prettierrc` where all the style rules are defined and enforced. But if you have installed an extension, the IDE might try to use the formatters that are bundled within those extensions. To avoid this, you must disable such formatters and point your IDE to use `prettier`. In VSCode, go into the settings of these extensions and disable the formatter. Also go into your vscode settings.json (Ctrl+P, write Open Settings and choose the option that is shown), and write the following section into the file:

```js
"[solidity]": {
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
},
```

Restart your VSCode and it should be working fine now.

## Fodl Architecture

### Note: Some modules and connectors have changed but the overall data flow is the same.

The system is described in the following diagram:
![Fodl Architecture Diagram](https://i.ibb.co/VpGsd92/System-Architecture.png)

The main components of this system are:

1. Folding Registry is an upgradable Smart Contract that a DAO controls and acts as the main source of truth in the system. It has the following responsibilities:

- Create Folding Accounts for users and track ownership as an NFT
- Register new external connectors that implement new logic for Folding Accounts
- Register new lending platforms and associate them with adapters.
- Expose the current address of the Fodl Token

2. Folding Account is a proxy Smart Contract which delegates any calls it receives to an external connector. This way the Folding Account can be upgraded easily by simply adding more logic in new connectors. Some of the external connectors are:

- SimplePositionConnector allows users to open asset vs. asset positions on any of the platforms supported. This connector also gives the possibility to use flash loans to open leveraged positions (described below).
- StopLossConnector allows users to configure their position to be stop-lossed by bots.

3. Fodl is an ERC-20 token that acts as the governance and utility token of this system. Users must buy Fodl to incentivise bots to stop-loss their positions.

### Leveraged Position Example:

To open a leveraged position, the smart contract implements the following logic:

1. User has 1 MM USD worth of token A
2. User takes out a flash loan of 3 MM USD worth of token A, now having 4 MM worth of token A
3. User supplies this 4 MM USD worth of token A to Compound (let's assume token A has 75% collateral factor, so user can now borrow up to 3 MM USD worth of any token)
4. User borrows 3 MM USD worth of token B from Compound
5. User swaps token B for token A using a decentralised exchange such as uniswap or 1inch and pays back the 3MM USD flash loan he took at step 2
6. User is now earning 4x more COMP tokens than he would have been earning with his original 1 MM amount.

To now close this position, the following logic can be performed:

1. User takes out a flash loan in token B such that it can cover his whole borrow balance
2. User repays all the borrow balance in token B
3. User redeems all the supply balance in token A
4. User swaps just enough token A for token B to be able to repay the flash loan
5. User has now completely exited his position.

## Storage Layout for Folding Accounts

To guarantee we can always upgrade and enhance the capabilities of Folding Accounts, we make use of a storage pattern known as Diamond Storage. The idea is to keep storage variables in structs that are allocated in arbitrary places in contract storage. The developers should be extremely careful to have no overlap between the storage spaces of 2 different structs. To guarantee this, the storage locations are defined by computing the hash of an application specific string that describes the struct stored there. Still developers should ensure they don't allocate at a location already used, somewhere else in code. A simple "find in all repo" for the string to be hashed should suffice.
