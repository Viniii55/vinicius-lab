import { test } from 'node:test';
import assert from 'node:assert/strict';
import { peakOrderValue } from '../src/statement.mjs';

test('finds the highest order total in a non-empty statement', () => {
  const orders = [{ total: 120 }, { total: 55 }, { total: 340 }, { total: 10 }];
  assert.equal(peakOrderValue(orders), 340);
});

test('single order statement returns that total', () => {
  assert.equal(peakOrderValue([{ total: 42 }]), 42);
});
