import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import styles from "../styles/Home.module.css";
import StakingActions from "../components/StakingActions";
import HistoryTable from "../components/HistoryTable";

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

  const handleStake = async (amount: string) => {
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
    setIsLoading(true);
    try {
      // Add actual unstaking logic here
      console.log("Unstaking amount:", amount);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
    } finally {
      setIsLoading(false);
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

        {/* Staking Operations Section */}
        <StakingActions
          onStake={handleStake}
          onUnstake={handleUnstake}
          isLoading={isLoading}
        />

        {/* History Records Section */}
        <HistoryTable records={historyRecords} />
      </main>
    </div>
  );
};

export default Home;
