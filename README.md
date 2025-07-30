# EVM to Solana Migration Project

This is a token staking implementation showcasing the migration from EVM to Solana, demonstrating how to implement the same business logic on two different blockchain platforms.

## Project Structure

```
evm-to-solana/
├── evm-staking/      # EVM version of the staking contract
└── solana-staking/   # Solana version of the staking program
```

## Features

Both versions implement the following core functionality:
- Stake tokens to earn rewards
- Flexible unstaking (partial or full)
- Claim rewards separately
- Configurable reward rate
- Admin access control

## Tech Stack

### EVM Version
- Solidity 0.8.20+
- Foundry framework
- OpenZeppelin contracts library

### Solana Version
- Rust + Anchor framework
- SPL Token program
- PDA (Program Derived Address) account model

## Quick Start

For detailed setup and deployment instructions, please refer to the README files in each subdirectory:
- [EVM Staking Contract](./evm-staking/README.md)
- [Solana Staking Program](./solana-staking/README.md)

## Key Differences

| Feature | EVM | Solana |
|---------|-----|---------|
| Data Storage | Contract state variables | Separate accounts |
| Account Model | Account balance model | UTXO-like account model |
| Transaction Fees | Gas fees | Fixed fees + rent |
| Program Calls | Internal/external calls | CPI (Cross-Program Invocation) |