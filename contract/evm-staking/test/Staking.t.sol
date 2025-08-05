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

    uint256 constant INITIAL_BALANCE = 10000 * 10 ** 18;
    uint256 constant REWARD_SUPPLY = 1000000 * 10 ** 18;

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
        uint256 stakeAmount = 1000 * 10 ** 18;

        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        (uint256 stakedAmount, , , ) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, stakeAmount);
        assertEq(staking.totalStaked(), stakeAmount);
    }

    function testUnstake() public {
        uint256 stakeAmount = 1000 * 10 ** 18;
        uint256 unstakeAmount = 500 * 10 ** 18;

        // First stake
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);

        // Then unstake
        staking.unstake(unstakeAmount);
        vm.stopPrank();

        (uint256 stakedAmount, , , ) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, stakeAmount - unstakeAmount);
        assertEq(staking.totalStaked(), stakeAmount - unstakeAmount);
    }

    function testRewardCalculation() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

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
        uint256 stakeAmount = 1000 * 10 ** 18;

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
        uint256 firstStake = 500 * 10 ** 18;
        uint256 secondStake = 300 * 10 ** 18;

        vm.startPrank(user1);
        myToken.approve(address(staking), firstStake + secondStake);

        // First stake
        staking.stake(firstStake);

        // Fast forward 2 days
        vm.warp(block.timestamp + 2 days);

        // Second stake (should claim rewards first)
        staking.stake(secondStake);
        vm.stopPrank();

        (uint256 stakedAmount, , , ) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, firstStake + secondStake);
    }

    function testCannotStakeZero() public {
        vm.prank(user1);
        vm.expectRevert("Cannot stake 0");
        staking.stake(0);
    }

    function testCannotUnstakeMoreThanStaked() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

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

    function testPreciseRewardCalculation() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        // Fast forward 12 hours (0.5 days)
        vm.warp(block.timestamp + 12 hours);

        // Expected reward for 0.5 days at 1% daily rate
        uint256 expectedReward = (stakeAmount * 100 * 12 hours) /
            (86400 * 10000);
        uint256 actualReward = staking.calculateReward(user1);

        assertEq(
            actualReward,
            expectedReward,
            "Reward calculation should be precise"
        );

        // Claim rewards and verify lastRewardTime is updated
        vm.prank(user1);
        staking.claimRewards();

        // Immediately check reward should be 0
        assertEq(
            staking.calculateReward(user1),
            0,
            "Reward should be 0 right after claiming"
        );

        // Fast forward another 6 hours
        vm.warp(block.timestamp + 6 hours);

        // Should only calculate reward for the last 6 hours
        uint256 expectedReward2 = (stakeAmount * 100 * 6 hours) /
            (86400 * 10000);
        uint256 actualReward2 = staking.calculateReward(user1);

        assertEq(
            actualReward2,
            expectedReward2,
            "Should only calculate reward since last claim"
        );
    }

    // Test that rewards accumulate properly without precision loss
    function testRewardPrecisionNoLoss() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        // Fast forward 12 hours (0.5 days)
        vm.warp(block.timestamp + 12 hours);

        // With the fix, we should get rewards for partial days
        uint256 reward1 = staking.calculateReward(user1);
        assertTrue(reward1 > 0, "Should have rewards for 12 hours");

        // Fast forward another 12 hours (total 1 day)
        vm.warp(block.timestamp + 12 hours);

        uint256 reward2 = staking.calculateReward(user1);
        uint256 expectedRewardForOneDay = (stakeAmount * 100) / 10000; // 1%
        assertEq(
            reward2,
            expectedRewardForOneDay,
            "Should have exactly 1% for 1 day"
        );
    }

    // Test that claiming rewards doesn't reset staking duration
    function testClaimRewardsDoesNotResetDuration() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        // Fast forward 12 hours
        vm.warp(block.timestamp + 12 hours);

        // Claim rewards
        vm.prank(user1);
        staking.claimRewards();

        // Fast forward another 12 hours (total 24 hours)
        vm.warp(block.timestamp + 12 hours);

        // Claim again
        uint256 balanceBefore = rewardToken.balanceOf(user1);
        vm.prank(user1);
        staking.claimRewards();
        uint256 balanceAfter = rewardToken.balanceOf(user1);

        // Should only get rewards for the second 12 hours
        uint256 rewardForHalfDay = (stakeAmount * 100 * 12 hours) /
            (86400 * 10000);
        assertEq(
            balanceAfter - balanceBefore,
            rewardForHalfDay,
            "Should only get rewards for time since last claim"
        );
    }

    // Test multiple claims in short intervals
    function testMultipleClaimsShortIntervals() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);

        uint256 totalRewardsClaimed = 0;

        // Claim every 6 hours for 2 days
        for (uint i = 0; i < 8; i++) {
            vm.warp(block.timestamp + 6 hours);
            uint256 balanceBefore = rewardToken.balanceOf(user1);
            staking.claimRewards();
            uint256 balanceAfter = rewardToken.balanceOf(user1);
            totalRewardsClaimed += (balanceAfter - balanceBefore);
        }

        vm.stopPrank();

        // Total rewards should be 2% (2 days * 1% per day)
        uint256 expectedTotalReward = (stakeAmount * 100 * 2) / 10000;
        assertEq(
            totalRewardsClaimed,
            expectedTotalReward,
            "Total rewards should equal 2 days worth"
        );
    }
}
