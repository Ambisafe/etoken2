/**
 * This software is a subject to Ambisafe License Agreement.
 * No use or distribution is allowed without written permission from Ambisafe.
 * https://www.ambisafe.co/terms-of-use/
 */

pragma solidity 0.4.8;

import '../EventsHistory.sol';
import './Ambi2EnabledFake.sol';

// For testing purposes.
contract EventsHistoryTestable is EventsHistory, Ambi2EnabledFake {}
