const { ethers } = require("hardhat");
const { utils } = require("ethers");

const PancakePairJson = require('../contracts/json/PancakePair.json');
const PancakeFactoryJson = require('../contracts/json/PancakeFactory.json');
const UniswapV2Router02Json = require('../contracts/json/UniswapV2Router02.json');
const PancakeLibraryJson = require('../contracts/json/PancakeLibrary.json');

exports.createUniswap = async function(owner) {
    const erc20Factory = await ethers.getContractFactory("ERC20Test");
    const weth = await erc20Factory.connect(owner).deploy();
    const factory = await new ethers.ContractFactory(PancakeFactoryJson.abi, PancakeFactoryJson.bytecode, owner).deploy(owner.address);
    const router = await new ethers.ContractFactory(UniswapV2Router02Json.abi, UniswapV2Router02Json.bytecode, owner).deploy(factory.address, weth.address);
    const library = await new ethers.ContractFactory(PancakeLibraryJson.abi, PancakeLibraryJson.bytecode, owner).deploy();
    return {
        factory,
        router,
        library,
        pairFor: address => new ethers.Contract(address, PancakePairJson.abi, owner)
    };
}