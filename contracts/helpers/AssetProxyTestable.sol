/**
 * This software is a subject to Ambisafe License Agreement.
 * No use or distribution is allowed without written permission from Ambisafe.
 * https://www.ambisafe.co/terms-of-use/
 */

pragma solidity 0.4.8;

import '../AssetProxy.sol';

contract AssetProxyTestable is AssetProxy {
    modifier onlyAssetOwner() {
        _;
    }
}
