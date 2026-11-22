import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setBalance, getBalance, debitBalance } from '../src/ledger.mjs';

test('sequential debits reduce balance correctly', async () => {
  setBalance('acc-1', 100);
  const afterFirst = await debitBalance('acc-1', 30);
  assert.equal(afterFirst, 70);
  const afterSecond = await debitBalance('acc-1', 70);
  assert.equal(afterSecond, 0);
  assert.equal(getBalance('acc-1'), 0);
});

test('debit beyond balance throws and leaves balance unchanged', async () => {
  setBalance('acc-2', 50);
  await assert.rejects(() => debitBalance('acc-2', 51), /insufficient funds/);
  assert.equal(getBalance('acc-2'), 50);
});
