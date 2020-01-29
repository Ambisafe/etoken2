pragma solidity 0.5.8;

import './Ambi2EnabledFull.sol';
import './EToken2Interface.sol';


contract Emitter {

    function emitTransfer(
        address _from,
        address _to,
        bytes32 _symbol,
        uint _value,
        string memory _reference)
    public;

    function emitTransferToICAP(
        address _from,
        address _to,
        bytes32 _icap,
        uint _value,
        string memory _reference)
    public;

    function emitIssue(bytes32 _symbol, uint _value, address _by) public;
    function emitRevoke(bytes32 _symbol, uint _value, address _by) public;
    function emitOwnershipChange(address _from, address _to, bytes32 _symbol) public;
    function emitApprove(address _from, address _spender, bytes32 _symbol, uint _value) public;
    function emitError(bytes32 _message) public;
    function emitChange(bytes32 _symbol) public;
}


contract Proxy {
    function emitTransfer(address _from, address _to, uint _value) public;
    function emitApprove(address _from, address _spender, uint _value) public;
}


/**
 * @title EToken2.
 *
 * The official Ambisafe assets platform powering all kinds of tokens.
 * EToken2 uses EventsHistory contract to keep events, so that in case it needs to be redeployed
 * at some point, all the events keep appearing at the same place.
 *
 * Every asset is meant to be used through a proxy contract. Only one proxy contract have access
 * rights for a particular asset.
 *
 * Features: assets issuance, transfers, allowances, supply adjustments, ICAP.
 *
 * Note: all the non constant functions return false instead of throwing in case if state change
 * didn't happen yet.
 */
contract EToken2 is Ambi2EnabledFull {
    // Structure of a particular asset.
    struct Asset {
        uint owner;                       // Asset's owner id.
        uint totalSupply;                 // Asset's total supply.
        string name;                      // Asset's name, for information purposes.
        string description;               // Asset's description, for information purposes.
        bool isReissuable;                // Indicates if asset have dynamic of fixed supply.
        uint8 baseUnit;                   // Proposed number of decimals.
        bool isLocked;                    // Are changes still allowed.
        mapping(uint => Wallet) wallets;  // Holders wallets.
    }

    // Structure of an asset holder wallet for particular asset.
    struct Wallet {
        uint balance;
        mapping(uint => uint) allowance;
    }

    // Iterable mapping pattern is used for holders.
    uint public holdersCount;
    mapping(uint => address) public holders;

    // This is an access address mapping. Many addresses may have access to a single holder.
    mapping(address => uint) public holderIndex;

    // Asset symbol to asset mapping.
    mapping(bytes32 => Asset) public assets;

    // Asset symbol to asset proxy mapping.
    mapping(bytes32 => address) public proxies;

    // ICAP registry contract.
    RegistryICAPInterface public registryICAP;

    // Should use interface of the emitter, but address of events history.
    Emitter public eventsHistory;

    /**
     * Emits Error event with specified error message.
     *
     * Should only be used if no state changes happened.
     *
     * @param _message error message.
     */
    function _error(bytes32 _message) internal {
        eventsHistory.emitError(_message);
    }

    /**
     * Sets EventsHstory contract address.
     *
     * Can be set only once, and only by contract owner.
     *
     * @param _eventsHistory EventsHistory contract address.
     *
     * @return success.
     */
    function setupEventsHistory(Emitter _eventsHistory) public onlyRole('setup') returns(bool) {
        if (address(eventsHistory) != address(0)) {
            return false;
        }
        eventsHistory = _eventsHistory;
        return true;
    }

    /**
     * Sets RegistryICAP contract address.
     *
     * Can be set only once, and only by contract owner.
     *
     * @param _registryICAP RegistryICAP contract address.
     *
     * @return success.
     */
    function setupRegistryICAP(RegistryICAPInterface _registryICAP)
    public onlyRole('setup') returns(bool) {
        if (address(registryICAP) != address(0)) {
            return false;
        }
        registryICAP = _registryICAP;
        return true;
    }

    /**
     * Emits Error if called not by asset owner.
     */
    modifier onlyOwner(bytes32 _symbol) {
        if (isOwner(msg.sender, _symbol)) {
            _;
        } else {
            _error('Only owner: access denied');
        }
    }

    /**
     * Emits Error if called not by asset proxy.
     */
    modifier onlyProxy(bytes32 _symbol) {
        if (_isProxy(_symbol)) {
            _;
        } else {
            _error('Only proxy: access denied');
        }
    }

    /**
     * Check asset existance.
     *
     * @param _symbol asset symbol.
     *
     * @return asset existance.
     */
    function isCreated(bytes32 _symbol) public view returns(bool) {
        return assets[_symbol].owner != 0;
    }

    function isLocked(bytes32 _symbol) public view returns(bool) {
        return assets[_symbol].isLocked;
    }

    /**
     * Returns asset decimals.
     *
     * @param _symbol asset symbol.
     *
     * @return asset decimals.
     */
    function baseUnit(bytes32 _symbol) public view returns(uint8) {
        return assets[_symbol].baseUnit;
    }

    /**
     * Returns asset name.
     *
     * @param _symbol asset symbol.
     *
     * @return asset name.
     */
    function name(bytes32 _symbol) public view returns(string memory ) {
        return assets[_symbol].name;
    }

    /**
     * Returns asset description.
     *
     * @param _symbol asset symbol.
     *
     * @return asset description.
     */
    function description(bytes32 _symbol) public view returns(string memory ) {
        return assets[_symbol].description;
    }

    /**
     * Returns asset reissuability.
     *
     * @param _symbol asset symbol.
     *
     * @return asset reissuability.
     */
    function isReissuable(bytes32 _symbol) public view returns(bool) {
        return assets[_symbol].isReissuable;
    }

    /**
     * Returns asset owner address.
     *
     * @param _symbol asset symbol.
     *
     * @return asset owner address.
     */
    function owner(bytes32 _symbol) public view returns(address) {
        return holders[assets[_symbol].owner];
    }

    /**
     * Check if specified address has asset owner rights.
     *
     * @param _owner address to check.
     * @param _symbol asset symbol.
     *
     * @return owner rights availability.
     */
    function isOwner(address _owner, bytes32 _symbol) public view returns(bool) {
        return isCreated(_symbol) && (assets[_symbol].owner == getHolderId(_owner));
    }

    /**
     * Returns asset total supply.
     *
     * @param _symbol asset symbol.
     *
     * @return asset total supply.
     */
    function totalSupply(bytes32 _symbol) public view returns(uint) {
        return assets[_symbol].totalSupply;
    }

    /**
     * Returns asset balance for current address of a particular holder.
     *
     * @param _holder holder address.
     * @param _symbol asset symbol.
     *
     * @return holder balance.
     */
    function balanceOf(address _holder, bytes32 _symbol) public view returns(uint) {
        uint holderId = getHolderId(_holder);
        return holders[holderId] == _holder ? _balanceOf(holderId, _symbol) : 0;
    }

    /**
     * Returns asset balance for a particular holder id.
     *
     * @param _holderId holder id.
     * @param _symbol asset symbol.
     *
     * @return holder balance.
     */
    function _balanceOf(uint _holderId, bytes32 _symbol) internal view returns(uint) {
        return assets[_symbol].wallets[_holderId].balance;
    }

    /**
     * Returns current address for a particular holder id.
     *
     * @param _holderId holder id.
     *
     * @return holder address.
     */
    function _getAddress(uint _holderId) internal view returns(address) {
        return holders[_holderId];
    }

    function _isProxy(bytes32 _symbol) internal view returns(bool) {
        return proxies[_symbol] == msg.sender;
    }

    /**
     * Sets Proxy contract address for a particular asset.
     *
     * Can be set only once for each asset, and only by contract owner.
     *
     * @param _address Proxy contract address.
     * @param _symbol asset symbol.
     *
     * @return success.
     */
    function setProxy(address _address, bytes32 _symbol) public onlyOwner(_symbol) returns(bool) {
        if (proxies[_symbol] != address(0) && assets[_symbol].isLocked) {
            return false;
        }
        proxies[_symbol] = _address;
        return true;
    }

    /**
     * Transfers asset balance between holders wallets.
     *
     * @param _fromId holder id to take from.
     * @param _toId holder id to give to.
     * @param _value amount to transfer.
     * @param _symbol asset symbol.
     */
    function _transferDirect(uint _fromId, uint _toId, uint _value, bytes32 _symbol) internal {
        assets[_symbol].wallets[_fromId].balance -= _value;
        assets[_symbol].wallets[_toId].balance += _value;
    }

    /**
     * Transfers asset balance between holders wallets.
     *
     * Performs sanity checks and takes care of allowances adjustment.
     *
     * @param _fromId holder id to take from.
     * @param _toId holder id to give to.
     * @param _value amount to transfer.
     * @param _symbol asset symbol.
     * @param _reference transfer comment to be included in a Transfer event.
     * @param _senderId transfer initiator holder id.
     *
     * @return success.
     */
    function _transfer(
        uint _fromId,
        uint _toId,
        uint _value,
        bytes32 _symbol,
        string memory _reference,
        uint _senderId)
    internal returns(bool) {
        // Should not allow to send to oneself.
        if (_fromId == _toId) {
            _error('Cannot send to oneself');
            return false;
        }
        // Should have positive value.
        if (_value == 0) {
            _error('Cannot send 0 value');
            return false;
        }
        // Should have enough balance.
        if (_balanceOf(_fromId, _symbol) < _value) {
            _error('Insufficient balance');
            return false;
        }
        // Should have enough allowance.
        if (_fromId != _senderId && _allowance(_fromId, _senderId, _symbol) < _value) {
            _error('Not enough allowance');
            return false;
        }
        // Adjust allowance.
        if (_fromId != _senderId) {
            assets[_symbol].wallets[_fromId].allowance[_senderId] -= _value;
        }
        _transferDirect(_fromId, _toId, _value, _symbol);
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        eventsHistory.emitTransfer(
            _getAddress(_fromId), _getAddress(_toId), _symbol, _value, _reference);
        _proxyTransferEvent(_fromId, _toId, _value, _symbol);
        return true;
    }

    // Proxy check done internally due to unknown symbol when the function is called.
    function _transferToICAP(
        uint _fromId,
        bytes32 _icap,
        uint _value,
        string memory _reference,
        uint _senderId)
    internal returns(bool) {
        address to;
        bytes32 symbol;
        bool success;
        (to, symbol, success) = registryICAP.parse(_icap);
        if (!success) {
            _error('ICAP is not registered');
            return false;
        }
        if (!_isProxy(symbol)) {
            _error('Only proxy: access denied');
            return false;
        }
        uint toId = _createHolderId(to);
        if (!_transfer(_fromId, toId, _value, symbol, _reference, _senderId)) {
            return false;
        }
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        eventsHistory.emitTransferToICAP(
            _getAddress(_fromId), _getAddress(toId), _icap, _value, _reference);
        return true;
    }

    function proxyTransferFromToICAPWithReference(
        address _from,
        bytes32 _icap,
        uint _value,
        string memory _reference,
        address _sender)
    public returns(bool) {
        return _transferToICAP(getHolderId(_from), _icap, _value, _reference, getHolderId(_sender));
    }

    /**
     * Ask asset Proxy contract to emit ERC20 compliant Transfer event.
     *
     * @param _fromId holder id to take from.
     * @param _toId holder id to give to.
     * @param _value amount to transfer.
     * @param _symbol asset symbol.
     */
    function _proxyTransferEvent(uint _fromId, uint _toId, uint _value, bytes32 _symbol) internal {
        if (proxies[_symbol] != address(0)) {
            // Internal Out Of Gas/Throw: revert this transaction too;
            // Recursive Call: safe, all changes already made.
            Proxy(proxies[_symbol]).emitTransfer(_getAddress(_fromId), _getAddress(_toId), _value);
        }
    }

    /**
     * Returns holder id for the specified address.
     *
     * @param _holder holder address.
     *
     * @return holder id.
     */
    function getHolderId(address _holder) public view returns(uint) {
        return holderIndex[_holder];
    }

    /**
     * Returns holder id for the specified address, creates it if needed.
     *
     * @param _holder holder address.
     *
     * @return holder id.
     */
    function _createHolderId(address _holder) internal returns(uint) {
        uint holderId = holderIndex[_holder];
        if (holderId == 0) {
            holderId = ++holdersCount;
            holders[holderId] = _holder;
            holderIndex[_holder] = holderId;
        }
        return holderId;
    }

    /**
     * Issues new asset token on the platform.
     *
     * Tokens issued with this call go straight to contract owner.
     * Each symbol can be issued only once, and only by contract owner.
     *
     * _isReissuable is included in checkEnabledSwitch because it should be
     * explicitly allowed before issuing new asset.
     *
     * @param _symbol asset symbol.
     * @param _value amount of tokens to issue immediately.
     * @param _name name of the asset.
     * @param _description description for the asset.
     * @param _baseUnit number of decimals.
     * @param _isReissuable dynamic or fixed supply.
     *
     * @return success.
     */
    function issueAsset(
        bytes32 _symbol,
        uint _value,
        string memory _name,
        string memory _description,
        uint8 _baseUnit,
        bool _isReissuable)
    public onlyRole('issuance') returns(bool) {
        // Should have positive value if supply is going to be fixed.
        if (_value == 0 && !_isReissuable) {
            _error('Cannot issue 0 value fixed asset');
            return false;
        }
        // Should not be issued yet.
        if (isCreated(_symbol)) {
            _error('Asset already issued');
            return false;
        }
        uint holderId = _createHolderId(msg.sender);

        assets[_symbol] = Asset(
            holderId, _value, _name, _description, _isReissuable, _baseUnit, false);
        assets[_symbol].wallets[holderId].balance = _value;
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        eventsHistory.emitIssue(_symbol, _value, _getAddress(holderId));
        return true;
    }

    function changeAsset(
        bytes32 _symbol,
        string memory _name,
        string memory _description,
        uint8 _baseUnit)
    public onlyOwner(_symbol) returns(bool) {
        if (isLocked(_symbol)) {
            _error('Asset is locked');
            return false;
        }
        assets[_symbol].name = _name;
        assets[_symbol].description = _description;
        assets[_symbol].baseUnit = _baseUnit;
        eventsHistory.emitChange(_symbol);
        return true;
    }

    function lockAsset(bytes32 _symbol) public onlyOwner(_symbol) returns(bool) {
        if (isLocked(_symbol)) {
            _error('Asset is locked');
            return false;
        }
        assets[_symbol].isLocked = true;
        return true;
    }

    /**
     * Issues additional asset tokens if the asset have dynamic supply.
     *
     * Tokens issued with this call go straight to asset owner.
     * Can only be called by asset owner.
     *
     * @param _symbol asset symbol.
     * @param _value amount of additional tokens to issue.
     *
     * @return success.
     */
    function reissueAsset(bytes32 _symbol, uint _value) public onlyOwner(_symbol) returns(bool) {
        // Should have positive value.
        if (_value == 0) {
            _error('Cannot reissue 0 value');
            return false;
        }
        Asset storage asset = assets[_symbol];
        // Should have dynamic supply.
        if (!asset.isReissuable) {
            _error('Cannot reissue fixed asset');
            return false;
        }
        // Resulting total supply should not overflow.
        if (asset.totalSupply + _value < asset.totalSupply) {
            _error('Total supply overflow');
            return false;
        }
        uint holderId = getHolderId(msg.sender);
        asset.wallets[holderId].balance += _value;
        asset.totalSupply += _value;
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        eventsHistory.emitIssue(_symbol, _value, _getAddress(holderId));
        _proxyTransferEvent(0, holderId, _value, _symbol);
        return true;
    }

    /**
     * Destroys specified amount of senders asset tokens.
     *
     * @param _symbol asset symbol.
     * @param _value amount of tokens to destroy.
     *
     * @return success.
     */
    function revokeAsset(bytes32 _symbol, uint _value) public returns(bool) {
        // Should have positive value.
        if (_value == 0) {
            _error('Cannot revoke 0 value');
            return false;
        }
        Asset storage asset = assets[_symbol];
        uint holderId = getHolderId(msg.sender);
        // Should have enough tokens.
        if (asset.wallets[holderId].balance < _value) {
            _error('Not enough tokens to revoke');
            return false;
        }
        asset.wallets[holderId].balance -= _value;
        asset.totalSupply -= _value;
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        eventsHistory.emitRevoke(_symbol, _value, _getAddress(holderId));
        _proxyTransferEvent(holderId, 0, _value, _symbol);
        return true;
    }

    /**
     * Passes asset ownership to specified address.
     *
     * Only ownership is changed, balances are not touched.
     * Can only be called by asset owner.
     *
     * @param _symbol asset symbol.
     * @param _newOwner address to become a new owner.
     *
     * @return success.
     */
    function changeOwnership(bytes32 _symbol, address _newOwner)
    public onlyOwner(_symbol) returns(bool) {
        Asset storage asset = assets[_symbol];
        uint newOwnerId = _createHolderId(_newOwner);
        // Should pass ownership to another holder.
        if (asset.owner == newOwnerId) {
            _error('Cannot pass ownership to oneself');
            return false;
        }
        address oldOwner = _getAddress(asset.owner);
        asset.owner = newOwnerId;
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        eventsHistory.emitOwnershipChange(oldOwner, _getAddress(newOwnerId), _symbol);
        return true;
    }

    /**
     * Sets asset spending allowance for a specified spender.
     *
     * Note: to revoke allowance, one needs to set allowance to 0.
     *
     * @param _spenderId holder id to set allowance for.
     * @param _value amount to allow.
     * @param _symbol asset symbol.
     * @param _senderId approve initiator holder id.
     *
     * @return success.
     */
    function _approve(
        uint _spenderId,
        uint _value,
        bytes32 _symbol,
        uint _senderId)
    internal returns(bool) {
        // Asset should exist.
        if (!isCreated(_symbol)) {
            _error('Asset is not issued');
            return false;
        }
        // Should allow to another holder.
        if (_senderId == _spenderId) {
            _error('Cannot approve to oneself');
            return false;
        }
        assets[_symbol].wallets[_senderId].allowance[_spenderId] = _value;
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        eventsHistory.emitApprove(_getAddress(_senderId), _getAddress(_spenderId), _symbol, _value);
        if (proxies[_symbol] != address(0)) {
            // Internal Out Of Gas/Throw: revert this transaction too;
            // Recursive Call: safe, all changes already made.
            Proxy(proxies[_symbol]).emitApprove(
                _getAddress(_senderId), _getAddress(_spenderId), _value);
        }
        return true;
    }

    /**
     * Sets asset spending allowance for a specified spender.
     *
     * Can only be called by asset proxy.
     *
     * @param _spender holder address to set allowance to.
     * @param _value amount to allow.
     * @param _symbol asset symbol.
     * @param _sender approve initiator address.
     *
     * @return success.
     */
    function proxyApprove(
        address _spender,
        uint _value,
        bytes32 _symbol,
        address _sender)
    public onlyProxy(_symbol) returns(bool) {
        return _approve(_createHolderId(_spender), _value, _symbol, _createHolderId(_sender));
    }

    /**
     * Returns asset allowance from one holder to another.
     *
     * @param _from holder that allowed spending.
     * @param _spender holder that is allowed to spend.
     * @param _symbol asset symbol.
     *
     * @return holder to spender allowance.
     */
    function allowance(address _from, address _spender, bytes32 _symbol) public view returns(uint) {
        return _allowance(getHolderId(_from), getHolderId(_spender), _symbol);
    }

    /**
     * Returns asset allowance from one holder to another.
     *
     * @param _fromId holder id that allowed spending.
     * @param _toId holder id that is allowed to spend.
     * @param _symbol asset symbol.
     *
     * @return holder to spender allowance.
     */
    function _allowance(uint _fromId, uint _toId, bytes32 _symbol) internal view returns(uint) {
        return assets[_symbol].wallets[_fromId].allowance[_toId];
    }

    /**
     * Prforms allowance transfer of asset balance between holders wallets.
     *
     * Can only be called by asset proxy.
     *
     * @param _from holder address to take from.
     * @param _to holder address to give to.
     * @param _value amount to transfer.
     * @param _symbol asset symbol.
     * @param _reference transfer comment to be included in a Transfer event.
     * @param _sender allowance transfer initiator address.
     *
     * @return success.
     */
    function proxyTransferFromWithReference(
        address _from,
        address _to,
        uint _value,
        bytes32 _symbol,
        string memory _reference,
        address _sender)
    public onlyProxy(_symbol) returns(bool) {
        return _transfer(
            getHolderId(_from),
            _createHolderId(_to),
            _value,
            _symbol,
            _reference,
            getHolderId(_sender));
    }
}
