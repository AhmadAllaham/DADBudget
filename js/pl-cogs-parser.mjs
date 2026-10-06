const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let text = clean(value).replace(/,/g, '');
  if (/^\(.*\)$/.test(text)) text = `-${text.slice(1, -1)}`;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePlCogsV1(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) throw new Error('The workbook is empty.');

  const required = ['country', 'category', 'v1budget2027', 'agent'];
  const headerRow = matrix.findIndex(row => {
    const normalized = (row || []).map(key);
    return required.every(header => normalized.includes(header));
  });
  if (headerRow < 0) {
    throw new Error('Required columns are missing: Country, Category, V1 Budget 2027 and Agent.');
  }

  const headers = (matrix[headerRow] || []).map(key);
  const column = name => headers.indexOf(name);
  const indexes = {
    country: column('country'),
    rank: column('rank'),
    category: column('category'),
    amount: column('v1budget2027'),
    agent: column('agent'),
  };

  const rows = [];
  const identities = new Set();
  let ignoredRows = 0;

  for (let index = headerRow + 1; index < matrix.length; index += 1) {
    const source = matrix[index] || [];
    const category = clean(source[indexes.category]);
    if (!category && !clean(source[indexes.country]) && !clean(source[indexes.agent])) continue;
    if (key(category) !== 'cogs') {
      ignoredRows += 1;
      continue;
    }

    const country = clean(source[indexes.country]);
    const agent = clean(source[indexes.agent]);
    const amount = numberValue(source[indexes.amount]);
    if (!country || !agent) throw new Error(`COGS row ${index + 1} is missing Country or Agent.`);
    if (amount === null) throw new Error(`COGS row ${index + 1} has an invalid V1 Budget 2027 value.`);

    const identity = `${key(country)}|${key(agent)}`;
    if (identities.has(identity)) throw new Error(`Duplicate COGS row for ${country} / ${agent}.`);
    identities.add(identity);
    rows.push({
      country,
      agent,
      rank: indexes.rank >= 0 ? Number(source[indexes.rank]) || 6 : 6,
      amount,
    });
  }

  if (!rows.length) throw new Error('No COGS rows were found in the workbook.');
  rows.sort((a, b) => a.country.localeCompare(b.country) || a.agent.localeCompare(b.agent));
  return {
    headerRow: headerRow + 1,
    rows,
    ignoredRows,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
  };
}

export function filterPlCogsRows(rows, country = '', agent = '') {
  return (Array.isArray(rows) ? rows : []).filter(row =>
    (!country || row.country === country) && (!agent || row.agent === agent));
}
