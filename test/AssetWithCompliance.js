const Ganache = require('../dependencies/test/helpers/ganache');
const bytes32 = require('../dependencies/test/helpers/bytes32');
const asserts = require('../dependencies/test/helpers/asserts')(assert);
const AssertExpectations = require('../dependencies/test/helpers/assertExpectations');

const Listener = artifacts.require('./Listener');
const EToken2Testable = artifacts.require('./EToken2Testable');
const RegistryICAPTestable = artifacts.require('./RegistryICAPTestable');
const Stub = artifacts.require('./Stub');
const UserContract = artifacts.require('./UserContract');
const AssetProxy = artifacts.require('./AssetProxy');
const AssetWithCompliance = artifacts.require('./AssetWithCompliance');
const Ambi2Fake = artifacts.require('./Ambi2Fake');
const ComplianceConfiguration = artifacts.require('./ComplianceConfiguration');
const Mock = artifacts.require('./Mock');

const assetBase = require('./assetBase');
const assetRecoveryTokens = require('./assetRecoveryTokens');

contract('AssetWithCompliance', function(accounts) {
  const ganache = new Ganache(web3);
  afterEach('revert', ganache.revert);

  let ambi2Fake;
  const complianceConfiguration = new web3.eth.Contract(
    ComplianceConfiguration.abi, accounts[5]);
  let mock;
  let assertExpectations;

  const USER = accounts[0];
  const RECIPIENT = accounts[1];
  const AMOUNT = 1;
  const ICAP_STRING = 'XE73TSTXREG123456789';
  const ICAP = web3.utils.fromAscii(ICAP_STRING);
  const ICAP_ADDRESS = accounts[2];
  const SPENDER = accounts[3];
  const TRUE = bytes32(1);
  const FALSE = bytes32(0);

  const PROCESS_TRANSFER_SIG =
    complianceConfiguration.methods.processTransferResult(
      accounts[0], accounts[1], 1, true).encodeABI().slice(0, 10);
  const PROCESS_ICAP_SIG =
    complianceConfiguration.methods.processTransferToICAPResult(
      accounts[0], bytes32('0'), 1, true).encodeABI().slice(0, 10);
  const TRANSFER_ALLOWED_SIG =
    complianceConfiguration.methods.isTransferAllowed(
      accounts[0], accounts[1], 1).encodeABI().slice(0, 10);
  const ICAP_ALLOWED_SIG =
    complianceConfiguration.methods.isTransferToICAPAllowed(
      accounts[0], bytes32('0'), 1).encodeABI().slice(0, 10);
  const ROLE = web3.utils.fromAscii('admin');
  const LEGAL = web3.utils.fromAscii('legal');
  const ALLOWED = accounts[1];
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

  before('setup others', async function() {
    this.Listener = Listener;
    this.UserContract = UserContract;
    this.AssetProxy = AssetProxy;
    this.assetProxy = await AssetProxy.new();
    mock = await Mock.new();
    assertExpectations = new AssertExpectations(assert, mock);
    this.etoken2 = await EToken2Testable.new();
    const instance = await AssetWithCompliance.new();
    this.assetWithCompliance = instance;
    this.asset = instance;
    this.assetProxyRecovery = await AssetProxy.new();
    this.assetWithComplianceRecovery = await AssetWithCompliance.new();

    this.ICAP = await RegistryICAPTestable.new();
    ambi2Fake = await Ambi2Fake.new();
    await this.etoken2.setupEventsHistory((await Stub.new()).address);
    await this.etoken2.setupRegistryICAP(this.ICAP.address);
    await this.etoken2.issueAsset(
      SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, IS_REISSUABLE);
    await this.etoken2.issueAsset(
      SYMBOL2, VALUE2, NAME, DESCRIPTION, BASE_UNIT, IS_REISSUABLE);
    await this.etoken2.__enableProxyCheck();
    await this.ICAP.registerAsset('TST', SYMBOL);
    await this.ICAP.registerInstitution('XREG', accounts[2]);
    await this.ICAP.registerInstitutionAsset(
      'TST', 'XREG', accounts[2], {from: accounts[2]});

    await this.assetProxyRecovery.init(
      this.etoken2.address, SYMBOL2_STRING, NAME);
    await this.assetProxyRecovery.proposeUpgrade(
      this.assetWithComplianceRecovery.address);
    await this.assetWithComplianceRecovery.init(
      this.assetProxyRecovery.address);

    await this.assetProxy.init(this.etoken2.address, SYMBOL_STRING, NAME);
    await this.assetProxy.proposeUpgrade(this.assetWithCompliance.address);
    await this.assetWithCompliance.init(this.assetProxy.address);
    await this.assetWithCompliance.setupAmbi2(ambi2Fake.address);
    await mock.ignore(PROCESS_TRANSFER_SIG, true);
    await mock.ignore(PROCESS_ICAP_SIG, true);
    await ambi2Fake.setAllowed(this.assetWithCompliance.address, ROLE, ALLOWED);
    await ganache.snapshot();
  });

  it('should allow to setup Compliance Configuration for user with specfifc role', async function() {
    assert.isTrue(
      await this.assetWithCompliance.setupComplianceConfiguration.call(
        complianceConfiguration._address, {from: ALLOWED}));
  });

  it('should emit ComplianceConfigurationSet event when admin sets up Compliance Configuration', async function() {
    const result = await this.assetWithCompliance.setupComplianceConfiguration(
      complianceConfiguration._address, {from: ALLOWED});
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].event, 'ComplianceConfigurationSet');
    assert.equal(result.logs[0].args.contractAddress, accounts[5]);
  });

  it('should not allow to setup Compliance Configuration for user without specfifc role', async function() {
    await assert.isFalse(
      await this.assetWithCompliance.setupComplianceConfiguration.call(
        complianceConfiguration._address, {from: accounts[2]}));
  });

  it('should transfer to address if it is allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferAllowed(
        USER,
        RECIPIENT,
        AMOUNT
      ).encodeABI(), TRUE);
    await this.assetProxy.transfer(RECIPIENT, AMOUNT, {from: USER});
    assert.equal(
      (await this.etoken2.balanceOf(USER, SYMBOL)).valueOf(), VALUE - AMOUNT);
    assert.equal(
      (await this.etoken2.balanceOf(RECIPIENT, SYMBOL)).valueOf(), AMOUNT);
    await assertExpectations();
  });

  it('should throw when calling fallback function', async function() {
    const assetWithComplianceNoFallback = await ComplianceConfiguration.at(
      this.assetWithCompliance.address);

    await asserts.throws(assetWithComplianceNoFallback.isTransferAllowed(
      USER, RECIPIENT, 1, {from: ALLOWED}));
  });

  it('should NOT transfer to address if it is NOT allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferAllowed(
        USER,
        RECIPIENT,
        AMOUNT
      ).encodeABI(), FALSE);
    await this.assetProxy.transfer(RECIPIENT, AMOUNT, {from: USER});
    assert.equal((await this.etoken2.balanceOf(USER, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf(
      RECIPIENT, SYMBOL)).valueOf(), 0);
    await assertExpectations();
  });


  it('should transfer to ICAP if it is allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferToICAPAllowed(
        USER,
        ICAP,
        AMOUNT
      ).encodeABI(), TRUE);
    await this.assetProxy.transferToICAP(ICAP_STRING, AMOUNT, {from: USER});
    assert.equal((await this.etoken2.balanceOf(
      USER, SYMBOL)).valueOf(), VALUE - AMOUNT);
    assert.equal((await this.etoken2.balanceOf(
      ICAP_ADDRESS, SYMBOL)).valueOf(), AMOUNT);
    await assertExpectations();
  });

  it('should NOT transfer to ICAP if it is NOT allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferToICAPAllowed(
        USER,
        ICAP,
        AMOUNT
      ).encodeABI(), FALSE);
    await this.assetProxy.transferToICAP(ICAP_STRING, AMOUNT, {from: USER});
    assert.equal((await this.etoken2.balanceOf(USER, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf(
      ICAP_ADDRESS, SYMBOL)).valueOf(), 0);
    await assertExpectations();
  });

  it('should transfer from to address if it is allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferAllowed(
        USER,
        RECIPIENT,
        AMOUNT
      ).encodeABI(), TRUE);
    await this.assetProxy.transferFrom(USER, RECIPIENT, AMOUNT, {from: USER});
    assert.equal((await this.etoken2.balanceOf(
      USER, SYMBOL)).valueOf(), VALUE - AMOUNT);
    assert.equal((await this.etoken2.balanceOf(
      RECIPIENT, SYMBOL)).valueOf(), AMOUNT);
    await assertExpectations();
  });

  it('should NOT transfer from to address if it is NOT allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferAllowed(
        USER,
        RECIPIENT,
        AMOUNT
      ).encodeABI(), FALSE);
    await this.assetProxy.transferFrom(USER, RECIPIENT, AMOUNT, {from: USER});
    assert.equal((await this.etoken2.balanceOf(USER, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf(
      RECIPIENT, SYMBOL)).valueOf(), 0);
    await assertExpectations();
  });

  it('should transfer from to ICAP if it is allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferToICAPAllowed(
        USER,
        ICAP,
        AMOUNT
      ).encodeABI(), TRUE);
    await this.assetProxy.transferFromToICAP(USER, ICAP, AMOUNT, {from: USER});
    assert.equal((await this.etoken2.balanceOf(
      USER, SYMBOL)).valueOf(), VALUE - AMOUNT);
    assert.equal((await this.etoken2.balanceOf(
      ICAP_ADDRESS, SYMBOL)).valueOf(), AMOUNT);
    await assertExpectations();
  });

  it('should NOT transfer from to ICAP if it is NOT allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.expectStaticCall(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.isTransferToICAPAllowed(
        USER,
        ICAP,
        AMOUNT
      ).encodeABI(), FALSE);
    await this.assetProxy.transferFromToICAP(USER, ICAP, AMOUNT, {from: USER});
    assert.equal((await this.etoken2.balanceOf(USER, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf(
      ICAP_ADDRESS, SYMBOL)).valueOf(), 0);
    await assertExpectations();
  });

  it('should call processTransferResult after successful transfer', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_TRANSFER_SIG, false);
    await mock.ignore(TRANSFER_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferResult(
        USER,
        RECIPIENT,
        AMOUNT,
        true
      ).encodeABI(), TRUE);
    await this.assetProxy.transfer(RECIPIENT, AMOUNT, {from: USER});
    await assertExpectations();
  });

  it('should call processTransferResult after failed transfer', async function() {
    const amount = VALUE + 1;
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_TRANSFER_SIG, false);
    await mock.ignore(TRANSFER_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferResult(
        USER,
        RECIPIENT,
        amount,
        false
      ).encodeABI(), FALSE);
    await this.assetProxy.transfer(RECIPIENT, amount, {from: USER});
    await assertExpectations();
  });

  it('should call processTransferResult after successful transferFrom', async function() {
    const USER = accounts[0];
    const RECIPIENT = accounts[1];

    const AMOUNT = 1;
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_TRANSFER_SIG, false);
    await mock.ignore(TRANSFER_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferResult(
        USER,
        RECIPIENT,
        AMOUNT,
        true
      ).encodeABI(), TRUE);
    await this.assetProxy.approve(SPENDER, AMOUNT, {from: USER});
    await this.assetProxy.transferFrom(
      USER, RECIPIENT, AMOUNT, {from: SPENDER});
    await assertExpectations();
  });

  it('should call processTransferResult after failed transferFrom', async function() {
    const amount = VALUE + 1;
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_TRANSFER_SIG, false);
    await mock.ignore(TRANSFER_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferResult(
        USER,
        RECIPIENT,
        amount,
        false
      ).encodeABI(), FALSE);
    await this.assetProxy.transferFrom(
      USER, RECIPIENT, amount, {from: SPENDER});
    await assertExpectations();
  });

  it('should call processTransferToICAPResult after successful transfer', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_ICAP_SIG, false);
    await mock.ignore(ICAP_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferToICAPResult(
        USER,
        ICAP,
        AMOUNT,
        true
      ).encodeABI(), TRUE);
    await this.assetProxy
    .methods['transferToICAP(string,uint256)'](
      ICAP_STRING, AMOUNT, {from: USER});
    await assertExpectations();
  });

  it('should call processTransferToICAPResult after failed transfer', async function() {
    const amount = VALUE + 1;
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_ICAP_SIG, false);
    await mock.ignore(ICAP_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferToICAPResult(
        USER,
        ICAP,
        amount,
        false
      ).encodeABI(), FALSE);
    await this.assetProxy
    .methods['transferToICAP(string,uint256)'](
      ICAP_STRING, amount, {from: USER});
    await assertExpectations();
  });

  it('should call processTransferToICAPResult after successful transferFrom', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_ICAP_SIG, false);
    await mock.ignore(ICAP_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferToICAPResult(
        USER,
        ICAP,
        AMOUNT,
        true
      ).encodeABI(), TRUE);
    await this.assetProxy.approve(SPENDER, AMOUNT, {from: USER});
    await this.assetProxy
    .methods['transferFromToICAP(address,string,uint256)'](
      USER, ICAP_STRING, AMOUNT, {from: SPENDER});
    await assertExpectations();
  });

  it('should call processTransferToICAPResult after failed transferFrom', async function() {
    const amount = VALUE + 1;
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_ICAP_SIG, false);
    await mock.ignore(ICAP_ALLOWED_SIG, true);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferToICAPResult(
        USER,
        ICAP,
        amount,
        false
      ).encodeABI(), FALSE);
    await this.assetProxy
    .methods['transferFromToICAP(address,string,uint256)'](
      USER, ICAP_STRING, amount, {from: SPENDER});
    await assertExpectations();
  });

  it('should allow legal transfer even if it is NOT allowed', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await ambi2Fake.setAllowed(
      this.assetWithCompliance.address, LEGAL, SPENDER);
    await this.assetWithCompliance.legalTransferFrom(
      USER, RECIPIENT, AMOUNT, 'legal', {from: SPENDER});
    assert.equal(
      (await this.etoken2.balanceOf(USER, SYMBOL)).valueOf(), VALUE - AMOUNT);
    assert.equal(
      (await this.etoken2.balanceOf(RECIPIENT, SYMBOL)).valueOf(), AMOUNT);
    await assertExpectations();
  });

  it('should NOT allow legal transfer without role', async function() {
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await this.assetWithCompliance.legalTransferFrom(
      USER, RECIPIENT, AMOUNT, 'legal', {from: SPENDER});
    assert.equal(
      (await this.etoken2.balanceOf(USER, SYMBOL)).valueOf(), VALUE);
    assert.equal(
      (await this.etoken2.balanceOf(RECIPIENT, SYMBOL)).valueOf(), 0);
    await assertExpectations();
  });

  it('should call processTransferResult after successful legal transfer', async function() {
    const USER = accounts[0];
    const RECIPIENT = accounts[1];

    const AMOUNT = 1;
    await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
    await this.assetWithCompliance.setupComplianceConfiguration(
      mock.address, {from: ALLOWED});
    await mock.ignore(PROCESS_TRANSFER_SIG, false);
    await mock.expect(
      this.assetWithCompliance.address,
      0,
      complianceConfiguration.methods.processTransferResult(
        USER,
        RECIPIENT,
        AMOUNT,
        true
      ).encodeABI(), TRUE);
    await ambi2Fake.setAllowed(
      this.assetWithCompliance.address, LEGAL, SPENDER);
    await this.assetWithCompliance.legalTransferFrom(
      USER, RECIPIENT, AMOUNT, 'legal', {from: SPENDER});
    await assertExpectations();
  });

  assetBase(accounts);
  assetRecoveryTokens(accounts);
});
