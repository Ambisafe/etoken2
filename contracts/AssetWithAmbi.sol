pragma solidity 0.5.8;

import './Asset.sol';
import './Ambi2EnabledFull.sol';


contract AssetWithAmbi is Asset, Ambi2EnabledFull {
    modifier onlyRole(bytes32 _role) {
        if (address(ambi2) != address(0) && (ambi2.hasRole(address(this), _role, _sender()))) {
            _;
        }
    }
}
