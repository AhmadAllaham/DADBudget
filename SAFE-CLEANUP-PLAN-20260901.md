# Safe Cleanup Plan — 2026-09-01

This file is documentation only. It does not change Firebase data or application calculations.

## Non-destructive rule

Existing department-entered Budget 2027 data must remain untouched during cleanup.

- No deletes.
- No migrations.
- No bulk rewrites.
- No re-saving department budgets just to clean code.
- No workflow-status changes during cleanup testing.
- No Firestore Rules change in the same change set as calculation cleanup.

## Safe sequence

1. Work only in `cleanup-safe-v1` until comparisons are complete.
2. Treat current Firestore records as authoritative.
3. Build any future OPEX composer in read-only comparison mode first.
4. Compare current and proposed results by Fund Center + G/L + Month.
5. Require zero difference before switching any visible page.
6. Move read-only reporting pages first; keep uploads and approval workflow unchanged.
7. Disable legacy scripts only after they are proven unused; do not delete them initially.
8. Keep rollback possible at every step.

## Data sources that must not be rewritten during cleanup

- `opex_budget_submissions/<cc>`
- `capex_budget_submissions/<cc>`
- `system_status/subscription_budget_<cc>`
- `system_status/training_allocation_<cc>`
- `system_status/hr_salary_allocation_<cc>`
- `system_status/hr_new_salary_allocation_<cc>`
- `system_status/utilities_budget_fy2027`
- `system_status/maintenance_budget_fy2027`
- existing IT allocation documents and saved project/licensing plans

## Comparison requirement before any switch

For every tested Fund Center:

`Current FY2027 OPEX == Proposed FY2027 OPEX`

and for every controlled area:

`Current G/L monthly values == Proposed G/L monthly values`

Any non-zero difference blocks the switch.
