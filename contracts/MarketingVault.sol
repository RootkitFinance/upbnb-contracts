// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

import "./TokensRecoverable.sol";

// Contract to hold marketing funds. Owner can approve addresses
// for limited amounts at a time

contract SideVault is TokensRecoverable
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping (address => uint256 ) public spendAmount;

    IERC20 immutable marketingFundToken;

    constructor (IERC20 _marketingFundToken){
        marketingFundToken = _marketingFundToken;
    }


    function increaseSpendLimit(address spender, uint256 amount) public ownerOnly {
        spendAmount[spender] += amount;
    }

    function decreaseSpendLimit(address spender, uint256 amount) public ownerOnly {
        spendAmount[spender] = spendAmount[spender].sub(amount);
    }

    function spendOnMarketing (address to, uint256 amount) public {
        require (spendAmount[address(msg.sender)] >=  amount);
        marketingFundToken.transfer(to, amount);
        spendAmount[address(msg.sender)].sub(amount);
    }


}