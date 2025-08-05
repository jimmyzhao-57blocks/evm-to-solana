use crate::constants::*;
use crate::errors::StakingError;
use crate::state::{GlobalState, UserStakeInfo};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub fn claim_pending_rewards<'info>(
    state: &Account<'info, GlobalState>,
    user_stake: &mut Account<'info, UserStakeInfo>,
    reward_vault: &Account<'info, TokenAccount>,
    user_reward_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    clock: &Sysvar<'info, Clock>,
) -> Result<u64> {
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
        state.reward_rate,
    )?;
    
    msg!(
        "Calculating rewards: amount={}, last_claim={}, current_time={}, rate={}, rewards={}",
        user_stake.amount,
        last_claim,
        clock.unix_timestamp,
        state.reward_rate,
        rewards
    );

    if rewards > 0 {
        // Transfer rewards from reward vault to user
        let seeds = &[STATE_SEED.as_ref(), state.staking_mint.as_ref(), &[state.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: reward_vault.to_account_info(),
            to: user_reward_account.to_account_info(),
            authority: state.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, rewards)?;

        // Update user stake info
        user_stake.reward_debt = user_stake
            .reward_debt
            .checked_add(rewards)
            .ok_or(StakingError::ArithmeticOverflow)?;
        user_stake.last_claim_time = clock.unix_timestamp;
    }

    Ok(rewards)
}

pub fn calculate_rewards(
    amount: u64,
    start_timestamp: i64,
    end_timestamp: i64,
    reward_rate: u64,
) -> Result<u64> {
    let duration = (end_timestamp - start_timestamp) as u64; // duration in seconds
    
    msg!(
        "calculate_rewards: amount={}, start={}, end={}, duration={}, rate={}",
        amount,
        start_timestamp,
        end_timestamp,
        duration,
        reward_rate
    );

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
