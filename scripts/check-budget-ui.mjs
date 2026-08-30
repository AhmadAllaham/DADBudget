import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const checks=[
  ['Utilities and Maintenance use the shared department directory',read('js/utilities.js').includes("REFERENCE_DOC='central_opex_reference_fy2026'")],
  ['Utilities and Maintenance always include All Departments',read('js/utilities.js').includes('<option value="ALL">All Departments</option>')],
  ['Zero-value departments are visible by default',read('js/utilities.js').includes('hideZero=false')],
  ['Utilities and Maintenance share the same comparison cache',read('js/utilities.js').includes("REFERENCE_CACHE='dadBudgetCentralOpexReferenceCacheV1'")],
  ['Finance publishes the compact department/comparison snapshot',read('js/opex-sync-v2.js').includes("CENTRAL_OPEX_REFERENCE_DOC='central_opex_reference_fy2026'")],
  ['Finance Admin has a bounded full-read cache',read('js/opex-sync-v2.js').includes('ADMIN_VIEW_CACHE_MS=10*60*1000')],
  ['OPEX Admin filter includes All Departments',read('js/opex-sync-v2.js').includes("all.textContent='All Departments'")],
  ['Subscriptions All Departments option remains present',read('js/subscriptions-complete-filter.js').includes("out.push({value:'ALL',label:'All Departments'})")],
  ['Central comparison snapshot writes are Main Admin only',read('firestore.rules').includes("document == 'central_opex_reference_fy2026'\n                      && isMainAdmin()")],
];

const failed=checks.filter(([,ok])=>!ok);
checks.forEach(([label,ok])=>console.log(`${ok?'PASS':'FAIL'}  ${label}`));
if(failed.length){
  console.error(`\n${failed.length} Budget UI quality check(s) failed.`);
  process.exit(1);
}
console.log(`\nPASS  ${checks.length} Budget UI quality checks.`);
