# Fodl L2

The primary implementation of **Fodl** is for Ethereum mainnet. As L2 EVM networks gain popularity and provide some unique opportunities, the project opted to provide a secondary implementation of **Fodl** for the following L2 EVM networks:

* **Binance Smart Chain (BSC)**
  * Block explorer: https://bscscan.com/
  * Popular lending platform: https://venus.io/
  * Popular DEX: https://pancakeswap.finance/
* **Polygon (aka Matic) - coming soon**
  * Block explorer: https://polygonscan.com/
  * Popular lending platform: https://aave.com/ (multi chain)
  * Popular DEX: https://quickswap.exchange/
* **Avalanche - coming soon**

## Instructions to start developing

System Requirements: This repo was only tested with the latest node LTS version: `node v14.7.0`.

1. Install dependencies: `npm install`
2. Make sure `.env` file is created with required values per instructions below, for example:<br>`ANODE_PROVIDER_URL_BSC=<bsc node url>`
3. Make sure the primary Ethereum mainnet tests are passing using hardhat: `npm test`

#### For BSC:

4. Run tests using hardhat: `npm run test:bsc` (compiles smart contracts)
    * Optionally with a fixed block: `BLOCK_NUMBER_FORK=13900000 npm run test:bsc`
    * If tests are failing with Invalid JSON-RPC errors, your RPC provider may be flaky, try using a different one
5. Compile smart contracts: `npm run compile:bsc`
6. Run coverage check using hardhat: `npm run coverage:bsc` (compiles smart contracts)

We use the popular **Dotenv** module that loads environment variables from a `.env` file into `process.env`. To set an env variable you need to create the file `.env` in the root directory and set the env variables there.

Currently the varaibles used in code are:

* `ANODE_PROVIDER_URL_BSC` is the url of the node that is used for BSC mainnet forking during tests. It has no default. It doesn't have to be an archive node. Popular options are `moralis.io` (free should suffice), `quicknode.com` (paid only) or the official `https://bsc-dataseed.binance.org/` (heavily congested and flaky).
* `BLOCK_NUMBER_FORK` is an optional variable that makes forked tests run on an explicit block number instead of the latest. It is useful to reduce flakiness, improve speed and improve determinism of the results. Note that each L2 network advances in a different pace, so visit a relevant block explorer to find a recent value.

Known issue (under investigation): typechain generation fails on the initial compilation, simply rerun the tests in this case.

## Directory structure and hardhat environment

All L2 contracts and tests exist in separate and self-contained folders, named respectively, for example `contracts-bsc` and `test-bsc` contain all changes and additions for BSC flavored **Fodl**. The L2 code depends only on the Ethereum mainnet sources, so that changes are simple and minimal. In any case, the full list of directories is as follows:

* `/contracts` - smart contracts for Ethereum mainnet
* `/test` - test suite for Ethereum mainnet
* `/contracts-bsc` - smart contracts for BSC (L2)
* `/test-bsc` - test suite for BSC (L2)

To improve maintainability, special care was taken to avoid code duplication at any cost between the Ethereum mainnet implementation and the L2 contract implementations. For every **Fodl** construct (such as `FoldingRegistry`) that could be reused as-is in L2, the L2 implementation imports the original contract from the `contracts` folder. The original files remain untouched. This avoids unnecessary unit test duplication (the original files are already unit tested in the original test suite) but still tests these parts in integration tests with the new L2 code.

The same package structure and hardhat config are used by the L2 environments, while specific config values are overriden by injecting env variable `L2`,
for example `L2=bsc npx hardhat test` will run hardhat with fork of `ANODE_PROVIDER_URL_BSC` and tests under `test-bsc`.

## L2 vs Ethereum mainnet

Some of the differences to consider when designing **Fodl** for L2 include:

* Gas prices are significantly lower compared to Ethereum mainnet. This is an opportunity since most **Fodl** operations are gas intensive (even claiming rewards on Compound).
* Block gas limit is significantly higher compared to Ethereum mainnet. This brings more peace of mind that gas intensive operations are less likely to fail due to hitting the limit.
* Blocks are advancing faster compared to Ethereum mainnet. This should be taken into consideration in calculations that rely on the expected number of blocks in some period, such as APY/APR.
* Protocols often have lower TVL and lower liquidity compared to Ethereum mainnet. This increases price impact and slippage when swapping and may require multi hop routing in more cases.
* Protocol rewards are often higher compared to Ethereum mainnet. This is an opportunity since same asset folds may become more lucrative.
* L2 ecosystems are often more centralized and less stable than Ethereum mainnet. This contributes to higher downtime risks and reliance on additional infrastructure such as liquidity bridges.
* Governance in protocols is often changing faster compared to Ethereum mainnet. This adds risk of changes in important risk parameters such as collateral requirements and fees.
* The overall protocol ecosystem is less mature compared to Ethereum mainnet. You will find less flashloan providers for example.
* Forks of popular Ethereum mainnet protocols, such as Compound, are not necessarily true to source and often make slight changes in interfaces and ABIs and may include additional fees.
* RPC providers are more flaky compared to Ethereum mainnet due to the higher throughput of the network. It is recommended to try multiple providers and maintain active backups due to occasional downtime.

## Loops vs flashloans

To achieve leverage, **Fodl** L2 contracts use re-borrowing loops instead of flashloans when increasing and decreasing positions. 

Flashloans achieve leverage by taking a flashloan, swapping to the supply token, supplying, borrowing against the supply and repaying the flashloan using the borrowed funds.

Re-borrowing loops achieve leverage by supplying the principal token, then repeatedly: borrowing the max allowed, swapping if needed, and re-supplying. Multiple iterations of these actions are needed since the max allowed to borrow in a single iteration is normally lower than required for reaching the desired leverage. Each iteration brings us closer to the target leverage.

The main drawback of using re-borrowing loops is a signficant increase in gas consumption. High gas prices and low block gas limits often render this entire technique impractical on Ethereum mainnet. Since gas prices and block gas limits are no longer an issue on L2, we can enjoy the benefits of loops, which include:

* Avoiding paying the flashloan provider fee (0.25% on PancakeSwap).
* Simpler design, implementation and testing as there are less moving parts and less integrations with external protocols.
* Avoiding swaps (slippage and fees) on same asset folds. These swaps are often required with flashloans since some flashloan providers offer loans in a limited set of currencies.

There are a few things to keep in mind when using loops:

* Cross asset folds must swap the borrowed token to supplied token in every iteration.
  * Note that this does not affect the overall slippage or fees. The sum of multiple small swaps is equal to a single big swap.
  * The total accumulated slippage is still controlled by specifying `minAmount`.

* Unlike with flashloans, it is impossible to reach the exact theoretical max leverage allowed by the collateral factor. Since each iteration borrows the remaining available liquidity, the closer we are to the theoretical allowed max leverage, the smaller this borrowed amount becomes. This means that the iterations near the limit increase leverage by only a tiny fraction of the principal and an infinite number of iterations is required to actually hit the limit.
  * This is not an actual issue because hitting the absolute max leverage is not desireable anyways, as the position will be an immediate candidate for liquidation.
  * We recommend limiting leverage to 95-98% of the max allowed to keep the number of iterations low.

* Trying to decrease position when extremely close to liquidation faces the same problem since the available liquidity is so low that the iterations make negligible impact on reducing leverage.
  * This is not an actual issue because liquidation protection bots should kick into action much earlier than this scenario. Even 1% of available liquidity is more than enough to reduce the position since block gas limits are so high on L2.
  * In the theoretical case where a position reached zero available liquidity (and somehow wasn't liquidated), it is still possible to exit it by transfering a tiny amount of supply token to the folding account.

These edge conditions are tested and demonstrated in the test suite, consult the tests for more details.

## Gas consumption

Due to the increase in gas consumption, the L2 test suites use a gas reporter to show sampled gas usages taken while running the tests. Here is the output for BSC:

```
·---------------------------------------------------------------------|----------------------------|-------------|----------------------------·
|                        Solc version: 0.6.12                         ·  Optimizer enabled: false  ·  Runs: 200  ·  Block limit: 5000000 gas  │
······································································|····························|·············|·····························
|  Methods                                                            ·                5 gwei/gas                ·       526.90 usd/bnb       │
···································|··································|··············|·············|·············|··············|··············
|  Contract                        ·  Method                          ·  Min         ·  Max        ·  Avg        ·  # calls     ·  usd (avg)  │
···································|··································|··············|·············|·············|··············|··············
|  ClaimRewardsConnector           ·  claimRewards                    ·           -  ·          -  ·    2623104  ·           1  ·       6.91  │
···································|··································|··············|·············|·············|··············|··············
|  ERC20                           ·  approve                         ·       46364  ·      46506  ·      46435  ·          36  ·       0.12  │
···································|··································|··············|·············|·············|··············|··············
|  ERC20                           ·  transfer                        ·       29706  ·      51615  ·      48354  ·          79  ·       0.13  │
···································|··································|··············|·············|·············|··············|··············
|  FodlNFT                         ·  transferOwnership               ·       28812  ·      28824  ·      28824  ·          49  ·       0.08  │
···································|··································|··············|·············|·············|··············|··············
|  FoldingRegistry                 ·  addCTokenOnPlatform             ·           -  ·          -  ·      56489  ·         136  ·       0.15  │
···································|··································|··············|·············|·············|··············|··············
|  FoldingRegistry                 ·  addExchangerWithAdapter         ·           -  ·          -  ·      55456  ·          22  ·       0.15  │
···································|··································|··············|·············|·············|··············|··············
|  FoldingRegistry                 ·  addImplementation               ·       56445  ·     239161  ·     146568  ·          37  ·       0.39  │
···································|··································|··············|·············|·············|··············|··············
|  FoldingRegistry                 ·  addPlatformWithAdapter          ·           -  ·          -  ·      55643  ·          45  ·       0.15  │
···································|··································|··············|·············|·············|··············|··············
|  FoldingRegistry                 ·  createAccount                   ·           -  ·          -  ·     593414  ·          18  ·       1.56  │
···································|··································|··············|·············|·············|··············|··············
|  PancakeswapExchangerAdapter     ·  exchange                        ·      129908  ·     196546  ·     163227  ·           2  ·       0.43  │
···································|··································|··············|·············|·············|··············|··············
|  SimplePositionFoldingConnector  ·  decreaseSimplePositionWithLoop  ·      482772  ·    2777728  ·    1402689  ·           8  ·       3.70  │
···································|··································|··············|·············|·············|··············|··············
|  SimplePositionFoldingConnector  ·  increaseSimplePositionWithLoop  ·      524593  ·    2850703  ·    1126748  ·          15  ·       2.97  │
···································|··································|··············|·············|·············|··············|··············
|  VenusLendingAdapter             ·  borrow                          ·      295256  ·     417287  ·     380756  ·          18  ·       1.00  │
···································|··································|··············|·············|·············|··············|··············
|  VenusLendingAdapter             ·  claimRewards                    ·           -  ·          -  ·    2493582  ·           1  ·       6.57  │
···································|··································|··············|·············|·············|··············|··············
|  VenusLendingAdapter             ·  enterMarkets                    ·      119720  ·     176022  ·     129104  ·           6  ·       0.34  │
···································|··································|··············|·············|·············|··············|··············
|  VenusLendingAdapter             ·  redeemAll                       ·           -  ·          -  ·     201994  ·           1  ·       0.53  │
···································|··································|··············|·············|·············|··············|··············
|  VenusLendingAdapter             ·  redeemSupply                    ·      322012  ·     343741  ·     332877  ·           2  ·       0.88  │
···································|··································|··············|·············|·············|··············|··············
|  VenusLendingAdapter             ·  repayBorrow                     ·      200719  ·     201914  ·     201317  ·           2  ·       0.53  │
···································|··································|··············|·············|·············|··············|··············
|  VenusLendingAdapter             ·  supply                          ·      218681  ·     264603  ·     226108  ·          24  ·       0.60  │
···································|··································|··············|·············|·············|··············|··············
|  Deployments                                                        ·                                          ·  % of limit  ·             │
······································································|··············|·············|·············|··············|··············
|  ClaimRewardsConnector                                              ·           -  ·          -  ·     935017  ·      18.7 %  ·       2.46  │
······································································|··············|·············|·············|··············|··············
|  FodlNFT                                                            ·           -  ·          -  ·    2870387  ·      57.4 %  ·       7.56  │
······································································|··············|·············|·············|··············|··············
|  FoldingRegistry                                                    ·           -  ·          -  ·    3858914  ·      77.2 %  ·      10.17  │
······································································|··············|·············|·············|··············|··············
|  PancakeswapExchangerAdapter                                        ·           -  ·          -  ·     862307  ·      17.2 %  ·       2.27  │
······································································|··············|·············|·············|··············|··············
|  ResetAccountConnector                                              ·           -  ·          -  ·     241172  ·       4.8 %  ·       0.64  │
······································································|··············|·············|·············|··············|··············
|  SimplePositionFoldingConnector                                     ·           -  ·          -  ·    3020943  ·      60.4 %  ·       7.96  │
······································································|··············|·············|·············|··············|··············
|  VenusLendingAdapter                                                ·     3620091  ·    3620103  ·    3620102  ·      72.4 %  ·       9.54  │
·---------------------------------------------------------------------|--------------|-------------|-------------|--------------|-------------·
```

The L2 test suite guards against gas consumption regressions (changes that accidently increase gas consumption significantly) by defining an artifically low block gas limit (on BSC 5m instead of 80m) in tests. Any code modification that increases gas consumption to be over 7% of the actual BSC block limit will automatically fail the suite.


## Emphasis for implementing the UI
Certain edge scenarios of entering or exiting leverage with loops may result in extreme gas consumption or even an out of gas exception.
Consider a complex multi hop path for a cross asset position where some of the pairs in the path cause high slippage due to low liquidity.
This slippage can cause the number of loop iterations to grow significantly.

This is not a problem per se, but we recommend lowering the threshold of failure and using the following behavior:
* Decide on an upper boundary of gas consumption, for example, 50% of the block limit.
* When the UI is running estimateGas before sending the transaction, make sure the estimate is lower than the upper bound.
* If the estimate is over the bound or failing due to out of gas, the path is probably not healthy enough for usage.

## Cool shit in this implementation

The L2 implementation uses the mesmerizing [web3-candies](https://www.npmjs.com/package/@defi.org/web3-candies) library which simplifies web3 tests and makes them more readable by removing the boilerplate. The tests also opt to rely on web3.js instead of ethers.js to increase readability.

This is one of the very few L2 implementations that celebrates exterme code reuse by running on the same codebase and the same hardhat environment as the original Ethereum mainnet implementation. Harvest finance for example duplicates L2 code to separate repos, making maintenance over time much more difficult.

Since liquidity is always decreasing over time, even with same asset folds, the L2 test suite includes explicit long duration tests (1 year) that demonstrate this behavior and confirm that positions behave as expected after these durations. To achieve 10M-block tests with hardhat and ethereum.js within reasonable test run times, the suite relies on [ethereumjs-hooks](https://github.com/defi-org-code/ethereumjs-hooks).

Special care was taken to make the L2 test suite output human readable. Since multi iteration loops are involved, test output could easily become illegible. Each iteration is displayed concisely by tracing event emissions and tagging known ERC20 contracts with human readable names.

Test suite coverage is practically 100%.
