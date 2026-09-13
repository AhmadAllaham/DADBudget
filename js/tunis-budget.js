import {accountList,alignAccounts,parseOpexMatrix,downloadOpex} from './tunis-opex-workbook.js';
import {MONTHS,budgetType,planId,blankRow,validateRows,rowTotal,total,payload} from './tunis-budget-model.js';
import {doc,getDoc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const $=id=>document.getElementById(id),type=budgetType(new URLSearchParams(location.search).get('type'));
const fmt=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
let rows=[],revision=0,ready=false,busy=false,dirty=false,started=false,master=[];
const api=()=>window.DADFirebase,ref=()=>doc(api().db,'tunis_budget',planId(type));
function status(message,error=false){$('tunisStatus').textContent=message;$('tunisStatus').classList.toggle('error',error)}
function controls(){for(const id of ['downloadOpex','uploadOpex','saveBudget'])$(id).disabled=!ready||busy;$('reloadBudget').disabled=!started||busy;document.querySelectorAll('#tunisBody input,#tunisBody button').forEach(el=>el.disabled=!ready||busy)}
function changed(){dirty=true;status('Unsaved changes. Select Save budget to save your entries.');updateTotals()}
function updateTotals(){
  $('totalValue').textContent=fmt(total(rows));
  document.querySelectorAll('[data-total]').forEach((el,i)=>el.textContent=fmt(rowTotal(rows[i])));
  const footer=$('tunisFooter');footer.replaceChildren();const tr=document.createElement('tr'),label=document.createElement('td');label.colSpan=2;label.textContent='TOTAL';tr.append(label);
  for(let m=0;m<12;m++){const td=document.createElement('td');td.textContent=fmt(rows.reduce((s,r)=>s+Math.round(Number(r.months[m]||0)*100),0)/100);tr.append(td)}
  const td=document.createElement('td');td.textContent=fmt(total(rows));tr.append(td);footer.append(tr);
}
function render(){
  const body=$('tunisBody');body.replaceChildren();
  if(!rows.length){const tr=body.insertRow(),td=tr.insertCell();td.colSpan=16;td.className='empty';td.textContent='No budget lines yet. Select Add line to start.'}
  rows.forEach((row,i)=>{
    const tr=body.insertRow();
    for(const key of ['code','description']){const input=document.createElement('input');input.value=row[key];input.readOnly=true;input.maxLength=key==='code'?80:250;input.setAttribute('aria-label',`Line ${i+1} ${key}`);input.addEventListener('input',()=>{row[key]=input.value;changed()});tr.insertCell().append(input)}
    row.months.forEach((value,m)=>{const input=document.createElement('input');input.type='number';input.min='0';input.max='10000000000';input.step='.01';input.value=value||'';input.placeholder='0.00';input.setAttribute('aria-label',`Line ${i+1} ${MONTHS[m]} JOD`);input.addEventListener('input',()=>{row.months[m]=input.validity.badInput?NaN:input.value;changed()});tr.insertCell().append(input)});
    tr.insertCell().dataset.total='1';
  });updateTotals();controls();
}
async function load(){
  if(busy)return;if(dirty&&!confirm('Discard unsaved changes and reload the saved budget?'))return;
  busy=true;ready=false;controls();status('Loading saved Tunis budget…');
  try{const [snapshot,baseline]=await Promise.all([getDoc(ref()),getDoc(doc(api().db,'opex_baseline_meta','current'))]);master=accountList(baseline.exists()?baseline.data().accountMaster:null);const data=snapshot.exists()?snapshot.data():null;const next=alignAccounts(master,data?.rows||[]);rows=next;revision=data?.revision||0;ready=true;dirty=false;render();status(data?`Loaded saved ${type.toUpperCase()} 2027 · revision ${revision}.`:'Approved OPEX accounts loaded. Download the template or enter monthly amounts.');}
  catch(error){status(`Could not load budget: ${error.message}`,true)}finally{busy=false;controls()}
}
async function save(){
  if(!ready||busy)return;
  let clean;try{if(!$('tunisTable').querySelectorAll('input:invalid').length)clean=validateRows(rows);else throw Error('Check the highlighted amounts: use non-negative values with at most two decimals.')}catch(error){status(error.message,true);return}
  busy=true;controls();status('Saving Tunis budget…');
  try{const result=await runTransaction(api().db,async transaction=>{
    const snapshot=await transaction.get(ref()),current=snapshot.exists()?snapshot.data().revision||0:0;
    if(current!==revision)throw Error('Another session updated this budget. Copy your unsaved entries before using Reload saved.');
    const next=payload(type,clean,revision,api().auth.currentUser.uid,serverTimestamp());transaction.set(ref(),next);return next;
  });rows=alignAccounts(master,result.rows);revision=result.revision;dirty=false;render();status(`Saved ${type.toUpperCase()} 2027 successfully · revision ${revision}.`)}
  catch(error){status(`Not saved: ${error.message}`,true)}finally{busy=false;controls()}
}
async function start(){
  if(started||!api()?.auth.currentUser)return;
  try{const profile=await api().getUserProfile(api().auth.currentUser.uid);if(!profile||profile.enabled===false||!(profile.isMainAdmin===true||profile.role==='admin')){status('Tunis Budget is available to administrators only.',true);return}started=true;await load()}
  catch(error){status(`Could not verify access: ${error.message}`,true)}
}
$('budgetLabel').textContent=$('editorHeading').textContent=`${type.toUpperCase()} 2027`;$('sectorLabel').textContent=type==='opex'?'G&A':'CAPEX';
for(const a of document.querySelectorAll('[data-type]'))if(a.dataset.type===type)a.setAttribute('aria-current','page');
const head=document.createElement('tr');for(const label of [type==='opex'?'Account code':'Asset code',type==='opex'?'Expense description':'Asset / project description',...MONTHS,'FY 2027']){const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th)}$('tunisHeader').append(head);
$('downloadOpex').addEventListener('click',()=>downloadOpex(rows).catch(e=>status(e.message,true)));
$('uploadOpex').addEventListener('click',()=>$('opexFile').click());
$('opexFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(!ready||busy)throw Error('Wait until the saved budget has loaded.');if(dirty&&!confirm('Replace unsaved changes with this workbook?'))return;const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=wb.Sheets['Tunis OPEX 2027'];if(!sheet)throw Error('Tunis OPEX 2027 sheet is missing.');const next=parseOpexMatrix(XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}),master);rows=next;changed();render();status('Workbook validated. Select Save budget to save these amounts.');}catch(error){status(error.message,true)}finally{event.target.value=''}});
$('saveBudget').addEventListener('click',save);$('reloadBudget').addEventListener('click',load);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
window.addEventListener('dad-user-ready',start);start();
