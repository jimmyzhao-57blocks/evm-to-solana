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
        let rewards = calculate_rewards(
            user_stake.amount,
            user_stake.stake_timestamp,
            clock.unix_timestamp,
            state.reward_rate
        )?;
        
        if rewards > 0 {
            // Transfer rewards from reward vault to user
            let seeds = &[b"state".as_ref(), &[state.bump]];
            let signer = &[&seeds[..]];
            
            let cpi_accounts = Transfer {
                from: ctx.accounts.staking_vault.to_account_info(), // This should be reward_vault in real implementation
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: state.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let _cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            
            // Note: In real implementation, we'd transfer from reward_vault
            // For now, skipping actual reward transfer
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
    user_stake.stake_timestamp = clock.unix_timestamp;
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
    let duration = (end_timestamp - start_timestamp) as u64;
    let days = duration / 86400; // seconds per day
    
    // Calculate rewards: (amount * rate * days) / 10000
    let rewards = amount
        .checked_mul(reward_rate)
        .ok_or(StakingError::ArithmeticOverflow)?
        .checked_mul(days)
        .ok_or(StakingError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(StakingError::ArithmeticOverflow)?;
    
    Ok(rewards)
}