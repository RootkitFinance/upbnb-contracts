const { expect } = require("chai");
const { constants, utils } = require("ethers");
const { ethers } = require("hardhat");
const { createUniswap } = require("./helpers");

 describe("RootKitTransferGate", function() {
      let rooted, rootedTransferGate, owner, user1, elite, uniswap, feeSplitter, rootedEliteLp;

    beforeEach(async function() {
        [owner, dev, user1, feeSplitter] = await ethers.getSigners();
        const rootedFactory = await ethers.getContractFactory("RootedToken");
        rooted = await rootedFactory.connect(owner).deploy();
        const baseFactory = await ethers.getContractFactory("ERC20Test");
        const base = await baseFactory.connect(owner).deploy();
        const eliteFactory = await ethers.getContractFactory("EliteToken");
        elite = await eliteFactory.connect(owner).deploy(base.address);
        uniswap = await createUniswap(owner);
        await base.connect(owner).approve(elite.address, utils.parseEther("100"));
        await elite.connect(owner).depositTokens(utils.parseEther("100"));       

        await uniswap.factory.createPair(rooted.address, elite.address);
        const rootedEliteAddress = await uniswap.factory.getPair(rooted.address, elite.address);
        rootedEliteLp = uniswap.pairFor(rootedEliteAddress);

        const rootedTransferGateFactory = await ethers.getContractFactory("RootedTransferGate");        
        rootedTransferGate = await rootedTransferGateFactory.connect(owner).deploy(rooted.address, uniswap.router.address);
        
        await rooted.connect(owner).setTransferGate(rootedTransferGate.address);
        await rooted.connect(owner).setMinter(owner.address);
        await rooted.connect(owner).mint("10000000000"); //10000       
    });

    it("setUnrestrictedController() fails from non-owner", async function() {
        await expect(rootedTransferGate.connect(user1).setUnrestrictedController(user1.address, true)).to.be.revertedWith("Owner only");
    })
        
    it("setFreeParticipantController fails from non-owner", async function() {
        await expect(rootedTransferGate.connect(user1).setFreeParticipantController(user1.address, true)).to.be.revertedWith("Owner only");
    })

    it("setFeeControllers() fails from non-owner", async function() {
        await expect(rootedTransferGate.connect(user1).setFeeControllers(user1.address, true)).to.be.revertedWith("Owner only");
    })
        
    it("setFeeSplitter() fails from non-owner", async function() {
        await expect(rootedTransferGate.connect(user1).setFeeSplitter(user1.address)).to.be.revertedWith("Owner only");
    })

    it("setFreeParticipant() fails from non-owner or not a free participant controller", async function() {
        await expect(rootedTransferGate.connect(user1).setFreeParticipant(user1.address, true)).to.be.revertedWith("Not an owner or free participant controller");
    })

    it("setUnrestricted() fails from not an unrestricted controllerr", async function() {
        await expect(rootedTransferGate.connect(owner).setUnrestricted(true)).to.be.revertedWith("Not an unrestricted controller");
    })

    it("setTaxedPool() fails from non-owner", async function() {
        await expect(rootedTransferGate.connect(user1).setTaxedPool(rootedEliteLp.address)).to.be.revertedWith("Owner only");
    })

    it("setDumpTax() fails from non-owner or not a fee controller", async function() {
        await expect(rootedTransferGate.connect(user1).setDumpTax("2500", "6000")).to.be.revertedWith("Not an owner or fee controller");
    })

    it("setDumpTax() fails when start tax rate is more than 25", async function() {
        await expect(rootedTransferGate.connect(owner).setDumpTax("2600", "6000")).to.be.revertedWith("Dump tax rate must be less than or equal to 25%");
    })

    it("setFees() fails from non-owner or not a fee controller", async function() {
        await expect(rootedTransferGate.connect(user1).setFees("1000")).to.be.revertedWith("Not an owner or fee controller");
    })

    it("setFees() fails when start tax rate is more than 10", async function() {
        await expect(rootedTransferGate.connect(owner).setFees("1100")).to.be.revertedWith("Fee rate must be less than or equal to 10%");
    })

    it("setSellFees() fails from non-owner or not a fee controller", async function() {
        await expect(rootedTransferGate.connect(user1).setSellFees("2500")).to.be.revertedWith("Not an owner or fee controller");
    })

    it("setSellFees() fails when start tax rate is more than 25", async function() {
        await expect(rootedTransferGate.connect(owner).setSellFees("2600")).to.be.revertedWith("Sell fee rate must be less than or equal to 25%");
    })

    describe("sets fee splitter", function() {
        beforeEach(async function() {
            await rootedTransferGate.connect(owner).setFees("1000");
            await rootedTransferGate.connect(owner).setFeeSplitter(feeSplitter.address);
            await rootedTransferGate.connect(owner).setFreeParticipant(feeSplitter.address, true);
        })

        it("collects fees on transfer", async function() {
            await rootedTransferGate.connect(owner).setFees("1000");
            await rooted.connect(owner).transfer(user1.address, utils.parseEther("100"));
            expect(await rooted.totalSupply()).to.equal(utils.parseEther("10000"));
            expect(await rooted.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
            expect(await rooted.balanceOf(user1.address)).to.equal(utils.parseEther("90"));
            expect(await rooted.balanceOf(feeSplitter.address)).to.equal(utils.parseEther("10"));
        });

        it("does not collect fees for a free participant", async function() {
            await rootedTransferGate.connect(owner).setFees("1000");
            await rootedTransferGate.connect(owner).setFreeParticipant(owner.address, true);
            await rooted.connect(owner).transfer(user1.address, utils.parseEther("100"));
            expect(await rooted.totalSupply()).to.equal(utils.parseEther("10000"));
            expect(await rooted.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
            expect(await rooted.balanceOf(user1.address)).to.equal(utils.parseEther("100"));
            expect(await rooted.balanceOf(feeSplitter.address)).to.equal(utils.parseEther("0"));
        });

        describe("sets taxed pool", function() {
            beforeEach(async function() {
                await rootedTransferGate.connect(owner).setTaxedPool(rootedEliteLp.address);           

                await rootedEliteLp.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
                await rooted.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
                await elite.connect(owner).approve(uniswap.router.address, constants.MaxUint256);

                const amount = utils.parseEther("100");
                await uniswap.router.connect(owner).addLiquidity(elite.address, rooted.address, amount, amount, 0, 0, owner.address, 2e9);
            })
    
            it("collects sell fees on swap", async function() {
                await rootedTransferGate.connect(owner).setSellFees("2000");
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(utils.parseEther("10"), 0, [rooted.address, elite.address], owner.address, 2e9);
                expect(await rooted.balanceOf(feeSplitter.address)).to.equal(utils.parseEther("2"));
            });
    
            it("collects sell fees and dump tax on swap", async function() {
                await rootedTransferGate.connect(owner).setSellFees("2000");
                await rootedTransferGate.connect(owner).setDumpTax("2000", "600000");
                
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(utils.parseEther("10"), 0, [rooted.address, elite.address], owner.address, 2e9);
                const balance = utils.formatEther((await rooted.balanceOf(feeSplitter.address)).toString());
                expect(parseFloat(balance)).to.be.greaterThan(3.99); // ~ 4. Dump tax rate decreases with time.
            });
        });
    });
 });