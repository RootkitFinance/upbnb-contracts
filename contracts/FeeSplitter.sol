// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

import "./IERC20.sol";
import "./IGatedERC20.sol";
import "./SafeMath.sol";
import "./SafeERC20.sol";
import "./Address.sol";
import "./TokensRecoverable.sol";
import './IPancakeRouter02.sol';

contract FeeSplitter is TokensRecoverable
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address;
    
    uint256 devRateMin = 1000;  
    uint256 rootRateMin = 1000; 
    address public devAddress;
    address public immutable deployerAddress;
    address public rootFeederAddress;
    IPancakeRouter02 public router;

    mapping (IGatedERC20 => address[]) public feeCollectors;
    mapping (IGatedERC20 => uint256[]) public feeRates;
    mapping (IGatedERC20 => uint256) public burnRates;
    mapping (IGatedERC20 => bool[]) public sells;

    constructor(address _devAddress, address _rootFeederAddress, IPancakeRouter02 _router)
    {
        deployerAddress = msg.sender;
        devAddress = _devAddress;
        rootFeederAddress = _rootFeederAddress;
        router = _router;      
    }

    function setDevAddress(address _devAddress) public
    {
        require (msg.sender == deployerAddress || msg.sender == devAddress, "Not a deployer or dev address");
        devAddress = _devAddress;
    }

    function setRootFeederAddress(address _rootFeederAddress) public ownerOnly()
    {
        rootFeederAddress = _rootFeederAddress;
    }

    function setFees(IGatedERC20 token, uint256 burnRate, address[] memory collectors, uint256[] memory rates, bool[] memory isSell) public ownerOnly() // 100% = 10000
    {
        require (collectors.length == rates.length && collectors.length == isSell.length && collectors.length > 1, "Fee Collectors, Rates and isSell must be the same size and contain at least 2 elements");
        require (collectors[0] == devAddress && collectors[1] == rootFeederAddress, "First address must be dev address, second address must be rootFeeder address");
        require (rates[0] >= devRateMin && rates[1] >= rootRateMin, "First rate must be greater or equal to devRateMin and second rate must be greater or equal to rootRateMin");
        
        uint256 totalRate = burnRate;
        for (uint256 i = 0; i < rates.length; i++)
        {
            totalRate = totalRate + rates[i];
        }

        require (totalRate == 10000, "Total fee rate must be 100%");

        feeCollectors[token] = collectors;
        feeRates[token] = rates;
        burnRates[token] = burnRate;
        sells[token] = isSell;
        token.approve(address(router), uint256(-1));
    }

    function payFees(IGatedERC20 token) public
    {
        uint256 balance = token.balanceOf(address(this));
        require (balance > 0, "Nothing to pay");

        if (burnRates[token] > 0)
        {
            uint256 burnAmount = burnRates[token] * balance / 10000;
            token.burn(burnAmount);
        }

        address[] memory collectors = feeCollectors[token];
        uint256[] memory rates = feeRates[token];
        bool[] memory isSell = sells[token];

        for (uint256 i = 0; i < collectors.length; i++)
        {
            address collector = collectors[i];
            uint256 rate = rates[i];

            if (rate > 0)
            {
                uint256 feeAmount = rate * balance / 10000;

                if (isSell[i])
                {
                    address[] memory path = new address[](2);
                    path[0] = address(token);
                    path[1] = router.WETH();
                    router.swapExactTokensForETHSupportingFeeOnTransferTokens(feeAmount, 0, path, collector, block.timestamp);
                }
                else
                {
                    token.transfer(collector, feeAmount);
                }                
            }
        }
    }

    function canRecoverTokens(IERC20 token) internal override view returns (bool) 
    { 
        address[] memory collectors = feeCollectors[IGatedERC20(address(token))];
        return address(token) != address(this) && collectors.length == 0; 
    }
}