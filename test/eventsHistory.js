const Ganache = require('../dependencies/test/helpers/ganache');
const bytes32 = require('../dependencies/test/helpers/bytes32');
const AssertExpectations = require('../dependencies/test/helpers/assertExpectations');

const Ambi2 = artifacts.require('./Ambi2');
const Mock = artifacts.require('./helpers/Mock');
const EventsHistory = artifacts.require('./EventsHistory');

contract('EventsHistory', (accounts) => {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);


  let eventsHistory;
  let ambi2;
  let mock;
  let emitter;
  let assertExpectations;

  const USER = accounts[1];
  const SETUP = accounts[2];
  const EMITTER = accounts[3];
  const ADMIN = accounts[4];
  const CALLER = accounts[5];
  const NAME = 'name';
  const CHANGELOG = 'changelog';
  const TRUE = bytes32(1);
  const SIGNATURE = '0x2f';
  const FALSE = bytes32(0);

  const mockSetupAmbi2 = async (sender, response) => {
    await mock.expect(
      eventsHistory.address,
      0,
      ambi2.methods.claimFor(eventsHistory.address, sender).encodeABI(),
      response
    );
  };

  const mockHasRole = async (sender, role, response) => {
    await mock.expectStaticCall(
      eventsHistory.address,
      0,
      ambi2.methods.hasRole(eventsHistory.address, role, sender).encodeABI(),
      response
    );
  };

  before('setup', async () => {
    mock = await Mock.new();
    assertExpectations = new AssertExpectations(assert, mock);
    eventsHistory = await EventsHistory.new();
    emitter = await Mock.at(eventsHistory.address);
    ambi2 = new web3.eth.Contract(Ambi2.abi, mock.address);
    mockSetupAmbi2(USER, TRUE);
    await eventsHistory.setupAmbi2(mock.address, {from: USER});
    await ganache.snapshot();
  });

  describe('Add emitter', () => {
    it('should allow to add emitter if sender has a setup role', async () => {
      await mockHasRole(SETUP, web3.utils.fromAscii('setup'), TRUE);
      assert.isTrue(await eventsHistory.addEmitter.call(
        SIGNATURE, EMITTER, {from: SETUP}));
      await eventsHistory.addEmitter(SIGNATURE, EMITTER, {from: SETUP});
      assert.equal(await eventsHistory.emitters(SIGNATURE), EMITTER);
      await assertExpectations();
    });

    it('should allow to add several emitters if sender has a setup role', async () => {
      const anotherSignature = '0x5a';
      const anotherEmitter = accounts[4];
      await mockHasRole(SETUP, web3.utils.fromAscii('setup'), TRUE);
      await mockHasRole(SETUP, web3.utils.fromAscii('setup'), TRUE);
      assert.isTrue(await eventsHistory.addEmitter.call(
        SIGNATURE, EMITTER, {from: SETUP}));
      await eventsHistory.addEmitter(SIGNATURE, EMITTER, {from: SETUP});
      assert.isTrue(await eventsHistory.addEmitter.call(
        anotherSignature, anotherEmitter, {from: SETUP}));
      await eventsHistory.addEmitter(
        anotherSignature, anotherEmitter, {from: SETUP});
      assert.equal(await eventsHistory.emitters(SIGNATURE), EMITTER);
      assert.equal(await eventsHistory.emitters(
        anotherSignature), anotherEmitter);
      await assertExpectations();
    });

    it('should NOT allow to add emitter if sender does not have a setup role', async () => {
      await mockHasRole(USER, web3.utils.fromAscii('setup'), FALSE);
      assert.isFalse(await eventsHistory.addEmitter.call(
        SIGNATURE, EMITTER, {from: USER}));
      await eventsHistory.addEmitter(SIGNATURE, EMITTER, {from: USER});
      assert.equal(await eventsHistory.emitters(SIGNATURE), 0);
      await assertExpectations();
    });

    it('should NOT allow to add one emitter twice', async () => {
      const anotherEmitter = accounts[5];
      await mockHasRole(SETUP, web3.utils.fromAscii('setup'), TRUE);
      await mockHasRole(SETUP, web3.utils.fromAscii('setup'), TRUE);
      assert.isTrue(await eventsHistory.addEmitter.call(
        SIGNATURE, EMITTER, {from: SETUP}));
      await eventsHistory.addEmitter(SIGNATURE, EMITTER, {from: SETUP});
      assert.isFalse(await eventsHistory.addEmitter.call(
        SIGNATURE, anotherEmitter, {from: SETUP}));
      await eventsHistory.addEmitter(SIGNATURE, EMITTER, {from: SETUP});
      await assertExpectations();
    });
  });

  describe('Add version', () => {
    it('should allow to add version if sender is admin', async () => {
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);
      assert.isTrue(await eventsHistory.addVersion.call(
        CALLER, NAME, CHANGELOG, {from: ADMIN}));
      await eventsHistory.addVersion(CALLER, NAME, CHANGELOG, {from: ADMIN});
      const result = await eventsHistory.versionInfo(1);
      assert.isTrue(result[0] > 0);
      assert.equal(result[1], ADMIN);
      assert.equal(result[2], CALLER);
      assert.equal(result[3], NAME);
      assert.equal(result[4], CHANGELOG);
      await assertExpectations();
    });

    it('should allow to add several versions if sender is admin', async () => {
      const anotherCaller = accounts[8];
      const anotherName = 'keep';
      const anotherChangelog = 'calm';

      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);

      await eventsHistory.addVersion(CALLER, NAME, CHANGELOG, {from: ADMIN});
      const result = await eventsHistory.versionInfo(1);
      assert.isTrue(result[0] > 0);
      assert.equal(result[1], ADMIN);
      assert.equal(result[2], CALLER);
      assert.equal(result[3], NAME);
      assert.equal(result[4], CHANGELOG);

      await eventsHistory.addVersion(
        anotherCaller, anotherName, anotherChangelog, {from: ADMIN});
      const result2 = await eventsHistory.versionInfo(2);
      assert.isTrue(result[0] > 0);
      assert.equal(result2[1], ADMIN);
      assert.equal(result2[2], anotherCaller);
      assert.equal(result2[3], anotherName);
      assert.equal(result2[4], anotherChangelog);
      await assertExpectations();
    });

    it('should NOT allow to add version if sender is not admin', async () => {
      await mockHasRole(USER, web3.utils.fromAscii('admin'), FALSE);
      assert.isFalse(await eventsHistory.addVersion.call(
        CALLER, NAME, CHANGELOG, {from: USER}));
      await eventsHistory.addVersion(CALLER, NAME, CHANGELOG, {from: USER});
      const result = await eventsHistory.versionInfo(1);
      assert.equal(result[0], 0);
      assert.equal(result[1], 0);
      assert.equal(result[2], 0);
      assert.equal(result[3], 0);
      assert.equal(result[4], 0);
      await assertExpectations();
    });

    it('should NOT allow to add version twice for a caller', async () => {
      const anotherName = 'keep';
      const anotherChangelog = 'calm';
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);

      await eventsHistory.addVersion(CALLER, NAME, CHANGELOG, {from: ADMIN});
      assert.isFalse(await eventsHistory.addVersion.call(
        CALLER, anotherName, anotherChangelog, {from: ADMIN}));
      await eventsHistory.addVersion(
        CALLER, anotherName, anotherChangelog, {from: ADMIN});
      assert.equal(await eventsHistory.versions(CALLER), 1);
      await assertExpectations();
    });

    it('should NOT allow to add version if name is empty', async () => {
      const emptyName = '';
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);
      assert.isFalse(await eventsHistory.addVersion.call(
        CALLER, emptyName, CHANGELOG, {from: ADMIN}));
      await eventsHistory.addVersion(
        CALLER, emptyName, CHANGELOG, {from: ADMIN});
      const result = await eventsHistory.versionInfo(1);
      assert.equal(result[0], 0);
      assert.equal(result[1], 0);
      assert.equal(result[2], 0);
      assert.equal(result[3], 0);
      assert.equal(result[4], 0);
      await assertExpectations();
    });

    it('should NOT allow to add version if changelog is empty', async () => {
      const emptyChangelog = '';
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);
      assert.isFalse(await eventsHistory.addVersion.call(
        CALLER, NAME, emptyChangelog, {from: ADMIN}));
      await eventsHistory.addVersion(
        CALLER, NAME, emptyChangelog, {from: ADMIN});
      const result = await eventsHistory.versionInfo(1);
      assert.equal(result[0], 0);
      assert.equal(result[1], 0);
      assert.equal(result[2], 0);
      assert.equal(result[3], 0);
      assert.equal(result[4], 0);
      await assertExpectations();
    });
  });

  describe('Fallback', () => {
    it('should do delegatecall to emitter contract', async () => {
      const funcSign = emitter.contract.methods.emitEvent().encodeABI();

      await mockHasRole(SETUP, web3.utils.fromAscii('setup'), TRUE);
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);
      await eventsHistory.addEmitter(funcSign, mock.address, {from: SETUP});
      await eventsHistory.addVersion(CALLER, NAME, CHANGELOG, {from: ADMIN});

      const result = await emitter.emitEvent({from: CALLER});
      assert.equal(result.logs[0].event, 'Event');
      assert.equal(result.logs[0].address, eventsHistory.address);
      await assertExpectations();
    });

    it('should NOT do delegatecall to emitter if version is not set for sender', async () => {
      const funcSign = emitter.contract.methods.emitEvent().encodeABI();
      await mockHasRole(SETUP, web3.utils.fromAscii('setup'), TRUE);
      await eventsHistory.addEmitter(funcSign, mock.address, {from: SETUP});

      const result = await emitter.emitEvent({from: CALLER});
      assert.equal(result.logs.length, 0);
      await assertExpectations();
    });

    it('should NOT do delegatecall to emitter if emitter is not set', async () => {
      await mockHasRole(ADMIN, web3.utils.fromAscii('admin'), TRUE);
      await eventsHistory.addVersion(CALLER, NAME, CHANGELOG, {from: ADMIN});

      const result = await emitter.emitEvent({from: CALLER});
      assert.equal(result.logs.length, 0);
      await assertExpectations();
    });
  });
});
