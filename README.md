# etoken2
EToken2 public resources.
=========
Contracts infrastructure.

- EToken2.sol acts as a base for all assets(tokens) operation (like issuing, balance storage, transfer).
- Asset.sol implements specific asset properties (described in AssetInterface.sol) and can be extended. 
- AssetProxy.sol acts as an asset entry point, provides an ERC20 interface (described in ERC20Interface.sol) and forwards calls to asset implementation. Also allows for asset implementaion upgrades.
- EventsHistory.sol holds all operations events to avoid events lost in case of base contract replacement during upgrade or extension.
- EToken2Emitter.sol provides EToken2 events definition.

## [Regulation Aware Protocol](https://github.com/Ambisafe/regulation-aware-protocol)

- AssetWithCompliance.sol acts as an integration link between a token and RAP Compliance Configuration (such as USPX).

## Installation

**NodeJS 6.x+ must be installed as a prerequisite.**
```
$ npm install
```

## Running tests

```
$ npm run testrpc
$ npm run test
```
