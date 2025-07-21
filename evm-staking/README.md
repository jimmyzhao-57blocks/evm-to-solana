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

- `MyToken.sol`: The stakeable ERC20 token
- `RewardToken.sol`: The reward ERC20 token
- `Staking.sol`: Main staking logic contract

## Security Considerations

- ReentrancyGuard protection
- Owner-only functions for configuration
- Safe math operations (Solidity 0.8.20+)
