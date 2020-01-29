const asserts = require('../dependencies/test/helpers/asserts')(assert);

module.exports = (accounts, isReverting = false) => {
  const SYMBOL = web3.utils.fromAscii('TEST');
  const SYMBOL2 = web3.utils.fromAscii('TEST2');
  const VALUE = 1001;
  const VALUE2 = 30000;
  const recoverTokensHolder = accounts[1];


  /* eslint-disable no-invalid-this */
  it('should be possible to recover tokens for asset owner', async function() {
    const assetProxyAddress = this.assetProxy.address;
    await this.etoken2.setProxy(assetProxyAddress, SYMBOL);
    await this.assetProxy.transfer(assetProxyAddress, VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), 0);

    await this.assetProxy.recoverTokens(
      assetProxyAddress, recoverTokensHolder, VALUE);

    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), 0);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), VALUE);
  });

  it('should be possible to recover not all tokens for asset owner', async function() {
    const assetProxyAddress = this.assetProxy.address;
    await this.etoken2.setProxy(assetProxyAddress, SYMBOL);
    await this.assetProxy.transfer(assetProxyAddress, VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), 0);

    await this.assetProxy.recoverTokens(
      assetProxyAddress, recoverTokensHolder, VALUE - 1);

    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), 1);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), VALUE - 1);
  });

  it('should NOT be possible to recover tokens for NOT asset owner', async function() {
    const assetProxyAddress = this.assetProxy.address;
    await this.etoken2.setProxy(assetProxyAddress, SYMBOL);
    await this.assetProxy.transfer(assetProxyAddress, VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), 0);

    await this.assetProxy.recoverTokens(assetProxyAddress,
      recoverTokensHolder, VALUE, {from: recoverTokensHolder});

    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), 0);
  });

  it('should NOT be possible to recover more tokens than locked on asset address', async function() {
    const assetProxyAddress = this.assetProxy.address;
    await this.etoken2.setProxy(assetProxyAddress, SYMBOL);
    await this.assetProxy.transfer(assetProxyAddress, VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), 0);

    if (isReverting) {
      await asserts.throws(this.assetProxy.recoverTokens(
        assetProxyAddress, recoverTokensHolder, VALUE + 1));
    } else {
      await this.assetProxy.recoverTokens(
        assetProxyAddress, recoverTokensHolder, VALUE + 1);
    }

    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL)).valueOf(), VALUE);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL)).valueOf(), 0);
  });

  it('should be possible to recover other tokens from asset address for asset owner', async function() {
    const assetProxyAddress = this.assetProxy.address;
    await this.etoken2.setProxy(this.assetProxyRecovery.address, SYMBOL2);
    await this.assetProxyRecovery.transfer(assetProxyAddress, VALUE2);
    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL2)).valueOf(), VALUE2);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL2)).valueOf(), 0);

    await this.assetProxy.recoverTokens(
      this.assetProxyRecovery.address, recoverTokensHolder, VALUE2);

    assert.equal((await this.etoken2.balanceOf.call(
      assetProxyAddress, SYMBOL2)).valueOf(), 0);
    assert.equal((await this.etoken2.balanceOf.call(
      recoverTokensHolder, SYMBOL2)).valueOf(), VALUE2);
  });
};
/* eslint-enable no-invalid-this */
