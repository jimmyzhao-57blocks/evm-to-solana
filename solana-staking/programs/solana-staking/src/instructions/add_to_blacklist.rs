use anchor_lang::prelude::*;
use crate::state::{GlobalState, BlacklistEntry};
use crate::errors::StakingError;
use crate::events::AddedToBlacklist;

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"state"],
        bump = state.bump,
        has_one = admin
    )]
    pub state: Account<'info, GlobalState>,

    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [b"blacklist", address.as_ref()],
        bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_blacklist_handler(ctx: Context<AddToBlacklist>, address: Pubkey) -> Result<()> {
    require!(
        address != Pubkey::default(),
        StakingError::CannotBlacklistZeroAddress
    );

    let blacklist_entry = &mut ctx.accounts.blacklist_entry;
    
    // Check if address is already in blacklist
    require!(
        blacklist_entry.address == Pubkey::default(),
        StakingError::AddressAlreadyBlacklisted
    );
    
    // Only set data for new entries
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