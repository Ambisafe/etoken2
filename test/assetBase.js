const decodeLogs = require('../dependencies/test/helpers/decodelogs');
const asserts = require('../dependencies/test/helpers/asserts')(assert);

const UserContract = artifacts.require('./UserContract');

module.exports = (
  accounts, isReverting = false, includeZeroTransferTest = true) => {
  const bn = (number) => {
    return web3.utils.toBN(number);
  };

  const UINT_256_MINUS_1 = bn(2).pow(bn(256)).subn(1);
  const ADDRESS_ZERO = `0x${'0'.repeat(40)}`;

  const SYMBOL = web3.utils.fromAscii('TEST');
  const SYMBOL2 = web3.utils.fromAscii('TEST2');
  const VALUE = 1001;
  const VALUE2 = 30000;
  const ICAP_STRING = 'XE73TSTXREG123456789';
  const ICAP = web3.utils.fromAscii(ICAP_STRING);

  const OWNER = accounts[0];
  const HOLDER = accounts[0];
  const SPENDER = accounts[1];
  const RECEIVER = accounts[2];
  const HOLDER2 = accounts[3];
  const NON_OWNER = accounts[4];
  const ANOTHER_SPENDER = accounts[5];
  const ICAP_ADDRESS = accounts[2];

  const getEvents = (tx, contract, name = false) => decodeLogs(
    tx.receipt.rawLogs, contract).filter(
    (log) => !name || log.event === name);

  /* eslint-disable no-invalid-this */
  describe('Get info', () => {
    it('should be possible to get total supply', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      assert.equal((await this.assetProxy.totalSupply.call()).valueOf(), VALUE);
    });

    it('should be possible to get balance for holder', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      assert.equal((
        await this.assetProxy.balanceOf.call(accounts[0])).valueOf(), VALUE);
    });

    it('should be possible to get total supply if not allowed', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL2);
      assert.equal((await this.assetProxy.totalSupply.call()).valueOf(), VALUE);
    });

    it('should be possible to get balance if not allowed', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL2);
      assert.equal((
        await this.assetProxy.balanceOf.call(accounts[0])).valueOf(), VALUE);
    });
  });

  describe('Transfer', () => {
    it('should not emit transfer event from not base', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL2);
      const result = getEvents(
        await this.assetProxy.emitTransfer(OWNER, NON_OWNER, 100),
        this.assetProxy
      );
      assert.equal(result.length, 0);
    });

    it('should not be possible to transfer if not allowed', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL2);
      const result = getEvents(
        await this.assetProxy.transfer(NON_OWNER, 100),
        this.assetProxy
      );
      assert.equal(result.length, 0);
      assert.equal((
        await this.etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), 0);
      assert.equal((
        await this.etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to transfer amount 1 with balance 0', async function() {
      const amount = 1;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(NON_OWNER, VALUE);
      if (isReverting) {
        await asserts.throws(this.assetProxy.transfer(NON_OWNER, amount));
      } else {
        await this.assetProxy.transfer(NON_OWNER, amount);
      }
      assert.equal((
        await this.etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(), VALUE);
      assert.equal((
        await this.etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), 0);
    });

    it('should not be possible to transfer amount 2 with balance 1', async function() {
      const value = 1;
      const amount = 2;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(NON_OWNER, VALUE - value);
      if (isReverting) {
        await asserts.throws(this.assetProxy.transfer(NON_OWNER, amount));
      } else {
        await this.assetProxy.transfer(NON_OWNER, amount);
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(),
        VALUE - value
      );
      assert.equal((
        await this.etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(),
      value);
    });

    if (includeZeroTransferTest) {
      it('should not be possible to transfer amount 0', async function() {
        const amount = 0;
        await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
        const result = getEvents(
          await this.assetProxy.transfer(NON_OWNER, amount),
          this.assetProxy);
        assert.equal(result.length, 0);
        assert.equal(
          (await this.etoken2.balanceOf.call(NON_OWNER, SYMBOL)).valueOf(),
          0
        );
        assert.equal((
          await this.etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
      });
    }

    it('should not be possible to transfer to oneself', async function() {
      const amount = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      const result = getEvents(
        await this.assetProxy.transfer(OWNER, amount),
        this.assetProxy);
      assert.equal(result.length, 0);
      assert.equal((
        await this.etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), VALUE);
    });

    it('should be possible to transfer amount 1 to existing holder with 0 balance', async function() {
      const amount = 1;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(HOLDER2, VALUE);
      await this.assetProxy.transfer(HOLDER, amount, {from: HOLDER2});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL)).valueOf(),
        VALUE - amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        amount);
    });

    it('should be possible to transfer amount 1 to missing holder', async function() {
      const amount = 1;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(HOLDER2, amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL)).valueOf(), amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        VALUE - amount);
    });

    it('should be possible to transfer amount 1 to holder with non-zero balance', async function() {
      const balance2 = 100;
      const amount = 1;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(HOLDER2, balance2);
      await this.assetProxy.transfer(HOLDER2, amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL)).valueOf(),
        balance2 + amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        VALUE - balance2 - amount);
    });

    it('should keep transfers separated between assets', async function() {
      const amount = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      const result = getEvents(
        await this.assetProxy.transfer(HOLDER2, amount), this.assetProxy);
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), HOLDER);
      assert.equal(result[0].args.to.valueOf(), HOLDER2);
      assert.equal(result[0].args.value.valueOf(), amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        VALUE - amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL)).valueOf(), amount);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL2)).valueOf(), VALUE2);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL2)).valueOf(), 0);
    });

    it('should emit transfer event from base', async function() {
      const amount = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      const result = getEvents(
        await this.etoken2.transfer(HOLDER2, amount, SYMBOL), this.assetProxy);
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), HOLDER);
      assert.equal(result[0].args.to.valueOf(), HOLDER2);
      assert.equal(result[0].args.value.valueOf(), amount);
    });
  });

  describe('Allowance', () => {
    it('should not be possible to set allowance if not allowed', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL2);
      const result = getEvents(
        await this.assetProxy.approve(SPENDER, 100), this.assetProxy);
      assert.equal(result.length, 0);
      assert.equal(
        (await this.etoken2.allowance.call(OWNER, SPENDER, SYMBOL2)).valueOf(),
        0);
    });

    it('should not be possible to set allowance for oneself', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      const result = getEvents(
        await this.assetProxy.approve(OWNER, 100), this.assetProxy);
      assert.equal(result.length, 0);
      assert.equal(
        (await this.etoken2.allowance.call(OWNER, OWNER, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to set allowance from missing holder to missing holder', async function() {
      const value = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      const result = getEvents(
        await this.assetProxy.approve(SPENDER, value, {from: HOLDER}),
        this.assetProxy);
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), HOLDER);
      assert.equal(result[0].args.spender.valueOf(), SPENDER);
      assert.equal(result[0].args.value.valueOf(), value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should emit allowance from base', async function() {
      const value = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      const result = getEvents(
        await this.etoken2.approve(SPENDER, value, SYMBOL, {from: HOLDER}),
        this.assetProxy);
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), HOLDER);
      assert.equal(result[0].args.spender.valueOf(), SPENDER);
      assert.equal(result[0].args.value.valueOf(), value);
    });

    it('should be possible to set allowance from missing holder to existing holder', async function() {
      const value = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value, {from: HOLDER});
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should be possible to set allowance from existing holder to missing holder', async function() {
      const value = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value, {from: HOLDER});
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should be possible to set allowance from existing holder to existing holder', async function() {
      const value = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(SPENDER, 1, {from: HOLDER});
      await this.assetProxy.approve(SPENDER, value, {from: HOLDER});
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should be possible to set allowance with (2**256 - 1) value', async function() {
      const value = UINT_256_MINUS_1;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value.toString());
    });

    it('should be possible to set allowance value less then balance', async function() {
      const value = 1;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should be possible to set allowance value equal to balance', async function() {
      const value = VALUE;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should be possible to set allowance value more then balance', async function() {
      // eslint-disable-next-line max-len
      // Covered by 'should be possible to set allowance with (2**256 - 1) value'.
    });

    it('should be possible to override allowance value with 0 value', async function() {
      const value = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, 100);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should be possible to override allowance value with non 0 value', async function() {
      const value = 1000;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, 100);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should not affect balance when setting allowance', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(accounts[1], 100);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        VALUE);
    });

    it('should not be possible to do allowance transfer if not allowed', async function() {
      await this.etoken2.approve(SPENDER, 50, SYMBOL);
      const result = getEvents(
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, 50, {from: SPENDER}),
        this.assetProxy);
      assert.equal(result.length, 0);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to do allowance transfer by not allowed existing spender, from existing holder', async function() {
      const value = 100;
      const expectedSpenderBalance = 100;
      const expectedHolderBalance = VALUE - value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(SPENDER, value);
      if (isReverting) {
        await asserts.throws(
          this.assetProxy.transferFrom(HOLDER, SPENDER, 50, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, 50, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should return allowance when not allowed', async function() {
      const value = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should return 0 allowance for existing owner and not allowed existing spender', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(SPENDER, 100);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(), 0);
    });

    it('should return 0 allowance for existing owner and not allowed missing spender', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(), 0);
    });

    it('should return 0 allowance for missing owner and existing SPENDER', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(), 0);
    });

    it('should return 0 allowance for missing owner and missing spender', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(), 0);
    });

    it('should return 0 allowance for existing oneself', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(), 0);
    });

    it('should return 0 allowance for missing oneself', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(), 0);
    });

    it('should respect holder when telling allowance', async function() {
      const value = 100;
      const value2 = 200;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      await this.assetProxy.approve(SPENDER, value2, {from: HOLDER2});
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER2, SPENDER)).valueOf(),
        value2);
    });

    it('should respect spender when telling allowance', async function() {
      const value = 100;
      const value2 = 200;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      await this.assetProxy.approve(ANOTHER_SPENDER, value2);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
      assert.equal(
        (await this.assetProxy.allowance.call(
          HOLDER, ANOTHER_SPENDER)).valueOf(),
        value2);
    });

    it('should be possible to check allowance of existing owner and allowed existing spender', async function() {
      const value = 300;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(SPENDER, 100);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });

    it('should be possible to check allowance of existing owner and allowed missing spender', async function() {
      const value = 300;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        value);
    });
  });

  describe('Allowance transfer', () => {
    it('should not be possible to do allowance transfer by not allowed existing spender, from missing holder', async function() {
      const holder = accounts[2];
      const value = 100;
      const expectedSpenderBalance = 100;
      const expectedHolderBalance = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(SPENDER, value);
      if (isReverting) {
        await asserts.throws(
          this.assetProxy.transferFrom(holder, SPENDER, 50, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          holder, SPENDER, 50, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should not be possible to do allowance transfer by not allowed missing spender, from existing holder', async function() {
      const expectedSpenderBalance = 0;
      const expectedHolderBalance = VALUE;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      if (isReverting) {
        await asserts.throws(
          this.assetProxy.transferFrom(HOLDER, SPENDER, 50, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, 50, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should not be possible to do allowance transfer by not allowed missing spender, from missing holder', async function() {
      const holder = accounts[2];
      const expectedSpenderBalance = 0;
      const expectedHolderBalance = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      if (isReverting) {
        await asserts.throws(
          this.assetProxy.transferFrom(HOLDER, SPENDER, 50, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, 50, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(holder, SYMBOL)).valueOf(),
        expectedHolderBalance);
    });

    it('should not be possible to do allowance transfer from and to the same holder', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, 50);
      const result = getEvents(
        await this.assetProxy.transferFrom(HOLDER, HOLDER, 50, {from: SPENDER}),
        this.assetProxy);
      assert.equal(result.length, 0);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), VALUE);
    });

    it('should not be possible to do allowance transfer with 0 value', async function() {
      const value = 0;
      const resultValue = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, 100);
      const result = getEvents(
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER}),
        this.assetProxy);
      assert.equal(result.length, 0);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        resultValue);
    });

    it('should not be possible to do allowance transfer with value less than balance, more than allowed', async function() {
      const balance = VALUE;
      const value = 999;
      const allowed = 998;
      const resultValue = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      if (isReverting) {
        await asserts.throws(this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        resultValue);
    });

    it('should not be possible to do allowance transfer with value equal to balance, more than allowed', async function() {
      const balance = VALUE;
      const value = VALUE;
      const allowed = 999;
      const resultValue = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      if (isReverting) {
        await asserts.throws(this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        resultValue);
    });

    it('should not be possible to do allowance transfer with value more than balance, less than allowed', async function() {
      const balance = VALUE;
      const value = VALUE + 1;
      const allowed = value + 1;
      const resultValue = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      if (isReverting) {
        await asserts.throws(this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        resultValue);
    });

    it('should not be possible to do allowance transfer with value less than balance, more than allowed after another transfer', async function() {
      const balance = VALUE;
      const anotherValue = 10;
      const value = VALUE - anotherValue - 1;
      const allowed = value - 1;
      const expectedHolderBalance = balance - anotherValue;
      const resultValue = anotherValue;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, anotherValue, {from: SPENDER});
      if (isReverting) {
        await asserts.throws(this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        resultValue);
    });

    it('should not be possible to do allowance transfer when allowed for another symbol', async function() {
      const balance = VALUE;
      const value = 200;
      const allowed = 1000;
      const resultValue = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.etoken2.approve(SPENDER, allowed, SYMBOL2);
      if (isReverting) {
        await asserts.throws(this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER}));
      } else {
        await this.assetProxy.transferFrom(
          HOLDER, SPENDER, value, {from: SPENDER});
      }
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), balance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        resultValue);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL2)).valueOf(), VALUE2);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL2)).valueOf(), 0);
    });

    it('should be possible to do allowance transfer by allowed existing spender', async function() {
      const existValue = 100;
      const value = 300;
      const expectedHolderBalance = VALUE - existValue - value;
      const expectedSpenderBalance = existValue + value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(SPENDER, existValue);
      await this.assetProxy.approve(SPENDER, value);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should be possible to do allowance transfer by allowed missing spender', async function() {
      const value = 300;
      const expectedHolderBalance = VALUE - value;
      const expectedSpenderBalance = value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should be possible to do allowance transfer to oneself', async function() {
      // eslint-disable-next-line max-len
      // Covered by 'should be possible to do allowance transfer by allowed existing SPENDER'.
    });

    it('should be possible to do allowance transfer to existing holder', async function() {
      const existValue = 100;
      const value = 300;
      const expectedHolderBalance = VALUE - existValue - value;
      const expectedReceiverBalance = existValue + value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(RECEIVER, existValue);
      await this.assetProxy.approve(SPENDER, value);
      const result = getEvents(await this.assetProxy.transferFrom(
        HOLDER, RECEIVER, value, {from: SPENDER}), this.assetProxy);
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), HOLDER);
      assert.equal(result[0].args.to.valueOf(), RECEIVER);
      assert.equal(result[0].args.value.valueOf(), value);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(RECEIVER, SYMBOL)).valueOf(),
        expectedReceiverBalance);
    });

    it('should emit allowance transfer event from base', async function() {
      const existValue = 100;
      const value = 300;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(RECEIVER, existValue);
      await this.assetProxy.approve(SPENDER, value);
      const result = getEvents(await this.etoken2.transferFrom(
        HOLDER, RECEIVER, value, SYMBOL, {from: SPENDER}), this.assetProxy);
      assert.equal(result.length, 1);
      assert.equal(result[0].args.from.valueOf(), HOLDER);
      assert.equal(result[0].args.to.valueOf(), RECEIVER);
      assert.equal(result[0].args.value.valueOf(), value);
    });

    it('should be possible to do allowance transfer to missing holder', async function() {
      const value = 300;
      const expectedHolderBalance = VALUE - value;
      const expectedReceiverBalance = value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      await this.assetProxy.transferFrom(
        HOLDER, RECEIVER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(RECEIVER, SYMBOL)).valueOf(),
        expectedReceiverBalance);
    });

    it('should be possible to do allowance transfer with value less than balance and less than allowed', async function() {
      const balance = VALUE;
      const value = balance - 1;
      const allowed = value + 1;
      const expectedHolderBalance = balance - value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(), value);
    });

    it('should be possible to do allowance transfer with value less than balance and equal to allowed', async function() {
      const balance = VALUE;
      const value = balance - 1;
      const allowed = value;
      const expectedHolderBalance = balance - value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(), value);
    });

    it('should be possible to do allowance transfer with value equal to balance and less than allowed', async function() {
      const balance = VALUE;
      const value = balance;
      const allowed = value + 1;
      const expectedHolderBalance = balance - value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(), value);
    });

    it('should be possible to do allowance transfer with value equal to balance and equal to allowed', async function() {
      const balance = VALUE;
      const value = balance;
      const allowed = value;
      const expectedHolderBalance = balance - value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        value);
    });

    it('should be possible to do allowance transfer with value less than balance and less than allowed after another transfer', async function() {
      const balance = VALUE;
      const anotherValue = 1;
      const value = balance - anotherValue - 1;
      const allowed = value + 1;
      const expectedSpenderBalance = anotherValue + value;
      const expectedHolderBalance = balance - anotherValue - value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, anotherValue, {from: SPENDER});
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should be possible to do allowance transfer with value less than balance and equal to allowed after another transfer', async function() {
      const balance = VALUE;
      const anotherValue = 1;
      const value = balance - anotherValue - 1;
      const allowed = value + anotherValue;
      const expectedSpenderBalance = anotherValue + value;
      const expectedHolderBalance = balance - anotherValue - value;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, allowed);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, anotherValue, {from: SPENDER});
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(),
        expectedHolderBalance);
      assert.equal(
        (await this.etoken2.balanceOf.call(SPENDER, SYMBOL)).valueOf(),
        expectedSpenderBalance);
    });

    it('should return 0 allowance after another transfer', async function() {
      const value = 300;
      const resultValue = 0;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      await this.assetProxy.transferFrom(
        HOLDER, SPENDER, value, {from: SPENDER});
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        resultValue);
    });

    it('should return 1 allowance after another transfer', async function() {
      const value = 300;
      const transfer = 299;
      const resultValue = 1;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(SPENDER, value);
      await this.assetProxy.transferFrom(
        HOLDER, RECEIVER, transfer, {from: SPENDER});
      assert.equal(
        (await this.assetProxy.allowance.call(HOLDER, SPENDER)).valueOf(),
        resultValue);
    });
  });

  describe('ICAP', () => {
    it('should be possible to transfer to ICAP', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transferToICAP(ICAP_STRING, VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer to ICAP with reference', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transferToICAPWithReference(
        ICAP_STRING, VALUE, 'Ref');
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer from to ICAP', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(accounts[1], VALUE);
      await this.assetProxy.transferFromToICAP(
        HOLDER, ICAP, VALUE, {from: accounts[1]});
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
      assert.equal((await this.etoken2.allowance.call(
        HOLDER, accounts[1], SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer from to ICAP with reference', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(accounts[1], VALUE);
      await this.assetProxy.transferFromToICAPWithReference(
        HOLDER, ICAP, VALUE, 'Ref', {from: accounts[1]});
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
      assert.equal((await this.etoken2.allowance.call(
        HOLDER, accounts[1], SYMBOL)).valueOf(), 0);
    });

    it('should be possible to do transfer to ICAP from a contract', async function() {
      let userContract;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      userContract = this.userContract || await UserContract.new();
      const holder = userContract.address;
      await userContract.init(this.assetProxy.address);
      userContract = await this.AssetProxy.at(userContract.address);
      await this.assetProxy.transfer(holder, VALUE);
      await userContract.transferToICAP(ICAP_STRING, VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer to ICAP through a normal transfer', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(ICAP, VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer to ICAP with reference through a normal transfer', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transferWithReference(
        ICAP, VALUE, 'Ref');
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer from to ICAP through a normal transferFrom', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(accounts[1], VALUE);
      await this.assetProxy.transferFrom(
        HOLDER, ICAP, VALUE, {from: accounts[1]});
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
      assert.equal((await this.etoken2.allowance.call(
        HOLDER, accounts[1], SYMBOL)).valueOf(), 0);
    });

    it('should be possible to transfer from to ICAP with reference through a normal transferFrom', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.approve(accounts[1], VALUE);
      await this.assetProxy.transferFromWithReference(
        HOLDER, ICAP, VALUE, 'Ref', {from: accounts[1]});
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(),
        VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
      assert.equal((await this.etoken2.allowance.call(
        HOLDER, accounts[1], SYMBOL)).valueOf(), 0);
    });

    it('should fallback to normal transfer for invalid ICAP through normal transfer', async function() {
      const invalidICAP = web3.utils.toHex('XE73TSTXREG12345678a');
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.assetProxy.transfer(invalidICAP, VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(ICAP_ADDRESS, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await this.etoken2.balanceOf.call(invalidICAP, SYMBOL)).valueOf(),
        VALUE);
    });

    it('should correctly tell isICAP or not alternative version', async function() {
      let i;
      const falseICAP = [
        'YE73TSTXREG123456789', 'XD73TSTXREG123456789',
        'XF73TSTXREG123456789', 'XE/3TSTXREG123456789',
        'XE:3TSTXREG123456789', 'XE7/TSTXREG123456789',
        'XE7:TSTXREG123456789', 'XE73/STXREG123456789',
        'XE73:STXREG123456789', 'XE73@STXREG123456789',
        'XE73[STXREG123456789', 'XE73T/TXREG123456789',
        'XE73T:TXREG123456789', 'XE73T@TXREG123456789',
        'XE73T[TXREG123456789', 'XE73TS/XREG123456789',
        'XE73TS:XREG123456789', 'XE73TS@XREG123456789',
        'XE73TS[XREG123456789', 'XE73TST/REG123456789',
        'XE73TST:REG123456789', 'XE73TST@REG123456789',
        'XE73TST[REG123456789', 'XE73TSTX/EG123456789',
        'XE73TSTX:EG123456789', 'XE73TSTX@EG123456789',
        'XE73TSTX[EG123456789', 'XE73TSTXR/G123456789',
        'XE73TSTXR:G123456789', 'XE73TSTXR@G123456789',
        'XE73TSTXR[G123456789', 'XE73TSTXRE/123456789',
        'XE73TSTXRE:123456789', 'XE73TSTXRE@123456789',
        'XE73TSTXRE[123456789', 'XE73TSTXREG/23456789',
        'XE73TSTXREG:23456789', 'XE73TSTXREG@23456789',
        'XE73TSTXREG[23456789', 'XE73TSTXREG1/3456789',
        'XE73TSTXREG1:3456789', 'XE73TSTXREG1@3456789',
        'XE73TSTXREG1[3456789', 'XE73TSTXREG12/456789',
        'XE73TSTXREG12:456789', 'XE73TSTXREG12@456789',
        'XE73TSTXREG12[456789', 'XE73TSTXREG123/56789',
        'XE73TSTXREG123:56789', 'XE73TSTXREG123@56789',
        'XE73TSTXREG123[56789', 'XE73TSTXREG1234/6789',
        'XE73TSTXREG1234:6789', 'XE73TSTXREG1234@6789',
        'XE73TSTXREG1234[6789', 'XE73TSTXREG12345/789',
        'XE73TSTXREG12345:789', 'XE73TSTXREG12345@789',
        'XE73TSTXREG12345[789', 'XE73TSTXREG123456/89',
        'XE73TSTXREG123456:89', 'XE73TSTXREG123456@89',
        'XE73TSTXREG123456[89', 'XE73TSTXREG1234567/9',
        'XE73TSTXREG1234567:9', 'XE73TSTXREG1234567@9',
        'XE73TSTXREG1234567[9', 'XE73TSTXREG12345678/',
        'XE73TSTXREG12345678:', 'XE73TSTXREG12345678@',
        'XE73TSTXREG12345678[', 'WE73TSTXREG123456789',
      ];
      const trueICAP = ['XE000000000000000000', 'XE999999999999999999',
        'XE99AAAAAAAAAAAAAAAA', 'XE99ZZZZZZZZZZZZZZZZ'];
      for (i = 0; i < falseICAP.length; i++) {
        assert.isFalse(await this.asset.isICAP(web3.utils.toHex(falseICAP[i])));
      };
      for (i = 0; i < trueICAP.length; i++) {
        assert.isTrue(await this.asset.isICAP(web3.utils.toHex(trueICAP[i])));
      };
    });
  });

  describe('Transactions from contract', () => {
    it('should be possible to do transfer from a contract', async function() {
      let userContract;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      userContract = this.userContract || await this.UserContract.new();
      const holder = userContract.address;
      await userContract.init(this.assetProxy.address);
      userContract = await this.AssetProxy.at(userContract.address);
      await this.assetProxy.transfer(holder, VALUE);
      await userContract.transfer(HOLDER2, VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });

    it('should be possible to approve from a contract', async function() {
      let userContract;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      userContract = this.userContract || await this.UserContract.new();
      const holder = userContract.address;
      await userContract.init(this.assetProxy.address);
      userContract = await this.AssetProxy.at(userContract.address);
      await userContract.approve(HOLDER2, VALUE);
      assert.equal(
        (await this.etoken2.allowance.call(holder, HOLDER2, SYMBOL)).valueOf(),
        VALUE);
    });

    it('should be possible to do allowance transfer from a contract', async function() {
      let userContract;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      userContract = this.userContract || await this.UserContract.new();
      const holder = userContract.address;
      await userContract.init(this.assetProxy.address);
      userContract = await this.AssetProxy.at(userContract.address);
      await this.assetProxy.approve(holder, VALUE);
      await userContract.transferFrom(OWNER, HOLDER2, VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(OWNER, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL)).valueOf(), VALUE);
      assert.equal(
        (await this.etoken2.balanceOf.call(holder, SYMBOL)).valueOf(), 0);
    });
  });

  describe('Approve', () => {
    it('should not emit approve event from not base', async function() {
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL2);
      const result = getEvents(await this.assetProxy.emitApprove(
        OWNER, NON_OWNER, 100), this.assetProxy);
      assert.equal(result.length, 0);
    });
  });

  describe('Proxy', () => {
    it('should be possible to disable proxy if not locked yet', async function() {
      const balance2 = 100;
      await this.etoken2.setProxy(this.assetProxy.address, SYMBOL);
      await this.etoken2.setProxy(ADDRESS_ZERO, SYMBOL);
      await this.assetProxy.transfer(HOLDER2, balance2);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER2, SYMBOL)).valueOf(), 0);
      assert.equal(
        (await this.etoken2.balanceOf.call(HOLDER, SYMBOL)).valueOf(), VALUE);
    });
  });
};
/* eslint-enable no-invalid-this */
