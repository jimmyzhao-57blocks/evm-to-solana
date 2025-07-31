use crate::constants::*;
use crate::errors::StakingError;
use crate::events::Unstaked;
use crate::state::{GlobalState, UserStakeInfo};
use crate::utils::claim_pending_rewards;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
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
        token::mint = state.staking_mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [STAKING_VAULT_SEED, state.key().as_ref()],
        bump
    )]
    pub staking_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [REWARD_VAULT_SEED, state.key().as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = state.reward_mint,
        token::authority = user
    )]
    pub user_reward_account: Account<'info, TokenAccount>,

    /// CHECK: This account may or may not exist - we check if it exists to determine blacklist status
    #[account(
        seeds = [BLACKLIST_SEED, user.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn unstake_handler(ctx: Context<Unstake>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::InvalidUnstakeAmount);

    let blacklist_info = &ctx.accounts.blacklist_entry.to_account_info();
    require!(
        blacklist_info.data_is_empty() || blacklist_info.lamports() == 0,
        StakingError::AddressBlacklisted
    );

    let state = &mut ctx.accounts.state;
    let user_stake = &mut ctx.accounts.user_stake_info;
    let clock = &ctx.accounts.clock;

    require!(
        user_stake.amount >= amount,
        StakingError::InsufficientStakedAmount
    );

    // Calculate and transfer rewards before unstaking
    let rewards = claim_pending_rewards(
        state,
        user_stake,
        &ctx.accounts.reward_vault,
        &ctx.accounts.user_reward_account,
        &ctx.accounts.token_program,
        clock,
    )?;

    // Transfer staking tokens back to user
    let seeds = &[
        STATE_SEED.as_ref(),
        state.staking_mint.as_ref(),
        &[state.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.staking_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: state.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    // Update user stake info
    user_stake.amount = user_stake
        .amount
        .checked_sub(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Update global state
    state.total_staked = state
        .total_staked
        .checked_sub(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    msg!(
        "User {} unstaked {} tokens and received {} rewards",
        ctx.accounts.user.key(),
        amount,
        rewards
    );

    // Emit unstaked event
    emit!(Unstaked {
        user: ctx.accounts.user.key(),
        amount,
        rewards,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
