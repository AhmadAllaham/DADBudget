import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,collection,writeBatch,serverTimestamp,query,orderBy,startAt,endAt,documentId} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',YEAR=2027,PREFIX='hr_salary_allocation_',CHUNK=300,DIR_DOC='department_directory_fy2027';
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
function addDepartment(map,rawCc,rawName){const cc=clean(rawCc),name=clean(rawName||cc);if(!cc||cc==='16'||cc==='ALL'||cc.startsWith('GROUP:'))return;const old=map.get(cc),better=name&&name!==cc&&!/^\d+$/.test(name);if(!old||old.name===old.cc||(/^\d+$/.test(old.name)&&better))map.set(cc,{cc,name:name||cc})}

async function initFirebase(){
  if(window.DADFirebase?.auth?.currentUser){app=window.DADFirebase.app;auth=window.DADFirebase.auth;db=window.DADFirebase.db;return true}
  if(!getApps().length)return false;app=getApps()[0];auth=getAuth(app);db=getFirestore(app);return !!auth.currentUser
}
async function loadProfile(){const snap=await getDoc(doc(db,'users',auth.currentUser.uid));if(!snap.exists())throw new Error('User profile not found.');profile=snap.data()||{};const modules=Array.isArray(profile.modules)?profile.modules:[];canEdit=isAdmin()||modules.includes('hr');if(!canEdit)throw new Error('HR Salaries Budget is available only to HR Planning and Main Admin.')}
async function loadDirectoryAndAccounts(){
  // HR must budget salaries for the whole company, regardless of the HR user's own Fund Center access.
  // Load the canonical company directory locally first so this does not create a large Firestore read.
  if(!Array.isArray(window.DADCanonicalDepartmentDirectory)||!window.DADCanonicalDepartmentDirectory.length){
    try{await import('./training-canonical-department-names.js?v=20260824-hr-company-directory-1')}catch(e){console.warn('Canonical company directory could not be loaded',e)}
  }
  const [metaSnap,sharedDirSnap]=await Promise.all([
    getDoc(doc(db,'opex_baseline_meta','current')),
    getDoc(doc(db,'system_status',DIR_DOC)).catch(()=>null)
  ]);
  if(!metaSnap.exists())throw new Error('Finance OPEX baseline is not published yet.');
  const meta=metaSnap.data()||{},map=new Map();
  (Array.isArray(window.DADCanonicalDepartmentDirectory)?window.DADCanonicalDepartmentDirectory:[]).forEach(x=>addDepartment(map,x?.cc,x?.name));
  (Array.isArray(meta.departmentDirectory)?meta.departmentDirectory:[]).forEach(x=>addDepartment(map,x?.cc,x?.name));
  if(sharedDirSnap?.exists?.())(Array.isArray(sharedDirSnap.data()?.directory)?sharedDirSnap.data().directory:[]).forEach(x=>addDepartment(map,x?.cc,x?.name));
  // Only fall back to the baseline collection if no full company directory is available.
  if(map.size<20){
    try{const baseSnap=await getDocs(collection(db,'opex_baseline_departments'));baseSnap.docs.forEach(s=>addDepartment(map,s.id,s.data()?.name||s.data()?.departmentName||s.id))}catch(e){console.warn('HR salary baseline directory fallback unavailable',e)}
  }
  departments=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
  const master=Array.isArray(meta.accountMaster)?meta.accountMaster:Object.values(meta.accountMaster||{}),found=new Map();
  master.forEach(x=>{const code=clean(x?.code),name=clean(x?.name||code);if(isSalary(code))found.set(code,{code,name:name||code})});
  accounts=(found.size?[...found.values()]:FALLBACK.slice()).sort((a,b)=>a.code.localeCompare(b.code));
  values=new Map(departments.map(d=>[d.cc,new Map()]));
  const salarySnap=await getDocs(query(collection(db,'system_status'),orderBy(documentId()),startAt(PREFIX),endAt(`${PREFIX}\uf8ff`)));
  salarySnap.docs.forEach(s=>{const cc=clean(s.id).slice(PREFIX.length);if(!values.has(cc))return;Object.entries(s.data()?.items||{}).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(isSalary(code))setValue(cc,code,item?.annual)})});
  if(!departments.length)throw new Error('No company departments were found for HR Salaries.');
  if(!accounts.length)throw new Error('No employee-cost G/L accounts were found in OPEX.');
}

function render(){
  const head=$('salaryHead'),body=$('salaryBody');if(!head||!body)return;
  head.innerHTML=`<tr><th>Account No.</th><th>Salary / Employee Cost Item</th>${departments.map((d,i)=>`<th class="dept-col dept-${i}"><span class="dept-head"><b>${escapeHtml(d.cc)}</b><small>${escapeHtml(d.name)}</small></span></th>`).join('')}<th>Company Total</th></tr>`;
  body.innerHTML=accounts.map(a=>`<tr class="salary-row" data-row-text="${escapeHtml(`${a.code} ${a.name}`.toLowerCase())}"><td>${escapeHtml(a.code)}</td><td>${escapeHtml(a.name)}</td>${departments.map((d,i)=>`<td class="dept-col dept-${i}"><span class="salary-readonly-value">${fmt(valueOf(d.cc,a.code))}</span></td>`).join('')}<td class="company-total">${fmt(accountTotal(a.code))}</td></tr>`).join('')+`<tr class="total-row"><td>TOTAL</td><td>FY Budget 2027</td>${departments.map((d,i)=>`<td class="dept-col dept-${i}">${fmt(departmentTotal(d.cc))}</td>`).join('')}<td id="matrixCompanyTotal">${fmt(companyTotal())}</td></tr>`;
  updateKpis();applyFilters();
}
function updateKpis(){$('salaryKpiTotal').textContent=fmt(companyTotal());$('salaryKpiDepartments').textContent=departments.length.toLocaleString();$('salaryKpiAccounts').textContent=accounts.length.toLocaleString();$('salaryKpiActive').textContent=departments.filter(d=>departmentTotal(d.cc)>0).length.toLocaleString()}
function applyFilters(){const aq=clean($('salaryAccountSearch')?.value).toLowerCase(),dq=clean($('salaryDepartmentSearch')?.value).toLowerCase();document.querySelectorAll('.salary-row').forEach(r=>r.classList.toggle('hidden-row',!!aq&&!clean(r.dataset.rowText).includes(aq)));departments.forEach((d,i)=>{const hide=!!dq&&!`${d.cc} ${d.name}`.toLowerCase().includes(dq);document.querySelectorAll(`.dept-${i}`).forEach(cell=>cell.classList.toggle('hidden-col',hide))})}

function makeDoc(d,sourceFile){const items={};accounts.forEach(a=>{const annual=valueOf(d.cc,a.code);items[a.code]={code:a.code,name:a.name,annual,byMonth:annualMonths(annual)}});return{cc:d.cc,departmentName:d.name,fiscalYear:YEAR,currency:'JOD',items,total:departmentTotal(d.cc),sourceFile:clean(sourceFile||'HR Salaries Matrix'),updatedBy:auth.currentUser.uid,updatedByEmail:clean(auth.currentUser.email).toLowerCase(),updatedAt:serverTimestamp(),clientUpdatedAt:new Date().toISOString()}}
async function saveAll(sourceFile='HR Salaries Excel Upload'){
  if(!canEdit)throw new Error('Only HR Planning or Main Admin can upload the Salaries Budget.');if(saving)return;saving=true;
  try{for(let start=0;start<departments.length;start+=CHUNK){const batch=writeBatch(db),chunk=departments.slice(start,start+CHUNK);chunk.forEach(d=>batch.set(doc(db,'system_status',`${PREFIX}${d.cc}`),makeDoc(d,sourceFile),{merge:false}));await batch.commit();setStatus(`Saving HR Salaries · ${Math.min(start+chunk.length,departments.length)} / ${departments.length}`)}setStatus(`HR Salaries uploaded successfully · ${departments.length} departments updated in OPEX`,'ready')}
  finally{saving=false}
}

function workbookHeaders(){return['Account No.','Salary / Employee Cost Item',...departments.map(d=>`${d.cc} · ${d.name}`),'Company Total']}
async function downloadWorkbook(saved=false){
  if(typeof ExcelJS==='undefined')throw new Error('Excel template engine is still loading.');
  const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();wb.calcProperties.fullCalcOnLoad=true;wb.calcProperties.forceFullCalc=true;wb.calcProperties.calcMode='auto';
  const info=wb.addWorksheet('Instructions'),ws=wb.addWorksheet('Salaries Budget'),navy='FF0A2C61',white='FFFFFFFF',blue='FFE5F3FF',green='FFEAF9F5',gray='FFF4F7F8';
  info.addRow(['DAD BUDGET 2027 · HR SALARIES']);info.addRow([]);info.addRow(['HOW TO USE']);
  info.addRow(['1','Salaries Budget input is Excel-only. Direct entry on the web page is disabled.']);
  info.addRow(['2','Rows follow employee-cost G/L 6010001–6010031 from OPEX.']);
  info.addRow(['3','6010020 Training is excluded because it is controlled separately by L&D.']);
  info.addRow(['4','Enter FY Budget 2027 annual values in the blue department cells.']);
  info.addRow(['5','Company Total is calculated automatically for every salary item.']);
  info.addRow(['6','The TOTAL row calculates the total salary budget for every department and the company grand total.']);
  info.addRow(['7','Annual values are distributed equally across Jan–Dec 2027 in department OPEX after upload.']);
  info.addRow(['8','Do not change Account No., department headers or the Salaries Budget sheet name.']);
  info.getColumn(1).width=14;info.getColumn(2).width=108;info.getRow(1).font={bold:true,size:16,color:{argb:navy}};

  const header=ws.addRow(workbookHeaders()),deptStart=3,deptEnd=2+departments.length,companyCol=deptEnd+1;
  accounts.forEach((a,index)=>{
    const rowNo=index+2,row=ws.addRow([a.code,a.name,...departments.map(d=>valueOf(d.cc,a.code)),'']);
    for(let c=deptStart;c<=deptEnd;c++){
      const cell=row.getCell(c);cell.numFmt='#,##0.00';cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:saved?green:blue}};
      if(!saved)cell.dataValidation={type:'decimal',operator:'greaterThanOrEqual',allowBlank:true,formulae:[0],showErrorMessage:true,errorTitle:'Invalid value',error:'Enter a value equal to or greater than zero.'};
    }
    const first=ws.getColumn(deptStart).letter,last=ws.getColumn(deptEnd).letter,totalCell=row.getCell(companyCol);
    totalCell.value={formula:`SUM(${first}${rowNo}:${last}${rowNo})`};totalCell.numFmt='#,##0.00';totalCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:green}};totalCell.font={bold:true};
  });

  const totalRowNo=accounts.length+2,total=ws.addRow(['TOTAL','FY Budget 2027',...Array(departments.length).fill(''),'']);
  for(let c=deptStart;c<=deptEnd;c++){
    const letter=ws.getColumn(c).letter;total.getCell(c).value={formula:`SUM(${letter}2:${letter}${totalRowNo-1})`};total.getCell(c).numFmt='#,##0.00';
  }
  const companyLetter=ws.getColumn(companyCol).letter;total.getCell(companyCol).value={formula:`SUM(${companyLetter}2:${companyLetter}${totalRowNo-1})`};total.getCell(companyCol).numFmt='#,##0.00';
  total.font={bold:true,color:{argb:white}};total.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};

  header.height=48;header.eachCell(cell=>{cell.font={bold:true,color:{argb:white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true}});
  ws.views=[{state:'frozen',ySplit:1,xSplit:2}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:companyCol}};
  ws.getColumn(1).width=15;ws.getColumn(2).width=38;for(let c=deptStart;c<=deptEnd;c++)ws.getColumn(c).width=23;ws.getColumn(companyCol).width=20;
  if(saved){for(let r=2;r<totalRowNo;r++){ws.getRow(r).getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:gray}};ws.getRow(r).getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:gray}}}}
  const buf=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=saved?'Budget_2027_HR_Salaries_Saved_Data.xlsx':'Budget_2027_HR_Salaries_Template.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function parseUpload(wb){
  const sheetName=wb.SheetNames.find(n=>clean(n).toLowerCase()==='salaries budget');if(!sheetName)throw new Error('Salaries Budget sheet is missing.');
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:'',raw:true}),hi=rows.findIndex(r=>clean(r?.[0]).toLowerCase()==='account no.'&&clean(r?.[1]).toLowerCase().includes('salary'));if(hi<0)throw new Error('Salaries Budget headers are not valid. Download the latest template.');
  const header=rows[hi],deptCols=[];for(let c=2;c<header.length;c++){const m=clean(header[c]).match(/^(\d{8,12})\b/);if(!m)continue;const cc=m[1];if(!departments.some(d=>d.cc===cc))throw new Error(`Unknown Fund Center in column ${c+1}: ${cc}`);deptCols.push({col:c,cc})}if(!deptCols.length)throw new Error('No department columns were found.');
  const known=new Set(accounts.map(a=>a.code)),seen=new Set();for(let r=hi+1;r<rows.length;r++){const gl=clean(rows[r]?.[0]);if(!gl||gl.toUpperCase()==='TOTAL')continue;if(!known.has(gl))throw new Error(`Row ${r+1}: unknown employee-cost G/L ${gl}`);if(seen.has(gl))throw new Error(`Row ${r+1}: duplicate G/L ${gl}`);seen.add(gl);deptCols.forEach(({col,cc})=>{const raw=rows[r]?.[col];if(clean(raw)!==''&&!Number.isFinite(Number(String(raw).replace(/,/g,''))))throw new Error(`Row ${r+1}, ${cc}: enter a numeric value.`);const v=Number(String(raw||0).replace(/,/g,''));if(v<0)throw new Error(`Row ${r+1}, ${cc}: value cannot be negative.`);setValue(cc,gl,v)})}if(!seen.size)throw new Error('No salary rows were found in the workbook.')
}
async function uploadExcel(file){if(typeof XLSX==='undefined')throw new Error('Excel upload engine is still loading.');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});parseUpload(wb);render();await saveAll(file.name)}
function applyExcelOnlyUi(){
  $('salarySaveBtn')?.remove();
  const pageText=document.querySelector('.page-head p');if(pageText)pageText.textContent='HR completes the company-wide FY 2027 Salaries Budget through the Excel template only. Uploaded values are reflected automatically into each department OPEX.';
  const matrixText=document.querySelector('.matrix-card .tools p');if(matrixText)matrixText.textContent='Read-only view of the latest uploaded Salaries Budget. Download the Excel template, complete it, then upload it here.';
  const note=document.querySelector('.matrix-card .note');if(note)note.innerHTML='<b>Excel-only workflow:</b> Salaries cannot be entered directly on this page. Download the template, complete the department values in Excel, then upload it. <b>6010020 Training</b> remains controlled by L&amp;D.';
  if(!document.getElementById('salaryExcelOnlyStyle')){const style=document.createElement('style');style.id='salaryExcelOnlyStyle';style.textContent='.salary-readonly-value{display:block;min-width:118px;padding:8px 9px;text-align:right;font-weight:1000;color:#123e63;background:#f5f8fa;border-radius:6px}';document.head.appendChild(style)}
}
function bind(){
  if(bound)return;bound=true;applyExcelOnlyUi();
  $('salaryAccountSearch')?.addEventListener('input',applyFilters);$('salaryDepartmentSearch')?.addEventListener('input',applyFilters);
  $('salaryTemplateBtn')?.addEventListener('click',()=>downloadWorkbook(false).catch(e=>alert(e.message||e)));$('salarySavedBtn')?.addEventListener('click',()=>downloadWorkbook(true).catch(e=>alert(e.message||e)));
  $('salaryUploadBtn')?.addEventListener('click',()=>$('salaryUploadInput')?.click());$('salaryUploadInput')?.addEventListener('change',async()=>{const file=$('salaryUploadInput').files?.[0];$('salaryUploadInput').value='';if(!file)return;const b=$('salaryUploadBtn'),old=b.textContent;try{b.disabled=true;b.textContent='Uploading...';setStatus('Validating HR Salaries workbook...');await uploadExcel(file)}catch(e){console.error(e);setStatus(`HR Salaries upload rejected: ${e.message||e}`,'error');alert(`HR Salaries upload rejected: ${e.message||e}`)}finally{b.disabled=false;b.textContent=old}})
}
async function boot(){
  if(booted||booting)return;booting=true;
  try{const ready=await initFirebase();if(!ready){booting=false;setTimeout(boot,300);return}await loadProfile();await loadDirectoryAndAccounts();bind();render();applyExcelOnlyUi();booted=true;setStatus(`HR Salaries ready · ${departments.length} company departments · ${accounts.length} employee-cost G/Ls · Excel input only`,'ready')}
  catch(e){console.error(e);setStatus(e.message||String(e),'error');if(String(e.message||e).includes('only to HR'))setTimeout(()=>location.replace('index.html'),1600)}
  finally{booting=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,100));else setTimeout(boot,100);
window.addEventListener('dad-user-ready',()=>setTimeout(boot,50));