// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.6;

import "./TokensRecoverable.sol";
import "./IERC31337.sol";
import "./IUniswapV2Router02.sol";
import "./IERC20.sol";
import "./IUniswapV2Factory.sol";
import "./SafeMath.sol";
import "./IVault.sol";

contract Arb02 is TokensRecoverable, IVault {
    using SafeMath for uint256;

    IUniswapV2Router02 immutable uniswapRouter;
    IERC20 immutable rooted;
    IERC20 immutable base;
    IERC20 immutable usd;
    IERC31337 immutable elite;
    mapping(address => bool) public arbManager;

    constructor(IERC20 _base, IERC20 _usd, IERC31337 _elite, IERC20 _rooted, IUniswapV2Router02 _uniswapRouter) {
        base = _base;
        elite = _elite;
        usd = _usd;
        rooted = _rooted;
        uniswapRouter = _uniswapRouter;
        
        _base.approve(address(_elite), uint256(-1));
        _base.approve(address(_uniswapRouter), uint256(-1));
        _rooted.approve(address(_uniswapRouter), uint256(-1));
        _elite.approve(address(_uniswapRouter), uint256(-1));
        _usd.approve(address(_uniswapRouter), uint256(-1));
    }

    modifier arbManagerOnly() {
        require(arbManager[msg.sender], "Not an arb Manager");
        _;
    }

    // Owner function to enable other contracts or addresses to use the Vault
    function setArbManager(address managerAddress, bool allow) public ownerOnly() {
        arbManager[managerAddress] = allow;
    }

    // Standard swaps with v2 router
    function swap(uint amountIn, uint amountOutMin, address[] calldata path) public override arbManagerOnly() {
        uniswapRouter.swapExactTokensForTokens(amountIn, amountOutMin, path, address(this), block.timestamp);
    }

    function swapSupportingFee(uint amountIn, uint amountOutMin, address[] calldata path) public override arbManagerOnly() {
        uniswapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, amountOutMin, path, address(this), block.timestamp);
    }

    // Use Base tokens held by this contract to buy from the Base Pool and sell in the Elite Pool
    function balancePriceBase(uint256 amount, uint256 minAmountOut) public override arbManagerOnly() {
        uint balance = base.balanceOf(address(this));
        amount = buyRootedToken(address(base), amount, 0);
        amount = sellRootedToken(address(elite), amount, minAmountOut);
        elite.withdrawTokens(amount);
        require(balance < base.balanceOf(address(this)), "No Profit");
    }

    // Use Base tokens held by this contract to buy from the Elite Pool and sell in the Base Pool
    function balancePriceElite(uint256 amount, uint256 minAmountOut) public override arbManagerOnly() {
        uint balance = base.balanceOf(address(this));
        elite.depositTokens(amount);
        amount = buyRootedToken(address(elite), amount, 0);
        amount = sellRootedToken(address(base), amount, minAmountOut);
        require(balance < base.balanceOf(address(this)), "No Profit");
    }

    function buyRooted(address token, uint256 amountToSpend, uint256 minAmountOut) public override arbManagerOnly() {
        buyRootedToken(token, amountToSpend, minAmountOut);
    }

    function sellRooted(address token, uint256 amountToSpend, uint256 minAmountOut) public override arbManagerOnly() {
        sellRootedToken(token, amountToSpend, minAmountOut);
    }

    // internal functions
    function buyRootedToken(address token, uint256 amountToSpend, uint256 minAmountOut) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(rooted);
        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(amountToSpend, minAmountOut, path, address(this), block.timestamp);
        return amounts[1];
    }

    function sellRootedToken(address token, uint256 amountToSpend, uint256 minAmountOut) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(rooted);
        path[1] = address(token);
        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(amountToSpend, minAmountOut, path, address(this), block.timestamp);
        return amounts[1];
    }
}