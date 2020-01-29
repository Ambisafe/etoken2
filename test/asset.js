const Ganache = require('../dependencies/test/helpers/ganache');

const EToken2Testable = artifacts.require('./EToken2Testable');
const RegistryICAPTestable = artifacts.require('./RegistryICAPTestable');
const UserContract = artifacts.require('./UserContract');
const Stub = artifacts.require('./Stub');
const Listener = artifacts.require('./Listener');
const AssetProxy = artifacts.require('./AssetProxy');
const Asset = artifacts.require('./Asset');

const assetBase = require('./assetBase');
const assetRecoveryTokens = require('./assetRecoveryTokens');

contract('Asset', function(accounts) {
  const SYMBOL_STRING = 'TEST';
  const SYMBOL2_STRING = 'TEST2';
  const SYMBOL = web3.utils.fromAscii(SYMBOL_STRING);
  const SYMBOL2 = web3.utils.fromAscii(SYMBOL2_STRING);
  const NAME = 'Test Name';
  const DESCRIPTION = 'Test Description';
  const VALUE = 1001;
  const VALUE2 = 30000;
  const BASE_UNIT = 2;
  const IS_REISSUABLE = false;

  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  before('setup others', async function() {
    this.AssetProxy = AssetProxy;
    this.Listener = Listener;
    this.UserContract = UserContract;
    this.assetProxyRecovery = await AssetProxy.new();
    const instanceRecovery = await Asset.new();
    this.assetInstanceRecovery = instanceRecovery;
    this.etoken2 = await EToken2Testable.new();
    this.assetProxy = await AssetProxy.new();
    this.asset = await Asset.new();
    this.icap = await RegistryICAPTestable.new();
    await this.etoken2.setupEventsHistory((await Stub.new()).address);
    await this.etoken2.setupRegistryICAP(this.icap.address);
    await this.etoken2.issueAsset(
      SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, IS_REISSUABLE);
    await this.etoken2.issueAsset(
      SYMBOL2, VALUE2, NAME, DESCRIPTION, BASE_UNIT, IS_REISSUABLE);
    await this.etoken2.__enableProxyCheck();
    await this.icap.registerAsset('TST', SYMBOL);
    await this.icap.registerInstitution('XREG', accounts[2]);
    await this.icap.registerInstitutionAsset(
      'TST', 'XREG', accounts[2], {from: accounts[2]});
    await this.assetProxy.init(this.etoken2.address, SYMBOL_STRING, NAME);
    await this.assetProxy.proposeUpgrade(this.asset.address);
    await this.asset.init(this.assetProxy.address);

    await this.assetProxyRecovery.init(
      this.etoken2.address, SYMBOL2_STRING, NAME);
    await this.assetProxyRecovery.proposeUpgrade(
      this.assetInstanceRecovery.address);
    await this.assetInstanceRecovery.init(this.assetProxyRecovery.address);
    await ganache.snapshot();
  });

  assetBase(accounts);
  assetRecoveryTokens(accounts);
});
