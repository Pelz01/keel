const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KEEL Self-Stabilizing Liquidity Hook", function () {
  let owner;
  let trader1;
  let trader2;
  let manager;
  let hook;
  let lens;
  let token0;
  let token1;
  let poolKey;
  let poolId;

  const baseFee = 3000; // 0.30%
  const minFee = 500; // 0.05%
  const maxFee = 15000; // 1.50%
  const neutralThreshold = 1500; // 15%

  beforeEach(async function () {
    [owner, trader1, trader2] = await ethers.getSigners();

    // Deploy MockPoolManager
    const MockPoolManager = await ethers.getContractFactory("MockPoolManager");
    manager = await MockPoolManager.deploy();

    // Deploy KeelHook
    const KeelHook = await ethers.getContractFactory("KeelHook");
    hook = await KeelHook.deploy(
      await manager.getAddress(),
      baseFee,
      minFee,
      maxFee,
      neutralThreshold
    );

    // Deploy KeelLens
    const KeelLens = await ethers.getContractFactory("KeelLens");
    lens = await KeelLens.deploy();

    // Deploy Mock ERC20s for pool currencies
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token0 = await MockERC20.deploy("Token 0", "TK0", 18);
    token1 = await MockERC20.deploy("Token 1", "TK1", 18);

    const token0Addr = await token0.getAddress();
    const token1Addr = await token1.getAddress();

    // Uniswap v4 pool key
    poolKey = {
      currency0: token0Addr < token1Addr ? token0Addr : token1Addr,
      currency1: token0Addr < token1Addr ? token1Addr : token0Addr,
      fee: 3000,
      tickSpacing: 60,
      hooks: await hook.getAddress(),
    };

    // Calculate poolId
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encodedKey = abiCoder.encode(
      ["address", "address", "uint24", "int24", "address"],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ]
    );
    poolId = ethers.keccak256(encodedKey);

    // Initialize pool
    await manager.initializePool(poolKey, 0, 0, "0x");
  });

  it("should initialize the pool and log default settings", async function () {
    const summary = await lens.getPoolSummary(await hook.getAddress(), poolId);
    expect(summary.token0ToToken1Volume).to.equal(0);
    expect(summary.token1ToToken0Volume).to.equal(0);
    expect(summary.imbalanceBps).to.equal(0);
    expect(summary.healthStatus).to.equal(0); // Centered
    expect(summary.recoveryBudget).to.equal(0);
  });

  it("should classify small initial swaps as neutral and charge the base fee", async function () {
    const amount = ethers.parseEther("100");
    const zeroForOne = true; // token0 -> token1
    const params = {
      zeroForOne: zeroForOne,
      amountSpecified: -amount, // exact input
      sqrtPriceLimitX96: 0,
    };

    // Check preview
    const preview = await lens.previewSwap(await hook.getAddress(), poolId, zeroForOne);
    expect(preview.tradeClass).to.equal(0); // Neutral
    expect(preview.finalFee).to.equal(baseFee);

    // Execute swap
    const tx = await manager.connect(trader1).swap(poolKey, params, "0x");
    const receipt = await tx.wait();

    // Verify events were emitted correctly
    const summary = await lens.getPoolSummary(await hook.getAddress(), poolId);
    expect(summary.token0ToToken1Volume).to.equal(amount);
    expect(summary.token1ToToken0Volume).to.equal(0);
    expect(summary.imbalanceBps).to.equal(10000); // 100% imbalance since there is no reverse flow
  });

  it("should classify swaps as toxic when continuing the dominant direction and apply surcharges", async function () {
    // Initial swap to establish dominant direction
    const firstAmount = ethers.parseEther("1000");
    await manager.connect(trader1).swap(
      poolKey,
      {
        zeroForOne: true,
        amountSpecified: -firstAmount,
        sqrtPriceLimitX96: 0,
      },
      "0x"
    );

    // Current state has 100% imbalance. Dominant direction is zeroForOne=true.
    // The next swap in the same direction (zeroForOne=true) should be classified as Toxic.
    const secondAmount = ethers.parseEther("500");
    
    // Preview swap
    const preview = await lens.previewSwap(await hook.getAddress(), poolId, true);
    expect(preview.tradeClass).to.equal(2); // Toxic
    expect(preview.toxicSurcharge).to.be.greaterThan(0);
    expect(preview.finalFee).to.equal(BigInt(baseFee) + preview.toxicSurcharge);

    // Execute swap and check event logs
    const tx = await manager.connect(trader2).swap(
      poolKey,
      {
        zeroForOne: true,
        amountSpecified: -secondAmount,
        sqrtPriceLimitX96: 0,
      },
      "0x"
    );
    await tx.wait();

    // Check vault budget is funded by toxic swap
    const summary = await lens.getPoolSummary(await hook.getAddress(), poolId);
    expect(summary.recoveryBudget).to.be.greaterThan(0);
    
    const expectedSurcharge = (secondAmount * BigInt(preview.toxicSurcharge)) / 1000000n;
    expect(summary.recoveryBudget).to.equal(expectedSurcharge);
  });

  it("should classify swaps as healing when moving against the dominant direction and apply discounts", async function () {
    // 1. Establish dominant flow of 1000 token0 -> token1
    const firstAmount = ethers.parseEther("1000");
    await manager.connect(trader1).swap(
      poolKey,
      {
        zeroForOne: true,
        amountSpecified: -firstAmount,
        sqrtPriceLimitX96: 0,
      },
      "0x"
    );

    // 2. Perform a toxic swap to load the recovery budget
    const toxicAmount = ethers.parseEther("500");
    await manager.connect(trader1).swap(
      poolKey,
      {
        zeroForOne: true,
        amountSpecified: -toxicAmount,
        sqrtPriceLimitX96: 0,
      },
      "0x"
    );

    const initialSummary = await lens.getPoolSummary(await hook.getAddress(), poolId);
    const initialBudget = initialSummary.recoveryBudget;
    expect(initialBudget).to.be.greaterThan(0);

    // 3. Swap in the opposite direction (zeroForOne=false) which heals the pool
    const healingAmount = ethers.parseEther("300");
    const preview = await lens.previewSwap(await hook.getAddress(), poolId, false);
    expect(preview.tradeClass).to.equal(1); // Healing
    expect(preview.healingDiscount).to.be.greaterThan(0);
    expect(preview.finalFee).to.equal(BigInt(baseFee) - preview.healingDiscount);

    // Execute healing swap and verify the hook emits the judge-facing proof event.
    const trader2Address = await trader2.getAddress();
    const tx = await manager.connect(trader2).swap(
      poolKey,
      {
        zeroForOne: false,
        amountSpecified: -healingAmount,
        sqrtPriceLimitX96: 0,
      },
      "0x"
    );
    const expectedReward = (healingAmount * BigInt(preview.healingDiscount)) / 1000000n;
    await expect(tx)
      .to.emit(hook, "RecoveryCredited")
      .withArgs(poolId, trader2Address, expectedReward, expectedReward);

    // 4. Verify trader earned recovery credits and vault budget was reduced
    const traderCredits = await lens.getTraderData(
      await hook.getAddress(),
      poolId,
      trader2Address
    );
    
    expect(traderCredits).to.equal(expectedReward);

    const finalSummary = await lens.getPoolSummary(await hook.getAddress(), poolId);
    expect(finalSummary.recoveryBudget).to.equal(initialBudget - expectedReward);
  });
});
