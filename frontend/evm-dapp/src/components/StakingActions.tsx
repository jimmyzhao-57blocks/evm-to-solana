import React, { useState } from "react";
import styles from "../styles/StakingActions.module.css";

interface StakingActionsProps {
  onStake: (amount: string) => void;
  onUnstake: (amount: string) => void;
  isLoading?: boolean;
}

const StakingActions: React.FC<StakingActionsProps> = ({
  onStake,
  onUnstake,
  isLoading = false,
}) => {
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");

  const handleStake = () => {
    if (stakeAmount && !isLoading) {
      onStake(stakeAmount);
      setStakeAmount("");
    }
  };

  const handleUnstake = () => {
    if (unstakeAmount && !isLoading) {
      onUnstake(unstakeAmount);
      setUnstakeAmount("");
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Staking Operations</h2>

      <div className={styles.actionsGrid}>
        {/* Stake Section */}
        <div className={styles.actionCard}>
          <h3 className={styles.actionTitle}>Stake Tokens</h3>
          <div className={styles.inputGroup}>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Enter stake amount"
              className={styles.input}
              disabled={isLoading}
            />
            <button
              onClick={handleStake}
              disabled={!stakeAmount || isLoading}
              className={`${styles.button} ${styles.stakeButton}`}
            >
              {isLoading ? "Processing..." : "Stake"}
            </button>
          </div>
        </div>

        {/* Unstake Section */}
        <div className={styles.actionCard}>
          <h3 className={styles.actionTitle}>Unstake Tokens</h3>
          <div className={styles.inputGroup}>
            <input
              type="number"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="Enter unstake amount"
              className={styles.input}
              disabled={isLoading}
            />
            <button
              onClick={handleUnstake}
              disabled={!unstakeAmount || isLoading}
              className={`${styles.button} ${styles.unstakeButton}`}
            >
              {isLoading ? "Processing..." : "Unstake"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakingActions;
