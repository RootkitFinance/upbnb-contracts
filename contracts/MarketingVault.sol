// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.6;

import "./TokensRecoverable.sol";

// Contract to hold marketing funds. Owner can approve addresses
// for limited amounts at a time

contract MarketingVault is TokensRecoverable
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping (address => uint256 ) public spendAmountToken;
    mapping (address => uint256 ) public spendAmountUSD;

    IERC20 immutable marketingFundMainToken;
    IERC20 immutable marketingFundUSDToken;

    constructor (IERC20 _marketingFundMainToken, IERC20 _marketingFundUSDToken){
        marketingFundMainToken = _marketingFundMainToken;
        marketingFundUSDToken = _marketingFundUSDToken;
    }

    function increaseSpendLimit(address spender, address token, uint256 amount) public ownerOnly {
        if (token == address(marketingFundMainToken)){
            spendAmountToken[spender] += amount;
        }
        if (token == address(marketingFundUSDToken)){
            spendAmountUSD[spender] += amount;
        }
    }

    function decreaseSpendLimit(address spender, address token, uint256 amount) public ownerOnly {
        if (token == address(marketingFundMainToken)){
            spendAmountToken[spender] = spendAmountToken[spender].sub(amount);
        }
        if (token == address(marketingFundUSDToken)){
            spendAmountUSD[spender] = spendAmountUSD[spender].sub(amount);
        }
    }

    function spendOnMarketing (address to, address token, uint256 amount) public {
        if (token == address(marketingFundMainToken)){
            require (spendAmountToken[address(msg.sender)] >=  amount);
            spendAmountToken[address(msg.sender)] = spendAmountToken[address(msg.sender)].sub(amount);
            marketingFundMainToken.transfer(to, amount);
        }
        if (token == address(marketingFundUSDToken)){
            require (spendAmountUSD[address(msg.sender)] >=  amount);
            spendAmountUSD[address(msg.sender)] = spendAmountUSD[address(msg.sender)].sub(amount);
            marketingFundUSDToken.transfer(to, amount);
        }
    }

}