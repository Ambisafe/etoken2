'use strict';

// using web3 version 1.0 from truffle

function bytes32(stringOrNumber) {
  const zeros = `${'0'.repeat(63)}`;
  if (typeof stringOrNumber === 'string') {
    return (web3.utils.toHex(stringOrNumber) + zeros).slice(0, 66);
  }
  const hexNumber = web3.utils.toHex(stringOrNumber).slice(2);
  return '0x' + (zeros + hexNumber).slice(-64);
}

module.exports = bytes32;
