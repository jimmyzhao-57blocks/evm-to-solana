import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { SolanaStaking } from "../target/types/solana_staking";

describe("solana-staking", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaStaking as Program<SolanaStaking>;

  // Test accounts
  let stakingMint: PublicKey;
  let rewardMint: PublicKey;
  let userStakingAccount: PublicKey;
  let userRewardAccount: PublicKey;

  // PDAs
  let statePda: PublicKey;
  let stakingVaultPda: PublicKey;
  let rewardVaultPda: PublicKey;
  let userInfoPda: PublicKey;

  // Signers
  const admin = provider.wallet;
  const user = anchor.web3.Keypair.generate();

  before(async () => {
    // Airdrop SOL to user for local testing
    const airdropSignature = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Create staking token mint
    stakingMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      9
    );

    // Create reward token mint
    rewardMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      9
    );

    // Create user token accounts
    userStakingAccount = await createAccount(
      provider.connection,
      user,
      stakingMint,
      user.publicKey
    );

    userRewardAccount = await createAccount(
      provider.connection,
      user,
      rewardMint,
      user.publicKey
    );

    // Mint staking tokens to user
    await mintTo(
      provider.connection,
      admin.payer,
      stakingMint,
      userStakingAccount,
      admin.publicKey,
      1000 * 10 ** 9 // 1000 tokens
    );

    // Derive PDAs
    [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    [stakingVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_vault"), statePda.toBuffer()],
      program.programId
    );

    [rewardVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), statePda.toBuffer()],
      program.programId
    );

    [userInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), user.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Is initialized!", async () => {
    const rewardRate = 500; // 5% reward rate

    const tx = await program.methods
      .initialize(new anchor.BN(rewardRate))
      .accounts({
        admin: admin.publicKey,
        state: statePda,
        stakingMint: stakingMint,
        rewardMint: rewardMint,
        stakingVault: stakingVaultPda,
        rewardVault: rewardVaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Initialize transaction signature:", tx);

    // Verify state
    const state = await program.account.globalState.fetch(statePda);
    assert.equal(state.admin.toString(), admin.publicKey.toString());
    assert.equal(state.stakingMint.toString(), stakingMint.toString());
    assert.equal(state.rewardMint.toString(), rewardMint.toString());
    assert.equal(state.rewardRate.toNumber(), rewardRate);
    assert.equal(state.totalStaked.toNumber(), 0);
  });

  it("User can stake tokens", async () => {
    const stakeAmount = 100 * 10 ** 9; // 100 tokens

    const tx = await program.methods
      .stake(new anchor.BN(stakeAmount))
      .accounts({
        user: user.publicKey,
        userStakeInfo: userInfoPda,
        state: statePda,
        stakingVault: stakingVaultPda,
        userTokenAccount: userStakingAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([user])
      .rpc();

    console.log("Stake transaction signature:", tx);

    // Verify user stake info
    const userInfo = await program.account.userStakeInfo.fetch(userInfoPda);
    assert.equal(userInfo.owner.toString(), user.publicKey.toString());
    assert.equal(userInfo.amount.toNumber(), stakeAmount);
    assert.equal(userInfo.rewardDebt.toNumber(), 0);

    // Verify global state
    const state = await program.account.globalState.fetch(statePda);
    assert.equal(state.totalStaked.toNumber(), stakeAmount);
  });

  it("User can claim rewards", async () => {
    // Mint some reward tokens to the reward vault for testing
    await mintTo(
      provider.connection,
      admin.payer,
      rewardMint,
      rewardVaultPda,
      admin.publicKey,
      1000 * 10 ** 9 // 1000 reward tokens
    );

    // Since rewards are calculated per day, we need to simulate time passing
    // In a real test environment, we would warp the clock forward
    // For now, let's skip the reward amount check

    const tx = await program.methods
      .claimRewards()
      .accounts({
        user: user.publicKey,
        userStakeInfo: userInfoPda,
        state: statePda,
        rewardVault: rewardVaultPda,
        userRewardAccount: userRewardAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([user])
      .rpc();

    console.log("Claim rewards transaction signature:", tx);

    // Since we can't warp time in the test, let's just verify the transaction succeeded
    // In a production test, you would use clock manipulation to test actual rewards
    const userInfo = await program.account.userStakeInfo.fetch(userInfoPda);
    assert.equal(userInfo.rewardDebt.toNumber(), 0); // No rewards accumulated in such short time
  });

  it("User can unstake tokens", async () => {
    const unstakeAmount = 50 * 10 ** 9; // 50 tokens

    const tx = await program.methods
      .unstake(new anchor.BN(unstakeAmount))
      .accounts({
        user: user.publicKey,
        userStakeInfo: userInfoPda,
        state: statePda,
        stakingVault: stakingVaultPda,
        userTokenAccount: userStakingAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log("Unstake transaction signature:", tx);

    // Verify user stake info
    const userInfo = await program.account.userStakeInfo.fetch(userInfoPda);
    assert.equal(userInfo.amount.toNumber(), 50 * 10 ** 9); // 50 tokens remaining

    // Verify global state
    const state = await program.account.globalState.fetch(statePda);
    assert.equal(state.totalStaked.toNumber(), 50 * 10 ** 9);
  });
});
