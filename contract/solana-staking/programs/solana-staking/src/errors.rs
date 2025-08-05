use anchor_lang::prelude::*;

#[error_code]
pub enum StakingError {
    #[msg("Cannot stake 0 tokens")]
    InvalidStakeAmount,

    #[msg("Cannot unstake 0 tokens")]
    InvalidUnstakeAmount,

    #[msg("Insufficient staked amount")]
    InsufficientStakedAmount,

    #[msg("Invalid reward rate")]
    InvalidRewardRate,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Address is blacklisted")]
    AddressBlacklisted,

    #[msg("Address not found in blacklist")]
    AddressNotBlacklisted,

    #[msg("Cannot blacklist zero address")]
    CannotBlacklistZeroAddress,

    #[msg("Address is already in blacklist")]
    AddressAlreadyBlacklisted,
}
