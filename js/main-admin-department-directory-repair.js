(function(){
'use strict';
const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',DIR_DOC='department_directory_fy2027',SESSION_KEY='dadBudgetDirectoryRepairV2',DASH_CACHE='dadBudgetDashboardSubmissionCacheV1';
const clean=v=>String(v??'').trim(),num=v=>Number.isFinite(Number(v))?Number(v):0,fmt=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
let inFlight=false,dashboardRefreshPromise=null;
function bytesFromBase64(text){const binary=atob(text||''),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out}
async function decodePayload(data,cc=''){
  if(!data)return null;
  try{
    if(data.encoding==='json-v1')return {...JSON.parse(data.payload||'{}'),cc:cc||data.cc};
    if(data.encoding==='gzip-base64-v1'&&typeof DecompressionStream!=='undefined'){
      const stream=new Blob([bytesFromBase64(data.payload||'')]).stream().pipeThrough(new DecompressionStream('gzip'));
      return {...JSON.parse(await new Response(stream).text()),cc:cc||data.cc};
    }
  }catch(e){console.warn('Dashboard payload decode failed',cc,e)}
  return data;
}
async function payloadName(data,cc){
  const direct=clean(data?.name||data?.departmentName);if(direct&&direct!==cc)return direct;
  try{return clean((await decodePayload(data,cc))?.name)||direct||cc}catch(_){return direct||cc}
}
function approved(data={}){const state=clean(data.workflowStatus||data.status||data.financeStatus).toLowerCase();return data.directAdminEntry===true||state==='approved'}
function opexTotal(data={}){return Object.values(data.items||{}).reduce((sum,item)=>sum+Object.entries(item?.newBudgetByMonth||{}).reduce((s,[k,v])=>String(k).startsWith('2027-')?s+num(v):s,0),0)}
function capexTotal(data={}){if(Number.isFinite(Number(data.total)))return Number(data.total);return (data.rows||[]).reduce((s,r)=>s+num(r?.total),0)}
function findKpi(title){return [...document.querySelectorAll('.kpi-card')].find(x=>clean(x.querySelector('span')?.textContent)===title)}
function applyAdminDashboardTotals(result){
  const ok=findKpi('Total OPEX'),ck=findKpi('Total CAPEX');
  if(ok){ok.querySelector('strong').textContent=result.opexCount?fmt(result.opexTotal):'—';ok.querySelector('small').textContent=`${result.opexCount} Finance Approved`}
  if(ck){ck.querySelector('strong').textContent=result.capexCount?fmt(result.capexTotal):'—';ck.querySelector('small').textContent=`${result.capexCount} Finance Approved`}
  try{sessionStorage.removeItem(DASH_CACHE)}catch(_){ }
}
async function refreshAdminDashboard(user){
  if(!user||user.uid!==MAIN||dashboardRefreshPromise||!/index\.html$|\/$/i.test(location.pathname))return dashboardRefreshPromise;
  const api=window.DADFirebase;if(!api?.db)return;
  dashboardRefreshPromise=(async()=>{
    const f=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');
    const [opexSnap,capexSnap]=await Promise.all([
      f.getDocs(f.collection(api.db,'opex_budget_submissions')),
      f.getDocs(f.collection(api.db,'capex_budget_submissions'))
    ]);
    let opexSum=0,capexSum=0,opexCount=0,capexCount=0;
    for(const s of opexSnap.docs){const raw=s.data()||{};if(!approved(raw))continue;const decoded=await decodePayload(raw,s.id);opexSum+=opexTotal(decoded||raw);opexCount++}
    capexSnap.forEach(s=>{const raw=s.data()||{};if(!approved(raw))return;capexSum+=capexTotal(raw);capexCount++});
    const result={opexTotal:opexSum,capexTotal:capexSum,opexCount,capexCount};
    applyAdminDashboardTotals(result);
    setTimeout(()=>applyAdminDashboardTotals(result),900);
    setTimeout(()=>applyAdminDashboardTotals(result),2200);
    window.dispatchEvent(new CustomEvent('dad-dashboard-admin-refreshed',{detail:result}));
    return result
  })().catch(err=>console.warn('Admin dashboard refresh failed',err)).finally(()=>{dashboardRefreshPromise=null});
  return dashboardRefreshPromise
}
async function repair(user,profile={}){
  if(!user||user.uid!==MAIN||inFlight||sessionStorage.getItem(SESSION_KEY)==='1')return;
  const api=window.DADFirebase;if(!api?.db)return;inFlight=true;
  try{
    const f=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');
    const [metaSnap,dirSnap]=await Promise.all([
      f.getDoc(f.doc(api.db,'opex_baseline_meta','current')),
      f.getDoc(f.doc(api.db,'system_status',DIR_DOC))
    ]);
    const expected=Math.max(0,Number(metaSnap.data()?.departmentCount||0)),sharedCount=Math.max(0,Number(dirSnap.data()?.departmentCount||0)),metaDirectory=Array.isArray(metaSnap.data()?.departmentDirectory)?metaSnap.data().departmentDirectory:[];
    if(expected&&metaDirectory.length>=expected&&sharedCount>=expected){sessionStorage.setItem(SESSION_KEY,'1');return}
    const snap=await f.getDocs(f.collection(api.db,'opex_baseline_departments'));
    if(!snap.docs.length)return;
    const directory=[];
    for(const docSnap of snap.docs){const cc=clean(docSnap.id);if(!cc||cc==='16')continue;directory.push({cc,name:await payloadName(docSnap.data()||{},cc)})}
    directory.sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
    const ids=directory.map(x=>x.cc);
    await Promise.all([
      f.setDoc(f.doc(api.db,'system_status',DIR_DOC),{fiscalYear:2027,departmentCount:directory.length,directory,source:'Canonical Finance OPEX baseline',updatedBy:user.uid,updatedByEmail:clean(user.email||profile.email).toLowerCase(),updatedAt:f.serverTimestamp(),clientUpdatedAt:new Date().toISOString()},{merge:false}),
      f.setDoc(f.doc(api.db,'opex_baseline_meta','current'),{departments:ids,departmentDirectory:directory,departmentCount:directory.length,directoryUpdatedAt:f.serverTimestamp()},{merge:true})
    ]);
    sessionStorage.setItem(SESSION_KEY,'1');
    window.dispatchEvent(new CustomEvent('dad-department-directory-repaired',{detail:{count:directory.length}}));
    console.info(`Department directory repaired from Finance OPEX baseline · ${directory.length} Fund Centers`);
  }finally{inFlight=false}
}
function handleReady(user,profile={}){repair(user,profile).catch(err=>console.warn('Department directory repair failed',err));setTimeout(()=>refreshAdminDashboard(user),350)}
window.addEventListener('dad-user-ready',e=>handleReady(e.detail?.user||window.DADFirebase?.auth?.currentUser,e.detail?.profile||{}));
window.addEventListener('dad-firebase-ready',()=>{const user=window.DADFirebase?.auth?.currentUser;if(user)handleReady(user,{})});
window.addEventListener('pageshow',()=>{const user=window.DADFirebase?.auth?.currentUser;if(user)setTimeout(()=>refreshAdminDashboard(user),500)});
})();
