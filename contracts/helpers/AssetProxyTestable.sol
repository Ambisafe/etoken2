pragma solidity 0.5.8;

import '../AssetProxy.sol';


contract AssetProxyTestable is AssetProxy {
    modifier onlyAssetOwner() {
        _;
    }
}
