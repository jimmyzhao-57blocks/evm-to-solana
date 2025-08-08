import React, { useState, useEffect } from "react";
import styles from "../styles/StakingActions.module.css";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { STAKING_CONTRACT_ADDRESS } from "../../consts";
import { stakingAbi } from "../../abi/stakeAbi";

interface UnstakeTokensProps {
  onUnstake: (amount: string) => void;
  isLoading?: boolean;
}

const UnstakeTokens: React.FC<UnstakeTokensProps> = ({
  onUnstake,
  isLoading = false,
}) => {
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isConnected } = useAccount();

  const {
    writeContract,
    data: unstakeHash,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isUnstakingLoading,
    isSuccess: isUnstakingSuccess,
    error: isUnstakingError,
  } = useWaitForTransactionReceipt({
    hash: unstakeHash,
  });

  // Handle error messages
  useEffect(() => {
    if (writeError) {
      setErrorMessage(
        `Transaction failed: ${writeError.message || "Unknown error occurred"}`
      );
    } else if (isUnstakingError) {
      setErrorMessage(
        `Unstaking failed: ${
          isUnstakingError.message || "Transaction reverted"
        }`
      );
    } else if (isUnstakingSuccess) {
      setErrorMessage(null);
      // Call the onUnstake callback when unstaking is successful
      if (unstakeAmount) {
        onUnstake(unstakeAmount);
        setUnstakeAmount("");
      }
    }
  }, [
    writeError,
    isUnstakingError,
    isUnstakingSuccess,
    unstakeAmount,
    onUnstake,
  ]);

  // Clear error message when user starts a new action
  const clearError = () => {
    setErrorMessage(null);
  };

  const handleUnstake = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    if (!unstakeAmount || isUnstakingLoading || isLoading) {
      return;
    }

    clearError(); // Clear any previous errors

    try {
      writeContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: "unstake",
        args: [unstakeAmount],
      });
    } catch (error) {
      setErrorMessage(
        `Failed to initiate unstake: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const isDisabled = !isConnected || isUnstakingLoading || isLoading;

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
          value={unstakeAmount}
          onChange={(e) => setUnstakeAmount(e.target.value)}
          placeholder={
            isConnected ? "Enter unstake amount" : "Connect wallet first"
          }
          className={styles.input}
          disabled={isDisabled}
        />
        <button
          onClick={handleUnstake}
          disabled={!unstakeAmount || isDisabled}
          className={`${styles.button} ${styles.unstakeButton} ${
            isDisabled ? styles.disabledButton : ""
          }`}
        >
          {isUnstakingLoading ? "Processing..." : "Unstake"}
        </button>
      </div>
    </div>
  );
};

export default UnstakeTokens;
