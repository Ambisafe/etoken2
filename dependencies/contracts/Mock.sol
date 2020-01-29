pragma solidity 0.5.8;

import './ReturnData.sol';

/**
 * @title Mock
 *
 * This contract serves to simplify contract testing.
 *
 * When some contract makes call to another contract
 * and it's no need to check does the other contract works right
 * this contract allows to simulate an external call and to set what this call will return
 * and it allows to test a functionality only the first one contract.
 */

contract Mock is ReturnData {
    byte constant public REVERT_FLAG = 0xff;

    event UnexpectedCall(uint index, address from, uint value, bytes input, bytes32 callHash);
    event Event();

    struct Expect {
        bytes32 callHash;
        bytes callReturn;
    }

    uint public expectationsCount;
    uint public nextExpectation = 1;
    uint public callsCount;
    mapping(uint => Expect) public expectations;
    mapping(uint => mapping(bytes32 => bytes)) public expectationsStatic;
    mapping(bytes4 => bool) public ignores;
    mapping(address => mapping(bytes4 => bool)) public ignoresFrom;
    mapping(address => bool) public ignoresAllFrom;
    bool public revertAllCalls;

    function () external payable {
        if (revertAllCalls) {
            revert('This is Mock');
        }
        if (msg.data.length == 1 && msg.data[0] == REVERT_FLAG) {
            revert('This is Mock');
        }
        if (ignores[msg.sig] || ignoresAllFrom[msg.sender] || ignoresFrom[msg.sender][msg.sig]) {
            returnBool(true);
        }

        bytes32 callHash = keccak256(abi.encodePacked(msg.sender, msg.value, msg.data));

        if (expectationsStatic[nextExpectation][callHash].length > 0) {
            returnBytes(expectationsStatic[nextExpectation][callHash]);
        } 

        callsCount++;
        
        if (expectations[nextExpectation].callHash != callHash) {
            emit UnexpectedCall(nextExpectation, msg.sender, msg.value, msg.data, callHash);
            returnBool(false);
        }
        returnBytes(expectations[nextExpectation++].callReturn);
    }

    function ignore(bytes4 _sig, bool _enabled) public {
        ignores[_sig] = _enabled;
    }

    function ignoreFrom(address _from, bytes4 _sig, bool _enabled) public {
        ignoresFrom[_from][_sig] = _enabled;
    }

    function ignoreAllFrom(address _from, bool _enabled) public {
        ignoresAllFrom[_from] = _enabled;
    }

    function setRevertAllCalls(bool _enabled) public {
        revertAllCalls = _enabled;
    }

    function expect(address _from, uint _value, bytes memory _input, bytes memory _return) public {
        expectations[++expectationsCount] = Expect(
            keccak256(abi.encodePacked(_from, _value, _input)), _return);
    }

    function expectStaticCall(address _from, uint _value, bytes memory _input, bytes memory _return)
        public
    {
        expectationsStatic[expectationsCount + 1]
            [keccak256(abi.encodePacked(_from, _value, _input))] = _return;
    }

    function forward(address _to, bytes memory _input) public payable {
        _returnReturnData(_assemblyCall(_to, msg.value, _input));
    }

    function assertExpectations() public view {
        require(expectationsLeft() == 0 && callsCount == expectationsCount);
    }

    function expectationsLeft() public view returns(uint) {
        return expectationsCount - (nextExpectation - 1);
    }

    function resetCallsCount() public returns(bool) {
        callsCount = 0;
    }

    function returnBool(bool _result) public pure returns(bool) {
        uint result = _result ? 1 : 0;
        assembly {
            mstore(0, result)
            return(0, 32)
        }
    }

    function returnBytes(bytes memory _result) public pure returns(bytes memory) {
        assembly {
            return(add(_result, 32), mload(_result))
        }
    }

    function emitEvent() public returns(bool) {
        emit Event();
        return true;
    }
}
