use crate::events::Initialized;
use crate::state::GlobalState;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, GlobalState>,

    pub staking_mint: Account<'info, Mint>,
    pub reward_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        token::mint = staking_mint,
        token::authority = state,
        seeds = [b"staking_vault", state.key().as_ref()],
        bump
    )]
    pub staking_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = admin,
        token::mint = reward_mint,
        token::authority = state,
        seeds = [b"reward_vault", state.key().as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn initialize_handler(ctx: Context<Initialize>, reward_rate: u64) -> Result<()> {
    require!(
        reward_rate > 0 && reward_rate <= 1000,
        crate::errors::StakingError::InvalidRewardRate
    );

    let state = &mut ctx.accounts.state;

    state.admin = ctx.accounts.admin.key();
    state.staking_mint = ctx.accounts.staking_mint.key();
    state.reward_mint = ctx.accounts.reward_mint.key();
    state.staking_vault = ctx.accounts.staking_vault.key();
    state.reward_vault = ctx.accounts.reward_vault.key();
    state.reward_rate = reward_rate;
    state.total_staked = 0;
    state.bump = ctx.bumps.state;

    msg!(
        "Staking program initialized with reward rate: {}%",
        reward_rate as f64 / 100.0
    );

    // Emit initialized event
    emit!(Initialized {
        authority: ctx.accounts.admin.key(),
        staking_mint: ctx.accounts.staking_mint.key(),
        reward_mint: ctx.accounts.reward_mint.key(),
        reward_rate,
        timestamp: ctx.accounts.clock.unix_timestamp,
    });

    Ok(())
}
