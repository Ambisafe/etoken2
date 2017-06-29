/**
 * This software is a subject to Ambisafe License Agreement.
 * No use or distribution is allowed without written permission from Ambisafe.
 * https://www.ambisafe.co/terms-of-use/
 */

pragma solidity 0.4.8;

contract UserContract {
    address public target;
    bool public forwarding = false;

    function init(address _target) {
        target = _target;
    }

    function () payable {
        if (forwarding) {
          return;
        }
        forwarding = true;
        if (!target.call.value(msg.value)(msg.data)) {
            throw;
        }
        forwarding = false;
    }
}
