use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{GlobalState, UserStakeInfo};
use crate::errors::StakingError;

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump
    )]
    pub state: Account<'info, GlobalState>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStakeInfo::INIT_SPACE,
        seeds = [b"stake", user.key().as_ref()],
        bump
    )]
    pub user_stake_info: Account<'info, UserStakeInfo>,
    
    #[account(
        mut,
        token::mint = state.staking_mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"staking_vault", state.key().as_ref()],
        bump
    )]
    pub staking_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"reward_vault", state.key().as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = state.reward_mint,
        token::authority = user
    )]
    pub user_reward_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn stake_handler(ctx: Context<Stake>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::InvalidStakeAmount);
    
    let state = &mut ctx.accounts.state;
    let user_stake = &mut ctx.accounts.user_stake_info;
    let clock = &ctx.accounts.clock;
    
    // If user already has a stake, claim rewards first
    if user_stake.amount > 0 {
        // Calculate rewards from last claim time (or stake time if never claimed)
        let last_claim = if user_stake.last_claim_time > 0 {
            user_stake.last_claim_time
        } else {
            user_stake.stake_timestamp
        };
        
        let rewards = calculate_rewards(
            user_stake.amount,
            last_claim,
            clock.unix_timestamp,
            state.reward_rate
        )?;
        
        if rewards > 0 {
            // Transfer rewards from reward vault to user
            let seeds = &[b"state".as_ref(), &[state.bump]];
            let signer = &[&seeds[..]];
            
            let cpi_accounts = Transfer {
                from: ctx.accounts.reward_vault.to_account_info(),
                to: ctx.accounts.user_reward_account.to_account_info(),
                authority: state.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, rewards)?;
            
            user_stake.reward_debt = user_stake.reward_debt.checked_add(rewards)
                .ok_or(StakingError::ArithmeticOverflow)?;
        }
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
    user_stake.amount = user_stake.amount.checked_add(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;
    // Only update stake_timestamp on first stake
    if user_stake.stake_timestamp == 0 {
        user_stake.stake_timestamp = clock.unix_timestamp;
        // Initialize last_claim_time on first stake
        user_stake.last_claim_time = clock.unix_timestamp;
    } else {
        // Update last_claim_time after claiming pending rewards
        user_stake.last_claim_time = clock.unix_timestamp;
    }
    user_stake.bump = ctx.bumps.user_stake_info;
    
    // Update global state
    state.total_staked = state.total_staked.checked_add(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;
    
    msg!("User {} staked {} tokens", ctx.accounts.user.key(), amount);
    
    Ok(())
}

pub fn calculate_rewards(
    amount: u64,
    start_timestamp: i64,
    end_timestamp: i64,
    reward_rate: u64
) -> Result<u64> {
    let duration = (end_timestamp - start_timestamp) as u64; // duration in seconds
    
    // Calculate rewards based on seconds to match EVM implementation
    // Formula: (amount * rate * time_in_seconds) / (seconds_per_day * precision)
    // This ensures continuous rewards calculation without losing partial days
    
    // Use u128 for intermediate calculations to avoid overflow
    // First multiply amount by rate
    let amount_rate = (amount as u128)
        .checked_mul(reward_rate as u128)
        .ok_or(StakingError::ArithmeticOverflow)?;
    
    // Then multiply by duration
    let numerator = amount_rate
        .checked_mul(duration as u128)
        .ok_or(StakingError::ArithmeticOverflow)?;
    
    // Finally divide by (seconds_per_day * precision)
    let denominator = 86400u128 * 10000u128; // 86400 seconds per day * 10000 basis points
    let rewards = numerator
        .checked_div(denominator)
        .ok_or(StakingError::ArithmeticOverflow)?;
    
    // Convert back to u64, checking for overflow
    Ok(u64::try_from(rewards).map_err(|_| StakingError::ArithmeticOverflow)?)
}