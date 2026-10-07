import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, getFirestore } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { buildPlRatios, buildPlTable, filterPlRows } from './pl-cogs-parser.mjs';

const DOCUMENT_ID = 'pl_summary_v1_2027';
const CACHE_KEY = 'dadBudgetPLSummaryV1';
const $ = id => document.getElementById(id);
const clean = value => String(value ?? '').trim();
let payload = null;
let currentSource = 'ims';

function amount(value) {
  const number = Number(value || 0);
  if (Math.abs(number) < 0.5) return '0';
  const text = Math.abs(number).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return number < 0 ? `(${text})` : text;
}

function percent(value) {
  if (value === null || !Number.isFinite(Number(value))) return '—';
  return `${Math.round(Number(value) * 100)}%`;
}

function escapeHtml(value) {
  return clean(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function tone(value) {
  if (value === null || Math.abs(Number(value || 0)) < 0.0000001) return 'neutral';
  return Number(value) > 0 ? 'positive' : 'negative';
}

function isTmsRow(row) {
  return /(^|\s)TMS($|\s)/i.test(clean(row?.agent));
}

function sourceRows() {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows.filter(row => currentSource === 'tms' ? isTmsRow(row) : !isTmsRow(row));
}

function selectedRows() {
  return filterPlRows(sourceRows(), $('plCountry').value, $('plAgent').value);
}

function syncAgentOptions() {
  const country = $('plCountry').value;
  const current = $('plAgent').value;
  const agents = [...new Set(sourceRows().filter(row => !country || row.country === country).map(row => row.agent))].sort();
  $('plAgent').innerHTML = '<option value="">All Agents</option>' + agents.map(agent => `<option value="${escapeHtml(agent)}">${escapeHtml(agent)}</option>`).join('');
  if (agents.includes(current)) $('plAgent').value = current;
}

function renderRatios(ratios) {
  const definitions = [
    ['COGS / GS %', 'cogsGs'], ['G2N %', 'g2n'], ['GP%', 'gp'], ['S&M%', 'sm'], ['NP%', 'np'],
  ];
  $('plRatiosBody').innerHTML = definitions.map(([label, key]) => `<tr><th>${label}</th><td>${percent(ratios.b26[key])}</td><td>${percent(ratios.l26[key])}</td><td>${percent(ratios.b27[key])}</td></tr>`).join('');
}

function render() {
  const rows = selectedRows();
  const source = sourceRows();
  const table = buildPlTable(source, $('plCountry').value, $('plAgent').value);
  $('plBody').innerHTML = table.map(row => `<tr class="${row.className}">
    <td>${escapeHtml(row.label)}</td>
    <td>${amount(row.b26)}</td><td>${amount(row.l26)}</td><td>${amount(row.b27)}</td>
    <td class="${tone(row.deltaL26B26)}">${amount(row.deltaL26B26)}</td><td class="${tone(row.pctL26B26)}">${percent(row.pctL26B26)}</td>
    <td class="${tone(row.deltaB27B26)}">${amount(row.deltaB27B26)}</td><td class="${tone(row.pctB27B26)}">${percent(row.pctB27B26)}</td>
    <td class="${tone(row.deltaB27L26)}">${amount(row.deltaB27L26)}</td><td class="${tone(row.pctB27L26)}">${percent(row.pctB27L26)}</td>
  </tr>`).join('');
  renderRatios(buildPlRatios(table));
  $('plMarketCount').textContent = new Set(rows.map(row => row.country)).size.toLocaleString();
  $('plAgentCount').textContent = new Set(rows.map(row => row.agent)).size.toLocaleString();
  const hasSource = !!payload && source.length > 0;
  $('plEmpty').hidden = hasSource;
  $('plRatios').hidden = !hasSource;
  $('plEmpty').textContent = currentSource === 'tms'
    ? 'No TMS P&L rows are available in the uploaded P&L source.'
    : 'Upload the raw P&L file from Data Admin to display IMS B26, L26 and B27.';
  const sourceLabel = currentSource === 'tms' ? 'TMS P&L' : 'IMS P&L';
  $('plSource').textContent = payload
    ? `${sourceLabel} · ${payload.sourceFile || 'P&L source'} · ${source.length} rows · Revision ${payload.revision || 1}`
    : `No ${sourceLabel} source uploaded yet.`;
  const title = document.querySelector('[data-panel="pl"] .pl-report-head h2');
  if (title) title.textContent = `${sourceLabel} Summary`;
}

function buildFilters() {
  const countries = [...new Set(sourceRows().map(row => row.country))].sort();
  $('plCountry').innerHTML = '<option value="">All Countries</option>' + countries.map(country => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join('');
  syncAgentOptions();
}

function setSource(source) {
  currentSource = source === 'tms' ? 'tms' : 'ims';
  document.querySelectorAll('[data-pl-source]').forEach(button => {
    const active = button.dataset.plSource === currentSource;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  $('plCountry').value = '';
  $('plAgent').value = '';
  buildFilters();
  render();
}

function installSourceSwitch() {
  const panel = document.querySelector('[data-panel="pl"]');
  const filters = panel?.querySelector('.pl-filters');
  if (!panel || !filters || panel.querySelector('[data-pl-source]')) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;justify-content:flex-end;margin:0 0 12px';
  bar.innerHTML = '<div class="sales-source-switch" role="group" aria-label="P&L source"><button type="button" class="sales-source-option active" data-pl-source="ims" aria-pressed="true">IMS P&amp;L</button><button type="button" class="sales-source-option" data-pl-source="tms" aria-pressed="false">TMS P&amp;L</button></div>';
  panel.insertBefore(bar, filters);
  bar.querySelectorAll('[data-pl-source]').forEach(button => button.addEventListener('click', () => setSource(button.dataset.plSource)));
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
    console.warn('P&L cloud source unavailable', error);
  }
  if (!payload) {
    try { payload = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) { payload = null; }
  }
  buildFilters();
  render();
}

function bind() {
  installSourceSwitch();
  $('plCountry').addEventListener('change', () => { syncAgentOptions(); render(); });
  $('plAgent').addEventListener('change', render);
  $('plClear').addEventListener('click', () => { $('plCountry').value = ''; syncAgentOptions(); $('plAgent').value = ''; render(); });
}

bind();
onAuthStateChanged(getAuth(getApps()[0]), user => { if (user) load(); });
