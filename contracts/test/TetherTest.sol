// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

import "../ERC20.sol";

contract TetherTest is ERC20("Tether", "USDT") 
{ 
    constructor()
    {
         decimals = 6;
        _mint(msg.sender, 100 ** decimals);       
    }
}