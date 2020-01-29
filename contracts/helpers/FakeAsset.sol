pragma solidity 0.5.8;


contract FakeAsset {
    mapping (address => uint) public balances;
    mapping (bytes32 => uint) public balancesICAP;
    mapping (address => mapping (address => uint)) public allowance;

    event Sent(address from, address to, uint amount, string ref);
    event SentICAP(address from, bytes32 icap, uint amount);

    function mint(address receiver, uint amount) public {
        balances[receiver] += amount;
    }

    function transfer(address _to, uint _value) public returns(bool) {
        return transferFromWithReference(msg.sender, _to, _value, '');
    }

    function transferFrom(address _from, address _to, uint _value) public returns(bool) {
        return transferFromWithReference(_from, _to, _value, '');
    }

    function transferToICAP(bytes32 _icap, uint _value) public returns(bool) {
        return transferFromToICAP(msg.sender, _icap, _value);
    }

    function transferFromToICAP(address _from, bytes32 _icap, uint _value) public returns(bool) {
        // allowance is ignoring because it contract only for testing
        require(balances[_from] >= _value);

        balances[_from] -= _value;
        balancesICAP[_icap] += _value;
        emit SentICAP(_from, _icap, _value);
        return true;
    }

    function transferFromWithReference(
        address _from,
        address _to,
        uint _value,
        string memory _reference)
        public returns(bool)
    {
        require(msg.sender == _from || allowance[_from][_to] >= _value);
        require(balances[_from] >= _value);

        balances[_from] -= _value;
        balances[_to] += _value;
        emit Sent(_from, _to, _value, _reference);
        return true;
    }

    function balanceOf(address _address) public view returns(uint) {
        return balances[_address];
    }

    function balanceOfICAP(bytes32 _icap) public view returns(uint) {
        return balancesICAP[_icap];
    }

    function balanceEth(address _address) public view returns(uint) {
        return _address.balance;
    }

    function approve(address _spender, uint _value) public returns(bool) {
        allowance[msg.sender][_spender] += _value;
        return true;
    }

    function() external payable {
        balances[msg.sender] += msg.value;
    }

    function deposit(address _to) public payable returns(bool) {
        balances[_to] += msg.value;
        return true;
    }
}
