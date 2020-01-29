pragma solidity 0.5.8;


contract UserContract {
    address public target;
    bool public forwarding = false;

    function init(address _target) public {
        target = _target;
    }

    function () external payable {
        if (forwarding) {
            return;
        }
        forwarding = true;
        (bool res, ) = target.call.value(msg.value)(msg.data);
        require(res);
        forwarding = false;
    }
}
