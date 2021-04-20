// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

import "./IMarketDistribution.sol";
import "./IMarketGeneration.sol";
import "./RootedToken.sol";
import "./RootedTransferGate.sol";
import "./TokensRecoverable.sol";
import "./SafeMath.sol";
import "./IERC31337.sol";
import "./IERC20.sol";
import "./IUniswapV2Router02.sol";
import "./IUniswapV2Factory.sol";
import "./IUniswapV2Pair.sol";
import "./SafeERC20.sol";

/*
Introducing the Market Generation Event:

Allows full and permanent liquidity locking
of all raised funds with no commitment to LPs. 
Using ERC-31337 we get ALL the raised funds
back from liquidity if we lock all the raised
token with all the supply of the new token and
there is no ability to mint.

- Raise with any token
- All raised funds get locked forever
- ERC-31337 sweeps back all locked value
- Recovered value buys from the new market
- Any length vesting period
- Built in referral system

Phases:
    Initializing
        Call setupEliteRooted()
        Call setupBaseRooted() 
        Call completeSetup()
        
    Call distribute() to:
        Transfer all rootedToken to this contract
        Take all BaseToken + rootedToken and create a market
        Sweep the floor
        Buy rootedToken for the groups
        Move liquidity from elite pool to create standard pool
        Begin the vesting period with a linier unlock

    Complete
        Everyone can call claim() to receive their tokens (via the liquidity generation contract)
*/

contract MarketDistribution is TokensRecoverable, IMarketDistribution
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    bool public override distributionComplete;

    IMarketGeneration public marketGeneration;
    IUniswapV2Router02 uniswapV2Router;
    IUniswapV2Factory uniswapV2Factory;
    RootedToken public rootedToken;
    IERC31337 public eliteToken;
    IERC20 public baseToken;
    address public immutable devAddress;
    address public liquidityController;
    IUniswapV2Pair public rootedEliteLP;
    IUniswapV2Pair public rootedBaseLP;

    uint256 public constant rootedTokenSupply = 1e25; // 10 million

    uint256 public totalBaseTokenCollected;
    uint256 public totalBoughtForContributors;
    mapping (address => uint256) public claimTime;
    mapping (address => uint256) public totalClaim;
    mapping (address => uint256) public remainingClaim;
    uint256 public totalBoughtForReferrals;
    
    uint256 public recoveryDate = block.timestamp + 2592000; // 1 Month
    
    uint16 public devCutPercent;
    uint16 public preBuyForReferralsPercent;
    uint16 public preBuyForContributorsPercent;
    uint16 public preBuyForMarketStabilizationPercent;
    uint256 public override vestingPeriodStartTime;
    uint256 public override vestingPeriodEndTime; 
    uint256 public vestingDuration;
    uint256 public rootedBottom;

    constructor(address _devAddress)
    {
        devAddress = _devAddress;
    }

    function init(
        RootedToken _rootedToken, 
        IERC31337 _eliteToken, 
        address _liquidityController,
        IUniswapV2Router02 _uniswapV2Router, 
        IMarketGeneration _marketGeneration,
        uint256 _vestingDuration, 
        uint16 _devCutPercent, 
        uint16 _preBuyForReferralsPercent, 
        uint16 _preBuyForContributorsPercent, 
        uint16 _preBuyForMarketStabilizationPercent) public ownerOnly()
    {        
        rootedToken = _rootedToken;
        eliteToken = _eliteToken;
        baseToken = _eliteToken.wrappedToken();
        liquidityController = _liquidityController;
        uniswapV2Router = _uniswapV2Router;
        uniswapV2Factory = IUniswapV2Factory(_uniswapV2Router.factory());
        marketGeneration = _marketGeneration;
        vestingDuration = _vestingDuration;
        devCutPercent = _devCutPercent;
        preBuyForReferralsPercent = _preBuyForReferralsPercent;
        preBuyForContributorsPercent = _preBuyForContributorsPercent;
        preBuyForMarketStabilizationPercent = _preBuyForMarketStabilizationPercent;
    }

    function setupEliteRooted() public
    {
        rootedEliteLP = IUniswapV2Pair(uniswapV2Factory.getPair(address(eliteToken), address(rootedToken)));
        if (address(rootedEliteLP) == address(0)) 
        {
            rootedEliteLP = IUniswapV2Pair(uniswapV2Factory.createPair(address(eliteToken), address(rootedToken)));
            require (address(rootedEliteLP) != address(0));
        }
    }

    function setupBaseRooted() public
    {
        rootedBaseLP = IUniswapV2Pair(uniswapV2Factory.getPair(address(baseToken), address(rootedToken)));
        if (address(rootedBaseLP) == address(0)) 
        {
            rootedBaseLP = IUniswapV2Pair(uniswapV2Factory.createPair(address(baseToken), address(rootedToken)));
            require (address(rootedBaseLP) != address(0));
        }
    }

    function completeSetup() public ownerOnly()
    {   
        require (address(rootedEliteLP) != address(0), "Rooted Elite pool is not created");
        require (address(rootedBaseLP) != address(0), "Rooted Base pool is not created");   

        eliteToken.approve(address(uniswapV2Router), uint256(-1));
        rootedToken.approve(address(uniswapV2Router), uint256(-1));
        baseToken.safeApprove(address(uniswapV2Router), uint256(-1));
        baseToken.safeApprove(address(eliteToken), uint256(-1));
        rootedBaseLP.approve(address(uniswapV2Router), uint256(-1));
        rootedEliteLP.approve(address(uniswapV2Router), uint256(-1));
    }

    function distribute() public override
    {
        require (msg.sender == address(marketGeneration), "Unauthorized");
        require (!distributionComplete, "Distribution complete");
   
        vestingPeriodStartTime = block.timestamp;
        vestingPeriodEndTime = block.timestamp + vestingDuration;
        distributionComplete = true;
        totalBaseTokenCollected = baseToken.balanceOf(address(marketGeneration));
        baseToken.safeTransferFrom(msg.sender, address(this), totalBaseTokenCollected);  

        RootedTransferGate gate = RootedTransferGate(address(rootedToken.transferGate()));

        gate.setUnrestricted(true);
        rootedToken.mint(rootedTokenSupply);

        createRootedEliteLiquidity();

        eliteToken.sweepFloor(address(this));        
        eliteToken.depositTokens(baseToken.balanceOf(address(this)));
                
        buyTheBottom();        
        preBuyForReferrals();
        preBuyForContributors();
        sellTheTop();        

        uint256 devCut = totalBaseTokenCollected * devCutPercent / 10000;
        baseToken.transfer(devAddress, devCut);
        baseToken.transfer(liquidityController, baseToken.balanceOf(address(this)));      

        createRootedBaseLiquidity();       

        gate.setUnrestricted(false);
    }   
    
    function createRootedEliteLiquidity() private
    {
        // Create Rooted/Elite LP 
        eliteToken.depositTokens(baseToken.balanceOf(address(this)));
        uniswapV2Router.addLiquidity(address(eliteToken), address(rootedToken), eliteToken.balanceOf(address(this)), rootedToken.totalSupply(), 0, 0, address(this), block.timestamp);
    }

    function buyTheBottom() private
    {
        uint256 amount = totalBaseTokenCollected * preBuyForMarketStabilizationPercent / 10000;  
        uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(amount, 0, eliteRootedPath(), address(this), block.timestamp);        
        rootedBottom = amounts[1];
    }

    function sellTheTop() private
    {
        uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(rootedBottom, 0, rootedElitePath(), address(this), block.timestamp);
        uint256 eliteAmount = amounts[1];
        eliteToken.withdrawTokens(eliteAmount);
    }   
    
    function preBuyForReferrals() private 
    {
        uint256 amount = totalBaseTokenCollected * preBuyForReferralsPercent / 10000;
        uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(amount, 0, eliteRootedPath(), address(this), block.timestamp);
        totalBoughtForReferrals = amounts[1];
    }

    function preBuyForContributors() private 
    {
        uint256 preBuyAmount = totalBaseTokenCollected * preBuyForContributorsPercent / 10000;
        uint256 eliteBalance = eliteToken.balanceOf(address(this));
        uint256 amount = preBuyAmount > eliteBalance ? eliteBalance : preBuyAmount;
        uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(amount, 0, eliteRootedPath(), address(this), block.timestamp);
        totalBoughtForContributors = amounts[1];
    }

    function createRootedBaseLiquidity() private
    {
        uint256 elitePerLpToken = eliteToken.balanceOf(address(rootedEliteLP)).mul(1e18).div(rootedEliteLP.totalSupply());
        uint256 lpAmountToRemove = baseToken.balanceOf(address(eliteToken)).mul(1e18).div(elitePerLpToken);
        
        (uint256 eliteAmount, uint256 rootedAmount) = uniswapV2Router.removeLiquidity(address(eliteToken), address(rootedToken), lpAmountToRemove, 0, 0, address(this), block.timestamp);
        
        uint256 baseInElite = baseToken.balanceOf(address(eliteToken));
        uint256 baseAmount = eliteAmount > baseInElite ? baseInElite : eliteAmount;       
        
        eliteToken.withdrawTokens(baseAmount);
        uniswapV2Router.addLiquidity(address(baseToken), address(rootedToken), baseAmount, rootedAmount, 0, 0, liquidityController, block.timestamp);
        rootedEliteLP.transfer(liquidityController, rootedEliteLP.balanceOf(address(this)));
        eliteToken.transfer(liquidityController, eliteToken.balanceOf(address(this)));
    }

    function eliteRootedPath() private view returns (address[] memory)
    {
        address[] memory path = new address[](2);
        path[0] = address(eliteToken);
        path[1] = address(rootedToken);
        return path;
    }

    function rootedElitePath() private view returns (address[] memory)
    {
        address[] memory path = new address[](2);
        path[0] = address(rootedToken);
        path[1] = address(eliteToken);
        return path;
    }
    
    function getTotalClaim(address account) public view returns (uint256)
    {
        uint256 contribution = marketGeneration.contribution(account);
        return contribution == 0 ? 0 : contribution.mul(totalBoughtForContributors).div(marketGeneration.totalContribution());
    }

    function getReferralClaim(address account) public view returns (uint256)
    {
        uint256 referralShare = marketGeneration.referralPoints(account);
        return referralShare == 0 ? 0 : referralShare.mul(totalBoughtForReferrals).div(marketGeneration.totalReferralPoints());
    }

    function claim(address account) public override 
    {
        require (distributionComplete, "Distribution is not completed");
        require (msg.sender == address(marketGeneration), "Unauthorized");

        if (totalClaim[account] == 0)
        {
            totalClaim[account] = remainingClaim[account] = getTotalClaim(account);
        }

        uint256 share = totalClaim[account];
        uint256 endTime = vestingPeriodEndTime > block.timestamp ? block.timestamp : vestingPeriodEndTime;

        require (claimTime[account] < endTime, "Already claimed");

        uint256 claimStartTime = claimTime[account] == 0 ? vestingPeriodStartTime : claimTime[account];
        share = (endTime.sub(claimStartTime)).mul(share).div(vestingDuration);
        claimTime[account] = block.timestamp;
        remainingClaim[account] -= share;
        rootedToken.transfer(account, share);
    }

    function claimReferralRewards(address account, uint256 referralShare) public override 
    {
        require (distributionComplete, "Distribution is not completed");
        require (msg.sender == address(marketGeneration), "Unauthorized");

        uint256 share = referralShare.mul(totalBoughtForReferrals).div(marketGeneration.totalReferralPoints());
        rootedToken.transfer(account, share);
    }

    function canRecoverTokens(IERC20 token) internal override view returns (bool) 
    { 
        return block.timestamp > recoveryDate || token != rootedToken;
    }
}