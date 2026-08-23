(function(){
'use strict';
const YEAR=2027;
const PROJECTS=['Sorafenib','PALBOCICLIB','Semaglutide Pen (Injectable) + Bempedoic acid','Isavuconazole','Apixaban','Brivaracetam tablet + Oral solution','Ceftazidime + Avibactam','Lisdexamfetamine','Finasteride','Ustukinumab','Rosuvastatin/ezetimibe','Denosumab'];
const DEFAULT_ROWS=PROJECTS.map(projectName=>({department:'Corporate strategic (Licensing)',projectName,unitValue:null}));
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:0};
const fmt=v=>Math.abs(num(v))<.005?'—':num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const profile=()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')}catch(_){return null}};
function isAllowed(p){const labels=[p?.departmentLabel,...(Array.isArray(p?.departmentLabels)?p.departmentLabels:[])].map(clean).join(' ').toUpperCase();return p?.isMainAdmin===true||p?.role==='admin'||labels.includes('BUSINESS DEVELOPMENT')}
let rows=DEFAULT_ROWS.map(x=>({...x})),api=null,fs=null,loaded=false;
function total(){return rows.reduce((sum,row)=>sum+num(row.unitValue),0)}
function status(message,error=false){const el=$('licensingStatus');el.textContent=message;el.classList.toggle('error',error);el.classList.toggle('ready',!error)}
function escapeAttr(value){return clean(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function updateTotals(){const value=total();$('kpiProjects').textContent=rows.length;$('kpiTotal').textContent=fmt(value);$('tableTotal').textContent=fmt(value)}
function render(){
 const body=$('licensingBody');
 body.innerHTML=rows.map((row,index)=>`<tr><td><input data-index="${index}" data-field="department" value="${escapeAttr(row.department)}"></td><td><input data-index="${index}" data-field="projectName" value="${escapeAttr(row.projectName)}"></td><td><input class="amount-input" data-index="${index}" data-field="unitValue" type="number" min="0" step="1" value="${row.unitValue===null?'':num(row.unitValue)}" placeholder="Enter value"></td><td><button class="remove-btn" data-remove="${index}" type="button">Remove</button></td></tr>`).join('')+`<tr class="total-row"><td>Total</td><td>${rows.length} Projects</td><td id="tableTotal">${fmt(total())}</td><td>JOD</td></tr>`;
 document.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{const row=rows[Number(input.dataset.index)];row[input.dataset.field]=input.dataset.field==='unitValue'?(input.value===''?null:num(input.value)):input.value;updateTotals()});
 document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{rows.splice(Number(button.dataset.remove),1);render()});
 updateTotals();
}
async function save(){
 const button=$('saveLicensing');button.disabled=true;status('Saving Licensing Budget...');
 try{const user=api.auth.currentUser,p=profile()||{},payloadRows=rows.map(row=>({department:clean(row.department),projectName:clean(row.projectName),unitValue:row.unitValue===null?0:num(row.unitValue)}));await fs.setDoc(fs.doc(api.db,'licensing_budget','fy2027'),{fiscalYear:YEAR,currency:'JOD',rows:payloadRows,total:total(),updatedBy:user.uid,updatedByEmail:clean(user.email||p.email).toLowerCase(),updatedAt:fs.serverTimestamp(),clientUpdatedAt:new Date().toISOString()},{merge:false});status(`Licensing Budget saved · ${rows.length} projects · ${fmt(total())} JOD`)}catch(error){console.error(error);status('Save failed: '+(error.code||error.message),true);alert('Licensing save failed: '+(error.message||error))}finally{button.disabled=false}
}
function add(){rows.push({department:'Corporate strategic (Licensing)',projectName:'',unitValue:null});render()}
async function download(){
 if(typeof ExcelJS==='undefined'){alert('Excel engine is still loading.');return}
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Licensing Budget');sheet.addRow(['Department','Project Name','Unit Value (JOD)']);rows.forEach(row=>sheet.addRow([row.department,row.projectName,row.unitValue===null?null:num(row.unitValue)]));sheet.addRow(['Total','',total()]);sheet.columns=[{width:36},{width:58},{width:22}];for(let column=1;column<=3;column++){const cell=sheet.getRow(1).getCell(column);cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}}}sheet.getColumn(3).numFmt='#,##0;[Red]-#,##0';sheet.views=[{state:'frozen',ySplit:1}];const last=sheet.getRow(sheet.rowCount);for(let column=1;column<=3;column++){const cell=last.getCell(column);cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082765'}}}const buffer=await workbook.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Licensing_Budget_2027_JOD.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
async function upload(file){
 if(typeof XLSX==='undefined'){alert('Excel engine is still loading.');return}
 try{const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=workbook.Sheets[workbook.SheetNames[0]],data=XLSX.utils.sheet_to_json(sheet,{defval:''}),parsed=data.map(x=>({department:clean(x.Department||x.department),projectName:clean(x['Project Name']||x.projectName),unitValue:clean(x['Unit Value (JOD)']||x['Unit Value']||x.unitValue)===''?null:num(x['Unit Value (JOD)']||x['Unit Value']||x.unitValue)})).filter(x=>x.projectName&&x.projectName.toUpperCase()!=='TOTAL');if(!parsed.length)throw new Error('No valid Licensing project rows were found.');rows=parsed;render();status(`${file.name} loaded · review and save`)}catch(error){status('Upload rejected: '+error.message,true);alert('Licensing upload rejected: '+error.message)}finally{$('licensingFile').value=''}
}
async function load(){
 if(loaded)return;api=window.DADFirebase;if(!api?.db||!api.auth?.currentUser){setTimeout(load,500);return}loaded=true;
 try{if(!isAllowed(profile()||{})){location.replace('index.html');return}fs=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');const snapshot=await fs.getDoc(fs.doc(api.db,'licensing_budget','fy2027'));if(snapshot.exists()&&Array.isArray(snapshot.data()?.rows))rows=snapshot.data().rows.map(row=>({...row,unitValue:num(row.unitValue)||null}));render();status(snapshot.exists()?'Latest Licensing Budget loaded.':'Blank Licensing template loaded. Enter Unit Value in JOD.')}catch(error){loaded=false;status('Unable to load Licensing Budget: '+(error.code||error.message),true)}
}
$('saveLicensing').onclick=save;$('addProject').onclick=add;$('downloadLicensing').onclick=download;$('uploadLicensing').onclick=()=>$('licensingFile').click();$('licensingFile').onchange=()=>{const file=$('licensingFile').files?.[0];if(file)upload(file)};window.addEventListener('dad-user-ready',load,{once:true});setTimeout(()=>{if(window.DADFirebase?.auth?.currentUser)load()},700);
})();