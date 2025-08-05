// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RestrictedStakingToken.sol";
import "../src/RewardToken.sol";
import "../src/Staking.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy tokens
        RestrictedStakingToken stakingToken = new RestrictedStakingToken("Restricted Staking Token", "RST");
        console.log("RestrictedStakingToken deployed at:", address(stakingToken));
        
        RewardToken rewardToken = new RewardToken();
        console.log("RewardToken deployed at:", address(rewardToken));
        
        // Deploy staking contract
        Staking staking = new Staking(address(stakingToken), address(rewardToken));
        console.log("Staking contract deployed at:", address(staking));
        
        // Mint initial staking tokens to deployer (optional - for testing)
        uint256 stakingSupply = 1000000 * 10**18; // 1M tokens
        stakingToken.mint(msg.sender, stakingSupply);
        console.log("Minted", stakingSupply / 10**18, "staking tokens to deployer");
        
        // Transfer initial reward tokens to staking contract
        uint256 rewardSupply = 500000 * 10**18; // 500k tokens for rewards
        rewardToken.transfer(address(staking), rewardSupply);
        console.log("Transferred", rewardSupply / 10**18, "reward tokens to staking contract");
        
        // Set reward rate (optional - default is 1% per day)
        staking.setRewardRate(100); // 1% per day
        console.log("Reward rate set to 1% per day");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("RestrictedStakingToken:", address(stakingToken));
        console.log("RewardToken:", address(rewardToken));
        console.log("Staking:", address(staking));
        console.log("========================\n");
    }
}