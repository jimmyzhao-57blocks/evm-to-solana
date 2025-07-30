# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-blockchain token staking implementation demonstrating the migration from EVM to Solana. The project contains two parallel implementations of the same business logic on different blockchain platforms.

## Architecture

### EVM Staking (`evm-staking/`)

**Core Contracts:**
- `Staking.sol`: Main staking logic with ReentrancyGuard protection
- `RestrictedStakingToken.sol`: ERC20 token with blacklist functionality  
- `RewardToken.sol`: ERC20 reward token
- `MyToken.sol`: Basic ERC20 token for testing

**Key Design Patterns:**
- Uses OpenZeppelin contracts for security (ReentrancyGuard, Ownable)
- Reward calculation based on time-weighted staking (1% per day default)
- Blacklist checks integrated directly in staking operations
- Single contract holds all staking state and logic

### Solana Staking (`solana-staking/`)

**Program Structure:**
- `lib.rs`: Entry point with instruction handlers
- `state.rs`: Account structures (GlobalState, UserStakeInfo)
- `instructions/`: Modular instruction implementations
- `errors.rs`: Custom error definitions
- `events.rs`: Event definitions for indexing

**Key Design Patterns:**
- PDA-based account derivation for deterministic addresses
- Separate accounts for state vs vaults (Account Model)
- CPI (Cross-Program Invocation) for SPL Token transfers
- Explicit account passing in Context structs

## Commands

### EVM Development

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run all tests
forge test

# Run specific test
forge test --match-test testStakeTokens -vvv

# Run with gas report
forge test --gas-report

# Deploy to Sepolia
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify

# Format code
forge fmt
```

### Solana Development

```bash
# Install dependencies
yarn install

# Build program
anchor build

# Run all tests
anchor test

# Run specific test file
npm test -- tests/solana-staking-litesvm.test.ts

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Generate client SDK
npm run regenerate-client

# Lint/format
npm run lint:fix

# Show versions
npm run show-versions
```

## Key Differences to Remember

1. **State Storage**: EVM uses contract storage variables; Solana uses separate account structures
2. **Token Transfers**: EVM uses direct ERC20 calls; Solana requires CPI to SPL Token program
3. **Account Creation**: Solana accounts need rent-exempt balance and explicit initialization
4. **PDAs**: Solana uses Program Derived Addresses for deterministic, program-controlled accounts
5. **Testing**: EVM uses Foundry's forge test; Solana uses Anchor test with TypeScript

## Testing Approach

- EVM: Tests in `test/` directory, use `vm.prank()` for impersonation
- Solana: Tests use LiteSVM for fast local testing, located in `tests/`
- Both implementations test the same core scenarios: stake, unstake, claim rewards

## Environment Setup

### EVM
Requires `.env` file with:
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`

### Solana
- Default wallet: `~/.config/solana/id.json`
- Cluster config in `Anchor.toml`
- Program ID: `4XKoqimJG7svD8vnTb5N2h24rFSsA57LnBckBhxJ2q8M`