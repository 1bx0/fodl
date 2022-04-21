export const StopLossConnectorErrors = {
  SLC7: 'Unwind factor not configured',
}

export const errorCodes = {
  SP1: 'Simple Position not set',
  SP2: 'Simple Position: Platform is incorrect',
  SP3: 'Simple Position: Supply token is incorrect',
  SP4: 'Simple Position: Borrow token is incorrect',

  FA1: 'Folding Account: invalid function call',
  FA2: 'Folding Account: onlyAccountOwner',
  FA3: 'Folding Account: onlyNFTContract',
  FA4: 'Folding Account: onlyAccountOwnerOrRegistry',

  FR1: 'FoldingRegistry: Creation failed.',
  FR2: 'FoldingRegistry: sig not found',
  FR3: 'FoldingRegistry: Platform already added',
  FR4: 'FoldingRegistry: Empty platforms array',
  FR5: 'FoldingRegistry: Platform not added',
  FR6: 'FoldingRegistry: lending adapter not found',
  FR7: 'FoldingRegistry: Token already on platform',
  FR8: 'FoldingRegistry: Token not on platform',
  FR9: 'FoldingRegistry: cToken mapping not found',
  FR10: 'FoldingRegistry: Exchanger already added',
  FR11: 'FoldingRegistry: Exchanger not added',
  FR12: 'FoldingRegistry: exchanger adapter not found',
  FR13: 'Do not send eth here',

  ICP0: 'Anywhere: Invalid Constructor Parameter address 0',
  ICP1: 'Anywhere: Invalid Constructor Parameter out of bounds',

  LPL1: 'Mismatch in amount of platforms and assets passed.',

  DFM1: 'DyDxFlashModule: You are not Solo',
  DFM2: 'DyDxFlashModule: Invalid caller',
  DFM3: 'DyDxFlashModule: Unrequested call',

  // Simple Position Leverage Lending Connector
  SPLLC1: 'The specified amounts for flash loan and principal are not enough to cover the specified supply amount.',
  SPLLC2: 'The specified borrow amount is not enough to cover the amount needed to repay the flash loan.',
  SPLLC3: 'The specified flash loan amount is not enough to cover the specified repay borrow amount.',
  SPLLC5:
    'The specified redeem supply amount is not enough to cover the specified redeem principal amount and flash loan repayment.',

  RD1: 'RewardsDistributor: Claiming is not paused.',
  RD2: 'RewardsDistributor: Claiming is paused. Try again later.',
  RD3: 'RewardsDistributor: Merkle root duplicate.',
  RD4: 'RewardsDistributor: Already claimed tokens.',
  RD5: 'RewardsDistributor: Invalid proof.',

  CFLA1: 'CompForkLendingAdapater: enterMarkets',
  CFLA2: 'CompForkLendingAdapater: mint',
  CFLA3: 'CompForkLendingAdapater: borrow',
  CFLA4: 'CompForkLendingAdapater: redeem',
  CFLA5: 'CompForkLendingAdapater: repay',

  IWV3FMC1: 'IncreaseWithV3FlashMultihop: Supply amount cannot be less than principal amount',
  IWV3FMC2: 'IncreaseWithV3FlashMultihop: Uniswap V3 error - Bad liquidity levels',
  IWV3FMC3: 'IncreaseWithV3FlashMultihop: Uniswap V3 error - Bad liquidity levels',
  IWV3FMC4: 'IncreaseWithV3FlashMultihop: Uniswap V3 error - More slippage than allowed',
  IWV3FMC5: 'IncreaseWithV3FlashMultihop: Bad multihop path',
  IWV3FMC6: 'IncreaseWithV3FlashMultihop: Callback was called by a non-expected address',
  IWV3FMC7: 'IncreaseWithV3FlashMultihop: Bad multihop path',

  DWV3FMC1: 'DecreaseWithV3FlashMultihop: TBD',
  DWV3FMC2: 'DecreaseWithV3FlashMultihop: Uniswap V3 error - Bad liquidity levels',
  DWV3FMC3: 'DecreaseWithV3FlashMultihop: Uniswap V3 error - Bad liquidity levels',
  DWV3FMC4: 'DecreaseWithV3FlashMultihop: Bad multihop path',
  DWV3FMC5: 'DecreaseWithV3FlashMultihop: Uniswap V3 error - More slippage than allowed',
  DWV3FMC6: 'DecreaseWithV3FlashMultihop: Callback was called by a non-expected address',
  DWV3FMC7: 'DecreaseWithV3FlashMultihop: Bad multihop path',

  PNL1: 'PNLConnector: unwind factor must be between 0 and 1e18',
  PNL2: 'PNLConnector: variable reward percentage cannot exceed 1e18',
  PNL3: 'PNLConnector: invalid price target',
  PNL4: 'PNLConnector: price target not reached',
  PNL5: 'PNLConnector: provided index invalid, configuration does not exist',

  WPNL1: 'WPNLConnector: unwind factor must be between 0 and 1e18',
  WPNL2: 'WPNLConnector: variable reward percentage cannot exceed 1e18',
  WPNL3: 'WPNLConnector: invalid price target',
  WPNL4: 'WPNLConnector: address is not whitelisted',
  WPNL5: 'WPNLConnector: price target not reached',
  WPNL6: 'WPNLConnector: provided index invalid, configuration does not exist',

  SPFC01: 'SimplePositionFoldingConnector: Total supply amount cannot be less than minSupplyAmount',
  SPFC02: 'SimplePositionFoldingConnector: Total repay amount cannot be less than minRepayAmount',
}
