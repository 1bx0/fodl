// SPDX-License-Identifier: MIT

pragma solidity 0.6;
pragma experimental ABIEncoderV2;

import '../../Fodl/connectors/interfaces/ISimplePositionBaseConnector.sol';
import '../../Fodl/connectors/interfaces/IClaimRewardsConnector.sol';
import '../../Fodl/connectors/interfaces/IResetAccountConnector.sol';
import './interfaces/ISimplePositionFoldingConnector.sol';

// This SC only exists to generate an ABI with the functions of all connectors.
interface AllConnectorsBSC is
    ISimplePositionBaseConnector,
    IClaimRewardsConnector,
    IResetAccountConnector,
    ISimplePositionFoldingConnector
{

}
