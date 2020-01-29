pragma solidity 0.5.8;


// For testing purposes.
contract Listener {
    bytes public data;
    uint public value;
    address public sender;
    uint public calls;

    function () external payable {
        data = msg.data;
        value = msg.value;
        sender = msg.sender;
        calls++;
    }
}
