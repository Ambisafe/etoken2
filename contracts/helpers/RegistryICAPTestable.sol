pragma solidity 0.5.8;

import '../RegistryICAP.sol';
import '../../dependencies/contracts/Ambi2EnabledFake.sol';


// For testing purposes.
// solhint-disable-next-line no-empty-blocks
contract RegistryICAPTestable is RegistryICAP, Ambi2EnabledFake {}
