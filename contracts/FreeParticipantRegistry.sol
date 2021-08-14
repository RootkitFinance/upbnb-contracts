// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

import "./Owned.sol";

contract FreeParticipantRegistry is Owned
{
    mapping (address => bool) public freeParticipantControllers;
    mapping (address => bool) public freeParticipant;

    function setFreeParticipantController(address freeParticipantController, bool allow) public ownerOnly()
    {
        freeParticipantControllers[freeParticipantController] = allow;
    }

    function setFreeParticipant(address participant, bool free) public
    {
        require (msg.sender == owner || freeParticipantControllers[msg.sender], "Not an owner or free participant controller");
        freeParticipant[participant] = free;
    }
}