import React from "react";
import styles from "../styles/StakingActions.module.css";
import { useAccount } from "wagmi";
import StakeTokens from "./StakeTokens";
import UnstakeTokens from "./UnstakeTokens";

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
  const { isConnected } = useAccount();

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Staking Operations</h2>

      {!isConnected && (
        <div className={styles.warningMessage}>
          <p>⚠️ Please connect your wallet to perform staking operations</p>
        </div>
      )}

      <div className={styles.actionsGrid}>
        {/* Stake Section */}
        <div
          className={`${styles.actionCard} ${
            !isConnected ? styles.disabled : ""
          }`}
        >
          <h3 className={styles.actionTitle}>Stake Tokens</h3>
          <StakeTokens onStake={onStake} isLoading={isLoading} />
        </div>

        {/* Unstake Section */}
        <div
          className={`${styles.actionCard} ${
            !isConnected ? styles.disabled : ""
          }`}
        >
          <h3 className={styles.actionTitle}>Unstake Tokens</h3>
          <UnstakeTokens onUnstake={onUnstake} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default StakingActions;
