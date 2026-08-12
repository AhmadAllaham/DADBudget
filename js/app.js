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
    if (savedState === 'true') {
      appShell.classList.add('sidebar-collapsed');
    }

    toggleBtn.addEventListener('click', () => {
      appShell.classList.toggle('sidebar-collapsed');
      localStorage.setItem(
        'dadBudgetSidebarCollapsed',
        appShell.classList.contains('sidebar-collapsed') ? 'true' : 'false'
      );
    });
  }

  const budgetTable = document.getElementById('budgetTable');
  if (budgetTable) {
    const style = document.createElement('style');
    style.textContent = `
      .budget-table .col-hover{
        font-weight:inherit!important;
        color:inherit!important;
        background:inherit!important;
        text-shadow:none!important;
        box-shadow:none!important;
      }
      .budget-table thead .col-hover{
        color:#fff!important;
        background:#173f68!important;
        text-shadow:none!important;
        box-shadow:none!important;
      }
      .budget-table tbody tr:not(.total-row):hover td{
        font-weight:900!important;
        color:#063f3d!important;
        background:#e6fffb!important;
        text-shadow:0 0 7px rgba(20,225,205,.72);
        box-shadow:inset 0 0 14px rgba(28,222,202,.22),0 0 9px rgba(28,222,202,.12);
      }
      .budget-table tbody tr:not(.total-row):hover td.sticky-1,
      .budget-table tbody tr:not(.total-row):hover td.sticky-2,
      .budget-table tbody tr:not(.total-row):hover td.sticky-3,
      .budget-table tbody tr:not(.total-row):hover td.sticky-4,
      .budget-table tbody tr:not(.total-row):hover td.sticky-5,
      .budget-table tbody tr:not(.total-row):hover td.sticky-6,
      .budget-table tbody tr:not(.total-row):hover td.sticky-7,
      .budget-table tbody tr:not(.total-row):hover td.sticky-8,
      .budget-table tbody tr:not(.total-row):hover td.sticky-9,
      .budget-table tbody tr:not(.total-row):hover td.sticky-10{
        background:#e6fffb!important;
      }
      .budget-table tbody tr:not(.total-row):hover td.unmatched-cost{
        color:#a72f2f!important;
        background:#ffecec!important;
        text-shadow:0 0 6px rgba(255,80,80,.18)!important;
      }
      .cost-detail-toggle{
        border:1px solid #65d3c9;
        background:#ffffff;
        color:#0b6f69;
        border-radius:8px;
        padding:9px 12px;
        font-size:12px;
        font-weight:900;
        box-shadow:0 0 12px rgba(32,212,196,.12);
        transition:.18s ease;
      }
      .cost-detail-toggle:hover,.cost-detail-toggle.active{
        background:#e6fffb;
        color:#075b56;
        box-shadow:0 0 8px rgba(38,255,235,.55),0 0 18px rgba(38,255,235,.28);
        text-shadow:0 0 7px rgba(38,255,235,.5);
      }
      .cost-detail-toggle:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;text-shadow:none}
      .budget-table .cost-detail-head{
        min-width:100px;
        background:#8b7427!important;
        color:#fff!important;
      }
      .budget-table .cost-detail-cell{
        background:#fff8dc;
        color:#695817;
        font-weight:800;
      }
      .budget-table .cost-detail-total{
        background:#f5e9b8!important;
        color:#5d4d17!important;
        font-weight:900!important;
      }
    `;
    document.head.appendChild(style);

    budgetTable.addEventListener('mouseover', (event) => {
      if (event.target.closest('tbody tr')) {
        budgetTable.querySelectorAll('.col-hover').forEach((cell) => cell.classList.remove('col-hover'));
        event.stopPropagation();
      }
    }, true);

    // Dynamic Cost Breakdown
    const imsActions = document.querySelector('.ims-actions');
    const costFileInput = document.getElementById('costFileInput');
    const norm = (v) => String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const num = (v) => {
      const n = Number(String(v ?? '').replace(/,/g, '').trim());
      return Number.isFinite(n) ? n : 0;
    };
    const fmt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 });

    let detailHeaders = [];
    let detailMap = {};
    let detailVisible = false;

    try {
      const saved = JSON.parse(localStorage.getItem('dadBudgetCostBreakdown') || 'null');
      if (saved && Array.isArray(saved.headers) && saved.map) {
        detailHeaders = saved.headers;
        detailMap = saved.map;
      }
    } catch (e) {}

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'cost-detail-toggle';
    detailBtn.textContent = 'Show Cost Detail';
    detailBtn.title = 'Show / Hide cost rate breakdown inside the IMS table';
    detailBtn.disabled = detailHeaders.length === 0;
    if (imsActions) {
      const uploadCostBtn = document.getElementById('uploadCostBtn');
      imsActions.insertBefore(detailBtn, uploadCostBtn || imsActions.firstChild);
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

    detailBtn.addEventListener('click', () => {
      if (detailVisible) removeDetailColumns();
      else addDetailColumns();
    });

    if (costFileInput) {
      costFileInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          // Give the page's existing cost loader time to initialize XLSX if needed.
          if (typeof XLSX === 'undefined') return;
          const data = await file.arrayBuffer();
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (!json.length) return;

          const headers = Object.keys(json[0]);
          const skuHeader = headers.find((h) => /^(sku|sku code|item|item code|product code|material|material code)$/i.test(String(h).trim()))
            || headers.find((h) => /sku|item code|product code|material code/i.test(String(h)));
          const totalCostHeader = headers.find((h) => /^(cost|unit cost|cost usd|standard cost|std cost|product cost)$/i.test(String(h).trim()))
            || headers.find((h) => /cost/i.test(String(h)));
          if (!skuHeader || !totalCostHeader) return;

          const ignored = new Set([skuHeader, totalCostHeader]);
          const candidateHeaders = headers.filter((h) => {
            if (ignored.has(h)) return false;
            const key = String(h).trim();
            if (!key) return false;
            // Keep numeric breakdown columns only; text/meta fields are ignored.
            return json.some((r) => r[h] !== '' && Number.isFinite(Number(String(r[h]).replace(/,/g, ''))));
          });

          const nextMap = {};
          json.forEach((r) => {
            const sku = norm(r[skuHeader]);
            if (!sku) return;
            nextMap[sku] = {};
            candidateHeaders.forEach((h) => {
              const raw = r[h];
              nextMap[sku][h] = raw === '' ? '' : num(raw);
            });
          });

          detailHeaders = candidateHeaders;
          detailMap = nextMap;
          localStorage.setItem('dadBudgetCostBreakdown', JSON.stringify({ headers: detailHeaders, map: detailMap }));
          detailBtn.disabled = detailHeaders.length === 0;
          removeDetailColumns();
          if (detailHeaders.length) {
            detailBtn.title = `${detailHeaders.length} cost detail columns available`;
          } else {
            detailBtn.title = 'No extra numeric cost-detail columns were found in the uploaded sheet';
          }
        } catch (e) {
          console.warn('Cost detail parsing skipped:', e);
        }
      });
    }
  }
});
