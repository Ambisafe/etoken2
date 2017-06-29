/**
 * This software is a subject to Ambisafe License Agreement.
 * No use or distribution is allowed without written permission from Ambisafe.
 * https://www.ambisafe.co/terms-of-use/
 */

pragma solidity 0.4.8;

// For testing purposes.
contract Listener {
    bytes public data;
    uint public value;
    address public sender;
    uint public calls;

    function () payable {
        data = msg.data;
        value = msg.value;
        sender = msg.sender;
        calls++;
    }
}
