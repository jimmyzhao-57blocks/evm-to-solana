# Solana Staking Program Deployment Guide

This guide provides step-by-step instructions for deploying the Solana staking program to devnet and mainnet.

## Prerequisites

- Solana CLI installed and configured
- Anchor framework installed (v0.31.1+)
- Node.js and Yarn installed
- Sufficient SOL balance for deployment (at least 5 SOL recommended)

## Pre-deployment Setup

### 1. Configure Solana CLI

Set your target network:

```bash
# For devnet
solana config set --url https://api.devnet.solana.com

# For mainnet
solana config set --url https://api.mainnet-beta.solana.com
```

### 2. Verify Configuration

```bash
solana config get
```

Expected output should show:
- RPC URL matching your target network
- Valid keypair path
- Commitment level (recommended: confirmed)

### 3. Check Wallet Balance

```bash
solana balance
```

For devnet, airdrop SOL if needed:
```bash
solana airdrop 2
```

## Initial Deployment

### 1. Build the Program

```bash
cd solana-staking
anchor build
```

### 2. Get Program ID

After building, retrieve your program ID:

```bash
solana address -k target/deploy/solana_staking-keypair.json
```

### 3. Update Configuration

Update the program ID in `Anchor.toml` and `programs/solana-staking/src/lib.rs` if it differs from the generated one.

### 4. Deploy the Program

```bash
anchor deploy --provider.cluster devnet
```

For mainnet:
```bash
anchor deploy --provider.cluster mainnet
```

### 5. Upload IDL

The IDL (Interface Definition Language) file enables explorers and clients to understand your program's structure:

```bash
anchor idl init -f target/idl/solana_staking.json <PROGRAM_ID> --provider.cluster devnet
```

Replace `<PROGRAM_ID>` with your actual program ID from step 2.

## Program Upgrade Process

When updating an already deployed program:

### 1. Make Code Changes and Rebuild

```bash
anchor build
```

### 2. Upgrade the Program

```bash
anchor upgrade target/deploy/solana_staking.so --program-id <PROGRAM_ID> --provider.cluster devnet
```

### 3. Update IDL (if interface changed)

```bash
anchor idl upgrade -f target/idl/solana_staking.json <PROGRAM_ID> --provider.cluster devnet
```

## Post-deployment Verification

### 1. Verify Program Deployment

```bash
solana program show <PROGRAM_ID>
```

This should display:
- Program ID
- Authority (upgrade authority)
- Last deployment slot
- Data length

### 2. Verify IDL Upload

```bash
anchor idl fetch <PROGRAM_ID> --provider.cluster devnet
```

### 3. Check in Explorer

Visit Solana Explorer to verify your deployment:
- Devnet: https://explorer.solana.com/?cluster=devnet
- Mainnet: https://explorer.solana.com/

Search for your program ID. You should see:
- Program details
- IDL tab with your interface
- Recent transactions

## Important Considerations

### Data Migration

When upgrading programs with existing state:
- Account structures can only grow (add fields at the end)
- Never remove or reorder existing fields
- Test migrations thoroughly on devnet first

### Authority Management

The deploying wallet becomes the upgrade authority. To transfer authority:

```bash
solana program set-upgrade-authority <PROGRAM_ID> --new-upgrade-authority <NEW_AUTHORITY_ADDRESS>
```

To make a program immutable (remove upgrade authority):
```bash
solana program set-upgrade-authority <PROGRAM_ID> --final
```

### Program Size Limits

- Maximum program size: ~1.5MB
- If approaching limits, consider optimization or splitting functionality

## Troubleshooting

### Common Issues

1. **Insufficient SOL balance**
   - Solution: Airdrop more SOL or transfer from another wallet

2. **Program already exists**
   - Solution: Use `anchor upgrade` instead of `anchor deploy`

3. **IDL authority mismatch**
   - Solution: Ensure you're using the same wallet that deployed the program

4. **Transaction too large**
   - Solution: Increase priority fees or wait for less network congestion

### Getting Help

- Check deployment logs in `.anchor/program-logs/`
- Use `-v` flag for verbose output: `anchor deploy -v`
- Verify network status at https://status.solana.com/

## Deployment Checklist

- [ ] Solana CLI configured for correct network
- [ ] Sufficient SOL balance (5+ SOL recommended)
- [ ] Program builds successfully
- [ ] Anchor.toml has correct program ID
- [ ] lib.rs has matching program ID
- [ ] All tests pass locally
- [ ] Program deployed successfully
- [ ] IDL uploaded and visible in explorer
- [ ] Post-deployment verification complete
- [ ] Authority management decided (keep upgradeable or make immutable)

## Next Steps

After successful deployment:

1. Initialize the program (if required by your business logic)
2. Set up monitoring for program usage
3. Document the deployed program ID and share with your team
4. Consider setting up a CI/CD pipeline for future deployments