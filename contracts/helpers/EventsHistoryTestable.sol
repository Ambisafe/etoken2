pragma solidity 0.5.8;

import '../EventsHistory.sol';
import '../../dependencies/contracts/Ambi2EnabledFake.sol';


// For testing purposes.
// solhint-disable-next-line no-empty-blocks
contract EventsHistoryTestable is EventsHistory, Ambi2EnabledFake {}
