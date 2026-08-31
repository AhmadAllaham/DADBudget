import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={
  apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',
  authDomain:'budget-8c575.firebaseapp.com',
  projectId:'budget-8c575',
  storageBucket:'budget-8c575.firebasestorage.app',
  messagingSenderId:'990142203884',
  appId:'1:990142203884:web:5c22dc2c14855528a022c9'
};

const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const DOC_PREFIX='subscription_budget_';
const OPEX_KEY='dadBudgetOPEXBaselineV17';
const CACHE_KEY='dadBudgetSubscriptionsSimpleCacheV1';
const BRIDGE_CACHE_KEY='dadBudgetSubscriptionsBridgeCacheV2';
const CACHE_MS=30*60*1000;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const num=v=>{
  if(typeof v==='number'&&Number.isFinite(v))return v;
  let s=clean(v).replace(/,/g,'');
  if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
  const n=Number(s);
  return Number.isFinite(n)?n:0;
};
const money=v=>Math.abs(num(v))<.005?'—':num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const pct=(v,b)=>Math.abs(num(b))<.005?'—':`${(num(v)/Math.abs(num(b))*100).toFixed(1)}%`;
const monthKey=i=>`2027-${String(i+1).padStart(2,'0')}`;
const DEPARTMENT_ALIASES={'100100301':'1000100301'};
const normalizeDepartmentCc=value=>DEPARTMENT_ALIASES[clean(value)]||clean(value);

let profile=null,directory=[],masterAccounts=[],selectedData=null;

function departmentsOf(p={}){
  const out=Array.isArray(p.departments)?p.departments.map(normalizeDepartmentCc).filter(Boolean):[];
  const primary=normalizeDepartmentCc(p.department);
  if(primary&&!out.includes(primary))out.push(primary);
  return [...new Set(out)];
}
function isAdmin(user=auth.currentUser,p=profile){
  return !!user&&(user.uid===MAIN_ADMIN_UID||p?.isMainAdmin===true||p?.role==='admin');
}
function isItViewer(p=profile){
  return Array.isArray(p?.modules)&&p.modules.includes('capex_it');
}
function cachedProfile(){
  try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||null}catch(_){return null}
}
function localModel(){
  try{const m=JSON.parse(localStorage.getItem(OPEX_KEY)||'null');return m?.departments?m:null}catch(_){return null}
}
function saveLocalModel(model){
  if(!model?.departments)return;
  localStorage.setItem(OPEX_KEY,JSON.stringify(model));
  window.dispatchEvent(new CustomEvent('dad-opex-refresh-departments'));
}
function isSubscriptionAccount(item={},raw=''){
  const code=clean(item.code||raw),name=norm(item.name||item.accountName);
  return ['6140006','6141410'].includes(code)||(name.includes('SUBSCRIPTION')&&(name.includes('BOOK')||name.includes('MAGAZINE')));
}
function setStatus(text,error=false){
  const el=$('subscriptionStatus');
  if(!el)return;
  el.textContent=text;
  el.classList.toggle('error',error);
  el.classList.toggle('ready',!error);
}
function cacheRead(key){
  try{
    const all=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'{}')||{},x=all[key];
    return x&&Date.now()-Number(x.ts||0)<CACHE_MS?x.value:null;
  }catch(_){return null}
}
function cacheWrite(key,value){
  try{
    const all=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'{}')||{};
    all[key]={ts:Date.now(),value};
    sessionStorage.setItem(CACHE_KEY,JSON.stringify(all));
  }catch(_){}
}
function cacheClear(){
  try{sessionStorage.removeItem(CACHE_KEY)}catch(_){}
}
function clearOpexBridgeCache(){
  try{sessionStorage.removeItem(BRIDGE_CACHE_KEY)}catch(_){}
}
function bytesFromBase64(value){
  const raw=atob(value||''),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
async function decode(raw,id){
  if(!raw)return null;
  if(raw.encoding==='gzip-base64-v1'){
    if(typeof DecompressionStream==='undefined')throw new Error('Please use an updated Chrome or Edge browser.');
    const stream=new Blob([bytesFromBase64(raw.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return {...JSON.parse(await new Response(stream).text()),cc:id};
  }
  if(raw.encoding==='json-v1')return {...JSON.parse(raw.payload||'{}'),cc:id};
  return {...raw,cc:id};
}
async function loadProfile(user){
  const local=cachedProfile();
  if(local&&clean(local.uid)===user.uid)return local;
  const s=await getDoc(doc(db,'users',user.uid));
  return s.exists()?s.data()||{}:{};
}
async function loadMeta(force=false){
  const metaCacheKey=`meta:${clean(auth.currentUser?.uid)}`;
  if(!force){
    const cached=cacheRead(metaCacheKey);
    if(cached){
      const allowed=new Set(departmentsOf(profile));
      directory=(cached.directory||[]).filter(x=>isAdmin()||isItViewer()||allowed.has('ALL')||allowed.has(clean(x?.cc)));
      masterAccounts=cached.masterAccounts||[];
      return;
    }
  }
  const s=await getDoc(doc(db,'opex_baseline_meta','current'));
  if(!s.exists())throw new Error('Finance OPEX baseline is not published yet.');
  const data=s.data()||{};
  const rawDir=Array.isArray(data.departmentDirectory)
    ?data.departmentDirectory
    :(Array.isArray(data.departments)?data.departments.map(cc=>({cc,name:cc})):[]);
  const rawMaster=Array.isArray(data.accountMaster)
    ?data.accountMaster
    :Object.entries(data.accountMaster||{}).map(([code,a])=>({code:clean(a?.code||code),name:clean(a?.name||a?.code||code)}));
  const allowed=new Set(departmentsOf(profile));
  directory=rawDir
    .map(x=>({cc:clean(x.cc),name:clean(x.name||x.departmentName||x.cc)}))
    .filter(x=>x.cc&&x.cc!=='16'&&(isAdmin()||isItViewer()||allowed.has('ALL')||allowed.has(x.cc)))
    .sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
  masterAccounts=rawMaster
    .map(x=>({code:clean(x.code),name:clean(x.name||x.code)}))
    .filter(isSubscriptionAccount)
    .sort((a,b)=>a.code.localeCompare(b.code));
  cacheWrite(metaCacheKey,{directory,masterAccounts});
}
function canReadBaseline(cc){
  return isAdmin()||isItViewer()||departmentsOf(profile).includes('ALL')||departmentsOf(profile).includes(cc);
}
function canEdit(cc){
  return isAdmin()||departmentsOf(profile).includes('ALL')||departmentsOf(profile).includes(cc);
}
async function loadBaseline(cc,force=false){
  const local=localModel()?.departments?.[cc];
  if(local)return local;
  if(!canReadBaseline(cc))return null;
  if(!force){
    const cached=cacheRead(`baseline:${cc}`);
    if(cached)return cached;
  }
  const s=await getDoc(doc(db,'opex_baseline_departments',cc));
  if(!s.exists())return null;
  const d=await decode(s.data(),cc);
  if(d)cacheWrite(`baseline:${cc}`,d);
  return d;
}
async function loadPlan(cc,force=false){
  if(!force){
    const cached=cacheRead(`plan:${cc}`);
    if(cached)return cached;
  }
  const s=await getDoc(doc(db,'system_status',`${DOC_PREFIX}${cc}`));
  const data=s.exists()?s.data()||{}:{};
  cacheWrite(`plan:${cc}`,data);
  return data;
}
async function loadItAllocation(cc,force=false){
  if(!force){
    const cached=cacheRead(`it:${cc}`);
    if(cached)return cached;
  }
  const s=await getDoc(doc(db,'opex_it_allocations',cc));
  const data=s.exists()?s.data()||{}:{};
  cacheWrite(`it:${cc}`,data);
  return data;
}
function latestMonth(item){
  let latest=0;
  Object.keys(item?.actualByMonth||{}).forEach(k=>{
    const m=String(k).match(/^2026-(\d{2})$/);
    if(m)latest=Math.max(latest,Number(m[1])||0);
  });
  return latest;
}
function sumTo(map,month){
  let t=0;
  for(let m=1;m<=month;m++)t+=num(map?.[`2026-${String(m).padStart(2,'0')}`]);
  return t;
}
function emptyMonths(){
  return Object.fromEntries(MONTHS.map((_,i)=>[monthKey(i),0]));
}
function annualMonths(total){
  const value=num(total);
  if(Math.abs(value)<.00001)return emptyMonths();
  const cents=Math.round(value*100),base=Math.trunc(cents/12),used=base*11,out={};
  MONTHS.forEach((_,i)=>out[monthKey(i)]=(i===11?cents-used:base)/100);
  return out;
}
function addMonthMaps(...maps){
  const out=emptyMonths();
  maps.forEach(map=>Object.entries(map||{}).forEach(([month,value])=>out[month]=num(out[month])+num(value)));
  return out;
}
function aggregatePlan(plan={}){
  const out={};
  if(plan.items&&typeof plan.items==='object'){
    Object.entries(plan.items).forEach(([raw,v])=>{
      const gl=clean(v?.code||raw);
      if(!gl)return;
      const months={...emptyMonths(),...(v?.newBudgetByMonth||{})};
      out[gl]={
        gl,
        accountName:clean(v?.name||gl),
        landing:num(v?.landing),
        newBudgetByMonth:months,
        fy27:Object.values(months).reduce((s,x)=>s+num(x),0),
        details:''
      };
    });
  }
  (Array.isArray(plan.rows)?plan.rows:[]).forEach(r=>{
    const gl=clean(r?.gl);
    if(!gl)return;
    const x=out[gl]||(out[gl]={
      gl,
      accountName:clean(r?.accountName||gl),
      landing:0,
      newBudgetByMonth:emptyMonths(),
      fy27:0,
      details:''
    });
    if(!plan.items){
      x.landing+=num(r?.landing);
      MONTHS.forEach((_,i)=>{
        const k=monthKey(i);
        x.newBudgetByMonth[k]=(x.newBudgetByMonth[k]||0)+num(r?.newBudgetByMonth?.[k]);
      });
      x.fy27=Object.values(x.newBudgetByMonth).reduce((s,v)=>s+num(v),0);
    }
    const detail=clean(r?.details);
    if(detail){
      const parts=x.details?x.details.split(' | '):[];
      if(!parts.includes(detail))x.details=[...parts,detail].filter(Boolean).join(' | ');
    }
  });
  return out;
}
function accountRows(department,plan,itAllocation,cc){
  const planMap=aggregatePlan(plan);
  const baseEntries=Object.entries(department?.items||{})
    .filter(([raw,item])=>isSubscriptionAccount(item,raw))
    .map(([raw,item])=>({gl:clean(item?.code||raw),accountName:clean(item?.name||item?.accountName||raw),item}));
  const seen=new Set(baseEntries.map(x=>x.gl));
  Object.entries(planMap).forEach(([gl,x])=>{
    if(!seen.has(gl)){
      baseEntries.push({gl,accountName:x.accountName||gl,item:null});
      seen.add(gl);
    }
  });
  masterAccounts.forEach(a=>{
    if(!seen.has(a.code)){
      baseEntries.push({gl:a.code,accountName:a.name,item:null});
      seen.add(a.code);
    }
  });
  if(!baseEntries.length)baseEntries.push({gl:'6140006',accountName:'Subscriptions, Books and Magazines',item:null});
  const departmentRows=baseEntries.map(({gl,accountName,item})=>{
    const cutoff=latestMonth(item)||Number((clean(localStorage.getItem('dadBudgetOPEXDateTo')).match(/^2026-(\d{2})$/)||[])[1])||7;
    const budgetYtd=sumTo(item?.budgetByMonth,cutoff);
    const actualMonthly=sumTo(item?.actualByMonth,cutoff);
    const actualYtd=actualMonthly+num(item?.actualUnperiodized);
    const lyMonthly=sumTo(item?.lyByMonth,cutoff);
    const lyYtd=lyMonthly+num(item?.lyUnperiodized);
    const fy26=num(item?.fyBudget);
    const p=planMap[gl]||{};
    const landing=num(p.landing);
    const newBudgetByMonth={...emptyMonths(),...(p.newBudgetByMonth||{})};
    const fy27=Object.values(newBudgetByMonth).reduce((s,v)=>s+num(v),0);
    const vsBudget=budgetYtd-actualYtd;
    const vsLy=actualYtd-lyYtd;
    const fyLanding=actualYtd+landing;
    const remaining=fy26-actualYtd;
    return {
      cc,
      departmentName:directory.find(d=>d.cc===cc)?.name||department?.name||cc,
      gl,
      accountName,
      details:clean(p.details),
      source:'department',
      sourceLabel:'Department Input',
      lyYtd,
      budgetYtd,
      actualYtd,
      vsBudget,
      vsBudgetPct:pct(vsBudget,budgetYtd),
      vsLy,
      vsLyPct:pct(vsLy,lyYtd),
      landing,
      fyLanding,
      fy26,
      remaining,
      remainingPct:pct(remaining,fy26),
      newBudgetByMonth,
      fy27
    };
  });
  const source=itAllocation?.items?.subscriptions||{},itGl=clean(source.accountCode)||departmentRows[0]?.gl||'6140006',itName=clean(source.accountName)||'Subscriptions, Books and Magazines',detailRows=Array.isArray(source.rows)?source.rows.filter(r=>Math.abs(num(r?.allocatedAmount??r?.total))>.005):[],fallbackTotal=num(source.total),itRows=(detailRows.length?detailRows:[{description:'Centrally allocated by IT',allocatedAmount:fallbackTotal}]).map(r=>{
    const fy27=num(r?.allocatedAmount??r?.total),months=annualMonths(fy27);
    return{
      cc,
      departmentName:directory.find(d=>d.cc===cc)?.name||department?.name||cc,
      gl:itGl,
      accountName:itName,
      details:clean(r?.description)||'Centrally allocated by IT',
      source:'it',
      sourceLabel:'IT Allocation',
      lyYtd:0,budgetYtd:0,actualYtd:0,vsBudget:0,vsBudgetPct:'—',vsLy:0,vsLyPct:'—',landing:0,fyLanding:0,fy26:0,remaining:0,remainingPct:'—',newBudgetByMonth:months,fy27
    };
  });
  return [...departmentRows,...itRows];
}
function esc(v){
  return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function cls(v){return num(v)>=0?'good':'bad'}
function render(){
  const body=$('subscriptionBody');
  if(!selectedData){
    body.innerHTML='<tr><td colspan="19" class="empty-state">Select a department.</td></tr>';
    return;
  }
  const q=clean($('subscriptionSearch').value).toLowerCase();
  const rows=selectedData.rows.filter(r=>!q||`${r.cc} ${r.departmentName} ${r.gl} ${r.accountName} ${r.details} ${r.sourceLabel}`.toLowerCase().includes(q));
  if(!rows.length){
    body.innerHTML='<tr><td colspan="19" class="empty-state">No Subscriptions row matches the current search.</td></tr>';
    return;
  }
  const t=rows.reduce((a,r)=>{
    ['lyYtd','budgetYtd','actualYtd','vsBudget','vsLy','landing','fyLanding','fy26','remaining','fy27'].forEach(k=>a[k]+=num(r[k]));
    return a;
  },{lyYtd:0,budgetYtd:0,actualYtd:0,vsBudget:0,vsLy:0,landing:0,fyLanding:0,fy26:0,remaining:0,fy27:0});
  $('kpiBudget').textContent=money(t.budgetYtd);
  $('kpiActual').textContent=money(t.actualYtd);
  $('kpiFy26').textContent=money(t.fy26);
  $('kpiFy27').textContent=money(t.fy27);
  body.innerHTML=rows.map(r=>`<tr>
    <td><b>${esc(r.cc)}</b></td>
    <td>${esc(r.departmentName)}</td>
    <td>${esc(r.gl)}</td>
    <td><b>${esc(r.accountName)}</b></td>
    <td class="details">${esc(r.details)||'—'}</td>
    <td><span class="source-tag ${r.source==='it'?'it':'department'}">${esc(r.sourceLabel)}</span></td>
    <td class="ref">${money(r.lyYtd)}</td>
    <td class="ref">${money(r.budgetYtd)}</td>
    <td class="actual">${money(r.actualYtd)}</td>
    <td class="var ${cls(r.vsBudget)}">${money(r.vsBudget)}</td>
    <td class="var ${cls(r.vsBudget)}">${r.vsBudgetPct}</td>
    <td class="var ${cls(-r.vsLy)}">${money(r.vsLy)}</td>
    <td class="var ${cls(-r.vsLy)}">${r.vsLyPct}</td>
    <td class="input">${money(r.landing)}</td>
    <td>${money(r.fyLanding)}</td>
    <td class="ref">${money(r.fy26)}</td>
    <td class="var ${cls(r.remaining)}">${money(r.remaining)}</td>
    <td class="var ${cls(r.remaining)}">${r.remainingPct}</td>
    <td class="input">${money(r.fy27)}</td>
  </tr>`).join('')+`<tr class="total-row">
    <td><b>TOTAL</b></td><td></td><td></td><td></td><td></td><td></td>
    <td>${money(t.lyYtd)}</td><td>${money(t.budgetYtd)}</td><td>${money(t.actualYtd)}</td>
    <td>${money(t.vsBudget)}</td><td>${pct(t.vsBudget,t.budgetYtd)}</td>
    <td>${money(t.vsLy)}</td><td>${pct(t.vsLy,t.lyYtd)}</td>
    <td>${money(t.landing)}</td><td>${money(t.fyLanding)}</td><td>${money(t.fy26)}</td>
    <td>${money(t.remaining)}</td><td>${pct(t.remaining,t.fy26)}</td><td>${money(t.fy27)}</td>
  </tr>`;
}
async function selectDepartment(force=false){
  const cc=clean($('subscriptionDept').value);
  if(!cc)return;
  setStatus('Loading department...');
  const [baseline,plan,itAllocation]=await Promise.all([loadBaseline(cc,force),loadPlan(cc,force),loadItAllocation(cc,force)]);
  selectedData={cc,baseline,plan,itAllocation,rows:accountRows(baseline,plan,itAllocation,cc)};
  const editable=canEdit(cc);
  $('subscriptionDownload').disabled=!editable;
  $('subscriptionUpload').disabled=!editable;
  render();
  setStatus(editable?'Subscriptions loaded':'View only · this department is not assigned to your user');
}
function populateDepartments(){
  const sel=$('subscriptionDept');
  sel.innerHTML='';
  directory.forEach(d=>{
    const o=document.createElement('option');
    o.value=d.cc;
    o.textContent=`${d.cc} · ${d.name}`;
    sel.appendChild(o);
  });
  const saved=clean(localStorage.getItem('dadBudgetSubscriptionDept'));
  const assigned=departmentsOf(profile).find(cc=>directory.some(d=>d.cc===cc));
  if(saved&&directory.some(d=>d.cc===saved))sel.value=saved;
  else if(assigned)sel.value=assigned;
  else if(directory[0])sel.value=directory[0].cc;
}

const HEADERS=[
  'Fund Center','Department','G/L Account','Subscription Account','Item Details / شرح البند',
  'LY YTD','Budget YTD','Actual YTD','Actual YTD Vs Budget','Actual YTD Vs Budget %',
  'Vs LY','Vs LY %','Landing','FY Landing','FY Budget 2026','Remaining','Remaining %',
  ...MONTHS,'FY Budget 2027'
];

function excelRows(){
  return (selectedData?.rows||[]).filter(r=>r.source!=='it').map(r=>[
    r.cc,r.departmentName,r.gl,r.accountName,r.details,
    r.lyYtd,r.budgetYtd,r.actualYtd,r.vsBudget,r.vsBudgetPct,
    r.vsLy,r.vsLyPct,r.landing,r.fyLanding,r.fy26,r.remaining,r.remainingPct,
    ...MONTHS.map((_,i)=>num(r.newBudgetByMonth?.[monthKey(i)])),
    r.fy27
  ]);
}
function downloadExcel(){
  if(!selectedData||!canEdit(selectedData.cc))return;
  const rows=excelRows();
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([HEADERS,...rows]);
  const firstDataRow=2,lastDataRow=Math.max(2,rows.length+1);
  const janCol=18,decCol=29,fy27Col=30;
  for(let r=firstDataRow;r<=lastDataRow;r++){
    const fyCell=XLSX.utils.encode_cell({r:r-1,c:fy27Col-1});
    const janCell=XLSX.utils.encode_cell({r:r-1,c:janCol-1});
    const decCell=XLSX.utils.encode_cell({r:r-1,c:decCol-1});
    ws[fyCell]={t:'n',f:`SUM(${janCell}:${decCell})`};
  }
  ws['!cols']=[
    14,32,14,38,48,
    ...Array(12).fill(17),
    ...Array(12).fill(12),
    17
  ].map(w=>({wch:w}));
  ws['!autofilter']={ref:`A1:AD${lastDataRow}`};
  ws['!freeze']={xSplit:5,ySplit:1};
  XLSX.utils.book_append_sheet(wb,ws,'Subscriptions');
  XLSX.writeFile(wb,`Subscriptions_${selectedData.departmentName||selectedData.cc}_${selectedData.cc}.xlsx`);
}
function headerIndex(header,names){
  const list=Array.isArray(names)?names:[names];
  const normalized=header.map(x=>clean(x).toLowerCase());
  for(const name of list){
    const i=normalized.indexOf(clean(name).toLowerCase());
    if(i>=0)return i;
  }
  return -1;
}
function parseExcel(wb,cc){
  const sn=wb.SheetNames.find(n=>/^subscriptions$/i.test(clean(n)))||wb.SheetNames[0];
  const mx=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:true});
  if(!mx.length)throw new Error('Subscriptions sheet is empty.');
  const h=mx[0];
  const ci=headerIndex(h,'Fund Center');
  const gi=headerIndex(h,'G/L Account');
  const ni=headerIndex(h,'Subscription Account');
  const di=headerIndex(h,['Item Details / شرح البند','Details','Item Details','شرح البند']);
  const li=headerIndex(h,'Landing');
  const monthIndexes=MONTHS.map(m=>headerIndex(h,m));
  if([ci,gi,di,li,...monthIndexes].some(i=>i<0)){
    throw new Error('Use the latest downloaded Subscriptions Excel with Jan-Dec columns.');
  }
  const rows=[];
  for(let i=1;i<mx.length;i++){
    const r=mx[i]||[];
    const rowCc=clean(r[ci]);
    const gl=clean(r[gi]);
    const details=clean(r[di]);
    const landing=num(r[li]);
    const newBudgetByMonth={};
    MONTHS.forEach((_,mi)=>newBudgetByMonth[monthKey(mi)]=num(r[monthIndexes[mi]]));
    const annual=Object.values(newBudgetByMonth).reduce((s,v)=>s+num(v),0);
    const hasInput=Math.abs(landing)+Math.abs(annual)>.005;
    if(!rowCc&&!gl&&!details&&!hasInput)continue;
    if(rowCc!==cc)throw new Error(`Row ${i+1}: Fund Center must be ${cc}.`);
    if(!gl)throw new Error(`Row ${i+1}: G/L Account is required.`);
    if(!isSubscriptionAccount({code:gl,name:clean(r[ni])},gl)){
      throw new Error(`Row ${i+1}: G/L ${gl} is not a Subscriptions account.`);
    }
    if(hasInput&&!details)throw new Error(`Row ${i+1}: Item Details / شرح البند is required when Landing or monthly Budget 2027 has a value.`);
    if(!hasInput)continue;
    rows.push({
      cc,
      departmentName:directory.find(d=>d.cc===cc)?.name||cc,
      gl,
      accountName:clean(r[ni])||masterAccounts.find(a=>a.code===gl)?.name||gl,
      details,
      landing,
      annual,
      newBudgetByMonth
    });
  }
  if(!rows.length)throw new Error('No Subscriptions rows found. Fill at least one monthly Budget 2027 value.');
  return rows;
}
function aggregateItems(rows){
  const out={};
  rows.forEach(r=>{
    const x=out[r.gl]||(out[r.gl]={code:r.gl,name:r.accountName,landing:0,total:0,newBudgetByMonth:emptyMonths()});
    x.landing+=num(r.landing);
    Object.entries(r.newBudgetByMonth||{}).forEach(([k,v])=>x.newBudgetByMonth[k]=(x.newBudgetByMonth[k]||0)+num(v));
    x.total=Object.values(x.newBudgetByMonth).reduce((s,v)=>s+num(v),0);
  });
  return out;
}
function bytesToBase64(bytes){
  let s='';
  for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(s);
}
async function encode(data){
  const raw=JSON.stringify(data);
  if(typeof CompressionStream!=='undefined'){
    const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
    const payload=bytesToBase64(bytes);
    if(new Blob([payload]).size<900000)return{encoding:'gzip-base64-v1',payload};
  }
  if(new Blob([raw]).size<900000)return{encoding:'json-v1',payload:raw};
  throw new Error('OPEX submission is too large.');
}
function applyPlanToSubmission(department,plan){
  const merged={
    ...department,
    items:{...(department.items||{})},
    subscriptionRows:(plan.rows||[]).map(r=>({...r,newBudgetByMonth:{...(r.newBudgetByMonth||{})}}))
  };
  Object.entries(plan.items||{}).forEach(([raw,v])=>{
    const gl=clean(v?.code||raw);
    const existingKey=Object.keys(merged.items).find(k=>clean(merged.items[k]?.code||k)===gl)||gl;
    const existing=merged.items[existingKey]||{
      code:gl,name:clean(v?.name||gl),budgetByMonth:{},actualByMonth:{},lyByMonth:{},
      fyBudget:0,actualUnperiodized:0,lyUnperiodized:0
    };
    const departmentMonths={...(v?.newBudgetByMonth||{})},itMonths={...(existing?.itSubscriptionAllocatedByMonth||{})};
    merged.items[existingKey]={
      ...existing,
      landing:num(v?.landing),
      newBudgetByMonth:addMonthMaps(departmentMonths,itMonths),
      departmentSubscriptionByMonth:departmentMonths,
      departmentSubscriptionLanding:num(v?.landing),
      subscriptionControlled:true,
      subscriptionSource:'department',
      subscriptionDetails:(plan.rows||[]).filter(r=>clean(r.gl)===gl).map(r=>clean(r.details)).filter(Boolean).join(' | ')
    };
  });
  return merged;
}
function patchLocalOpex(cc,plan){
  const model=localModel();
  if(!model?.departments?.[cc])return;
  model.departments[cc]=applyPlanToSubmission(model.departments[cc],plan);
  saveLocalModel(model);
}
async function patchOpenOpex(cc,plan){
  const ref=doc(db,'opex_budget_submissions',cc);
  const s=await getDoc(ref);
  if(!s.exists())return;
  const raw=s.data()||{};
  const state=clean(raw.workflowStatus||raw.status).toLowerCase();
  if(['pending_manager','manager_approved','submitted','under_review','approved'].includes(state)){
    throw new Error('OPEX is already under approval. Return it first before changing Subscriptions.');
  }
  const decoded=await decode(raw,cc);
  if(!decoded?.items)return;
  const patched=applyPlanToSubmission(decoded,plan);
  const encoded=await encode(patched);
  await setDoc(ref,{
    encoding:encoded.encoding,
    payload:encoded.payload,
    workflowStatus:'uploaded',
    status:'uploaded',
    financeStatus:'not_submitted',
    subscriptionRows:plan.rows,
    subscriptionUpdatedAt:serverTimestamp(),
    subscriptionUpdatedBy:auth.currentUser.uid,
    subscriptionUpdatedByEmail:clean(auth.currentUser.email).toLowerCase()
  },{merge:true});
}
async function uploadExcel(file){
  const cc=clean($('subscriptionDept').value);
  if(!cc||!canEdit(cc))throw new Error('You cannot edit this department.');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const rows=parseExcel(wb,cc);
  const prev=await loadPlan(cc,true);
  const plan={
    cc,
    departmentName:directory.find(d=>d.cc===cc)?.name||cc,
    fiscalYear:2027,
    currency:'JOD',
    rows,
    items:aggregateItems(rows),
    total:rows.reduce((s,r)=>s+num(r.annual),0),
    landingTotal:rows.reduce((s,r)=>s+num(r.landing),0),
    revision:num(prev?.revision)+1,
    sourceFile:file.name,
    updatedBy:auth.currentUser.uid,
    updatedByEmail:clean(auth.currentUser.email).toLowerCase(),
    updatedAt:serverTimestamp(),
    clientUpdatedAt:new Date().toISOString()
  };
  await patchOpenOpex(cc,plan);
  await setDoc(doc(db,'system_status',`${DOC_PREFIX}${cc}`),plan,{merge:false});
  patchLocalOpex(cc,plan);
  clearOpexBridgeCache();
  cacheWrite(`plan:${cc}`,{...plan,updatedAt:null});
  try{localStorage.setItem('dadBudgetSubscriptionsRefreshToken',String(Date.now()))}catch(_){}
  window.dispatchEvent(new CustomEvent('dad-subscriptions-updated',{detail:{cc}}));
  await selectDepartment(true);
  setStatus(`${file.name} · saved · Jan-Dec reflected to OPEX`);
}
async function boot(user){
  if(!user){location.href='login.html';return}
  try{
    profile=await loadProfile(user);
    if(profile?.enabled===false){location.href='index.html';return}
    await loadMeta();
    populateDepartments();
    $('subscriptionDept').onchange=async()=>{
      localStorage.setItem('dadBudgetSubscriptionDept',$('subscriptionDept').value);
      await selectDepartment(false);
    };
    $('subscriptionSearch').oninput=render;
    $('subscriptionDownload').onclick=downloadExcel;
    $('subscriptionUpload').onclick=()=>$('subscriptionUploadInput').click();
    $('subscriptionUploadInput').onchange=async()=>{
      const f=$('subscriptionUploadInput').files?.[0];
      if(!f)return;
      try{
        $('subscriptionUpload').disabled=true;
        setStatus('Validating Jan-Dec Budget 2027...');
        await uploadExcel(f);
      }catch(e){
        console.error(e);
        setStatus(e.message||String(e),true);
        alert('Subscriptions upload rejected: '+(e.message||e));
      }finally{
        $('subscriptionUploadInput').value='';
        $('subscriptionUpload').disabled=!canEdit(clean($('subscriptionDept').value));
      }
    };
    $('subscriptionRefresh').onclick=async()=>{
      try{
        $('subscriptionRefresh').disabled=true;
        cacheClear();
        await loadMeta(true);
        populateDepartments();
        await selectDepartment(true);
        setStatus('Subscriptions refreshed');
      }catch(e){
        setStatus(e.message||String(e),true);
      }finally{
        $('subscriptionRefresh').disabled=false;
      }
    };
    $('logoutBtn').onclick=async()=>{await signOut(auth);location.href='login.html'};
    await selectDepartment(false);
  }catch(e){
    console.error(e);
    setStatus(`Subscriptions could not load: ${e.code||e.message||e}`,true);
  }
}
onAuthStateChanged(auth,boot);
