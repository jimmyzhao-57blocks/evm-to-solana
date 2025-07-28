use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{GlobalState, UserStakeInfo};
use crate::errors::StakingError;
use crate::instructions::stake::calculate_rewards;

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump
    )]
    pub state: Account<'info, GlobalState>,
    
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = user_stake_info.bump
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
    pub clock: Sysvar<'info, Clock>,
}

pub fn unstake_handler(ctx: Context<Unstake>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::InvalidUnstakeAmount);
    
    let state = &mut ctx.accounts.state;
    let user_stake = &mut ctx.accounts.user_stake_info;
    let clock = &ctx.accounts.clock;
    
    require!(user_stake.amount >= amount, StakingError::InsufficientStakedAmount);
    
    // Calculate and transfer rewards from last claim time (or stake time if never claimed)
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
    
    // Transfer staking tokens back to user
    let seeds = &[b"state".as_ref(), &[state.bump]];
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
    user_stake.amount = user_stake.amount.checked_sub(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;
    // Update last claim time since rewards were just claimed
    user_stake.last_claim_time = clock.unix_timestamp;
    // Note: stake_timestamp remains unchanged
    
    // Update global state
    state.total_staked = state.total_staked.checked_sub(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;
    
    msg!("User {} unstaked {} tokens and received {} rewards", 
        ctx.accounts.user.key(), amount, rewards);
    
    Ok(())
}