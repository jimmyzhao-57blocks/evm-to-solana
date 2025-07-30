use anchor_lang::prelude::*;
use crate::state::{GlobalState, BlacklistEntry};
use crate::errors::StakingError;
use crate::events::RemovedFromBlacklist;

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"state"],
        bump = state.bump,
        has_one = admin
    )]
    pub state: Account<'info, GlobalState>,

    #[account(
        mut,
        close = admin,
        seeds = [b"blacklist", address.as_ref()],
        bump = blacklist_entry.bump,
        constraint = blacklist_entry.address == address @ StakingError::AddressNotBlacklisted
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn remove_from_blacklist_handler(ctx: Context<RemoveFromBlacklist>, address: Pubkey) -> Result<()> {
    let clock = Clock::get()?;
    
    msg!("Removed {} from blacklist", address);
    
    // Emit event
    emit!(RemovedFromBlacklist {
        address,
        admin: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}