// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MyToken.sol";
import "../src/RewardToken.sol";
import "../src/Staking.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy tokens
        MyToken myToken = new MyToken();
        console.log("MyToken deployed at:", address(myToken));
        
        RewardToken rewardToken = new RewardToken();
        console.log("RewardToken deployed at:", address(rewardToken));
        
        // Deploy staking contract
        Staking staking = new Staking(address(myToken), address(rewardToken));
        console.log("Staking contract deployed at:", address(staking));
        
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
        console.log("MyToken:", address(myToken));
        console.log("RewardToken:", address(rewardToken));
        console.log("Staking:", address(staking));
        console.log("========================\n");
    }
}