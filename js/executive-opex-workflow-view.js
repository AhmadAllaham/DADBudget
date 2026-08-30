import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,getDocs,getDocsFromCache} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const CACHE='dadBudgetExecutiveOpexWorkflowCacheV1',CACHE_MS=10*60*1000;
const clean=v=>String(v??'').trim(),num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS_LABELS={
 approved:'Approved',uploaded:'Uploaded · Not Approved',pending_it:'Pending IT Approval',pending_manager:'Pending Manager Approval',
 manager_approved:'Manager Approved · Pending Finance',submitted:'Pending Finance Approval',under_review:'Finance Review · Not Approved',
 returned:'Returned',manager_returned:'Manager Returned',not_submitted:'Not Submitted',mixed:'Mixed Workflow Status'
};
let enhancedRows=[],hideZero=true,productionIds=new Set(),busy=false;

function from64(s){const b=atob(s||''),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function decode(raw,id){if(!raw)return null;if(raw.encoding==='gzip-base64-v1'){const stream=new Blob([from64(raw.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));return{...JSON.parse(await new Response(stream).text()),cc:id}}if(raw.encoding==='json-v1')return{...JSON.parse(raw.payload||'{}'),cc:id};return{...raw,cc:clean(raw.cc||id)}}
function sumMonths(map){let total=0;for(let m=1;m<=12;m++)total+=num(map?.[`2027-${String(m).padStart(2,'0')}`]);return total}
function isTravel(code){const n=Number(clean(code));return Number.isFinite(n)&&n>=6020001&&n<=6020010}
function isProject(item,code){const text=[item?.name,item?.accountName,item?.glName,item?.description,item?.category,item?.label,item?.title,code].map(clean).join(' ').toUpperCase();return /(^|[^A-Z])PROJECTS?([^A-Z]|$)/.test(text)}
function workflow(raw){return clean(raw?.workflowStatus||raw?.status||raw?.financeStatus||(raw?'uploaded':'not_submitted')).toLowerCase()||'not_submitted'}
function cacheRead(user){try{const x=JSON.parse(sessionStorage.getItem(CACHE)||'null');return x&&x.uid===user?.uid&&Date.now()-num(x.ts)<CACHE_MS&&Array.isArray(x.rows)?x.rows:null}catch(_){return null}}
function cacheWrite(user,rows){try{sessionStorage.setItem(CACHE,JSON.stringify({uid:user?.uid||'',ts:Date.now(),rows}))}catch(_){}}
function clearCache(){try{sessionStorage.removeItem(CACHE)}catch(_){}}

async function ensureProductionIds(){
 if(productionIds.size)return;
 const ready=window.DADDepartmentGroups?.groups?.PRODUCTION?.ids;
 if(ready){productionIds=new Set(ready.map(String));return}
 await new Promise(resolve=>setTimeout(resolve,300));
 productionIds=new Set((window.DADDepartmentGroups?.groups?.PRODUCTION?.ids||[]).map(String));
}

function budgetFromSubmission(raw,decoded){
 let project27=0,travel27=0,total27=0;
 const travelSeen=new Set();
 Object.entries(decoded?.items||{}).forEach(([key,item])=>{
  const code=clean(item?.code||key),value=sumMonths(item?.newBudgetByMonth);
  total27+=value;
  if(isTravel(code)){travel27+=value;travelSeen.add(code)}
  if(isProject(item,code))project27+=value;
 });
 const travelMap=raw?.travelBudgetByGl||decoded?.travelBudgetByGl||{};
 Object.entries(travelMap).forEach(([code,map])=>{
  if(!isTravel(code)||travelSeen.has(clean(code)))return;
  const value=sumMonths(map);travel27+=value;total27+=value;
 });
 return{project27,travel27,other27:total27-project27-travel27,total27,fy27:total27};
}

async function readSubmissionBudgets(user){
 const cached=cacheRead(user);if(cached)return cached;
 let snap=null;
 try{snap=await getDocsFromCache(collection(db,'opex_budget_submissions'))}catch(_){snap=null}
 if(!snap||snap.empty){snap=await getDocs(collection(db,'opex_budget_submissions'))}
 const rows=[];
 for(const s of snap.docs){
  const raw=s.data()||{},status=workflow(raw);let decoded=null;
  try{decoded=await decode(raw,s.id)}catch(e){console.warn('Executive OPEX submission decode skipped',s.id,e);continue}
  const totals=budgetFromSubmission(raw,decoded||{});
  rows.push({cc:clean(s.id),name:clean(decoded?.name||decoded?.departmentName||raw?.name||raw?.departmentName||s.id),status,...totals})
 }
 cacheWrite(user,rows);return rows
}

function mergeShared(sharedRows,submissionRows){
 const map=new Map((sharedRows||[]).map(x=>[clean(x.cc),{...x}]));
 submissionRows.forEach(s=>{
  const base=map.get(s.cc)||{cc:s.cc,name:s.name,sector:'Other',budgetYtd:0,actualYtd:0,variance:0,fy26:0,remaining:0,landing:0,fyLanding:0,capex:0};
  map.set(s.cc,{...base,name:clean(base.name||s.name||s.cc),status:s.status,project27:s.project27,travel27:s.travel27,other27:s.other27,total27:s.total27,fy27:s.fy27})
 });
 return [...map.values()]
}

function badge(status){const label=STATUS_LABELS[status]||status||'Not Submitted',cls=status==='approved'?'good':status?.includes('returned')?'bad':'warn';return`<span class="badge ${cls}">${esc(label)}</span>`}
function consolidateProduction(source){
 const production=source.filter(x=>productionIds.has(String(x.cc))),others=source.filter(x=>!productionIds.has(String(x.cc)));
 if(!production.length)return others;
 const totals=production.reduce((o,x)=>{o.project27+=num(x.project27);o.travel27+=num(x.travel27);o.other27+=num(x.other27);o.total27+=num(x.total27);return o},{project27:0,travel27:0,other27:0,total27:0});
 const statuses=[...new Set(production.filter(x=>Math.abs(num(x.total27))>.005).map(x=>x.status))];
 others.push({cc:`${production.length} Fund Centers`,name:'Production',status:statuses.length===1?statuses[0]:'mixed',...totals,isProduction:true});
 return others
}

function replaceControls(){
 const ids=['cfoBreakdownSearch','cfoBreakdownFilter','cfoHideZero'];
 ids.forEach(id=>{const old=document.getElementById(id);if(!old||old.dataset.workflowView==='1')return;const next=old.cloneNode(true);next.dataset.workflowView='1';old.replaceWith(next)});
 document.getElementById('cfoBreakdownSearch')?.addEventListener('input',renderBreakdown);
 document.getElementById('cfoBreakdownFilter')?.addEventListener('change',renderBreakdown);
 document.getElementById('cfoHideZero')?.addEventListener('click',()=>{hideZero=!hideZero;const b=document.getElementById('cfoHideZero');if(b){b.textContent=`Hide Zero: ${hideZero?'ON':'OFF'}`;b.classList.toggle('off',!hideZero)}renderBreakdown()});
}

function renderBreakdown(){
 if(busy)return;const body=document.getElementById('cfoBreakdownBody');if(!body)return;
 const q=clean(document.getElementById('cfoBreakdownSearch')?.value).toLowerCase(),filter=document.getElementById('cfoBreakdownFilter')?.value||'all';
 let data=consolidateProduction(enhancedRows.filter(x=>Math.abs(num(x.total27))>.005));
 data=data.filter(x=>(!hideZero||Math.abs(num(x.total27))>.005)&&(!q||`${x.cc} ${x.name}`.toLowerCase().includes(q))&&(filter==='all'||(filter==='project'&&Math.abs(num(x.project27))>.005)||(filter==='travel'&&Math.abs(num(x.travel27))>.005))).sort((a,b)=>(b.isProduction?1:0)-(a.isProduction?1:0)||num(b.total27)-num(a.total27)||clean(a.name).localeCompare(clean(b.name)));
 if(!data.length){body.innerHTML='<tr><td colspan="6" class="empty-state">No departments with FY 2027 OPEX budget match the selected filter.</td></tr>';return}
 const totals=data.reduce((o,x)=>{o.project27+=num(x.project27);o.travel27+=num(x.travel27);o.other27+=num(x.other27);o.total27+=num(x.total27);return o},{project27:0,travel27:0,other27:0,total27:0});
 body.innerHTML=data.map(x=>`<tr class="${x.isProduction?'production-summary':''}"><td><b>${esc(x.name)}</b><br><small>${esc(x.cc)}</small></td><td class="num">${money(x.project27)}</td><td class="num">${money(x.travel27)}</td><td class="num">${money(x.other27)}</td><td class="num"><b>${money(x.total27)}</b></td><td>${badge(x.status)}</td></tr>`).join('')+`<tr><td><b>TOTAL</b><br><small>${data.length} Displayed Lines</small></td><td class="num"><b>${money(totals.project27)}</b></td><td class="num"><b>${money(totals.travel27)}</b></td><td class="num"><b>${money(totals.other27)}</b></td><td class="num"><b>${money(totals.total27)}</b></td><td></td></tr>`;
}

function updateOverviewText(){
 const card=document.getElementById('cfoDepartmentBreakdown');if(card){const sub=card.querySelector('.sub');if(sub)sub.textContent='All departments with FY 2027 OPEX values are shown, including budgets still in workflow. Status shows whether each department is Approved or still pending.'}
 const kpi=document.getElementById('kpiOpex27'),note=document.getElementById('kpiOpexNote');
 if(kpi)kpi.textContent=money(enhancedRows.reduce((s,x)=>s+num(x.total27),0));
 if(note)note.textContent='All budgeted departments · workflow status shown below';
}

async function enhance(shared){
 if(busy||!shared?.departments)return;busy=true;
 try{
  await ensureProductionIds();const user=auth.currentUser;if(!user)return;
  const submissionRows=await readSubmissionBudgets(user);enhancedRows=mergeShared(shared.departments,submissionRows);
  window.DADExecutiveShared={...shared,departments:enhancedRows,opexWorkflowEnhanced:true};
  replaceControls();updateOverviewText();renderBreakdown();
 }catch(e){console.error('Executive OPEX workflow view failed',e)}finally{busy=false}
}

window.addEventListener('dad-admin-direct-budget-approved',clearCache);
window.addEventListener('dad-opex-submission-saved',clearCache);
window.addEventListener('dad-executive-data-ready',e=>setTimeout(()=>enhance(e.detail||window.DADExecutiveShared),0));
if(window.DADExecutiveShared)setTimeout(()=>enhance(window.DADExecutiveShared),0);
