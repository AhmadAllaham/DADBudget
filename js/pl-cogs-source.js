import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { parsePlCogsV1 } from './pl-cogs-parser.mjs';

const DOCUMENT_ID = 'pl_cogs_v1_2027';
const CACHE_KEY = 'dadBudgetPLCogsV1';
const clean = value => String(value ?? '').trim();
const money = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function cardMarkup() {
  return `<article class="card source-card" data-source="pl-cogs-v1">
    <div class="source-top"><div class="source-icon">P&amp;L</div><span class="source-status" id="plCogsStatus">Not uploaded</span></div>
    <h3>P&amp;L · COGS V1</h3>
    <p>Reads only Category = COGS and V1 Budget 2027. All other workbook fields are ignored.</p>
    <div class="source-meta"><span>Last file</span><b id="plCogsFile">—</b></div>
    <div class="ims-summary" id="plCogsSummary" hidden><span>COGS rows<b id="plCogsRows">0</b></span><span>FY Budget 27<b id="plCogsTotal">0</b></span></div>
    <div class="source-actions"><button class="upload-btn" id="plCogsUpload" type="button">Upload P&amp;L Source</button><button class="view-btn" type="button" onclick="location.href='pl.html'">Open P&amp;L</button></div>
    <input type="file" id="plCogsInput" accept=".xlsx,.xls" hidden>
  </article>`;
}

function showState(payload) {
  const status = document.getElementById('plCogsStatus');
  if (!status) return;
  if (!payload) {
    status.textContent = 'Not uploaded';
    status.classList.remove('ready', 'error');
    return;
  }
  status.textContent = `${payload.rows?.length || 0} COGS rows`;
  status.classList.add('ready');
  status.classList.remove('error');
  document.getElementById('plCogsFile').textContent = payload.sourceFile || '—';
  document.getElementById('plCogsRows').textContent = Number(payload.rows?.length || 0).toLocaleString();
  document.getElementById('plCogsTotal').textContent = money(payload.total);
  document.getElementById('plCogsSummary').hidden = false;
}

function setError(message) {
  const status = document.getElementById('plCogsStatus');
  if (status) {
    status.textContent = 'Upload error';
    status.classList.add('error');
    status.classList.remove('ready');
  }
  alert(`P&L COGS upload error: ${message}`);
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
      category: 'COGS',
      sourceFile: clean(file.name),
      headerRow: parsed.headerRow,
      ignoredRows: parsed.ignoredRows,
      rows: parsed.rows,
      total: parsed.total,
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
  const status = document.getElementById('plCogsStatus');
  status.textContent = 'Reading...';
  status.classList.remove('ready', 'error');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = workbook.SheetNames.find(name => clean(name).toLowerCase() === 'p&l') || workbook.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
  const parsed = parsePlCogsV1(matrix);
  const approved = confirm(`Import ${parsed.rows.length} COGS rows from V1 Budget 2027?\nTotal: ${money(parsed.total)}\nOther categories will be ignored.`);
  if (!approved) {
    showState(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
    return;
  }
  status.textContent = 'Saving...';
  showState(await savePayload(parsed, file));
}

function boot() {
  const grid = document.querySelector('.source-grid');
  if (!grid || document.getElementById('plCogsUpload')) return;
  grid.insertAdjacentHTML('beforeend', cardMarkup());
  const input = document.getElementById('plCogsInput');
  document.getElementById('plCogsUpload').addEventListener('click', () => input.click());
  input.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await handleUpload(file);
    } catch (error) {
      console.error('P&L COGS upload failed', error);
      setError(error?.message || error);
    } finally {
      event.target.value = '';
    }
  });
  loadSaved();
  window.addEventListener('dad-user-ready', loadSaved, { once: true });
}

boot();
