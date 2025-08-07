# Staking Platform

A clean and modern staking platform that supports token staking and unstaking operations.

## Features

- 🔗 **Wallet Connection**: Support for multiple wallet connections using RainbowKit
- 💰 **Staking Operations**: Support for token staking and unstaking
- 📊 **Transaction History**: Real-time display of staking and unstaking history
- 📱 **Responsive Design**: Support for desktop and mobile access
- 🎨 **Modern UI**: Clean and elegant user interface design

## Page Layout

### 1. Header Section

- Platform title
- Wallet connection button

### 2. Staking Operations Section

- Token staking input field and button
- Token unstaking input field and button
- Real-time loading status display

### 3. Transaction History Table

- Operation type (Stake/Unstake)
- Operation amount
- Operation time
- Operation status (Completed/Pending/Failed)

## Tech Stack

- **Frontend Framework**: Next.js 15
- **UI Components**: React 19
- **Wallet Connection**: RainbowKit + Wagmi
- **Styling**: CSS Modules
- **Language**: TypeScript
- **Node Version**: 22.10.0

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── components/
│   ├── StakingActions.tsx    # Staking operations component
│   └── HistoryTable.tsx      # Transaction history table component
├── pages/
│   └── index.tsx             # Main page
├── styles/
│   ├── Home.module.css       # Main page styles
│   ├── StakingActions.module.css  # Staking operations styles
│   └── HistoryTable.module.css    # Transaction history table styles
└── wagmi.ts                  # Wagmi configuration
```

## Customization

### Adding Smart Contract Integration

Add actual smart contract interaction logic in the `handleStake` and `handleUnstake` functions in `src/pages/index.tsx`:

```typescript
const handleStake = async (amount: string) => {
  setIsLoading(true);
  try {
    // Add actual staking contract call
    // const result = await stakeContract.stake(amount);

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
```

### Style Customization

All style files use CSS Modules. You can directly modify the corresponding `.module.css` files to customize the appearance.

## Browser Support

- Chrome (Recommended)
- Firefox
- Safari
- Edge

## License

MIT License
