module.exports = {
  plugins: ['truffle-security'],
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 4700000,
      gasPrice: 20000000000,
    },
  },
  compilers: {
    solc: {
      version: '0.5.8',
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000,
        },
        evmVersion: 'petersburg',
      },
    },
  },
};
