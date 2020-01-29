const Ganache = require('../dependencies/test/helpers/ganache');

const EToken2Testable = artifacts.require('./EToken2Testable');
const UserContract = artifacts.require('./UserContract');
const Stub = artifacts.require('./Stub');
const AssetProxy = artifacts.require('./AssetProxy');
const Asset = artifacts.require('./Asset');

contract('AssetProxy', function(accounts) {
  const SYMBOL_STRING = 'TEST';
  const SYMBOL = web3.utils.fromAscii(SYMBOL_STRING);
  const NAME = 'Test Name';
  const DESCRIPTION = 'Test Description';
  const VALUE = 1001;
  const BASE_UNIT = 2;
  const IS_REISSUABLE = false;

  const ganache = new Ganache(web3);

  beforeEach('time', async () => {
    await ganache.setTime(1);
  });

  afterEach('revert', ganache.revert);

  before('setup others', async function() {
    this.UserContract = UserContract;
    this.AssetProxy = AssetProxy;
    this.etoken2 = await EToken2Testable.new();
    this.assetProxy = await AssetProxy.new();
    this.asset = await Asset.new();
    await this.etoken2.setupEventsHistory((await Stub.new()).address);
    await this.etoken2.issueAsset(
      SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, IS_REISSUABLE);
    await this.etoken2.__enableProxyCheck();
    await this.assetProxy.init(this.etoken2.address, SYMBOL_STRING, NAME);
    await this.asset.init(this.assetProxy.address);
    await ganache.snapshot();
  });

  it('should allow to set start version', async function() {
    const startVersion = accounts[0];
    assert.isTrue(await this.assetProxy.proposeUpgrade.call(startVersion));
  });

  it('should allow to propose upgrade and emit UpgradeProposal event', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    await this.assetProxy.proposeUpgrade(startVersion);
    const result = await this.assetProxy.proposeUpgrade(newVersion);
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].event, 'UpgradeProposed');
    assert.equal(result.logs[0].args.newVersion, newVersion);
  });

  it('should not allow to propose upgrade if upgrading process is started', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    assert.isFalse(await this.assetProxy.proposeUpgrade.call(newVersion));
  });

  it('should not allow to propose upgrade if new version is empty', async function() {
    const emptyAddress = `0x${'0'.repeat(40)}`;
    assert.isFalse(await this.assetProxy.proposeUpgrade.call(emptyAddress));
  });

  it('should not be possible to propose upgrade from not asset owner', async function() {
    const newVersion = accounts[0];
    const notOwner = accounts[1];
    assert.isFalse(
      await this.assetProxy.proposeUpgrade.call(newVersion, {from: notOwner}));
  });

  it('should allow to purge upgrade', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    assert.isTrue(await this.assetProxy.purgeUpgrade.call());
  });

  it('should not allow to purge upgrade from not asset owner', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    const notOwner = accounts[3];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    assert.isFalse(await this.assetProxy.purgeUpgrade.call({from: notOwner}));
  });

  it('should not allow to purge upgrade if upgrade process is not proposed', async function() {
    const startVersion = accounts[0];
    await this.assetProxy.proposeUpgrade(startVersion);
    assert.isFalse(await this.assetProxy.purgeUpgrade.call());
  });

  it('should not allow to commit upgrade if upgrade process is not started', async function() {
    const startVersion = accounts[0];
    await this.assetProxy.proposeUpgrade(startVersion);
    assert.isFalse(await this.assetProxy.commitUpgrade.call());
  });

  it('should not allow to commit upgrade if upgrade before upgrade freeze time', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    // increase time till 2 days
    await ganache.setTime(172800);
    await this.assetProxy.commitUpgrade();
    assert.equal(await this.assetProxy.getLatestVersion(), startVersion);
  });

  it('should allow to commit upgrade after upgrade freeze time', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    // increase time till 3 days + 1 min
    await ganache.setTime(259260);
    await this.assetProxy.commitUpgrade();
    assert.equal(await this.assetProxy.getLatestVersion(), newVersion);
  });

  it('should allow to disagree with proposed upgrade', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    const user = accounts[3];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    await this.assetProxy.optOut({from: user});
    // increase time till 3 days + 1 min
    await ganache.setTime(259260);
    await this.assetProxy.commitUpgrade();
    assert.equal(await this.assetProxy.getLatestVersion(), newVersion);
    assert.equal(await this.assetProxy.getVersionFor(user), startVersion);
  });

  it('should not allow to disagree with proposed upgrade twice', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    const user = accounts[3];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    await this.assetProxy.optOut({from: user});
    assert.isFalse(await this.assetProxy.optOut.call({from: user}));
  });

  it('should allow to disagree with proposed upgrade for different users', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    const user = accounts[3];
    const secondaryUser = accounts[4];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    await this.assetProxy.optOut({from: user});
    await this.assetProxy.optOut({from: secondaryUser});
    // increase time till 3 days + 1 min
    await ganache.setTime(259260);
    await this.assetProxy.commitUpgrade();
    assert.equal(await this.assetProxy.getLatestVersion(), newVersion);
    assert.equal(await this.assetProxy.getVersionFor(user), startVersion);
    assert.equal(
      await this.assetProxy.getVersionFor(secondaryUser), startVersion);
  });

  it('should allow to agree with asset implementation upgrading', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    const user = accounts[3];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    await this.assetProxy.optOut({from: user});
    // increase time till 3 days + 1 min
    await ganache.setTime(259260);
    await this.assetProxy.commitUpgrade();
    assert.equal(await this.assetProxy.getLatestVersion(), newVersion);
    assert.equal(await this.assetProxy.getVersionFor(user), startVersion);
    await this.assetProxy.optIn({from: user});
    assert.equal(await this.assetProxy.getVersionFor(user), newVersion);
  });

  it('should be possible to get asset pending version', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    assert.equal(await this.assetProxy.getPendingVersion(), newVersion);
  });

  it('should be possible to get asset latest version', async function() {
    const startVersion = accounts[0];
    await this.assetProxy.proposeUpgrade(startVersion);
    assert.equal(await this.assetProxy.getLatestVersion(), startVersion);
  });

  it('should be possible to get asset pending version time stamp', async function() {
    const startVersion = accounts[0];
    const newVersion = accounts[1];
    await this.assetProxy.proposeUpgrade(startVersion);
    await this.assetProxy.proposeUpgrade(newVersion);
    assert.isTrue((await this.assetProxy.getPendingVersionTimestamp.call())
    .valueOf() >= 1);
  });
});
