pragma solidity 0.5.8;

import '../AssetWithAmbi.sol';


contract AssetWithAmbiTestable is AssetWithAmbi {
    function testRole(uint _ret) public view onlyRole('tester') returns(uint) {
        return _ret;
    }

    modifier onlyProxy() {
        _;
    }
}
