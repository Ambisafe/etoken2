pragma solidity 0.5.8;

import './AssetWithAmbi.sol';


contract ComplianceConfiguration {
    function isTransferAllowed(address _from, address _to, uint _value) public view returns(bool);

    function isTransferToICAPAllowed(
        address _from,
        bytes32 _icap,
        uint _value)
    public view returns(bool);

    function processTransferResult(address _from, address _to, uint _value, bool _success) public;

    function processTransferToICAPResult(
        address _from,
        bytes32 _icap,
        uint _value,
        bool _success)
    public;
}


/**
 * @title EToken2 Asset with compliance configuration.
 * Note: all the non constant functions return false instead of throwing in case if state change
 * didn't happen yet.
 */
contract AssetWithCompliance is AssetWithAmbi {
    ComplianceConfiguration public complianceConfiguration;

    event Error(bytes32 error);
    event ComplianceConfigurationSet(address contractAddress);

    /**
     * Emits Error if verifications in complianceConfiguration contract is not valid
     */
    modifier isTransferAllowed(address _from, address _to, uint _value) {
        if (address(complianceConfiguration) != address(0) &&
        !complianceConfiguration.isTransferAllowed(_from, _to, _value)) {
            emit Error('Transfer is not allowed');
            return;
        }
        _;
    }

    /**
     * Emits Error if verifications in complianceConfiguration contract is not valid
     */
    modifier isTransferToICAPAllowed(address _from, bytes32 _icap, uint _value) {
        if (address(complianceConfiguration) != address(0)
        && !complianceConfiguration.isTransferToICAPAllowed(_from, _icap, _value)) {
            emit Error('Transfer is not allowed');
            return;
        }
        _;
    }

    /**
     * Sets instance of ComplianceConfiguration object
     *
     * Can only be called by caller with admin role.
     *
     * @param _complianceConfiguration instance of ComplianceConfiguration
     * object that will be used for whitelisting verifications.
     *
     * @return success.
     */
    function setupComplianceConfiguration(ComplianceConfiguration _complianceConfiguration)
    public onlyRole('admin') returns(bool) {
        complianceConfiguration = _complianceConfiguration;
        emit ComplianceConfigurationSet(address(_complianceConfiguration));
        return true;
    }

    function processTransferResult(address _from, address _to, uint _value, bool _success)
    internal returns(bool) {
        if (address(complianceConfiguration) == address(0)) {
            return _success;
        }
        complianceConfiguration.processTransferResult(_from, _to, _value, _success);
        return _success;
    }

    function processTransferToICAPResult(address _from, bytes32 _icap, uint _value, bool _success)
    internal returns(bool) {
        if (address(complianceConfiguration) == address(0)) {
            return _success;
        }
        complianceConfiguration.processTransferToICAPResult(_from, _icap, _value, _success);
        return _success;
    }

    /**
     * Transfers asset balance with compliance verification with adding specified comment.
     *
     * @param _to holder address to give to.
     * @param _value amount to transfer.
     * @param _reference transfer comment to be included in a EToken2's Transfer event.
     *
     * @return success.
     */
    function _transferWithReference(
        address _to,
        uint _value,
        string memory _reference,
        address _sender)
    internal isTransferAllowed(_sender, _to, _value) returns(bool) {
        return processTransferResult(
            _sender,
            _to,
            _value,
            super._transferWithReference(_to, _value, _reference, _sender));
    }

    /**
     * Transfers asset balance wwith compliance verification adding specified comment.
     *
     * @param _icap recipient ICAP to give to.
     * @param _value amount to transfer.
     * @param _reference transfer comment to be included in a EToken2's Transfer event.
     *
     * @return success.
     */
    function _transferToICAPWithReference(
        bytes32 _icap,
        uint _value,
        string memory _reference,
        address _sender)
    internal isTransferToICAPAllowed(_sender, _icap, _value) returns(bool) {
        return processTransferToICAPResult(
            _sender,
            _icap,
            _value,
            super._transferToICAPWithReference(_icap, _value, _reference, _sender));
    }

    /**
     * Performs allowance transfer of asset balance with compliance verification
     * between holders adding specified comment.
     *
     * @param _from holder address to take from.
     * @param _to holder address to give to.
     * @param _value amount to transfer.
     * @param _reference transfer comment to be included in a EToken2's Transfer event.
     *
     * @return success.
     */
    function _transferFromWithReference(
        address _from,
        address _to,
        uint _value,
        string memory _reference,
        address _sender)
    internal isTransferAllowed(_from, _to, _value) returns(bool) {
        return processTransferResult(
            _from,
            _to,
            _value,
            super._transferFromWithReference(_from, _to, _value, _reference, _sender));
    }

    /**
     * Performs allowance transfer of asset balance with compliance
     * verification between holders adding specified comment.
     * Resolves asset implementation contract for the caller
     * and forwards there arguments along with
     * the caller address.
     *
     * @param _from holder address to take from.
     * @param _icap recipient ICAP address to give to.
     * @param _value amount to transfer.
     * @param _reference transfer comment to be included in a EToken2's Transfer event.
     *
     * @return success.
     */
    function _transferFromToICAPWithReference(
        address _from,
        bytes32 _icap,
        uint _value,
        string memory _reference,
        address _sender)
    internal isTransferToICAPAllowed(_from, _icap, _value) returns(bool) {
        return processTransferToICAPResult(
            _from,
            _icap,
            _value,
            super._transferFromToICAPWithReference(_from, _icap, _value, _reference, _sender));
    }

    
    function legalTransferFrom(address _from, address _to, uint _value, string calldata _reference)
        external onlyRole('legal') returns(bool)
    {
        return processTransferResult(
            _from,
            _to,
            _value,
            super._transferFromWithReference(_from, _to, _value, _reference, _from));
    }
}
