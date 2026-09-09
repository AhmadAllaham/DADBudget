// Creates an isolated browser fixture with synthetic profiles and no Firebase requests.
// Run: node scripts/navigation-filter-regression.mjs /tmp/budget-ui-check
// Serve that directory, open index.html, and read the visible test results.
import fs from 'node:fs';
import path from 'node:path';
const out=process.argv[2];if(!out)throw Error('Provide a temporary output directory');
fs.mkdirSync(out,{recursive:true});
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
for(const name of ['app.js','opex-submodule-access.js','ui-stability-pass.js'])fs.writeFileSync(path.join(out,name),read('js/'+name));
fs.writeFileSync(path.join(out,'department-groups.js'),read('js/department-groups.js').split('\n(function(){')[0]);
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Budget navigation regression</title>
<style>body{font:16px system-ui;margin:24px;color:#183f46}.app-shell{display:flex;gap:30px}.sidebar{background:#123f46;color:white;padding:20px;width:230px}.sidebar a{display:block;color:white;padding:7px}.department-combo-menu{display:none}.department-combo-open .department-combo-menu{display:block}.department-native-select{display:none}.department-combo-option{display:block}li{margin:8px}</style></head><body>
<h1>Navigation and department filter verification</h1><ol id="results"></ol><div class="app-shell"><aside class="sidebar"><nav class="sidebar-nav"><a href="index.html">Dashboard</a><a href="opex.html">OPEX Planning</a><div class="opex-subnav"><a href="opex.html">OPEX Detail</a><a href="opex-summary.html">Summary</a><a href="travel-budget.html">Travel</a><a href="subscriptions.html">Subscriptions</a><a href="training-expense.html">Training Expense</a></div><a href="capex.html">CAPEX Planning</a></nav></aside><main><h2>Department</h2><div class="department-filter-stack"><input id="deptSearch"><select id="deptFilter"><option value="A">Department A</option><option value="B">Department B</option></select></div></main></div>
<script type="application/json" src="js/firebase.js"></script>
<script>const PROFILE='dadBudgetCurrentProfile';let p={role:'department_user',email:'fixture@example.test',departments:['A'],modules:['opex_detail','capex']};localStorage.setItem(PROFILE,JSON.stringify(p));</script>
<script src="department-groups.js"></script><script src="app.js"></script><script src="ui-stability-pass.js"></script><script src="opex-submodule-access.js"></script>
<script>
const pause=()=>new Promise(r=>setTimeout(r,100));
const check=(label,ok)=>{const li=document.createElement('li');li.textContent=(ok?'PASS ':'FAIL ')+label;li.style.color=ok?'#087548':'#bf2020';document.getElementById('results').append(li);if(!ok)throw Error(label)};
const update=deps=>{p={...p,departments:deps};localStorage.setItem(PROFILE,JSON.stringify(p));window.dispatchEvent(new CustomEvent('dad-user-ready',{detail:{profile:p}}))};
window.addEventListener('load',async()=>{try{
await pause();const sel=document.getElementById('deptFilter');window.DADDepartmentGroups.bindSearch(sel,document.getElementById('deptSearch'));
check('Initial scope removes unassigned department',sel.options.length===1&&sel.value==='A');
sel.disabled=true;update(['A','B']);await pause();sel.innerHTML='<optgroup label="Departments"><option value="A">Department A</option><option value="B">Department B</option></optgroup>';await pause();
check('Updated profile keeps both departments and enables selection',sel.options.length===2&&!sel.disabled);
sel.value='B';sel.dispatchEvent(new Event('change',{bubbles:true}));await pause();check('Search trigger reflects selected department',document.querySelector('.department-combo-trigger').textContent==='Department B');
update(['A']);await pause();check('Revoked selection switches to permitted department',sel.value==='A'&&sel.options.length===1);
update([]);await pause();check('Empty scope removes stale options and disables control',sel.options.length===0&&sel.disabled);
update(['A','B']);await pause();sel.innerHTML='<optgroup label="Departments"><option value="A">Department A</option></optgroup>';await pause();const option=new Option('Department B','B');sel.querySelector('optgroup').append(option);await pause();check('Nested options added after loading appear in search',document.querySelectorAll('.department-combo-option').length===2&&!sel.disabled);
check('Explicit module permissions remain stable',getComputedStyle(document.querySelector('.opex-subnav a[href="subscriptions.html"]')).display==='none'&&getComputedStyle(document.querySelector('.opex-subnav a[href="opex.html"]')).display!=='none');
let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(document.querySelector('.sidebar-nav'),{attributes:true,subtree:true,childList:true});await new Promise(r=>setTimeout(r,1200));observer.disconnect();check('Idle navigation makes zero DOM mutations',mutations===0);
const l=document.createElement('a');l.href='training-expense.html';l.textContent='Late Training Link';document.querySelector('.opex-subnav').append(l);await pause();check('Late-added links receive permissions',getComputedStyle(l).display==='none');
const done=document.createElement('p');done.id='done';done.textContent='All 9 browser regression checks passed.';document.body.prepend(done);
}catch(error){const failed=document.createElement('p');failed.id='failed';failed.textContent=error.message;document.body.prepend(failed)}});
</script></body></html>`);
console.log(out+'/index.html');
