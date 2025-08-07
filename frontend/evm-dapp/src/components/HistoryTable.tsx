import React from "react";
import styles from "../styles/HistoryTable.module.css";

interface HistoryRecord {
  id: string;
  type: "stake" | "unstake";
  amount: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

interface HistoryTableProps {
  records: HistoryRecord[];
}

const HistoryTable: React.FC<HistoryTableProps> = ({ records }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return styles.statusCompleted;
      case "pending":
        return styles.statusPending;
      case "failed":
        return styles.statusFailed;
      default:
        return "";
    }
  };

  const getTypeText = (type: string) => {
    return type === "stake" ? "Stake" : "Unstake";
  };

  return (
    <div className={styles.tableContainer}>
      <h2 className={styles.tableTitle}>Transaction History</h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.emptyMessage}>
                  No transaction history
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>{getTypeText(record.type)}</td>
                  <td>{record.amount}</td>
                  <td>{record.timestamp}</td>
                  <td>
                    <span
                      className={`${styles.status} ${getStatusColor(
                        record.status
                      )}`}
                    >
                      {record.status === "completed"
                        ? "Completed"
                        : record.status === "pending"
                        ? "Pending"
                        : "Failed"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTable;
