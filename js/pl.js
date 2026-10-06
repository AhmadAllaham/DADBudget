import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, getFirestore } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { filterPlCogsRows } from './pl-cogs-parser.mjs';

const DOCUMENT_ID = 'pl_cogs_v1_2027';
const CACHE_KEY = 'dadBudgetPLCogsV1';
const CATEGORIES = [
  ['Gross Sales', 'normal'], ['Return', 'normal'], ['Discount', 'normal'], ['Commission', 'normal'],
  ['Net of sales', 'subtotal'], ['COGS', 'cogs'], ['Gross Profit', 'subtotal'], ['S&M', 'normal'], ['Net Profit', 'subtotal'],
];
const $ = id => document.getElementById(id);
const clean = value => String(value ?? '').trim();
let payload = null;

function amount(value) {
  const number = Number(value || 0);
  if (Math.abs(number) < 0.005) return '0';
  const text = Math.abs(number).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return number < 0 ? `(${text})` : text;
}

function selectedRows() {
  return filterPlCogsRows(payload?.rows, $('plCountry').value, $('plAgent').value);
}

function syncAgentOptions() {
  const country = $('plCountry').value;
  const current = $('plAgent').value;
  const agents = [...new Set((payload?.rows || []).filter(row => !country || row.country === country).map(row => row.agent))].sort();
  $('plAgent').innerHTML = '<option value="">All Agents</option>' + agents.map(agent => `<option value="${escapeHtml(agent)}">${escapeHtml(agent)}</option>`).join('');
  if (agents.includes(current)) $('plAgent').value = current;
}

function escapeHtml(value) {
  return clean(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function render() {
  const rows = selectedRows();
  const cogs = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  $('plCogsValue').textContent = payload ? amount(cogs) : '—';
  $('plMarketCount').textContent = new Set(rows.map(row => row.country)).size.toLocaleString();
  $('plAgentCount').textContent = new Set(rows.map(row => row.agent)).size.toLocaleString();
  $('plBody').innerHTML = CATEGORIES.map(([category, className]) => {
    const available = category === 'COGS' && payload;
    return `<tr class="${className} ${available ? '' : 'unavailable'}"><td>${escapeHtml(category)}</td><td>${available ? amount(cogs) : '—'}</td></tr>`;
  }).join('');
  $('plEmpty').hidden = !!payload;
  $('plSource').textContent = payload ? `${payload.sourceFile || 'P&L source'} · ${payload.rows?.length || 0} COGS rows · Revision ${payload.revision || 1}` : 'No P&L COGS source uploaded yet.';
}

function buildFilters() {
  const countries = [...new Set((payload?.rows || []).map(row => row.country))].sort();
  $('plCountry').innerHTML = '<option value="">All Countries</option>' + countries.map(country => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join('');
  syncAgentOptions();
}

async function load() {
  try {
    const db = getFirestore(getApps()[0]);
    const snapshot = await getDoc(doc(db, 'system_status', DOCUMENT_ID));
    if (snapshot.exists()) {
      payload = snapshot.data();
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    }
  } catch (error) {
    console.warn('P&L COGS cloud source unavailable', error);
  }
  if (!payload) {
    try { payload = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) { payload = null; }
  }
  buildFilters();
  render();
}

function bind() {
  $('plCountry').addEventListener('change', () => { syncAgentOptions(); render(); });
  $('plAgent').addEventListener('change', render);
  $('plClear').addEventListener('click', () => { $('plCountry').value = ''; syncAgentOptions(); $('plAgent').value = ''; render(); });
}

bind();
onAuthStateChanged(getAuth(getApps()[0]), user => { if (user) load(); });
