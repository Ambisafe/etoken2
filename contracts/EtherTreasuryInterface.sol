pragma solidity 0.5.8;


contract EtherTreasuryInterface {
    function withdraw(address _to, uint _value) public returns(bool);

    function withdrawWithReference(address _to, uint _value, string memory _reference)
    public returns(bool);
}
