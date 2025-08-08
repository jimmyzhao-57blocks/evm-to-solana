import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import { useAccount } from "wagmi";
import styles from "../styles/Home.module.css";
import StakingActions from "../components/StakingActions";
import HistoryTable from "../components/HistoryTable";
import "dotenv/config";

// Mock history records data
const mockHistoryRecords = [
  {
    id: "1",
    type: "stake" as const,
    amount: "1000",
    timestamp: "2024-01-15 14:30:00",
    status: "completed" as const,
  },
  {
    id: "2",
    type: "unstake" as const,
    amount: "500",
    timestamp: "2024-01-16 09:15:00",
    status: "completed" as const,
  },
  {
    id: "3",
    type: "stake" as const,
    amount: "2000",
    timestamp: "2024-01-17 16:45:00",
    status: "pending" as const,
  },
];

const Home: NextPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState(mockHistoryRecords);
  const { address, isConnected } = useAccount();

  const handleStake = async (amount: string) => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    try {
      // Add actual staking logic here
      console.log("Staking amount:", amount);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Add new history record
      const newRecord = {
        id: Date.now().toString(),
        type: "stake" as const,
        amount,
        timestamp: new Date().toLocaleString("en-US"),
        status: "completed" as const,
      };

      setHistoryRecords((prev) => [newRecord, ...prev]);
    } catch (error) {
      console.error("Staking failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstake = async (amount: string) => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // Unstaking logic is now handled in UnstakeTokens component
      console.log("Unstaking amount:", amount);

      // Add new history record
      const newRecord = {
        id: Date.now().toString(),
        type: "unstake" as const,
        amount,
        timestamp: new Date().toLocaleString("en-US"),
        status: "completed" as const,
      };

      setHistoryRecords((prev) => [newRecord, ...prev]);
    } catch (error) {
      console.error("Unstaking failed:", error);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Staking Platform</title>
        <meta
          content="A clean and modern staking platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <main className={styles.main}>
        {/* Header Section - Wallet Connection */}
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Staking Platform</h1>
          <div className={styles.walletSection}>
            <ConnectButton
              label="Connect Wallet"
              showBalance={false}
              accountStatus="address"
            />
          </div>
        </header>

        {/* Show wallet connection message if not connected */}
        {!isConnected && (
          <div className={styles.walletMessage}>
            <div className={styles.messageCard}>
              <h2>Welcome to Staking Platform</h2>
              <p>
                Please connect your wallet to start staking and unstaking
                tokens.
              </p>
              <div className={styles.connectPrompt}>
                <ConnectButton
                  label="Connect Wallet to Continue"
                  showBalance={false}
                  accountStatus="address"
                />
              </div>
            </div>
          </div>
        )}

        {/* Staking Operations Section - Only show if wallet is connected */}
        {isConnected && (
          <StakingActions onStake={handleStake} onUnstake={handleUnstake} />
        )}

        {/* History Records Section - Only show if wallet is connected */}
        {isConnected && <HistoryTable records={historyRecords} />}
      </main>
    </div>
  );
};

export default Home;
