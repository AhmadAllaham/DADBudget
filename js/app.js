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
    `;
    document.head.appendChild(style);

    budgetTable.addEventListener('mouseover', (event) => {
      if (event.target.closest('tbody tr')) {
        budgetTable.querySelectorAll('.col-hover').forEach((cell) => cell.classList.remove('col-hover'));
        event.stopPropagation();
      }
    }, true);
  }
});
