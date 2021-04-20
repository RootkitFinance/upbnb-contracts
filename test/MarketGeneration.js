const { ethers } = require("hardhat");
const { expect } = require("chai");
const { constants, utils, BigNumber } = require("ethers");

describe("MarketGeneration", function () {
    let owner, dev, user1, user2, user3, rootedToken, baseToken, marketGeneration, marketDistribution, marketDistributionFactory;

    beforeEach(async function () {
        [owner, dev, user1, user2, user3] = await ethers.getSigners();

        const rootedTokenFactory = await ethers.getContractFactory("RootedToken");
        rootedToken = await rootedTokenFactory.connect(owner).deploy();
        const baseTokenFactory = await ethers.getContractFactory("ERC20Test");
        baseToken = await baseTokenFactory.connect(owner).deploy();
        const marketGenerationFactory = await ethers.getContractFactory("MarketGeneration");
        marketGeneration = await marketGenerationFactory.connect(owner).deploy(baseToken.address, dev.address);
        marketDistributionFactory = await ethers.getContractFactory("MarketDistributionTest");
        marketDistribution = await marketDistributionFactory.connect(owner).deploy(rootedToken.address, baseToken.address);
    })

    it("initializes as expected", async function () {
        expect(await marketGeneration.isActive()).to.equal(false);
        expect(await marketGeneration.marketDistribution()).to.equal(constants.AddressZero);
    })

    it("owner-only functions fail from non-owner", async function () {
        await expect(marketGeneration.connect(user1).activate(user1.address)).to.be.revertedWith("Owner only");
        await expect(marketGeneration.connect(user1).setMarketDistribution(user1.address)).to.be.revertedWith("Owner only");
        await expect(marketGeneration.connect(user1).complete()).to.be.revertedWith("Owner only");
        await expect(marketGeneration.connect(user1).allowRefunds()).to.be.revertedWith("Owner only");
    })

    it("active-only functions fail when not active", async function () {
        await expect(marketGeneration.connect(owner).setMarketDistribution(user1.address)).to.be.revertedWith("Distribution not active");
        await expect(marketGeneration.connect(owner).complete()).to.be.revertedWith("Distribution not active");
        await expect(marketGeneration.connect(owner).allowRefunds()).to.be.revertedWith("Distribution not active");
        await expect(marketGeneration.connect(user1).contribute(utils.parseEther("1"), 2, user2.address)).to.be.revertedWith("Distribution not active");
    })

    describe("activate() called", function () {
        beforeEach(async function () {
            await marketGeneration.connect(owner).activate(marketDistribution.address);
        })

        it("initializes as expected", async function () {
            expect(await marketGeneration.marketDistribution()).to.equal(marketDistribution.address);
            expect(await marketGeneration.isActive()).to.equal(true);
        })

        describe("complete() works as expected", function () {
            it("Can complete", async function () {
                await marketGeneration.connect(owner).complete();
                expect(await marketGeneration.isActive()).to.equal(false);
            })

            it("Can reactivate if nothing ever happened", async function () {
                await marketGeneration.connect(owner).complete();
                await marketGeneration.connect(owner).activate(marketGeneration.address);
                expect(await marketGeneration.isActive()).to.equal(true);
            })
        })

        describe("User 1/2/3 contributes 1/2/3 Target Tokens to round 1/2/3", async function () {
            beforeEach(async function () {
                await baseToken.connect(owner).transfer(user1.address, utils.parseEther("1"));
                await baseToken.connect(owner).transfer(user2.address, utils.parseEther("2"));
                await baseToken.connect(owner).transfer(user3.address, utils.parseEther("3"));

                await baseToken.connect(user1).approve(marketGeneration.address, utils.parseEther("1"));
                await baseToken.connect(user2).approve(marketGeneration.address, utils.parseEther("2"));
                await baseToken.connect(user3).approve(marketGeneration.address, utils.parseEther("3"));
                await baseToken.connect(owner).approve(marketGeneration.address, utils.parseEther("10"));

                await marketGeneration.connect(user1).contribute(utils.parseEther("1"), 1, owner.address);
                await marketGeneration.connect(user2).contribute(utils.parseEther("2"), 2, user1.address);
                await marketGeneration.connect(user3).contribute(utils.parseEther("3"), 3, user1.address);
            })

            it("records contributions", async function () {
                expect(await marketGeneration.contributionPerRound(user1.address, 1)).to.equal(utils.parseEther("1"));
                expect(await marketGeneration.contributionPerRound(user2.address, 2)).to.equal(utils.parseEther("2"));
                expect(await marketGeneration.contributionPerRound(user3.address, 3)).to.equal(utils.parseEther("3"));
            })

            it("records referral points", async function () {
                expect(await marketGeneration.referralPoints(owner.address)).to.equal(utils.parseEther("1"));
                expect(await marketGeneration.referralPoints(user1.address)).to.equal(utils.parseEther("6"));
                expect(await marketGeneration.referralPoints(user2.address)).to.equal(utils.parseEther("2"));
                expect(await marketGeneration.referralPoints(user3.address)).to.equal(utils.parseEther("3"));
            })

            it("sends referral points to dev if no referral is specified", async function () {
                await marketGeneration.connect(owner).contribute(utils.parseEther("10"), 3, constants.AddressZero);
                expect(await marketGeneration.referralPoints(dev.address)).to.equal(utils.parseEther("10"));
            })

            it("records total round contributions", async function () {
                expect(await marketGeneration.totalContributionPerRound(1)).to.equal(utils.parseEther("1"));
                expect(await marketGeneration.totalContributionPerRound(2)).to.equal(utils.parseEther("2"));
                expect(await marketGeneration.totalContributionPerRound(3)).to.equal(utils.parseEther("3"));

                await baseToken.connect(owner).transfer(user1.address, utils.parseEther("4"));
                await baseToken.connect(user1).approve(marketGeneration.address, utils.parseEther("4"));
                await marketGeneration.connect(user1).contribute(utils.parseEther("4"), 1, owner.address);

                expect(await marketGeneration.totalContributionPerRound(1)).to.equal(utils.parseEther("5"));
            })

            describe("Distribution contract changed", function () {
                let marketDistribution2;

                beforeEach(async function () {
                    marketDistribution2 = await marketDistributionFactory.connect(owner).deploy(rootedToken.address, baseToken.address);
                    await marketGeneration.connect(owner).setMarketDistribution(marketDistribution2.address);
                })

                it("initializes as expected", async function () {
                    expect(await marketGeneration.marketDistribution()).to.equal(marketDistribution2.address);
                })

                it("complete() can't be called immediately", async function () {
                    await expect(marketGeneration.connect(owner).complete()).to.be.revertedWith("Refund period is still active");
                })

                it("claim() works", async function () {
                    await marketGeneration.connect(user1).claim();
                    await marketGeneration.connect(user2).claim();
                    await marketGeneration.connect(user3).claim();

                    expect(await baseToken.balanceOf(marketGeneration.address)).to.equal("0");
                    expect(await baseToken.balanceOf(user1.address)).to.equal(utils.parseEther("1"));
                    expect(await baseToken.balanceOf(user2.address)).to.equal(utils.parseEther("2"));
                    expect(await baseToken.balanceOf(user3.address)).to.equal(utils.parseEther("3"));
                })
            })

            describe("complete() called", function () {
                beforeEach(async function () {
                    await marketGeneration.connect(owner).complete();
                })

                it("works as expected", async function () {
                    expect(await marketGeneration.isActive()).to.equal(false);
                    expect(await baseToken.balanceOf(marketGeneration.address)).to.equal("0");
                    expect(await baseToken.balanceOf(marketDistribution.address)).to.equal(utils.parseEther("6"));
                    expect(await rootedToken.balanceOf(marketDistribution.address)).to.equal(await rootedToken.totalSupply());
                })

                it("claim() works", async function () {
                    await marketGeneration.connect(user1).claim();
                    await marketGeneration.connect(user2).claim();
                    await marketGeneration.connect(user3).claim();

                    expect(await marketDistribution.claimCallAmount(user1.address)).to.equal(utils.parseEther("1"));
                    expect(await marketDistribution.claimCallAmount(user2.address)).to.equal(utils.parseEther("2"));
                    expect(await marketDistribution.claimCallAmount(user3.address)).to.equal(utils.parseEther("3"));
                })

                it("claimReferralRewards() works", async function () {
                    await marketGeneration.connect(user1).claimReferralRewards();
                    await marketGeneration.connect(user2).claimReferralRewards();
                    await marketGeneration.connect(user3).claimReferralRewards();

                    expect(await marketDistribution.claimReferralRewardCallAmount(user1.address)).to.equal(utils.parseEther("6"));
                    expect(await marketDistribution.claimReferralRewardCallAmount(user2.address)).to.equal(utils.parseEther("2"));
                    expect(await marketDistribution.claimReferralRewardCallAmount(user3.address)).to.equal(utils.parseEther("3"));

                    await expect(marketGeneration.connect(user1).claimReferralRewards()).to.be.revertedWith("No rewards to claim");
                })
            })
        })
    })
})