import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,collection,query,orderBy,startAt,endAt,documentId,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const OPEX_KEY='dadBudgetOPEXBaselineV17',DOC_PREFIX='subscription_budget_';
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim(),num=v=>Number.isFinite(Number(v))?Number(v):0,key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const DEPARTMENT_ALIASES={'100100301':'1000100301'},normalizeCc=v=>DEPARTMENT_ALIASES[clean(v)]||clean(v);
let profile=null,unsubs=[],plans=new Map(),applying=false,renderQueued=false,selectBound=false;

function readModel(){try{const m=JSON.parse(localStorage.getItem(OPEX_KEY)||'null');return m?.departments?m:null}catch(_){return null}}
function cachedProfile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||null}catch(_){return null}}
function departmentsOf(p={}){const out=Array.isArray(p?.departments)?p.departments.map(normalizeCc).filter(Boolean):[],primary=normalizeCc(p?.department);if(primary&&!out.includes(primary))out.push(primary);return[...new Set(out)]}
function isAdmin(user=auth.currentUser,p=profile){return!!user&&(user.uid===MAIN_ADMIN_UID||p?.isMainAdmin===true||p?.role==='admin')}
function normalizePlan(raw={},cc=''){return{...raw,cc:normalizeCc(raw?.cc||cc),rows:Array.isArray(raw?.rows)?raw.rows:[],items:raw?.items&&typeof raw.items==='object'?raw.items:{}}}
function subscriptionMatch(item={},raw=''){const code=clean(item?.code||raw),name=key(item?.name||item?.accountName);return['6140006','6141410'].includes(code)||(name.includes('SUBSCRIPTION')&&(name.includes('BOOK')||name.includes('MAGAZINE')))}
function monthMap(map={}){const out={};Object.entries(map||{}).forEach(([m,v])=>out[m]=num(v));return out}
function addMaps(a={},b={}){const out={};new Set([...Object.keys(a||{}),...Object.keys(b||{})]).forEach(m=>out[m]=num(a?.[m])+num(b?.[m]));return out}
function mapsEqual(a={},b={}){const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);for(const m of keys)if(Math.abs(num(a?.[m])-num(b?.[m]))>.00001)return false;return true}
function planItems(plan={}){if(plan?.items&&Object.keys(plan.items).length)return plan.items;const out={};(plan?.rows||[]).forEach(r=>{const gl=clean(r?.gl);if(!gl)return;const x=out[gl]||(out[gl]={code:gl,name:clean(r?.accountName||gl),landing:0,newBudgetByMonth:{}});x.landing+=num(r?.landing);Object.entries(r?.newBudgetByMonth||{}).forEach(([m,v])=>x.newBudgetByMonth[m]=num(x.newBudgetByMonth[m])+num(v))});return out}
function planDetails(plan,gl){return(plan?.rows||[]).filter(r=>clean(r?.gl)===gl).map(r=>clean(r?.details)).filter(Boolean).join(' | ')}

function projectDepartment(department,plan){
  if(!department)return{department,changed:false};
  const merged={...department,items:{...(department.items||{})}},incoming=planItems(plan||{}),touched=new Set();
  let changed=false;
  Object.entries(incoming).forEach(([raw,v])=>{
    const gl=clean(v?.code||raw);if(!gl)return;touched.add(gl);
    let targetKey=Object.keys(merged.items).find(k=>clean(merged.items[k]?.code||k)===gl);
    if(!targetKey)targetKey=gl;
    const existing=merged.items[targetKey]||{code:gl,name:clean(v?.name||gl),budgetByMonth:{},actualByMonth:{},lyByMonth:{},newBudgetByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};
    const departmentMonths=monthMap(v?.newBudgetByMonth||{}),itMonths=monthMap(existing?.itSubscriptionAllocatedByMonth||{}),combined=addMaps(departmentMonths,itMonths),landing=num(v?.landing),details=planDetails(plan,gl);
    const needs=existing.subscriptionControlled!==true||!mapsEqual(existing.departmentSubscriptionByMonth||{},departmentMonths)||!mapsEqual(existing.newBudgetByMonth||{},combined)||Math.abs(num(existing.departmentSubscriptionLanding)-landing)>.00001||clean(existing.subscriptionDetails)!==details;
    if(!needs)return;
    merged.items[targetKey]={...existing,code:clean(existing?.code||gl),name:clean(existing?.name||v?.name)||'Subscriptions, Books and Magazines',landing,newBudgetByMonth:combined,departmentSubscriptionByMonth:departmentMonths,departmentSubscriptionLanding:landing,subscriptionControlled:true,subscriptionSource:'department',subscriptionDetails:details,subscriptionDetailsCount:(plan?.rows||[]).filter(r=>clean(r?.gl)===gl).length};
    changed=true;
  });
  Object.entries(merged.items).forEach(([k,item])=>{
    if(item?.subscriptionControlled!==true)return;
    const code=clean(item?.code||k);if(touched.has(code))return;
    const itMonths=monthMap(item?.itSubscriptionAllocatedByMonth||{});
    const needs=Math.abs(num(item?.departmentSubscriptionLanding))>.00001||Object.values(item?.departmentSubscriptionByMonth||{}).some(v=>Math.abs(num(v))>.00001)||!mapsEqual(item?.newBudgetByMonth||{},itMonths);
    if(!needs)return;
    merged.items[k]={...item,landing:0,newBudgetByMonth:itMonths,departmentSubscriptionByMonth:{},departmentSubscriptionLanding:0,subscriptionDetails:'',subscriptionDetailsCount:0};changed=true;
  });
  if(plan)merged.subscriptionRows=(plan.rows||[]).map(r=>({...r,newBudgetByMonth:monthMap(r?.newBudgetByMonth||{})}));
  return{department:merged,changed};
}

function projectCurrentModel(){
  if(applying)return false;const model=readModel();if(!model?.departments)return false;applying=true;let changed=false;
  try{
    Object.entries(model.departments).forEach(([rawCc,department])=>{const cc=normalizeCc(rawCc),plan=plans.get(cc)||null;if(!plan&&!Object.values(department?.items||{}).some(item=>item?.subscriptionControlled===true))return;const result=projectDepartment(department,plan);if(result.changed){model.departments[rawCc]=result.department;changed=true}});
    if(changed)localStorage.setItem(OPEX_KEY,JSON.stringify(model));
  }catch(e){console.warn('Subscriptions OPEX projection failed',e)}finally{applying=false}
  return changed;
}
function queueRender(){if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;const select=document.getElementById('deptFilter');if(select)select.dispatchEvent(new Event('change',{bubbles:true}))})}
function projectAndRender(){if(projectCurrentModel())queueRender()}
function bindSelect(){if(selectBound)return;const select=document.getElementById('deptFilter');if(!select){setTimeout(bindSelect,80);return}selectBound=true;select.addEventListener('change',()=>{projectCurrentModel()},true)}
function putPlan(cc,data){cc=normalizeCc(cc);if(!cc)return;plans.set(cc,normalizePlan(data||{},cc))}
function removePlan(cc){cc=normalizeCc(cc);if(cc)plans.delete(cc)}

function watchPlans(){
  unsubs.forEach(fn=>{try{fn()}catch(_){}});unsubs=[];
  if(!auth.currentUser)return;
  if(isAdmin()){
    const q=query(collection(db,'system_status'),orderBy(documentId()),startAt(DOC_PREFIX),endAt(`${DOC_PREFIX}\uf8ff`));
    unsubs.push(onSnapshot(q,snap=>{snap.docChanges().forEach(change=>{const id=clean(change.doc.id);if(!id.startsWith(DOC_PREFIX))return;const cc=normalizeCc(id.slice(DOC_PREFIX.length));if(!cc||cc==='refresh_fy2027')return;if(change.type==='removed')removePlan(cc);else putPlan(cc,change.doc.data()||{})});projectAndRender()},e=>console.warn('Subscriptions OPEX source watch failed',e)));
  }else{
    departmentsOf(profile).filter(cc=>cc&&cc!=='ALL'&&!cc.startsWith('GROUP:')).forEach(cc=>unsubs.push(onSnapshot(doc(db,'system_status',`${DOC_PREFIX}${cc}`),snap=>{if(snap.exists())putPlan(cc,snap.data()||{});else removePlan(cc);projectAndRender()},e=>console.warn('Subscriptions OPEX department watch failed',cc,e))));
  }
}
async function loadProfile(user){const local=cachedProfile();if(local&&clean(local.uid)===user.uid)return local;const snap=await getDoc(doc(db,'users',user.uid));return snap.exists()?snap.data()||{}:{}}
async function boot(user){if(!user)return;try{profile=await loadProfile(user);bindSelect();watchPlans();projectAndRender()}catch(e){console.warn('Subscriptions OPEX source failed to start',e)}}

onAuthStateChanged(auth,boot);
// OPEX rebuilds its canonical baseline/submission model through opex-sync-v2.
// Re-project subscriptions synchronously after every canonical rebuild so there is one stable final view.
window.addEventListener('dad-opex-cloud-ready',projectAndRender);
window.addEventListener('dad-opex-baseline-published',projectAndRender);
window.addEventListener('dad-opex-submission-saved',projectAndRender);
window.addEventListener('dad-subscriptions-updated',projectAndRender);
