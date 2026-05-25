// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract RecoveryVault {
    address public immutable hook;

    // poolId => recovery budget
    mapping(bytes32 => uint256) public poolRecoveryBudget;
    
    // poolId => trader => user recovery credit balance
    mapping(bytes32 => mapping(address => uint256)) public recoveryCredits;

    event SurchargeCredited(bytes32 indexed poolId, uint256 amount, uint256 newBudget);
    event RewardCredited(bytes32 indexed poolId, address indexed trader, uint256 amount, uint256 newTraderBalance);
    event CreditsClaimed(bytes32 indexed poolId, address indexed trader, uint256 amount);

    modifier onlyHook() {
        require(msg.sender == hook, "Caller must be hook");
        _;
    }

    constructor(address _hook) {
        require(_hook != address(0), "Invalid hook address");
        hook = _hook;
    }

    function creditSurcharge(bytes32 poolId, uint256 amount) external onlyHook {
        if (amount == 0) return;
        poolRecoveryBudget[poolId] += amount;
        emit SurchargeCredited(poolId, amount, poolRecoveryBudget[poolId]);
    }

    function rewardTrader(bytes32 poolId, address trader, uint256 amount) external onlyHook returns (uint256 rewardAmount) {
        if (amount == 0) return 0;
        if (trader == address(0)) return 0;
        
        // Ensure we don't exceed the available budget, cap the reward if necessary
        rewardAmount = amount;
        if (rewardAmount > poolRecoveryBudget[poolId]) {
            rewardAmount = poolRecoveryBudget[poolId];
        }
        
        if (rewardAmount == 0) return 0;
        
        poolRecoveryBudget[poolId] -= rewardAmount;
        recoveryCredits[poolId][trader] += rewardAmount;
        
        emit RewardCredited(poolId, trader, rewardAmount, recoveryCredits[poolId][trader]);
        return rewardAmount;
    }

    // Allows users to claim their recovery credits
    function claimCredits(bytes32 poolId, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(recoveryCredits[poolId][msg.sender] >= amount, "Insufficient credit balance");
        
        recoveryCredits[poolId][msg.sender] -= amount;
        
        // In a production contract, we would transfer tokens here.
        // For MVP, we log the claim event and decrement the balance.
        
        emit CreditsClaimed(poolId, msg.sender, amount);
    }
}
