/**
 * This software is a subject to Ambisafe License Agreement.
 * No use or distribution is allowed without written permission from Ambisafe.
 * https://www.ambisafe.co/terms-of-use/
 */

pragma solidity 0.4.8;

import '../RegistryICAP.sol';
import './Ambi2EnabledFake.sol';

// For testing purposes.
contract RegistryICAPTestable is RegistryICAP, Ambi2EnabledFake {}
