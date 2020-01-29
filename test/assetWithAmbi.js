const Ganache = require('../dependencies/test/helpers/ganache');

const AssetProxy = artifacts.require('./AssetProxyTestable');
const Asset = artifacts.require('./AssetWithAmbiTestable');
const Ambi2Fake = artifacts.require('./Ambi2Fake');

contract('AssetWithAmbi', function(accounts) {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  let assetProxy;
  let asset;
  let assetThroughProxy;
  let ambi2Fake;

  const ROLE = web3.utils.fromAscii('tester');
  const ALLOWED = accounts[1];
  const VALUE = 123;

  before('setup others', async function() {
    assetProxy = await AssetProxy.new();
    asset = await Asset.new();
    assetThroughProxy = await Asset.at(assetProxy.address);
    ambi2Fake = await Ambi2Fake.new();
    await assetProxy.proposeUpgrade(asset.address);
    await asset.setupAmbi2(ambi2Fake.address);
    await ambi2Fake.setAllowed(asset.address, ROLE, ALLOWED);
    await ganache.snapshot();
  });

  it('should not allow execution without role on direct call', async function() {
    assert.equal((await asset.testRole.call(VALUE)).valueOf(), 0);
  });

  it('should not allow execution without role on proxied call', async function() {
    assert.equal((await assetThroughProxy.testRole.call(VALUE)).valueOf(), 0);
  });

  it('should allow execution with role on direct call', async function() {
    assert.equal((await asset.testRole.call(
      VALUE, {from: ALLOWED})).valueOf(), VALUE);
  });

  it('should allow execution with role on proxied call', async function() {
    assert.equal((await assetThroughProxy.testRole.call(
      VALUE, {from: ALLOWED})).valueOf(), VALUE);
  });
});
