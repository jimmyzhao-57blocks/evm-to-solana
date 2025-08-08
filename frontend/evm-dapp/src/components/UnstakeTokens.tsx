import React, { useState } from "react";
import styles from "../styles/StakingActions.module.css";
import { useAccount } from "wagmi";

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

  // Clear error message when user starts a new action
  const clearError = () => {
    setErrorMessage(null);
  };

  const handleUnstake = () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    clearError(); // Clear any previous errors

    if (unstakeAmount && !isLoading) {
      try {
        onUnstake(unstakeAmount);
        setUnstakeAmount("");
      } catch (error) {
        setErrorMessage(
          `Failed to initiate unstake: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  };

  const isDisabled = !isConnected || isLoading;

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
          {isLoading ? "Processing..." : "Unstake"}
        </button>
      </div>
    </div>
  );
};

export default UnstakeTokens;
