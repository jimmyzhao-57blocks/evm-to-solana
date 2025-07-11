# Solana Token Staking

A Token Staking program implementation using Anchor framework. Users can stake tokens to earn rewards based on staking duration.

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

## Key Differences from EVM

- **Account Model**: Data stored in separate accounts, not within the program
- **Explicit Accounts**: All accounts must be passed explicitly in Context
- **PDAs**: Program-controlled accounts for vaults
- **CPI**: Cross-program invocation for SPL Token transfers
- **Rent**: Accounts require rent-exempt balance