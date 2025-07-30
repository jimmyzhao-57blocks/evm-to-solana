import { assert, expect } from "chai";
import { LiteSVM, Clock } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createInitializeMint2Instruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToCheckedInstruction,
  getMintLen,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as programClient from "../dist/js-client";
import { decodeGlobalState, decodeUserStakeInfo, decodeBlacklistEntry } from "../dist/js-client";
import * as fs from "fs";
import {
  type KeyPairSigner,
  createKeyPairSignerFromBytes,
  address,
  lamports,
} from "@solana/kit";

// Constants
const SECONDS_IN_A_DAY = 86400;
const toToken = (amount: number): bigint => BigInt(amount) * BigInt(10 ** 9);

// Helper function to convert instruction
function toTransactionInstruction(instruction: any): TransactionInstruction {
  return new TransactionInstruction({
    keys: instruction.accounts.map((acc: any) => {
      if ("pubkey" in acc) {
        return {
          pubkey: new PublicKey(acc.pubkey),
          isSigner: acc.isSigner,
          isWritable: acc.isWritable,
        };
      } else {
        const pubkey = new PublicKey(acc.address);
        const isSigner = acc.role === 2 || acc.role === 3;
        const isWritable = acc.role === 1 || acc.role === 2;
        return { pubkey, isSigner, isWritable };
      }
    }),
    programId: new PublicKey(instruction.programAddress),
    data: Buffer.from(instruction.data, "base64"),
  });
}

describe("Solana Staking - Blacklist Functionality", () => {
  let litesvm: LiteSVM;
  let provider: LiteSVMProvider;
  let signer: KeyPairSigner;
  let blacklistedUser: KeyPairSigner;
  let regularUser: KeyPairSigner;
  let stakingMint: Keypair;
  let rewardMint: Keypair;

  const REWARD_RATE = 100; // 1%

  before(async () => {
    const secretKeyBytes = Uint8Array.from(
      JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET!, "utf-8"))
    );
    signer = await createKeyPairSignerFromBytes(
      secretKeyBytes,
      true
    );

    litesvm = new LiteSVM({
      accountsCluster: "http://127.0.0.1:8899",
      log: false,
    });
    provider = new LiteSVMProvider(litesvm, {
      keypair: Keypair.fromSecretKey(signer.secretKey),
      commitment: "finalized",
    });

    // Create test users
    blacklistedUser = await createKeyPairSignerFromBytes(Keypair.generate().secretKey, true);
    regularUser = await createKeyPairSignerFromBytes(Keypair.generate().secretKey, true);

    // Airdrop SOL to test users
    await litesvm.airdrop(address(blacklistedUser), BigInt(10 * LAMPORTS_PER_SOL));
    await litesvm.airdrop(address(regularUser), BigInt(10 * LAMPORTS_PER_SOL));

    // Create mints
    stakingMint = Keypair.generate();
    rewardMint = Keypair.generate();

    const createStakingMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: provider.publicKey,
        newAccountPubkey: stakingMint.publicKey,
        space: getMintLen([]),
        lamports: Number(await provider.connection.getMinimumBalanceForRentExemption(getMintLen([]))),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        stakingMint.publicKey,
        9,
        provider.publicKey,
        provider.publicKey,
        TOKEN_PROGRAM_ID
      )
    );

    const createRewardMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: provider.publicKey,
        newAccountPubkey: rewardMint.publicKey,
        space: getMintLen([]),
        lamports: Number(await provider.connection.getMinimumBalanceForRentExemption(getMintLen([]))),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        rewardMint.publicKey,
        9,
        provider.publicKey,
        provider.publicKey,
        TOKEN_PROGRAM_ID
      )
    );

    await provider.sendAndConfirm(createStakingMintTx, [stakingMint]);
    await provider.sendAndConfirm(createRewardMintTx, [rewardMint]);

    // Initialize staking program with blacklist admin
    const initializeInstruction = programClient.getInitializeInstruction({
      admin: address(signer),
      stakingMint: stakingMint.publicKey,
      rewardMint: rewardMint.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rewardRate: REWARD_RATE,
    });

    const initTx = new Transaction().add(toTransactionInstruction(initializeInstruction));
    await provider.sendAndConfirm(initTx, []);

    // Setup token accounts and mint tokens for test users
    await setupUserTokens(blacklistedUser);
    await setupUserTokens(regularUser);
  });

  async function setupUserTokens(user: KeyPairSigner) {
    const userStakingAta = getAssociatedTokenAddressSync(
      stakingMint.publicKey,
      new PublicKey(address(user))
    );

    const userRewardAta = getAssociatedTokenAddressSync(
      rewardMint.publicKey,
      new PublicKey(address(user))
    );

    const createAtaTx = new Transaction()
      .add(
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          userStakingAta,
          new PublicKey(address(user)),
          stakingMint.publicKey
        )
      )
      .add(
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          userRewardAta,
          new PublicKey(address(user)),
          rewardMint.publicKey
        )
      );

    await provider.sendAndConfirm(createAtaTx, []);

    // Mint staking tokens to user
    const mintTx = new Transaction().add(
      createMintToCheckedInstruction(
        stakingMint.publicKey,
        userStakingAta,
        provider.publicKey,
        toToken(1000),
        9
      )
    );

    await provider.sendAndConfirm(mintTx, []);
  }

  it("should add user to blacklist", async () => {
    const addToBlacklistInstruction = programClient.getAddToBlacklistInstruction({
      admin: address(signer),
      systemProgram: SystemProgram.programId,
      address: address(blacklistedUser),
    });

    const tx = new Transaction().add(toTransactionInstruction(addToBlacklistInstruction));
    await provider.sendAndConfirm(tx, []);

    // Verify blacklist entry
    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), new PublicKey(address(blacklistedUser)).toBuffer()],
      programClient.PROGRAM_ID
    );

    const blacklistAccount = await provider.connection.getAccountInfo(blacklistPda);
    assert.isNotNull(blacklistAccount);

    const blacklistEntry = decodeBlacklistEntry(blacklistAccount!.data);
    assert.equal(blacklistEntry.address.toString(), address(blacklistedUser));
  });

  it("should fail when adding same address to blacklist twice", async () => {
    const addToBlacklistInstruction = programClient.getAddToBlacklistInstruction({
      admin: address(signer),
      systemProgram: SystemProgram.programId,
      address: address(blacklistedUser),
    });

    const tx = new Transaction().add(toTransactionInstruction(addToBlacklistInstruction));
    
    try {
      await provider.sendAndConfirm(tx, []);
      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.include(error.message, "AddressAlreadyBlacklisted");
    }
  });

  it("should prevent blacklisted user from staking", async () => {
    const stakeAmount = toToken(100);

    const stakeInstruction = programClient.getStakeInstruction({
      user: address(blacklistedUser),
      amount: stakeAmount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    const tx = new Transaction().add(toTransactionInstruction(stakeInstruction));

    try {
      await litesvm.sendWithSigner(tx, blacklistedUser);
      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.include(error.message, "AddressBlacklisted");
    }
  });

  it("should allow regular user to stake", async () => {
    const stakeAmount = toToken(100);

    const stakeInstruction = programClient.getStakeInstruction({
      user: address(regularUser),
      amount: stakeAmount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    const tx = new Transaction().add(toTransactionInstruction(stakeInstruction));
    await litesvm.sendWithSigner(tx, regularUser);

    // Verify stake was successful
    const [userStakePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), new PublicKey(address(regularUser)).toBuffer()],
      programClient.PROGRAM_ID
    );

    const userStakeAccount = await provider.connection.getAccountInfo(userStakePda);
    assert.isNotNull(userStakeAccount);

    const userStakeInfo = decodeUserStakeInfo(userStakeAccount!.data);
    assert.equal(userStakeInfo.amount.toString(), stakeAmount.toString());
  });

  it("should prevent blacklisted user from unstaking", async () => {
    // First, remove from blacklist temporarily to allow staking
    const removeFromBlacklistInstruction = programClient.getRemoveFromBlacklistInstruction({
      admin: address(signer),
      address: address(blacklistedUser),
    });

    let tx = new Transaction().add(toTransactionInstruction(removeFromBlacklistInstruction));
    await provider.sendAndConfirm(tx, []);

    // Stake some tokens
    const stakeAmount = toToken(50);
    const stakeInstruction = programClient.getStakeInstruction({
      user: address(blacklistedUser),
      amount: stakeAmount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    tx = new Transaction().add(toTransactionInstruction(stakeInstruction));
    await litesvm.sendWithSigner(tx, blacklistedUser);

    // Add back to blacklist
    const addToBlacklistInstruction = programClient.getAddToBlacklistInstruction({
      admin: address(signer),
      systemProgram: SystemProgram.programId,
      address: address(blacklistedUser),
    });

    tx = new Transaction().add(toTransactionInstruction(addToBlacklistInstruction));
    await provider.sendAndConfirm(tx, []);

    // Try to unstake
    const unstakeInstruction = programClient.getUnstakeInstruction({
      user: address(blacklistedUser),
      amount: stakeAmount,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    tx = new Transaction().add(toTransactionInstruction(unstakeInstruction));

    try {
      await litesvm.sendWithSigner(tx, blacklistedUser);
      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.include(error.message, "AddressBlacklisted");
    }
  });

  it("should prevent blacklisted user from claiming rewards", async () => {
    const claimRewardsInstruction = programClient.getClaimRewardsInstruction({
      user: address(blacklistedUser),
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    const tx = new Transaction().add(toTransactionInstruction(claimRewardsInstruction));

    try {
      await litesvm.sendWithSigner(tx, blacklistedUser);
      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.include(error.message, "AddressBlacklisted");
    }
  });

  it("should remove user from blacklist", async () => {
    const removeFromBlacklistInstruction = programClient.getRemoveFromBlacklistInstruction({
      admin: address(signer),
      address: address(blacklistedUser),
    });

    const tx = new Transaction().add(toTransactionInstruction(removeFromBlacklistInstruction));
    await provider.sendAndConfirm(tx, []);

    // Verify blacklist entry is removed
    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), new PublicKey(address(blacklistedUser)).toBuffer()],
      programClient.PROGRAM_ID
    );

    const blacklistAccount = await provider.connection.getAccountInfo(blacklistPda);
    assert.isNull(blacklistAccount);

    // Now user should be able to unstake
    const unstakeInstruction = programClient.getUnstakeInstruction({
      user: address(blacklistedUser),
      amount: toToken(25),
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    const unstakeTx = new Transaction().add(toTransactionInstruction(unstakeInstruction));
    await litesvm.sendWithSigner(unstakeTx, blacklistedUser);
  });

  it("should prevent non-admin from managing blacklist", async () => {
    const randomUser = await createKeyPairSignerFromBytes(Keypair.generate().secretKey, true);
    await litesvm.airdrop(address(randomUser), BigInt(5 * LAMPORTS_PER_SOL));

    const addToBlacklistInstruction = programClient.getAddToBlacklistInstruction({
      admin: address(randomUser),
      systemProgram: SystemProgram.programId,
      address: address(regularUser),
    });

    const tx = new Transaction().add(toTransactionInstruction(addToBlacklistInstruction));

    try {
      await litesvm.sendWithSigner(tx, randomUser);
      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.include(error.message, "has_one");
    }
  });
});