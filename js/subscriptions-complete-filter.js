import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
let directory=[],profile=null,observer=null,busy=false,admin=false;

function departmentsOf(p={}){
  const out=Array.isArray(p.departments)?p.departments.map(clean).filter(Boolean):[];
  if(p.department&&!out.includes(clean(p.department)))out.push(clean(p.department));
  return out.filter(x=>x&&x!=='ALL'&&!x.startsWith('GROUP:'));
}
function cachedProfile(user){
  try{
    const p=JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null');
    return p&&clean(p.uid)===clean(user?.uid)?p:null;
  }catch(_){return null}
}
async function loadProfile(user){
  const cached=cachedProfile(user);
  if(cached)return cached;
  const snap=await getDoc(doc(db,'users',user.uid));
  return snap.exists()?snap.data()||{}:{};
}
function isAdmin(user,p){
  return !!user&&(user.uid===MAIN_ADMIN_UID||p?.isMainAdmin===true||p?.role==='admin');
}
function add(map,cc,name){
  cc=clean(cc);
  if(!cc||cc==='16'||cc==='ALL'||cc.startsWith('GROUP:'))return;
  name=clean(name||cc);
  const old=map.get(cc);
  if(!old||old.name===old.cc||(/^\d+$/.test(old.name)&&name!==cc))map.set(cc,{cc,name});
}
function canonicalMap(){
  return new Map((window.DADCanonicalDepartmentDirectory||[]).map(x=>[clean(x?.cc),clean(x?.name||x?.cc)]));
}
function addLocal(map,allowed=null){
  try{
    const model=JSON.parse(localStorage.getItem('dadBudgetOPEXBaselineV17')||'null');
    (model?.departmentDirectory||[]).forEach(x=>{if(!allowed||allowed.has(clean(x?.cc)))add(map,x?.cc,x?.name)});
    Object.values(model?.departments||{}).forEach(x=>{if(!allowed||allowed.has(clean(x?.cc)))add(map,x?.cc,x?.name)});
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
  }catch(e){console.warn('Subscriptions shared department directory read skipped',e)}
  (window.DADCanonicalDepartmentDirectory||[]).forEach(x=>add(map,x?.cc,x?.name));
  addLocal(map);
  directory=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
}
function apply(){
  const select=document.getElementById('subscriptionDept');
  if(!select||busy)return;
  busy=true;
  observer?.disconnect();
  try{
    const previous=clean(select.value),allowed=new Set(directory.map(d=>d.cc));
    if(admin){
      const current=[...select.options],known=new Set(current.map(o=>o.value));
      directory.forEach(d=>{
        if(known.has(d.cc)){
          const existing=current.find(o=>o.value===d.cc);
          if(existing)existing.textContent=`${d.cc} · ${d.name}`;
          return;
        }
        const o=document.createElement('option');
        o.value=d.cc;
        o.textContent=`${d.cc} · ${d.name}`;
        select.appendChild(o);
      });
    }else{
      [...select.options].forEach(o=>{if(!allowed.has(clean(o.value)))o.remove()});
      directory.forEach(d=>{
        let o=[...select.options].find(x=>clean(x.value)===d.cc);
        if(!o){o=document.createElement('option');o.value=d.cc;select.appendChild(o)}
        o.textContent=`${d.cc} · ${d.name}`;
      });
    }
    const options=[...select.options].sort((a,b)=>{
      const an=clean(a.textContent).replace(/^\d+\s*·\s*/,'');
      const bn=clean(b.textContent).replace(/^\d+\s*·\s*/,'');
      return an.localeCompare(bn)||a.value.localeCompare(b.value,undefined,{numeric:true});
    });
    options.forEach(o=>select.appendChild(o));
    if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
    else if(select.options.length)select.value=select.options[0].value;
    const changed=previous!==clean(select.value);
    if(changed&&typeof select.onchange==='function')setTimeout(()=>select.dispatchEvent(new Event('change',{bubbles:true})),0);
  }finally{
    busy=false;
    if(observer&&document.body.contains(select))observer.observe(select,{childList:true,subtree:true});
  }
}
function bind(){
  const select=document.getElementById('subscriptionDept');
  if(!select)return false;
  if(!observer){
    observer=new MutationObserver(()=>{if(!busy)setTimeout(apply,0)});
    observer.observe(select,{childList:true,subtree:true});
  }
  apply();
  return true;
}
async function boot(user){
  if(!user)return;
  profile=await loadProfile(user);
  admin=isAdmin(user,profile);
  await loadDirectory();
  let tries=0;
  const timer=setInterval(()=>{tries++;if(bind()||tries>80)clearInterval(timer)},100);
  window.addEventListener('load',()=>setTimeout(apply,250));
}
onAuthStateChanged(auth,user=>boot(user).catch(e=>console.warn('Subscriptions access filter failed',e)));
