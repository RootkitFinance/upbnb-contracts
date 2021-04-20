const { ethers } = require("hardhat");
const { expect } = require("chai");
const { utils } = require("ethers");

describe("FeeSplitter", function() {
    let rooted, feeSplitter, owner, dev, rootFeeder, feeCollector;
    const burnRate = 2000; // 20%
    const devRate = 2500; // 25%
    const rootFeederRate = 5500; // 55%

    beforeEach(async function() {
        [owner, dev, rootFeeder, feeCollector] = await ethers.getSigners();

        const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
        feeSplitter = await feeSplitterFactory.connect(owner).deploy(dev.address, rootFeeder.address);

        const rootedFactory = await ethers.getContractFactory("RootedToken");
        rooted = await rootedFactory.connect(owner).deploy();
        await rooted.connect(owner).setMinter(owner.address);
        await rooted.connect(owner).mint(utils.parseEther("1000"));
    })

    it("reverts setDevAddress when called by non deployer or dev", async function() {        
        await expect(feeSplitter.connect(rootFeeder).setDevAddress(rootFeeder.address)).to.be.revertedWith("Not a deployer or dev address");
    })

    it("sets dev address as expected", async function() {   
        feeSplitter.connect(owner).setDevAddress(feeCollector.address);
        expect(await feeSplitter.devAddress()).to.equal(feeCollector.address);
    })

    it("reverts setRootFeederAddress when called by non owner", async function() {        
        await expect(feeSplitter.connect(dev).setRootFeederAddress(feeCollector.address)).to.be.revertedWith("Owner only");
    })

    it("sets Root feeder address as expected", async function() {   
        feeSplitter.connect(owner).setRootFeederAddress(feeCollector.address);
        expect(await feeSplitter.rootFeederAddress()).to.equal(feeCollector.address);
    })

    it("sets dev address as expected", async function() {   
        feeSplitter.connect(owner).setDevAddress(feeCollector.address);
        expect(await feeSplitter.devAddress()).to.equal(feeCollector.address);
    })

    it("sets fees as expected", async function() {        
        await feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            [devRate, rootFeederRate]);
        
        expect(await feeSplitter.burnRates(rooted.address)).to.equal(burnRate);
        expect(await feeSplitter.feeCollectors(rooted.address, 0)).to.equal(dev.address);
        expect(await feeSplitter.feeCollectors(rooted.address, 1)).to.equal(rootFeeder.address);
        expect(await feeSplitter.feeRates(rooted.address, 0)).to.equal(devRate);
        expect(await feeSplitter.feeRates(rooted.address, 1)).to.equal(rootFeederRate);
    })

    it("reverts setFees because Fee Collectors and Rates contain only one element", async function() {                
        await expect(feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address], 
            [devRate]))
        .to.be.revertedWith("Fee Collectors and Rates must be the same size and contain at least 2 elements");
    })

    it("reverts setFees because Fee Collectors and Rates are not the same size", async function() {                
        await expect(feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            [devRate]))
        .to.be.revertedWith("Fee Collectors and Rates must be the same size and contain at least 2 elements");
    })  

    it("reverts setFees because Fee Collectors and Rates are empty", async function() {                
        await expect(feeSplitter.setFees(rooted.address, burnRate, [], []))
        .to.be.revertedWith("Fee Collectors and Rates must be the same size and contain at least 2 elements");
    })

    it("reverts setFees because first address is not a dev address", async function() {                
        await expect(feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [owner.address, rootFeeder.address], 
            [rootFeederRate, devRate]))
        .to.be.revertedWith("First address must be dev address, second address must be rootFeeder address");
    })

    it("reverts setFees because second address is not a rootFeeder address", async function() {                
        await expect(feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, owner.address], 
            [devRate, rootFeederRate]))
        .to.be.revertedWith("First address must be dev address, second address must be rootFeeder address");
    })

    it("reverts setFees because first rate is less than devRateMin", async function() {                
        await expect(feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            ["999", rootFeederRate]))
        .to.be.revertedWith("First rate must be greater or equal to devRateMin and second rate must be greater or equal to rootRateMin");
    })

    it("reverts setFees because second rate is less than rootRateMin", async function() {                
        await expect(feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            [devRate, "999"]))
        .to.be.revertedWith("First rate must be greater or equal to devRateMin and second rate must be greater or equal to rootRateMin");
    })

    it("reverts setFees because Total fee rate is not 100%", async function() {                
        await expect(feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            [devRate, "2000"]))
        .to.be.revertedWith("Total fee rate must be 100%");
    })

    it("reverts payFees because balance is zero", async function() {                
        await expect(feeSplitter.payFees(rooted.address)).to.be.revertedWith("Nothing to pay");
    })

    it("pays fees and burns when setFees is called if balance > 0", async function() {                 
        await feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            [devRate, rootFeederRate]);
        
        await rooted.connect(owner).transfer(feeSplitter.address, utils.parseEther("100"));

        await feeSplitter.setFees(rooted.address, 0, [dev.address, rootFeeder.address, owner.address], [2000, 2000, 6000]);

        expect(await rooted.balanceOf(feeSplitter.address)).to.equal(utils.parseEther("0"));
        expect(await rooted.balanceOf(dev.address)).to.be.equal(utils.parseEther("25"));
        expect(await rooted.balanceOf(rootFeeder.address)).to.be.equal(utils.parseEther("55"));
    })


    it("pays fees and burns as expected", async function() {                 
        await feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            [devRate, rootFeederRate]);
        
        await rooted.connect(owner).transfer(feeSplitter.address, utils.parseEther("100"));

        await feeSplitter.payFees(rooted.address);

        expect(await rooted.balanceOf(feeSplitter.address)).to.equal(utils.parseEther("0"));
        expect(await rooted.balanceOf(dev.address)).to.be.equal(utils.parseEther("25"));
        expect(await rooted.balanceOf(rootFeeder.address)).to.be.equal(utils.parseEther("55"));
    })

    it("can recover token if fee collectors are not set", async function() {       
        await rooted.connect(owner).transfer(feeSplitter.address, utils.parseEther("100"));
        await feeSplitter.recoverTokens(rooted.address);

        expect(await rooted.balanceOf(feeSplitter.address)).to.equal(0);
        expect(await rooted.balanceOf(owner.address)).to.equal(await rooted.totalSupply());
    })

    it("cannot recover token if fee collectors are set", async function() {
        await rooted.connect(owner).transfer(feeSplitter.address, utils.parseEther("100"));
        await feeSplitter.setFees(
            rooted.address, 
            burnRate, 
            [dev.address, rootFeeder.address], 
            [devRate, rootFeederRate]);

        await expect(feeSplitter.recoverTokens(rooted.address)).to.be.revertedWith();
        expect(await rooted.balanceOf(feeSplitter.address)).to.equal(utils.parseEther("100"));
    })
})