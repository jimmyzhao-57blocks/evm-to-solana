import React, { useState, useEffect } from "react";
import styles from "../styles/StakingActions.module.css";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { STAKING_CONTRACT_ADDRESS, STAKING_TOKEN_ADDRESS } from "../../consts";
import { stakingAbi } from "../../abi/stakeAbi";
import { stakingTokenAbi } from "../../abi/StakingTokenABI";

interface StakeTokensProps {
  onStake: (amount: string) => void;
  isLoading?: boolean;
  onTransactionSuccess?: () => void;
}

const StakeTokens: React.FC<StakeTokensProps> = ({
  onStake,
  isLoading = false,
  onTransactionSuccess,
}) => {
  const [stakeAmount, setStakeAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const { isConnected, address } = useAccount();

  const {
    writeContract,
    data: stakeHash,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isStakingLoading,
    isSuccess: isStakingSuccess,
    error: isStakingError,
  } = useWaitForTransactionReceipt({
    hash: stakeHash,
  });

  // Handle approval transaction
  const {
    isLoading: isApprovalLoading,
    isSuccess: isApprovalSuccess,
    error: isApprovalError,
  } = useWaitForTransactionReceipt({
    hash: approvalHash as `0x${string}` | undefined,
  });

  // Set approval hash when writeContract data changes
  useEffect(() => {
    if (stakeHash && isApproving && !approvalHash) {
      setApprovalHash(stakeHash);
    }
  }, [stakeHash, isApproving, approvalHash]);

  // Handle error messages
  useEffect(() => {
    if (writeError) {
      setErrorMessage(
        `Transaction failed: ${writeError.message || "Unknown error occurred"}`
      );
      setIsApproving(false);
    } else if (isStakingError) {
      setErrorMessage(
        `Staking failed: ${isStakingError.message || "Transaction reverted"}`
      );
      setIsApproving(false);
    } else if (isApprovalError) {
      setErrorMessage(
        `Approval failed: ${isApprovalError.message || "Approval reverted"}`
      );
      setIsApproving(false);
    } else if (isStakingSuccess) {
      setErrorMessage(null);
      setIsApproving(false);
      // Call the onStake callback when staking is successful
      if (stakeAmount) {
        onStake(stakeAmount);
        setStakeAmount("");
        // Notify parent component to refresh stake information immediately after transaction success
        if (onTransactionSuccess) {
          onTransactionSuccess();
        }
      }
    }
  }, [
    writeError,
    isStakingError,
    isApprovalError,
    isStakingSuccess,
    stakeAmount,
    onStake,
  ]);

  // Handle approval success
  useEffect(() => {
    if (isApprovalSuccess && isApproving) {
      // After approval is successful, proceed with staking
      try {
        writeContract({
          address: STAKING_CONTRACT_ADDRESS,
          abi: stakingAbi,
          functionName: "stake",
          args: [stakeAmount],
        });
        // Clear approval hash after successful approval
        setApprovalHash(null);
      } catch (error) {
        setErrorMessage(
          `Failed to initiate stake: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        setIsApproving(false);
        setApprovalHash(null);
      }
    }
  }, [isApprovalSuccess, isApproving, writeContract, stakeAmount]);

  // Clear error message when user starts a new action
  const clearError = () => {
    setErrorMessage(null);
  };

  const handleStake = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    if (
      !stakeAmount ||
      isStakingLoading ||
      isLoading ||
      isApproving ||
      isApprovalLoading
    ) {
      return;
    }

    clearError(); // Clear any previous errors
    setIsApproving(true);
    setApprovalHash(null); // Clear any previous approval hash

    try {
      //Approve the staking contract to spend tokens
      writeContract({
        address: STAKING_TOKEN_ADDRESS,
        abi: stakingTokenAbi,
        functionName: "approve",
        args: [STAKING_CONTRACT_ADDRESS, stakeAmount],
      });
    } catch (error) {
      setErrorMessage(
        `Failed to approve tokens: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsApproving(false);
    }
  };

  const isDisabled =
    !isConnected ||
    isStakingLoading ||
    isLoading ||
    isApproving ||
    isApprovalLoading;

  return (
    <div>
      {/* Error Message Display */}
      {errorMessage && (
        <div className={styles.errorMessage}>
          <div className={styles.errorContent}>
            <span className={styles.errorIcon}>❌</span>
            <p className={styles.errorText}>{errorMessage}</p>
            <button
              onClick={clearError}
              className={styles.errorCloseButton}
              aria-label="Close error message"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className={styles.inputGroup}>
        <input
          type="number"
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          placeholder={
            isConnected ? "Enter stake amount" : "Connect wallet first"
          }
          className={styles.input}
          disabled={isDisabled}
        />
        <button
          onClick={handleStake}
          disabled={!stakeAmount || isDisabled}
          className={`${styles.button} ${styles.stakeButton} ${
            isDisabled ? styles.disabledButton : ""
          }`}
        >
          {isApprovalLoading
            ? "Approving..."
            : isStakingLoading
            ? "Staking..."
            : "Stake"}
        </button>
      </div>
    </div>
  );
};

export default StakeTokens;
