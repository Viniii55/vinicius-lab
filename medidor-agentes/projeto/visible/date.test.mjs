import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderDate } from '../src/orderDate.mjs';

test('parses YYYY-MM-DD as UTC midnight', () => {
  const date = parseOrderDate('2026-01-15');
  assert.equal(date.getTime(), Date.UTC(2026, 0, 15));
});

test('parses end-of-month date', () => {
  const date = parseOrderDate('2026-02-28');
  assert.equal(date.getTime(), Date.UTC(2026, 1, 28));
});

test('parses first day of year', () => {
  const date = parseOrderDate('2026-01-01');
  assert.equal(date.getTime(), Date.UTC(2026, 0, 1));
});
