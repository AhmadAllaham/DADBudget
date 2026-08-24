import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0];
if(!app)throw new Error('Firebase app is not initialized');
const auth=getAuth(app),db=getFirestore(app),OPEX_KEY='dadBudgetOPEXBaselineV17',PLAN_ID='utilities_budget_fy2027',CACHE_KEY='dadBudgetUtilitiesPlanCacheV1',CACHE_MS=10*60*1000,ENGINEERING_CC='100100301';
const clean=v=>String(v??'').trim(),num=v=>Number.isFinite(Number(v))?Number(v):0;
let active=false,lastAppliedToken='';

function readModel(){try{const m=JSON.parse(localStorage.getItem(OPEX_KEY)||'null');return m?.departments?m:null}catch(_){return null}}
function readCache(){try{const x=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null');return x&&Date.now()-num(x.ts)<CACHE_MS?x.plan||null:null}catch(_){return null}}
function writeCache(plan){try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),plan}))}catch(_){}}
function clearCache(){try{sessionStorage.removeItem(CACHE_KEY)}catch(_){}}
async function getPlan(force=false){const cached=!force&&readCache();if(cached)return cached;const snap=await getDoc(doc(db,'system_status',PLAN_ID));const plan=snap.exists()?snap.data()||{}:{rows:[],revision:0};writeCache(plan);return plan}
function tokenFor(plan,model){return `${num(plan?.revision)}|${clean(plan?.clientUpdatedAt)}|${clean(model?.baselineVersion)}|${clean(model?.fileName)}`}
function emptyUtilityItem(item,code){return{...(item||{}),code:clean(item?.code||code),newBudgetByMonth:{},landing:0,utilityControlled:true,utilitySourceCc:ENGINEERING_CC,utilityDetails:''}}
function applyPlan(model,plan){const rows=Array.isArray(plan?.rows)?plan.rows:[],byCc={};rows.forEach(r=>{const cc=clean(r?.cc),gl=clean(r?.gl);if(!cc||!gl.startsWith('608'))return;(byCc[cc]||(byCc[cc]=[])).push(r)});Object.values(model.departments||{}).forEach(department=>{const cc=clean(department?.cc);if(!cc)return;department.items={...(department.items||{})};Object.entries(department.items).forEach(([key,item])=>{const code=clean(item?.code||key);if(code.startsWith('608'))department.items[key]=emptyUtilityItem(item,code)});(byCc[cc]||[]).forEach(r=>{const code=clean(r.gl),existing=department.items[code]||Object.values(department.items).find(x=>clean(x?.code)===code)||{};department.items[code]={...existing,code,name:clean(existing?.name||r?.accountName)||code,newBudgetByMonth:{...(r?.newBudgetByMonth||{})},landing:num(r?.landing),utilityControlled:true,utilitySourceCc:ENGINEERING_CC,utilityDetails:clean(r?.details)}})});model.utilitiesRevision=num(plan?.revision);model.utilitiesUpdatedAt=clean(plan?.clientUpdatedAt);return model}
function persist(model){try{localStorage.setItem(OPEX_KEY,JSON.stringify(model));window.dispatchEvent(new CustomEvent('dad-opex-refresh-departments'));const select=document.getElementById('deptFilter');if(select)select.dispatchEvent(new Event('change',{bubbles:true}))}catch(error){console.warn('Utilities OPEX local sync failed',error)}}
async function sync(force=false){if(active||!auth.currentUser)return;const model=readModel();if(!model)return;active=true;try{const plan=await getPlan(force),token=tokenFor(plan,model);if(!force&&token===lastAppliedToken)return;persist(applyPlan(model,plan));lastAppliedToken=token}catch(error){console.warn('Utilities OPEX sync skipped',error)}finally{active=false}}

onAuthStateChanged(auth,user=>{if(user)setTimeout(()=>sync(false),250)});
window.addEventListener('dad-opex-cloud-ready',()=>setTimeout(()=>sync(false),60));
window.addEventListener('dad-utilities-budget-updated',()=>{clearCache();setTimeout(()=>sync(true),20)});
window.addEventListener('storage',event=>{if(event.key==='dadBudgetUtilitiesRefreshToken'){clearCache();setTimeout(()=>sync(true),40)}});
