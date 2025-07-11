use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{GlobalState, UserStakeInfo};
use crate::instructions::stake::calculate_rewards;

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
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
        token::mint = state.reward_mint,
        token::authority = user
    )]
    pub user_reward_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"reward_vault", state.key().as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn claim_rewards_handler(ctx: Context<ClaimRewards>) -> Result<()> {
    let state = &ctx.accounts.state;
    let user_stake = &mut ctx.accounts.user_stake_info;
    let clock = &ctx.accounts.clock;
    
    let rewards = calculate_rewards(
        user_stake.amount,
        user_stake.stake_timestamp,
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
            .ok_or(crate::errors::StakingError::ArithmeticOverflow)?;
        user_stake.stake_timestamp = clock.unix_timestamp;
        
        msg!("User {} claimed {} rewards", ctx.accounts.user.key(), rewards);
    } else {
        msg!("No rewards to claim");
    }
    
    Ok(())
}