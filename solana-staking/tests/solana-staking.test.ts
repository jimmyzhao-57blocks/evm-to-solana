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

    [adminStakingToken, userStakingToken, userRewardToken] = await Promise.all([
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
      createToken(client, admin, rewardMint, user.address),
    ]);
    // Then we expect the mint and token accounts to have the following updated data.
    const [
      { data: mintData },
      { data: adminTokenData },
      { data: userTokenData },
    ] = await Promise.all([
      fetchMint(client.rpc, stakingMint),
      fetchToken(client.rpc, adminStakingToken),
      fetchToken(client.rpc, userStakingToken),
    ]);
    console.log("mintData supply", mintData.supply);
    console.log("adminTokenData amount", adminTokenData.amount);
    console.log("userTokenData amount", userTokenData.amount);
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

  it("Is initialized!", async () => {
    const initializeInstruction = await programClient.getInitializeInstruction({
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
    assert.equal(firstGlobalState.rewardMint.toString(), rewardMint.toString());
    assert.equal(firstGlobalState.rewardRate, 500n);
    assert.equal(firstGlobalState.totalStaked, 0n);
  });

  it("User can stake tokens", async () => {
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
    assert.equal(firstUserStakeInfo.owner.toString(), user.address.toString());
    assert.equal(firstUserStakeInfo.amount, 100n);
    assert.equal(firstUserStakeInfo.rewardDebt, 0n);

    // Verify global state
    const globalState = await getGlobalState();
    // @ts-expect-error the 'data' property does actually exist.
    const firstGlobalState = globalState[0].data;
    assert.equal(firstGlobalState.totalStaked, stakeAmount);
  });

  it("User can claim rewards", async () => {
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
  });

  it("User can unstake tokens", async () => {});
});
