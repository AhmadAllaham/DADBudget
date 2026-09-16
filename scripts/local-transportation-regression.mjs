import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const complete=read('js/opex-template-complete.js');
const fallback=read('js/opex-template-all-rows.js');
const opex=read('opex.html');
const travel=read('js/travel-workbook.js');
const manager=read('js/manager-budget-editor.js');

assert.match(complete,/LOCAL_TRANSPORT_GL='6020009'/);
assert.match(complete,/isTravelSheetControlled\(code\).*!==LOCAL_TRANSPORT_GL/);
assert.match(complete,/Local Transportation G\/L 6020009 which is entered monthly in this OPEX sheet/);
assert.match(fallback,/travelAccount\(code\).*c!==LOCAL_TRANSPORT_GL/);
assert.match(opex,/isTravel=.*String\(gl\)!=='6020009'/);
assert.match(opex,/if\(gl==='6020009'\|\|Math\.abs\(v\)<\.005\)return/);
assert.match(travel,/newBudgetByMonth:gl===LOCAL_TRANSPORT_GL\?\{\.\.\.\(existing\.newBudgetByMonth\|\|\{\}\)\}:\{\}/);
assert.match(travel,/if\(gl===LOCAL_TRANSPORT_GL\|\|!next\.items\[gl\]/);
assert.match(manager,/c!==LOCAL_TRANSPORT_GL/);
assert.match(manager,/restoreManagerLocalTransportation\(cc,sanitized\)/);

console.log('Local Transportation 6020009 regression checks passed.');
