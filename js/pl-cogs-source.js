import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { parsePlSummaryV1 } from './pl-cogs-parser.mjs';

const DOCUMENT_ID = 'pl_summary_v1_2027';
const CACHE_KEY = 'dadBudgetPLSummaryV1';
const clean = value => String(value ?? '').trim();
const sheetKey = value => clean(value).toLowerCase().replace(/\s+/g, ' ');

function cardMarkup() {
  return `<article class="card source-card" data-source="pl-summary-v1">
    <div class="source-top"><div class="source-icon">P&amp;L</div><span class="source-status" id="plSummaryStatus">Not uploaded</span></div>
    <h3>P&amp;L · 2026 / 2027 Rate</h3>
    <p>Reads the IMS P&amp;L 2026 Rate and IMS P&amp;L 2027 Rate sheets from one workbook.</p>
    <div class="source-meta"><span>Last file</span><b id="plSummaryFile">—</b></div>
    <div class="ims-summary" id="plSummarySummary" hidden><span>Rate rows<b id="plSummaryRows">0</b></span><span>Scenarios<b id="plSummaryScenario">—</b></span></div>
    <div class="source-actions"><button class="upload-btn" id="plSummaryUpload" type="button">Upload P&amp;L Source</button><button class="view-btn" type="button" onclick="location.href='pl.html'">Open P&amp;L</button></div>
    <input type="file" id="plSummaryInput" accept=".xlsx,.xls" hidden>
  </article>`;
}

function rateRows(payload, rate) {
  const rows = payload?.rateScenarios?.[rate]?.rows;
  if (Array.isArray(rows)) return rows.length;
  return rate === '2026' && Array.isArray(payload?.rows) ? payload.rows.length : 0;
}

function showState(payload) {
  const status = document.getElementById('plSummaryStatus');
  if (!status) return;
  if (!payload) {
    status.textContent = 'Not uploaded';
    status.classList.remove('ready', 'error');
    return;
  }
  const rows26 = rateRows(payload, '2026');
  const rows27 = rateRows(payload, '2027');
  status.textContent = rows27 ? '2026 + 2027 rates loaded' : `${rows26} P&L rows`;
  status.classList.add('ready');
  status.classList.remove('error');
  document.getElementById('plSummaryFile').textContent = payload.sourceFile || '—';
  document.getElementById('plSummaryRows').textContent = rows27
    ? `2026: ${rows26.toLocaleString()} · 2027: ${rows27.toLocaleString()}`
    : rows26.toLocaleString();
  document.getElementById('plSummaryScenario').textContent = rows27 ? '2026 Rate + 2027 Rate' : '2026 Rate';
  document.getElementById('plSummarySummary').hidden = false;
}

function setError(message) {
  const status = document.getElementById('plSummaryStatus');
  if (status) {
    status.textContent = 'Upload error';
    status.classList.add('error');
    status.classList.remove('ready');
  }
  alert(`P&L upload error: ${message}`);
}

async function firebaseServices() {
  if (!getApps().length) {
    await new Promise(resolve => window.addEventListener('dad-firebase-ready', resolve, { once: true }));
  }
  const app = getApps()[0];
  return { auth: getAuth(app), db: getFirestore(app) };
}

async function loadSaved() {
  try {
    const { db } = await firebaseServices();
    const snapshot = await getDoc(doc(db, 'system_status', DOCUMENT_ID));
    if (snapshot.exists()) {
      const payload = snapshot.data();
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      showState(payload);
      return;
    }
  } catch (error) {
    console.warn('P&L COGS source load failed', error);
  }
  try {
    showState(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
  } catch (_) {
    showState(null);
  }
}

function parseSheet(workbook, sheetName) {
  if (!sheetName || !workbook.Sheets[sheetName]) return null;
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
  const parsed = parsePlSummaryV1(matrix);
  return {
    sheetName,
    headerRow: parsed.headerRow,
    ignoredRows: parsed.ignoredRows,
    derivedCells: parsed.derivedCells,
    rows: parsed.rows,
    totals: parsed.totals,
  };
}

function findRateSheets(workbook) {
  const names = workbook.SheetNames || [];
  const findExact = target => names.find(name => sheetKey(name) === target);
  const rate2026Name = findExact('ims p&l 2026 rate')
    || names.find(name => /2026\s*rate/i.test(clean(name)) && /p&l/i.test(clean(name)))
    || findExact('p&l')
    || names[0];
  const rate2027Name = findExact('ims p&l 2027 rate')
    || names.find(name => /2027\s*rate/i.test(clean(name)) && /p&l/i.test(clean(name)));
  return {
    rate2026: parseSheet(workbook, rate2026Name),
    rate2027: rate2027Name && rate2027Name !== rate2026Name ? parseSheet(workbook, rate2027Name) : null,
  };
}

async function savePayload(rate2026, rate2027, file) {
  const { auth, db } = await firebaseServices();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in as Main Admin first.');
  if (!rate2026?.rows?.length) throw new Error('IMS P&L 2026 Rate sheet has no readable P&L rows.');
  const reference = doc(db, 'system_status', DOCUMENT_ID);
  let saved;
  await runTransaction(db, async transaction => {
    const current = await transaction.get(reference);
    const currentData = current.exists() ? current.data() || {} : {};
    const revision = current.exists() ? Number(currentData.revision || 0) + 1 : 1;
    const existingScenarios = currentData.rateScenarios && typeof currentData.rateScenarios === 'object'
      ? currentData.rateScenarios
      : {};
    const rateScenarios = {
      ...existingScenarios,
      '2026': { rate: 2026, ...rate2026 },
      ...(rate2027 ? { '2027': { rate: 2027, ...rate2027 } } : {}),
    };
    saved = {
      fiscalYear: 2027,
      scenario: 'V1 Budget 2027',
      displayScenario: 'FY Budget 27',
      sourceFile: clean(file.name),
      sourceSheets: {
        '2026': rate2026.sheetName,
        ...(rateScenarios['2027']?.sheetName ? { '2027': rateScenarios['2027'].sheetName } : {}),
      },
      headerRow: rate2026.headerRow,
      ignoredRows: rate2026.ignoredRows,
      derivedCells: rate2026.derivedCells,
      rows: rate2026.rows,
      totals: rate2026.totals,
      rateScenarios,
      revision,
      updatedBy: user.uid,
      updatedByEmail: clean(user.email).toLowerCase(),
      updatedAt: serverTimestamp(),
      clientUpdatedAt: new Date().toISOString(),
    };
    transaction.set(reference, saved);
  });
  const cached = { ...saved, updatedAt: new Date().toISOString() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  return cached;
}

async function handleUpload(file) {
  const status = document.getElementById('plSummaryStatus');
  status.textContent = 'Reading...';
  status.classList.remove('ready', 'error');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const { rate2026, rate2027 } = findRateSheets(workbook);
  if (!rate2026?.rows?.length) throw new Error('IMS P&L 2026 Rate sheet was not found or could not be read.');
  const summary = [
    `2026 Rate: ${rate2026.rows.length} rows · ${rate2026.sheetName}`,
    rate2027?.rows?.length
      ? `2027 Rate: ${rate2027.rows.length} rows · ${rate2027.sheetName}`
      : '2027 Rate: sheet not found (existing 2027 Rate data, if any, will be kept)',
  ].join('\n');
  const approved = confirm(`Import P&L rate scenarios?\n\n${summary}\n\nB26 = Budget 2026\nL26 = Landing 26\nB27 = V1 Budget 2027`);
  if (!approved) {
    showState(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
    return;
  }
  status.textContent = 'Saving...';
  showState(await savePayload(rate2026, rate2027, file));
}

function boot() {
  const grid = document.querySelector('.source-grid');
  if (!grid || document.getElementById('plSummaryUpload')) return;
  grid.insertAdjacentHTML('beforeend', cardMarkup());
  const input = document.getElementById('plSummaryInput');
  document.getElementById('plSummaryUpload').addEventListener('click', () => input.click());
  input.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await handleUpload(file);
    } catch (error) {
      console.error('P&L upload failed', error);
      setError(error?.message || error);
    } finally {
      event.target.value = '';
    }
  });
  loadSaved();
  window.addEventListener('dad-user-ready', loadSaved, { once: true });
}

boot();
