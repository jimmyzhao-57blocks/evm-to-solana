use crate::constants::*;
use crate::errors::StakingError;
use crate::events::Staked;
use crate::state::{GlobalState, UserStakeInfo};
use crate::utils::claim_pending_rewards;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [STATE_SEED, state.staking_mint.as_ref()],
        bump = state.bump
    )]
    pub state: Box<Account<'info, GlobalState>>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStakeInfo::INIT_SPACE,
        seeds = [STAKE_SEED, state.key().as_ref(), user.key().as_ref()],
        bump
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
        seeds = [BLACKLIST_SEED, state.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn stake_handler(ctx: Context<Stake>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::InvalidStakeAmount);

    let blacklist_info = &ctx.accounts.blacklist_entry.to_account_info();
    require!(
        blacklist_info.data_is_empty() || blacklist_info.lamports() == 0,
        StakingError::AddressBlacklisted
    );

    let state = &mut ctx.accounts.state;
    let user_stake = &mut ctx.accounts.user_stake_info;
    let clock = &ctx.accounts.clock;

    // If user already has a stake, claim rewards first
    if user_stake.amount > 0 {
        claim_pending_rewards(
            state,
            user_stake,
            &ctx.accounts.reward_vault,
            &ctx.accounts.user_reward_account,
            &ctx.accounts.token_program,
            clock,
        )?;
    }

    // Transfer staking tokens from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.staking_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update user stake info
    user_stake.owner = ctx.accounts.user.key();
    user_stake.amount = user_stake
        .amount
        .checked_add(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;
    // Only update stake_timestamp on first stake
    if user_stake.stake_timestamp == 0 {
        user_stake.stake_timestamp = clock.unix_timestamp;
    }
    user_stake.bump = ctx.bumps.user_stake_info;

    // Update global state
    state.total_staked = state
        .total_staked
        .checked_add(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    msg!("User {} staked {} tokens", ctx.accounts.user.key(), amount);

    // Emit staked event
    emit!(Staked {
        user: ctx.accounts.user.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
