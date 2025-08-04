import { LiteSVM } from "litesvm";
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
  createTransferCheckedInstruction,
  getMintLen,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  unpackAccount,
} from "@solana/spl-token";
import { createKeyPairSignerFromBytes, address, lamports } from "@solana/kit";
import * as programClient from "../dist/js-client";
import {
  decodeGlobalState,
  decodeUserStakeInfo,
  decodeBlacklistEntry,
} from "../dist/js-client";

// Program ID
export const programId = new PublicKey(
  programClient.SOLANA_STAKING_PROGRAM_ADDRESS.toString()
);

export const toToken = (amount: number): bigint =>
  BigInt(amount) * BigInt(10 ** 9);

// Helper function to convert instruction
export function toTransactionInstruction(
  instruction: any
): TransactionInstruction {
  return new TransactionInstruction({
    keys: instruction.accounts.map((acc: any) => {
      if ("pubkey" in acc) {
        return {
          pubkey: new PublicKey(acc.pubkey),
          isSigner: acc.isSigner,
          isWritable: acc.isWritable,
        };
      } else {
        // AccountLookupMeta case - acc has 'address' and 'role'
        const pubkey = new PublicKey(acc.address);
        const isSigner = acc.role === 2 || acc.role === 3; // writableSigner or readonlySigner
        const isWritable = acc.role === 1 || acc.role === 2; // writable or writableSigner
        return {
          pubkey,
          isSigner,
          isWritable,
        };
      }
    }),
    programId: new PublicKey(instruction.programAddress),
    data: Buffer.from(instruction.data, "base64"),
  });
}

// Helper functions for LiteSVM
export function createMint(
  provider: LiteSVMProvider,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number
): PublicKey {
  const mint = Keypair.generate();
  const mintLen = getMintLen([]);

  // Create account
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    space: mintLen,
    lamports: LAMPORTS_PER_SOL,
    programId: TOKEN_PROGRAM_ID,
  });

  // Initialize mint
  const initMintIx = createInitializeMint2Instruction(
    mint.publicKey,
    decimals,
    mintAuthority,
    freezeAuthority,
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(createAccountIx, initMintIx);
  tx.recentBlockhash = provider.client.latestBlockhash();
  tx.sign(payer, mint);
  provider.client.sendTransaction(tx);

  return mint.publicKey;
}

export function createAssociatedTokenAccount(
  provider: LiteSVMProvider,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): PublicKey {
  const ata = getAssociatedTokenAddressSync(mint, owner);

  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ata,
    owner,
    mint,
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(createAtaIx);
  tx.recentBlockhash = provider.client.latestBlockhash();
  tx.sign(payer);
  provider.client.sendTransaction(tx);

  return ata;
}

export function mintTo(
  provider: LiteSVMProvider,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  amount: bigint
): void {
  const mintToIx = createMintToCheckedInstruction(
    mint,
    destination,
    authority.publicKey,
    amount,
    9, // decimals
    [],
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(mintToIx);
  tx.recentBlockhash = provider.client.latestBlockhash();
  tx.sign(payer, authority);
  provider.client.sendTransaction(tx);
}

export function transfer(
  provider: LiteSVMProvider,
  payer: Keypair,
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: Keypair,
  amount: bigint
): void {
  const transferIx = createTransferCheckedInstruction(
    source,
    mint,
    destination,
    owner.publicKey,
    amount,
    9, // decimals
    [],
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(transferIx);
  tx.recentBlockhash = provider.client.latestBlockhash();
  tx.sign(payer, owner);
  provider.client.sendTransaction(tx);
}

export function getAccount(provider: LiteSVMProvider, address: PublicKey): any {
  const accountInfo = provider.client.getAccount(address);
  if (!accountInfo) throw new Error("Account not found");
  // Convert Uint8Array to Buffer
  const data = Buffer.from(accountInfo.data);
  const accountInfoWithBuffer = {
    ...accountInfo,
    data: data,
  };
  const account = unpackAccount(
    address,
    accountInfoWithBuffer,
    TOKEN_PROGRAM_ID
  );
  return account;
}

// Helper functions to get and decode program accounts
function getAndDecodeAccount<T>(
  provider: LiteSVMProvider,
  accountPda: PublicKey,
  decoder: (encodedAccount: any) => { data: T }
): T | null {
  const accountInfo = provider.client.getAccount(accountPda);
  if (!accountInfo) return null;

  const encodedAccount = {
    address: address(accountPda.toBase58()),
    data: accountInfo.data,
    owner: accountInfo.owner.toBase58(),
    lamports: lamports(BigInt(accountInfo.lamports)),
    rentEpoch: BigInt(accountInfo.rentEpoch),
    executable: accountInfo.executable,
    programAddress: address(accountInfo.owner.toBase58()),
    space: BigInt(accountInfo.data.length),
    exists: true,
  };

  const decodedAccount = decoder(encodedAccount);
  return decodedAccount.data;
}

export function getGlobalState(
  provider: LiteSVMProvider,
  statePda: PublicKey
): programClient.GlobalState | null {
  return getAndDecodeAccount(provider, statePda, decodeGlobalState);
}

export function getUserStakeInfo(
  provider: LiteSVMProvider,
  userStakeInfoPda: PublicKey
): programClient.UserStakeInfo | null {
  return getAndDecodeAccount(provider, userStakeInfoPda, decodeUserStakeInfo);
}

export function getBlacklistEntry(
  provider: LiteSVMProvider,
  blacklistPda: PublicKey
): programClient.BlacklistEntry | null {
  return getAndDecodeAccount(provider, blacklistPda, decodeBlacklistEntry);
}

// PDA helper functions
export function getUserStakePda(statePda: PublicKey, userPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), statePda.toBuffer(), userPubkey.toBuffer()],
    programId
  );
  return pda;
}

export function getBlacklistPda(statePda: PublicKey, userPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("blacklist"), statePda.toBuffer(), userPubkey.toBuffer()],
    programId
  );
  return pda;
}

// Transaction helper functions
export async function sendTransaction(
  provider: LiteSVMProvider,
  instruction: any,
  signer: Keypair
): Promise<any> {
  // Expire the blockhash to ensure each transaction has a unique blockhash
  provider.client.expireBlockhash();

  const tx = new Transaction().add(toTransactionInstruction(instruction));
  tx.recentBlockhash = provider.client.latestBlockhash();
  tx.sign(signer);

  const result = provider.client.sendTransaction(tx);

  // Check if transaction failed
  // LiteSVM returns FailedTransactionMetadata if transaction fails
  if ("err" in result && typeof result.err === "function") {
    const errorString = result.toString();
    throw new Error(errorString);
  }

  return result;
}

// User token accounts helper
export function getUserTokenAccounts(
  userPubkey: PublicKey,
  stakingMint: PublicKey,
  rewardMint: PublicKey
) {
  return {
    stakingToken: getAssociatedTokenAddressSync(stakingMint, userPubkey),
    rewardToken: getAssociatedTokenAddressSync(rewardMint, userPubkey),
  };
}

// Test user creation helper
export async function createTestUser(svm: LiteSVM, solAmount: number = 10) {
  const user = Keypair.generate();
  const userSigner = await createKeyPairSignerFromBytes(user.secretKey);
  svm.airdrop(user.publicKey, BigInt(solAmount * LAMPORTS_PER_SOL));
  return { user, userSigner };
}

// Setup user with tokens helper
export async function setupUserWithTokens(
  provider: LiteSVMProvider,
  admin: Keypair,
  user: Keypair,
  stakingMint: PublicKey,
  rewardMint: PublicKey,
  stakingAmount: bigint = toToken(1000)
) {
  const { stakingToken, rewardToken } = getUserTokenAccounts(
    user.publicKey,
    stakingMint,
    rewardMint
  );

  createAssociatedTokenAccount(provider, admin, stakingMint, user.publicKey);
  createAssociatedTokenAccount(provider, admin, rewardMint, user.publicKey);

  if (stakingAmount > 0) {
    mintTo(provider, admin, stakingMint, stakingToken, admin, stakingAmount);
  }

  return { stakingToken, rewardToken };
}
