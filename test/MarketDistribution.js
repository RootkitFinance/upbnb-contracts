const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createUniswap } = require("./helpers");
const { utils, constants } = require("ethers");

describe("MarketDistribution", function () {
    let owner, dev, user1, user2, user3, rootedToken, baseToken, eliteToken, rootedBaseLp, marketGeneration, marketDistribution, rootedTransferGate, uniswap;

    const parseTether = (value) => value + "000000"

    beforeEach(async function () {
        [owner, dev, user1, user2, user3] = await ethers.getSigners();

        const rootedTokenFactory = await ethers.getContractFactory("RootedToken");
        rootedToken = await rootedTokenFactory.connect(owner).deploy();
        const baseTokenFactory = await ethers.getContractFactory("TetherTest");
        baseToken = await baseTokenFactory.connect(owner).deploy();
        const eliteTokenFactory = await ethers.getContractFactory("EliteToken");
        eliteToken = await eliteTokenFactory.connect(owner).deploy(baseToken.address);
        uniswap = await createUniswap(owner, baseToken);

        const marketGenerationFactory = await ethers.getContractFactory("MarketGeneration");
        marketGeneration = await marketGenerationFactory.connect(owner).deploy(baseToken.address, dev.address);

        const marketDistributionFactory = await ethers.getContractFactory("MarketDistribution");
        marketDistribution = await marketDistributionFactory.connect(owner).deploy(rootedToken.address, eliteToken.address, marketGeneration.address, uniswap.router.address, dev.address);

        const rootedTransferGateFactory = await ethers.getContractFactory("RootedTransferGate");
        rootedTransferGate = await rootedTransferGateFactory.connect(owner).deploy(rootedToken.address, uniswap.router.address);
        await rootedToken.connect(owner).setTransferGate(rootedTransferGate.address);
        await rootedTransferGate.connect(owner).setUnrestrictedController(marketDistribution.address, true);
        await eliteToken.connect(owner).setSweeper(marketDistribution.address, true);

        await rootedToken.connect(owner).setLiquidityController(rootedTransferGate.address, true);

        const eliteFloorCalculatorFactory = await ethers.getContractFactory("EliteFloorCalculator");
        const eliteFloorCalculator = await eliteFloorCalculatorFactory.connect(owner).deploy(rootedToken.address, uniswap.factory.address);
        await eliteToken.connect(owner).setFloorCalculator(eliteFloorCalculator.address);

        await rootedToken.connect(owner).setMinter(marketDistribution.address);
        await marketGeneration.connect(owner).activate(marketDistribution.address);

        await baseToken.connect(owner).transfer(user1.address, parseTether("1"));
        await baseToken.connect(owner).transfer(user2.address, parseTether("2"));
        await baseToken.connect(owner).transfer(user3.address, parseTether("3"));

        await baseToken.connect(user1).approve(marketGeneration.address, parseTether("1"));
        await baseToken.connect(user2).approve(marketGeneration.address, parseTether("2"));
        await baseToken.connect(user3).approve(marketGeneration.address, parseTether("3"));

        await marketGeneration.connect(user1).contribute(parseTether("1"), 1, constants.AddressZero);
        await marketGeneration.connect(user2).contribute(parseTether("2"), 2, constants.AddressZero);
        await marketGeneration.connect(user3).contribute(parseTether("3"), 3, user1.address);
    })

    it("initializes as expected", async function () {
        expect(await marketDistribution.totalBaseTokenCollected()).to.equal(0);
        expect(await marketDistribution.devCutPercent()).to.equal(1000);
        expect(await marketDistribution.preBuyForReferralsPercent()).to.equal(200);
        expect(await marketDistribution.preBuyForMarketManipulationPercent()).to.equal(800);
        expect(await uniswap.factory.getPair(eliteToken.address, rootedToken.address)).to.equal(constants.AddressZero);
        expect(await uniswap.factory.getPair(baseToken.address, rootedToken.address)).to.equal(constants.AddressZero);
    })

    it("completeSetup() can't be called by non-owner", async function () {
        await expect(marketDistribution.connect(user1).completeSetup()).to.be.revertedWith("Owner only");
    })

    it("reverts claim() because distribution is not completed", async function () {
        await expect(marketGeneration.connect(user1).claim()).to.be.revertedWith("Distribution is not completed");
    })

    it("reverts claimReferralRewards() because distribution is not completed", async function () {
        await expect(marketGeneration.connect(user1).claimReferralRewards()).to.be.revertedWith("Distribution is not completed");
    })

    describe("setupEliteRooted(), setupBaseRooted(), completeSetup(), complete() called", function () {

        beforeEach(async function () {
            await marketDistribution.connect(owner).setupEliteRooted();
            await marketDistribution.connect(owner).setupBaseRooted();
            await marketDistribution.connect(owner).completeSetup();
            rootedBaseLp = await uniswap.factory.getPair(baseToken.address, rootedToken.address);
            await rootedTransferGate.connect(owner).setTaxedPool(rootedBaseLp);
            await marketGeneration.connect(owner).complete();
        })

        it("initialized as expected", async function () {
            expect(await marketDistribution.totalBaseTokenCollected()).to.equal(parseTether("6"));
            expect(await rootedToken.totalSupply()).to.equal(utils.parseEther("6"));
            expect(await uniswap.factory.getPair(eliteToken.address, rootedToken.address)).not.to.equal(constants.AddressZero);
            expect(await uniswap.factory.getPair(baseToken.address, rootedToken.address)).not.to.equal(constants.AddressZero);
        })

        it("distributed as expected", async function() {
            expect(await marketDistribution.totalBoughtForReferrals()).not.to.equal(0);
            expect(await rootedToken.balanceOf(dev.address)).not.to.equal(0);
            expect(await baseToken.balanceOf(dev.address)).not.to.equal(0);
            expect(await marketDistribution.totalRootedTokenBoughtPerRound(1)).not.to.equal(0);
            expect(await marketDistribution.totalRootedTokenBoughtPerRound(2)).not.to.equal(0);
            expect(await marketDistribution.totalRootedTokenBoughtPerRound(3)).not.to.equal(0);
        })

        it("claim works as expected", async function() {
            await marketGeneration.connect(user1).claim();
            await marketGeneration.connect(user2).claim();
            await marketGeneration.connect(user3).claim();

            expect(await rootedToken.balanceOf(user1.address)).not.to.equal(0);
            expect(await rootedToken.balanceOf(user2.address)).not.to.equal(0);
            expect(await rootedToken.balanceOf(user3.address)).not.to.equal(0);
        })

        it("claimReferralRewards works as expected", async function() {
            await marketGeneration.connect(user1).claimReferralRewards();
            await marketGeneration.connect(user3).claimReferralRewards();

            expect(await rootedToken.balanceOf(user1.address)).not.to.equal(0);
            expect(await rootedToken.balanceOf(user3.address)).not.to.equal(0);
        }) 
    })
})