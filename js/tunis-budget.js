import {accountList,alignAccounts,parseOpexMatrix,downloadOpex,opexCategory} from './tunis-opex-workbook.js?v=20260914-tunis-grouping-1';
import {MONTHS,budgetType,planId,blankRow,validateRows,rowTotal,total,payload} from './tunis-budget-model.js';
import {doc,getDoc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const $=id=>document.getElementById(id),type=budgetType(new URLSearchParams(location.search).get('type'));
const fmt=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
let rows=[],revision=0,ready=false,busy=false,started=false,master=[];
let totalsOnly=false,hideZero=false;
const CATEGORIES=['Employees Benefits','Travel Costs','Depreciation and Amortization','Maintenance cost','A&P, Marketing Activities','IT and Connectivity Expenses','Professional & Consultation Expenses','Utilities Expenses','Insurance Expenses','Logistic Expenses','Governmental and Taxes Expenses','Vehicles Expenses','Products related Expense','Other Expenses'];
const api=()=>window.DADFirebase,ref=()=>doc(api().db,'tunis_budget',planId(type));
function status(message,error=false){$('tunisStatus').textContent=message;$('tunisStatus').classList.toggle('error',error)}
function controls(){for(const id of ['downloadOpex','uploadOpex','summaryToggle','zeroToggle'])$(id).disabled=!ready||busy;$('reloadBudget').disabled=!started||busy}
function grouped(){const map=new Map(CATEGORIES.map(name=>[name,[]]));rows.forEach((row,index)=>map.get(opexCategory(row.code)).push({row,index}));return [...map].filter(([,items])=>items.length)}
function monthSum(items,month){return Math.round(items.reduce((sum,item)=>sum+Number(item.row.months[month]||0),0)*100)/100}
function applyModes(){document.querySelectorAll('#tunisBody .detail-row').forEach(row=>row.classList.toggle('detail-hidden',totalsOnly));document.querySelectorAll('#tunisBody tr[data-zero]').forEach(row=>row.classList.toggle('zero-hidden',hideZero&&row.dataset.zero==='1'));$('summaryToggle').classList.toggle('active',totalsOnly);$('summaryToggle').textContent=totalsOnly?'Show Details':'Totals Only';$('zeroToggle').classList.toggle('active',hideZero);$('zeroToggle').textContent=hideZero?'Show Zero Rows':'Hide Zero Rows'}
function updateTotals(){
  $('totalValue').textContent=fmt(total(rows));
  document.querySelectorAll('[data-row-total]').forEach(el=>el.textContent=fmt(rowTotal(rows[Number(el.dataset.rowTotal)])));
  document.querySelectorAll('#tunisBody .detail-row').forEach(el=>el.dataset.zero=Math.abs(rowTotal(rows[Number(el.dataset.rowIndex)]))<.005?'1':'0');
  grouped().forEach(([name,items],groupIndex)=>{const tr=document.querySelector(`#tunisBody tr[data-group-index="${groupIndex}"]`);if(!tr)return;for(let month=0;month<12;month++)tr.cells[month+1].textContent=fmt(monthSum(items,month));const groupTotal=items.reduce((sum,item)=>sum+rowTotal(item.row),0);tr.cells[13].textContent=fmt(groupTotal);tr.dataset.zero=Math.abs(groupTotal)<.005?'1':'0'});
  const footer=$('tunisFooter');footer.replaceChildren();const tr=document.createElement('tr'),label=document.createElement('td');label.textContent='Total OPEX';tr.append(label);
  for(let m=0;m<12;m++){const td=document.createElement('td');td.textContent=fmt(rows.reduce((s,r)=>s+Math.round(Number(r.months[m]||0)*100),0)/100);tr.append(td)}
  const td=document.createElement('td');td.textContent=fmt(total(rows));tr.append(td);footer.append(tr);applyModes();
}
function render(){
  const body=$('tunisBody');body.replaceChildren();
  if(!rows.length){const tr=body.insertRow(),td=tr.insertCell();td.colSpan=14;td.className='empty';td.textContent='No approved OPEX accounts are available.'}
  grouped().forEach(([name,items],groupIndex)=>{
    const groupRow=body.insertRow();groupRow.className='group-row';groupRow.dataset.groupIndex=groupIndex;groupRow.insertCell().textContent=name;for(let i=0;i<13;i++)groupRow.insertCell();
    items.forEach(({row,index})=>{const tr=body.insertRow();tr.className='detail-row';tr.dataset.rowIndex=index;const label=tr.insertCell(),name=document.createElement('span'),code=document.createElement('span');name.className='expense-name';name.textContent=row.description;code.className='gl-code';code.textContent=row.code;label.append(name,code);row.months.forEach(value=>{const amount=tr.insertCell();amount.className='amount-cell';amount.textContent=fmt(value)});const totalCell=tr.insertCell();totalCell.dataset.rowTotal=index});
    const gap=body.insertRow();gap.className='section-gap';const gapCell=gap.insertCell();gapCell.colSpan=14;
  });updateTotals();controls();
}
async function load(){
  if(busy)return;
  busy=true;ready=false;controls();status('Loading saved Tunis budget…');
  try{const [snapshot,baseline]=await Promise.all([getDoc(ref()),getDoc(doc(api().db,'opex_baseline_meta','current'))]);master=accountList(baseline.exists()?baseline.data().accountMaster:null);const data=snapshot.exists()?snapshot.data():null;const next=alignAccounts(master,data?.rows||[]);rows=next;revision=data?.revision||0;ready=true;render();status(data?`Loaded saved ${type.toUpperCase()} 2027 · revision ${revision}.`:'Approved OPEX accounts loaded. Download the template, complete it, then upload it.');}
  catch(error){status(`Could not load budget: ${error.message}`,true)}finally{busy=false;controls()}
}
async function saveWorkbook(nextRows,fileName){
  if(!ready||busy)return;
  let clean;try{clean=validateRows(nextRows)}catch(error){status(error.message,true);return}
  busy=true;controls();status(`Validating and saving ${fileName}…`);
  try{const result=await runTransaction(api().db,async transaction=>{
    const snapshot=await transaction.get(ref()),current=snapshot.exists()?snapshot.data().revision||0:0;
    if(current!==revision)throw Error('Another session updated this budget. Select Reload saved, then upload the workbook again.');
    const next=payload(type,clean,revision,api().auth.currentUser.uid,serverTimestamp());transaction.set(ref(),next);return next;
  });rows=alignAccounts(master,result.rows);revision=result.revision;render();status(`${fileName} uploaded and saved successfully · revision ${revision}.`)}
  catch(error){status(`Workbook was not saved: ${error.message}`,true)}finally{busy=false;controls()}
}
async function start(){
  if(started||!api()?.auth.currentUser)return;
  try{const profile=await api().getUserProfile(api().auth.currentUser.uid),modules=Array.isArray(profile?.modules)?profile.modules:[];if(!profile||profile.enabled===false||!(profile.isMainAdmin===true||modules.includes('tunis'))){status('DAD Tunis permission is required.',true);return}started=true;await load()}
  catch(error){status(`Could not verify access: ${error.message}`,true)}
}
$('budgetLabel').textContent=$('editorHeading').textContent=`${type.toUpperCase()} 2027`;$('sectorLabel').textContent=type==='opex'?'G&A':'CAPEX';
for(const a of document.querySelectorAll('[data-type]'))if(a.dataset.type===type)a.setAttribute('aria-current','page');
const head=document.createElement('tr');for(const label of ['Group / Expense',...MONTHS,'FY Budget 2027']){const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th)}$('tunisHeader').append(head);
$('downloadOpex').addEventListener('click',()=>downloadOpex(rows).catch(e=>status(e.message,true)));
$('uploadOpex').addEventListener('click',()=>$('opexFile').click());
$('opexFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(!ready||busy)throw Error('Wait until the saved budget has loaded.');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=wb.Sheets['Tunis OPEX 2027'];if(!sheet)throw Error('Tunis OPEX 2027 sheet is missing.');const next=parseOpexMatrix(XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}),master);await saveWorkbook(next,file.name);}catch(error){status(error.message,true)}finally{event.target.value=''}});
$('reloadBudget').addEventListener('click',load);
$('summaryToggle').addEventListener('click',()=>{totalsOnly=!totalsOnly;applyModes()});
$('zeroToggle').addEventListener('click',()=>{hideZero=!hideZero;applyModes()});
window.addEventListener('dad-user-ready',start);start();
