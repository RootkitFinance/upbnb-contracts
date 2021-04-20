// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;


import "../IERC20.sol";
import "../SafeERC20.sol";
import "../RootedToken.sol";
import "../IMarketDistribution.sol";
import "../IMarketGeneration.sol";

contract MarketDistributionTest is IMarketDistribution
{
    using SafeERC20 for IERC20;

    RootedToken immutable rootedToken;
    IERC20 immutable baseToken;

    mapping (address => uint256) public claimCallAmount;
    mapping (address => uint256) public claimReferralRewardCallAmount;
    bool public override distributionComplete;   
    uint256 public override vestingPeriodStartTime;
    uint256 public override vestingPeriodEndTime; 
    IMarketGeneration public marketGeneration; 

    constructor(RootedToken _rootedToken, IERC20 _baseToken)
    {
        rootedToken = _rootedToken;
        baseToken = _baseToken;
    }

    function distribute() public override 
    { 
        require (!distributionComplete, "Already complete");
        marketGeneration = IMarketGeneration(msg.sender);
        distributionComplete = true;
        baseToken.safeTransferFrom(msg.sender, address(this), baseToken.balanceOf(msg.sender));
    }

    function claim(address account) public override
    {
        require (distributionComplete, "Not complete");
        claimCallAmount[account] = marketGeneration.contribution(account);
    }

    function claimReferralRewards(address account, uint256 referralShare) public override
    {
        require (distributionComplete, "Not complete");
        claimReferralRewardCallAmount[account] = referralShare;
    }
}