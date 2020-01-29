const Ganache = require('../dependencies/test/helpers/ganache');
const decodeLogs = require('../dependencies/test/helpers/decodelogs');
const bytes32 = require('../dependencies/test/helpers/bytes32');

const EToken2Testable = artifacts.require('./EToken2Testable');
const EventsHistoryTestable = artifacts.require('./EventsHistoryTestable');
const EToken2Emitter = artifacts.require('./EToken2Emitter');
const RegistryICAPTestable = artifacts.require('./RegistryICAPTestable');
const UserContract = artifacts.require('./UserContract');

contract('EToken2', (accounts) => {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  const bn = (number) => {
    return web3.utils.toBN(number);
  };

  const UINT_256_MINUS_3 = bn(2).pow(bn(256)).subn(3);
  const UINT_256_MINUS_2 = bn(2).pow(bn(256)).subn(2);
  const UINT_256_MINUS_1 = bn(2).pow(bn(256)).subn(1);
  const UINT_255_MINUS_1 = bn(2).pow(bn(255)).subn(1);
  const UINT_255 = bn(2).pow(bn(255));

  const BYTES_32 = `0x${'f'.repeat(64)}`;
  const ADDRESS_ZERO = `0x${'0'.repeat(40)}`;
  const OWNER = accounts[0];
  const NON_OWNER = accounts[1];
  const NON_ASSET = web3.utils.fromAscii('LHNONEXIST');
  const SYMBOL = bytes32(100);
  const NAME = 'Test Name';
  const NAME2 = '2Test Name2';
  const DESCRIPTION = 'Test Description';
  const DESCRIPTION2 = '2Test Description2';
  const VALUE = 1001;
  const BASE_UNIT = 2;
  const REISSUABLE = true;
  const NOT_REISSUABLE = false;

  let etoken2;
  let eventsHistory;
  let userContract;
  let etoken2Emitter;

  before('setup', async () => {
    etoken2 = await EToken2Testable.new();
    const instance = await UserContract.new();
    userContract = await EToken2Testable.at(instance.address);
    await instance.init(etoken2.address);
    eventsHistory = await EventsHistoryTestable.new();
    etoken2Emitter = await EToken2Emitter.new();
    registryICAPTestable = await RegistryICAPTestable.new();
    const etoken2EmitterAbi = etoken2Emitter.contract;
    await etoken2.setupEventsHistory(eventsHistory.address);
    await eventsHistory.addVersion(
      etoken2.address, 'Origin', 'Initial version.');
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitTransfer(
        ADDRESS_ZERO, ADDRESS_ZERO, bytes32(0), '', '')
      .encodeABI().slice(0, 10), etoken2Emitter.address);
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitTransferToICAP(
        ADDRESS_ZERO, ADDRESS_ZERO, bytes32(0), '', '')
      .encodeABI().slice(0, 10), etoken2Emitter.address);
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitIssue(
        bytes32(0), '', ADDRESS_ZERO)
      .encodeABI().slice(0, 10), etoken2Emitter.address);
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitRevoke(
        bytes32(0), '', ADDRESS_ZERO)
      .encodeABI().slice(0, 10), etoken2Emitter.address);
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitOwnershipChange(
        ADDRESS_ZERO, ADDRESS_ZERO, bytes32(0))
      .encodeABI().slice(0, 10), etoken2Emitter.address);
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitApprove(
        ADDRESS_ZERO, ADDRESS_ZERO, bytes32(0), '')
      .encodeABI().slice(0, 10), etoken2Emitter.address);
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitError(
        bytes32(0)).encodeABI().slice(0, 10), etoken2Emitter.address);
    await eventsHistory.addEmitter(
      etoken2EmitterAbi.methods.emitChange(
        bytes32(0)).encodeABI().slice(0, 10), etoken2Emitter.address);
    eventsHistory = await EToken2Emitter.at(eventsHistory.address);
    await ganache.snapshot();
  });

  const getEvents = (tx, name = false) => decodeLogs(
    tx.receipt.rawLogs, eventsHistory).filter(
    (log) => !name || log.event === name);

  const assertError = (tx) => {
    const events = getEvents(tx);
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'Error');
    return true;
  };

  describe('Issue asset', () => {
    it('should not be possible to issue asset with existing symbol', async () => {
      const value = 1001;
      const value2 = 3021;
      const baseUnit2 = 4;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.issueAsset(
        SYMBOL, value2, NAME2, DESCRIPTION2, baseUnit2, REISSUABLE);
      await assertError(result);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), NAME);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), value);
      assert.equal(
        (await etoken2.description.call(SYMBOL)).valueOf(), DESCRIPTION);
      assert.equal((await etoken2.baseUnit.call(SYMBOL)).valueOf(), BASE_UNIT);
      assert.equal(
        (await etoken2.isReissuable.call(SYMBOL)).valueOf(), NOT_REISSUABLE);
    });

    it('should be possible to issue asset with 1 bit 0 symbol', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), NAME);
    });

    it('should be possible to issue asset with 1 bit 1 symbol', async () => {
      const symbol = bytes32(200);
      await etoken2.issueAsset(
        symbol, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.name.call(symbol)).valueOf(), NAME);
    });

    it('should be possible to issue asset with 32 bytes symbol', async () => {
      const symbol = BYTES_32;
      await etoken2.issueAsset(
        symbol, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.name.call(symbol)).valueOf(), NAME);
    });

    it('should not be possible to issue fixed asset with 0 value', async () => {
      const value = 0;
      const isReissuable = false;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, isReissuable);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), '');
    });

    it('should be possible to issue fixed asset with 1 value', async () => {
      const value = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), value);
    });

    it('should be possible to issue fixed asset with (2**256 - 1) value', async () => {
      const value = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });

    it('should be possible to issue reissuable asset with 0 value', async () => {
      const value = 0;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), NAME);
    });

    it('should be possible to issue reissuable asset with 1 value', async () => {
      const value = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), value);
    });

    it('should be possible to issue reissuable asset with (2**256 - 1) value', async () => {
      const value = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });

    it('should be possible to issue asset with base unit 1', async () => {
      const baseUnit = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, baseUnit, NOT_REISSUABLE);
      assert.equal((await etoken2.baseUnit.call(SYMBOL)).valueOf(), 1);
    });

    it('should be possible to issue asset with base unit 255', async () => {
      const baseUnit = 255;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, baseUnit, NOT_REISSUABLE);
      assert.equal((await etoken2.baseUnit.call(SYMBOL)).valueOf(), 255);
    });

    it('should be possible to issue asset', async () => {
      const value = 1001;
      const result = getEvents(
        await etoken2.issueAsset(
          SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal(result[0].args.value.valueOf(), value);
      assert.equal(result[0].args.by.valueOf(), accounts[0]);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), NAME);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), value);
      assert.equal(
        (await etoken2.description.call(SYMBOL)).valueOf(), DESCRIPTION);
      assert.equal((await etoken2.baseUnit.call(SYMBOL)).valueOf(), BASE_UNIT);
      assert.equal(
        (await etoken2.isReissuable.call(SYMBOL)).valueOf(), NOT_REISSUABLE);
    });

    it('should be possible to issue multiple assets', async () => {
      const symbol2 = bytes32(200);
      const value = 1001;
      const value2 = 3021;
      const baseUnit2 = 4;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.issueAsset(
        symbol2, value2, NAME2, DESCRIPTION2, baseUnit2, REISSUABLE);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), NAME);
      assert.equal((await etoken2.name.call(symbol2)).valueOf(), NAME2);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), value);
      assert.equal((await etoken2.totalSupply.call(symbol2)).valueOf(), value2);
      assert.equal(
        (await etoken2.description.call(SYMBOL)).valueOf(), DESCRIPTION);
      assert.equal(
        (await etoken2.description.call(symbol2)).valueOf(), DESCRIPTION2);
      assert.equal((await etoken2.baseUnit.call(SYMBOL)).valueOf(), BASE_UNIT);
      assert.equal(
        (await etoken2.baseUnit.call(symbol2)).valueOf(), baseUnit2);
      assert.equal(
        (await etoken2.isReissuable.call(SYMBOL)).valueOf(), NOT_REISSUABLE);
      assert.equal(
        (await etoken2.isReissuable.call(symbol2)).valueOf(), REISSUABLE);
      assert.equal((await etoken2.owner.call(SYMBOL)).valueOf(), OWNER);
      assert.equal((await etoken2.owner.call(symbol2)).valueOf(), OWNER);
    });
  });

  describe('Reissue asset', () => {
    it('should not be possible to reissue asset by non-owner', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(
        SYMBOL, 100, {from: NON_OWNER});
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), 0);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to reissue fixed asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, 100);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to reissue 0 of reissuable asset', async () => {
      const amount = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      const result = await etoken2.reissueAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to reissue missing asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(NON_ASSET, 100);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, NON_ASSET)).valueOf(), 0);
      assert.equal((await etoken2.totalSupply.call(NON_ASSET)).valueOf(), 0);
    });

    it('should not be possible to reissue 1 with total supply (2**256 - 1)', async () => {
      const value = UINT_256_MINUS_1;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      const result = await etoken2.reissueAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        value.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });

    it('should not be possible to reissue (2**256 - 1) with total supply 1', async () => {
      const value = 1;
      const amount = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      const result = await etoken2.reissueAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        value.toString());
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });

    it('should be possible to reissue 1 with total supply (2**256 - 2)', async () => {
      const value = UINT_256_MINUS_2;
      const amount = 1;
      const resultValue = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        resultValue.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        resultValue.toString());
    });

    it('should be possible to reissue 1 with total supply 0', async () => {
      const value = 0;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(
          OWNER, SYMBOL)).valueOf(), value + amount);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(), value + amount);
    });

    it('should be possible to reissue (2**256 - 1) with total supply 0', async () => {
      const value = 0;
      const amount = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        amount.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        amount.toString());
    });

    it('should be possible to reissue (2**256 - 2) with total supply 1', async () => {
      const value = 1;
      const amount = UINT_256_MINUS_2;
      const resultValue = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        resultValue.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        resultValue.toString());
    });

    it('should be possible to reissue (2**255 - 1) with total supply 2**255', async () => {
      const value = UINT_255;
      const amount = UINT_255_MINUS_1;
      const resultValue = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        resultValue.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        resultValue.toString());
    });

    it('should be possible to reissue 2**255 with total supply (2**255 - 1)', async () => {
      const value = UINT_255_MINUS_1;
      const amount = UINT_255;
      const resultValue = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        resultValue.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        resultValue.toString());
    });

    it('should keep reissuance separated between assets', async () => {
      const symbol2 = bytes32(200);
      const value = 500;
      const value2 = 1000;
      const holder = accounts[0];
      const amount = 100;
      const amount2 = 33;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.issueAsset(
        symbol2, value2, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.reissueAsset(SYMBOL, amount);
      await etoken2.reissueAsset(symbol2, amount2);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        value + amount);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value + amount);
      assert.equal(
        (await etoken2.balanceOf.call(holder, symbol2)).valueOf(),
        value2 + amount2);
      assert.equal(
        (await etoken2.totalSupply.call(symbol2)).valueOf(),
        value2 + amount2);
    });
  });

  describe('Revoke asset', () => {
    it('should not be possible to revoke 1 from missing asset', async () => {
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.revokeAsset(NON_ASSET, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, NON_ASSET)).valueOf(), 0);
    });

    it('should not be possible to revoke 0 from fixed asset', async () => {
      const amount = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.revokeAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to revoke 0 from reissuable asset', async () => {
      const amount = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      const result = await etoken2.revokeAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to revoke 1 with balance 0', async () => {
      const value = 0;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      const result = await etoken2.revokeAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), value);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), value);
    });

    it('should not be possible to revoke 2 with balance 1', async () => {
      const value = 1;
      const amount = 2;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.revokeAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), value);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), value);
    });

    it('should not be possible to revoke (2**256 - 1) with balance (2**256 - 2)', async () => {
      const value = UINT_256_MINUS_2;
      const amount = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      const result = await etoken2.revokeAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        value.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });

    it('should not be possible to revoke 2**255 with balance (2**255 - 1)', async () => {
      const value = UINT_255_MINUS_1;
      const amount = UINT_255;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      const result = await etoken2.revokeAsset(SYMBOL, amount);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        value.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });

    it('should be possible to revoke by non-owner', async () => {
      const balance = 100;
      const revokeAmount = 10;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(NON_OWNER, balance, SYMBOL);
      const result = getEvents(
        await etoken2.revokeAsset(SYMBOL, revokeAmount, {from: NON_OWNER}));
      assert.equal(result.length, 1);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        VALUE - balance);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(),
        balance - revokeAmount);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        VALUE - revokeAmount);
    });

    it('should be possible to revoke 1 from fixed asset with 1 balance', async () => {
      const value = 1;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = getEvents(await etoken2.revokeAsset(SYMBOL, amount));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal(result[0].args.value.valueOf(), amount);
      assert.equal((await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), 0);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), 0);
    });

    it('should be possible to revoke 1 from reissuable asset with 1 balance', async () => {
      const value = 1;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.revokeAsset(SYMBOL, amount);
      assert.equal((await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), 0);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), 0);
    });

    it('should be possible to revoke 2**255 with 2**255 balance', async () => {
      const value = UINT_255;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.revokeAsset(SYMBOL, value);
      assert.equal((await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), 0);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), 0);
    });

    it('should be possible to revoke (2**256 - 1) with (2**256 - 1) balance', async () => {
      const value = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.revokeAsset(SYMBOL, value);
      assert.equal((await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), 0);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), 0);
    });

    it('should be possible to revoke 1 with 2 balance', async () => {
      const value = 2;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.revokeAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        value - amount);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value - amount);
    });

    it('should be possible to revoke 2 with (2**256 - 1) balance', async () => {
      const value = UINT_256_MINUS_1;
      const amount = 2;
      const resultValue = UINT_256_MINUS_3;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.revokeAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        resultValue.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        resultValue.toString());
    });

    it('should keep revokes separated between assets', async () => {
      const symbol2 = bytes32(200);
      const value = 500;
      const value2 = 1000;
      const holder = accounts[0];
      const amount = 100;
      const amount2 = 33;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.issueAsset(
        symbol2, value2, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.revokeAsset(SYMBOL, amount);
      await etoken2.revokeAsset(symbol2, amount2);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        value - amount);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(), value - amount);
      assert.equal(
        (await etoken2.balanceOf.call(holder, symbol2)).valueOf(),
        value2 - amount2);
      assert.equal(
        (await etoken2.totalSupply.call(symbol2)).valueOf(), value2 - amount2);
    });

    it('should be possible to reissue 1 after revoke 1 with total supply (2**256 - 1)', async () => {
      const value = UINT_256_MINUS_1;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.revokeAsset(SYMBOL, amount);
      await etoken2.reissueAsset(SYMBOL, amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        value.toString());
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });
  });

  describe('Get asset info', () => {
    it('should be possible to get asset name', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), NAME);
    });

    it('should be possible to get asset description', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.description.call(SYMBOL)).valueOf(), DESCRIPTION);
    });

    it('should be possible to get asset base unit', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.baseUnit.call(SYMBOL)).valueOf(), BASE_UNIT);
    });

    it('should be possible to get asset reissuability', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      assert.equal(
        (await etoken2.isReissuable.call(SYMBOL)).valueOf(), REISSUABLE);
    });

    it('should be possible to get asset owner', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.owner.call(SYMBOL)).valueOf(), accounts[0]);
    });

    it('should be possible to check if address is asset owner', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.isTrue(
        (await etoken2.isOwner.call(accounts[0], SYMBOL)).valueOf());
    });

    it('should be possible to check if address is owner of non-existing asset', async () => {
      assert.isFalse(
        (await etoken2.isOwner.call(accounts[0], SYMBOL)).valueOf());
    });

    it('should be possible to check if asset is created', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.isTrue((await etoken2.isCreated.call(SYMBOL)).valueOf());
    });

    it('should be possible to check if asset is created for non-existing asset', async () => {
      assert.isFalse((await etoken2.isCreated.call(SYMBOL)).valueOf());
    });

    it('should be possible to get asset total supply with single holder', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE);
    });

    it('should be possible to get asset total supply with multiple holders', async () => {
      const amount = 1001;
      const amount2 = 999;
      const holder2 = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, amount + amount2, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, amount2, SYMBOL);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(), amount + amount2);
    });

    it('should be possible to get asset total supply with multiple holders holding 0 amount', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, VALUE, SYMBOL);
      await etoken2.transfer(holder, VALUE, SYMBOL, {from: holder2});
      await etoken2.revokeAsset(SYMBOL, VALUE);
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), 0);
    });

    it('should be possible to get asset total supply with multiple holders holding (2**256 - 1) amount', async () => {
      const value = UINT_256_MINUS_1;
      const holder2 = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, 10, SYMBOL);
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(),
        value.toString());
    });

    it('should be possible to get asset balance for holder', async () => {
      const symbol2 = bytes32(10);
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.issueAsset(
        symbol2, VALUE-10, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
    });

    it('should be possible to get asset balance for non owner', async () => {
      const amount = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(NON_OWNER, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), amount);
    });

    it('should be possible to get asset balance for missing holder', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to get missing asset balance for holder', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, NON_ASSET)).valueOf(), 0);
    });

    it('should be possible to get missing asset balance for missing holder', async () => {
      const NON_OWNER = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, NON_ASSET)).valueOf(), 0);
    });

    it('should not be possible to get name of missing asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.name.call(NON_ASSET)).valueOf(), '');
    });

    it('should not be possible to get description of missing asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.description.call(NON_ASSET)).valueOf(), '');
    });

    it('should not be possible to get base unit of missing asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal((await etoken2.baseUnit.call(NON_ASSET)).valueOf(), 0);
    });

    it('should not be possible to get reissuability of missing asset', async () => {
      const isReissuable = true;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, isReissuable);
      assert.isFalse(await etoken2.isReissuable.call(NON_ASSET));
    });

    it('should not be possible to get owner of missing asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.owner.call(NON_ASSET)).valueOf(), ADDRESS_ZERO);
    });

    it('should not be possible to get total supply of missing asset', async () => {
      assert.equal((await etoken2.totalSupply.call(SYMBOL)).valueOf(), 0);
    });
  });

  describe('Change ownership', () => {
    it('should not be possible to change ownership by non-owner', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.changeOwnership(SYMBOL, NON_OWNER, {from: NON_OWNER});
      assert.equal((await etoken2.owner.call(SYMBOL)).valueOf(), OWNER);
    });

    it('should not be possible to change ownership to the same owner', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.changeOwnership(SYMBOL, OWNER);
      await assertError(result);
      assert.equal((await etoken2.owner.call(SYMBOL)).valueOf(), OWNER);
    });

    it('should not be possible to change ownership of missing asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.changeOwnership(NON_ASSET, NON_OWNER);
      assert.equal((await etoken2.owner.call(SYMBOL)).valueOf(), OWNER);
      assert.equal(
        (await etoken2.owner.call(NON_ASSET)).valueOf(), ADDRESS_ZERO);
    });

    it('should be possible to change ownership of asset', async () => {
      const newOwner = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = getEvents(await etoken2.changeOwnership(SYMBOL, newOwner));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), OWNER);
      assert.equal(result[0].args.to.valueOf(), newOwner);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal((await etoken2.owner.call(SYMBOL)).valueOf(), newOwner);
    });

    it('should be possible to reissue after ownership change', async () => {
      const newOwner = accounts[1];
      const amount = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, REISSUABLE);
      await etoken2.changeOwnership(SYMBOL, newOwner);
      await etoken2.reissueAsset(SYMBOL, amount, {from: newOwner});
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE + amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.balanceOf.call(newOwner, SYMBOL)).valueOf(), amount);
    });

    it('should be possible to revoke after ownership change to missing account', async () => {
      const newOwner = accounts[1];
      const amount = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.changeOwnership(SYMBOL, newOwner);
      await etoken2.transfer(newOwner, amount, SYMBOL);
      await etoken2.revokeAsset(SYMBOL, amount, {from: newOwner});
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE - amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        VALUE - amount);
      assert.equal(
        (await etoken2.balanceOf.call(newOwner, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to revoke after ownership change to existing account', async () => {
      const newOwner = accounts[1];
      const amount = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(newOwner, amount, SYMBOL);
      await etoken2.changeOwnership(SYMBOL, newOwner);
      await etoken2.revokeAsset(SYMBOL, amount, {from: newOwner});
      assert.equal(
        (await etoken2.totalSupply.call(SYMBOL)).valueOf(), VALUE - amount);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        VALUE - amount);
      assert.equal(
        (await etoken2.balanceOf.call(newOwner, SYMBOL)).valueOf(), 0);
    });

    it('should keep ownership change separated between assets', async () => {
      const newOwner = accounts[1];
      const symbol2 = bytes32(10);
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.issueAsset(
        symbol2, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.changeOwnership(SYMBOL, newOwner);
      assert.equal((await etoken2.owner.call(SYMBOL)).valueOf(), newOwner);
      assert.equal((await etoken2.owner.call(symbol2)).valueOf(), OWNER);
    });
  });

  describe('Transfer', () => {
    it('should not be possible to transfer missing asset', async () => {
      const amount = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(NON_OWNER, amount, NON_ASSET);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, NON_ASSET)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, NON_ASSET)).valueOf(), 0);
    });

    it('should not be possible to transfer amount 1 with balance 0', async () => {
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(NON_OWNER, VALUE, SYMBOL);
      await etoken2.transfer(NON_OWNER, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), 0);
    });

    it('should not be possible to transfer amount 2 with balance 1', async () => {
      const value = 1;
      const amount = 2;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(NON_OWNER, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), value);
    });

    it('should not be possible to transfer amount (2**256 - 1) with balance (2**256 - 2)', async () => {
      const value = UINT_256_MINUS_2;
      const amount = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(NON_OWNER, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
        value.toString());
    });

    it('should not be possible to transfer amount 0', async () => {
      const amount = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.transfer(NON_OWNER, amount, SYMBOL);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to transfer to oneself', async () => {
      const amount = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.transfer(OWNER, amount, SYMBOL);
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to transfer amount (2**256 - 1) to holder with 1 balance', async () => {
      // Situation is impossible due to impossibility to
      // issue more than (2**256 - 1) tokens for the asset.
    });

    it('should not be possible to transfer amount 1 to holder with (2**256 - 1) balance', async () => {
      // Situation is impossible due to impossibility
      // to issue more than (2**256 - 1) tokens for the asset.
    });

    it('should not be possible to transfer amount 2**255 to holder with 2**255 balance', async () => {
      // Situation is impossible due to impossibility to
      // issue more than (2**256 - 1) tokens for the asset.
    });

    it('should be possible to transfer amount 2**255 to holder with (2**255 - 1) balance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const value = UINT_256_MINUS_1;
      const amount = UINT_255;
      const balance2 = UINT_255_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, balance2, SYMBOL);
      await etoken2.transfer(holder2, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(),
        value.toString());
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer amount (2**255 - 1) to holder with 2**255 balance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const value = UINT_256_MINUS_1;
      const amount = UINT_255_MINUS_1;
      const balance2 = UINT_255;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, balance2, SYMBOL);
      await etoken2.transfer(holder2, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(),
        value.toString());
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer amount (2**256 - 2) to holder with 1 balance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const value = UINT_256_MINUS_1;
      const amount = UINT_256_MINUS_2;
      const balance2 = 1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, balance2, SYMBOL);
      await etoken2.transfer(holder2, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(),
        value.toString());
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer amount 1 to holder with (2**256 - 2) balance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const value = UINT_256_MINUS_1;
      const amount = 1;
      const balance2 = UINT_256_MINUS_2;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, balance2, SYMBOL);
      await etoken2.transfer(holder2, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(),
        value.toString());
      assert.equal((await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer amount 1 to existing holder with 0 balance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, VALUE, SYMBOL);
      await etoken2.transfer(holder, amount, SYMBOL, {from: holder2});
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(),
        VALUE - amount);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), amount);
    });

    it('should be possible to transfer amount 1 to missing holder', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(), amount);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        VALUE - amount);
    });

    it('should be possible to transfer amount 1 to holder with non-zero balance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const balance2 = 100;
      const amount = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, balance2, SYMBOL);
      await etoken2.transfer(holder2, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(),
        balance2 + amount);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        VALUE - balance2 - amount);
    });

    it('should be possible to transfer amount (2**256 - 1) to existing holder with 0 balance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const amount = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, amount, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, amount, SYMBOL);
      await etoken2.transfer(holder, amount, SYMBOL, {from: holder2});
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        amount.toString());
    });

    it('should be possible to transfer amount (2**256 - 1) to missing holder', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const amount = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, amount, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(holder2, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(),
        amount.toString());
      assert.equal((await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });

    it('should keep transfers separated between assets', async () => {
      const symbol2 = bytes32(200);
      const value = 500;
      const value2 = 1000;
      const holder = accounts[0];
      const holder2 = accounts[1];
      const amount = 100;
      const amount2 = 33;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.issueAsset(
        symbol2, value2, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      let result = getEvents(await etoken2.transfer(holder2, amount, SYMBOL));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), holder);
      assert.equal(result[0].args.to.valueOf(), holder2);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal(result[0].args.value.valueOf(), amount);
      assert.equal(result[0].args.ref, '');
      result = getEvents(await etoken2.transfer(holder2, amount2, symbol2));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), holder);
      assert.equal(result[0].args.to.valueOf(), holder2);
      assert.equal(result[0].args.symbol.valueOf(), symbol2);
      assert.equal(result[0].args.value.valueOf(), amount2);
      assert.equal(result[0].args.ref, '');
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        value - amount);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(), amount);
      assert.equal(
        (await etoken2.balanceOf.call(holder, symbol2)).valueOf(),
        value2 - amount2);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, symbol2)).valueOf(), amount2);
    });

    it('should be possible to do transfer with reference', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const reference = 'Invoice#AS001';
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = getEvents(
        await etoken2.transferWithReference(holder2, VALUE, SYMBOL, reference));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), holder);
      assert.equal(result[0].args.to.valueOf(), holder2);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal(result[0].args.value.valueOf(), VALUE);
      assert.equal(result[0].args.ref, reference);
      assert.equal(
        (await etoken2.balanceOf.call(holder2, SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });
  });

  describe('Allowance transfer', () => {
    it('should not be possible to do allowance transfer by not allowed existing spender, from existing holder', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 100;
      const expectedSpenderBalance = 100;
      const expectedHolderBalance = VALUE - value;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(spender, value, SYMBOL);
      await etoken2.transferFrom(holder, spender, 50, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should not be possible to do allowance transfer by not allowed existing spender, from missing holder', async () => {
      const holder = accounts[2];
      const spender = accounts[1];
      const value = 100;
      const expectedSpenderBalance = 100;
      const expectedHolderBalance = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(spender, value, SYMBOL);
      await etoken2.transferFrom(holder, spender, 50, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should not be possible to do allowance transfer by not allowed missing spender, from existing holder', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const expectedSpenderBalance = 0;
      const expectedHolderBalance = VALUE;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transferFrom(
        holder, spender, 50, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should not be possible to do allowance transfer by not allowed missing spender, from missing holder', async () => {
      const holder = accounts[2];
      const spender = accounts[1];
      const expectedSpenderBalance = 0;
      const expectedHolderBalance = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transferFrom(holder, spender, 50, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should not be possible to do allowance transfer from and to the same holder', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, 50, SYMBOL);
      const result = await etoken2.transferFrom(
        holder, holder, 50, SYMBOL, {from: spender});
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), VALUE);
    });

    it('should be possible to do allowance transfer from oneself', async () => {
      const holder = accounts[0];
      const receiver = accounts[1];
      const amount = 50;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transferFrom(holder, receiver, amount, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        VALUE - amount);
      assert.equal(
        (await etoken2.balanceOf.call(receiver, SYMBOL)).valueOf(), amount);
    });

    it('should not be possible to do allowance transfer with 0 value', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 0;
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, 100, SYMBOL);
      const result = await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      await assertError(result);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
    });

    it('should not be possible to do allowance transfer with value less than balance, more than allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 1000;
      const value = 999;
      const allowed = 998;
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
    });

    it('should not be possible to do allowance transfer with value equal to balance, more than allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 1000;
      const value = 1000;
      const allowed = 999;
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
    });

    it('should not be possible to do allowance transfer with value more than balance, less than allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 199;
      const value = 200;
      const allowed = 201;
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
    });

    it('should not be possible to do allowance transfer with value less than balance, more than allowed after another tranfer', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 102;
      const anotherValue = 10;
      const value = 91;
      const allowed = 100;
      const expectedHolderBalance = balance - anotherValue;
      const resultValue = anotherValue;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, anotherValue, SYMBOL, {from: spender});
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
    });

    it('should not be possible to do allowance transfer with missing symbol when allowed for another symbol', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 1000;
      const value = 200;
      const allowed = 1000;
      const missingSymbol = bytes32(33);
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, missingSymbol, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
      assert.equal(
        (await etoken2.balanceOf.call(holder, missingSymbol)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(spender, missingSymbol)).valueOf(), 0);
    });

    it('should not be possible to do allowance transfer when allowed for another symbol', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 1000;
      const value = 200;
      const allowed = 1000;
      const symbol2 = bytes32(2);
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.issueAsset(
        symbol2, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, symbol2, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
      assert.equal(
        (await etoken2.balanceOf.call(holder, symbol2)).valueOf(), balance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, symbol2)).valueOf(), 0);
    });

    it('should not be possible to do allowance transfer with missing symbol when not allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 1000;
      const value = 200;
      const missingSymbol = bytes32(33);
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transferFrom(
        holder, spender, value, missingSymbol, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), resultValue);
      assert.equal(
        (await etoken2.balanceOf.call(holder, missingSymbol)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(spender, missingSymbol)).valueOf(), 0);
    });

    it('should be possible to do allowance transfer by allowed existing spender', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const existValue = 100;
      const value = 300;
      const expectedHolderBalance = VALUE - existValue - value;
      const expectedSpenderBalance = existValue + value;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(spender, existValue, SYMBOL);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should be possible to do allowance transfer by allowed missing spender', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 300;
      const expectedHolderBalance = VALUE - value;
      const expectedSpenderBalance = value;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should be possible to do allowance transfer to oneself', async () => {
      // Covered by 'should be possible to do
      // allowance transfer by allowed existing spender'.
    });

    it('should be possible to do allowance transfer to existing holder', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const receiver = accounts[2];
      const existValue = 100;
      const value = 300;
      const expectedHolderBalance = VALUE - existValue - value;
      const expectedReceiverBalance = existValue + value;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(receiver, existValue, SYMBOL);
      await etoken2.approve(spender, value, SYMBOL);
      const result = getEvents(
        await etoken2.transferFrom(
          holder, receiver, value, SYMBOL, {from: spender}));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), holder);
      assert.equal(result[0].args.to.valueOf(), receiver);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal(result[0].args.value.valueOf(), value);
      assert.equal(result[0].args.ref, '');
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(receiver, SYMBOL)).valueOf(),
        expectedReceiverBalance);
    });

    it('should be possible to do allowance transfer to missing holder', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const receiver = accounts[2];
      const value = 300;
      const expectedHolderBalance = VALUE - value;
      const expectedReceiverBalance = value;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, receiver, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(receiver, SYMBOL)).valueOf(),
        expectedReceiverBalance);
    });

    it('should be possible to do allowance transfer with value less than balance and less than allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 201;
      const value = 200;
      const allowed = 201;
      const expectedHolderBalance = balance - value;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), value);
    });

    it('should be possible to do allowance transfer with value less than balance and equal to allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 201;
      const value = 200;
      const allowed = 200;
      const expectedHolderBalance = balance - value;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), value);
    });

    it('should be possible to do allowance transfer with value equal to balance and less than allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 200;
      const value = 200;
      const allowed = 201;
      const expectedHolderBalance = balance - value;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), value);
    });

    it('should be possible to do allowance transfer with value equal to balance and equal to allowed', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 200;
      const value = 200;
      const allowed = 200;
      const expectedHolderBalance = balance - value;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(), value);
    });

    it('should be possible to do allowance transfer with value less than balance and less than allowed after another transfer', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 201;
      const anotherValue = 1;
      const value = 199;
      const allowed = 201;
      const expectedSpenderBalance = anotherValue + value;
      const expectedHolderBalance = balance - anotherValue - value;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, anotherValue, SYMBOL, {from: spender});
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should be possible to do allowance transfer with value less than balance and equal to allowed after another transfer', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const balance = 201;
      const anotherValue = 1;
      const value = 199;
      const allowed = 200;
      const expectedSpenderBalance = anotherValue + value;
      const expectedHolderBalance = balance - anotherValue - value;
      await etoken2.issueAsset(
        SYMBOL, balance, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, allowed, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, anotherValue, SYMBOL, {from: spender});
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should be possible to do allowance transfer with value (2**256 - 1)', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await etoken2.balanceOf.call(spender, SYMBOL)).valueOf(),
        value.toString());
    });

    it('should be possible to do allowance transfer with reference', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const receiver = accounts[2];
      const value = 300;
      const expectedHolderBalance = VALUE - value;
      const expectedReceiverBalance = value;
      const reference = 'just some arbitrary string.';
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      const result = getEvents(
        await etoken2.transferFromWithReference(
          holder, receiver, value, SYMBOL, reference, {from: spender}));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), holder);
      assert.equal(result[0].args.to.valueOf(), receiver);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal(result[0].args.value.valueOf(), value);
      assert.equal(result[0].args.ref, reference);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await etoken2.balanceOf.call(receiver, SYMBOL)).valueOf(),
        expectedReceiverBalance);
    });

    it('should await 0 allowance after another transfer', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 300;
      const resultValue = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, value, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        resultValue);
    });

    it('should await 1 allowance after another transfer', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const receiver = accounts[2];
      const value = 300;
      const transfer = 299;
      const resultValue = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, receiver, transfer, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        resultValue);
    });

    it('should await 2**255 allowance after another transfer', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = UINT_256_MINUS_1;
      const transfer = UINT_255_MINUS_1;
      const resultValue = UINT_255;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, transfer, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        resultValue.toString());
    });

    it('should await (2**256 - 2) allowance after another transfer', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = UINT_256_MINUS_1;
      const transfer = 1;
      const resultValue = UINT_256_MINUS_2;
      await etoken2.issueAsset(
        SYMBOL, value, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.transferFrom(
        holder, spender, transfer, SYMBOL, {from: spender});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        resultValue.toString());
    });
  });

  describe('Allowance', () => {
    it('should not be possible to set allowance for missing symbol', async () => {
      const spender = accounts[1];
      const missingSymbol = bytes32(33);
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.approve(spender, 100, missingSymbol);
      await assertError(result);
      assert.equal(
        (await etoken2.allowance.call(OWNER, spender, missingSymbol)).valueOf(),
        0);
    });

    it('should not be possible to set allowance for missing symbol for oneself', async () => {
      const missingSymbol = bytes32(33);
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.approve(OWNER, 100, missingSymbol);
      await assertError(result);
      assert.equal(
        (await etoken2.allowance.call(OWNER, OWNER, missingSymbol)).valueOf(),
        0);
    });

    it('should not be possible to set allowance for oneself', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = await etoken2.approve(OWNER, 100, SYMBOL);
      await assertError(result);
      assert.equal(
        (await etoken2.allowance.call(OWNER, OWNER, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to set allowance from missing holder to missing holder', async () => {
      const holder = accounts[1];
      const spender = accounts[2];
      const value = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = getEvents(
        await etoken2.approve(spender, value, SYMBOL, {from: holder}));
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), holder);
      assert.equal(result[0].args.spender.valueOf(), spender);
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal(result[0].args.value.valueOf(), value);
      assert.equal((await etoken2.allowance.call(
        holder, spender, SYMBOL)).valueOf(), value);
    });

    it('should be possible to set allowance from missing holder to existing holder', async () => {
      const holder = accounts[1];
      const spender = accounts[0];
      const value = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(
        spender, value, SYMBOL, {from: holder});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to set allowance from existing holder to missing holder', async () => {
      const holder = accounts[0];
      const spender = accounts[2];
      const value = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(
        spender, value, SYMBOL, {from: holder});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to set allowance from existing holder to existing holder', async () => {
      const holder = accounts[0];
      const spender = accounts[2];
      const value = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(spender, 1, SYMBOL, {from: holder});
      await etoken2.approve(spender, value, SYMBOL, {from: holder});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to set allowance value 0', async () => {
      // Covered by 'should be possible to
      // override allowance value with 0 value'.
    });

    it('should be possible to set allowance with (2**256 - 1) value', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = UINT_256_MINUS_1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value.toString());
    });

    it('should be possible to set allowance value less then balance', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 1;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to set allowance value equal to balance', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = VALUE;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to set allowance value more then balance', async () => {
      // Covered by 'should be possible to set
      // allowance with (2**256 - 1) value'.
    });

    it('should be possible to override allowance value with 0 value', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 0;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, 100, SYMBOL);
      await etoken2.approve(spender, value, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to override allowance value with non 0 value', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 1000;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, 100, SYMBOL);
      await etoken2.approve(spender, value, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should not affect balance when setting allowance', async () => {
      const holder = accounts[0];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(accounts[1], 100, SYMBOL);
      assert.equal(
        (await etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        VALUE);
    });

    it('should be possible to set allowance', async () => {
      // Covered by other tests above.
    });

    it('should await 0 allowance for existing owner and not allowed existing spender', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(spender, 100, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(), 0);
    });

    it('should await 0 allowance for existing owner and not allowed missing spender', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(), 0);
    });

    it('should await 0 allowance for missing owner and existing spender', async () => {
      const holder = accounts[1];
      const spender = accounts[0];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        0);
    });

    it('should await 0 allowance for missing owner and missing spender', async () => {
      const holder = accounts[1];
      const spender = accounts[2];
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(), 0);
    });

    it('should await 0 allowance for existing oneself', async () => {
      const holder = accounts[0];
      const spender = holder;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(), 0);
    });

    it('should await 0 allowance for missing oneself', async () => {
      const holder = accounts[1];
      const spender = holder;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(), 0);
    });

    it('should await 0 allowance for missing symbol', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const missingSymbol = bytes32(33);
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(
        spender, 100, SYMBOL);
      assert.equal((await etoken2.allowance.call(
        holder, spender, missingSymbol)).valueOf(), 0);
    });

    it('should respect symbol when telling allowance', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const symbol = SYMBOL;
      const symbol2 = bytes32(2);
      const value = 100;
      const value2 = 200;
      await etoken2.issueAsset(
        symbol, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.issueAsset(
        symbol2, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, symbol);
      await etoken2.approve(spender, value2, symbol2);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, symbol)).valueOf(),
        value);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, symbol2)).valueOf(),
        value2);
    });

    it('should respect holder when telling allowance', async () => {
      const holder = accounts[0];
      const holder2 = accounts[1];
      const spender = accounts[2];
      const value = 100;
      const value2 = 200;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.approve(spender, value2, SYMBOL, {from: holder2});
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
      assert.equal(
        (await etoken2.allowance.call(holder2, spender, SYMBOL)).valueOf(),
        value2);
    });

    it('should respect spender when telling allowance', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const spender2 = accounts[2];
      const value = 100;
      const value2 = 200;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      await etoken2.approve(spender2, value2, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
      assert.equal(
        (await etoken2.allowance.call(holder, spender2, SYMBOL)).valueOf(),
        value2);
    });

    it('should be possible to check allowance of existing owner and allowed existing spender', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 300;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.transfer(spender, 100, SYMBOL);
      await etoken2.approve(spender, value, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to check allowance of existing owner and allowed missing spender', async () => {
      const holder = accounts[0];
      const spender = accounts[1];
      const value = 300;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.approve(spender, value, SYMBOL);
      assert.equal(
        (await etoken2.allowance.call(holder, spender, SYMBOL)).valueOf(),
        value);
    });
  });

  describe('Proxy', () => {
    it('should allow transfer froms from user contracts', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, true, {from: accounts[1]});
      await etoken2.approve(
        userContract.address, VALUE, SYMBOL, {from: accounts[1]});
      await userContract.transferFromWithReference(
        accounts[1], accounts[2], VALUE, SYMBOL, '');
      assert.equal((await etoken2.balanceOf(
        accounts[1], SYMBOL)).valueOf(), 0);
      assert.equal((await etoken2.balanceOf(
        accounts[2], SYMBOL)).valueOf(), VALUE);
      assert.equal((await etoken2.allowance(
        accounts[1], userContract.address, SYMBOL)).valueOf(), 0);
    });

    it('should allow approves from user contracts', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, true);
      await userContract.approve(
        accounts[1], VALUE, SYMBOL);
      assert.equal((await etoken2.allowance(
        userContract.address, accounts[1], SYMBOL)).valueOf(), VALUE);
    });

    it('should allow transfers from to ICAP from user contracts', async () => {
      const _icap = web3.utils.fromAscii('XE73TSTXREG123456789');
      const icap = await RegistryICAPTestable.new();
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, true);
      await etoken2.setupRegistryICAP(icap.address);
      await icap.registerAsset('TST', SYMBOL);
      await icap.registerInstitution('XREG', accounts[2]);
      await icap.registerInstitutionAsset(
        'TST', 'XREG', accounts[2], {from: accounts[2]});
      await etoken2.approve(userContract.address, VALUE, SYMBOL);
      await userContract.transferFromToICAPWithReference(
        accounts[0], _icap, VALUE, '');
      assert.equal((await etoken2.balanceOf(
        accounts[0], SYMBOL)).valueOf(), 0);
      assert.equal((await etoken2.balanceOf(
        accounts[2], SYMBOL)).valueOf(), VALUE);
    });
  });

  describe('ICAP', () => {
    it('should be possible to do transfer to ICAP', async () => {
      const _icap = web3.utils.fromAscii('XE73TSTXREG123456789');
      const icap = await RegistryICAPTestable.new();
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.setupRegistryICAP(icap.address);
      await icap.registerAsset('TST', SYMBOL);
      await icap.registerInstitution('XREG', accounts[2]);
      await icap.registerInstitutionAsset(
        'TST', 'XREG', accounts[2], {from: accounts[2]});
      const result = getEvents(await etoken2.transferToICAP(_icap, 100));
      assert.equal(result.length, 2);
      assert.equal(result[1].event, 'TransferToICAP');
      assert.equal(result[1].args.from.valueOf(), accounts[0]);
      assert.equal(result[1].args.to.valueOf(), accounts[2]);
      assert.equal(
        result[1].args.icap.valueOf().substr(0, 42), _icap);
      assert.equal(result[1].args.value, 100);
      assert.equal(result[1].args.ref, '');
      assert.equal(
        (await etoken2.balanceOf(accounts[2], SYMBOL)).valueOf(), 100);
      assert.equal(
        (await etoken2.balanceOf(accounts[0], SYMBOL)).valueOf(), VALUE-100);
    });

    it('should be possible to do transfer to ICAP with reference', async () => {
      const _icap = web3.utils.fromAscii('XE73TSTXREG123456789');
      const icap = await RegistryICAPTestable.new();
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.setupRegistryICAP(icap.address);
      await icap.registerAsset('TST', SYMBOL);
      await icap.registerInstitution('XREG', accounts[2]);
      await icap.registerInstitutionAsset(
        'TST', 'XREG', accounts[2], {from: accounts[2]});
      const result = getEvents(
        await etoken2.transferToICAPWithReference(_icap, 100, 'Ref'));
      assert.equal(result.length, 2);
      assert.equal(result[1].event, 'TransferToICAP');
      assert.equal(result[1].args.from.valueOf(), accounts[0]);
      assert.equal(result[1].args.to.valueOf(), accounts[2]);
      assert.equal(
        result[1].args.icap.valueOf().substr(0, 42), _icap);
      assert.equal(result[1].args.value, 100);
      assert.equal(result[1].args.ref, 'Ref');
      assert.equal(
        (await etoken2.balanceOf(accounts[2], SYMBOL)).valueOf(), 100);
      assert.equal(
        (await etoken2.balanceOf(accounts[0], SYMBOL)).valueOf(), VALUE-100);
    });

    it('should be possible to do transfer from to ICAP', async () => {
      const _icap = web3.utils.fromAscii('XE73TSTXREG123456789');
      const icap = await RegistryICAPTestable.new();
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.setupRegistryICAP(icap.address);
      await icap.registerAsset('TST', SYMBOL);
      await icap.registerInstitution('XREG', accounts[2]);
      await icap.registerInstitutionAsset(
        'TST', 'XREG', accounts[2], {from: accounts[2]});
      await etoken2.approve(accounts[1], 200, SYMBOL);
      const result = getEvents(
        await etoken2.transferFromToICAP(
          accounts[0], _icap, 100, {from: accounts[1]}));
      assert.equal(result.length, 2);
      assert.equal(result[1].event, 'TransferToICAP');
      assert.equal(result[1].args.from.valueOf(), accounts[0]);
      assert.equal(result[1].args.to.valueOf(), accounts[2]);
      assert.equal(
        result[1].args.icap.valueOf().substr(0, 42), _icap);
      assert.equal(result[1].args.value, 100);
      assert.equal(result[1].args.ref, '');
      assert.equal(
        (await etoken2.balanceOf(accounts[2], SYMBOL)).valueOf(), 100);
      assert.equal(
        (await etoken2.balanceOf(accounts[0], SYMBOL)).valueOf(), VALUE-100);
      assert.equal(
        (await etoken2.allowance(accounts[0], accounts[1], SYMBOL)).valueOf(),
        100);
    });

    it('should be possible to do transfer from to ICAP with reference', async () => {
      const _icap = web3.utils.fromAscii('XE73TSTXREG123456789');
      const icap = await RegistryICAPTestable.new();
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.setupRegistryICAP(icap.address);
      await icap.registerAsset('TST', SYMBOL);
      await icap.registerInstitution('XREG', accounts[2]);
      await icap.registerInstitutionAsset(
        'TST', 'XREG', accounts[2], {from: accounts[2]});
      await etoken2.approve(accounts[1], 200, SYMBOL);
      const result = getEvents(
        await etoken2.transferFromToICAPWithReference(
          accounts[0], _icap, 100, 'Ref', {from: accounts[1]}));
      assert.equal(result.length, 2);
      assert.equal(result[1].event, 'TransferToICAP');
      assert.equal(result[1].args.from.valueOf(), accounts[0]);
      assert.equal(result[1].args.to.valueOf(), accounts[2]);
      assert.equal(
        result[1].args.icap.valueOf().substr(0, 42), _icap);
      assert.equal(result[1].args.value, 100);
      assert.equal(result[1].args.ref, 'Ref');
      assert.equal(
        (await etoken2.balanceOf(accounts[2], SYMBOL)).valueOf(), 100);
      assert.equal(
        (await etoken2.balanceOf(accounts[0], SYMBOL)).valueOf(), VALUE-100);
      assert.equal(
        (await etoken2.allowance(accounts[0], accounts[1], SYMBOL)).valueOf(),
        100);
    });
  });

  describe('Lock asset', () => {
    it('should be possible to check is locked', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      assert.isFalse(await etoken2.isLocked.call(SYMBOL));
    });

    it('should be possible to lock asset', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.lockAsset(SYMBOL);
      assert.isTrue(await etoken2.isLocked.call(SYMBOL));
    });

    it('should not be possible to change asset after lock', async () => {
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      await etoken2.lockAsset(SYMBOL);
      await etoken2.changeAsset(SYMBOL, 'New name', 'New description', 100);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), NAME);
      assert.equal(
        (await etoken2.description.call(SYMBOL)).valueOf(), DESCRIPTION);
      assert.equal((await etoken2.baseUnit.call(SYMBOL)).valueOf(), BASE_UNIT);
    });

    it('should be possible to change asset before lock', async () => {
      const newName = 'New name';
      const newDescription = 'New description';
      const newBaseUnit = 100;
      await etoken2.issueAsset(
        SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, NOT_REISSUABLE);
      const result = getEvents(
        await etoken2.changeAsset(
          SYMBOL, newName, newDescription, newBaseUnit));
      assert.equal(result.length, 1);
      assert.equal(result[0].event, 'Change');
      assert.equal(result[0].args.symbol.valueOf(), SYMBOL);
      assert.equal((await etoken2.name.call(SYMBOL)).valueOf(), newName);
      assert.equal(
        (await etoken2.description.call(SYMBOL)).valueOf(), newDescription);
      assert.equal(
        (await etoken2.baseUnit.call(SYMBOL)).valueOf(), newBaseUnit);
    });
  });
});
