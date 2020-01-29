'use strict';

function AssertExpectations(assert, mock) {
  return async function(leftCalls = 0, executedCalls = null) {
    assert.equal((
      await mock.expectationsLeft()).toString(10), leftCalls.toString(10));
    const expectationsCount = await mock.expectationsCount();
    assert.equal(
      (await mock.callsCount()).toString(10),
      executedCalls === null ?
        expectationsCount.toString(10) : executedCalls.toString(10));
  };
}

module.exports = AssertExpectations;
