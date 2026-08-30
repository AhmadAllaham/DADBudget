import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getFirestore,doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),db=getFirestore(app);
const clean=v=>String(v??'').trim();
let directory=[],observer=null,busy=false;

function add(map,cc,name){
  cc=clean(cc); if(!cc||cc==='16'||cc==='ALL'||cc.startsWith('GROUP:'))return;
  name=clean(name||cc);
  const old=map.get(cc);
  if(!old||old.name===old.cc||(/^\d+$/.test(old.name)&&name!==cc))map.set(cc,{cc,name});
}
function addLocal(map){
  try{
    const model=JSON.parse(localStorage.getItem('dadBudgetOPEXBaselineV17')||'null');
    (model?.departmentDirectory||[]).forEach(x=>add(map,x?.cc,x?.name));
    Object.values(model?.departments||{}).forEach(x=>add(map,x?.cc,x?.name));
  }catch(_){}
}
async function loadDirectory(){
  const map=new Map();
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
  if(!select||!directory.length||busy)return;
  busy=true; observer?.disconnect();
  try{
    const previous=clean(select.value),current=[...select.options],known=new Set(current.map(o=>o.value));
    directory.forEach(d=>{
      if(known.has(d.cc)){
        const existing=current.find(o=>o.value===d.cc);
        if(existing&&(/^[0-9]+\s*·\s*[0-9]+$/.test(existing.textContent)||existing.textContent===d.cc))existing.textContent=`${d.cc} · ${d.name}`;
        return;
      }
      const o=document.createElement('option');
      o.value=d.cc; o.textContent=`${d.cc} · ${d.name}`; select.appendChild(o);
    });
    const options=[...select.options].sort((a,b)=>{
      const an=clean(a.textContent).replace(/^\d+\s*·\s*/,'');
      const bn=clean(b.textContent).replace(/^\d+\s*·\s*/,'');
      return an.localeCompare(bn)||a.value.localeCompare(b.value,undefined,{numeric:true});
    });
    options.forEach(o=>select.appendChild(o));
    if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
  }finally{
    busy=false;
    if(observer&&document.body.contains(select))observer.observe(select,{childList:true,subtree:true});
  }
}
function bind(){
  const select=document.getElementById('subscriptionDept');
  if(!select)return false;
  if(!observer){observer=new MutationObserver(()=>{if(!busy)setTimeout(apply,0)});observer.observe(select,{childList:true,subtree:true});}
  apply(); return true;
}
async function boot(){
  await loadDirectory();
  let tries=0;
  const timer=setInterval(()=>{tries++; if(bind()||tries>80)clearInterval(timer)},100);
  window.addEventListener('load',()=>setTimeout(apply,250));
}
boot();
