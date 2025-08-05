// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RestrictedStakingToken.sol";

contract MyToken is RestrictedStakingToken {
    constructor() RestrictedStakingToken("MyToken", "MTK") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
