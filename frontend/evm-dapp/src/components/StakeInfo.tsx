import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useAccount, useReadContract } from "wagmi";
import { STAKING_CONTRACT_ADDRESS } from "../../consts";
import { stakingAbi } from "../../abi/stakeAbi";
import styles from "../styles/StakeInfo.module.css";
import { Address } from "viem";

interface StakeInfoData {
  stakedAmount: bigint;
  stakingTimestamp: bigint;
  pendingReward: bigint;
  claimedReward: bigint;
}

export interface StakeInfoRef {
  refresh: () => void;
}

const StakeInfo = forwardRef<StakeInfoRef>((props, ref) => {
  const { address, isConnected } = useAccount();
  const [stakeInfo, setStakeInfo] = useState<StakeInfoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: stakeInfoData,
    isLoading: isReading,
    error: readError,
    refetch,
  } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: stakingAbi,
    functionName: "getStakeInfo",
    args: [address as Address],
    query: {
      enabled: !!address && isConnected,
    },
  });

  useEffect(() => {
    if (
      stakeInfoData &&
      Array.isArray(stakeInfoData) &&
      stakeInfoData.length === 4
    ) {
      const [stakedAmount, stakingTimestamp, pendingReward, claimedReward] =
        stakeInfoData;
      setStakeInfo({
        stakedAmount,
        stakingTimestamp,
        pendingReward,
        claimedReward,
      });
      setError(null);
    }
  }, [stakeInfoData]);

  useEffect(() => {
    if (readError) {
      setError(`Failed to load stake info: ${readError.message}`);
    }
  }, [readError]);

  const formatTimestamp = (timestamp: bigint) => {
    if (timestamp === BigInt(0)) return "Not staked yet";
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString("en-US");
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refetch();
    } catch (error) {
      setError(
        `Failed to refresh: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Expose refresh method to parent component
  useImperativeHandle(ref, () => ({
    refresh: handleRefresh,
  }));

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Stake Information</h3>
        <div className={styles.message}>
          <p>Please connect your wallet to view stake information</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Stake Information</h3>
        <button
          onClick={handleRefresh}
          disabled={isLoading || isReading}
          className={styles.refreshButton}
        >
          {isLoading || isReading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {isReading || isLoading ? (
        <div className={styles.loading}>
          <p>Loading stake information...</p>
        </div>
      ) : stakeInfo ? (
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <h4 className={styles.infoTitle}>Staked Amount</h4>
            <p className={styles.infoValue}>{stakeInfo.stakedAmount} Tokens</p>
          </div>

          <div className={styles.infoCard}>
            <h4 className={styles.infoTitle}>Staking Date</h4>
            <p className={styles.infoValue}>
              {stakeInfo.stakingTimestamp > BigInt(0)
                ? formatTimestamp(stakeInfo.stakingTimestamp)
                : "Not staked yet"}
            </p>
          </div>

          <div className={styles.infoCard}>
            <h4 className={styles.infoTitle}>Pending Rewards</h4>
            <p className={styles.infoValue}>{stakeInfo.pendingReward} Tokens</p>
          </div>

          <div className={styles.infoCard}>
            <h4 className={styles.infoTitle}>Claimed Rewards</h4>
            <p className={styles.infoValue}>{stakeInfo.claimedReward} Tokens</p>
          </div>
        </div>
      ) : (
        <div className={styles.message}>
          <p>No stake information found</p>
        </div>
      )}
    </div>
  );
});

StakeInfo.displayName = "StakeInfo";

export default StakeInfo;
