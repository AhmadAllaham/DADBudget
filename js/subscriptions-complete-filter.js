import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,collection,query,orderBy,startAt,endAt,documentId} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const DOC_PREFIX='subscription_budget_';
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
const num=v=>{if(typeof v==='number'&&Number.isFinite(v))return v;let s=clean(v).replace(/,/g,'');if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);const n=Number(s);return Number.isFinite(n)?n:0};
const money=v=>Math.abs(num(v))<.005?'—':num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const pct=(v,b)=>Math.abs(num(b))<.005?'—':`${(num(v)/Math.abs(num(b))*100).toFixed(1)}%`;
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');

let profile=null,admin=false,directory=[],hideZero=true,allRows=null,loadingAll=false,optionObserver=null,bodyObserver=null,syncing=false;

function departmentsOf(p={}){
  const out=Array.isArray(p.departments)?p.departments.map(clean).filter(Boolean):[];
  if(p.department&&!out.includes(clean(p.department)))out.push(clean(p.department));
  return [...new Set(out.filter(x=>x&&x!=='ALL'&&!x.startsWith('GROUP:')))];
}
function cachedProfile(user){
  try{const p=JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null');return p&&clean(p.uid)===clean(user?.uid)?p:null}catch(_){return null}
}
async function loadProfile(user){
  const cached=cachedProfile(user);if(cached)return cached;
  const snap=await getDoc(doc(db,'users',user.uid));return snap.exists()?snap.data()||{}:{};
}
function isAdmin(user,p){return !!user&&(user.uid===MAIN_ADMIN_UID||p?.isMainAdmin===true||p?.role==='admin')}
function add(map,cc,name){
  cc=clean(cc);if(!cc||cc==='16'||cc==='ALL'||cc.startsWith('GROUP:'))return;
  name=clean(name||cc);const old=map.get(cc);
  if(!old||old.name===old.cc||(/^\d+$/.test(old.name)&&name!==cc))map.set(cc,{cc,name});
}
function canonicalMap(){return new Map((window.DADCanonicalDepartmentDirectory||[]).map(x=>[clean(x?.cc),clean(x?.name||x?.cc)]))}
function addLocal(map,allowed=null){
  try{
    const model=JSON.parse(localStorage.getItem('dadBudgetOPEXBaselineV17')||'null');
    (model?.departmentDirectory||[]).forEach(x=>{const cc=clean(x?.cc);if(!allowed||allowed.has(cc))add(map,cc,x?.name)});
    Object.values(model?.departments||{}).forEach(x=>{const cc=clean(x?.cc);if(!allowed||allowed.has(cc))add(map,cc,x?.name)});
  }catch(_){}
}
async function loadDirectory(){
  const map=new Map(),canonical=canonicalMap();
  if(!admin){
    const allowed=new Set(departmentsOf(profile));
    allowed.forEach(cc=>add(map,cc,canonical.get(cc)||cc));
    addLocal(map,allowed);
    directory=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
    return;
  }
  try{
    const [metaSnap,sharedSnap]=await Promise.all([
      getDoc(doc(db,'opex_baseline_meta','current')),
      getDoc(doc(db,'system_status','department_directory_fy2027'))
    ]);
    const meta=metaSnap.exists()?metaSnap.data()||{}:{};
    (meta.departmentDirectory||[]).forEach(x=>add(map,x?.cc,x?.name||x?.departmentName));
    (meta.departments||[]).forEach(x=>typeof x==='object'?add(map,x?.cc,x?.name||x?.departmentName):add(map,x,x));
    if(sharedSnap.exists())(sharedSnap.data()?.directory||[]).forEach(x=>add(map,x?.cc,x?.name));
  }catch(e){console.warn('Subscriptions department directory read skipped',e)}
  (window.DADCanonicalDepartmentDirectory||[]).forEach(x=>add(map,x?.cc,x?.name));
  addLocal(map);
  directory=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
}

function injectUi(){
  const select=document.getElementById('subscriptionDept'),filter=select?.closest('.sub-filter');
  if(!select||!filter)return false;
  filter.classList.add('subscription-filter-enhanced');
  if(!document.getElementById('subscriptionFilterEnhancementStyle')){
    const style=document.createElement('style');style.id='subscriptionFilterEnhancementStyle';style.textContent=`
      .sub-filter.subscription-filter-enhanced{grid-template-columns:minmax(230px,320px) minmax(300px,430px) minmax(250px,1fr) auto;align-items:center}
      #subscriptionDeptQuickSearch{width:100%}
      #subscriptionZeroToggle{height:40px;white-space:nowrap}
      @media(max-width:1100px){.sub-filter.subscription-filter-enhanced{grid-template-columns:1fr 1fr}.sub-filter.subscription-filter-enhanced #subscriptionZeroToggle{width:100%}}
      @media(max-width:700px){.sub-filter.subscription-filter-enhanced{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }
  let search=document.getElementById('subscriptionDeptQuickSearch');
  if(!search){
    search=document.createElement('input');search.id='subscriptionDeptQuickSearch';search.type='search';search.placeholder='Search department or Fund Center...';search.autocomplete='off';search.setAttribute('list','subscriptionDeptSearchList');
    select.insertAdjacentElement('beforebegin',search);
    const list=document.createElement('datalist');list.id='subscriptionDeptSearchList';document.body.appendChild(list);
    search.addEventListener('change',chooseDepartmentFromSearch);
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();chooseDepartmentFromSearch()}});
    search.addEventListener('focus',()=>search.select());
  }
  let zero=document.getElementById('subscriptionZeroToggle');
  if(!zero){
    zero=document.createElement('button');zero.id='subscriptionZeroToggle';zero.type='button';zero.className='sub-btn ghost';zero.onclick=()=>{
      hideZero=!hideZero;try{localStorage.setItem('dadBudgetSubscriptionsHideZero',hideZero?'1':'0')}catch(_){}
      if(clean(select.value)==='ALL'&&admin)renderAll();else applyZeroRows();
    };
    filter.appendChild(zero);
  }
  try{const saved=localStorage.getItem('dadBudgetSubscriptionsHideZero');if(saved==='0')hideZero=false;if(saved==='1')hideZero=true}catch(_){}
  return true;
}
function expectedOptions(){
  const out=[];if(admin)out.push({value:'ALL',label:'All Departments'});
  directory.forEach(d=>out.push({value:d.cc,label:`${d.cc} · ${d.name}`}));
  return out;
}
function syncOptions(){
  const select=document.getElementById('subscriptionDept');if(!select||syncing)return;
  const expected=expectedOptions(),current=[...select.options].map(o=>({value:clean(o.value),label:clean(o.textContent)}));
  const same=current.length===expected.length&&current.every((x,i)=>x.value===expected[i].value&&x.label===expected[i].label);
  if(same){rebuildSearchList();return}
  syncing=true;optionObserver?.disconnect();
  try{
    const previous=clean(select.value),saved=clean(localStorage.getItem('dadBudgetSubscriptionDept'));
    select.innerHTML='';
    expected.forEach(x=>{const o=document.createElement('option');o.value=x.value;o.textContent=x.label;select.appendChild(o)});
    const preferred=[previous,saved,...departmentsOf(profile)].find(v=>v&&expected.some(x=>x.value===v));
    if(preferred)select.value=preferred;else if(expected.length)select.value=expected[0].value;
    rebuildSearchList();
  }finally{
    syncing=false;if(optionObserver)optionObserver.observe(select,{childList:true,subtree:true});
  }
}
function rebuildSearchList(){
  const list=document.getElementById('subscriptionDeptSearchList');if(!list)return;
  list.innerHTML='';
  expectedOptions().forEach(x=>{const o=document.createElement('option');o.value=x.label;list.appendChild(o)});
}
function chooseDepartmentFromSearch(){
  const select=document.getElementById('subscriptionDept'),input=document.getElementById('subscriptionDeptQuickSearch');if(!select||!input)return;
  const q=clean(input.value).toLowerCase();if(!q)return;
  const options=[...select.options];
  let match=options.find(o=>clean(o.textContent).toLowerCase()===q||clean(o.value).toLowerCase()===q);
  if(!match)match=options.find(o=>clean(o.textContent).toLowerCase().startsWith(q));
  if(!match)match=options.find(o=>clean(o.textContent).toLowerCase().includes(q));
  if(!match)return;
  if(select.value!==match.value){select.value=match.value;select.dispatchEvent(new Event('change',{bubbles:true}))}
  input.value=match.textContent;
}

function zeroRow(tr){
  if(!tr||tr.classList.contains('total-row')||tr.querySelector('.empty-state'))return false;
  const cells=[...tr.cells].slice(5);if(!cells.length)return true;
  return cells.every(td=>{let s=clean(td.textContent).replace(/,/g,'').replace(/%/g,'');if(!s||s==='—'||s==='-')return true;if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);const n=Number(s);return !Number.isFinite(n)||Math.abs(n)<.005});
}
function applyZeroRows(){
  const body=document.getElementById('subscriptionBody');if(!body)return;
  [...body.querySelectorAll('tr')].forEach(tr=>{if(tr.classList.contains('total-row')||tr.querySelector('.empty-state'))return;tr.style.display=hideZero&&zeroRow(tr)?'none':''});
  const btn=document.getElementById('subscriptionZeroToggle');if(btn)btn.textContent=hideZero?'Show Zero':'Hide Zero';
}

function subscriptionMatch(item={},raw=''){const c=clean(item?.code||raw),n=key(item?.name||item?.accountName);return ['6140006','6141410'].includes(c)||(n.includes('SUBSCRIPTION')&&(n.includes('BOOK')||n.includes('MAGAZINE')))}
function bytesFromBase64(value){const raw=atob(value||''),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function decode(raw,id){
  if(!raw)return null;
  if(raw.encoding==='gzip-base64-v1'){if(typeof DecompressionStream==='undefined')return null;const stream=new Blob([bytesFromBase64(raw.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));return{...JSON.parse(await new Response(stream).text()),cc:id}}
  if(raw.encoding==='json-v1')return{...JSON.parse(raw.payload||'{}'),cc:id};return{...raw,cc:id};
}
function latestMonth(item){let latest=0;Object.keys(item?.actualByMonth||{}).forEach(k=>{const m=String(k).match(/^2026-(\d{2})$/);if(m)latest=Math.max(latest,Number(m[1])||0)});return latest}
function sumTo(map,month){let t=0;for(let m=1;m<=month;m++)t+=num(map?.[`2026-${String(m).padStart(2,'0')}`]);return t}
function aggregatePlan(plan={}){
  const out={};
  Object.entries(plan?.items||{}).forEach(([raw,v])=>{const gl=clean(v?.code||raw);if(!gl)return;out[gl]={gl,accountName:clean(v?.name||gl),landing:num(v?.landing),fy27:Number.isFinite(Number(v?.total))?num(v.total):Object.values(v?.newBudgetByMonth||{}).reduce((s,x)=>s+num(x),0),details:''}});
  (Array.isArray(plan?.rows)?plan.rows:[]).forEach(r=>{const gl=clean(r?.gl);if(!gl)return;const x=out[gl]||(out[gl]={gl,accountName:clean(r?.accountName||gl),landing:0,fy27:0,details:''});if(!plan.items){x.landing+=num(r?.landing);x.fy27+=Number.isFinite(Number(r?.annual))?num(r.annual):Object.values(r?.newBudgetByMonth||{}).reduce((s,v)=>s+num(v),0)}const d=clean(r?.details);if(d){const parts=x.details?x.details.split(' | '):[];if(!parts.includes(d))x.details=[...parts,d].filter(Boolean).join(' | ')}});
  return out;
}
function rowsFor(cc,department,plan){
  const pmap=aggregatePlan(plan),entries=Object.entries(department?.items||{}).filter(([raw,item])=>subscriptionMatch(item,raw)).map(([raw,item])=>({gl:clean(item?.code||raw),accountName:clean(item?.name||item?.accountName||raw),item})),seen=new Set(entries.map(x=>x.gl));
  Object.entries(pmap).forEach(([gl,x])=>{if(!seen.has(gl)){entries.push({gl,accountName:x.accountName||gl,item:null});seen.add(gl)}});
  if(!entries.length)entries.push({gl:'6140006',accountName:'Subscriptions, Books and Magazines',item:null});
  const name=directory.find(d=>d.cc===cc)?.name||department?.name||cc;
  return entries.map(({gl,accountName,item})=>{
    const cutoff=latestMonth(item)||Number((clean(localStorage.getItem('dadBudgetOPEXDateTo')).match(/^2026-(\d{2})$/)||[])[1])||7,budgetYtd=sumTo(item?.budgetByMonth,cutoff),actualYtd=sumTo(item?.actualByMonth,cutoff)+num(item?.actualUnperiodized),lyYtd=sumTo(item?.lyByMonth,cutoff)+num(item?.lyUnperiodized),fy26=num(item?.fyBudget),p=pmap[gl]||{},landing=num(p.landing),fy27=num(p.fy27),vsBudget=budgetYtd-actualYtd,vsLy=actualYtd-lyYtd,fyLanding=actualYtd+landing,remaining=fy26-actualYtd;
    return{cc,departmentName:name,gl,accountName,details:clean(p.details),lyYtd,budgetYtd,actualYtd,vsBudget,vsBudgetPct:pct(vsBudget,budgetYtd),vsLy,vsLyPct:pct(vsLy,lyYtd),landing,fyLanding,fy26,remaining,remainingPct:pct(remaining,fy26),fy27};
  });
}
async function loadAll(force=false){
  if(!admin||loadingAll)return;loadingAll=true;
  const status=document.getElementById('subscriptionStatus'),body=document.getElementById('subscriptionBody');
  if(status){status.textContent='Loading all departments...';status.classList.remove('error','ready')}
  if(body)body.innerHTML='<tr><td colspan="18" class="empty-state">Loading all departments...</td></tr>';
  try{
    const [baseSnap,planSnap]=await Promise.all([
      getDocs(collection(db,'opex_baseline_departments')),
      getDocs(query(collection(db,'system_status'),orderBy(documentId()),startAt(DOC_PREFIX),endAt(`${DOC_PREFIX}\uf8ff`)))
    ]);
    const baselines=new Map(),plans=new Map();
    await Promise.all(baseSnap.docs.map(async s=>{try{baselines.set(clean(s.id),await decode(s.data(),s.id))}catch(e){console.warn('Subscriptions baseline decode failed',s.id,e)}}));
    planSnap.docs.forEach(s=>{const cc=clean(s.id).slice(DOC_PREFIX.length);if(cc)plans.set(cc,s.data()||{})});
    allRows=directory.flatMap(d=>rowsFor(d.cc,baselines.get(d.cc),plans.get(d.cc)||{}));
    renderAll();
    const download=document.getElementById('subscriptionDownload'),upload=document.getElementById('subscriptionUpload');if(download)download.disabled=true;if(upload)upload.disabled=true;
    if(status){status.textContent=`All Departments · ${directory.length} departments`;status.classList.add('ready')}
  }catch(e){
    console.error(e);if(status){status.textContent='Could not load All Departments';status.classList.add('error')}if(body)body.innerHTML='<tr><td colspan="18" class="empty-state">Unable to load all departments.</td></tr>';
  }finally{loadingAll=false}
}
function renderAll(){
  if(!Array.isArray(allRows))return;
  const body=document.getElementById('subscriptionBody'),q=clean(document.getElementById('subscriptionSearch')?.value).toLowerCase();if(!body)return;
  let rows=allRows.filter(r=>!q||`${r.cc} ${r.departmentName} ${r.gl} ${r.accountName} ${r.details}`.toLowerCase().includes(q));
  if(hideZero)rows=rows.filter(r=>[r.lyYtd,r.budgetYtd,r.actualYtd,r.landing,r.fyLanding,r.fy26,r.remaining,r.fy27].some(v=>Math.abs(num(v))>.005));
  const t=rows.reduce((a,r)=>{['lyYtd','budgetYtd','actualYtd','vsBudget','vsLy','landing','fyLanding','fy26','remaining','fy27'].forEach(k=>a[k]+=num(r[k]));return a},{lyYtd:0,budgetYtd:0,actualYtd:0,vsBudget:0,vsLy:0,landing:0,fyLanding:0,fy26:0,remaining:0,fy27:0});
  [['kpiBudget',t.budgetYtd],['kpiActual',t.actualYtd],['kpiFy26',t.fy26],['kpiFy27',t.fy27]].forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=money(v)});
  if(!rows.length){body.innerHTML='<tr><td colspan="18" class="empty-state">No Subscriptions rows match the current view.</td></tr>';applyZeroRows();return}
  const cls=v=>num(v)>=0?'good':'bad';
  body.innerHTML=rows.map(r=>`<tr><td><b>${esc(r.cc)}</b></td><td>${esc(r.departmentName)}</td><td>${esc(r.gl)}</td><td><b>${esc(r.accountName)}</b></td><td class="details">${esc(r.details)||'—'}</td><td class="ref">${money(r.lyYtd)}</td><td class="ref">${money(r.budgetYtd)}</td><td class="actual">${money(r.actualYtd)}</td><td class="var ${cls(r.vsBudget)}">${money(r.vsBudget)}</td><td class="var ${cls(r.vsBudget)}">${r.vsBudgetPct}</td><td class="var ${cls(-r.vsLy)}">${money(r.vsLy)}</td><td class="var ${cls(-r.vsLy)}">${r.vsLyPct}</td><td class="input">${money(r.landing)}</td><td>${money(r.fyLanding)}</td><td class="ref">${money(r.fy26)}</td><td class="var ${cls(r.remaining)}">${money(r.remaining)}</td><td class="var ${cls(r.remaining)}">${r.remainingPct}</td><td class="input">${money(r.fy27)}</td></tr>`).join('')+`<tr class="total-row"><td><b>TOTAL</b></td><td>${rows.length} rows</td><td></td><td></td><td></td><td>${money(t.lyYtd)}</td><td>${money(t.budgetYtd)}</td><td>${money(t.actualYtd)}</td><td>${money(t.vsBudget)}</td><td>${pct(t.vsBudget,t.budgetYtd)}</td><td>${money(t.vsLy)}</td><td>${pct(t.vsLy,t.lyYtd)}</td><td>${money(t.landing)}</td><td>${money(t.fyLanding)}</td><td>${money(t.fy26)}</td><td>${money(t.remaining)}</td><td>${pct(t.remaining,t.fy26)}</td><td>${money(t.fy27)}</td></tr>`;
  applyZeroRows();
}

function bind(){
  const select=document.getElementById('subscriptionDept'),body=document.getElementById('subscriptionBody');if(!select||!body)return false;
  injectUi();syncOptions();
  if(!optionObserver){optionObserver=new MutationObserver(()=>{if(!syncing)setTimeout(syncOptions,0)});optionObserver.observe(select,{childList:true,subtree:true})}
  if(select.dataset.subscriptionStableFilter!=='1'){
    select.dataset.subscriptionStableFilter='1';
    select.addEventListener('change',e=>{
      const value=clean(select.value),search=document.getElementById('subscriptionDeptQuickSearch');if(search)search.value=clean(select.selectedOptions?.[0]?.textContent);
      if(value==='ALL'&&admin){e.preventDefault();e.stopImmediatePropagation();localStorage.setItem('dadBudgetSubscriptionDept','ALL');loadAll(false);return}
      allRows=null;setTimeout(applyZeroRows,150);
    },true);
    const searchRows=document.getElementById('subscriptionSearch');searchRows?.addEventListener('input',e=>{if(clean(select.value)==='ALL'&&admin){e.stopImmediatePropagation();renderAll()}},true);
    const refresh=document.getElementById('subscriptionRefresh');refresh?.addEventListener('click',e=>{if(clean(select.value)==='ALL'&&admin){e.preventDefault();e.stopImmediatePropagation();loadAll(true)}},true);
  }
  if(!bodyObserver){bodyObserver=new MutationObserver(()=>{if(clean(select.value)!=='ALL')applyZeroRows()});bodyObserver.observe(body,{childList:true,subtree:true})}
  applyZeroRows();
  if(clean(select.value)==='ALL'&&admin)loadAll(false);
  return true;
}
async function boot(user){
  if(!user)return;profile=await loadProfile(user);admin=isAdmin(user,profile);await loadDirectory();
  let tries=0;const timer=setInterval(()=>{tries++;if(bind()||tries>100)clearInterval(timer)},100);
  window.addEventListener('load',()=>setTimeout(()=>{bind();syncOptions();applyZeroRows()},300),{once:true});
}
onAuthStateChanged(auth,user=>boot(user).catch(e=>console.warn('Subscriptions stable filter failed',e)));
