import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const OPEX_KEY='dadBudgetOPEXBaselineV17',CACHE_KEY='dadBudgetSubscriptionsYtdCacheV1',CACHE_MS=30*60*1000;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim(),key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,''),num=v=>Number.isFinite(Number(v))?Number(v):0,money=v=>Math.abs(num(v))<.005?'—':num(v).toLocaleString(undefined,{maximumFractionDigits:0});
let requestToken=0,bound=false;

function isSubscription(item={},raw=''){
 const code=clean(item?.code||raw),name=key(item?.name||item?.accountName||'');
 return ['6140006','6141410'].includes(code)||(name.includes('SUBSCRIPTION')&&(name.includes('BOOK')||name.includes('MAGAZINE')))
}
function localModel(){try{const m=JSON.parse(localStorage.getItem(OPEX_KEY)||'null');return m?.departments?m:null}catch(_){return null}}
function cacheRead(cc){try{const all=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'{}')||{},x=all[cc];return x&&Date.now()-num(x.ts)<CACHE_MS?x.data:null}catch(_){return null}}
function cacheWrite(cc,data){try{const all=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'{}')||{};all[cc]={ts:Date.now(),data};sessionStorage.setItem(CACHE_KEY,JSON.stringify(all))}catch(_){}}
function bytesFromBase64(value){const raw=atob(value||''),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function decode(raw,id){if(!raw)return null;if(raw.encoding==='gzip-base64-v1'){if(typeof DecompressionStream==='undefined')throw new Error('Please use an updated Chrome or Edge browser.');const stream=new Blob([bytesFromBase64(raw.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));return{...JSON.parse(await new Response(stream).text()),cc:id}}if(raw.encoding==='json-v1')return{...JSON.parse(raw.payload||'{}'),cc:id};return{...raw,cc:id}}
function latestActualMonth(departments){let latest=0;Object.values(departments||{}).forEach(d=>Object.values(d?.items||{}).forEach(item=>Object.keys(item?.actualByMonth||{}).forEach(k=>{const m=String(k).match(/^2026-(\d{2})$/);if(m)latest=Math.max(latest,Number(m[1])||0)})));return latest}
function sumTo(map,month){let total=0;for(let m=1;m<=month;m++)total+=num(map?.[`2026-${String(m).padStart(2,'0')}`]);return total}
function buildSummary(departments){
 const filtered=Object.fromEntries(Object.entries(departments||{}).filter(([cc])=>clean(cc)&&clean(cc)!=='16')),
 cutoff=latestActualMonth(filtered);
 if(!cutoff)return{available:false,reason:'Actual YTD period could not be detected from the Finance baseline.',rows:[],budget:0,actual:0,cutoff:0};
 const rows=[];let budget=0,actual=0;
 Object.entries(filtered).forEach(([cc,d])=>Object.entries(d?.items||{}).forEach(([raw,item])=>{
  if(!isSubscription(item,raw))return;
  const b=sumTo(item?.budgetByMonth,cutoff),actualMap=item?.actualByMonth||{},hasMonthly=Object.keys(actualMap).some(k=>/^2026-\d{2}$/.test(k)),a=sumTo(actualMap,cutoff)+(hasMonthly?0:num(item?.actualUnperiodized));
  budget+=b;actual+=a;rows.push({cc,name:clean(d?.name||d?.departmentName||cc)||cc,gl:clean(item?.code||raw),accountName:clean(item?.name||item?.accountName||item?.code||raw),budget:b,actual:a,variance:b-a})
 }));
 return{available:true,rows,budget,actual,cutoff}
}
async function oneDepartment(cc){
 const local=localModel()?.departments?.[cc];if(local)return buildSummary({[cc]:local});
 const cached=cacheRead(cc);if(cached)return cached;
 const snap=await getDoc(doc(db,'opex_baseline_departments',cc));
 if(!snap.exists())return{available:false,reason:'Finance baseline is not available for this department.',rows:[],budget:0,actual:0,cutoff:0};
 const department=await decode(snap.data(),cc),summary=buildSummary({[cc]:department});cacheWrite(cc,summary);return summary
}
function allDepartmentsLocal(){const model=localModel();if(!model?.departments)return null;const summary=buildSummary(model.departments);return summary.available?summary:null}
function escapeHtml(v){return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ensureUi(){
 const kpis=document.querySelector('.sub-kpis');if(!kpis)return false;
 if(!document.getElementById('subscriptionBudgetYtd')){
  const budget=document.createElement('article');budget.className='card sub-kpi sub-ytd-kpi';budget.innerHTML='<span>Budget YTD 2026</span><strong id="subscriptionBudgetYtd">—</strong><small id="subscriptionBudgetYtdPeriod">Finance baseline</small>';
  const actual=document.createElement('article');actual.className='card sub-kpi sub-ytd-kpi';actual.innerHTML='<span>Actual YTD</span><strong id="subscriptionActualYtd">—</strong><small id="subscriptionActualYtdPeriod">Finance baseline</small>';
  kpis.prepend(actual);kpis.prepend(budget)
 }
 if(!document.getElementById('subscriptionYtdStyle')){
  const style=document.createElement('style');style.id='subscriptionYtdStyle';style.textContent=`
  .sub-kpis{grid-template-columns:repeat(3,minmax(180px,1fr))!important}.sub-ytd-kpi{background:linear-gradient(145deg,#fff 0%,#f8fbff 55%,#e7f1ff 100%)!important}.sub-ytd-kpi:before{background:linear-gradient(#0a3568,#4f8bc6)!important}
  .sub-ytd-panel{margin:0 0 14px;overflow:hidden;border-radius:15px;border:1px solid #d9e6f3;background:#fff;box-shadow:0 9px 25px rgba(30,61,102,.05)}.sub-ytd-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid #e1eaf2;background:linear-gradient(90deg,#f8fbff,#fff)}.sub-ytd-head h3{margin:0;color:#173e58;font-size:17px}.sub-ytd-head p{margin:4px 0 0;color:#748892;font-size:10.5px;font-weight:750}.sub-ytd-badge{padding:7px 10px;border-radius:999px;background:#edf5ff;color:#265e96;font-size:9.5px;font-weight:1000;white-space:nowrap}.sub-ytd-wrap{overflow:auto;max-height:280px}.sub-ytd-table{width:100%;border-collapse:collapse;font-size:11.5px}.sub-ytd-table th{padding:10px 12px;background:#0a3568;color:#fff;text-align:right;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em}.sub-ytd-table th:first-child,.sub-ytd-table td:first-child{text-align:left}.sub-ytd-table td{padding:10px 12px;border-bottom:1px solid #e7eef4;text-align:right;font-weight:800;color:#344e59;font-variant-numeric:tabular-nums}.sub-ytd-table td b{display:block;color:#173f47}.sub-ytd-table td small{display:block;margin-top:2px;color:#8b9aa0;font-size:9px}.sub-ytd-table .variance.negative{color:#b23b3b}.sub-ytd-table .variance.positive{color:#087a64}.sub-ytd-table tr.total td{background:#f0f6ff;color:#174d82;font-weight:1000}.sub-ytd-empty{padding:18px;color:#71868a;font-size:11px;font-weight:800;text-align:center}.sub-ytd-note{padding:9px 14px;background:#fff9e9;color:#765d20;font-size:10px;font-weight:800;border-top:1px solid #efe2bb}@media(max-width:1050px){.sub-kpis{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:650px){.sub-kpis{grid-template-columns:1fr!important}}
  `;document.head.appendChild(style)
 }
 if(!document.getElementById('subscriptionYtdPanel')){
  const panel=document.createElement('section');panel.id='subscriptionYtdPanel';panel.className='sub-ytd-panel';panel.innerHTML='<div class="sub-ytd-head"><div><h3>Historical Subscription Reference</h3><p>Budget YTD and Actual YTD from the Finance OPEX baseline for subscription accounts only.</p></div><span class="sub-ytd-badge" id="subscriptionYtdBadge">Loading...</span></div><div class="sub-ytd-wrap"><table class="sub-ytd-table"><thead><tr><th>Department / Account</th><th>Budget YTD</th><th>Actual YTD</th><th>Remaining vs Budget</th></tr></thead><tbody id="subscriptionYtdBody"><tr><td colspan="4" class="sub-ytd-empty">Loading historical reference...</td></tr></tbody></table></div><div class="sub-ytd-note" id="subscriptionYtdNote">Low-read mode: individual department baseline is read once and cached for 30 minutes.</div>';
  kpis.insertAdjacentElement('afterend',panel)
 }
 return true
}
function render(summary,scope){
 ensureUi();const budgetEl=document.getElementById('subscriptionBudgetYtd'),actualEl=document.getElementById('subscriptionActualYtd'),bp=document.getElementById('subscriptionBudgetYtdPeriod'),ap=document.getElementById('subscriptionActualYtdPeriod'),badge=document.getElementById('subscriptionYtdBadge'),body=document.getElementById('subscriptionYtdBody'),note=document.getElementById('subscriptionYtdNote');
 if(!summary?.available){budgetEl.textContent='—';actualEl.textContent='—';bp.textContent='Finance baseline';ap.textContent='Finance baseline';badge.textContent='YTD unavailable';body.innerHTML=`<tr><td colspan="4" class="sub-ytd-empty">${escapeHtml(summary?.reason||'Select one department to load the historical YTD reference.')}</td></tr>`;note.textContent=scope==='ALL'?'All Departments does not trigger a bulk Firestore read. Select a department for the YTD reference.':'Low-read mode: no repeated baseline reads.';return}
 const label=`Jan - ${MONTHS[summary.cutoff-1]} 2026`;budgetEl.textContent=money(summary.budget);actualEl.textContent=money(summary.actual);bp.textContent=`JOD · ${label}`;ap.textContent=`JOD · ${label}`;badge.textContent=label;
 const grouped=new Map();summary.rows.forEach(r=>{const k=`${r.cc}|${r.gl}`,x=grouped.get(k)||{...r,budget:0,actual:0,variance:0};x.budget+=r.budget;x.actual+=r.actual;x.variance=x.budget-x.actual;grouped.set(k,x)});const rows=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.gl.localeCompare(b.gl));
 if(!rows.length)body.innerHTML='<tr><td colspan="4" class="sub-ytd-empty">No historical Subscription account was found in the selected Finance baseline.</td></tr>';else body.innerHTML=rows.map(r=>`<tr><td><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.gl)} · ${escapeHtml(r.accountName)}</small></td><td>${money(r.budget)}</td><td>${money(r.actual)}</td><td class="variance ${r.variance<0?'negative':r.variance>0?'positive':''}">${money(r.variance)}</td></tr>`).join('')+`<tr class="total"><td>TOTAL</td><td>${money(summary.budget)}</td><td>${money(summary.actual)}</td><td>${money(summary.budget-summary.actual)}</td></tr>`;
 note.textContent=scope==='ALL'?'All Departments is calculated from the OPEX data already available on this device; no bulk Firestore read is triggered.':'Low-read mode: this department baseline is cached for 30 minutes.'
}
async function refresh(){
 if(!auth.currentUser||!ensureUi())return;const select=document.getElementById('subscriptionDept');if(!select||!select.options.length)return;const scope=clean(select.value);if(!scope)return;const token=++requestToken;
 try{
  if(scope==='ALL'){
   const local=allDepartmentsLocal();if(token!==requestToken)return;render(local||{available:false,reason:'Select one department to load Budget YTD and Actual YTD without reading the full baseline collection.'},scope);return
  }
  document.getElementById('subscriptionYtdBadge').textContent='Loading YTD...';const summary=await oneDepartment(scope);if(token!==requestToken)return;render(summary,scope)
 }catch(error){if(token!==requestToken)return;console.warn('Subscription YTD reference failed',error);render({available:false,reason:`Historical YTD could not load: ${error.code||error.message||error}`},scope)}
}
function bind(){
 if(!ensureUi())return;const select=document.getElementById('subscriptionDept');if(!select)return;
 if(!bound){bound=true;select.addEventListener('change',()=>setTimeout(refresh,25));const observer=new MutationObserver(()=>setTimeout(refresh,25));observer.observe(select,{childList:true});window.addEventListener('storage',e=>{if(e.key===OPEX_KEY)setTimeout(refresh,40)})}
 setTimeout(refresh,120)
}
onAuthStateChanged(auth,user=>{if(!user)return;let tries=0;const timer=setInterval(()=>{tries++;const select=document.getElementById('subscriptionDept');if(select&&select.options.length){clearInterval(timer);bind()}else if(tries>40)clearInterval(timer)},150)});
window.addEventListener('load',()=>setTimeout(bind,350));
