import {collection,getDocs,query,orderBy,startAt,endAt,documentId} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const PREFIX={existing:'hr_salary_allocation_',new:'hr_new_salary_allocation_'};
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?Math.max(0,x):0};
const fmt=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
let installed=false,combinedActive=false,lastUnderlying='existing',combinedData=null,statusSnapshot=null;
const queryCache=new Map();

function salaryQuery(db,prefix){return query(collection(db,'system_status'),orderBy(documentId()),startAt(prefix),endAt(`${prefix}\uf8ff`))}
function setMainStatus(message,type=''){const el=$('salaryStatus');if(!el)return;el.textContent=message;el.className=`status-line ${type}`.trim()}
function saveStatus(){const el=$('salaryStatus');if(el)statusSnapshot={text:el.textContent,className:el.className}}
function restoreStatus(){const el=$('salaryStatus');if(el&&statusSnapshot){el.textContent=statusSnapshot.text;el.className=statusSnapshot.className}statusSnapshot=null}
function setStandardActions(show){['salaryTemplateBtn','salarySavedBtn','salaryUploadBtn'].forEach(id=>{const el=$(id);if(el)el.style.display=show?'':'none'});const c=$('salaryCombinedDownloadBtn');if(c)c.style.display=show?'none':''}
function showCombinedPanels(show){const normalKpis=document.querySelector('.hr-salary-page > .kpis'),normalMatrix=document.querySelector('.hr-salary-page > .matrix-card'),combinedKpis=$('combinedSalaryKpis'),combinedCard=$('combinedSalaryCard');if(normalKpis)normalKpis.style.display=show?'none':'';if(normalMatrix)normalMatrix.style.display=show?'none':'';if(combinedKpis)combinedKpis.style.display=show?'':'none';if(combinedCard)combinedCard.style.display=show?'':'none'}
function setActiveTab(key){document.querySelectorAll('[data-salary-mode]').forEach(b=>b.classList.toggle('active',b.dataset.salaryMode===key))}

function readCurrentMatrix(){
  const headCells=[...document.querySelectorAll('#salaryHead th')],rows=[...document.querySelectorAll('#salaryBody .salary-row')];
  if(headCells.length<4||!rows.length)throw new Error('Salary matrix is not ready yet.');
  const departments=headCells.slice(2,-1).map(th=>({cc:clean(th.querySelector('.dept-head b')?.textContent),name:clean(th.querySelector('.dept-head small')?.textContent)})).filter(d=>d.cc);
  if(!departments.length)throw new Error('No salary departments were found.');
  const accounts=[],values=new Map(departments.map(d=>[d.cc,new Map()]));
  rows.forEach(row=>{const cells=[...row.cells],gl=clean(cells[0]?.textContent),name=clean(cells[1]?.textContent);if(!gl)return;accounts.push({code:gl,name});departments.forEach((d,i)=>values.get(d.cc).set(gl,num(cells[2+i]?.textContent)))});
  return{departments,accounts,values};
}

async function fetchOtherMode(key,departments,accounts){
  const api=window.DADFirebase;if(!api?.db)throw new Error('Secure cloud connection is not ready.');
  const cached=queryCache.get(key);if(cached&&Date.now()-cached.at<15000)return cached.values;
  const prefix=PREFIX[key],snap=await getDocs(salaryQuery(api.db,prefix)),allowedCc=new Set(departments.map(d=>d.cc)),allowedGl=new Set(accounts.map(a=>a.code)),values=new Map(departments.map(d=>[d.cc,new Map()]));
  snap.docs.forEach(docSnap=>{const cc=clean(docSnap.id).slice(prefix.length);if(!allowedCc.has(cc))return;Object.entries(docSnap.data()?.items||{}).forEach(([raw,item])=>{const gl=clean(item?.code||raw);if(allowedGl.has(gl))values.get(cc).set(gl,num(item?.annual))})});
  queryCache.set(key,{at:Date.now(),values});return values;
}

function mergeData(base,otherValues,underlying){
  const values=new Map(base.departments.map(d=>[d.cc,new Map()]));
  base.departments.forEach(d=>base.accounts.forEach(a=>values.get(d.cc).set(a.code,num(base.values.get(d.cc)?.get(a.code))+num(otherValues.get(d.cc)?.get(a.code)))));
  return{departments:base.departments,accounts:base.accounts,values,underlying};
}
function valueOf(data,cc,gl){return num(data?.values?.get(cc)?.get(gl))}
function departmentTotal(data,cc){return data.accounts.reduce((s,a)=>s+valueOf(data,cc,a.code),0)}
function accountTotal(data,gl){return data.departments.reduce((s,d)=>s+valueOf(data,d.cc,gl),0)}
function companyTotal(data){return data.departments.reduce((s,d)=>s+departmentTotal(data,d.cc),0)}
function esc(v){return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function applyCombinedFilters(){
  if(!combinedData)return;const aq=clean($('combinedSalaryAccountSearch')?.value).toLowerCase(),dq=clean($('combinedSalaryDepartmentSearch')?.value).toLowerCase();
  document.querySelectorAll('#combinedSalaryBody .salary-row').forEach(r=>r.classList.toggle('hidden-row',!!aq&&!clean(r.dataset.rowText).includes(aq)));
  combinedData.departments.forEach((d,i)=>{const hide=!!dq&&!`${d.cc} ${d.name}`.toLowerCase().includes(dq);document.querySelectorAll(`#combinedSalaryCard .combined-dept-${i}`).forEach(cell=>cell.classList.toggle('hidden-col',hide))})
}
function renderCombined(){
  const data=combinedData;if(!data)return;const head=$('combinedSalaryHead'),body=$('combinedSalaryBody');
  head.innerHTML=`<tr><th>Account No.</th><th>Salary / Employee Cost Item</th>${data.departments.map((d,i)=>`<th class="combined-dept-${i}"><span class="dept-head"><b>${esc(d.cc)}</b><small>${esc(d.name)}</small></span></th>`).join('')}<th>Company Total</th></tr>`;
  body.innerHTML=data.accounts.map(a=>`<tr class="salary-row" data-row-text="${esc(`${a.code} ${a.name}`.toLowerCase())}"><td>${esc(a.code)}</td><td>${esc(a.name)}</td>${data.departments.map((d,i)=>`<td class="combined-dept-${i}"><span class="salary-readonly-value">${fmt(valueOf(data,d.cc,a.code))}</span></td>`).join('')}<td class="company-total">${fmt(accountTotal(data,a.code))}</td></tr>`).join('')+`<tr class="total-row"><td>TOTAL</td><td>FY Budget 2027 · Existing + New</td>${data.departments.map((d,i)=>`<td class="combined-dept-${i}">${fmt(departmentTotal(data,d.cc))}</td>`).join('')}<td>${fmt(companyTotal(data))}</td></tr>`;
  $('combinedSalaryKpiTotal').textContent=fmt(companyTotal(data));$('combinedSalaryKpiDepartments').textContent=data.departments.length.toLocaleString();$('combinedSalaryKpiAccounts').textContent=data.accounts.length.toLocaleString();$('combinedSalaryKpiActive').textContent=data.departments.filter(d=>departmentTotal(data,d.cc)>0).length.toLocaleString();applyCombinedFilters()
}

async function waitForUnderlyingMatrix(key){
  const expected=key==='new'?'New Employees':'Existing Employees';
  for(let i=0;i<40;i++){const title=clean($('salaryMatrixTitle')?.textContent),rows=document.querySelectorAll('#salaryBody .salary-row').length;if(rows&&title.includes(expected))return;await new Promise(r=>setTimeout(r,125))}
  throw new Error('Please wait until the selected salary page finishes loading, then try Total Salaries again.');
}

async function enterCombined(){
  if(combinedActive)return;if($('salaryUploadBtn')?.disabled){setMainStatus('Please wait until the salary upload finishes before opening Total Salaries.','error');return}
  const current=[...document.querySelectorAll('[data-salary-mode]')].find(b=>b.classList.contains('active')&&b.dataset.salaryMode!=='combined');lastUnderlying=current?.dataset.salaryMode==='new'?'new':'existing';
  combinedActive=true;saveStatus();setActiveTab('combined');setStandardActions(false);showCombinedPanels(true);setMainStatus('Building Total Salaries · Existing Employees + New Employees...');
  try{await waitForUnderlyingMatrix(lastUnderlying);const base=readCurrentMatrix(),other=lastUnderlying==='existing'?'new':'existing',otherValues=await fetchOtherMode(other,base.departments,base.accounts);combinedData=mergeData(base,otherValues,lastUnderlying);renderCombined();setMainStatus(`Total Salaries ready · Existing Employees + New Employees · ${combinedData.departments.length} departments`,'ready')}
  catch(error){console.error(error);setMainStatus(`Unable to build Total Salaries: ${error.message||error}`,'error')}
}
function leaveCombined(target){if(!combinedActive)return;combinedActive=false;showCombinedPanels(false);setStandardActions(true);setActiveTab(target||lastUnderlying);restoreStatus()}

async function downloadCombined(){
  if(!combinedData)throw new Error('Open Total Salaries first.');if(typeof ExcelJS==='undefined')throw new Error('Excel engine is still loading.');const data=combinedData,wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();const ws=wb.addWorksheet('Total Salaries'),info=wb.addWorksheet('Info'),navy='FF0A2C61',white='FFFFFFFF',green='FFEAF9F5';
  const headers=['Account No.','Salary / Employee Cost Item',...data.departments.map(d=>`${d.cc} · ${d.name}`),'Company Total'],header=ws.addRow(headers),deptStart=3,deptEnd=2+data.departments.length,companyCol=deptEnd+1;
  data.accounts.forEach(a=>{const row=ws.addRow([a.code,a.name,...data.departments.map(d=>valueOf(data,d.cc,a.code)),accountTotal(data,a.code)]);for(let c=deptStart;c<=companyCol;c++){row.getCell(c).numFmt='#,##0.00';row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:green}}}});
  const total=ws.addRow(['TOTAL','FY Budget 2027 · Existing + New',...data.departments.map(d=>departmentTotal(data,d.cc)),companyTotal(data)]);total.font={bold:true,color:{argb:white}};total.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};
  header.height=48;header.eachCell(cell=>{cell.font={bold:true,color:{argb:white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true}});ws.views=[{state:'frozen',ySplit:1,xSplit:2}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:companyCol}};ws.getColumn(1).width=15;ws.getColumn(2).width=38;for(let c=deptStart;c<=deptEnd;c++)ws.getColumn(c).width=23;ws.getColumn(companyCol).width=20;
  info.addRow(['DAD BUDGET 2027 · TOTAL SALARIES']);info.addRow(['Scope','Existing Employees Salaries + New Employees Salaries']);info.addRow(['Fiscal Year',2027]);info.addRow(['Currency','JOD']);info.addRow(['Company Total',companyTotal(data)]);info.getColumn(1).width=24;info.getColumn(2).width=45;info.getRow(1).font={bold:true,size:16,color:{argb:navy}};
  const buf=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='Budget_2027_HR_Total_Salaries_Existing_Plus_New.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function installUi(){
  if(installed)return;const tabs=document.querySelector('.salary-tabs'),actions=document.querySelector('.page-head .actions'),normalMatrix=document.querySelector('.hr-salary-page > .matrix-card');if(!tabs||!actions||!normalMatrix){setTimeout(installUi,150);return}installed=true;
  if(!tabs.querySelector('[data-salary-mode="combined"]')){const b=document.createElement('button');b.className='salary-tab';b.dataset.salaryMode='combined';b.type='button';b.textContent='Total Salaries';tabs.appendChild(b)}
  if(!$('salaryCombinedDownloadBtn')){const b=document.createElement('button');b.className='action-btn';b.id='salaryCombinedDownloadBtn';b.type='button';b.textContent='Download Combined Data';b.style.display='none';actions.insertBefore(b,$('salaryUploadBtn')||null);b.addEventListener('click',()=>downloadCombined().catch(e=>alert(e.message||e)))}
  const kpis=document.createElement('section');kpis.id='combinedSalaryKpis';kpis.className='kpis';kpis.style.display='none';kpis.innerHTML='<article class="card kpi"><span>Total Salaries / Benefits</span><strong id="combinedSalaryKpiTotal">—</strong></article><article class="card kpi"><span>Departments / Fund Centers</span><strong id="combinedSalaryKpiDepartments">—</strong></article><article class="card kpi"><span>Employee Cost G/Ls</span><strong id="combinedSalaryKpiAccounts">—</strong></article><article class="card kpi"><span>Departments With Budget</span><strong id="combinedSalaryKpiActive">—</strong></article>';
  const card=document.createElement('section');card.id='combinedSalaryCard';card.className='card matrix-card';card.style.display='none';card.innerHTML='<div class="tools"><div><h2>FY Budget 2027 · Total Salaries</h2><p>Read-only consolidated view: Existing Employees Salaries + New Employees Salaries.</p></div><div class="filters"><input class="search" id="combinedSalaryAccountSearch" type="search" placeholder="Search salary item / G/L..."><input class="search" id="combinedSalaryDepartmentSearch" type="search" placeholder="Search department / Fund Center..."></div></div><div class="matrix-wrap"><table class="salary-matrix"><thead id="combinedSalaryHead"><tr><th>Account No.</th><th>Salary / Employee Cost Item</th><th>Loading...</th></tr></thead><tbody id="combinedSalaryBody"><tr><td colspan="3">Open Total Salaries to calculate the combined view.</td></tr></tbody></table></div><div class="note"><b>Consolidated HR view:</b> every value equals Existing Employees Salaries + New Employees Salaries for the same Fund Center and G/L. This tab is read-only and is the total reflected into department OPEX.</div>';
  normalMatrix.parentNode.insertBefore(kpis,normalMatrix);normalMatrix.parentNode.insertBefore(card,normalMatrix.nextSibling);
  $('combinedSalaryAccountSearch').addEventListener('input',applyCombinedFilters);$('combinedSalaryDepartmentSearch').addEventListener('input',applyCombinedFilters);
  tabs.addEventListener('click',event=>{const button=event.target.closest('[data-salary-mode]');if(!button)return;const target=button.dataset.salaryMode;if(target==='combined'){event.preventDefault();event.stopImmediatePropagation();enterCombined();return}if(combinedActive)leaveCombined(target)},true);
  $('salaryUploadInput')?.addEventListener('change',()=>queryCache.clear(),true)
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUi);else installUi();
window.addEventListener('dad-user-ready',installUi);
