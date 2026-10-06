import assert from 'node:assert/strict';
import { buildPlRatios, buildPlTable, filterPlRows, parsePlSummaryV1 } from '../js/pl-cogs-parser.mjs';

const matrix = [
  ['Country', 'Rank', 'Category', 'Budget 2026', 'Landing 26', 'V1 Budget 2027', 'V2 Budget 2027', 'V3 Budget 2027', 'Agent', 'Date'],
  ['Iraq', 1, 'Gross Sales', 6553, 6370, 8611, 999999, 888888, 'Mena', 46023],
  ['Iraq', 2, 'Return', 0, 0, 0, 0, 0, 'Mena', 46023],
  ['Iraq', 3, 'Discount', -196, -190, -258, 0, 0, 'Mena', 46023],
  ['Iraq', 4, 'Commision', -655, -637, -861, 0, 0, 'Mena', 46023],
  ['Iraq', 5, 'Net of sales', 5702, 5543, 7492, 0, 0, 'Mena', 46023],
  ['Iraq', 6, 'COGS', -3673, -3179, -3308, 0, 0, 'Mena', 46023],
  ['Iraq', 7, 'Gross Profit', 2028, 2364, 4184, 0, 0, 'Mena', 46023],
  ['Iraq', 8, 'S&M', '#NAME?', '#NAME?', '#NAME?', 0, 0, 'Mena', 46023],
  ['Iraq', 9, 'Net Profit', 1855, 2239, 4022, 0, 0, 'Mena', 46023],
];

const parsed = parsePlSummaryV1(matrix);
assert.equal(parsed.rows.length, 9);
assert.equal(parsed.derivedCells, 3);
assert.deepEqual(parsed.rows.find(row => row.categoryKey === 'sm'), {
  country: 'Iraq', agent: 'Mena', category: 'S&M', categoryKey: 'sm', rank: 8, b26: -173, l26: -125, b27: -162,
});
assert.equal(filterPlRows(parsed.rows, 'Iraq', 'Mena').length, 9);

const table = buildPlTable(parsed.rows, 'Iraq', 'Mena');
const grossSales = table.find(row => row.key === 'grosssales');
assert.deepEqual([grossSales.b26, grossSales.l26, grossSales.b27], [6553, 6370, 8611]);
assert.equal(grossSales.deltaL26B26, -183);
assert.equal(grossSales.deltaB27B26, 2058);
assert.equal(grossSales.deltaB27L26, 2241);
assert(Math.abs(grossSales.pctL26B26 - (-183 / 6553)) < 1e-12);
assert(Math.abs(grossSales.pctB27B26 - (2058 / 6553)) < 1e-12);
assert(Math.abs(grossSales.pctB27L26 - (2241 / 6370)) < 1e-12);

const ratios = buildPlRatios(table);
assert.equal(Math.round(ratios.b26.cogsGs * 100), 56);
assert.equal(Math.round(ratios.l26.gp * 100), 43);
assert.equal(Math.round(ratios.b27.np * 100), 54);

assert.throws(() => parsePlSummaryV1([matrix[0], matrix[1], matrix[1]]), /Duplicate P&L row/);
assert.throws(() => parsePlSummaryV1([['Country', 'Category'], ['Iraq', 'COGS']]), /Required columns are missing/);

console.log('P&L summary parser regression passed.');
