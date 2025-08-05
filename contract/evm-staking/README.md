# EVM Token Staking

A Token Staking contract implementation using Foundry framework. Users can stake MyToken to earn RewardToken based on staking duration.

## Features

- Stake MyToken to earn RewardToken
- Flexible unstaking (partial or full)
- Claim rewards separately
- Configurable reward rate

## Setup

1. Install dependencies:

```bash
forge install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Configure your `.env` file with:
   - `SEPOLIA_RPC_URL`: Your Sepolia RPC endpoint
   - `PRIVATE_KEY`: Your wallet private key
   - `ETHERSCAN_API_KEY`: For contract verification

## Testing

Run all tests:

```bash
forge test
```

Run with gas reporting:

```bash
forge test --gas-report
```

## Deployment

Deploy to Sepolia testnet:

```bash
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
```

## Contract Architecture

- `RestrictedStakingToken.sol`: The stakeable ERC20 token with blacklist functionality
- `RewardToken.sol`: The reward ERC20 token
- `Staking.sol`: Main staking logic contract

## Security Considerations

- ReentrancyGuard protection
- Owner-only functions for configuration
- Safe math operations (Solidity 0.8.20+)
- Blacklist mechanism for restricted addresses

## Manual Verification on Etherscan

After deployment, you can verify the contracts are working correctly through Etherscan's interface.

### Prerequisites

1. Have MetaMask or another Web3 wallet installed
2. Ensure you have enough Sepolia ETH for gas fees
3. Note down your deployed contract addresses

### Step-by-Step Verification Process

#### 1. Mint Staking Tokens

First, you need to get some RST (Restricted Staking Tokens):

1. Go to the RestrictedStakingToken contract on Etherscan
2. Navigate to "Contract" → "Write Contract"
3. Click "Connect to Web3" and connect your wallet
4. Find the `mint` function:
   - `to`: Your wallet address
   - `amount`: Amount with 18 decimals (e.g., `1000000000000000000000` for 1000 RST)
5. Write the transaction

**Note**: Only the contract owner can mint tokens.

#### 2. Approve Staking Contract

Before staking, you must approve the Staking contract to spend your tokens:

1. Stay on the RestrictedStakingToken contract page
2. Find the `approve` function:
   - `spender`: The Staking contract address (copy exactly with correct case)
   - `amount`: Amount to approve (e.g., `1000000000000000000000` for 1000 RST)
3. Write the transaction

**Tip**: You can approve a large amount like `115792089237316195423570985008687907853269984665640564039457584007913129639935` (max uint256) to avoid repeated approvals.

#### 3. Verify Approval

Before proceeding, verify your approval was successful:

1. Go to "Read Contract" on the RestrictedStakingToken
2. Find the `allowance` function:
   - `owner`: Your wallet address
   - `spender`: The Staking contract address
3. Query - it should show your approved amount

#### 4. Stake Tokens

Now you can stake your tokens:

1. Go to the Staking contract on Etherscan
2. Navigate to "Contract" → "Write Contract"
3. Connect your wallet
4. Find the `stake` function:
   - `amount`: Amount to stake (must be ≤ your approved amount)
5. Write the transaction

#### 5. Verify Staking

Check that your stake was successful:

1. Go to "Read Contract" on the Staking contract
2. Find the `stakes` function:
   - Enter your wallet address
3. Query - it should show your staked amount and timestamp

#### 6. Check Rewards

To see your pending rewards:

1. On the Staking contract "Read Contract"
2. Find the `calculateRewards` function:
   - Enter your wallet address
3. Query - it shows your accumulated rewards

#### 7. Claim Rewards

To claim your rewards:

1. Go to "Write Contract" on the Staking contract
2. Find the `claimRewards` function
3. Write the transaction (no parameters needed)

#### 8. Unstake Tokens

To unstake your tokens:

1. On the Staking contract "Write Contract"
2. Find the `unstake` function:
   - `amount`: Amount to unstake
3. Write the transaction

### Common Issues and Solutions

#### "ERC20: insufficient allowance"
- **Cause**: You haven't approved the Staking contract or the amount is too low
- **Solution**: Go back to step 2 and approve the correct amount

#### "Address is blacklisted"
- **Cause**: Your address has been added to the blacklist
- **Solution**: Contact the contract owner to remove you from the blacklist

#### "Cannot stake 0"
- **Cause**: Trying to stake 0 tokens
- **Solution**: Enter a valid amount greater than 0

#### Wrong Wallet Address
- **Cause**: You approved tokens on one address but trying to stake from another
- **Solution**: Ensure you're using the same wallet address for all operations

### Tips for Testing

1. **Start Small**: Test with small amounts first
2. **Check Gas Prices**: Sepolia gas can spike; wait for lower prices if needed
3. **Keep Records**: Note down transaction hashes for debugging
4. **Verify Each Step**: Don't skip the verification steps between operations

### Contract Addresses

After deployment, your contract addresses will be displayed. Example format:
```
RestrictedStakingToken: 0x...
RewardToken: 0x...
Staking: 0x...
```

Save these addresses for interacting with the contracts on Etherscan.
