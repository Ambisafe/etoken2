'use strict';

// using web3 version 1.0 from truffle

function decodeLogs(logs, contract) {
  return logs.map((log) => {
    const logABI = findAbiForSignature(
      log.topics[0], contract.abi, web3.utils.sha3);

    if (logABI == null) {
      return null;
    }
    const decoded = web3.eth.abi.decodeLog(
      logABI.inputs, log.data, log.topics.slice(1));
    decoded.event = logABI.name;
    decoded.args = decoded;
    return decoded;
  }).filter((log) => log != null);
}

function findAbiForSignature(signature, abi, sha3) {
  return abi.find((el) =>
    el.type === 'event' &&
    signature.slice(-64) === sha3(
      `${el.name}(${el.inputs.map((input) => input.type).join(',')})`
    ).slice(-64)
  ) || null;
}

module.exports = decodeLogs;
