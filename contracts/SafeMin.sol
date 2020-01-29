pragma solidity 0.5.8;


contract SafeMin {
    modifier immutableAddr(address _address) {
        if (_address == address(0)) {
            _;
        }
    }

    function _safeFalse() internal returns(bool) {
        if (msg.value != 0) {
            _safeSend(msg.sender, msg.value);
        }
        return false;
    }

    function _safeSend(address _to, uint _value) internal {
        require(_unsafeSend(_to, _value));
    }

    function _unsafeSend(address _to, uint _value) internal returns(bool) {
        (bool res, ) = _to.call.value(_value)('');
        return res;
    }
}
