// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

/* ROOTKIT:
A transfer gate (GatedERC20) for use with upTokens

It:
    Allows customization of tax and burn rates
    Allows transfer to/from approved pools
    Disallows transfer to/from non-approved pools
    Allows transfer to/from anywhere else
    Allows for free transfers if permission granted
    Allows for unrestricted transfers if permission granted
    Allows for a pool to have an extra tax
    Allows for a temporary declining tax
*/

import "./Address.sol";
import "./IERC20.sol";
import "./IPancakePair.sol";
import "./ILiquidityLockedERC20.sol";
import "./IPancakeRouter02.sol";
import "./SafeERC20.sol";
import "./SafeMath.sol";
import "./TokensRecoverable.sol";
import "./ITransferGate.sol";
import "./FreeParticipantRegistry.sol";
import "./BlackListRegistry.sol";
import "./PancakeLibrary.sol";

contract RootedTransferGate is TokensRecoverable, ITransferGate
{   
    using Address for address;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IPancakeRouter02 immutable internal pancakeRouter;
    ILiquidityLockedERC20 immutable internal rootedToken;
    address immutable internal baseToken;

    bool public unrestricted;
    mapping (address => bool) public unrestrictedControllers;
    mapping (address => bool) public feeControllers;
    mapping (address => uint16) public poolsTaxRates;

    address public override feeSplitter;
    address public vault;
    uint16 public feesRate;
    IPancakePair public mainPool;
    FreeParticipantRegistry public freeParticipantRegistry;
    BlackListRegistry public blackListRegistry;
   
    uint16 public dumpTaxStartRate; 
    uint256 public dumpTaxDurationInSeconds;
    uint256 public dumpTaxEndTimestamp;
    uint256 public sendToPoolPercent;

    constructor(ILiquidityLockedERC20 _rootedToken, address _baseToken, IPancakeRouter02 _pancakeRouter)
    {
        rootedToken = _rootedToken;
        baseToken = _baseToken;
        pancakeRouter = _pancakeRouter;
    }

    function setUnrestrictedController(address unrestrictedController, bool allow) public ownerOnly()
    {
        unrestrictedControllers[unrestrictedController] = allow;
    }
    
    function setFeeControllers(address feeController, bool allow) public ownerOnly()
    {
        feeControllers[feeController] = allow;
    }

    function setFreeParticipantController(address freeParticipantController, bool allow) public ownerOnly()
    {
        freeParticipantRegistry.setFreeParticipantController(freeParticipantController, allow);
    }

    function setFreeParticipant(address participant, bool free) public
    {
        require (msg.sender == owner || freeParticipantRegistry.freeParticipantControllers(msg.sender), "Not an owner or free participant controller");
        freeParticipantRegistry.setFreeParticipant(participant, free);
    }

    function setFeeSplitter(address _feeSplitter) public ownerOnly()
    {
        feeSplitter = _feeSplitter;
    }

    function setSendToPoolPercent(uint256 _sendToPoolPercent) public ownerOnly()
    {
        sendToPoolPercent = _sendToPoolPercent;
    }

    function setVault(address _vault) public ownerOnly()
    {
        vault = _vault;
    }

    function setUnrestricted(bool _unrestricted) public
    {
        require (unrestrictedControllers[msg.sender], "Not an unrestricted controller");
        unrestricted = _unrestricted;
        rootedToken.setLiquidityLock(mainPool, !_unrestricted);
    }

    function setFreeParticipantRegistry(FreeParticipantRegistry _freeParticipantRegistry) public ownerOnly()
    {
        freeParticipantRegistry = _freeParticipantRegistry;
    }

    function setBlackListRegistry(BlackListRegistry _blackListRegistry) public ownerOnly()
    {
        blackListRegistry = _blackListRegistry;
    }

    function setMainPool(IPancakePair _mainPool) public ownerOnly()
    {
        mainPool = _mainPool;
    }

     function setPoolTaxRate(address pool, uint16 taxRate) public ownerOnly()
    {
        require (taxRate <= 10000, "Fee rate must be less than or equal to 100%");
        poolsTaxRates[pool] = taxRate;        
    }

    function setDumpTax(uint16 startTaxRate, uint256 durationInSeconds) public
    {
        require (feeControllers[msg.sender] || msg.sender == owner, "Not an owner or fee controller");
        require (startTaxRate <= 10000, "Dump tax rate must be less than or equal to 100%");

        dumpTaxStartRate = startTaxRate;
        dumpTaxDurationInSeconds = durationInSeconds;
        dumpTaxEndTimestamp = block.timestamp + durationInSeconds;
    }

    function getDumpTax() public view returns (uint256)
    {
        if (block.timestamp >= dumpTaxEndTimestamp) 
        {
            return 0;
        }       
        
        return dumpTaxStartRate*(dumpTaxEndTimestamp - block.timestamp)*1e18/dumpTaxDurationInSeconds/1e18;
    }

    function setFees(uint16 _feesRate) public
    {
        require (feeControllers[msg.sender] || msg.sender == owner, "Not an owner or fee controller");
        require (_feesRate <= 10000, "Fee rate must be less than or equal to 100%");
        feesRate = _feesRate;
    }

    function handleTransfer(address, address from, address to, uint256 amount) public virtual override returns (uint256)
    {
        if (unrestricted || freeParticipantRegistry.freeParticipant(from) || freeParticipantRegistry.freeParticipant(to)) 
        {
            return 0;
        }

        if (blackListRegistry.blackList(from) || blackListRegistry.blackList(to))
        {
            return amount;
        }
        
        IERC20 rooted = IERC20(address(rootedToken));
    
        uint256 sendToPool = amount*sendToPoolPercent/10000;

        if (from == address(mainPool) && rooted.balanceOf(vault) >= sendToPool)
        {
            (uint256 reserve0, uint256 reserve1,) = mainPool.getReserves();                  
            uint256 balance0 = IERC20(mainPool.token0()).balanceOf(address(mainPool));
            uint256 balance1 = IERC20(mainPool.token1()).balanceOf(address(mainPool));
     
            uint256 amount1In = balance1 > reserve1 ? balance1 - reserve1 : 0;
            require((balance0.mul(1000)).mul(balance1.mul(1000).sub(amount1In.mul(3))) >= uint256(reserve0).mul(reserve1).mul(1000**2));      

            rooted.transferFrom(vault, address(mainPool), sendToPool);   
        }

        uint16 poolTaxRate = poolsTaxRates[to];

        if (poolTaxRate > 0) 
        {
            uint256 totalTax = getDumpTax() + poolTaxRate;
            return totalTax >= 10000 ? amount : amount * totalTax / 10000;
        }

        return amount * feesRate / 10000;
    }   
}