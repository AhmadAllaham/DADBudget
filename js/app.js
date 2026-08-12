document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const appShell = document.querySelector('.app-shell');
  const sidebar = document.querySelector('.sidebar');

  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      window.location.href = 'index.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }

  if (appShell && sidebar) {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
    toggleBtn.setAttribute('title', 'Open / Close Sidebar');
    toggleBtn.textContent = '‹';
    sidebar.appendChild(toggleBtn);

    const savedState = localStorage.getItem('dadBudgetSidebarCollapsed');
    if (savedState === 'true') appShell.classList.add('sidebar-collapsed');

    toggleBtn.addEventListener('click', () => {
      appShell.classList.toggle('sidebar-collapsed');
      localStorage.setItem('dadBudgetSidebarCollapsed', appShell.classList.contains('sidebar-collapsed') ? 'true' : 'false');
    });
  }

  const budgetTable = document.getElementById('budgetTable');
  if (!budgetTable) return;

  const style = document.createElement('style');
  style.textContent = `
    .budget-table .col-hover{font-weight:inherit!important;color:inherit!important;background:inherit!important;text-shadow:none!important;box-shadow:none!important}
    .budget-table thead .col-hover{color:#fff!important;background:#173f68!important;text-shadow:none!important;box-shadow:none!important}
    .budget-table tbody tr:not(.total-row):hover td{font-weight:900!important;color:#063f3d!important;background:#e6fffb!important;text-shadow:0 0 7px rgba(20,225,205,.72);box-shadow:inset 0 0 14px rgba(28,222,202,.22),0 0 9px rgba(28,222,202,.12)}
    .budget-table tbody tr:not(.total-row):hover td.sticky-1,.budget-table tbody tr:not(.total-row):hover td.sticky-2,.budget-table tbody tr:not(.total-row):hover td.sticky-3,.budget-table tbody tr:not(.total-row):hover td.sticky-4,.budget-table tbody tr:not(.total-row):hover td.sticky-5,.budget-table tbody tr:not(.total-row):hover td.sticky-6,.budget-table tbody tr:not(.total-row):hover td.sticky-7,.budget-table tbody tr:not(.total-row):hover td.sticky-8,.budget-table tbody tr:not(.total-row):hover td.sticky-9,.budget-table tbody tr:not(.total-row):hover td.sticky-10{background:#e6fffb!important}
    .budget-table tbody tr:not(.total-row):hover td.unmatched-cost{color:#a72f2f!important;background:#ffecec!important;text-shadow:0 0 6px rgba(255,80,80,.18)!important}
    .cost-detail-toggle{border:1px solid #50d7ca;background:linear-gradient(90deg,#eafffc,#fff);color:#086d67;border-radius:8px;padding:9px 13px;font-size:12px;font-weight:900;box-shadow:0 0 8px rgba(38,255,235,.30),0 0 16px rgba(38,255,235,.16);transition:.18s ease}
    .cost-detail-toggle:hover,.cost-detail-toggle.active{background:#dffffa;color:#064f4b;box-shadow:0 0 9px rgba(38,255,235,.65),0 0 20px rgba(38,255,235,.34);text-shadow:0 0 7px rgba(38,255,235,.55)}
    .budget-table .cost-detail-head{min-width:105px;background:#8b7427!important;color:#fff!important}
    .budget-table .cost-detail-cell{background:#fff8dc;color:#695817;font-weight:800}
    .budget-table .cost-detail-total{background:#f5e9b8!important;color:#5d4d17!important;font-weight:900!important}
  `;
  document.head.appendChild(style);

  budgetTable.addEventListener('mouseover', (event) => {
    if (event.target.closest('tbody tr')) {
      budgetTable.querySelectorAll('.col-hover').forEach((cell) => cell.classList.remove('col-hover'));
      event.stopPropagation();
    }
  }, true);

  const imsActions = document.querySelector('.ims-actions');
  const costFileInput = document.getElementById('costFileInput');
  const norm = (v) => String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const num = (v) => {
    const n = Number(String(v ?? '').replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 });

  // Sample breakdown is deliberately visible in the pilot so the feature can be reviewed before a real cost sheet is uploaded.
  let detailHeaders = ['Material Cost', 'Conversion Cost', 'Overhead'];
  let detailMap = {
    SKU0001: {'Material Cost': 3.10, 'Conversion Cost': 1.05, 'Overhead': 0.65},
    SKU0002: {'Material Cost': 4.55, 'Conversion Cost': 1.55, 'Overhead': 1.00}
  };
  let detailVisible = false;

  try {
    const saved = JSON.parse(localStorage.getItem('dadBudgetCostBreakdown') || 'null');
    if (saved && Array.isArray(saved.headers) && saved.headers.length && saved.map) {
      detailHeaders = saved.headers;
      detailMap = saved.map;
    }
  } catch (e) {}

  let detailBtn = document.getElementById('costDetailToggle');
  if (!detailBtn) {
    detailBtn = document.createElement('button');
    detailBtn.id = 'costDetailToggle';
    detailBtn.type = 'button';
    detailBtn.className = 'cost-detail-toggle';
    detailBtn.textContent = 'Show Cost Detail';
    detailBtn.title = 'Add / remove cost-rate breakdown columns inside the IMS table';
    if (imsActions) {
      const uploadCostBtn = document.getElementById('uploadCostBtn');
      imsActions.insertBefore(detailBtn, uploadCostBtn || imsActions.firstChild);
    }
  }

  function getUnitCostIndex() {
    const headers = [...budgetTable.querySelectorAll('thead tr.column-row th')];
    return headers.findIndex((th) => th.textContent.trim().toLowerCase() === 'unit cost');
  }

  function removeDetailColumns() {
    budgetTable.querySelectorAll('.cost-detail-head,.cost-detail-cell,.cost-detail-total').forEach((el) => el.remove());
    const costGroup = budgetTable.querySelector('.cost-group');
    if (costGroup) costGroup.colSpan = 14;
    detailVisible = false;
    detailBtn.classList.remove('active');
    detailBtn.textContent = 'Show Cost Detail';
  }

  function addDetailColumns() {
    if (!detailHeaders.length) return;
    removeDetailColumns();
    const unitIndex = getUnitCostIndex();
    if (unitIndex < 0) return;

    const columnRow = budgetTable.querySelector('thead tr.column-row');
    let insertAfter = columnRow.children[unitIndex];
    detailHeaders.forEach((header) => {
      const th = document.createElement('th');
      th.className = 'cost-detail-head';
      th.textContent = header;
      insertAfter.after(th);
      insertAfter = th;
    });

    budgetTable.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
      const sku = norm(row.dataset.sku || row.children[7]?.textContent);
      const detail = detailMap[sku] || {};
      let anchor = row.children[unitIndex];
      detailHeaders.forEach((header) => {
        const td = document.createElement('td');
        td.className = 'cost-detail-cell';
        const value = detail[header];
        td.textContent = value === '' || value == null ? '—' : fmt(value);
        anchor.after(td);
        anchor = td;
      });
    });

    const totalRow = budgetTable.querySelector('tbody tr.total-row');
    if (totalRow) {
      let anchor = totalRow.children[unitIndex];
      detailHeaders.forEach((header) => {
        let sum = 0;
        Object.values(detailMap).forEach((detail) => { sum += num(detail?.[header]); });
        const td = document.createElement('td');
        td.className = 'cost-detail-total';
        td.textContent = fmt(sum);
        anchor.after(td);
        anchor = td;
      });
    }

    const costGroup = budgetTable.querySelector('.cost-group');
    if (costGroup) costGroup.colSpan = 14 + detailHeaders.length;
    detailVisible = true;
    detailBtn.classList.add('active');
    detailBtn.textContent = 'Hide Cost Detail';
  }

  detailBtn.addEventListener('click', () => detailVisible ? removeDetailColumns() : addDetailColumns());

  if (costFileInput) {
    costFileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file || typeof XLSX === 'undefined') return;
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, {defval:''});
        if (!json.length) return;
        const headers = Object.keys(json[0]);
        const skuHeader = headers.find((h) => /^(sku|sku code|item|item code|product code|material|material code)$/i.test(String(h).trim())) || headers.find((h) => /sku|item code|product code|material code/i.test(String(h)));
        const totalCostHeader = headers.find((h) => /^(cost|unit cost|cost usd|standard cost|std cost|product cost)$/i.test(String(h).trim())) || headers.find((h) => /cost/i.test(String(h)));
        if (!skuHeader || !totalCostHeader) return;

        const candidateHeaders = headers.filter((h) => {
          if (h === skuHeader || h === totalCostHeader || !String(h).trim()) return false;
          return json.some((r) => r[h] !== '' && Number.isFinite(Number(String(r[h]).replace(/,/g,''))));
        });

        if (candidateHeaders.length) {
          const nextMap = {};
          json.forEach((r) => {
            const sku = norm(r[skuHeader]);
            if (!sku) return;
            nextMap[sku] = {};
            candidateHeaders.forEach((h) => nextMap[sku][h] = r[h] === '' ? '' : num(r[h]));
          });
          detailHeaders = candidateHeaders;
          detailMap = nextMap;
          localStorage.setItem('dadBudgetCostBreakdown', JSON.stringify({headers: detailHeaders, map: detailMap}));
          removeDetailColumns();
          detailBtn.title = `${detailHeaders.length} cost detail columns available`;
        }
      } catch (e) {
        console.warn('Cost detail parsing skipped:', e);
      }
    });
  }
});
