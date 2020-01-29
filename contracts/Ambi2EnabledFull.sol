pragma solidity 0.5.8;

import './Ambi2Enabled.sol';


contract Ambi2EnabledFull is Ambi2Enabled {
    // Setup and claim atomically.
    function setupAmbi2(Ambi2 _ambi2) public returns(bool) {
        if (address(ambi2) != address(0)) {
            return false;
        }
        if (!_ambi2.claimFor(address(this), msg.sender) &&
            !_ambi2.isOwner(address(this), msg.sender)) {
            return false;
        }

        ambi2 = _ambi2;
        return true;
    }
}
