(function(){
'use strict';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TRAVEL=[
 ['6020001','Travel Tickets'],['6020002','Travel Hotels'],['6020003','Travel Transportation'],['6020004','Travel Meals'],['6020005','Travel Visa'],
 ['6020006','Travel Per Diem'],['6020007','Travel Insurance'],['6020008','Local Per Diem'],['6020009','Local Transportation'],['6020010','Other Travel Cost']
];
const LOCKED=new Set(['pending_manager','manager_approved','submitted','under_review','approved']);
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const num=v=>{if(typeof v==='number'&&Number.isFinite(v))return v;const x=Number(clean(v).replace(/,/g,''));return Number.isFinite(x)?x:0};
const headerIndex=(header,names)=>{const h=(header||[]).map(norm);for(const name of names){const i=h.indexOf(norm(name));if(i>=0)return i}return-1};
const profile=()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')}catch(_){return null}};
function stored(){
 const keys=Object.keys(localStorage).filter(k=>/^dadBudgetOPEXBaselineV\d+$/i.test(k)).sort((a,b)=>Number((b.match(/\d+$/)||[0])[0])-Number((a.match(/\d+$/)||[0])[0]));
 for(const key of keys){try{const model=JSON.parse(localStorage.getItem(key)||'null');if(model?.departments)return{key,model}}catch(_){}}
 return null;
}
function selectedDepartment(){
 const cc=clean(document.getElementById('deptFilter')?.value);
 if(!cc||cc==='ALL'||cc.startsWith('__GROUP__'))throw new Error('Select one individual department first.');
 const state=stored(),department=state?.model?.departments?.[cc];
 if(!state||!department)throw new Error('The selected department is not available in the latest OPEX baseline.');
 return{...state,cc,department};
}
function setStatus(message,error=false){
 const el=document.getElementById('travelUploadStatus');if(!el)return;
 el.textContent=message;el.classList.toggle('error',error);el.classList.toggle('ready',!error);
}
function styleTemplate(workbook,sheet){
 sheet.getRow(1).height=30;sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};
 sheet.getRow(1).alignment={vertical:'middle',horizontal:'center',wrapText:true};
 sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:19}};
 sheet.views=[{state:'frozen',ySplit:1,xSplit:2}];
 [16,17,24,18,18,18,30,12,18,...Array(10).fill(20)].forEach((width,i)=>sheet.getColumn(i+1).width=width);
 for(let c=10;c<=19;c++){const cell=sheet.getRow(1).getCell(c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF9DD7F5'}};cell.font={bold:true,color:{argb:'FF0A2C61'}}}
 const info=workbook.addWorksheet('Instructions');
 [
  ['DAD BUDGET 2027 - TRAVEL TEMPLATE'],
  ['HOW TO USE'],
  ['1','Select the employee, title, origin, destination, month and number of nights.'],
  ['2','Travel costs are calculated automatically in JD using the approved fixed-price policy.'],
  ['3','Do not rename the Travel Budget sheet or its columns.'],
  ['4','Upload this same workbook from the Travel page.'],
  ['5','Uploaded Travel values automatically update Travel G/L 6020001–6020010 in OPEX.']
 ].forEach(row=>info.addRow(row));
 info.getColumn(1).width=18;info.getColumn(2).width=100;info.getRow(1).font={bold:true,size:16,color:{argb:'FF0A2C61'}};
}
async function download(){
 try{
  const {cc,department}=selectedDepartment(),pricing=window.DADTravelPricing;
  if(typeof ExcelJS==='undefined'||!pricing)throw new Error('The Travel template engine is still loading. Please try again.');
  const button=document.getElementById('travelTemplateBtn'),old=button?.textContent;if(button){button.disabled=true;button.textContent='Preparing...'}
  try{
   const workbook=new ExcelJS.Workbook();workbook.creator='DAD Budget 2027';workbook.created=new Date();
   const sheet=workbook.addWorksheet('Travel Budget');
   sheet.addRow(['Employee Number','Fund Center','Employee Name','Title','From City','Destination','Reason','Month','number of nights','Travel Tickets JD','Travel Hotels JD','Travel Transportation JD','Travel Meals JD','Travel Visa JD','Travel Per Diem JD','Travel Insurance JD','Local Per Diem JD','Local Transportation JD','Other Travel Cost JD']);
   await pricing.configureExcelJs(workbook,sheet,{cc,rows:Array.isArray(department.travelRows)?department.travelRows:[],rowCount:40,months:MONTHS});
   styleTemplate(workbook,sheet);
   const buffer=await workbook.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=`Travel_Budget_2027_${clean(department.name||cc).replace(/[^A-Za-z0-9]+/g,'_')}_${cc}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }finally{if(button){button.disabled=false;button.textContent=old}}
 }catch(error){alert('Travel template download failed: '+(error?.message||error))}
}
function parseTravel(workbook,expectedCc){
 const pricing=window.DADTravelPricing;if(!pricing)throw new Error('Travel pricing policy is not loaded.');
 const name=workbook.SheetNames.find(n=>norm(n)==='TRAVELBUDGET')||workbook.SheetNames.find(n=>norm(n).includes('TRAVEL'));
 if(!name)throw new Error('Travel Budget sheet is missing.');
 const rows=XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:true}),hi=rows.findIndex(r=>headerIndex(r,['Employee Number'])>=0&&headerIndex(r,['Fund Center'])>=0&&headerIndex(r,['Employee Name'])>=0&&headerIndex(r,['Month'])>=0);
 if(hi<0)throw new Error('Travel Budget headers are not valid. Download and use the latest Travel template.');
 const h=rows[hi],ix={
  employeeNumber:headerIndex(h,['Employee Number']),cc:headerIndex(h,['Fund Center']),employeeName:headerIndex(h,['Employee Name']),title:headerIndex(h,['Title']),
  fromCity:headerIndex(h,['From City']),destination:headerIndex(h,['Destination']),reason:headerIndex(h,['Reason']),month:headerIndex(h,['Month']),nights:headerIndex(h,['number of nights'])
 };
 const out=[],errors=[];
 for(let i=hi+1;i<rows.length;i++){
  const row=rows[i]||[],active=['employeeNumber','employeeName','title','fromCity','destination','reason','month','nights'].some(k=>clean(row[ix[k]]));
  if(!active)continue;
  const missing=[];Object.entries({employeeNumber:'Employee Number',cc:'Fund Center',employeeName:'Employee Name',title:'Title',fromCity:'From City',destination:'Destination',reason:'Reason',month:'Month',nights:'number of nights'}).forEach(([k,label])=>{if(ix[k]<0||!clean(row[ix[k]])||norm(row[ix[k]])==='PLEASESELECT')missing.push(label)});
  const cc=clean(row[ix.cc]);if(cc!==expectedCc)missing.push(`Fund Center must be ${expectedCc}`);
  const monthText=clean(row[ix.month]).slice(0,3),monthIndex=MONTHS.map(norm).indexOf(norm(monthText));if(monthIndex<0)missing.push('valid Month');
  const quote=pricing.quote({title:row[ix.title],fromCity:row[ix.fromCity],destination:row[ix.destination],numberOfNights:row[ix.nights]});
  if(quote.total<.005)missing.push('configured fixed Travel price for this route / destination');
  if(missing.length){errors.push(`row ${i+1}: ${[...new Set(missing)].join(', ')}`);continue}
  out.push({employeeNumber:clean(row[ix.employeeNumber]),cc:expectedCc,employeeName:clean(row[ix.employeeName]),title:clean(row[ix.title]),fromCity:quote.from,destination:quote.to,reason:clean(row[ix.reason]),month:MONTHS[monthIndex],numberOfNights:num(row[ix.nights]),amounts:{...quote.amounts}});
 }
 if(errors.length)throw new Error('Travel Budget is incomplete: '+errors.slice(0,5).join(' | ')+(errors.length>5?' ...':''));
 if(!out.length)throw new Error('Travel Budget is empty. Fill at least one complete Travel row.');
 return out;
}
function applyTravel(department,rows){
 const next=JSON.parse(JSON.stringify(department||{}));next.items=next.items||{};next.travelRows=rows;
 TRAVEL.forEach(([gl,name])=>{const existing=next.items[gl]||{code:gl,name,budgetByMonth:{},actualByMonth:{},lyByMonth:{},fyBudget:0,landing:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};next.items[gl]={...existing,code:gl,name:clean(existing.name)||name,newBudgetByMonth:{}}});
 rows.forEach(row=>Object.entries(row.amounts||{}).forEach(([gl,value])=>{if(!next.items[gl]||Math.abs(num(value))<.005)return;const month=String(MONTHS.indexOf(row.month)+1).padStart(2,'0'),key=`2027-${month}`;next.items[gl].newBudgetByMonth[key]=(next.items[gl].newBudgetByMonth[key]||0)+num(value)}));
 next.travelBudgetByGl=Object.fromEntries(TRAVEL.map(([gl])=>[gl,{...(next.items[gl]?.newBudgetByMonth||{})}]));
 return next;
}
function bytesToBase64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text)}
function base64ToBytes(text){const binary=atob(text||''),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
async function encode(data){
 const raw=JSON.stringify(data);
 if(typeof CompressionStream!=='undefined'){const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip')),bytes=new Uint8Array(await new Response(stream).arrayBuffer()),payload=bytesToBase64(bytes);if(new Blob([payload]).size<900000)return{encoding:'gzip-base64-v1',payload}}
 if(new Blob([raw]).size<900000)return{encoding:'json-v1',payload:raw};
 throw new Error('Department Travel data is too large for Firestore.');
}
async function decode(data,id){
 if(!data)return null;
 if(data.encoding==='gzip-base64-v1'){const stream=new Blob([base64ToBytes(data.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));return{...JSON.parse(await new Response(stream).text()),cc:id}}
 if(data.encoding==='json-v1')return{...JSON.parse(data.payload||'{}'),cc:id};
 return{...data,cc:clean(data.cc||id)};
}
async function upload(file){
 const button=document.getElementById('travelUploadBtn');
 try{
  if(typeof XLSX==='undefined')throw new Error('The Excel upload engine is still loading.');
  const {key,model,cc,department}=selectedDepartment();if(button)button.disabled=true;setStatus('Validating Travel workbook...');
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'}),rows=parseTravel(workbook,cc),api=window.DADFirebase;
  if(!api?.db||!api.auth?.currentUser)throw new Error('Secure cloud connection is not ready. Please try again.');
  const fs=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js'),ref=fs.doc(api.db,'opex_budget_submissions',cc),snapshot=await fs.getDoc(ref),previous=snapshot.exists()?snapshot.data()||{}:{},p=profile()||{},admin=p.isMainAdmin===true||p.role==='admin';
  const workflow=clean(previous.workflowStatus||previous.financeStatus||previous.status).toLowerCase();if(!admin&&LOCKED.has(workflow))throw new Error('This budget is under approval and cannot be uploaded again until it is returned.');
  const previousDepartment=snapshot.exists()?await decode(previous,cc):null,updated=applyTravel(previousDepartment?.items?previousDepartment:department,rows),encoded=await encode({...updated,cc}),revision=(snapshot.exists()?Number(previous.revision||0):0)+1,user=api.auth.currentUser;
  setStatus('Saving Travel and updating OPEX...');
  await fs.setDoc(ref,{cc,name:clean(updated.name||department.name||cc),encoding:encoded.encoding,payload:encoded.payload,travelBudgetByGl:updated.travelBudgetByGl,travelMappedAt:fs.serverTimestamp(),fileName:file.name,revision,workflowStatus:'uploaded',status:'uploaded',financeStatus:'not_submitted',financeReturnPending:false,managerStatus:'not_submitted',submittedBy:user.uid,submittedByEmail:clean(user.email||p.email).toLowerCase(),submittedEmail:clean(user.email||p.email).toLowerCase(),submittedAt:fs.serverTimestamp(),clientSubmittedAt:new Date().toISOString()},{merge:true});
  model.departments[cc]=applyTravel(department,rows);model.fileName=file.name;model.lastUploadedDepartment=cc;localStorage.setItem(key,JSON.stringify(model));
  setStatus(`${file.name} · ${rows.length} trips saved · OPEX updated · R${revision}`);
  window.dispatchEvent(new CustomEvent('dad-opex-submission-saved',{detail:{cc,fileName:file.name,source:'travel'}}));
  setTimeout(()=>location.reload(),900);
 }catch(error){console.error('Travel upload failed',error);setStatus('Upload rejected',true);alert('Travel upload rejected: '+(error?.message||error))}
 finally{if(button)button.disabled=false;const input=document.getElementById('travelUploadInput');if(input)input.value=''}
}
function bind(){
 const downloadButton=document.getElementById('travelTemplateBtn'),uploadButton=document.getElementById('travelUploadBtn'),input=document.getElementById('travelUploadInput');
 if(downloadButton)downloadButton.onclick=download;if(uploadButton&&input)uploadButton.onclick=()=>input.click();if(input)input.onchange=()=>{const file=input.files?.[0];if(file)upload(file)};
}
window.DADTravelWorkbook={download,upload};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
if(/travel-budget\.html$/i.test((location.pathname||'').split('?')[0]))import('./travel-budget-stable.js?v=20260830-travel-filter-3').catch(e=>console.error('Stable Travel data view failed:',e));
