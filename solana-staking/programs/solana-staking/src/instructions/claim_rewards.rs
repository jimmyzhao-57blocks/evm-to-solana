use crate::constants::*;
use crate::errors::StakingError;
use crate::events::RewardsClaimed;
use crate::state::{GlobalState, UserStakeInfo};
use crate::utils::claim_pending_rewards;
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [STATE_SEED, state.staking_mint.as_ref()],
        bump = state.bump
    )]
    pub state: Box<Account<'info, GlobalState>>,

    #[account(
        mut,
        seeds = [STAKE_SEED, user.key().as_ref()],
        bump = user_stake_info.bump
    )]
    pub user_stake_info: Box<Account<'info, UserStakeInfo>>,

    #[account(
        mut,
        token::mint = state.reward_mint,
        token::authority = user
    )]
    pub user_reward_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [REWARD_VAULT_SEED, state.key().as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    /// CHECK: This account may or may not exist - we check if it exists to determine blacklist status
    #[account(
        seeds = [BLACKLIST_SEED, user.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn claim_rewards_handler(ctx: Context<ClaimRewards>) -> Result<()> {
    let blacklist_info = &ctx.accounts.blacklist_entry.to_account_info();
    require!(
        blacklist_info.data_is_empty() || blacklist_info.lamports() == 0,
        StakingError::AddressBlacklisted
    );

    let state = &ctx.accounts.state;
    let user_stake = &mut ctx.accounts.user_stake_info;
    let clock = &ctx.accounts.clock;

    let rewards = claim_pending_rewards(
        state,
        user_stake,
        &ctx.accounts.reward_vault,
        &ctx.accounts.user_reward_account,
        &ctx.accounts.token_program,
        clock,
    )?;

    if rewards > 0 {
        msg!(
            "User {} claimed {} rewards",
            ctx.accounts.user.key(),
            rewards
        );

        // Emit rewards claimed event
        emit!(RewardsClaimed {
            user: ctx.accounts.user.key(),
            amount: rewards,
            timestamp: clock.unix_timestamp,
        });
    } else {
        msg!("No rewards to claim");
    }

    Ok(())
}
