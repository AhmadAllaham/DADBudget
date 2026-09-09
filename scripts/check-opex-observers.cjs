// Usage: node scripts/check-opex-observers.cjs /path/to/node_modules/jsdom
const fs=require('fs'),path=require('path');
const {JSDOM}=require(process.argv[2]||'jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM('<!doctype html><div class="department-filter-stack"><input id="deptSearch"><select id="deptFilter"><option value="ALL">All Departments</option><option value="A">Department A</option></select></div><table><tbody id="opexBody"><tr class="detail-row"><td>999<span class="gl-code">999</span></td><td class="fy-cell">10</td><td class="new-budget-cell">20</td></tr></tbody></table><div id="kpiNewBudget"></div>',{url:'https://fixture.test/opex.html',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,read=f=>process.env.BEFORE_FIX?require('child_process').execFileSync('git',['show','HEAD:js/'+f],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'js',f),'utf8');
w.localStorage.setItem('dadBudgetOPEXBaselineV17',JSON.stringify({departments:{A:{cc:'A',items:{999:{code:'999',name:'999',fyBudget:10,newBudgetByMonth:{'2027-01':20}}}}}}));
w.eval(read('department-groups.js').split('\n(function(){')[0]);w.DADDepartmentGroups.bindSearch(w.document.querySelector('select'),w.document.querySelector('input'));
for(const file of ['opex-labels.js','opex-account-name-fix.js','opex-budget-increase-alerts.js','opex-fy27-integrity-fix.js'])w.eval('(function(){'+read(file).replace(/^import\(.*$/gm,'')+'})();');
let changes=0;const observer=new w.MutationObserver(records=>{changes+=records.length;if(changes>500){console.error('FAIL: observer feedback loop');process.exit(1)}});observer.observe(w.document.documentElement,{subtree:true,childList:true,characterData:true});
setTimeout(()=>{changes=0;setTimeout(()=>{
if(changes!==0)throw Error('Idle observers still mutate DOM: '+changes);
const sel=w.document.querySelector('select');sel.value='A';sel.dispatchEvent(new w.Event('change',{bubbles:true}));
setTimeout(()=>{changes=0;setTimeout(()=>{if(changes!==0)throw Error('Department view still mutates DOM: '+changes);if(sel.value!=='A')throw Error('Selection reset');if(w.document.querySelectorAll('.budget-increase-dot').length!==1)throw Error('Alert missing or duplicated');console.log('PASS: All Departments settles; department switch stays selected; unknown account and alert settle without loops.');observer.disconnect();process.exit(0)},200)},150);
},200)},150);
