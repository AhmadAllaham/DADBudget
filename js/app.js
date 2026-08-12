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
    .bonus-group{background:#875f8f!important}
    .bonus-head{min-width:96px;background:#714f79!important;color:#fff!important}
    .bonus-percent,.bonus-qty{background:#fbf5fc!important;color:#5f3768!important;font-weight:900!important}
    .bonus-percent{cursor:text;outline:none}
    .bonus-percent:focus{background:#f7eafa!important;box-shadow:inset 0 0 0 2px rgba(135,95,143,.25),0 0 9px rgba(163,99,177,.22)}
    .bonus-total{background:#eee0f1!important;color:#5f3768!important;font-weight:900!important}
    .gp-group{background:#176d63!important}
    .gp-head,.gp-pct-head{min-width:112px;background:#176d63!important;color:#fff!important}
    .gp-cell,.gp-pct-cell{background:#edf9f6!important;color:#0b625a!important;font-weight:900!important}
    .gp-cell.negative,.gp-pct-cell.negative{background:#fff0f0!important;color:#b53c3c!important}
    .gp-total,.gp-pct-total{background:#d9f1ec!important;color:#0b625a!important;font-weight:900!important}
    .gp-total.negative,.gp-pct-total.negative{background:#ffe4e4!important;color:#a92f2f!important}
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

  const groupRow = budgetTable.querySelector('thead tr.group-row');
  const columnRow = budgetTable.querySelector('thead tr.column-row');
  const costGroup = budgetTable.querySelector('.cost-group');
  const totalUsdIndex = [...columnRow.children].findIndex((th) => th.textContent.trim().toLowerCase() === 'total usd');

  if (totalUsdIndex >= 0 && !columnRow.querySelector('.bonus-head')) {
    const bonusGroup = document.createElement('th');
    bonusGroup.className = 'bonus-group';
    bonusGroup.colSpan = 2;
    bonusGroup.textContent = 'BONUS 2026';
    groupRow.insertBefore(bonusGroup, costGroup);

    const bonusPctHead = document.createElement('th');
    bonusPctHead.className = 'bonus-head';
    bonusPctHead.textContent = 'Bonus %';
    const bonusQtyHead = document.createElement('th');
    bonusQtyHead.className = 'bonus-head';
    bonusQtyHead.textContent = 'Bonus QTY';
    const totalUsdHead = columnRow.children[totalUsdIndex];
    totalUsdHead.after(bonusPctHead, bonusQtyHead);

    const sampleBonus = { SKU0001:10, SKU0002:5 };
    budgetTable.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
      const sku = norm(row.dataset.sku || row.children[7]?.textContent);
      const totalQty = num(row.children[22]?.textContent);
      const pct = sampleBonus[sku] ?? 0;
      const pctTd = document.createElement('td');
      pctTd.className = 'bonus-percent';
      pctTd.contentEditable = 'true';
      pctTd.dataset.raw = String(pct);
      pctTd.textContent = pct.toFixed(2) + '%';
      const qtyTd = document.createElement('td');
      qtyTd.className = 'bonus-qty';
      qtyTd.textContent = Math.round(totalQty * pct / 100).toLocaleString();
      row.children[totalUsdIndex].after(pctTd, qtyTd);

      const recalcBonus = () => {
        const raw = String(pctTd.textContent || '').replace('%','').trim();
        const value = Number(raw.replace(/,/g,''));
        const pctValue = Number.isFinite(value) ? value : 0;
        pctTd.dataset.raw = String(pctValue);
        qtyTd.textContent = Math.round(totalQty * pctValue / 100).toLocaleString();
        recalcBonusTotal();
        recalcTotalCogsAndGrossProfit();
      };
      pctTd.addEventListener('focus', () => { pctTd.textContent = pctTd.dataset.raw || '0'; });
      pctTd.addEventListener('input', recalcBonus);
      pctTd.addEventListener('blur', () => {
        recalcBonus();
        pctTd.textContent = Number(pctTd.dataset.raw || 0).toFixed(2) + '%';
      });
    });

    const totalRow = budgetTable.querySelector('tbody tr.total-row');
    if (totalRow) {
      const pctTotal = document.createElement('td');
      pctTotal.className = 'bonus-total';
      pctTotal.textContent = '—';
      const qtyTotal = document.createElement('td');
      qtyTotal.className = 'bonus-total bonus-qty-total';
      totalRow.children[totalUsdIndex].after(pctTotal, qtyTotal);
    }
  }

  function recalcBonusTotal() {
    const totalCell = budgetTable.querySelector('.bonus-qty-total');
    if (!totalCell) return;
    let total = 0;
    budgetTable.querySelectorAll('tbody tr:not(.total-row) .bonus-qty').forEach((cell) => total += num(cell.textContent));
    totalCell.textContent = total.toLocaleString();
  }
  recalcBonusTotal();

  if (!columnRow.querySelector('.gp-head')) {
    const gpGroup = document.createElement('th');
    gpGroup.className = 'gp-group';
    gpGroup.colSpan = 2;
    gpGroup.textContent = 'PROFITABILITY';
    groupRow.appendChild(gpGroup);

    const gpHead = document.createElement('th');
    gpHead.className = 'gp-head';
    gpHead.textContent = 'Gross Profit';
    const gpPctHead = document.createElement('th');
    gpPctHead.className = 'gp-pct-head';
    gpPctHead.textContent = 'GP%';
    columnRow.append(gpHead, gpPctHead);

    budgetTable.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
      const gpTd = document.createElement('td');
      gpTd.className = 'gp-cell';
      const gpPctTd = document.createElement('td');
      gpPctTd.className = 'gp-pct-cell';
      row.append(gpTd, gpPctTd);
    });

    const totalRow = budgetTable.querySelector('tbody tr.total-row');
    if (totalRow) {
      const gpTotal = document.createElement('td');
      gpTotal.className = 'gp-total';
      const gpPctTotal = document.createElement('td');
      gpPctTotal.className = 'gp-pct-total';
      totalRow.append(gpTotal, gpPctTotal);
    }
  }

  function recalcGrossProfit() {
    const headers = [...columnRow.children];
    const totalSalesIndex = headers.findIndex((th) => th.textContent.trim().toLowerCase() === 'total usd');
    const netSalesIndex = headers.findIndex((th) => th.textContent.trim().toLowerCase() === 'net sales');
    let totalSalesAll = 0;
    let totalCogsAll = 0;
    let totalNetSalesAll = 0;

    budgetTable.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
      const totalSales = totalSalesIndex >= 0 ? num(row.children[totalSalesIndex]?.textContent) : 0;
      const netSales = netSalesIndex >= 0 ? num(row.children[netSalesIndex]?.textContent) : totalSales;
      const totalCogs = num(row.querySelector('.cogs-total')?.textContent);
      const gp = totalSales - totalCogs;
      const gpPct = netSales !== 0 ? (gp / netSales) * 100 : null;
      const gpCell = row.querySelector('.gp-cell');
      const gpPctCell = row.querySelector('.gp-pct-cell');
      if (gpCell) {
        gpCell.textContent = fmt(gp);
        gpCell.classList.toggle('negative', gp < 0);
      }
      if (gpPctCell) {
        gpPctCell.textContent = gpPct == null ? '—' : gpPct.toFixed(2) + '%';
        gpPctCell.classList.toggle('negative', gpPct != null && gpPct < 0);
      }
      totalSalesAll += totalSales;
      totalCogsAll += totalCogs;
      totalNetSalesAll += netSales;
    });

    const totalGp = totalSalesAll - totalCogsAll;
    const totalGpPct = totalNetSalesAll !== 0 ? (totalGp / totalNetSalesAll) * 100 : null;
    const totalCell = budgetTable.querySelector('.gp-total');
    const totalPctCell = budgetTable.querySelector('.gp-pct-total');
    if (totalCell) {
      totalCell.textContent = fmt(totalGp);
      totalCell.classList.toggle('negative', totalGp < 0);
    }
    if (totalPctCell) {
      totalPctCell.textContent = totalGpPct == null ? '—' : totalGpPct.toFixed(2) + '%';
      totalPctCell.classList.toggle('negative', totalGpPct != null && totalGpPct < 0);
    }
  }

  function recalcTotalCogsAndGrossProfit() {
    let totalCogsAll = 0;
    budgetTable.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
      const goodsQty = num(row.children[22]?.textContent);
      const bonusQty = num(row.querySelector('.bonus-qty')?.textContent);
      const costRate = num(row.querySelector('.cost-unit')?.textContent);
      const totalCogs = (goodsQty + bonusQty) * costRate;
      const totalCell = row.querySelector('.cogs-total');
      if (totalCell && costRate > 0) totalCell.textContent = fmt(totalCogs);
      totalCogsAll += costRate > 0 ? totalCogs : 0;
    });

    const totalRow = budgetTable.querySelector('tbody tr.total-row');
    if (totalRow) {
      const totalCogsCell = totalRow.querySelector('.cost-total-row:last-of-type');
      if (totalCogsCell) totalCogsCell.textContent = fmt(totalCogsAll);
    }
    recalcGrossProfit();
  }

  recalcTotalCogsAndGrossProfit();

  budgetTable.querySelectorAll('.cogs-total').forEach((cell) => {
    new MutationObserver(recalcGrossProfit).observe(cell, { childList:true, characterData:true, subtree:true });
  });

  const cogsHeaders = ['RM', 'PM', 'Direct DL', 'Direct OH', 'In-Direct DL', 'In-Direct OH', 'Cost Rate'];
  let detailHeaders = [...cogsHeaders];
  let detailMap = {
    SKU0001: {'RM': 3.10, 'PM': 0.20, 'Direct DL': 0.35, 'Direct OH': 0.55, 'In-Direct DL': 0.20, 'In-Direct OH': 0.40, 'Cost Rate': 4.80},
    SKU0002: {'RM': 4.55, 'PM': 0.30, 'Direct DL': 0.45, 'Direct OH': 0.75, 'In-Direct DL': 0.30, 'In-Direct OH': 0.75, 'Cost Rate': 7.10}
  };
  let detailVisible = false;
  const viewState = { rate:false, monthly:true, base:true };

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
  }

  const menuWrap = document.createElement('div');
  menuWrap.className = 'cost-menu-wrap';
  const menu = document.createElement('div');
  menu.className = 'cost-view-menu';
  menu.innerHTML = `
    <button type="button" class="cost-view-option" data-view="rate"><span class="cost-view-check"></span><span>Show Cost Rate</span></button>
    <button type="button" class="cost-view-option selected" data-view="monthly"><span class="cost-view-check"></span><span>Show Cost per Month</span></button>
    <button type="button" class="cost-view-option selected" data-view="base"><span class="cost-view-check"></span><span>Show Unit Cost</span></button>`;

  if (imsActions) {
    menuWrap.append(detailBtn, menu);
    imsActions.insertBefore(menuWrap, imsActions.firstChild);
  }

  function getUnitCostIndex() {
    return [...budgetTable.querySelectorAll('thead tr.column-row th')].findIndex((th) => th.textContent.trim().toLowerCase() === 'unit cost');
  }
  function syncGroupSpan() {
    const span = (viewState.base ? 1 : 0) + (viewState.monthly ? 13 : 0) + (detailVisible ? detailHeaders.length : 0);
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
    let insertAfter = columnRow.children[unitIndex];
    detailHeaders.forEach((header) => {
      const th = document.createElement('th');
      th.className = 'cost-detail-head';
      if (header.startsWith('Direct ')) th.classList.add('direct-head');
      if (header.startsWith('In-Direct ')) th.classList.add('indirect-head');
      if (/Cost Rate|Total/i.test(header)) th.classList.add('total-head');
      th.textContent = header;
      insertAfter.after(th); insertAfter = th;
    });
    budgetTable.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
      const sku = norm(row.dataset.sku || row.children[7]?.textContent);
      const detail = detailMap[sku] || {};
      let anchor = row.children[unitIndex];
      detailHeaders.forEach((header) => {
        const td = document.createElement('td');
        td.className = 'cost-detail-cell';
        td.textContent = detail[header] == null ? '—' : fmt(detail[header]);
        anchor.after(td); anchor = td;
      });
    });
    detailVisible = true;
    syncGroupSpan();
  }
  function syncMenu() {
    menu.querySelectorAll('.cost-view-option').forEach((option) => option.classList.toggle('selected', !!viewState[option.dataset.view]));
  }
  detailBtn.addEventListener('click', (event) => {
    event.stopPropagation(); menu.classList.toggle('open'); detailBtn.classList.toggle('active', menu.classList.contains('open'));
  });
  menu.addEventListener('click', (event) => {
    const option = event.target.closest('.cost-view-option'); if (!option) return;
    event.stopPropagation(); const key = option.dataset.view; viewState[key] = !viewState[key];
    if (key === 'rate') viewState.rate ? addDetailColumns() : removeDetailColumns(); else applyCostVisibility();
    syncMenu();
  });
  document.addEventListener('click', (event) => {
    if (!menuWrap.contains(event.target)) { menu.classList.remove('open'); detailBtn.classList.remove('active'); }
  });
  applyCostVisibility();
  syncMenu();
});

document.addEventListener('DOMContentLoaded', () => {
  const table = document.getElementById('budgetTable');
  if (!table) return;
  const groupRow = table.querySelector('thead tr.group-row');
  const columnRow = table.querySelector('thead tr.column-row');
  const costGroup = table.querySelector('.cost-group');
  if (!groupRow || !columnRow || !costGroup || columnRow.querySelector('.reduction-head')) return;

  const style = document.createElement('style');
  style.textContent = `
    .reduction-group{background:#8b5a43!important;color:#fff!important}
    .reduction-head{min-width:104px;background:#744936!important;color:#fff!important}
    .reduction-sep-head,.reduction-sep{min-width:22px!important;width:22px!important;max-width:22px!important;padding-left:3px!important;padding-right:3px!important;text-align:center!important;background:#f1e6df!important;color:#9a7665!important}
    .reduction-pct{background:#fff8f4!important;color:#784b36!important;font-weight:900!important;cursor:text;outline:none}
    .reduction-usd{background:#fff5f0!important;color:#a33f36!important;font-weight:900!important}
    .reduction-total{background:#f3e2d9!important;color:#744936!important;font-weight:900!important}
    .reduction-total-usd{color:#9f3c34!important}
  `;
  document.head.appendChild(style);

  const reductionGroup = document.createElement('th');
  reductionGroup.className = 'reduction-group';
  reductionGroup.colSpan = 8;
  reductionGroup.textContent = 'REDUCTIONS';
  groupRow.insertBefore(reductionGroup, costGroup);

  const defs = [['Commission %','commission-pct'],['Commission USD','commission-usd'],['.','reduction-sep'],['Returns %','returns-pct'],['Returns USD','returns-usd'],['.','reduction-sep'],['Discount %','discount-pct'],['Discount USD','discount-usd']];
  const bonusQtyHead = [...columnRow.children].find((th) => th.textContent.trim().toLowerCase() === 'bonus qty');
  if (!bonusQtyHead) return;
  let headerAnchor = bonusQtyHead;
  defs.forEach(([label, cls]) => {
    const th = document.createElement('th'); th.className = `reduction-head ${cls.includes('sep') ? 'reduction-sep-head' : ''}`; th.textContent = label; headerAnchor.after(th); headerAnchor = th;
  });

  const toNum = (v) => { const n = Number(String(v ?? '').replace(/,/g,'').replace('%','').trim()); return Number.isFinite(n) ? n : 0; };
  const money = (v) => Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
  const totalSalesIndex = [...columnRow.children].findIndex((th) => th.textContent.trim().toLowerCase() === 'total usd');

  function recalcRow(row) {
    const sales = totalSalesIndex >= 0 ? toNum(row.children[totalSalesIndex]?.textContent) : 0;
    ['commission','returns','discount'].forEach((key) => {
      const pctCell = row.querySelector(`.${key}-pct`); const usdCell = row.querySelector(`.${key}-usd`); if (!pctCell || !usdCell) return;
      const pct = toNum(pctCell.dataset.raw ?? pctCell.textContent); usdCell.textContent = money(-(sales * pct / 100));
    });
    recalcTotals();
  }

  table.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
    const bonusQtyCell = row.querySelector('.bonus-qty'); if (!bonusQtyCell) return;
    let anchor = bonusQtyCell;
    ['commission','returns','discount'].forEach((key, idx) => {
      const pct = document.createElement('td'); pct.className = `reduction-pct ${key}-pct`; pct.contentEditable = 'true'; pct.dataset.raw = '0'; pct.textContent = '0.00%';
      const usd = document.createElement('td'); usd.className = `reduction-usd ${key}-usd`; usd.textContent = '0'; anchor.after(pct, usd); anchor = usd;
      if (idx < 2) { const sep = document.createElement('td'); sep.className = 'reduction-sep'; anchor.after(sep); anchor = sep; }
      pct.addEventListener('focus', () => { pct.textContent = pct.dataset.raw || '0'; });
      pct.addEventListener('input', () => { pct.dataset.raw = String(toNum(pct.textContent)); recalcRow(row); });
      pct.addEventListener('blur', () => { const value = toNum(pct.textContent); pct.dataset.raw = String(value); pct.textContent = value.toFixed(2) + '%'; recalcRow(row); });
    });
    recalcRow(row);
  });

  const totalRow = table.querySelector('tbody tr.total-row');
  if (totalRow) {
    const bonusQtyTotal = totalRow.querySelector('.bonus-qty-total');
    if (bonusQtyTotal) {
      let anchor = bonusQtyTotal;
      [['—','reduction-total'],['0','reduction-total reduction-total-usd commission-usd-total'],['','reduction-sep'],['—','reduction-total'],['0','reduction-total reduction-total-usd returns-usd-total'],['','reduction-sep'],['—','reduction-total'],['0','reduction-total reduction-total-usd discount-usd-total']].forEach(([text, cls]) => {
        const td = document.createElement('td'); td.className = cls; td.textContent = text; anchor.after(td); anchor = td;
      });
    }
  }
  function recalcTotals() {
    ['commission','returns','discount'].forEach((key) => {
      let total = 0; table.querySelectorAll(`tbody tr:not(.total-row) .${key}-usd`).forEach((cell) => { total += toNum(cell.textContent); });
      const totalCell = table.querySelector(`.${key}-usd-total`); if (totalCell) totalCell.textContent = money(total);
    });
  }
  recalcTotals();
});

// Net Sales block: Total USD plus reductions, positioned before Cost/COGS.
document.addEventListener('DOMContentLoaded', () => {
  const table = document.getElementById('budgetTable');
  if (!table) return;
  const groupRow = table.querySelector('thead tr.group-row');
  const columnRow = table.querySelector('thead tr.column-row');
  const costGroup = table.querySelector('.cost-group');
  if (!groupRow || !columnRow || !costGroup || columnRow.querySelector('.net-sales-head')) return;

  const style = document.createElement('style');
  style.textContent = `
    .net-sales-group{background:#1f6673!important;color:#fff!important}
    .net-sales-head{min-width:118px;background:#1f6673!important;color:#fff!important}
    .net-sales-cell{background:#edf7f9!important;color:#155763!important;font-weight:900!important}
    .net-sales-total{background:#dceef1!important;color:#155763!important;font-weight:900!important}
  `;
  document.head.appendChild(style);

  const netGroup = document.createElement('th');
  netGroup.className = 'net-sales-group';
  netGroup.colSpan = 1;
  netGroup.textContent = 'NET SALES';
  groupRow.insertBefore(netGroup, costGroup);

  const discountHead = [...columnRow.children].find((th) => th.textContent.trim().toLowerCase() === 'discount usd');
  if (!discountHead) return;
  const netHead = document.createElement('th');
  netHead.className = 'net-sales-head';
  netHead.textContent = 'Net Sales';
  discountHead.after(netHead);

  table.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
    const discountCell = row.querySelector('.discount-usd');
    if (!discountCell) return;
    const td = document.createElement('td');
    td.className = 'net-sales-cell';
    discountCell.after(td);
  });

  const totalRow = table.querySelector('tbody tr.total-row');
  if (totalRow) {
    const discountTotal = totalRow.querySelector('.discount-usd-total');
    if (discountTotal) {
      const td = document.createElement('td');
      td.className = 'net-sales-total';
      discountTotal.after(td);
    }
  }

  const toNum = (v) => { const n = Number(String(v ?? '').replace(/,/g,'').trim()); return Number.isFinite(n) ? n : 0; };
  const fmtMoney = (v) => Number(v).toLocaleString(undefined,{maximumFractionDigits:2});

  function recalcNetSales() {
    let totalNet = 0;
    const headers = [...columnRow.children];
    const totalSalesIndex = headers.findIndex((th) => th.textContent.trim().toLowerCase() === 'total usd');
    table.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
      const sales = totalSalesIndex >= 0 ? toNum(row.children[totalSalesIndex]?.textContent) : 0;
      const commission = toNum(row.querySelector('.commission-usd')?.textContent);
      const returns = toNum(row.querySelector('.returns-usd')?.textContent);
      const discount = toNum(row.querySelector('.discount-usd')?.textContent);
      const net = sales + commission + returns + discount;
      const cell = row.querySelector('.net-sales-cell');
      if (cell) cell.textContent = fmtMoney(net);
      totalNet += net;

      const gp = toNum(row.querySelector('.gp-cell')?.textContent);
      const gpPctCell = row.querySelector('.gp-pct-cell');
      if (gpPctCell) gpPctCell.textContent = net !== 0 ? ((gp / net) * 100).toFixed(2) + '%' : '—';
    });
    const totalCell = table.querySelector('.net-sales-total');
    if (totalCell) totalCell.textContent = fmtMoney(totalNet);
    const totalGp = toNum(table.querySelector('.gp-total')?.textContent);
    const totalGpPctCell = table.querySelector('.gp-pct-total');
    if (totalGpPctCell) totalGpPctCell.textContent = totalNet !== 0 ? ((totalGp / totalNet) * 100).toFixed(2) + '%' : '—';
  }

  table.querySelectorAll('.commission-usd,.returns-usd,.discount-usd').forEach((cell) => {
    new MutationObserver(recalcNetSales).observe(cell,{childList:true,characterData:true,subtree:true});
  });
  recalcNetSales();
});

// FTE employee allocation block: employee cost attached to each product.
document.addEventListener('DOMContentLoaded', () => {
  const table = document.getElementById('budgetTable');
  if (!table) return;
  const groupRow = table.querySelector('thead tr.group-row');
  const columnRow = table.querySelector('thead tr.column-row');
  if (!groupRow || !columnRow || columnRow.querySelector('.fte-head')) return;

  const style = document.createElement('style');
  style.textContent = `
    .fte-group{background:#385f78!important;color:#fff!important}
    .fte-head{min-width:108px;background:#31566e!important;color:#fff!important;line-height:1.15}
    .fte-sep-head,.fte-sep{min-width:22px!important;width:22px!important;max-width:22px!important;padding-left:3px!important;padding-right:3px!important;text-align:center!important;background:#e8eff3!important;color:#6f8796!important}
    .fte-pct{background:#f3f8fb!important;color:#31566e!important;font-weight:900!important;cursor:text;outline:none}
    .fte-usd{background:#eef5f8!important;color:#274f68!important;font-weight:900!important;cursor:text;outline:none}
    .fte-pct:focus,.fte-usd:focus{background:#e8f3f8!important;box-shadow:inset 0 0 0 2px rgba(49,86,110,.18)}
    .fte-total-cell{background:#dfeef4!important;color:#244d65!important;font-weight:900!important}
    .fte-total-row{background:#d5e8f0!important;color:#244d65!important;font-weight:900!important}
  `;
  document.head.appendChild(style);

  const gpGroup = groupRow.querySelector('.gp-group');
  const fteGroup = document.createElement('th');
  fteGroup.className = 'fte-group';
  fteGroup.colSpan = 7;
  fteGroup.textContent = 'FTE / PRODUCT';
  if (gpGroup) gpGroup.after(fteGroup); else groupRow.appendChild(fteGroup);

  const gpPctHead = columnRow.querySelector('.gp-pct-head');
  if (!gpPctHead) return;
  const headDefs = [
    ['FTE %\nMR','fte-mr-pct'],
    ['FTE USD\nMR','fte-mr-usd'],
    ['.','fte-sep'],
    ['FTE %\nMGR, SUPR','fte-mgr-pct'],
    ['FTE USD\nMGR, SUPR','fte-mgr-usd'],
    ['.','fte-sep'],
    ['Total FTE','fte-total-head']
  ];
  let headAnchor = gpPctHead;
  headDefs.forEach(([label, cls]) => {
    const th = document.createElement('th');
    th.className = `fte-head ${cls.includes('sep') ? 'fte-sep-head' : ''} ${cls}`;
    th.innerHTML = label.replace('\n','<br>');
    headAnchor.after(th);
    headAnchor = th;
  });

  const toNum = (v) => {
    const n = Number(String(v ?? '').replace(/,/g,'').replace('%','').trim());
    return Number.isFinite(n) ? n : 0;
  };
  const money = (v) => Number(v).toLocaleString(undefined,{maximumFractionDigits:2});

  function recalcRow(row) {
    const mrUsd = toNum(row.querySelector('.fte-mr-usd-cell')?.dataset.raw ?? row.querySelector('.fte-mr-usd-cell')?.textContent);
    const mgrUsd = toNum(row.querySelector('.fte-mgr-usd-cell')?.dataset.raw ?? row.querySelector('.fte-mgr-usd-cell')?.textContent);
    const total = mrUsd + mgrUsd;
    const totalCell = row.querySelector('.fte-total-cell');
    if (totalCell) totalCell.textContent = money(total);
    recalcTotals();
  }

  table.querySelectorAll('tbody tr:not(.total-row)').forEach((row) => {
    const gpPct = row.querySelector('.gp-pct-cell');
    if (!gpPct) return;
    const cells = [];
    const mrPct = document.createElement('td');
    mrPct.className = 'fte-pct fte-mr-pct-cell'; mrPct.contentEditable = 'true'; mrPct.dataset.raw = '0'; mrPct.textContent = '0.00%'; cells.push(mrPct);
    const mrUsd = document.createElement('td');
    mrUsd.className = 'fte-usd fte-mr-usd-cell'; mrUsd.contentEditable = 'true'; mrUsd.dataset.raw = '0'; mrUsd.textContent = '0'; cells.push(mrUsd);
    const sep1 = document.createElement('td'); sep1.className = 'fte-sep'; cells.push(sep1);
    const mgrPct = document.createElement('td');
    mgrPct.className = 'fte-pct fte-mgr-pct-cell'; mgrPct.contentEditable = 'true'; mgrPct.dataset.raw = '0'; mgrPct.textContent = '0.00%'; cells.push(mgrPct);
    const mgrUsd = document.createElement('td');
    mgrUsd.className = 'fte-usd fte-mgr-usd-cell'; mgrUsd.contentEditable = 'true'; mgrUsd.dataset.raw = '0'; mgrUsd.textContent = '0'; cells.push(mgrUsd);
    const sep2 = document.createElement('td'); sep2.className = 'fte-sep'; cells.push(sep2);
    const total = document.createElement('td'); total.className = 'fte-total-cell'; total.textContent = '0'; cells.push(total);
    gpPct.after(...cells);

    [mrPct,mgrPct].forEach((cell) => {
      cell.addEventListener('focus', () => { cell.textContent = cell.dataset.raw || '0'; });
      cell.addEventListener('input', () => { cell.dataset.raw = String(toNum(cell.textContent)); });
      cell.addEventListener('blur', () => { const v = toNum(cell.textContent); cell.dataset.raw = String(v); cell.textContent = v.toFixed(2) + '%'; });
    });
    [mrUsd,mgrUsd].forEach((cell) => {
      cell.addEventListener('focus', () => { cell.textContent = cell.dataset.raw || '0'; });
      cell.addEventListener('input', () => { cell.dataset.raw = String(toNum(cell.textContent)); recalcRow(row); });
      cell.addEventListener('blur', () => { const v = toNum(cell.textContent); cell.dataset.raw = String(v); cell.textContent = money(v); recalcRow(row); });
    });
    recalcRow(row);
  });

  const totalRow = table.querySelector('tbody tr.total-row');
  if (totalRow) {
    const gpPctTotal = totalRow.querySelector('.gp-pct-total');
    if (gpPctTotal) {
      const defs = [
        ['—','fte-total-row'],['0','fte-total-row fte-mr-usd-total'],['','fte-sep'],
        ['—','fte-total-row'],['0','fte-total-row fte-mgr-usd-total'],['','fte-sep'],
        ['0','fte-total-row fte-grand-total']
      ];
      let anchor = gpPctTotal;
      defs.forEach(([text, cls]) => {
        const td = document.createElement('td'); td.className = cls; td.textContent = text; anchor.after(td); anchor = td;
      });
    }
  }

  function recalcTotals() {
    let mr = 0, mgr = 0;
    table.querySelectorAll('tbody tr:not(.total-row) .fte-mr-usd-cell').forEach((cell) => { mr += toNum(cell.dataset.raw ?? cell.textContent); });
    table.querySelectorAll('tbody tr:not(.total-row) .fte-mgr-usd-cell').forEach((cell) => { mgr += toNum(cell.dataset.raw ?? cell.textContent); });
    const mrTotal = table.querySelector('.fte-mr-usd-total');
    const mgrTotal = table.querySelector('.fte-mgr-usd-total');
    const grandTotal = table.querySelector('.fte-grand-total');
    if (mrTotal) mrTotal.textContent = money(mr);
    if (mgrTotal) mgrTotal.textContent = money(mgr);
    if (grandTotal) grandTotal.textContent = money(mr + mgr);
  }
  recalcTotals();
});
