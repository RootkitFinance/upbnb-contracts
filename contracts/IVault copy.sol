// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.6;

interface IVault {

    function buyAndTax(uint256 amountToSpend, uint256 minAmountOut, uint16 tax, uint256 time) external;

    function buyRooted(uint256 minAmountOut, uint256 amountToSpend) external;
    function sellRooted(uint256 minAmountOut, uint256 amountToSpend) external;
    function addLiquidity(address rootedToken, uint256 rootedAmount, address pairedToken, uint256 pairedAmount) external;
    function removeLiquidity(address lpToken, uint256 lpAmount) external;

    function empireSwap (address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external;
    function altRouterSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external;

    function CroUsdSwap(uint256 croIn, uint256 minUsdOut) external returns(uint256);
    function UsdCroSwap(uint256 usdIn, uint256 minCroOut) external;

    function sweepFloor(uint256 amount) external;
    function unsweepFloor(uint256 amount) external;
    function reduceLockedLiquidity(uint256 minWethOut) external;

}