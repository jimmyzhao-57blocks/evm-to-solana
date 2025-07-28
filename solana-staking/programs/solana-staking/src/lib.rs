use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("4XKoqimJG7svD8vnTb5N2h24rFSsA57LnBckBhxJ2q8M");

#[program]
pub mod solana_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, reward_rate: u64) -> Result<()> {
        instructions::initialize::initialize_handler(ctx, reward_rate)
    }
    
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        instructions::stake::stake_handler(ctx, amount)
    }
    
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        instructions::unstake::unstake_handler(ctx, amount)
    }
    
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim_rewards::claim_rewards_handler(ctx)
    }
}