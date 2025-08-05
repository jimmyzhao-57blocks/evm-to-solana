// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Staking.sol";
import "../src/MyToken.sol";
import "../src/RewardToken.sol";
import "../src/RestrictedStakingToken.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract RestrictedStakingTest is Test {
    Staking public staking;
    MyToken public myToken;
    RewardToken public rewardToken;

    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    address public blacklistedUser = address(4);

    uint256 constant INITIAL_BALANCE = 10000 * 10 ** 18;
    uint256 constant REWARD_SUPPLY = 1000000 * 10 ** 18;
    
    // Events from RestrictedStakingToken
    event AddedToBlacklist(address indexed account);
    event RemovedFromBlacklist(address indexed account);

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
        myToken.transfer(blacklistedUser, INITIAL_BALANCE);

        vm.stopPrank();
    }

    function testBlacklistFunctionality() public {
        vm.startPrank(owner);
        
        // Add user to blacklist
        myToken.addToBlacklist(blacklistedUser);
        assertTrue(myToken.isBlacklisted(blacklistedUser));
        
        // Remove user from blacklist
        myToken.removeFromBlacklist(blacklistedUser);
        assertFalse(myToken.isBlacklisted(blacklistedUser));
        
        vm.stopPrank();
    }

    function testCannotStakeWhenBlacklisted() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        // Blacklist the user
        vm.prank(owner);
        myToken.addToBlacklist(blacklistedUser);

        // Try to stake
        vm.startPrank(blacklistedUser);
        myToken.approve(address(staking), stakeAmount);
        
        vm.expectRevert("Address is blacklisted");
        staking.stake(stakeAmount);
        vm.stopPrank();
    }

    function testCannotUnstakeWhenBlacklisted() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        // First stake as normal user
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        // Then blacklist the user
        vm.prank(owner);
        myToken.addToBlacklist(user1);

        // Try to unstake
        vm.prank(user1);
        vm.expectRevert("Address is blacklisted");
        staking.unstake(stakeAmount);
    }
    
    function testCannotClaimRewardsWhenBlacklisted() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        // First stake as normal user
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        // Fast forward to generate rewards
        vm.warp(block.timestamp + 1 days);

        // Then blacklist the user
        vm.prank(owner);
        myToken.addToBlacklist(user1);

        // Try to claim rewards
        vm.prank(user1);
        vm.expectRevert("Address is blacklisted");
        staking.claimRewards();
    }

    function testCannotTransferWhenBlacklisted() public {
        // Blacklist user1
        vm.prank(owner);
        myToken.addToBlacklist(user1);

        // Try to transfer from blacklisted address
        vm.prank(user1);
        vm.expectRevert("Sender is blacklisted");
        myToken.transfer(user2, 100);

        // Remove from blacklist and blacklist user2
        vm.startPrank(owner);
        myToken.removeFromBlacklist(user1);
        myToken.addToBlacklist(user2);
        vm.stopPrank();

        // Try to transfer to blacklisted address
        vm.prank(user1);
        vm.expectRevert("Recipient is blacklisted");
        myToken.transfer(user2, 100);
    }

    function testBatchBlacklistOperations() public {
        address[] memory addresses = new address[](3);
        addresses[0] = user1;
        addresses[1] = user2;
        addresses[2] = blacklistedUser;

        vm.startPrank(owner);
        
        // Add multiple addresses to blacklist
        myToken.addToBlacklistBatch(addresses);
        
        assertTrue(myToken.isBlacklisted(user1));
        assertTrue(myToken.isBlacklisted(user2));
        assertTrue(myToken.isBlacklisted(blacklistedUser));

        // Remove multiple addresses from blacklist
        myToken.removeFromBlacklistBatch(addresses);
        
        assertFalse(myToken.isBlacklisted(user1));
        assertFalse(myToken.isBlacklisted(user2));
        assertFalse(myToken.isBlacklisted(blacklistedUser));
        
        vm.stopPrank();
    }

    function testOnlyBlacklistAdminCanManageBlacklist() public {
        // Try to add to blacklist as non-admin
        vm.prank(user1);
        vm.expectRevert();
        myToken.addToBlacklist(user2);

        // Owner has BLACKLIST_ADMIN_ROLE from constructor, so they can manage blacklist
        vm.startPrank(owner);
        myToken.addToBlacklist(user2);
        assertTrue(myToken.isBlacklisted(user2));
        
        myToken.removeFromBlacklist(user2);
        assertFalse(myToken.isBlacklisted(user2));
        vm.stopPrank();
    }

    function testCannotMintToBlacklistedAddress() public {
        vm.startPrank(owner);
        
        // Blacklist user1
        myToken.addToBlacklist(user1);
        
        // Try to mint to blacklisted address
        vm.expectRevert("Cannot mint to blacklisted address");
        myToken.mint(user1, 1000);
        
        vm.stopPrank();
    }

    function testNormalOperationsWorkForNonBlacklisted() public {
        uint256 stakeAmount = 1000 * 10 ** 18;

        // Normal staking should work
        vm.startPrank(user1);
        myToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        
        (uint256 stakedAmount, , , ) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, stakeAmount);
        
        // Normal unstaking should work
        staking.unstake(stakeAmount / 2);
        
        (stakedAmount, , , ) = staking.getStakeInfo(user1);
        assertEq(stakedAmount, stakeAmount / 2);
        vm.stopPrank();
    }

    function testEventsEmittedCorrectly() public {
        vm.startPrank(owner);
        
        // Test AddedToBlacklist event
        vm.expectEmit(true, false, false, false, address(myToken));
        emit AddedToBlacklist(user1);
        myToken.addToBlacklist(user1);
        
        // Test RemovedFromBlacklist event
        vm.expectEmit(true, false, false, false, address(myToken));
        emit RemovedFromBlacklist(user1);
        myToken.removeFromBlacklist(user1);
        
        vm.stopPrank();
    }
}