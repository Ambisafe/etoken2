pragma solidity 0.5.8;


// Fake.
contract Ambi2EnabledFake {
    modifier onlyRole(bytes32 _role) {
        _;
    }
}
