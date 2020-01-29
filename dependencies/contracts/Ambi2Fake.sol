pragma solidity 0.5.8;


contract Ambi2Fake {
    mapping(address => mapping(bytes32 => mapping(address => bool))) public allowed;

    function claimFor(address, address) public pure returns(bool) {
        return true;
    }

    function hasRole(address _from, bytes32 _role, address _to) public view returns(bool) {
        return allowed[_from][_role][_to];
    }
    
    function setAllowed(address _from, bytes32 _role, address _to) public {
        allowed[_from][_role][_to] = true;
    }
}
