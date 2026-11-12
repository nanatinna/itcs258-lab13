const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LEGENDARY, RULES, drawOutcome, positiveInteger, validStudent } = require('../domain');
test('SSR is exactly rolls 0 and 1 out of 100', () => {
  let count = 0;
  for (let roll = 0; roll < 100; roll++) {
    const calls = [];
    const result = drawOutcome(max => { calls.push(max); return calls.length === 1 ? roll : 0; });
    assert.deepEqual(calls, [100, 5]);
    assert.equal(result.rarity === 'SSR', roll < 2);
    if (result.rarity === 'SSR') count++;
  }
  assert.equal(count, RULES.legendaryPercent);
});
test('five legendary outcomes can each be selected uniformly', () => {
  assert.equal(new Set(LEGENDARY.map(x => x.id)).size, 5);
  for (let choice = 0; choice < 5; choice++) {
    let called = 0;
    const result = drawOutcome(max => ++called === 1 ? 1 : choice);
    assert.equal(result.id, LEGENDARY[choice].id);
    assert.equal(result.rarity, 'SSR');
  }
});
test('amounts and student identity reject invalid inputs', () => {
  for (const value of [0, -1, 1.5, '100', NaN, Infinity, 100001]) assert.equal(positiveInteger(value), false);
  for (const value of [1, 1000, 100000]) assert.equal(positiveInteger(value), true);
  for (const value of ['', 'x y', '../x', 'x'.repeat(31), 6688123]) assert.equal(validStudent(value), false);
  assert.equal(validStudent('6688123-demo'), true);
});
