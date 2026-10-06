const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

export const PL_CATEGORIES = [
  { key: 'grosssales', label: 'Gross Sales', rank: 1, className: 'normal' },
  { key: 'return', label: 'Return', rank: 2, className: 'normal' },
  { key: 'discount', label: 'Discount', rank: 3, className: 'normal' },
  { key: 'commission', label: 'Commission', rank: 4, className: 'normal' },
  { key: 'netofsales', label: 'Net of sales', rank: 5, className: 'subtotal' },
  { key: 'cogs', label: 'COGS', rank: 6, className: 'cogs' },
  { key: 'grossprofit', label: 'Gross Profit', rank: 7, className: 'subtotal' },
  { key: 'sm', label: 'S&M', rank: 8, className: 'normal' },
  { key: 'netprofit', label: 'Net Profit', rank: 9, className: 'subtotal' },
];

const CATEGORY_ALIASES = new Map([
  ['grosssales', 'grosssales'], ['return', 'return'], ['returns', 'return'],
  ['discount', 'discount'], ['commission', 'commission'], ['commision', 'commission'],
  ['netofsales', 'netofsales'], ['netsales', 'netofsales'], ['cogs', 'cogs'],
  ['grossprofit', 'grossprofit'], ['sm', 'sm'], ['netprofit', 'netprofit'],
]);

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let text = clean(value).replace(/,/g, '');
  if (/^\(.*\)$/.test(text)) text = `-${text.slice(1, -1)}`;
  const parsed = Number(text);
  return text && Number.isFinite(parsed) ? parsed : null;
}

function safePercent(change, base) {
  return Math.abs(base) > 0.0000001 ? change / Math.abs(base) : (Math.abs(change) < 0.0000001 ? 0 : null);
}

export function parsePlSummaryV1(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) throw new Error('The workbook is empty.');

  const required = ['country', 'rank', 'category', 'budget2026', 'landing26', 'v1budget2027', 'agent'];
  const headerRow = matrix.findIndex(row => {
    const normalized = (row || []).map(key);
    return required.every(header => normalized.includes(header));
  });
  if (headerRow < 0) {
    throw new Error('Required columns are missing: Country, Rank, Category, Budget 2026, Landing 26, V1 Budget 2027 and Agent.');
  }

  const headers = (matrix[headerRow] || []).map(key);
  const column = name => headers.indexOf(name);
  const indexes = {
    country: column('country'), rank: column('rank'), category: column('category'),
    b26: column('budget2026'), l26: column('landing26'), b27: column('v1budget2027'), agent: column('agent'),
  };

  const staged = [];
  const identities = new Set();
  let ignoredRows = 0;

  for (let index = headerRow + 1; index < matrix.length; index += 1) {
    const source = matrix[index] || [];
    const country = clean(source[indexes.country]);
    const agent = clean(source[indexes.agent]);
    const rawCategory = clean(source[indexes.category]);
    if (!country && !agent && !rawCategory) continue;
    const categoryKey = CATEGORY_ALIASES.get(key(rawCategory));
    if (!categoryKey) { ignoredRows += 1; continue; }
    if (!country || !agent) throw new Error(`P&L row ${index + 1} is missing Country or Agent.`);

    const identity = `${key(country)}|${key(agent)}|${categoryKey}`;
    if (identities.has(identity)) throw new Error(`Duplicate P&L row for ${country} / ${agent} / ${rawCategory}.`);
    identities.add(identity);
    const definition = PL_CATEGORIES.find(item => item.key === categoryKey);
    staged.push({
      sourceRow: index + 1,
      country,
      agent,
      category: definition.label,
      categoryKey,
      rank: Number(source[indexes.rank]) || definition.rank,
      b26: numberValue(source[indexes.b26]),
      l26: numberValue(source[indexes.l26]),
      b27: numberValue(source[indexes.b27]),
    });
  }

  if (!staged.length) throw new Error('No supported P&L rows were found in the workbook.');

  const lookup = new Map(staged.map(row => [`${key(row.country)}|${key(row.agent)}|${row.categoryKey}`, row]));
  let derivedCells = 0;
  for (const row of staged) {
    if (row.categoryKey === 'sm') {
      const grossProfit = lookup.get(`${key(row.country)}|${key(row.agent)}|grossprofit`);
      const netProfit = lookup.get(`${key(row.country)}|${key(row.agent)}|netprofit`);
      for (const field of ['b26', 'l26', 'b27']) {
        if (row[field] === null && grossProfit?.[field] !== null && netProfit?.[field] !== null) {
          row[field] = netProfit[field] - grossProfit[field];
          derivedCells += 1;
        }
      }
    }
    for (const [field, label] of [['b26', 'Budget 2026'], ['l26', 'Landing 26'], ['b27', 'V1 Budget 2027']]) {
      if (row[field] === null) throw new Error(`P&L row ${row.sourceRow} has an invalid ${label} value.`);
    }
    delete row.sourceRow;
  }

  staged.sort((a, b) => a.country.localeCompare(b.country) || a.agent.localeCompare(b.agent) || a.rank - b.rank);
  return {
    headerRow: headerRow + 1,
    rows: staged,
    ignoredRows,
    derivedCells,
    totals: staged.reduce((totals, row) => ({ b26: totals.b26 + row.b26, l26: totals.l26 + row.l26, b27: totals.b27 + row.b27 }), { b26: 0, l26: 0, b27: 0 }),
  };
}

export function filterPlRows(rows, country = '', agent = '') {
  return (Array.isArray(rows) ? rows : []).filter(row =>
    (!country || row.country === country) && (!agent || row.agent === agent));
}

export function buildPlTable(rows, country = '', agent = '') {
  const filtered = filterPlRows(rows, country, agent);
  return PL_CATEGORIES.map(definition => {
    const categoryRows = filtered.filter(row => row.categoryKey === definition.key);
    const values = categoryRows.reduce((sum, row) => ({ b26: sum.b26 + Number(row.b26 || 0), l26: sum.l26 + Number(row.l26 || 0), b27: sum.b27 + Number(row.b27 || 0) }), { b26: 0, l26: 0, b27: 0 });
    const deltaL26B26 = values.l26 - values.b26;
    const deltaB27B26 = values.b27 - values.b26;
    const deltaB27L26 = values.b27 - values.l26;
    return {
      ...definition,
      ...values,
      deltaL26B26,
      pctL26B26: safePercent(deltaL26B26, values.b26),
      deltaB27B26,
      pctB27B26: safePercent(deltaB27B26, values.b26),
      deltaB27L26,
      pctB27L26: safePercent(deltaB27L26, values.l26),
    };
  });
}

export function buildPlRatios(table) {
  const value = (categoryKey, field) => Number(table.find(row => row.key === categoryKey)?.[field] || 0);
  return ['b26', 'l26', 'b27'].reduce((ratios, field) => {
    const grossSales = value('grosssales', field);
    const netSales = value('netofsales', field);
    ratios[field] = {
      cogsGs: grossSales ? Math.abs(value('cogs', field) / grossSales) : null,
      g2n: grossSales ? (grossSales - netSales) / Math.abs(grossSales) : null,
      gp: netSales ? value('grossprofit', field) / Math.abs(netSales) : null,
      sm: netSales ? Math.abs(value('sm', field) / netSales) : null,
      np: netSales ? value('netprofit', field) / Math.abs(netSales) : null,
    };
    return ratios;
  }, {});
}
