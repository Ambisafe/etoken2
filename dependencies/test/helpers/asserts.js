'use strict';

const toBytes32 = require('./bytes32');

module.exports = (assert) => ({
  equal: (expected) => {
    return (actual) => {
      assert.equal(actual.valueOf(), expected.valueOf());
      return true;
    };
  },
  isTrue: assert.isTrue,
  isFalse: assert.isFalse,
  throws: (promise, message = '') => {
    return promise
    .then(
      (result) => {
        throw new Error(`Didn't revert`);
      },
      (error) => {
        if (!error.message.includes(message)) {
          throw new Error(`Reverted without message: ${message}.
            Original error: ${error}`);
        }
        return true;
      });
  },
  error: (txResult, message, eventsCount = 1, errorEventIndex = 0) => {
    assert.equal(txResult.logs.length, eventsCount);
    assert.equal(txResult.logs[errorEventIndex].event, 'Error');
    assert.equal(
      txResult.logs[errorEventIndex].args.message,
      toBytes32(message)
    );
  },
});

