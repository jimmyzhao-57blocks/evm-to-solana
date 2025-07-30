// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RestrictedStakingToken.sol";

contract Staking is ReentrancyGuard, Ownable {
    IERC20 public stakingToken;
    IERC20 public rewardToken;

    uint256 public rewardRate = 100; // 1% per day in basis points (100 = 1%)
    uint256 public constant REWARD_PRECISION = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;

    struct StakeInfo {
        uint256 amount;
        uint256 timestamp; // Time when user first staked
        uint256 lastRewardTime; // Last time rewards were calculated
        uint256 rewardDebt; // Total rewards already claimed
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        
        // Check if user is blacklisted
        RestrictedStakingToken restrictedToken = RestrictedStakingToken(address(stakingToken));
        require(!restrictedToken.isBlacklisted(msg.sender), "Address is blacklisted");

        // Calculate and claim any pending rewards first
        if (stakes[msg.sender].amount > 0) {
            _claimRewards();
        }

        // Transfer staking tokens from user
        stakingToken.transferFrom(msg.sender, address(this), amount);

        // Update stake info
        if (stakes[msg.sender].amount == 0) {
            // First time staking - set initial timestamps
            stakes[msg.sender].timestamp = block.timestamp;
            stakes[msg.sender].lastRewardTime = block.timestamp;
        }
        stakes[msg.sender].amount += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot unstake 0");
        require(
            stakes[msg.sender].amount >= amount,
            "Insufficient staked amount"
        );
        
        // Check if user is blacklisted
        RestrictedStakingToken restrictedToken = RestrictedStakingToken(address(stakingToken));
        require(!restrictedToken.isBlacklisted(msg.sender), "Address is blacklisted");

        // Calculate and claim any pending rewards first
        _claimRewards();

        // Update stake info
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        // If user unstaked everything, reset timestamps
        if (stakes[msg.sender].amount == 0) {
            stakes[msg.sender].timestamp = 0;
            stakes[msg.sender].lastRewardTime = 0;
            stakes[msg.sender].rewardDebt = 0;
        }

        // Transfer staking tokens back to user
        stakingToken.transfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        _claimRewards();
    }

    function _claimRewards() private {
        uint256 reward = calculateReward(msg.sender);

        if (reward > 0) {
            stakes[msg.sender].rewardDebt += reward;
            stakes[msg.sender].lastRewardTime = block.timestamp;
            rewardToken.transfer(msg.sender, reward);

            emit RewardClaimed(msg.sender, reward);
        }
    }

    function calculateReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];

        if (userStake.amount == 0) {
            return 0;
        }

        // Calculate time since last reward calculation
        uint256 timeSinceLastReward = block.timestamp -
            userStake.lastRewardTime;

        // Calculate reward based on seconds to avoid precision loss
        // Formula: (amount * rate * time_in_seconds) / (seconds_per_day * precision)
        uint256 reward = (userStake.amount * rewardRate * timeSinceLastReward) /
            (SECONDS_PER_DAY * REWARD_PRECISION);

        return reward;
    }

    function getStakeInfo(
        address user
    )
        external
        view
        returns (
            uint256 stakedAmount,
            uint256 stakingTimestamp,
            uint256 pendingReward,
            uint256 claimedReward
        )
    {
        StakeInfo memory userStake = stakes[user];
        return (
            userStake.amount,
            userStake.timestamp,
            calculateReward(user),
            userStake.rewardDebt
        );
    }

    function setRewardRate(uint256 newRate) external onlyOwner {
        require(newRate > 0 && newRate <= 1000, "Invalid reward rate"); // Max 10% per day
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    // Emergency function to withdraw reward tokens
    function withdrawRewardTokens(uint256 amount) external onlyOwner {
        rewardToken.transfer(owner(), amount);
    }
}
