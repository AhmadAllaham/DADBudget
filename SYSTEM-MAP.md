# DAD Budget 2027 — Stability System Map

## Safety checkpoint

- Stability pass started from commit: `b6f1fc4d2c79fddd54c46058fc672c9839f805e3`
- Backup branch: `backup/pre-stability-pass-20260831`
- No existing script is deleted in this pass.
- Existing calculation/storage sources remain authoritative. Stability changes must not rewrite a source merely to change navigation or labels.

## Current numeric sources

| Area | Authoritative source / bridge | Notes |
| --- | --- | --- |
| OPEX core | `js/opex-sync-v2.js` + `opex_baseline_departments` + `opex_budget_submissions` | Department GL/month values. Admin keeps Finance-approved visibility rules. |
| Travel | OPEX submission `travelBudgetByGl` / GL 6020001–6020010 | Travel remains part of the department OPEX workbook and is reflected by Fund Center + month + GL. |
| Salaries | `system_status/hr_salary_allocation_<cc>` + `hr_new_salary_allocation_<cc>` via `js/hr-salary-opex-sync.js` | GL 6010001–6010031, **excluding 6010020**. Existing + new employees combine by Fund Center + GL. |
| Training | `system_status/training_allocation_<cc>` via L&D | Training GL is **6010020**. Source Fund Center is Learning & Development `1000300118`; Training is not sourced from HR salaries. |
| Utilities | `system_status/utilities_budget_fy2027` and approved OPEX utility allocations | Engineering source Fund Center `1000100301`; GL prefix 608. |
| Maintenance | `system_status/maintenance_budget_fy2027` | Engineering source Fund Center `1000100301`; GL prefix 604. |
| Subscriptions | `system_status/subscription_budget_<cc>` + `opex_it_allocations/<cc>.items.subscriptions` | Department Input and IT Allocation remain independent and are added together for OPEX. |
| CAPEX | `capex_budget_submissions/<cc>` | Department CAPEX rows / total, with existing IT workflow kept intact. |

## Stability baseline

`js/stability-baseline.js` captures a numeric regression snapshot in the authenticated admin browser for these representative Fund Centers:

- `1000401103` — Business Development Department
- `1000300106` — Finance Department
- `1000300110` — IT Department
- `1000300108` — Human resources Department
- `1000100301` — Engineering & Project Department

For each Fund Center the guard records:

- FY Budget 2027 OPEX
- Travel
- Salaries
- Training
- Utilities
- Maintenance
- Subscriptions
- CAPEX

The first authenticated admin load creates the baseline. Later loads compare the same source calculations and retain any differences in `sessionStorage` for diagnostics. The guard never writes budget numbers back to Firestore.

## Script classification — first pass

### Active / directly loaded by current pages

- `js/opex-sync-v2.js`
- `js/hr-salary-opex-sync.js`
- `js/travel-workbook.js`
- `js/training-complete-directory-runtime.js`
- `js/utilities.js`
- `js/subscriptions.js`
- `js/subscriptions-complete-filter.js`
- `js/subscriptions-two-sheet-workbook.js`
- `js/manager-workflow.js`
- `js/manager-approval-v2.js`
- `js/dashboard-submissions.js`

### Compatibility / overlapping scripts — keep until dependency review is complete

The following files overlap current functionality or are compatibility layers. They are **not deleted** during this pass:

- `js/subscriptions-all-departments.js`
- `js/subscriptions-full-financials.js`
- `js/subscriptions-layout.js`
- `js/subscriptions-ytd.js`
- `js/subscriptions-opex-bridge.js`
- OPEX overlay / integrity / lock scripts
- Historical template helper scripts

A file is only eligible for later removal after both static page references and runtime imports are proven absent and the numeric baseline remains unchanged.

## Known reading correction in this pass

Subscriptions displayed `Actual YTD Vs Budget` in the opposite direction from the main OPEX convention. The stability UI layer normalizes the displayed variance to:

`Actual YTD - Budget YTD`

This changes only the variance display and its sign/color. It does **not** alter Budget YTD, Actual YTD, FY Budget 2026, FY Budget 2027, stored plans, or Firestore data.

## Workflow rule

A manager submitting a workbook for a Fund Center assigned to that manager does not approve their own submission again. After that manager presses **Submit**, the workflow goes directly to Finance Review. Ordinary user submissions still go to the configured manager first.
