pragma solidity 0.5.8;

import './Ambi2EnabledFull.sol';
import './SafeMin.sol';


contract RegistryICAP is Ambi2EnabledFull, SafeMin {
    function decodeIndirect(bytes memory _bban)
        public pure returns(string memory, string memory, string memory)
    {
        bytes memory asset = new bytes(3);
        bytes memory institution = new bytes(4);
        bytes memory client = new bytes(9);

        uint8 k = 0;

        for (uint8 i = 0; i < asset.length; i++) {
            asset[i] = _bban[k++];
        }
        for (uint8 i = 0; i < institution.length; i++) {
            institution[i] = _bban[k++];
        }
        for (uint8 i = 0; i < client.length; i++) {
            client[i] = _bban[k++];
        }
        return (string(asset), string(institution), string(client));
    }

    function parse(bytes32 _icap) public view returns(address, bytes32, bool) {
        // Should start with XE.
        if (_icap[0] != 'X' || _icap[1] != 'E') {
            return (address(0), bytes32(0), false);
        }
        // Should have 12 zero bytes at the end.
        for (uint8 j = 20; j < 32; j++) {
            if (_icap[j] != 0) {
                return (address(0), bytes32(0), false);
            }
        }
        bytes memory bban = new bytes(18);
        for (uint8 i = 0; i < 16; i++) {
            bban[i] = _icap[i + 4];
        }
        string memory asset;
        string memory institution;
        (asset, institution, ) = decodeIndirect(bban);

        bytes32 assetInstitutionHash = keccak256(abi.encodePacked(asset, institution));

        uint8 parseChecksum = (uint8(_icap[2]) - 48) * 10 + (uint8(_icap[3]) - 48);
        uint8 calcChecksum = 98 - mod9710(prepare(bban));
        if (parseChecksum != calcChecksum) {
            return (institutions[assetInstitutionHash],
                assets[keccak256(abi.encodePacked(asset))],
                false);
        }
        return (
            institutions[assetInstitutionHash],
            assets[keccak256(abi.encodePacked(asset))], registered[assetInstitutionHash]
        );
    }

    function prepare(bytes memory _bban) public pure returns(bytes memory) {
        for (uint8 i = 0; i < 16; i++) {
            uint8 charCode = uint8(_bban[i]);
            if (charCode >= 65 && charCode <= 90) {
                _bban[i] = byte(charCode - 65 + 10);
            }
        }
        _bban[16] = byte(uint8(33)); // X
        _bban[17] = byte(uint8(14)); // E
        //_bban[18] = 48; // 0
        //_bban[19] = 48; // 0
        return _bban;
    }

    function mod9710(bytes memory _prepared) public pure returns(uint8) {
        uint m = 0;
        for (uint8 i = 0; i < 18; i++) {
            uint8 charCode = uint8(_prepared[i]);
            if (charCode >= 48) {
                m *= 10;
                m += charCode - 48; // number
                m %= 97;
            } else {
                m *= 10;
                m += charCode / 10; // part1
                m %= 97;
                m *= 10;
                m += charCode % 10; // part2
                m %= 97;
            }
        }
        m *= 10;
        //m += uint8(_prepared[18]) - 48;
        m %= 97;
        m *= 10;
        //m += uint8(_prepared[19]) - 48;
        m %= 97;
        return uint8(m);
    }

    mapping(bytes32 => bool) public registered;
    mapping(bytes32 => address) public institutions;
    mapping(bytes32 => address) public institutionOwners;
    mapping(bytes32 => bytes32) public assets;

    modifier onlyInstitutionOwner(string memory _institution) {
        if (msg.sender == institutionOwners[keccak256(abi.encodePacked(_institution))]) {
            _;
        }
    }

    function changeInstitutionOwner(string memory _institution, address _address)
    public onlyInstitutionOwner(_institution) returns(bool) {
        institutionOwners[keccak256(abi.encodePacked(_institution))] = _address;
        return true;
    }

    // web3js sendIBANTransaction interface
    function addr(bytes32 _institution) public view returns(address) {
        return institutions[keccak256(abi.encodePacked(
            'ETH', _institution[0], _institution[1], _institution[2], _institution[3]))];
    }

    function registerInstitution(string memory _institution, address _address)
    public onlyRole('admin') returns(bool) {
        if (bytes(_institution).length != 4) {
            return false;
        }
        if (institutionOwners[keccak256(abi.encodePacked(_institution))] != address(0)) {
            return false;
        }
        institutionOwners[keccak256(abi.encodePacked(_institution))] = _address;
        return true;
    }

    function registerInstitutionAsset(
        string memory _asset,
        string memory _institution,
        address _address)
    public onlyInstitutionOwner(_institution) returns(bool)
    {
        if (!registered[keccak256(abi.encodePacked(_asset))]) {
            return false;
        }
        bytes32 assetInstitutionHash = keccak256(abi.encodePacked(_asset, _institution));
        if (registered[assetInstitutionHash]) {
            return false;
        }
        registered[assetInstitutionHash] = true;
        institutions[assetInstitutionHash] = _address;
        return true;
    }

    function updateInstitutionAsset(
        string memory _asset,
        string memory _institution,
        address _address)
    public onlyInstitutionOwner(_institution) returns(bool)
    {
        bytes32 assetInstitutionHash = keccak256(abi.encodePacked(_asset, _institution));
        if (!registered[assetInstitutionHash]) {
            return false;
        }
        institutions[assetInstitutionHash] = _address;
        return true;
    }

    function removeInstitutionAsset(string memory _asset, string memory _institution)
    public onlyInstitutionOwner(_institution) returns(bool) {
        bytes32 assetInstitutionHash = keccak256(abi.encodePacked(_asset, _institution));
        if (!registered[assetInstitutionHash]) {
            return false;
        }
        delete registered[assetInstitutionHash];
        delete institutions[assetInstitutionHash];
        return true;
    }

    function registerAsset(string memory _asset, bytes32 _symbol)
        public onlyRole('admin') returns(bool)
    {
        if (bytes(_asset).length != 3) {
            return false;
        }
        bytes32 asset = keccak256(abi.encodePacked(_asset));
        if (registered[asset]) {
            return false;
        }
        registered[asset] = true;
        assets[asset] = _symbol;
        return true;
    }
}
