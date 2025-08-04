import { expect } from "chai";
import { LiteSVM, Clock } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import { type KeyPairSigner, address } from "@solana/kit";
import * as programClient from "../dist/js-client";
import {
  createTestUser,
  setupUserWithTokens,
  sendTransaction,
  getGlobalState,
  getUserStakeInfo,
  getUserStakePda,
  getBlacklistPda,
  createMint,
  mintTo,
  getAccount,
  programId,
  toToken,
  getBlacklistEntry,
} from "./helper";

const SECONDS_IN_A_DAY = 86400;

describe("solana-staking", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let admin: Keypair;
  let adminSigner: KeyPairSigner;
  let stakingMint: PublicKey;
  let rewardMint: PublicKey;

  // PDAs
  let statePda: PublicKey;
  let stakingVaultPda: PublicKey;
  let rewardVaultPda: PublicKey;

  // Helper functions that can access outer scope variables
  async function stakeTokens(
    user: Keypair,
    userSigner: any,
    stakingToken: PublicKey,
    rewardToken: PublicKey,
    amount: bigint,
    blacklistEntry: PublicKey | null = null
  ) {
    const userStakePda = getUserStakePda(statePda, user.publicKey);
    // Always use the user's blacklist PDA, whether it exists or not
    const userBlacklistPda = getBlacklistPda(statePda, user.publicKey);
    const stakeInstruction = programClient.getStakeInstruction({
      user: userSigner,
      state: address(statePda.toBase58()),
      userStakeInfo: address(userStakePda.toBase58()),
      userTokenAccount: address(stakingToken.toBase58()),
      stakingVault: address(stakingVaultPda.toBase58()),
      rewardVault: address(rewardVaultPda.toBase58()),
      userRewardAccount: address(rewardToken.toBase58()),
      tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
      blacklistEntry: address(userBlacklistPda.toBase58()),
      amount: amount,
    });
    return await sendTransaction(provider, stakeInstruction, user);
  }

  async function unstakeTokens(
    user: Keypair,
    userSigner: any,
    stakingToken: PublicKey,
    rewardToken: PublicKey,
    amount: bigint,
    blacklistEntry: PublicKey | null = null
  ) {
    const userStakePda = getUserStakePda(statePda, user.publicKey);
    // Always use the user's blacklist PDA, whether it exists or not
    const userBlacklistPda = getBlacklistPda(statePda, user.publicKey);
    const unstakeInstruction = programClient.getUnstakeInstruction({
      user: userSigner,
      state: address(statePda.toBase58()),
      userStakeInfo: address(userStakePda.toBase58()),
      userTokenAccount: address(stakingToken.toBase58()),
      stakingVault: address(stakingVaultPda.toBase58()),
      rewardVault: address(rewardVaultPda.toBase58()),
      userRewardAccount: address(rewardToken.toBase58()),
      tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
      blacklistEntry: address(userBlacklistPda.toBase58()),
      amount: amount,
    });
    return await sendTransaction(provider, unstakeInstruction, user);
  }

  async function claimUserRewards(
    user: Keypair,
    userSigner: any,
    rewardToken: PublicKey,
    blacklistEntry: PublicKey | null = null
  ) {
    const userStakePda = getUserStakePda(statePda, user.publicKey);
    // Always use the user's blacklist PDA, whether it exists or not
    const userBlacklistPda = getBlacklistPda(statePda, user.publicKey);
    const claimInstruction = programClient.getClaimRewardsInstruction({
      user: userSigner,
      state: address(statePda.toBase58()),
      userStakeInfo: address(userStakePda.toBase58()),
      userRewardAccount: address(rewardToken.toBase58()),
      rewardVault: address(rewardVaultPda.toBase58()),
      tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
      blacklistEntry: address(userBlacklistPda.toBase58()),
    });
    return await sendTransaction(provider, claimInstruction, user);
  }

  async function addUserToBlacklist(userToBlacklist: PublicKey) {
    const blacklistPda = getBlacklistPda(statePda, userToBlacklist);
    const addToBlacklistInstruction =
      programClient.getAddToBlacklistInstruction({
        admin: adminSigner,
        systemProgram: address(SystemProgram.programId.toBase58()),
        state: address(statePda.toBase58()),
        blacklistEntry: address(blacklistPda.toBase58()),
        address: address(userToBlacklist.toBase58()),
      });
    return await sendTransaction(provider, addToBlacklistInstruction, admin);
  }

  async function removeUserFromBlacklist(userToRemove: PublicKey) {
    const blacklistPda = getBlacklistPda(statePda, userToRemove);
    const removeFromBlacklistInstruction =
      programClient.getRemoveFromBlacklistInstruction({
        admin: adminSigner,
        state: address(statePda.toBase58()),
        blacklistEntry: address(blacklistPda.toBase58()),
        address: address(userToRemove.toBase58()),
      });
    return await sendTransaction(
      provider,
      removeFromBlacklistInstruction,
      admin
    );
  }

  function setNextBlockTimestamp(timestamp: number): void {
    const clock = provider.client.getClock();
    provider.client.setClock(
      new Clock(
        clock.slot,
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        BigInt(timestamp)
      )
    );
  }

  before(async () => {
    // Initialize LiteSVM with transaction history disabled
    svm = new LiteSVM().withTransactionHistory(0n);

    const adminData = await createTestUser(svm);
    admin = adminData.user;
    adminSigner = adminData.userSigner;

    // Initialize provider after airdrop
    provider = new LiteSVMProvider(svm);
    // Set the default payer for transactions
    (provider.wallet as any).payer = admin;

    // Set clock to current time
    setNextBlockTimestamp(Math.floor(Date.now() / 1000));

    // Load and deploy the staking program
    const programBinary = fs.readFileSync("./target/deploy/solana_staking.so");
    svm.addProgram(programId, programBinary);
    console.log("Staking program deployed to LiteSVM");

    // Create mints
    stakingMint = createMint(provider, admin, admin.publicKey, null, 9);
    rewardMint = createMint(provider, admin, admin.publicKey, null, 9);

    // Derive PDAs
    [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), stakingMint.toBuffer()],
      programId
    );

    [stakingVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_vault"), statePda.toBuffer()],
      programId
    );

    [rewardVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), statePda.toBuffer()],
      programId
    );
  });

  describe("Initialize", () => {
    it("should fail with invalid reward rate", async () => {
      // Test with reward rate > 1000
      try {
        const initializeInstruction = programClient.getInitializeInstruction({
          admin: adminSigner,
          state: address(statePda.toBase58()),
          stakingMint: address(stakingMint.toBase58()),
          rewardMint: address(rewardMint.toBase58()),
          stakingVault: address(stakingVaultPda.toBase58()),
          rewardVault: address(rewardVaultPda.toBase58()),
          tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
          rewardRate: 1001, // Invalid: > 1000
        });

        await sendTransaction(provider, initializeInstruction, admin);
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("InvalidRewardRate");
      }

      // Test with reward rate = 0
      try {
        const initializeInstruction = programClient.getInitializeInstruction({
          admin: adminSigner,
          state: address(statePda.toBase58()),
          stakingMint: address(stakingMint.toBase58()),
          rewardMint: address(rewardMint.toBase58()),
          stakingVault: address(stakingVaultPda.toBase58()),
          rewardVault: address(rewardVaultPda.toBase58()),
          tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
          rewardRate: 0, // Invalid: = 0
        });

        await sendTransaction(provider, initializeInstruction, admin);
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("InvalidRewardRate");
      }
    });

    it("should initialize the staking program", async () => {
      // Create initialize instruction
      const initializeInstruction = programClient.getInitializeInstruction({
        admin: adminSigner,
        state: address(statePda.toBase58()),
        stakingMint: address(stakingMint.toBase58()),
        rewardMint: address(rewardMint.toBase58()),
        stakingVault: address(stakingVaultPda.toBase58()),
        rewardVault: address(rewardVaultPda.toBase58()),
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
        rewardRate: 500, // 5% daily rate
      });

      // Create and send transaction
      const txHash = await sendTransaction(
        provider,
        initializeInstruction,
        admin
      );
      console.log("Initialize transaction:", txHash);

      // Verify initialization
      const stateAccount = provider.client.getAccount(statePda);
      expect(stateAccount).to.not.be.null;

      // Verify vaults are created
      const stakingVaultAccount = provider.client.getAccount(stakingVaultPda);
      const rewardVaultAccount = provider.client.getAccount(rewardVaultPda);
      expect(stakingVaultAccount).to.not.be.null;
      expect(rewardVaultAccount).to.not.be.null;

      // Verify global state data
      const globalState = getGlobalState(provider, statePda);
      expect(globalState).to.not.be.null;
      expect(globalState!.admin.toString()).to.equal(
        admin.publicKey.toBase58()
      );
      expect(globalState!.stakingMint.toString()).to.equal(
        stakingMint.toBase58()
      );
      expect(globalState!.rewardMint.toString()).to.equal(
        rewardMint.toBase58()
      );
      expect(globalState!.stakingVault.toString()).to.equal(
        stakingVaultPda.toBase58()
      );
      expect(globalState!.rewardVault.toString(), rewardVaultPda.toBase58());
      expect(Number(globalState!.rewardRate.toString())).to.equal(500);
      expect(globalState!.totalStaked.toString()).to.equal("0");

      mintTo(
        provider,
        admin, // payer
        rewardMint,
        rewardVaultPda,
        admin, // mint authority
        toToken(5000) // 5000 tokens for rewards
      );
      const rewardVaultBalance = getAccount(provider, rewardVaultPda);
      expect(Number(rewardVaultBalance.amount)).to.equal(Number(toToken(5000)));
    });
  });

  describe("Stake", () => {
    it("should allow user to stake tokens", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );
      const stakeAmount = toToken(100);
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        stakeAmount
      );

      // Verify stake
      const stakingVaultAccount = getAccount(provider, stakingVaultPda);
      expect(Number(stakingVaultAccount.amount)).to.equal(Number(stakeAmount));

      // Verify user stake info data
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      const userStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(userStakeInfo).to.not.be.null;
      expect(userStakeInfo!.amount.toString()).to.equal(stakeAmount.toString());
      expect(userStakeInfo!.rewardDebt.toString()).to.equal("0");
      expect(Number(userStakeInfo!.stakeTimestamp.toString())).to.be.above(0);

      // Verify global state total staked was updated
      const globalState = getGlobalState(provider, statePda);
      expect(globalState!.totalStaked.toString()).to.equal(
        stakeAmount.toString()
      );
    });

    it("should fail when staking zero tokens", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );

      try {
        await stakeTokens(
          user,
          userSigner,
          stakingToken,
          rewardToken,
          BigInt(0) // Try to stake 0 tokens
        );
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("Cannot stake 0 tokens");
      }
    });

    it("should allow multiple stakes to accumulate", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );

      // First stake
      const firstStakeAmount = toToken(50);
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        firstStakeAmount
      );

      // Verify first stake
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      let userStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(userStakeInfo!.amount.toString()).to.equal(
        firstStakeAmount.toString()
      );

      // Second stake
      const secondStakeAmount = toToken(30);
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        secondStakeAmount
      );

      // Verify accumulated stake
      userStakeInfo = getUserStakeInfo(provider, userStakePda);
      let totalExpected = firstStakeAmount + secondStakeAmount;
      expect(userStakeInfo!.amount.toString()).to.equal(
        totalExpected.toString()
      );

      // Third stake
      const thirdStakeAmount = toToken(20);
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        thirdStakeAmount
      );

      // Verify final accumulated stake
      userStakeInfo = getUserStakeInfo(provider, userStakePda);
      totalExpected += thirdStakeAmount;
      expect(userStakeInfo!.amount.toString()).to.equal(
        totalExpected.toString()
      );
    });

    it("should prevent blacklisted user from staking", async () => {
      const { user: blacklistedUser, userSigner: blacklistedUserSigner } =
        await createTestUser(svm);
      const {
        stakingToken: blacklistedUserStakingToken,
        rewardToken: blacklistedUserRewardToken,
      } = await setupUserWithTokens(
        provider,
        admin,
        blacklistedUser,
        stakingMint,
        rewardMint
      );

      // First add to blacklist
      await addUserToBlacklist(blacklistedUser.publicKey);

      // Try to stake - this should fail
      const blacklistPda = getBlacklistPda(statePda, blacklistedUser.publicKey);
      try {
        await stakeTokens(
          blacklistedUser,
          blacklistedUserSigner,
          blacklistedUserStakingToken,
          blacklistedUserRewardToken,
          toToken(100),
          blacklistPda
        );
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("Address is blacklisted");
      }
    });
  });

  describe("Claim Rewards with Time Manipulation", () => {
    it("should calculate rewards correctly after time advancement", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );

      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        toToken(100)
      );

      // Get initial state
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      const stakeInfo = getUserStakeInfo(provider, userStakePda);
      const stakeTime = Number(stakeInfo!.stakeTimestamp.toString());
      console.log("Stake timestamp:", stakeTime);

      // Get initial reward balance
      const initialRewardAccount = getAccount(provider, rewardToken);
      const initialBalance = Number(initialRewardAccount.amount);
      console.log("Initial reward balance:", initialBalance);

      // Advance time by 5 days from stake time
      const fiveDaysLater = stakeTime + 5 * SECONDS_IN_A_DAY;
      setNextBlockTimestamp(fiveDaysLater);
      console.log(
        `Time advanced from ${stakeTime} to ${fiveDaysLater} (5 days)`
      );

      await claimUserRewards(user, userSigner, rewardToken);

      // Check rewards received
      const afterRewardAccount = getAccount(provider, rewardToken);
      const rewardsReceived =
        Number(afterRewardAccount.amount) - initialBalance;

      // Calculate expected rewards based on seconds
      // staked: 100 tokens, rate: 5% (500 basis points), time: 5 days = 432000 seconds
      // rewards = (100 * 500 * 432000) / (86400 * 10000) = 25 tokens
      const expectedRewards = Number(toToken(25));
      console.log(`Rewards received: ${rewardsReceived}`);
      console.log(`Expected rewards: ${expectedRewards}`);
      expect(rewardsReceived).to.equal(expectedRewards);

      // Verify lastClaimTime was updated
      const updatedStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(updatedStakeInfo!.lastClaimTime?.toString()).to.equal(
        fiveDaysLater.toString()
      );
    });

    it("should not reset staking duration when claiming", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );

      // Stake tokens
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        toToken(100)
      );

      // Get initial stake timestamp
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      const initialStakeInfo = getUserStakeInfo(provider, userStakePda);
      const originalStakeTimestamp =
        initialStakeInfo!.stakeTimestamp.toString();

      // Advance time by 2 days
      const currentTime = Number(initialStakeInfo!.stakeTimestamp.toString());
      const twoDaysLater = currentTime + 2 * SECONDS_IN_A_DAY;
      setNextBlockTimestamp(twoDaysLater);

      // Claim rewards
      await claimUserRewards(user, userSigner, rewardToken);

      // Verify stake timestamp hasn't changed
      const afterClaimStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(afterClaimStakeInfo!.stakeTimestamp.toString()).to.equal(
        originalStakeTimestamp
      );

      // Verify lastClaimTime was updated
      expect(afterClaimStakeInfo!.lastClaimTime?.toString()).to.equal(
        twoDaysLater.toString()
      );

      // Advance time by another 3 days and claim again
      const fiveDaysFromStart = currentTime + 5 * SECONDS_IN_A_DAY;
      setNextBlockTimestamp(fiveDaysFromStart);
      await claimUserRewards(user, userSigner, rewardToken);

      // Verify stake timestamp still hasn't changed
      const finalStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(finalStakeInfo!.stakeTimestamp.toString()).to.equal(
        originalStakeTimestamp
      );
      expect(finalStakeInfo!.lastClaimTime?.toString()).to.equal(
        fiveDaysFromStart.toString()
      );
    });

    it("should calculate rewards accurately for various time periods", async () => {
      // Test reward calculation precision with different time periods
      // For 100 tokens staked at 5% rate (500 basis points)
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        toToken(100)
      );
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      const testCases = [
        { hoursFromStart: 1, expectedLamports: 208_333_333 }, // ~0.208 tokens
        { hoursFromStart: 6, expectedLamports: 1_250_000_000 }, // 1.25 tokens
        { hoursFromStart: 18, expectedLamports: 3_750_000_000 }, // 3.75 tokens
        { hoursFromStart: 36, expectedLamports: 7_500_000_000 }, // 7.5 tokens
        { hoursFromStart: 60, expectedLamports: 12_500_000_000 }, // 12.5 tokens
      ];

      // Store the initial stake timestamp
      const initialStakeInfo = getUserStakeInfo(provider, userStakePda);
      const stakeTimestamp = Number(initialStakeInfo!.stakeTimestamp);
      let totalClaimedRewards = 0;

      for (const testCase of testCases) {
        // Get current state
        const beforeStakeInfo = getUserStakeInfo(provider, userStakePda);
        const lastClaim = Number(
          beforeStakeInfo!.lastClaimTime || beforeStakeInfo!.stakeTimestamp
        );
        console.log("lastClaim", lastClaim);
        const beforeBalance = getAccount(provider, rewardToken);
        const startBalance = Number(beforeBalance.amount);
        console.log("startBalance", startBalance);

        // Check reward vault balance
        const rewardVaultBalance = getAccount(provider, rewardVaultPda);
        console.log("rewardVaultBalance", Number(rewardVaultBalance.amount));

        // Advance time to X hours from initial stake
        const newTime = stakeTimestamp + testCase.hoursFromStart * 3600;
        setNextBlockTimestamp(newTime);
        console.log(
          `\nTesting ${testCase.hoursFromStart} hours from initial stake`
        );

        // Calculate expected rewards for this claim
        const expectedIncrementalRewards = Math.floor(
          (100_000_000_000 * 500 * (newTime - lastClaim)) / (86400 * 10000)
        );
        console.log(
          `Expected incremental rewards: ${expectedIncrementalRewards} lamports`
        );

        // Check if reward vault has enough balance
        const rewardVaultBeforeClaim = getAccount(provider, rewardVaultPda);
        console.log(
          `Reward vault before claim: ${rewardVaultBeforeClaim.amount} lamports`
        );
        console.log(
          `Has enough balance: ${Number(rewardVaultBeforeClaim.amount) >= expectedIncrementalRewards}`
        );

        // Claim rewards
        await claimUserRewards(user, userSigner, rewardToken);

        // Check rewards
        const afterBalance = getAccount(provider, rewardToken);
        console.log("afterBalance", afterBalance.amount);
        const incrementalRewards = Number(afterBalance.amount) - startBalance;
        totalClaimedRewards += incrementalRewards;
        console.log(`Incremental rewards: ${incrementalRewards} lamports`);
        console.log(`Total claimed rewards: ${totalClaimedRewards} lamports`);
        console.log(`Expected total: ${testCase.expectedLamports} lamports`);
        // Verify total rewards match expected
        expect(totalClaimedRewards).to.be.closeTo(testCase.expectedLamports, 1); // Allow 1 lamport difference
      }
    });

    it("should prevent blacklisted user from claiming rewards", async () => {
      const { user: blacklistedUser, userSigner: blacklistedUserSigner } =
        await createTestUser(svm);
      const {
        stakingToken: blacklistedUserStakingToken,
        rewardToken: blacklistedUserRewardToken,
      } = await setupUserWithTokens(
        provider,
        admin,
        blacklistedUser,
        stakingMint,
        rewardMint
      );

      // First, stake some tokens before blacklisting
      await stakeTokens(
        blacklistedUser,
        blacklistedUserSigner,
        blacklistedUserStakingToken,
        blacklistedUserRewardToken,
        toToken(50)
      );

      // Add to blacklist
      await addUserToBlacklist(blacklistedUser.publicKey);

      // Try to claim rewards
      const blacklistPda = getBlacklistPda(statePda, blacklistedUser.publicKey);
      try {
        await claimUserRewards(
          blacklistedUser,
          blacklistedUserSigner,
          blacklistedUserRewardToken,
          blacklistPda
        );
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("Address is blacklisted");
      }
    });
  });

  describe("Unstake", () => {
    it("should allow user to unstake tokens", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );

      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        toToken(100)
      );

      const globalStateBefore = getGlobalState(provider, statePda);
      console.log(
        "Global state total staked before:",
        globalStateBefore!.totalStaked
      );

      const unstakeAmount = toToken(40);
      await unstakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        unstakeAmount
      );

      // Verify user stake info data
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      const userStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(userStakeInfo).to.not.be.null;
      expect(userStakeInfo!.amount.toString()).to.equal(toToken(60).toString());
      expect(userStakeInfo!.rewardDebt.toString()).to.equal("0");
      expect(Number(userStakeInfo!.stakeTimestamp.toString())).to.be.above(0);

      // Verify global state total staked was updated
      const globalStateAfter = getGlobalState(provider, statePda);
      expect(globalStateAfter!.totalStaked).to.equal(
        globalStateBefore!.totalStaked - unstakeAmount
      );
    });

    it("should fail when unstaking more than staked amount", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );

      const stakeAmount = toToken(100);
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        stakeAmount
      );

      const tooMuchAmount = stakeAmount + toToken(100); // Try to unstake more than staked
      try {
        await unstakeTokens(
          user,
          userSigner,
          stakingToken,
          rewardToken,
          tooMuchAmount
        );
        expect.fail("Transaction should have failed");
      } catch (error: any) {
        // Expected to fail
        expect(error).to.not.be.null;
      }

      // Verify stake amount didn't change
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      const userStakeInfoAfter = getUserStakeInfo(provider, userStakePda);
      expect(userStakeInfoAfter!.amount.toString()).to.equal(
        stakeAmount.toString()
      );
    });

    it("should fail when unstaking zero tokens", async () => {
      const { user, userSigner } = await createTestUser(svm);
      const { stakingToken, rewardToken } = await setupUserWithTokens(
        provider,
        admin,
        user,
        stakingMint,
        rewardMint
      );

      // First stake some tokens
      await stakeTokens(
        user,
        userSigner,
        stakingToken,
        rewardToken,
        toToken(100)
      );

      // Try to unstake 0 tokens
      try {
        await unstakeTokens(
          user,
          userSigner,
          stakingToken,
          rewardToken,
          BigInt(0) // Try to unstake 0 tokens
        );
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("Cannot unstake 0 tokens");
      }

      // Verify stake amount didn't change
      const userStakePda = getUserStakePda(statePda, user.publicKey);
      const userStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(userStakeInfo!.amount.toString()).to.equal(
        toToken(100).toString()
      );
    });

    it("should prevent blacklisted user from unstaking", async () => {
      const { user: blacklistedUser, userSigner: blacklistedUserSigner } =
        await createTestUser(svm);
      const {
        stakingToken: blacklistedUserStakingToken,
        rewardToken: blacklistedUserRewardToken,
      } = await setupUserWithTokens(
        provider,
        admin,
        blacklistedUser,
        stakingMint,
        rewardMint
      );

      // First, stake some tokens before blacklisting
      await stakeTokens(
        blacklistedUser,
        blacklistedUserSigner,
        blacklistedUserStakingToken,
        blacklistedUserRewardToken,
        toToken(50)
      );

      // Add to blacklist
      const blacklistPda = getBlacklistPda(statePda, blacklistedUser.publicKey);

      const addToBlacklistInstruction =
        programClient.getAddToBlacklistInstruction({
          admin: adminSigner,
          systemProgram: address(SystemProgram.programId.toBase58()),
          state: address(statePda.toBase58()),
          blacklistEntry: address(blacklistPda.toBase58()),
          address: address(blacklistedUser.publicKey.toBase58()),
        });

      await sendTransaction(provider, addToBlacklistInstruction, admin);

      // Try to unstake
      try {
        await unstakeTokens(
          blacklistedUser,
          blacklistedUserSigner,
          blacklistedUserStakingToken,
          blacklistedUserRewardToken,
          toToken(50),
          blacklistPda
        );
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("Address is blacklisted");
      }
    });
  });

  describe("Blacklist", () => {
    it("should add user to blacklist", async () => {
      const { user: blacklistedUser } = await createTestUser(svm);

      await addUserToBlacklist(blacklistedUser.publicKey);

      const blacklistPda = getBlacklistPda(statePda, blacklistedUser.publicKey);
      const blacklistEntry = getBlacklistEntry(provider, blacklistPda);
      expect(blacklistEntry).to.not.be.null;
      expect(blacklistEntry!.address.toString()).to.equal(
        blacklistedUser.publicKey.toBase58()
      );
    });

    it("should fail when adding same address to blacklist twice", async () => {
      const { user: blacklistedUser } = await createTestUser(svm);

      // First add to blacklist
      await addUserToBlacklist(blacklistedUser.publicKey);

      // Try to add again
      try {
        await addUserToBlacklist(blacklistedUser.publicKey);
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
        expect(error.toString()).to.include("already in use");
      }
    });

    it("should remove user from blacklist", async () => {
      const { user: blacklistedUser, userSigner: blacklistedUserSigner } =
        await createTestUser(svm);
      const {
        stakingToken: blacklistedUserStakingToken,
        rewardToken: blacklistedUserRewardToken,
      } = await setupUserWithTokens(
        provider,
        admin,
        blacklistedUser,
        stakingMint,
        rewardMint
      );

      // First add to blacklist
      await addUserToBlacklist(blacklistedUser.publicKey);

      // Remove from blacklist
      await removeUserFromBlacklist(blacklistedUser.publicKey);

      // Verify blacklist entry is removed
      const blacklistPda = getBlacklistPda(statePda, blacklistedUser.publicKey);
      const blacklistAccount = provider.client.getAccount(blacklistPda);
      // In Solana, closed accounts may still exist with 0 lamports and system program as owner
      if (blacklistAccount) {
        expect(blacklistAccount.lamports).to.equal(0);
        expect(blacklistAccount.owner.toBase58()).to.equal(
          SystemProgram.programId.toBase58()
        );
        expect(blacklistAccount.data.length).to.equal(0);
      }

      // Now user should be able to stake
      await stakeTokens(
        blacklistedUser,
        blacklistedUserSigner,
        blacklistedUserStakingToken,
        blacklistedUserRewardToken,
        toToken(25)
      );

      // Verify stake was successful
      const userStakePda = getUserStakePda(statePda, blacklistedUser.publicKey);
      const userStakeInfo = getUserStakeInfo(provider, userStakePda);
      expect(userStakeInfo!.amount.toString()).to.equal(toToken(25).toString());
    });

    it("should prevent non-admin from managing blacklist", async () => {
      const { user: randomUser, userSigner: randomUserSigner } =
        await createTestUser(svm, 5);

      const { user: blacklistedUser } = await createTestUser(svm, 5);

      const blacklistPda = getBlacklistPda(statePda, blacklistedUser.publicKey);

      const addToBlacklistInstruction =
        programClient.getAddToBlacklistInstruction({
          admin: randomUserSigner,
          systemProgram: address(SystemProgram.programId.toBase58()),
          state: address(statePda.toBase58()),
          blacklistEntry: address(blacklistPda.toBase58()),
          address: address(blacklistedUser.publicKey.toBase58()),
        });

      try {
        await sendTransaction(provider, addToBlacklistInstruction, randomUser);
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).to.not.be.null;
      }
    });
  });
});
