// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.6;

import "./TokensRecoverable.sol";


// Contract to hold tokens that are transferred to the pair mid swap 
// by the newest gate to quickly stack liquidity 

contract SideVault is TokensRecoverable
{
    using SafeMath for uint256;

    function approveGate(IERC20 token, address gate) public ownerOnly() {
        token.approve(address(gate), uint256(-1));
    }

}