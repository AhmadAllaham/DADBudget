import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={
  apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',
  authDomain:'budget-8c575.firebaseapp.com',
  projectId:'budget-8c575',
  storageBucket:'budget-8c575.firebasestorage.app',
  messagingSenderId:'990142203884',
  appId:'1:990142203884:web:5c22dc2c14855528a022c9'
};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const OPEX_KEY='dadBudgetOPEXBaselineV17';
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);

const clean=v=>String(v??'').trim();
function localBaseline(){
  const keys=Object.keys(localStorage).filter(k=>/^dadBudgetOPEXBaselineV\d+$/i.test(k)).sort((a,b)=>Number((b.match(/\d+$/)||[0])[0])-Number((a.match(/\d+$/)||[0])[0]));
  for(const k of keys){try{const m=JSON.parse(localStorage.getItem(k)||'null');if(m?.departments&&Object.keys(m.departments).length)return m}catch(_){}}
  return null;
}
function setDeptMessage(text,error=false){
  const sel=document.getElementById('deptFilter');if(!sel)return;
  sel.innerHTML='';const o=document.createElement('option');o.value='';o.textContent=text;sel.appendChild(o);sel.disabled=true;
  sel.dataset.cloudState=error?'error':'waiting';
}
function buildAccountMaster(departments){
  const out={};Object.values(departments||{}).forEach(d=>Object.values(d?.items||{}).forEach(x=>{const code=clean(x?.code);if(code&&!out[code])out[code]={code,name:clean(x?.name)||code}}));return out;
}
function saveCloudModel(model){
  localStorage.setItem(OPEX_KEY,JSON.stringify(model));
  window.dispatchEvent(new CustomEvent('dad-opex-cloud-ready',{detail:{departments:Object.keys(model.departments||{}).length,fileName:model.fileName||''}}));
  window.dispatchEvent(new CustomEvent('dad-opex-refresh-departments'));
}
async function publishAdmin(user,profile){
  const model=localBaseline();
  if(!model?.departments){setDeptMessage('Admin: upload OPEX baseline first',true);return false}
  const deps=Object.values(model.departments||{}).filter(d=>clean(d?.cc)&&clean(d?.cc)!=='16');
  const directory=deps.map(d=>{const cc=clean(d?.cc),name=clean(d?.name||d?.departmentName||cc)||cc;return{cc,name}}).sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc));
  // Keep the metadata light, but always publish the complete Fund Center directory.
  await Promise.all([
    setDoc(doc(db,'opex_baseline_meta','current'),{
      fileName:model.fileName||'OPEX Baseline',
      mappingInfo:model.mappingInfo||{},
      departmentCount:directory.length,
      departmentDirectory:directory,
      publishedBy:user.uid,
      publishedEmail:(user.email||'').toLowerCase(),
      clientPublishedAt:new Date().toISOString(),
      publishedAt:serverTimestamp(),
      schemaVersion:3
    },{merge:false}),
    setDoc(doc(db,'system_status','department_directory_fy2027'),{
      fiscalYear:2027,
      departmentCount:directory.length,
      directory,
      source:'opex_baseline',
      updatedBy:user.uid,
      updatedByEmail:(user.email||'').toLowerCase(),
      clientUpdatedAt:new Date().toISOString(),
      updatedAt:serverTimestamp()
    },{merge:false})
  ]);
  for(const d of deps){
    const cc=clean(d?.cc);if(!cc)continue;
    const payload={...d,cc};
    const bytes=new Blob([JSON.stringify(payload)]).size;
    if(bytes>900000)throw new Error(`Department ${cc} is too large (${Math.round(bytes/1024)} KB)`);
    await setDoc(doc(db,'opex_baseline_departments',cc),{...payload,cloudUpdatedAt:serverTimestamp()},{merge:false});
  }
  window.dispatchEvent(new CustomEvent('dad-opex-cloud-published',{detail:{departments:directory.length}}));
  return true;
}
async function loadForUser(user,profile){
  const assigned=Array.isArray(profile?.departments)?profile.departments.map(clean).filter(Boolean):(profile?.department?[clean(profile.department)]:[]);
  if(!assigned.length){setDeptMessage('No departments assigned to this user',true);return false}
  const metaSnap=await getDoc(doc(db,'opex_baseline_meta','current'));
  if(!metaSnap.exists()){setDeptMessage('OPEX baseline is not published yet',true);return false}
  const meta=metaSnap.data()||{},departments={},errors=[];
  for(const cc of assigned){
    if(cc==='ALL')continue;
    try{
      const s=await getDoc(doc(db,'opex_baseline_departments',cc));
      if(s.exists()){const d=s.data();departments[cc]={...d,cloudUpdatedAt:undefined}}
      else errors.push(`${cc} not found`);
    }catch(e){errors.push(`${cc}: ${e.code||e.message}`)}
  }
  if(!Object.keys(departments).length){setDeptMessage(errors.length?`Cloud error: ${errors.join(' | ')}`:'No assigned OPEX department found',true);return false}
  const model={
    fileName:meta.fileName||'Cloud OPEX Baseline',
    mappingInfo:meta.mappingInfo||{},
    departmentDirectory:Array.isArray(meta.departmentDirectory)?meta.departmentDirectory:[],
    departments,
    accountMaster:buildAccountMaster(departments),
    cloud:true,
    cloudPublishedAt:meta.clientPublishedAt||''
  };
  saveCloudModel(model);
  return true;
}
async function run(user){
  if(!user)return;
  try{
    const ps=await getDoc(doc(db,'users',user.uid));
    if(!ps.exists()){setDeptMessage('User profile not found in Firestore',true);return}
    const profile=ps.data()||{},isAdmin=user.uid===MAIN_ADMIN_UID||profile.isMainAdmin===true||profile.role==='admin';
    setDeptMessage(isAdmin?'Publishing shared OPEX baseline...':'Loading your OPEX departments...');
    if(isAdmin)await publishAdmin(user,profile);else await loadForUser(user,profile);
  }catch(e){
    console.error('OPEX cloud bootstrap failed',e);
    setDeptMessage(`Cloud error: ${e.code||e.message||'Unknown error'}`,true);
    window.dispatchEvent(new CustomEvent('dad-opex-cloud-error',{detail:{message:e.message||String(e),code:e.code||''}}));
  }
}

onAuthStateChanged(auth,user=>{if(user)run(user)});
window.addEventListener('dad-user-ready',e=>{const user=e.detail?.user||auth.currentUser;if(user)run(user)});
