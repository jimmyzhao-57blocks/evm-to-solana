// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is ReentrancyGuard, Ownable {
    IERC20 public stakingToken;
    IERC20 public rewardToken;
    
    uint256 public rewardRate = 100; // 1% per day in basis points (100 = 1%)
    uint256 public constant REWARD_PRECISION = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;
    
    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 rewardDebt;
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
        
        // Calculate and claim any pending rewards first
        if (stakes[msg.sender].amount > 0) {
            _claimRewards();
        }
        
        // Transfer staking tokens from user
        stakingToken.transferFrom(msg.sender, address(this), amount);
        
        // Update stake info
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].timestamp = block.timestamp;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot unstake 0");
        require(stakes[msg.sender].amount >= amount, "Insufficient staked amount");
        
        // Calculate and claim any pending rewards first
        _claimRewards();
        
        // Update stake info
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        
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
            stakes[msg.sender].timestamp = block.timestamp;
            rewardToken.transfer(msg.sender, reward);
            
            emit RewardClaimed(msg.sender, reward);
        }
    }
    
    function calculateReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        
        if (userStake.amount == 0) {
            return 0;
        }
        
        uint256 stakingDuration = block.timestamp - userStake.timestamp;
        uint256 daysStaked = stakingDuration / SECONDS_PER_DAY;
        
        // Calculate reward: (staked amount * reward rate * days) / precision
        uint256 reward = (userStake.amount * rewardRate * daysStaked) / REWARD_PRECISION;
        
        return reward;
    }
    
    function getStakeInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 stakingTimestamp,
        uint256 pendingReward,
        uint256 claimedReward
    ) {
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