import { assert } from "chai";
import * as programClient from "../dist/js-client";
import {
  getGlobalStateDecoder,
  getUserStakeInfoDecoder,
  GLOBAL_STATE_DISCRIMINATOR,
  USER_STAKE_INFO_DISCRIMINATOR,
} from "../dist/js-client";
import { type KeyPairSigner, type Address, MaybeAccount } from "@solana/kit";
import { connect, Connection } from "solana-kite";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
} from "@solana-program/token";
import {
  createDefaultSolanaClient,
  createMint,
  createToken,
  createTokenWithAmount,
} from "./_setup";

export const log = console.log;
export const stringify = (object: any) => {
  const bigIntReplacer = (key: string, value: any) =>
    typeof value === "bigint" ? value.toString() : value;
  return JSON.stringify(object, bigIntReplacer, 2);
};

describe("solana-staking", () => {
  let admin: KeyPairSigner;
  let user: KeyPairSigner;
  let connection: Connection;
  let getGlobalState: () => Promise<
    Array<MaybeAccount<programClient.GlobalState, string>>
  >;
  let getUserStakeInfo: () => Promise<
    Array<MaybeAccount<programClient.UserStakeInfo, string>>
  >;

  // Test accounts
  let stakingMint: Address;
  let rewardMint: Address;
  let adminStakingToken: Address;
  let userStakingToken: Address;
  let userRewardToken: Address;
  let adminRewardToken: Address;

  // PDAs
  let statePda: Address;
  let stakingVaultPda: Address;
  let rewardVaultPda: Address;
  let userStakeInfoPda: Address;

  before(async () => {
    connection = await connect();
    [admin, user] = await connection.createWallets(2);

    getGlobalState = connection.getAccountsFactory(
      programClient.SOLANA_STAKING_PROGRAM_ADDRESS,
      GLOBAL_STATE_DISCRIMINATOR,
      getGlobalStateDecoder()
    );
    getUserStakeInfo = connection.getAccountsFactory(
      programClient.SOLANA_STAKING_PROGRAM_ADDRESS,
      USER_STAKE_INFO_DISCRIMINATOR,
      getUserStakeInfoDecoder()
    );

    const client = createDefaultSolanaClient();
    // Create staking token mint
    [stakingMint, rewardMint] = await Promise.all([
      createMint(client, admin, admin.address, 9),
      createMint(client, admin, admin.address, 9),
    ]);

    [adminStakingToken, userStakingToken, adminRewardToken, userRewardToken] =
      await Promise.all([
        createTokenWithAmount(
          client,
          admin,
          admin,
          stakingMint,
          admin.address,
          1000n
        ),
        createTokenWithAmount(
          client,
          admin,
          admin,
          stakingMint,
          user.address,
          500n
        ),
        createTokenWithAmount(
          client,
          admin,
          admin,
          rewardMint,
          admin.address,
          1000n
        ),
        createToken(client, admin, rewardMint, user.address),
      ]);
    // Then we expect the mint and token accounts to have the following updated data.
    const [
      { data: stakingMintData },
      { data: userTokenData },
      { data: rewardMintData },
      { data: userRewardTokenData },
    ] = await Promise.all([
      fetchMint(client.rpc, stakingMint),
      fetchToken(client.rpc, userStakingToken),
      fetchMint(client.rpc, rewardMint),
      fetchToken(client.rpc, userRewardToken),
    ]);
    console.log("stakingMintData supply", stakingMintData.supply);
    console.log("userTokenData amount", userTokenData.amount);
    console.log("rewardMintData supply", rewardMintData.supply);
    console.log("userRewardTokenData amount", userRewardTokenData.amount);
    // Create an address for "state"
    const statePdaAndBump = await connection.getPDAAndBump(
      programClient.SOLANA_STAKING_PROGRAM_ADDRESS,
      ["state"]
    );
    statePda = statePdaAndBump.pda;
    // Create an address for "staking_vault"
    const stakingVaultPdaAndBump = await connection.getPDAAndBump(
      programClient.SOLANA_STAKING_PROGRAM_ADDRESS,
      ["staking_vault", statePda]
    );
    stakingVaultPda = stakingVaultPdaAndBump.pda;
    // Create an address for "reward_vault"
    const rewardVaultPdaAndBump = await connection.getPDAAndBump(
      programClient.SOLANA_STAKING_PROGRAM_ADDRESS,
      ["reward_vault", statePda]
    );
    rewardVaultPda = rewardVaultPdaAndBump.pda;

    // Create an address for "user stake"
    const userStakeInfoPdaAndBump = await connection.getPDAAndBump(
      programClient.SOLANA_STAKING_PROGRAM_ADDRESS,
      ["stake", user.address]
    );
    userStakeInfoPda = userStakeInfoPdaAndBump.pda;
  });

  describe("Initialize", () => {
    it("should initialize the staking program", async () => {
      const initializeInstruction =
        await programClient.getInitializeInstruction({
          admin,
          state: statePda,
          stakingMint: stakingMint,
          rewardMint: rewardMint,
          stakingVault: stakingVaultPda,
          rewardVault: rewardVaultPda,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
          rewardRate: 500,
        });
      const signature = await connection.sendTransactionFromInstructions({
        feePayer: admin,
        instructions: [initializeInstruction],
      });
      console.log("Transaction signature", signature);

      const globalState = await getGlobalState();
      // @ts-expect-error the 'data' property does actually exist.
      const firstGlobalState = globalState[0].data;

      assert.equal(firstGlobalState.admin.toString(), admin.address.toString());
      assert.equal(
        firstGlobalState.stakingMint.toString(),
        stakingMint.toString()
      );
      assert.equal(
        firstGlobalState.rewardMint.toString(),
        rewardMint.toString()
      );
      assert.equal(firstGlobalState.rewardRate, 500n);
      assert.equal(firstGlobalState.totalStaked, 0n);
    });

    it("should fail with invalid reward rate", async () => {
      // TODO: Test initialization with reward rate > 1000 or 0
    });
  });

  describe("Stake", () => {
    it("should allow user to stake tokens", async () => {
      const stakeAmount = 100n;
      const stakeInstruction = await programClient.getStakeInstruction({
        user: user,
        state: statePda,
        userStakeInfo: userStakeInfoPda,
        userTokenAccount: userStakingToken,
        stakingVault: stakingVaultPda,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        amount: stakeAmount,
      });
      const signature = await connection.sendTransactionFromInstructions({
        feePayer: user,
        instructions: [stakeInstruction],
      });
      console.log("Transaction signature", signature);

      // Verify user stake info
      const userStakeInfo = await getUserStakeInfo();
      // @ts-expect-error the 'data' property does actually exist.
      const firstUserStakeInfo = userStakeInfo[0].data;
      assert.equal(
        firstUserStakeInfo.owner.toString(),
        user.address.toString()
      );
      assert.equal(firstUserStakeInfo.amount, 100n);
      assert.equal(firstUserStakeInfo.rewardDebt, 0n);

      // Verify global state
      const globalState = await getGlobalState();
      // @ts-expect-error the 'data' property does actually exist.
      const firstGlobalState = globalState[0].data;
      assert.equal(firstGlobalState.totalStaked, stakeAmount);
    });

    it("should fail when staking zero tokens", async () => {
      // TODO: Test staking 0 tokens
    });

    it("should allow multiple stakes to accumulate", async () => {
      // TODO: Test multiple stakes from same user
    });
  });

  describe("Claim Rewards", () => {
    it("should calculate rewards correctly over time", async () => {
      const claimInstruction = await programClient.getClaimRewardsInstruction({
        user: user,
        state: statePda,
        userStakeInfo: userStakeInfoPda,
        userRewardAccount: userRewardToken,
        rewardVault: rewardVaultPda,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      const signature = await connection.sendTransactionFromInstructions({
        feePayer: user,
        instructions: [claimInstruction],
      });
      console.log("Transaction signature", signature);
      // Verify user stake info
      const userStakeInfo = await getUserStakeInfo();
      // @ts-expect-error the 'data' property does actually exist.
      const firstUserStakeInfo = userStakeInfo[0].data;
      assert.equal(firstUserStakeInfo.rewardDebt, 0n); // No rewards accumulated in such short time
    });

    it("should not reset staking duration when claiming", async () => {
      // TODO: Test that claiming doesn't reset the staking timestamp
    });

    it("should handle multiple claims in short intervals", async () => {
      // TODO: Test claiming every few hours over multiple days
    });
  });

  describe("Unstake", () => {
    it("should allow user to unstake tokens", async () => {
      let userStakeInfo = await getUserStakeInfo();
      // @ts-expect-error the 'data' property does actually exist.
      const firstUserStakeInfoBefore = userStakeInfo[0].data;

      let globalState = await getGlobalState();
      // @ts-expect-error the 'data' property does actually exist.
      const firstGlobalStateBefore = globalState[0].data;

      const unstakeAmount = 40n;
      const unstakeInstruction = await programClient.getUnstakeInstruction({
        user: user,
        state: statePda,
        userStakeInfo: userStakeInfoPda,
        userTokenAccount: userStakingToken,
        stakingVault: stakingVaultPda,
        rewardVault: rewardVaultPda,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        amount: unstakeAmount,
      });
      const signature = await connection.sendTransactionFromInstructions({
        feePayer: user,
        instructions: [unstakeInstruction],
      });
      console.log("Transaction signature", signature);

      // Verify user stake info
      userStakeInfo = await getUserStakeInfo();
      // @ts-expect-error the 'data' property does actually exist.
      const firstUserStakeInfoAfter = userStakeInfo[0].data;
      assert.equal(
        firstUserStakeInfoAfter.amount,
        firstUserStakeInfoBefore.amount - unstakeAmount
      );

      // Verify global state
      globalState = await getGlobalState();
      // @ts-expect-error the 'data' property does actually exist.
      const firstGlobalStateAfter = globalState[0].data;
      assert.equal(
        firstGlobalStateAfter.totalStaked,
        firstGlobalStateBefore.totalStaked - unstakeAmount
      );
    });

    it("should fail when unstaking more than staked amount", async () => {
      // TODO: Test unstaking more than user has staked
    });

    it("should fail when unstaking zero tokens", async () => {
      // TODO: Test unstaking 0 tokens
    });
  });
});
