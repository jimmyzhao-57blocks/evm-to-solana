# Solana Token Staking

A Token Staking program implementation using Anchor framework. Users can stake tokens to earn rewards based on staking duration.

## Prerequisites

### Required Versions
- **Rust**: 1.81.0
- **Solana CLI**: 2.1.0
- **Anchor**: 0.31.1
- **Node.js**: 20.19.0
- **Solana build-sbf**: 2.1.0

You can check your installed versions:
```bash
npm run show-versions
# or
bash show-versions.sh
```

## Features

- Stake tokens to earn rewards
- Flexible unstaking (partial or full) 
- Claim rewards separately
- Configurable reward rate
- PDA-based account management

## Architecture

### Accounts
- **GlobalState**: Stores program configuration and admin settings
- **UserStakeInfo** (PDA): Individual user's staking information  
- **Staking Vault** (PDA): Holds all staked tokens
- **Reward Vault** (PDA): Holds reward tokens for distribution

### Instructions
- `initialize`: Set up the program with vaults and configuration
- `stake`: Stake tokens into the vault
- `unstake`: Withdraw staked tokens and claim rewards
- `claim_rewards`: Claim accumulated rewards only

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Build the program:
```bash
anchor build
```

3. Run tests:
```bash
anchor test
```

## Deployment

Deploy to Devnet:
```bash
anchor deploy --provider.cluster devnet
```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Verification and Testing

After deployment, you can verify your contract functionality using the provided scripts:

### List All Deployments
```bash
npm run list
```
Shows all deployed instances with their token addresses and current state.

### Verify Contract Functionality
```bash
# Use existing deployment (default)
npm run verify

# Create new tokens and deployment
npm run verify -- --new-tokens

# Use specific staking token
npm run verify -- --staking-token <TOKEN_ADDRESS>

# Enable verbose logging
npm run verify -- --verbose
```

The verification script will:
1. Check for existing deployments or create new ones
2. Create/reuse test tokens
3. Test all contract methods:
   - Initialize (if new deployment)
   - Stake tokens
   - Claim rewards
   - Unstake tokens (partial)
   - Blacklist operations (admin only)
4. Display final balances and state

### Script Options
- `--new-tokens`: Forces creation of new tokens instead of reusing existing ones
- `--staking-token <ADDRESS>`: Use a specific staking token deployment
- `--verbose`: Show detailed debug information

### Best Practices
1. Run `npm run list` after first deployment to save token addresses
2. Use `--new-tokens` sparingly to avoid creating unnecessary tokens
3. The script handles existing accounts gracefully and can be run multiple times

## Key Differences from EVM

- **Account Model**: Data stored in separate accounts, not within the program
- **Explicit Accounts**: All accounts must be passed explicitly in Context
- **PDAs**: Program-controlled accounts for vaults
- **CPI**: Cross-program invocation for SPL Token transfers
- **Rent**: Accounts require rent-exempt balance