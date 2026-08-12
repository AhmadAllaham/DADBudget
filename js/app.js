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
    const nav = sidebar.querySelector('.sidebar-nav');
    if (nav && !nav.querySelector('a[href="data-admin.html"]')) {
      const section = document.createElement('div');
      section.className = 'nav-section';
      section.textContent = 'ADMIN';
      const link = document.createElement('a');
      link.href = 'data-admin.html';
      link.textContent = 'Data Admin';
      nav.append(section, link);
    }

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
    .cost-strip{display:none!important}
    .ims-actions #downloadCostTemplate,
    .ims-actions #uploadCostBtn,
    .ims-actions #costFileInput,
    .ims-actions > .teal-btn{display:none!important}
    .budget-table .col-hover{font-weight:inherit!important;color:inherit!important;background:inherit!important;text-shadow:none!important;box-shadow:none!important}
    .budget-table thead .col-hover{color:#fff!important;background:#173f68!important;text-shadow:none!important;box-shadow:none!important}
    .budget-table tbody tr:not(.total-row):hover td{font-weight:900!important;color:#063f3d!important;background:#e6fffb!important;text-shadow:0 0 7px rgba(20,225,205,.72);box-shadow:inset 0 0 14px rgba(28,222,202,.22),0 0 9px rgba(28,222,202,.12)}
    .budget-table tbody tr:not(.total-row):hover td.sticky-1,.budget-table tbody tr:not(.total-row):hover td.sticky-2,.budget-table tbody tr:not(.total-row):hover td.sticky-3,.budget-table tbody tr:not(.total-row):hover td.sticky-4,.budget-table tbody tr:not(.total-row):hover td.sticky-5,.budget-table tbody tr:not(.total-row):hover td.sticky-6,.budget-table tbody tr:not(.total-row):hover td.sticky-7,.budget-table tbody tr:not(.total-row):hover td.sticky-8,.budget-table tbody tr:not(.total-row):hover td.sticky-9,.budget-table tbody tr:not(.total-row):hover td.sticky-10{background:#e6fffb!important}
    .budget-table tbody tr:not(.total-row):hover td.unmatched-cost{color:#a72f2f!important;background:#ffecec!important;text-shadow:0 0 6px rgba(255,80,80,.18)!important}
    .cost-detail-toggle{border:1px solid #50d7ca;background:linear-gradient(90deg,#eafffc,#fff);color:#086d67;border-radius:8px;padding:9px 13px;font-size:12px;font-weight:900;box-shadow:0 0 8px rgba(38,255,235,.30),0 0 16px rgba(38,255,235,.16);transition:.18s ease}
    .cost-detail-toggle:hover,.cost-detail-toggle.active{background:#dffffa;color:#064f4b;box-shadow:0 0 9px rgba(38,255,235,.65),0 0 20px rgba(38,255,235,.34);text-shadow:0 0 7px rgba(38,255,235,.55)}
    .cost-menu-wrap{position:relative;display:inline-flex}
    .cost-view-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:80;min-width:210px;padding:7px;background:#fff;border:1px solid #b9dcd8;border-radius:11px;box-shadow:0 14px 34px rgba(17,73,71,.16),0 0 18px rgba(38,255,235,.10);display:none}
    .cost-view-menu.open{display:block;animation:costMenuIn .14s ease-out}
    @keyframes costMenuIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
    .cost-view-option{width:100%;border:0;background:#fff;color:#254247;border-radius:8px;padding:10px 10px;display:flex;align-items:center;gap:9px;text-align:left;font-size:11px;font-weight:850;transition:.16s ease}
    .cost-view-option:hover{background:#eafffb;color:#075d58;box-shadow:inset 0 0 12px rgba(38,255,235,.10)}
    .cost-view-check{width:17px;height:17px;border-radius:5px;border:1px solid #8fcac4;background:#f7fcfb;display:grid;place-items:center;flex:0 0 17px;color:#fff;font-size:11px;font-weight:900}
    .cost-view-option.selected .cost-view-check{background:#0f9a90;border-color:#0f9a90;box-shadow:0 0 8px rgba(35,221,204,.32)}
    .cost-view-option.selected .cost-view-check:after{content:'✓'}
    .budget-table .cost-detail-head{min-width:96px;background:#8b7427!important;color:#fff!important}
    .budget-table .cost-detail-head.direct-head{background:#74611f!important}
    .budget-table .cost-detail-head.indirect-head{background:#5f511d!important}
    .budget-table .cost-detail-head.total-head{background:#4e4218!important}
    .budget-table .cost-detail-cell{background:#fff8dc;color:#695817;font-weight:800}
    .budget-table .cost-detail-cell.total-detail-cell{background:#fff1bd;color:#564712;font-weight:900}
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
  const norm = (v) => String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const num = (v) => {
    const n = Number(String(v ?? '').replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 });

  const cogsHeaders = ['RM', 'PM', 'Direct DL', 'Direct OH', 'In-Direct DL', 'In-Direct OH', 'Cost Rate'];
  let detailHeaders = [...cogsHeaders];
  let detailMap = {
    SKU0001: {'RM': 3.10, 'PM': 0.20, 'Direct DL': 0.35, 'Direct OH': 0.55, 'In-Direct DL': 0.20, 'In-Direct OH': 0.40, 'Cost Rate': 4.80},
    SKU0002: {'RM': 4.55, 'PM': 0.30, 'Direct DL': 0.45, 'Direct OH': 0.75, 'In-Direct DL': 0.30, 'In-Direct OH': 0.75, 'Cost Rate': 7.10}
  };
  let detailVisible = false;
  const viewState = { rate:false, monthly:true, base:true };

  try {
    const saved = JSON.parse(localStorage.getItem('dadBudgetCostBreakdown') || 'null');
    if (saved && Array.isArray(saved.headers) && saved.headers.length && saved.map) {
      const oldPilot = saved.headers.join('|') === 'Material Cost|Conversion Cost|Overhead';
      const oldB25 = saved.headers.includes('B25 Total');
      if (!oldPilot && !oldB25) {
        detailHeaders = saved.headers;
        detailMap = saved.map;
      } else {
        localStorage.removeItem('dadBudgetCostBreakdown');
      }
    }
  } catch (e) {}

  const columnRow = budgetTable.querySelector('thead tr.column-row');
  const costGroup = budgetTable.querySelector('.cost-group');
  const baseCostIndex = [...columnRow.children].findIndex((th) => th.textContent.trim().toLowerCase() === 'unit cost');

  if (baseCostIndex >= 0) {
    columnRow.children[baseCostIndex]?.classList.add('cost-base-col');
    for (let i = baseCostIndex + 1; i <= baseCostIndex + 13; i++) columnRow.children[i]?.classList.add('cost-month-col');
    budgetTable.querySelectorAll('tbody tr').forEach((row) => {
      row.children[baseCostIndex]?.classList.add('cost-base-col');
      for (let i = baseCostIndex + 1; i <= baseCostIndex + 13; i++) row.children[i]?.classList.add('cost-month-col');
    });
  }

  let detailBtn = document.getElementById('costDetailToggle');
  if (!detailBtn) {
    detailBtn = document.createElement('button');
    detailBtn.id = 'costDetailToggle';
    detailBtn.type = 'button';
    detailBtn.className = 'cost-detail-toggle';
    detailBtn.textContent = 'Show Cost';
    detailBtn.title = 'Choose which cost information to show';
  }

  const menuWrap = document.createElement('div');
  menuWrap.className = 'cost-menu-wrap';
  const menu = document.createElement('div');
  menu.className = 'cost-view-menu';
  menu.innerHTML = `
    <button type="button" class="cost-view-option" data-view="rate"><span class="cost-view-check"></span><span>Show Cost Rate</span></button>
    <button type="button" class="cost-view-option selected" data-view="monthly"><span class="cost-view-check"></span><span>Show Cost per Month</span></button>
    <button type="button" class="cost-view-option selected" data-view="base"><span class="cost-view-check"></span><span>Show Unit Cost</span></button>
  `;

  if (imsActions) {
    menuWrap.append(detailBtn, menu);
    imsActions.insertBefore(menuWrap, imsActions.firstChild);
  }

  function getUnitCostIndex() {
    return [...budgetTable.querySelectorAll('thead tr.column-row th')].findIndex((th) => th.textContent.trim().toLowerCase() === 'unit cost');
  }

  function syncGroupSpan() {
    const visibleBase = viewState.base ? 1 : 0;
    const visibleMonthly = viewState.monthly ? 13 : 0;
    const visibleRate = detailVisible ? detailHeaders.length : 0;
    const span = visibleBase + visibleMonthly + visibleRate;
    if (!costGroup) return;
    costGroup.style.display = span ? '' : 'none';
    if (span) costGroup.colSpan = span;
  }

  function applyCostVisibility() {
    budgetTable.querySelectorAll('.cost-base-col').forEach((el) => el.style.display = viewState.base ? '' : 'none');
    budgetTable.querySelectorAll('.cost-month-col').forEach((el) => el.style.display = viewState.monthly ? '' : 'none');
    syncGroupSpan();
  }

  function removeDetailColumns() {
    budgetTable.querySelectorAll('.cost-detail-head,.cost-detail-cell,.cost-detail-total').forEach((el) => el.remove());
    detailVisible = false;
    syncGroupSpan();
  }

  function addDetailColumns() {
    if (!detailHeaders.length) return;
    removeDetailColumns();
    const unitIndex = getUnitCostIndex();
    if (unitIndex < 0) return;

    const headerRow = budgetTable.querySelector('thead tr.column-row');
    let insertAfter = headerRow.children[unitIndex];
    detailHeaders.forEach((header) => {
      const th = document.createElement('th');
      th.className = 'cost-detail-head';
      if (header.startsWith('Direct ')) th.classList.add('direct-head');
      if (header.startsWith('In-Direct ')) th.classList.add('indirect-head');
      if (/Cost Rate|Total/i.test(header)) th.classList.add('total-head');
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
        if (/Cost Rate|Total/i.test(header)) td.classList.add('total-detail-cell');
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

    detailVisible = true;
    syncGroupSpan();
  }

  function syncMenu() {
    menu.querySelectorAll('.cost-view-option').forEach((option) => {
      const key = option.dataset.view;
      option.classList.toggle('selected', !!viewState[key]);
    });
  }

  detailBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.classList.toggle('open');
    detailBtn.classList.toggle('active', menu.classList.contains('open'));
  });

  menu.addEventListener('click', (event) => {
    const option = event.target.closest('.cost-view-option');
    if (!option) return;
    event.stopPropagation();
    const key = option.dataset.view;
    viewState[key] = !viewState[key];
    if (key === 'rate') {
      if (viewState.rate) addDetailColumns();
      else removeDetailColumns();
    } else {
      applyCostVisibility();
    }
    syncMenu();
  });

  document.addEventListener('click', (event) => {
    if (!menuWrap.contains(event.target)) {
      menu.classList.remove('open');
      detailBtn.classList.remove('active');
    }
  });

  applyCostVisibility();
  syncMenu();
});
