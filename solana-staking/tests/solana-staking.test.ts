import { assert } from "chai";
import * as programClient from "../dist/js-client";
import {
  getGlobalStateDecoder,
  GLOBAL_STATE_DISCRIMINATOR,
} from "../dist/js-client";
import {
  type KeyPairSigner,
  type Address,
  pipe,
  appendTransactionMessageInstruction,
} from "@solana/kit";
import { connect, Connection } from "solana-kite";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
  getMintToInstruction,
} from "@solana-program/token";
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createMint,
  createToken,
  createTokenWithAmount,
  signAndSendTransaction,
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

  // Test accounts
  let stakingMint: Address;
  let rewardMint: Address;
  let userStakingToken: Address;

  // PDAs
  let statePda: Address;
  let stakingVaultPda: Address;
  let rewardVaultPda: Address;
  let userStakeInfoPda: Address;

  before(async () => {
    connection = await connect();
    [admin, user] = await connection.createWallets(2);

    const client = createDefaultSolanaClient();
    // Create staking token mint
    stakingMint = await createMint(client, admin, admin.address, 9);
    // Create reward token mint
    rewardMint = await createMint(client, admin, admin.address, 9);

    const stakingToken = await createTokenWithAmount(
      client,
      admin,
      admin,
      stakingMint,
      admin.address,
      1000n
    );
    userStakingToken = await createTokenWithAmount(
      client,
      admin,
      admin,
      stakingMint,
      user.address,
      500n
    );
    // Then we expect the mint and token accounts to have the following updated data.
    const [{ data: mintData }, { data: tokenData }, { data: userTokenData }] =
      await Promise.all([
        fetchMint(client.rpc, stakingMint),
        fetchToken(client.rpc, stakingToken),
        fetchToken(client.rpc, userStakingToken),
      ]);
    console.log("mintData supply", mintData.supply);
    console.log("tokenData amount", tokenData.amount);
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
      // systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      rewardRate: 500,
    });
    const signature = await connection.sendTransactionFromInstructions({
      feePayer: admin,
      instructions: [initializeInstruction],
    });
    console.log("Transaction signature", signature);

    const getGlobalState = connection.getAccountsFactory(
      programClient.SOLANA_STAKING_PROGRAM_ADDRESS,
      GLOBAL_STATE_DISCRIMINATOR,
      getGlobalStateDecoder()
    );

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
    const stakeInstruction = await programClient.getStakeInstruction({
      user: user,
      state: statePda,
      userStakeInfo: userStakeInfoPda,
      userTokenAccount: userStakingToken,
      stakingVault: stakingVaultPda,
      // systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      amount: 100n,
    });
    const signature = await connection.sendTransactionFromInstructions({
      feePayer: user,
      instructions: [stakeInstruction],
    });
    console.log("Transaction signature", signature);
  });

  it("User can claim rewards", async () => {});

  it("User can unstake tokens", async () => {});
});
