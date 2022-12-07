// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

interface IArb02 {
    function swap(uint amountIn, uint amountOutMin, address[] calldata path) external;
    function swapSupportingFee(uint amountIn, uint amountOutMin, address[] calldata path) external;
    function balancePriceBase(uint256 amount, uint256 minAmountOut) external;
    function balancePriceElite(uint256 amount, uint256 minAmountOut) external;
    function buyRooted(address token, uint256 amountToSpend, uint256 minAmountOut) external;
    function sellRooted(address token, uint256 amountToSpend, uint256 minAmountOut) external;
}