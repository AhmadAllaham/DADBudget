import assert from 'node:assert/strict';
import { filterPlCogsRows, parsePlCogsV1 } from '../js/pl-cogs-parser.mjs';

const matrix = [
  ['Country', 'Rank', 'Category', 'Budget 2026', 'Landing 26', 'V1 Budget 2027', 'V2 Budget 2027', 'V3 Budget 2027', 'Agent', 'Date'],
  ['Iraq', 1, 'Gross Sales', 100, 110, 120, 0, 0, 'Mena', 46023],
  ['Iraq', 6, 'COGS', -40, -42, -45.5, 0, 0, 'Mena', 46023],
  ['Jordan', 6, 'COGS', -20, -21, '(22)', 0, 0, 'Jordan Team', 46023],
];

const parsed = parsePlCogsV1(matrix);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.ignoredRows, 1);
assert.equal(parsed.total, -67.5);
assert.deepEqual(filterPlCogsRows(parsed.rows, 'Iraq', ''), [{ country: 'Iraq', agent: 'Mena', rank: 6, amount: -45.5 }]);
assert.equal(filterPlCogsRows(parsed.rows, '', 'Jordan Team')[0].amount, -22);

assert.throws(() => parsePlCogsV1([
  matrix[0],
  matrix[2],
  ['Iraq', 6, 'COGS', -41, -43, -46, 0, 0, 'Mena', 46023],
]), /Duplicate COGS row/);

assert.throws(() => parsePlCogsV1([['Country', 'Category'], ['Iraq', 'COGS']]), /Required columns are missing/);

console.log('P&L COGS parser regression passed.');
