// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Staking.sol";
import "../src/MyToken.sol";
import "../src/RewardToken.sol";

contract StakingTest is Test {
    Staking public staking;
    MyToken public myToken;
    RewardToken public rewardToken;
    
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    
    uint256 constant INITIAL_BALANCE = 10000 * 10**18;
    uint256 constant REWARD_SUPPLY = 1000000 * 10**18;
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy tokens
        myToken = new MyToken();
        rewardToken = new RewardToken();
        
        // Deploy staking contract
        staking = new Staking(address(myToken), address(rewardToken));
        
        // Transfer reward tokens to staking contract
        rewardToken.transfer(address(staking), REWARD_SUPPLY);
        
        // Distribute tokens to users
        myToken.transfer(user1, INITIAL_BALANCE);
        myToken.transfer(user2, INITIAL_BALANCE);
        
        vm.stopPrank();
    }
    
    function testStake() public {
        uint256 stakeAmount = 1000 * 10**18;
        
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();
        
        (uint256 stakedAmount,,,) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, stakeAmount);
        assertEq(staking.totalStaked(), stakeAmount);
    }
    
    function testUnstake() public {
        uint256 stakeAmount = 1000 * 10**18;
        uint256 unstakeAmount = 500 * 10**18;
        
        // First stake
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        
        // Then unstake
        staking.unstake(unstakeAmount);
        vm.stopPrank();
        
        (uint256 stakedAmount,,,) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, stakeAmount - unstakeAmount);
        assertEq(staking.totalStaked(), stakeAmount - unstakeAmount);
    }
    
    function testRewardCalculation() public {
        uint256 stakeAmount = 1000 * 10**18;
        
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();
        
        // Fast forward 1 day
        vm.warp(block.timestamp + 1 days);
        
        uint256 expectedReward = (stakeAmount * 100 * 1) / 10000; // 1% for 1 day
        uint256 actualReward = staking.calculateReward(user1);
        
        assertEq(actualReward, expectedReward);
    }
    
    function testClaimRewards() public {
        uint256 stakeAmount = 1000 * 10**18;
        
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();
        
        // Fast forward 5 days
        vm.warp(block.timestamp + 5 days);
        
        uint256 expectedReward = (stakeAmount * 100 * 5) / 10000; // 1% for 5 days = 5%
        uint256 balanceBefore = rewardToken.balanceOf(user1);
        
        vm.prank(user1);
        staking.claimRewards();
        
        uint256 balanceAfter = rewardToken.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, expectedReward);
    }
    
    function testMultipleStakes() public {
        uint256 firstStake = 500 * 10**18;
        uint256 secondStake = 300 * 10**18;
        
        vm.startPrank(user1);
        myToken.approve(address(staking), firstStake + secondStake);
        
        // First stake
        staking.stake(firstStake);
        
        // Fast forward 2 days
        vm.warp(block.timestamp + 2 days);
        
        // Second stake (should claim rewards first)
        staking.stake(secondStake);
        vm.stopPrank();
        
        (uint256 stakedAmount,,,) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, firstStake + secondStake);
    }
    
    function testCannotStakeZero() public {
        vm.prank(user1);
        vm.expectRevert("Cannot stake 0");
        staking.stake(0);
    }
    
    function testCannotUnstakeMoreThanStaked() public {
        uint256 stakeAmount = 1000 * 10**18;
        
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        
        vm.expectRevert("Insufficient staked amount");
        staking.unstake(stakeAmount + 1);
        vm.stopPrank();
    }
    
    function testSetRewardRate() public {
        uint256 newRate = 200; // 2% per day
        
        vm.prank(owner);
        staking.setRewardRate(newRate);
        
        assertEq(staking.rewardRate(), newRate);
    }
    
    function testOnlyOwnerCanSetRewardRate() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        staking.setRewardRate(200);
    }
}