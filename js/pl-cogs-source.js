import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { parsePlSummaryV1 } from './pl-cogs-parser.mjs';

const DOCUMENT_ID = 'pl_summary_v1_2027';
const CACHE_KEY = 'dadBudgetPLSummaryV1';
const clean = value => String(value ?? '').trim();

function cardMarkup() {
  return `<article class="card source-card" data-source="pl-summary-v1">
    <div class="source-top"><div class="source-icon">P&amp;L</div><span class="source-status" id="plSummaryStatus">Not uploaded</span></div>
    <h3>P&amp;L · B26 / L26 / B27</h3>
    <p>Reads Budget 2026, Landing 26 and V1 Budget 2027 to build the full P&amp;L table.</p>
    <div class="source-meta"><span>Last file</span><b id="plSummaryFile">—</b></div>
    <div class="ims-summary" id="plSummarySummary" hidden><span>P&amp;L rows<b id="plSummaryRows">0</b></span><span>V1 used<b id="plSummaryScenario">B27</b></span></div>
    <div class="source-actions"><button class="upload-btn" id="plSummaryUpload" type="button">Upload P&amp;L Source</button><button class="view-btn" type="button" onclick="location.href='pl.html'">Open P&amp;L</button></div>
    <input type="file" id="plSummaryInput" accept=".xlsx,.xls" hidden>
  </article>`;
}

function showState(payload) {
  const status = document.getElementById('plSummaryStatus');
  if (!status) return;
  if (!payload) {
    status.textContent = 'Not uploaded';
    status.classList.remove('ready', 'error');
    return;
  }
  status.textContent = `${payload.rows?.length || 0} P&L rows`;
  status.classList.add('ready');
  status.classList.remove('error');
  document.getElementById('plSummaryFile').textContent = payload.sourceFile || '—';
  document.getElementById('plSummaryRows').textContent = Number(payload.rows?.length || 0).toLocaleString();
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

async function savePayload(parsed, file) {
  const { auth, db } = await firebaseServices();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in as Main Admin first.');
  const reference = doc(db, 'system_status', DOCUMENT_ID);
  let saved;
  await runTransaction(db, async transaction => {
    const current = await transaction.get(reference);
    const revision = current.exists() ? Number(current.data()?.revision || 0) + 1 : 1;
    saved = {
      fiscalYear: 2027,
      scenario: 'V1 Budget 2027',
      displayScenario: 'FY Budget 27',
      sourceFile: clean(file.name),
      headerRow: parsed.headerRow,
      ignoredRows: parsed.ignoredRows,
      derivedCells: parsed.derivedCells,
      rows: parsed.rows,
      totals: parsed.totals,
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
  const sheetName = workbook.SheetNames.find(name => clean(name).toLowerCase() === 'p&l') || workbook.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
  const parsed = parsePlSummaryV1(matrix);
  const approved = confirm(`Import ${parsed.rows.length} P&L rows?\nB26 = Budget 2026\nL26 = Landing 26\nB27 = V1 Budget 2027 only`);
  if (!approved) {
    showState(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
    return;
  }
  status.textContent = 'Saving...';
  showState(await savePayload(parsed, file));
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
