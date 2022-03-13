// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.6;

import "./IEmpirePair.sol";
import "./IEmpireRouter.sol";
import "./IWrappedERC20.sol";

interface IArbVault {

    function addWatchPool(IEmpirePair pool, address router) external;
    function checkTokenPool(address token, uint256 index) external returns(address, address, address, address, uint256, uint256);
    function checkPool(uint256 index) external returns(address, address, address, address, uint256, uint256);
    function allPoolsLength() external returns (uint256);
    function tokenPoolsLength(address token) external returns (uint256); 
    
    function approveSomething(IERC20 token, address toApprove) external;
    function setUnrestricted(bool unrestricted) external;
    
    function logTokenBalance(IERC20 token) external;
    function ensureProfit(IERC20 token) external;

    function anyRouterHop (address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, IEmpireRouter router) external;
    function anyRouterSwap (address[] calldata path, uint256 amountIn, uint256 minOut, IEmpireRouter router) external;

    function addLiquidity(address tokenA, uint256 amountA, address tokenB, uint256 amountB, IEmpireRouter router) external;
    function addLiqWithoutSlippage(address tokenA, address tokenB, uint256 amountA, uint256 amountB, IEmpireRouter router) external;
    function removeLiquidity(address lpToken, uint256 lpAmount) external;

    function wrapToElite(uint256 baseAmount, IWrappedERC20 wrappedToken) external;
    function unwrapElite(uint256 eliteAmount, IWrappedERC20 wrappedToken) external;

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external returns (uint256 amountOut);
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) external returns (uint256 amountIn);
    function sortTokens(address tokenA, address tokenB) external returns (address token0, address token1);
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) external returns (uint256 amountB);
    
}