/**
 * This software is a subject to Ambisafe License Agreement.
 * No use or distribution is allowed without written permission from Ambisafe.
 * https://www.ambisafe.co/terms-of-use/
 */

pragma solidity 0.4.8;

contract Ambi2EnabledFake {
    modifier onlyRole(bytes32 _role) {
        _;
    }
}
