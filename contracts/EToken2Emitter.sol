pragma solidity 0.5.8;

import './EventsHistory.sol';


/**
 * @title EToken2 Emitter.
 *
 * Contains all the original event emitting function definitions and events.
 * In case of new events needed later, additional emitters can be developed.
 * All the functions is meant to be called using delegatecall.
 */
contract EToken2Emitter {

    event Transfer(
        address indexed from,
        address indexed to,
        bytes32 indexed symbol,
        uint value,
        string ref,
        uint version);

    event TransferToICAP(
        address indexed from,
        address indexed to,
        bytes32 indexed icap,
        uint value,
        string ref,
        uint version);

    event Issue(bytes32 indexed symbol, uint value, address by, uint version);
    event Revoke(bytes32 indexed symbol, uint value, address by, uint version);

    event OwnershipChange(
        address indexed from,
        address indexed to,
        bytes32 indexed symbol,
        uint version);

    event Approve(
        address indexed from,
        address indexed spender,
        bytes32 indexed symbol,
        uint value,
        uint version);

    event Error(bytes32 message, uint version);
    event Change(bytes32 indexed symbol, uint version);
    
    function emitTransfer(
        address _from,
        address _to,
        bytes32 _symbol,
        uint _value,
        string memory _reference)
    public {
        emit Transfer(_from, _to, _symbol, _value, _reference, _getVersion());
    }

    function emitTransferToICAP(
        address _from, address _to, bytes32 _icap, uint _value, string memory _reference)
    public {
        emit TransferToICAP(_from, _to, _icap, _value, _reference, _getVersion());
    }

    function emitIssue(bytes32 _symbol, uint _value, address _by) public {
        emit Issue(_symbol, _value, _by, _getVersion());
    }

    function emitRevoke(bytes32 _symbol, uint _value, address _by) public {
        emit Revoke(_symbol, _value, _by, _getVersion());
    }

    function emitOwnershipChange(address _from, address _to, bytes32 _symbol) public {
        emit OwnershipChange(_from, _to, _symbol, _getVersion());
    }

    function emitApprove(address _from, address _spender, bytes32 _symbol, uint _value) public {
        emit Approve(_from, _spender, _symbol, _value, _getVersion());
    }

    function emitError(bytes32 _message) public {
        emit Error(_message, _getVersion());
    }

    function emitChange(bytes32 _symbol) public {
        emit Change(_symbol, _getVersion());
    }

    /**
     * Get version number of the caller.
     *
     * Assuming that the call is made by EventsHistory using delegate call,
     * context was not changed, so the caller is the address that called
     * EventsHistory.
     *
     * @return current context caller version number.
     */
    function _getVersion() internal view returns(uint) {
        return EventsHistory(address(this)).versions(msg.sender);
    }
}
