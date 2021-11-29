// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

import "./TokensRecoverable.sol";
import "./IERC31337.sol";
import "./IPancakeRouter02.sol";
import "./IERC20.sol";
import "./RootedTransferGate.sol";
import "./IPancakeFactory.sol";
import "./SafeMath.sol";
import "./IVault.sol";
import "./IFloorCalculator.sol";

contract Vault is TokensRecoverable, IVault
{
    using SafeMath for uint256;

    IPancakeRouter02 immutable pancakeRouter;
    IPancakeFactory immutable pancakeFactory;
    IERC20 immutable rooted;
    IERC20 immutable base;
    IERC31337 immutable elite;
    IERC20 immutable rootedEliteLP;
    IERC20 immutable rootedBaseLP;
    IERC20 immutable usd;
    uint256 public totalStackUsd;
    IFloorCalculator public calculator;
    RootedTransferGate public gate;
    mapping(address => bool) public seniorVaultManager;

    constructor(IPancakeRouter02 _pancakeRouter, IERC20 _base, IERC20 _rooted, IERC31337 _elite, IFloorCalculator _calculator, RootedTransferGate _gate) 
    {
        pancakeRouter = _pancakeRouter;
        base = _base;
        elite = _elite;
        rooted = _rooted;
        calculator = _calculator;
        gate = _gate;

        IPancakeFactory _pancakeFactory = IPancakeFactory(_pancakeRouter.factory());
        pancakeFactory = _pancakeFactory;        
        
        _base.approve(address(_elite), uint256(-1));
        _base.approve(address(_pancakeRouter), uint256(-1));
        _rooted.approve(address(_pancakeRouter), uint256(-1));
        IERC20 _rootedBaseLP = IERC20(_pancakeFactory.getPair(address(_base), address(_rooted)));
        _rootedBaseLP.approve(address(_pancakeRouter), uint256(-1));
        rootedBaseLP = _rootedBaseLP;
        _elite.approve(address(_pancakeRouter), uint256(-1));
        IERC20 _rootedEliteLP = IERC20(_pancakeFactory.getPair(address(_elite), address(_rooted)));
        _rootedEliteLP.approve(address(_pancakeRouter), uint256(-1));
        rootedEliteLP = _rootedEliteLP;
        _rooted.approve(address(_gate), uint256(-1));
    }

    modifier seniorVaultManagerOnly()
    {
        require(seniorVaultManager[msg.sender], "Not a Senior Vault Manager");
        _;
    }

    function singleLiquditySwap(address lpTokenToRemove, uint256 lpToRemove, calldata address[] path, address lpTokenToAdd) {
        // 1. remove lpToken remove
        // 2. swap path using amount got from remove liq
        // 3. add liq amount(fromSwap, fromRemove)
    }

    function doubleLiquditySwap(address lpTokenToRemove, uint256 lpToRemove, calldata address[] path0, calldata address[] path1, address lpTokenToAdd) {
        // 1. remove lpToken remove
        // 2. swap path0 using amount got from remove liq
        // 3. swap path1 using amount got from remove liq
        // 3. add liq amount(fromSwap0, fromSwap1)
    }

    function stackUsd(calldata address[] path, uint256 amount, uint256 usdToKeep) {
        require(path[0] == path[path.length - 1]);
        //arb
        // 1. swap path using amount
        // 2.
        totalStackUsd += usdToKeep;
    }

    // Owner function to enable other contracts or addresses to use the Liquidity Controller
    function setSeniorVaultManager(address controlAddress, bool controller) public ownerOnly()
    {
        seniorVaultManager[controlAddress] = controller;
    }

    function setCalculatorAndGate(IFloorCalculator _calculator, RootedTransferGate _gate) public ownerOnly()
    {
        calculator = _calculator;
        gate = _gate;
        rooted.approve(address(_gate), uint256(-1));
    }

    // Removes liquidity, buys from either pool, sets a temporary dump tax
    function removeBuyAndTax(uint256 amount, address token, uint16 tax, uint256 time) public override seniorVaultManagerOnly()
    {
        gate.setUnrestricted(true);
        amount = removeLiq(token, amount);
        buyRootedToken(token, amount);
        gate.setDumpTax(tax, time);
        gate.setUnrestricted(false);
    }

    // Use Base tokens held by this contract to buy from the Base Pool and sell in the Elite Pool
    function balancePriceBase(uint256 amount) public override seniorVaultManagerOnly()
    {
        amount = buyRootedToken(address(base), amount);
        amount = sellRootedToken(address(elite), amount);
        elite.withdrawTokens(amount);
    }

    // Use Base tokens held by this contract to buy from the Elite Pool and sell in the Base Pool
    function balancePriceElite(uint256 amount) public override seniorVaultManagerOnly()
    {        
        elite.depositTokens(amount);
        amount = buyRootedToken(address(elite), amount);
        amount = sellRootedToken(address(base), amount);
    }

    // Uses value in the controller to buy
    function buyAndTax(address token, uint256 amountToSpend, uint16 tax, uint256 time) public override seniorVaultManagerOnly()
    {
        buyRootedToken(token, amountToSpend);
        gate.setDumpTax(tax, time);
    }

    // Sweeps the Base token under the floor to this address
    function sweepFloor() public override seniorVaultManagerOnly()
    {
        elite.sweepFloor(address(this));
    }

    // Move liquidity from Elite pool --->> Base pool
    function zapEliteToBase(uint256 liquidity) public override seniorVaultManagerOnly() 
    {       
        gate.setUnrestricted(true);
        liquidity = removeLiq(address(elite), liquidity);
        elite.withdrawTokens(liquidity);
        addLiq(address(base), liquidity);
        gate.setUnrestricted(false);
    }

    // Move liquidity from Base pool --->> Elite pool
    function zapBaseToElite(uint256 liquidity) public override seniorVaultManagerOnly() 
    {
        gate.setUnrestricted(true);
        liquidity = removeLiq(address(base), liquidity);
        elite.depositTokens(liquidity);
        addLiq(address(elite), liquidity);
        gate.setUnrestricted(false);
    }

    function wrapToElite(uint256 baseAmount) public override seniorVaultManagerOnly() 
    {
        elite.depositTokens(baseAmount);
    }

    function unwrapElite(uint256 eliteAmount) public override seniorVaultManagerOnly() 
    {
        elite.withdrawTokens(eliteAmount);
    }

    function addLiquidity(address eliteOrBase, uint256 baseAmount) public override seniorVaultManagerOnly() 
    {
        gate.setUnrestricted(true);
        addLiq(eliteOrBase, baseAmount);
        gate.setUnrestricted(false);
    }

    function removeLiquidity(address eliteOrBase, uint256 tokens) public override seniorVaultManagerOnly()
    {
        gate.setUnrestricted(true);
        removeLiq(eliteOrBase, tokens);
        gate.setUnrestricted(false);
    }

    function buyRooted(address token, uint256 amountToSpend) public override seniorVaultManagerOnly()
    {
        buyRootedToken(token, amountToSpend);
    }

    function sellRooted(address token, uint256 amountToSpend) public override seniorVaultManagerOnly()
    {
        sellRootedToken(token, amountToSpend);
    }

    function addLiq(address eliteOrBase, uint256 baseAmount) internal 
    {
        pancakeRouter.addLiquidity(address(eliteOrBase), address(rooted), baseAmount, rooted.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
    }

    function removeLiq(address eliteOrBase, uint256 tokens) internal returns (uint256)
    {
        (tokens, ) = pancakeRouter.removeLiquidity(address(eliteOrBase), address(rooted), tokens, 0, 0, address(this), block.timestamp);
        return tokens;
    }

    function buyRootedToken(address token, uint256 amountToSpend) internal returns (uint256)
    {
        uint256[] memory amounts = pancakeRouter.swapExactTokensForTokens(amountToSpend, 0, buyPath(token), address(this), block.timestamp);
        amountToSpend = amounts[1];
        return amountToSpend;
    }

    function sellRootedToken(address token, uint256 amountToSpend) internal returns (uint256)
    {
        uint256[] memory amounts = pancakeRouter.swapExactTokensForTokens(amountToSpend, 0, sellPath(token), address(this), block.timestamp);
        amountToSpend = amounts[1];
        return amountToSpend;
    }

    function buyPath(address token) internal view returns (address[] memory) 
    {
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(rooted);
        return path;
    }

    function sellPath(address token) internal view returns (address[] memory) 
    {
        address[] memory path = new address[](2);
        path[0] = address(rooted);
        path[1] = address(token);
        return path;
    }
}