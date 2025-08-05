// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RestrictedStakingToken is ERC20, AccessControl, Ownable {
    // Role for managing blacklist
    bytes32 public constant BLACKLIST_ADMIN_ROLE = keccak256("BLACKLIST_ADMIN_ROLE");
    
    // Blacklist mapping
    mapping(address => bool) private _blacklist;
    
    // Events
    event AddedToBlacklist(address indexed account);
    event RemovedFromBlacklist(address indexed account);
    
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        // Grant the contract deployer the default admin role
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Grant the contract deployer the blacklist admin role
        _grantRole(BLACKLIST_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Check if an address is blacklisted
     */
    function isBlacklisted(address account) public view returns (bool) {
        return _blacklist[account];
    }
    
    /**
     * @dev Add an address to the blacklist
     */
    function addToBlacklist(address account) public onlyRole(BLACKLIST_ADMIN_ROLE) {
        require(account != address(0), "Cannot blacklist zero address");
        require(!_blacklist[account], "Address already blacklisted");
        
        _blacklist[account] = true;
        emit AddedToBlacklist(account);
    }
    
    /**
     * @dev Remove an address from the blacklist
     */
    function removeFromBlacklist(address account) public onlyRole(BLACKLIST_ADMIN_ROLE) {
        require(_blacklist[account], "Address not blacklisted");
        
        _blacklist[account] = false;
        emit RemovedFromBlacklist(account);
    }
    
    /**
     * @dev Add multiple addresses to the blacklist
     */
    function addToBlacklistBatch(address[] calldata accounts) external onlyRole(BLACKLIST_ADMIN_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != address(0) && !_blacklist[accounts[i]]) {
                addToBlacklist(accounts[i]);
            }
        }
    }
    
    /**
     * @dev Remove multiple addresses from the blacklist
     */
    function removeFromBlacklistBatch(address[] calldata accounts) external onlyRole(BLACKLIST_ADMIN_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (_blacklist[accounts[i]]) {
                removeFromBlacklist(accounts[i]);
            }
        }
    }
    
    /**
     * @dev Hook that is called before any transfer of tokens
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        require(!_blacklist[from], "Sender is blacklisted");
        require(!_blacklist[to], "Recipient is blacklisted");
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @dev Mint new tokens (only owner can mint)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(!_blacklist[to], "Cannot mint to blacklisted address");
        _mint(to, amount);
    }
}