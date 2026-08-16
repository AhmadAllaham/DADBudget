import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, setDoc, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={
  apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',
  storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'
};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2',MAIN_ADMIN_EMAIL='allaham@dadgroup.com';
const ALL_MODULES=['dashboard','opex','capex','travel','hr','ap','ims','pl','approvals','data_admin'];
const PROFILE_KEY='dadBudgetCurrentProfile',OPEX_KEY='dadBudgetOPEXBaselineV17';
const OPEX_PAGES=new Set(['opex.html','opex-summary.html','travel-budget.html','hr-budget.html','ap-budget.html']);
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);

const pathNow=()=>((location.pathname.split('/').pop()||'index.html').toLowerCase());
const clean=v=>String(v??'').trim();
const isAdminProfile=p=>p?.isMainAdmin===true||p?.role==='admin';
function departmentsOf(p){return Array.isArray(p?.departments)?p.departments.map(clean).filter(Boolean):(p?.department?[clean(p.department)]:[])}

async function getProfile(uid){const s=await getDoc(doc(db,'users',uid));return s.exists()?{id:s.id,...s.data()}:null}
async function ensureMainAdminProfile(user){
  if(!user||user.uid!==MAIN_ADMIN_UID)return;
  await setDoc(doc(db,'users',user.uid),{uid:user.uid,email:(user.email||MAIN_ADMIN_EMAIL).toLowerCase(),role:'admin',isMainAdmin:true,enabled:true,department:'ALL',departments:['ALL'],departmentLabel:'All Departments',departmentLabels:['All Departments'],modules:ALL_MODULES,updatedAt:serverTimestamp()},{merge:true});
}
function cleanUserProfile(uid,p={}){
  const main=uid===MAIN_ADMIN_UID,departments=main?['ALL']:[...new Set(departmentsOf(p))],labels=main?['All Departments']:(Array.isArray(p.departmentLabels)?p.departmentLabels.map(clean).filter(Boolean):(p.departmentLabel?[clean(p.departmentLabel)]:[]));
  return{uid,email:clean(p.email).toLowerCase(),role:main?'admin':clean(p.role||'department_user'),isMainAdmin:main,enabled:main?true:p.enabled!==false,department:main?'ALL':(departments[0]||''),departments,departmentLabel:main?'All Departments':(labels[0]||'Not Restricted'),departmentLabels:labels,modules:main?ALL_MODULES:(Array.isArray(p.modules)?p.modules:[]),updatedAt:serverTimestamp()};
}
function clearSession(){localStorage.removeItem('dadBudgetCurrentUid');localStorage.removeItem('dadBudgetCurrentEmail');localStorage.removeItem(PROFILE_KEY)}
function cacheSession(user,p){localStorage.setItem('dadBudgetCurrentUid',user.uid);localStorage.setItem('dadBudgetCurrentEmail',(user.email||'').toLowerCase());localStorage.setItem(PROFILE_KEY,JSON.stringify({uid:user.uid,email:(user.email||'').toLowerCase(),role:p.role||'',isMainAdmin:!!p.isMainAdmin,enabled:p.enabled!==false,department:p.department||'',departments:departmentsOf(p),departmentLabel:p.departmentLabel||'',departmentLabels:Array.isArray(p.departmentLabels)?p.departmentLabels:[],modules:Array.isArray(p.modules)?p.modules:[]}))}

function moduleForPath(p){
  if(!p||p==='index.html')return'dashboard';if(p==='ims-sales.html')return'ims';if(p==='capex.html')return'capex';if(p==='travel-budget.html')return'travel';if(p==='hr-budget.html')return'hr';if(p==='ap-budget.html')return'ap';if(p==='data-admin.html')return'data_admin';if(p==='user-settings.html'||p==='activity-log.html')return'admin_only';if(p==='opex.html'||p==='opex-summary.html')return'opex';return'';
}
function moduleForLink(a){const h=(a.getAttribute('href')||'').split('?')[0].toLowerCase(),t=(a.textContent||'').trim().toLowerCase();if(h.includes('user-settings')||h.includes('activity-log'))return'admin_only';if(h.includes('data-admin'))return'data_admin';if(h.includes('ims-sales'))return'ims';if(h.includes('capex'))return'capex';if(h.includes('travel-budget'))return'travel';if(h.includes('hr-budget'))return'hr';if(h.includes('ap-budget'))return'ap';if(h.includes('opex'))return'opex';if(h.includes('index'))return'dashboard';if(t.includes('p&l'))return'pl';if(t.includes('approval'))return'approvals';return''}
function applyUserAccess(p){
  const admin=isAdminProfile(p),mods=new Set(Array.isArray(p.modules)?p.modules:[]),nav=document.querySelector('.sidebar-nav');
  if(nav&&admin&&!nav.querySelector('a[href="activity-log.html"]')){const a=document.createElement('a');a.href='activity-log.html';a.textContent='Activity Log';const anchor=nav.querySelector('a[href="user-settings.html"]')||nav.querySelector('a[href="data-admin.html"]');anchor?anchor.after(a):nav.appendChild(a)}
  nav?.querySelectorAll('a').forEach(a=>{const r=moduleForLink(a);if(!r)return;a.style.display=r==='admin_only'?(admin?'':'none'):((admin||mods.has(r))?'':'none')});
  const required=moduleForPath(pathNow());if(required&&!(admin||(required!=='admin_only'&&mods.has(required)))&&pathNow()!=='index.html'){location.replace('index.html');return}
  const out=document.getElementById('logoutBtn');if(out){let b=document.getElementById('currentUserBadge');if(!b){b=document.createElement('div');b.id='currentUserBadge';b.style.cssText='display:flex;flex-direction:column;align-items:flex-end;margin-left:auto;margin-right:8px;font-size:10px;line-height:1.35;color:#557076';out.parentNode?.insertBefore(b,out)}b.innerHTML=`<b style="color:#163f46">${p.email||''}</b><span>${p.role||''}</span>`}
}
function setupLogout(){const b=document.getElementById('logoutBtn');if(!b||b.dataset.fbLogout)return;b.dataset.fbLogout='1';b.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();try{await signOut(auth)}catch(_){}clearSession();location.replace('login.html')},true)}

function setDeptMessage(text,error=false){const s=document.getElementById('deptFilter');if(!s)return;s.innerHTML='';const o=document.createElement('option');o.value='';o.textContent=text;s.appendChild(o);s.disabled=true;s.dataset.cloudState=error?'error':'waiting'}
function localOpex(){const keys=Object.keys(localStorage).filter(k=>/^dadBudgetOPEXBaselineV\d+$/i.test(k)).sort((a,b)=>Number((b.match(/\d+$/)||[0])[0])-Number((a.match(/\d+$/)||[0])[0]));for(const k of keys){try{const m=JSON.parse(localStorage.getItem(k)||'null');if(m?.departments&&Object.keys(m.departments).length)return m}catch(_){}}return null}
function rebuildMaster(deps){const out={};Object.values(deps||{}).forEach(d=>Object.values(d?.items||{}).forEach(x=>{const c=clean(x?.code);if(c&&!out[c])out[c]={code:c,name:clean(x?.name)||c}}));return out}
function saveOpexLocal(m){localStorage.setItem(OPEX_KEY,JSON.stringify(m));window.dispatchEvent(new CustomEvent('dad-opex-cloud-ready',{detail:{departments:Object.keys(m.departments||{}).length,fileName:m.fileName||''}}));window.dispatchEvent(new CustomEvent('dad-opex-refresh-departments'))}
async function publishOpexBaseline(model){
  if(!auth.currentUser||auth.currentUser.uid!==MAIN_ADMIN_UID)throw new Error('Only Main Admin can publish the OPEX baseline.');if(!model?.departments)throw new Error('No OPEX baseline found.');
  const deps=Object.values(model.departments||{});
  await setDoc(doc(db,'opex_baseline_meta','current'),{fileName:model.fileName||'OPEX Baseline',mappingInfo:model.mappingInfo||{},departmentCount:deps.length,publishedBy:auth.currentUser.uid,publishedEmail:(auth.currentUser.email||'').toLowerCase(),publishedAt:serverTimestamp(),clientPublishedAt:new Date().toISOString(),schemaVersion:2},{merge:false});
  for(const d of deps){const cc=clean(d?.cc);if(!cc)continue;const payload={...d,cc};const bytes=new Blob([JSON.stringify(payload)]).size;if(bytes>900000)throw new Error(`Department ${cc} is too large for Firestore (${Math.round(bytes/1024)} KB).`);await setDoc(doc(db,'opex_baseline_departments',cc),{...payload,cloudUpdatedAt:serverTimestamp()},{merge:false})}
  return{departments:deps.length,fileName:model.fileName||''};
}
async function loadCloudOpexBaseline(p){
  if(!auth.currentUser)return null;const metaSnap=await getDoc(doc(db,'opex_baseline_meta','current'));if(!metaSnap.exists())throw new Error('OPEX baseline is not published yet. Open OPEX once with the Main Admin account.');
  const meta=metaSnap.data()||{},admin=isAdminProfile(p),assigned=departmentsOf(p),deps={};
  if(admin||assigned.includes('ALL')){const s=await getDocs(collection(db,'opex_baseline_departments'));s.forEach(x=>{const d=x.data();deps[clean(d.cc||x.id)]={...d,cloudUpdatedAt:undefined}})}
  else{
    if(!assigned.length)throw new Error('No departments are assigned to this user.');
    const errors=[];for(const cc of assigned){try{const s=await getDoc(doc(db,'opex_baseline_departments',cc));if(s.exists()){const d=s.data();deps[cc]={...d,cloudUpdatedAt:undefined}}else errors.push(`${cc} not found`)}catch(e){errors.push(`${cc}: ${e.code||e.message}`)}}
    if(!Object.keys(deps).length)throw new Error(errors.length?errors.join(' | '):'No assigned OPEX departments were found.');
  }
  return{fileName:meta.fileName||'Cloud OPEX Baseline',mappingInfo:meta.mappingInfo||{},departments:deps,accountMaster:rebuildMaster(deps),cloud:true,cloudPublishedAt:meta.clientPublishedAt||''};
}
function applyDepartmentFilter(p){
  if(!OPEX_PAGES.has(pathNow())||isAdminProfile(p)||departmentsOf(p).includes('ALL'))return;
  const allowed=departmentsOf(p),set=new Set(allowed),sel=document.getElementById('deptFilter'),m=localOpex();if(!sel)return;
  if(!m?.departments){setDeptMessage('Waiting for shared OPEX baseline...');return}
  const list=Object.values(m.departments).filter(d=>set.has(clean(d.cc))).sort((a,b)=>clean(a.name||a.cc).localeCompare(clean(b.name||b.cc)));
  if(!list.length){setDeptMessage('No assigned department found in shared OPEX baseline',true);return}
  const old=sel.value;sel.innerHTML='';list.forEach(d=>{const o=document.createElement('option');o.value=clean(d.cc);o.textContent=`${clean(d.cc)} · ${clean(d.name||d.cc)}`;sel.appendChild(o)});sel.value=set.has(old)&&m.departments[old]?old:(allowed.find(x=>m.departments[x])||clean(list[0].cc));sel.disabled=list.length===1;localStorage.setItem('dadBudgetOPEXSelectedDept',sel.value);sel.dispatchEvent(new Event('change',{bubbles:true}));
}
async function syncOpex(p){
  if(!OPEX_PAGES.has(pathNow()))return;
  try{
    if(isAdminProfile(p)){
      const local=localOpex();if(local?.departments){setDeptMessage('Publishing shared OPEX baseline...');await publishOpexBaseline(local);window.dispatchEvent(new CustomEvent('dad-opex-cloud-published',{detail:{departments:Object.keys(local.departments).length}}));return}
      const cloud=await loadCloudOpexBaseline(p);if(cloud)saveOpexLocal(cloud);return;
    }
    setDeptMessage('Loading your OPEX departments...');const cloud=await loadCloudOpexBaseline(p);saveOpexLocal(cloud);applyDepartmentFilter(p);
  }catch(e){console.error('OPEX cloud sync failed:',e);setDeptMessage(`Cloud error: ${e.code||e.message||'Unknown error'}`,true);window.dispatchEvent(new CustomEvent('dad-opex-cloud-error',{detail:{message:e.message||String(e),code:e.code||''}}))}
}

function safeKey(v){return clean(v||'GENERAL').toUpperCase().replace(/[^A-Z0-9_-]+/g,'_').slice(0,160)||'GENERAL'}
function auditModule(input){const id=(input?.id||'').toLowerCase(),p=pathNow();if(id.includes('ims'))return'ims';if(id.includes('capex')||p==='capex.html')return'capex';if(id.includes('travel')||p==='travel-budget.html')return'travel';if(id.includes('hr')||p==='hr-budget.html')return'hr';if(id.includes('ap')||p==='ap-budget.html')return'ap';if(id.includes('opex')||p==='opex.html')return'opex';if(p==='data-admin.html')return'data_admin';return p.replace('.html','')||'general'}
function setupUploadAudit(p){document.querySelectorAll('input[type="file"]').forEach(i=>{if(i.dataset.auditBound)return;i.dataset.auditBound='1';i.addEventListener('change',async()=>{const f=i.files?.[0];if(!f)return;const s=document.getElementById('deptFilter'),department=clean(s?.value||p.department||'GENERAL'),departmentLabel=s?.selectedOptions?.[0]?.textContent||p.departmentLabel||'';try{await window.DADFirebase.logAuditEvent({module:auditModule(i),action:'upload',department,departmentLabel,fileName:f.name,details:{fileSize:Number(f.size||0),page:pathNow()}})}catch(e){console.warn('Audit log failed:',e)}},true)})}

window.DADFirebase={
  app,auth,db,projectId:firebaseConfig.projectId,mainAdminUid:MAIN_ADMIN_UID,mainAdminEmail:MAIN_ADMIN_EMAIL,
  async signIn(email,password){try{await signOut(auth)}catch(_){}clearSession();const c=await signInWithEmailAndPassword(auth,clean(email).toLowerCase(),password);await ensureMainAdminProfile(c.user);const p=await getProfile(c.user.uid);if(!p){await signOut(auth);clearSession();throw new Error('This account does not have a Budget 2027 user profile yet.')}if(p.enabled===false){await signOut(auth);clearSession();throw new Error('This Budget 2027 account is disabled.')}cacheSession(c.user,p);return c.user},
  async signOut(){await signOut(auth);clearSession()},onAuthStateChanged(cb){return onAuthStateChanged(auth,cb)},async getUserProfile(uid){return getProfile(uid)},
  async listUserProfiles(){const s=await getDocs(collection(db,'users'));return s.docs.map(x=>({id:x.id,...x.data()}))},
  async saveUserProfile(uid,p){if(!auth.currentUser)throw new Error('Sign in first.');if(!uid)throw new Error('Firebase UID is required.');await setDoc(doc(db,'users',uid),cleanUserProfile(uid,p),{merge:true});return`users/${uid}`},
  async setUserEnabled(uid,enabled){if(!auth.currentUser)throw new Error('Sign in first.');if(uid===MAIN_ADMIN_UID&&!enabled)throw new Error('Main Admin cannot be disabled.');await setDoc(doc(db,'users',uid),{enabled:!!enabled,updatedAt:serverTimestamp()},{merge:true});return`users/${uid}`},
  async sendPasswordReset(email){const e=clean(email).toLowerCase();if(!e)throw new Error('User email is required.');await sendPasswordResetEmail(auth,e);return e},
  async publishOpexBaseline(model){return publishOpexBaseline(model)},async loadOpexBaseline(p){return loadCloudOpexBaseline(p)},
  async logAuditEvent(event={}){const user=auth.currentUser;if(!user)throw new Error('Sign in first.');const p=await getProfile(user.uid);if(!p)throw new Error('User profile not found.');const module=clean(event.module||'general').toLowerCase(),department=clean(event.department||p.department||'GENERAL'),counter=doc(db,'audit_counters',safeKey(`${module}__${department}`)),log=doc(collection(db,'audit_logs'));let revision=1;await runTransaction(db,async tx=>{const s=await tx.get(counter);revision=(s.exists()?Number(s.data().count||0):0)+1;tx.set(counter,{module,department,count:revision,updatedAt:serverTimestamp()},{merge:true});tx.set(log,{uid:user.uid,email:(user.email||p.email||'').toLowerCase(),role:p.role||'',module,action:clean(event.action||'update'),department,departmentLabel:clean(event.departmentLabel||''),fileName:clean(event.fileName||''),revision,details:event.details&&typeof event.details==='object'?event.details:{},createdAt:serverTimestamp(),clientTime:new Date().toISOString()})});return{id:log.id,revision}},
  async listAuditLogs(){const s=await getDocs(collection(db,'audit_logs'));return s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.createdAt?.seconds||Date.parse(b.clientTime||0)/1000||0)-(a.createdAt?.seconds||Date.parse(a.clientTime||0)/1000||0))},
  async bootstrapMainAdmin(){const u=auth.currentUser;if(!u)throw new Error('Sign in first.');if(u.uid!==MAIN_ADMIN_UID)throw new Error('Signed-in account is not Main Admin.');await ensureMainAdminProfile(u);return`users/${u.uid}`},
  async testConnection(){const r=doc(db,'system_status','web_connection');await setDoc(r,{app:'DAD Budget 2027',projectId:firebaseConfig.projectId,status:'connected',updatedAt:serverTimestamp()},{merge:true});return r.path}
};

onAuthStateChanged(auth,async user=>{
  const login=pathNow()==='login.html'||pathNow()==='';if(!user){clearSession();if(!login)location.replace('login.html');return}if(login)return;
  try{await ensureMainAdminProfile(user);const p=await getProfile(user.uid);if(!p||p.enabled===false){await signOut(auth);clearSession();location.replace('login.html');return}cacheSession(user,p);setupLogout();applyUserAccess(p);await syncOpex(p);applyDepartmentFilter(p);setupUploadAudit(p);window.addEventListener('dad-opex-cloud-ready',()=>applyDepartmentFilter(p));window.dispatchEvent(new CustomEvent('dad-user-ready',{detail:{user,profile:p}}))}catch(e){console.error('Budget user session error:',e)}
});
window.dispatchEvent(new CustomEvent('dad-firebase-ready',{detail:{projectId:firebaseConfig.projectId,mainAdminUid:MAIN_ADMIN_UID}}));
