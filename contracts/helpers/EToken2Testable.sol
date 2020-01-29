pragma solidity 0.5.8;

import '../EToken2.sol';
import '../../dependencies/contracts/Ambi2EnabledFake.sol';


// For testing purposes.
contract EToken2Testable is EToken2, Ambi2EnabledFake {
    bool public __proxyCheck;

    function _isProxy(bytes32 _symbol) internal view returns(bool) {
        return __proxyCheck ? super._isProxy(_symbol) : true;
    }

    function __enableProxyCheck() public {
        __proxyCheck = true;
    }

    function transfer(address _to, uint _value, bytes32 _symbol) public returns(bool) {
        return transferWithReference(_to, _value, _symbol, '');
    }

    function transferWithReference(
        address _to,
        uint _value,
        bytes32 _symbol,
        string memory _reference)
        public returns(bool)
    {
        return _transfer(getHolderId(msg.sender), _createHolderId(_to), _value,
            _symbol, _reference, getHolderId(msg.sender));
    }

    function approve(address _spender, uint _value, bytes32 _symbol) public returns(bool) {
        return _approve(_createHolderId(_spender), _value, _symbol, _createHolderId(msg.sender));
    }

    function transferFrom(address _from, address _to, uint _value, bytes32 _symbol)
    public returns(bool) {
        return transferFromWithReference(_from, _to, _value, _symbol, '');
    }

    function transferFromWithReference(address _from, address _to, uint _value,
        bytes32 _symbol, string memory _reference)
    public returns(bool) {
        return _transfer(getHolderId(_from), _createHolderId(_to), _value,
            _symbol, _reference, getHolderId(msg.sender));
    }

    function transferToICAP(bytes32 _icap, uint _value) public returns(bool) {
        return transferToICAPWithReference(_icap, _value, '');
    }

    function transferToICAPWithReference(bytes32 _icap, uint _value, string memory _reference)
    public returns(bool) {
        return _transferToICAP(getHolderId(msg.sender),
            _icap, _value, _reference, getHolderId(msg.sender));
    }

    function transferFromToICAP(address _from, bytes32 _icap, uint _value) public returns(bool) {
        return transferFromToICAPWithReference(_from, _icap, _value, '');
    }

    function transferFromToICAPWithReference(address _from, bytes32 _icap,
        uint _value, string memory _reference)
    public returns(bool) {
        return _transferToICAP(getHolderId(_from), _icap, _value,
            _reference, getHolderId(msg.sender));
    }
}
