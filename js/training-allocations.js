(function(){
'use strict';
const SOURCE_CC='1000300118',YEAR=2027,MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TRAVEL=[['6020001','Travel Tickets'],['6020002','Travel Hotels'],['6020003','Travel Transportation'],['6020004','Travel Meals'],['6020005','Travel Visa'],['6020006','Travel Per Diem'],['6020007','Travel Insurance'],['6020008','Local Per Diem'],['6020009','Local Transportation'],['6020010','Other Travel Cost']];
const $=id=>document.getElementById(id),clean=v=>String(v??'').trim(),num=v=>{const x=Number(v);return Number.isFinite(x)?x:0},fmt=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const profile=()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')}catch(_){return null}};
const depsOf=p=>Array.isArray(p?.departments)?p.departments.map(clean).filter(Boolean):(p?.department?[clean(p.department)]:[]);
const canEdit=p=>p?.isMainAdmin===true||p?.role==='admin'||(p?.role==='manager'&&depsOf(p).includes(SOURCE_CC));
let directory=[],allocations=new Map(),travelRows=[],editing=true,fs=null,api=null,loading=false,loaded=false;
function annualMonths(total){const cents=Math.round(num(total)*100),base=Math.trunc(cents/12),used=base*11,out={};for(let m=1;m<=12;m++)out[`${YEAR}-${String(m).padStart(2,'0')}`]=(m===12?cents-used:base)/100;return out}
function status(message,error=false){const el=$('allocationStatus');el.textContent=message;el.classList.toggle('error',error);el.classList.toggle('ready',!error)}
function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o}
function setMode(mode){const training=mode==='training';$('trainingTab').classList.toggle('active',training);$('travelTab').classList.toggle('active',!training);$('trainingPanel').classList.toggle('active',training);$('travelPanel').classList.toggle('active',!training)}
function departmentName(cc){return directory.find(x=>x.cc===cc)?.name||cc}
function renderTraining(){
 const q=clean($('trainingSearch').value).toLowerCase(),rows=directory.filter(d=>!q||d.cc.toLowerCase().includes(q)||d.name.toLowerCase().includes(q));
 $('trainingBody').innerHTML=rows.map(d=>{const saved=allocations.get(d.cc)||{},annual=num(saved.trainingAnnual);return`<tr><td><b>${d.name}</b><small>${d.cc}</small></td><td><input class="amount-input" type="number" min="0" step="1" data-training-cc="${d.cc}" value="${annual||''}" placeholder="0" ${editing?'':'disabled'}></td><td class="amount">${fmt(annual/12)}</td><td><span class="account-pill">6010020 · Training</span></td></tr>`}).join('')||'<tr><td colspan="4" class="empty">No departments found.</td></tr>';
 updateKpis();
}
function renderTravel(){
 const q=clean($('travelSearch').value).toLowerCase(),rows=travelRows.filter(r=>!q||[r.cc,departmentName(r.cc),r.gl,r.note].some(v=>clean(v).toLowerCase().includes(q)));
 $('travelBody').innerHTML=rows.map((r,i)=>`<tr><td><b>${departmentName(r.cc)}</b><small>${r.cc}</small></td><td>${r.month} 2027</td><td>${r.gl} · ${TRAVEL.find(x=>x[0]===r.gl)?.[1]||r.gl}</td><td class="amount">${fmt(r.amount)}</td><td>${r.note||'—'}</td><td><button class="row-delete" type="button" data-travel-index="${travelRows.indexOf(r)}" ${editing?'':'disabled'}>Remove</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No Training Travel allocations entered.</td></tr>';
 document.querySelectorAll('[data-travel-index]').forEach(btn=>btn.onclick=()=>{travelRows.splice(Number(btn.dataset.travelIndex),1);renderTravel()});updateKpis();
}
function updateKpis(){
 const trainingTotal=[...document.querySelectorAll('[data-training-cc]')].reduce((s,x)=>s+num(x.value),0)||[...allocations.values()].reduce((s,x)=>s+num(x.trainingAnnual),0),travelTotal=travelRows.reduce((s,x)=>s+num(x.amount),0);
 $('kpiTraining').textContent=fmt(trainingTotal);$('kpiTravel').textContent=fmt(travelTotal);$('kpiTotal').textContent=fmt(trainingTotal+travelTotal);$('kpiDepartments').textContent=new Set([...directory.filter(d=>num(allocations.get(d.cc)?.trainingAnnual)>0).map(d=>d.cc),...travelRows.map(r=>r.cc)]).size;
}
function collectTraining(){document.querySelectorAll('[data-training-cc]').forEach(input=>{const cc=input.dataset.trainingCc,current=allocations.get(cc)||{cc,departmentName:departmentName(cc)};current.trainingAnnual=Math.max(0,num(input.value));current.trainingByMonth=annualMonths(current.trainingAnnual);allocations.set(cc,current)})}
function rebuildTravelMaps(){
 allocations.forEach(value=>{value.travelRows=[];value.travelByGl={}});
 travelRows.forEach(row=>{const current=allocations.get(row.cc)||{cc:row.cc,departmentName:departmentName(row.cc),trainingAnnual:0,trainingByMonth:annualMonths(0),travelRows:[],travelByGl:{}};current.travelRows.push({...row});current.travelByGl=current.travelByGl||{};current.travelByGl[row.gl]=current.travelByGl[row.gl]||{};const key=`${YEAR}-${String(MONTHS.indexOf(row.month)+1).padStart(2,'0')}`;current.travelByGl[row.gl][key]=num(current.travelByGl[row.gl][key])+num(row.amount);allocations.set(row.cc,current)})
}
async function saveAll(){
 if(!editing){alert('Only the L&D Manager or Main Admin can edit these allocations.');return}
 const button=$('saveAllocations');button.disabled=true;collectTraining();rebuildTravelMaps();status('Saving allocations and updating department OPEX...');
 try{
  const user=api.auth.currentUser,p=profile()||{},targets=new Set([...allocations.keys(),...directory.filter(d=>num(allocations.get(d.cc)?.trainingAnnual)>0).map(d=>d.cc)]);
  const docs=[...targets].map(cc=>{const value=allocations.get(cc)||{},ref=fs.doc(api.db,'opex_training_allocations',cc);return{ref,data:{cc,departmentName:departmentName(cc),sourceCc:SOURCE_CC,fiscalYear:YEAR,trainingAccount:'6010020',trainingAnnual:num(value.trainingAnnual),trainingByMonth:value.trainingByMonth||annualMonths(0),travelRows:Array.isArray(value.travelRows)?value.travelRows:[],travelByGl:value.travelByGl||{},updatedBy:user.uid,updatedByEmail:clean(user.email||p.email).toLowerCase(),updatedAt:fs.serverTimestamp(),clientUpdatedAt:new Date().toISOString()}}});
  for(let i=0;i<docs.length;i+=15)await Promise.all(docs.slice(i,i+15).map(x=>fs.setDoc(x.ref,x.data,{merge:false})));
  try{await api.logAuditEvent({module:'training',action:'allocation_update',department:SOURCE_CC,departmentLabel:'Learning & Development',details:{trainingTotal:[...allocations.values()].reduce((s,x)=>s+num(x.trainingAnnual),0),travelTotal:travelRows.reduce((s,x)=>s+num(x.amount),0),targetDepartments:docs.length}})}catch(e){console.warn('Training allocation audit failed',e)}
  status(`Allocations saved · ${docs.length} departments updated in OPEX`);renderTraining();renderTravel();
 }catch(error){console.error(error);status('Save failed: '+(error.code||error.message),true);alert('Training allocation save failed: '+(error.message||error))}
 finally{button.disabled=false}
}
function addTravel(){
 if(!editing)return;const cc=$('travelDepartment').value,month=$('travelMonth').value,gl=$('travelGl').value,amount=num($('travelAmount').value),note=clean($('travelNote').value);
 if(!cc||!month||!gl||amount<=0){alert('Select the department, month and Travel type, then enter an amount greater than zero.');return}
 travelRows.push({cc,month,gl,amount,note});$('travelAmount').value='';$('travelNote').value='';renderTravel();
}
async function load(){
 if(loading||loaded)return;loading=true;
 try{
  api=window.DADFirebase;if(!api?.db||!api.auth?.currentUser){status('Waiting for secure connection...');setTimeout(load,500);return}
  fs=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');const p=profile()||{},meta=await fs.getDoc(fs.doc(api.db,'opex_baseline_meta','current')),raw=Array.isArray(meta.data()?.departmentDirectory)?meta.data().departmentDirectory:[];
  directory=raw.map(x=>({cc:clean(x.cc),name:clean(x.name||x.cc)})).filter(x=>x.cc&&x.cc!=='16').sort((a,b)=>a.name.localeCompare(b.name));
  editing=canEdit(p);document.body.classList.toggle('training-readonly',!editing);
  const snapshot=await fs.getDocs(fs.collection(api.db,'opex_training_allocations'));snapshot.docs.forEach(doc=>allocations.set(clean(doc.id),doc.data()||{}));
  travelRows=[...allocations.values()].flatMap(value=>Array.isArray(value.travelRows)?value.travelRows:[]);
  const depSelect=$('travelDepartment');directory.forEach(d=>depSelect.appendChild(option(d.cc,`${d.cc} · ${d.name}`)));MONTHS.forEach(m=>$('travelMonth').appendChild(option(m,m+' 2027')));TRAVEL.forEach(([gl,name])=>$('travelGl').appendChild(option(gl,`${gl} · ${name}`)));
  if(!editing){$('saveAllocations').disabled=true;$('addTravel').disabled=true;status('Read-only view · L&D Manager controls these allocations.')}else status('Ready · changes update each target department OPEX after saving.');
  renderTraining();renderTravel();loaded=true;
 }catch(error){console.error(error);status('Unable to load allocations: '+(error.code||error.message),true)}finally{loading=false}
}
$('trainingTab').onclick=()=>setMode('training');$('travelTab').onclick=()=>setMode('travel');$('trainingSearch').oninput=renderTraining;$('travelSearch').oninput=renderTravel;$('addTravel').onclick=addTravel;$('saveAllocations').onclick=saveAll;document.addEventListener('input',event=>{if(event.target.matches('[data-training-cc]'))updateKpis()});setMode('training');
window.addEventListener('dad-user-ready',load,{once:true});window.addEventListener('dad-firebase-ready',()=>{if(window.DADFirebase?.auth?.currentUser)load()},{once:true});setTimeout(()=>{if(window.DADFirebase?.auth?.currentUser)load()},700);
})();