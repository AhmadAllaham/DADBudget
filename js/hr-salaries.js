import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,collection,writeBatch,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',YEAR=2027,PREFIX='hr_salary_allocation_',CHUNK=300;
const $=id=>document.getElementById(id),clean=v=>String(v??'').trim(),num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?Math.max(0,x):0},fmt=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const FALLBACK=[
 ['6010001','Basic Salaries'],['6010002','13th, 14th Salaries'],['6010003','Living Allowance'],['6010004','Nursery Allowance'],['6010005','Vacation Provision Expenses'],['6010006','Salaries Incentive'],['6010007','Sales Force Commissions'],['6010008','Social Security Contributions'],['6010009','Transportation Allowance'],['6010010','Indemnity Provision Expenses'],['6010011','Unplanned Indemnity Expenses'],['6010012','School Allowance'],['6010013','House Allowance'],['6010014','Mobile Allowance'],['6010015','Overtime'],['6010016','Health Insurance'],['6010017','Life Insurance'],['6010018','Entertainment'],['6010019','Meals'],['6010021','Daily Workers'],['6010022','Employees Tickets'],['6010023','Employees Samples'],['6010024','Iqama Fees'],['6010025','Travel Exit re-entry'],['6010026','Meals Contract'],['6010027','Other Employees Benefits'],['6010028','Employee Benefit Adjustment-Projects'],['6010029','Medical Rep. / Salesman Uniform'],['6010030','Employee Car Insurance'],['6010031','Employee Transportation Contract']
].map(([code,name])=>({code,name}));
let app=null,auth=null,db=null,profile=null,departments=[],accounts=[],values=new Map(),canEdit=false,saving=false,booting=false,booted=false,bound=false;

function isAdmin(){return auth?.currentUser?.uid===MAIN||profile?.isMainAdmin===true||profile?.role==='admin'}
function isSalary(code){const n=Number(clean(code));return Number.isFinite(n)&&n>=6010001&&n<=6010031&&n!==6010020}
function setStatus(message,type=''){const el=$('salaryStatus');if(!el)return;el.textContent=message;el.className=`status-line ${type}`.trim()}
function annualMonths(total){const cents=Math.round(num(total)*100),base=Math.trunc(cents/12),used=base*11,out={};for(let m=1;m<=12;m++)out[`${YEAR}-${String(m).padStart(2,'0')}`]=(m===12?cents-used:base)/100;return out}
function valueOf(cc,gl){return num(values.get(cc)?.get(gl)||0)}
function setValue(cc,gl,value){if(!values.has(cc))values.set(cc,new Map());values.get(cc).set(gl,num(value))}
function departmentTotal(cc){return accounts.reduce((s,a)=>s+valueOf(cc,a.code),0)}
function accountTotal(gl){return departments.reduce((s,d)=>s+valueOf(d.cc,gl),0)}
function companyTotal(){return departments.reduce((s,d)=>s+departmentTotal(d.cc),0)}
function escapeHtml(v){return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function initFirebase(){
  if(window.DADFirebase?.auth?.currentUser){app=window.DADFirebase.app;auth=window.DADFirebase.auth;db=window.DADFirebase.db;return true}
  if(!getApps().length)return false;app=getApps()[0];auth=getAuth(app);db=getFirestore(app);return !!auth.currentUser
}
async function loadProfile(){const snap=await getDoc(doc(db,'users',auth.currentUser.uid));if(!snap.exists())throw new Error('User profile not found.');profile=snap.data()||{};const modules=Array.isArray(profile.modules)?profile.modules:[];canEdit=isAdmin()||modules.includes('hr');if(!canEdit)throw new Error('HR Salaries Budget is available only to HR Planning and Main Admin.')}
async function loadDirectoryAndAccounts(){
  const [metaSnap,baseSnap,statusSnap]=await Promise.all([getDoc(doc(db,'opex_baseline_meta','current')),getDocs(collection(db,'opex_baseline_departments')),getDocs(collection(db,'system_status'))]);
  if(!metaSnap.exists())throw new Error('Finance OPEX baseline is not published yet.');
  const meta=metaSnap.data()||{},map=new Map();
  (Array.isArray(meta.departmentDirectory)?meta.departmentDirectory:[]).forEach(x=>{const cc=clean(x?.cc),name=clean(x?.name||cc);if(cc&&cc!=='16')map.set(cc,{cc,name:name||cc})});
  baseSnap.docs.forEach(s=>{const cc=clean(s.id),name=clean(s.data()?.name||cc);if(cc&&cc!=='16'&&!map.has(cc))map.set(cc,{cc,name:name||cc})});
  departments=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
  const master=Array.isArray(meta.accountMaster)?meta.accountMaster:Object.values(meta.accountMaster||{}),found=new Map();
  master.forEach(x=>{const code=clean(x?.code),name=clean(x?.name||code);if(isSalary(code))found.set(code,{code,name:name||code})});
  accounts=(found.size?[...found.values()]:FALLBACK.slice()).sort((a,b)=>a.code.localeCompare(b.code));
  values=new Map(departments.map(d=>[d.cc,new Map()]));
  statusSnap.docs.filter(s=>clean(s.id).startsWith(PREFIX)).forEach(s=>{const cc=clean(s.id).slice(PREFIX.length);if(!values.has(cc))return;Object.entries(s.data()?.items||{}).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(isSalary(code))setValue(cc,code,item?.annual)})});
  if(!departments.length)throw new Error('No Finance OPEX departments were found.');
  if(!accounts.length)throw new Error('No employee-cost G/L accounts were found in OPEX.');
}

function render(){
  const head=$('salaryHead'),body=$('salaryBody');if(!head||!body)return;
  head.innerHTML=`<tr><th>Account No.</th><th>Salary / Employee Cost Item</th>${departments.map((d,i)=>`<th class="dept-col dept-${i}"><span class="dept-head"><b>${escapeHtml(d.cc)}</b><small>${escapeHtml(d.name)}</small></span></th>`).join('')}<th>Company Total</th></tr>`;
  body.innerHTML=accounts.map(a=>`<tr class="salary-row" data-row-text="${escapeHtml(`${a.code} ${a.name}`.toLowerCase())}"><td>${escapeHtml(a.code)}</td><td>${escapeHtml(a.name)}</td>${departments.map((d,i)=>`<td class="dept-col dept-${i}"><input type="number" min="0" step="0.01" inputmode="decimal" data-cc="${escapeHtml(d.cc)}" data-gl="${escapeHtml(a.code)}" value="${valueOf(d.cc,a.code)||0}" aria-label="${escapeHtml(`${a.name} ${d.name}`)}"></td>`).join('')}<td class="company-total" data-account-total="${escapeHtml(a.code)}">${fmt(accountTotal(a.code))}</td></tr>`).join('')+`<tr class="total-row"><td>TOTAL</td><td>FY Budget 2027</td>${departments.map((d,i)=>`<td class="dept-col dept-${i}" data-dept-total="${escapeHtml(d.cc)}">${fmt(departmentTotal(d.cc))}</td>`).join('')}<td id="matrixCompanyTotal">${fmt(companyTotal())}</td></tr>`;
  body.querySelectorAll('input[data-cc][data-gl]').forEach(input=>input.addEventListener('input',()=>{setValue(input.dataset.cc,input.dataset.gl,input.value);refreshTotals(input.dataset.cc,input.dataset.gl)}));
  updateKpis();applyFilters();
}
function refreshTotals(cc,gl){
  const body=$('salaryBody');if(!body)return;
  [...body.querySelectorAll('[data-dept-total]')].filter(x=>x.dataset.deptTotal===cc).forEach(x=>x.textContent=fmt(departmentTotal(cc)));
  [...body.querySelectorAll('[data-account-total]')].filter(x=>x.dataset.accountTotal===gl).forEach(x=>x.textContent=fmt(accountTotal(gl)));
  if($('matrixCompanyTotal'))$('matrixCompanyTotal').textContent=fmt(companyTotal());updateKpis()
}
function updateKpis(){$('salaryKpiTotal').textContent=fmt(companyTotal());$('salaryKpiDepartments').textContent=departments.length.toLocaleString();$('salaryKpiAccounts').textContent=accounts.length.toLocaleString();$('salaryKpiActive').textContent=departments.filter(d=>departmentTotal(d.cc)>0).length.toLocaleString()}
function applyFilters(){const aq=clean($('salaryAccountSearch')?.value).toLowerCase(),dq=clean($('salaryDepartmentSearch')?.value).toLowerCase();document.querySelectorAll('.salary-row').forEach(r=>r.classList.toggle('hidden-row',!!aq&&!clean(r.dataset.rowText).includes(aq)));departments.forEach((d,i)=>{const hide=!!dq&&!`${d.cc} ${d.name}`.toLowerCase().includes(dq);document.querySelectorAll(`.dept-${i}`).forEach(cell=>cell.classList.toggle('hidden-col',hide))})}

function makeDoc(d,sourceFile){const items={};accounts.forEach(a=>{const annual=valueOf(d.cc,a.code);items[a.code]={code:a.code,name:a.name,annual,byMonth:annualMonths(annual)}});return{cc:d.cc,departmentName:d.name,fiscalYear:YEAR,currency:'JOD',items,total:departmentTotal(d.cc),sourceFile:clean(sourceFile||'HR Salaries Matrix'),updatedBy:auth.currentUser.uid,updatedByEmail:clean(auth.currentUser.email).toLowerCase(),updatedAt:serverTimestamp(),clientUpdatedAt:new Date().toISOString()}}
async function saveAll(sourceFile='HR Salaries Matrix'){
  if(!canEdit)throw new Error('Only HR Planning or Main Admin can save Salaries Budget.');if(saving)return;saving=true;const saveBtn=$('salarySaveBtn'),old=saveBtn?.textContent;
  try{if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Saving...'}for(let start=0;start<departments.length;start+=CHUNK){const batch=writeBatch(db),chunk=departments.slice(start,start+CHUNK);chunk.forEach(d=>batch.set(doc(db,'system_status',`${PREFIX}${d.cc}`),makeDoc(d,sourceFile),{merge:false}));await batch.commit();setStatus(`Saving HR Salaries · ${Math.min(start+chunk.length,departments.length)} / ${departments.length}`)}setStatus(`HR Salaries Budget saved · ${departments.length} departments updated in OPEX`,'ready')}
  finally{saving=false;if(saveBtn){saveBtn.disabled=false;saveBtn.textContent=old||'Save Salaries Budget'}}
}

function workbookHeaders(){return['Account No.','Salary / Employee Cost Item',...departments.map(d=>`${d.cc} · ${d.name}`),'Company Total']}
async function downloadWorkbook(saved=false){
  if(typeof ExcelJS==='undefined')throw new Error('Excel template engine is still loading.');
  const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();const info=wb.addWorksheet('Instructions'),ws=wb.addWorksheet('Salaries Budget'),navy='FF0A2C61',white='FFFFFFFF',blue='FFE5F3FF',green='FFEAF9F5';
  info.addRow(['DAD BUDGET 2027 · HR SALARIES']);info.addRow([]);info.addRow(['HOW TO USE']);info.addRow(['1','Rows follow employee-cost G/L 6010001–6010031 from OPEX.']);info.addRow(['2','6010020 Training is excluded because it is controlled separately by L&D.']);info.addRow(['3','Each department / Fund Center is a separate column. Enter FY Budget 2027 annual value in JD.']);info.addRow(['4','Annual values are distributed equally across Jan–Dec 2027 in the department OPEX.']);info.addRow(['5','Do not change Account No., department headers or the Salaries Budget sheet name.']);info.getColumn(1).width=14;info.getColumn(2).width=105;info.getRow(1).font={bold:true,size:16,color:{argb:navy}};
  ws.addRow(workbookHeaders());accounts.forEach(a=>{const row=ws.addRow([a.code,a.name,...departments.map(d=>valueOf(d.cc,a.code)),accountTotal(a.code)]);for(let c=3;c<3+departments.length;c++){row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:blue}};row.getCell(c).numFmt='#,##0.00';row.getCell(c).dataValidation={type:'decimal',operator:'greaterThanOrEqual',allowBlank:true,formulae:[0],showErrorMessage:true,errorTitle:'Invalid value',error:'Enter a value equal to or greater than zero.'}}row.getCell(3+departments.length).fill={type:'pattern',pattern:'solid',fgColor:{argb:green}};row.getCell(3+departments.length).numFmt='#,##0.00'});
  const total=ws.addRow(['TOTAL','FY Budget 2027',...departments.map(d=>departmentTotal(d.cc)),companyTotal()]);total.font={bold:true,color:{argb:white}};total.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};ws.getRow(1).height=48;ws.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true}});ws.views=[{state:'frozen',ySplit:1,xSplit:2}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:2+departments.length}};ws.getColumn(1).width=15;ws.getColumn(2).width=38;for(let c=3;c<3+departments.length;c++)ws.getColumn(c).width=23;ws.getColumn(3+departments.length).width=20;
  const buf=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=saved?'Budget_2027_HR_Salaries_Saved_Data.xlsx':'Budget_2027_HR_Salaries_Template.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function parseUpload(wb){
  const sheetName=wb.SheetNames.find(n=>clean(n).toLowerCase()==='salaries budget');if(!sheetName)throw new Error('Salaries Budget sheet is missing.');
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:'',raw:true}),hi=rows.findIndex(r=>clean(r?.[0]).toLowerCase()==='account no.'&&clean(r?.[1]).toLowerCase().includes('salary'));if(hi<0)throw new Error('Salaries Budget headers are not valid. Download the latest template.');
  const header=rows[hi],deptCols=[];for(let c=2;c<header.length;c++){const m=clean(header[c]).match(/^(\d{8,12})\b/);if(!m)continue;const cc=m[1];if(!departments.some(d=>d.cc===cc))throw new Error(`Unknown Fund Center in column ${c+1}: ${cc}`);deptCols.push({col:c,cc})}if(!deptCols.length)throw new Error('No department columns were found.');
  const known=new Set(accounts.map(a=>a.code)),seen=new Set();for(let r=hi+1;r<rows.length;r++){const gl=clean(rows[r]?.[0]);if(!gl||gl.toUpperCase()==='TOTAL')continue;if(!known.has(gl))throw new Error(`Row ${r+1}: unknown employee-cost G/L ${gl}`);if(seen.has(gl))throw new Error(`Row ${r+1}: duplicate G/L ${gl}`);seen.add(gl);deptCols.forEach(({col,cc})=>{const raw=rows[r]?.[col];if(clean(raw)!==''&&!Number.isFinite(Number(String(raw).replace(/,/g,''))))throw new Error(`Row ${r+1}, ${cc}: enter a numeric value.`);const v=Number(String(raw||0).replace(/,/g,''));if(v<0)throw new Error(`Row ${r+1}, ${cc}: value cannot be negative.`);setValue(cc,gl,v)})}if(!seen.size)throw new Error('No salary rows were found in the workbook.')
}
async function uploadExcel(file){if(typeof XLSX==='undefined')throw new Error('Excel upload engine is still loading.');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});parseUpload(wb);render();await saveAll(file.name)}
function bind(){
  if(bound)return;bound=true;
  $('salaryAccountSearch')?.addEventListener('input',applyFilters);$('salaryDepartmentSearch')?.addEventListener('input',applyFilters);
  $('salarySaveBtn')?.addEventListener('click',()=>saveAll().catch(e=>{console.error(e);setStatus(e.message||String(e),'error');alert(e.message||e)}));
  $('salaryTemplateBtn')?.addEventListener('click',()=>downloadWorkbook(false).catch(e=>alert(e.message||e)));$('salarySavedBtn')?.addEventListener('click',()=>downloadWorkbook(true).catch(e=>alert(e.message||e)));
  $('salaryUploadBtn')?.addEventListener('click',()=>$('salaryUploadInput')?.click());$('salaryUploadInput')?.addEventListener('change',async()=>{const file=$('salaryUploadInput').files?.[0];$('salaryUploadInput').value='';if(!file)return;const b=$('salaryUploadBtn'),old=b.textContent;try{b.disabled=true;b.textContent='Uploading...';setStatus('Validating HR Salaries workbook...');await uploadExcel(file)}catch(e){console.error(e);setStatus(`HR Salaries upload rejected: ${e.message||e}`,'error');alert(`HR Salaries upload rejected: ${e.message||e}`)}finally{b.disabled=false;b.textContent=old}})
}
async function boot(){
  if(booted||booting)return;booting=true;
  try{const ready=await initFirebase();if(!ready){booting=false;setTimeout(boot,300);return}await loadProfile();await loadDirectoryAndAccounts();bind();render();booted=true;setStatus(`HR Salaries ready · ${departments.length} departments · ${accounts.length} employee-cost G/Ls · HR controlled`,'ready')}
  catch(e){console.error(e);setStatus(e.message||String(e),'error');if(String(e.message||e).includes('only to HR'))setTimeout(()=>location.replace('index.html'),1600)}
  finally{booting=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,100));else setTimeout(boot,100);
window.addEventListener('dad-user-ready',()=>setTimeout(boot,50));
