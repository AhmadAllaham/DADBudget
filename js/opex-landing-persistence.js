import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const KEY='dadBudgetOPEXBaselineV17';
const clean=v=>String(v??'').trim();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
let syncing=false,timer=0,lastSyncAt=0;

function localModel(){try{const model=JSON.parse(localStorage.getItem(KEY)||'null');return model?.departments?model:null}catch(_){return null}}
function profile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||{}}catch(_){return{}}}
function isAdmin(p){return p?.isMainAdmin===true||p?.role==='admin'}
function extractLanding(department){const out={};Object.entries(department?.items||{}).forEach(([key,item])=>{const code=clean(item?.code||key);if(code)out[code]=num(item?.landing)});return out}
function bytesFromBase64(value){const raw=atob(value||''),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function decodeSubmission(data={}){if(!data?.payload)return data;if(data.encoding==='gzip-base64-v1'){if(typeof DecompressionStream==='undefined')return null;const stream=new Blob([bytesFromBase64(data.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text())}if(data.encoding==='json-v1')return JSON.parse(data.payload||'{}');return data}
async function landingMapFor(data,admin){
  const workflow=clean(data?.workflowStatus||data?.status).toLowerCase();
  if(admin&&workflow!=='approved'){
    const approved=data?.financeApprovedLandingByGl;
    return approved&&typeof approved==='object'?approved:null;
  }
  if(data?.landingByGl&&typeof data.landingByGl==='object')return data.landingByGl;
  const parsed=await decodeSubmission(data);
  return parsed?.items?extractLanding(parsed):null;
}
function applyLanding(department,map){let changed=false;if(!department||!map)return false;Object.entries(map).forEach(([rawCode,value])=>{const code=clean(rawCode);if(!code||code.startsWith('608'))return;const key=department.items?.[code]?code:Object.keys(department.items||{}).find(k=>clean(department.items[k]?.code||k)===code);if(!key)return;const next=num(value);if(num(department.items[key]?.landing)!==next){department.items[key]={...department.items[key],landing:next};changed=true}});return changed}
async function services(){if(!getApps().length)return null;const app=getApps()[0];return{auth:getAuth(app),db:getFirestore(app)}}
async function persistCurrentLanding(cc){
  const svc=await services();if(!svc?.auth.currentUser||!cc)return;
  const model=localModel(),department=model?.departments?.[cc];if(!department)return;
  await setDoc(doc(svc.db,'opex_budget_submissions',cc),{landingByGl:extractLanding(department),landingMappedAt:serverTimestamp()},{merge:true});
}
async function syncLandingToLocal(){
  if(syncing)return;const now=Date.now();if(now-lastSyncAt<300)return;
  const svc=await services(),model=localModel();if(!svc?.auth.currentUser||!model?.departments)return;
  syncing=true;lastSyncAt=now;
  try{
    const admin=isAdmin(profile()),entries=Object.entries(model.departments||{}),updates=[];
    for(let start=0;start<entries.length;start+=8){
      const chunk=entries.slice(start,start+8);
      const rows=await Promise.all(chunk.map(async([cc,department])=>{try{const snap=await getDoc(doc(svc.db,'opex_budget_submissions',cc));if(!snap.exists())return false;const map=await landingMapFor(snap.data()||{},admin);return applyLanding(department,map)}catch(error){console.warn('OPEX landing restore skipped',cc,error);return false}}));
      updates.push(...rows)
    }
    if(updates.some(Boolean)){
      localStorage.setItem(KEY,JSON.stringify(model));
      document.getElementById('deptFilter')?.dispatchEvent(new Event('change',{bubbles:true}));
      window.dispatchEvent(new CustomEvent('dad-opex-landing-restored'))
    }
  }finally{syncing=false}
}
function scheduleSync(delay=60){clearTimeout(timer);timer=setTimeout(()=>syncLandingToLocal().catch(error=>console.warn('OPEX landing sync failed',error)),delay)}

window.addEventListener('dad-opex-submission-saved',event=>{const cc=clean(event.detail?.cc);persistCurrentLanding(cc).then(()=>scheduleSync(20)).catch(error=>console.warn('OPEX landing save failed',error))});
window.addEventListener('dad-opex-cloud-ready',()=>scheduleSync(80));
window.addEventListener('dad-user-ready',()=>scheduleSync(120));
window.addEventListener('focus',()=>scheduleSync(80));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scheduleSync(180));else scheduleSync(180);
