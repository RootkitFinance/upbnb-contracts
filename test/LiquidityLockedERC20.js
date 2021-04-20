const { ethers } = require("hardhat");
const { utils, constants } = require("ethers");
const { createWETH, createUniswap } = require("./helpers");
const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");

describe("LiquidityLockedERC20", async function() {
    let owner, user1;
    let liquidityLockedERC20, uniswap, baseToken, pair;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const liquidityLockedERC20Factory = await ethers.getContractFactory("LiquidityLockedERC20Test");
        liquidityLockedERC20 = await liquidityLockedERC20Factory.connect(owner).deploy();
        uniswap = await createUniswap(owner);
        const baseTokenFactory = await ethers.getContractFactory("ERC20Test");
        baseToken = await baseTokenFactory.connect(owner).deploy();

        await uniswap.factory.createPair(baseToken.address, liquidityLockedERC20.address);
        pair = uniswap.pairFor(await uniswap.factory.getPair(baseToken.address, liquidityLockedERC20.address));
        await baseToken.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await baseToken.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await pair.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await pair.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await liquidityLockedERC20.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await liquidityLockedERC20.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await baseToken.connect(owner).transfer(user1.address, utils.parseUnits("50"));
    })

    it("owner only functions can't be called by non-owners", async function() {
        await expect(liquidityLockedERC20.connect(user1).setLiquidityController(pair.address, true)).to.be.revertedWith("Owner only");
    })
    it("controller only functions can't be called by non-controller", async function() {
        await expect(liquidityLockedERC20.connect(owner).setLiquidityLock(pair.address, true)).to.be.revertedWith("Liquidity controller only");
    })

    it("initializes as expected", async function() {
        expect(await liquidityLockedERC20.liquidityPairLocked(pair.address)).to.equal(false);
        expect(await liquidityLockedERC20.liquidityController(owner.address)).to.equal(false);
    })

    describe("Liquidity for pair locked", async function() {
        beforeEach(async function() {
            await liquidityLockedERC20.connect(owner).setLiquidityController(owner.address, true);
            await liquidityLockedERC20.connect(owner).setLiquidityLock(pair.address, true);
        })

        it("initializes as expected", async function() {
            expect(await liquidityLockedERC20.liquidityPairLocked(pair.address)).to.equal(true);
            expect(await liquidityLockedERC20.liquidityController(owner.address)).to.equal(true);
        })

        it("Can't add liquidity", async function() {
            const amt = utils.parseEther("10");
            await expect(uniswap.router.connect(owner).addLiquidity(baseToken.address, liquidityLockedERC20.address, amt, amt, amt, amt, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");
        });

        it("Can't add liquidity manually", async function() {
            const amt = utils.parseEther("10");
            await baseToken.connect(owner).transfer(pair.address, amt);
            await liquidityLockedERC20.connect(owner).transfer(pair.address, amt);
            await expect(pair.connect(owner).mint(owner.address)).to.be.revertedWith("Liquidity is locked");

            await liquidityLockedERC20.connect(owner).transferFrom(owner.address, pair.address, 0);
            await expect(pair.connect(owner).mint(owner.address)).to.be.revertedWith("Liquidity is locked");
        });

        describe("Liquidity added", async function() {
            const amt = utils.parseEther("1");

            beforeEach(async function() {
                const amt = utils.parseEther("10");
                await liquidityLockedERC20.connect(owner).setLiquidityLock(pair.address, false);
                await uniswap.router.connect(owner).addLiquidity(baseToken.address, liquidityLockedERC20.address, amt, amt, amt, amt, owner.address, 2e9);
                await liquidityLockedERC20.connect(owner).setLiquidityLock(pair.address, true);
            })

            it("Can't add more liquidity", async function() {
                const amt = utils.parseEther("10");
                await expect(uniswap.router.connect(owner).addLiquidity(baseToken.address, liquidityLockedERC20.address, amt, amt, amt, amt, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");
            })

            it("Can buy", async function() {
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [baseToken.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [baseToken.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [baseToken.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [baseToken.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [baseToken.address, liquidityLockedERC20.address], owner.address, 2e9);
            })

            it("Can sell", async function() {
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, baseToken.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, baseToken.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [liquidityLockedERC20.address, baseToken.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [liquidityLockedERC20.address, baseToken.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, baseToken.address], owner.address, 2e9);
            })

            it("Can't remove liquidity", async function() {
                await expect(uniswap.router.connect(owner).removeLiquidity(baseToken.address, liquidityLockedERC20.address, await pair.balanceOf(owner.address), 0, 0, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");

                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [baseToken.address, liquidityLockedERC20.address], owner.address, 2e9);
                await expect(uniswap.router.connect(owner).removeLiquidity(baseToken.address, liquidityLockedERC20.address, await pair.balanceOf(owner.address), 0, 0, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");

                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, baseToken.address], owner.address, 2e9);
                await expect(uniswap.router.connect(owner).removeLiquidity(baseToken.address, liquidityLockedERC20.address, await pair.balanceOf(owner.address), 0, 0, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");
            })
        })
    })
})