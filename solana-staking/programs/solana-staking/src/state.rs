use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub admin: Pubkey,
    pub staking_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub staking_vault: Pubkey,
    pub reward_vault: Pubkey,
    pub reward_rate: u64, // Basis points (100 = 1%)
    pub total_staked: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserStakeInfo {
    pub owner: Pubkey,
    pub amount: u64,
    pub stake_timestamp: i64,
    pub last_claim_time: i64,
    pub reward_debt: u64,
    pub bump: u8,
}
