use crate::constants::*;
use crate::errors::StakingError;
use crate::events::AddedToBlacklist;
use crate::state::{BlacklistEntry, GlobalState};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [STATE_SEED, state.staking_mint.as_ref()],
        bump = state.bump,
        has_one = admin
    )]
    pub state: Box<Account<'info, GlobalState>>,

    #[account(
        init,
        payer = admin,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [BLACKLIST_SEED, address.as_ref()],
        bump
    )]
    pub blacklist_entry: Box<Account<'info, BlacklistEntry>>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_blacklist_handler(ctx: Context<AddToBlacklist>, address: Pubkey) -> Result<()> {
    require!(
        address != Pubkey::default(),
        StakingError::CannotBlacklistZeroAddress
    );

    let blacklist_entry = &mut ctx.accounts.blacklist_entry;

    // Set data for the entry (init constraint ensures this is a new account)
    let clock = Clock::get()?;
    blacklist_entry.address = address;
    blacklist_entry.added_at = clock.unix_timestamp;
    blacklist_entry.bump = ctx.bumps.blacklist_entry;

    msg!("Added {} to blacklist", address);

    // Emit event
    emit!(AddedToBlacklist {
        address,
        admin: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
