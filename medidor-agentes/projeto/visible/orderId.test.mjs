import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidOrderId } from '../src/orderId.mjs';

test('accepts legacy ORD-prefixed order ids', () => {
  assert.equal(isValidOrderId('ORD-000123'), true);
  assert.equal(isValidOrderId('ORD-999999'), true);
});

test('rejects malformed ids', () => {
  assert.equal(isValidOrderId('12345'), false);
  assert.equal(isValidOrderId(''), false);
  assert.equal(isValidOrderId('ord-12'), false);
});
