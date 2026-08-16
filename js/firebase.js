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
const departmentsOf=p=>Array.isArray(p?.departments)?p.departments.map(clean).filter(Boolean):(p?.department?[clean(p.department)]:[]);

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

function moduleForPath(p){if(!p||p==='index.html')return'dashboard';if(p==='ims-sales.html')return'ims';if(p==='capex.html')return'capex';if(p==='travel-budget.html')return'travel';if(p==='hr-budget.html')return'hr';if(p==='ap-budget.html')return'ap';if(p==='data-admin.html')return'data_admin';if(p==='user-settings.html'||p==='activity-log.html')return'admin_only';if(p==='opex.html'||p==='opex-summary.html')return'opex';return''}
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

function bytesToBase64(bytes){let s='';const step=0x8000;for(let i=0;i<bytes.length;i+=step)s+=String.fromCharCode(...bytes.subarray(i,i+step));return btoa(s)}
function base64ToBytes(s){const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
async function gzipText(text){
  if(typeof CompressionStream==='undefined')return null;
  const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzipText(bytes){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress the shared OPEX baseline. Please use an updated Chrome or Edge browser.');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}
async function encodeDepartment(d){
  const raw=JSON.stringify(d),rawBytes=new Blob([raw]).size,gz=await gzipText(raw);
  if(gz){const b64=bytesToBase64(gz),storedBytes=new Blob([b64]).size;if(storedBytes<900000)return{encoding:'gzip-base64-v1',payload:b64,rawBytes,storedBytes}}
  if(rawBytes<900000)return{encoding:'json-v1',payload:raw,rawBytes,storedBytes:rawBytes};
  throw new Error(`Department ${clean(d?.cc)} is still too large for Firestore after compression.`);
}
async function decodeDepartment(data,id){
  if(data?.encoding==='gzip-base64-v1'){const txt=await gunzipText(base64ToBytes(data.payload||''));const d=JSON.parse(txt);return{...d,cc:clean(d.cc||id)}}
  if(data?.encoding==='json-v1'){const d=JSON.parse(data.payload||'{}');return{...d,cc:clean(d.cc||id)}}
  return{...data,cc:clean(data?.cc||id),cloudUpdatedAt:undefined};
}

async function publishOpexBaseline(model){
  if(!auth.currentUser||auth.currentUser.uid!==MAIN_ADMIN_UID)throw new Error('Only Main Admin can publish the OPEX baseline.');if(!model?.departments)throw new Error('No OPEX baseline found.');
  const deps=Object.values(model.departments||{}),published=[];
  for(const d of deps){const cc=clean(d?.cc);if(!cc)continue;const encoded=await encodeDepartment({...d,cc});await setDoc(doc(db,'opex_baseline_departments',cc),{cc,name:clean(d.name||cc),encoding:encoded.encoding,payload:encoded.payload,rawBytes:encoded.rawBytes,storedBytes:encoded.storedBytes,cloudUpdatedAt:serverTimestamp()},{merge:false});published.push(cc)}
  await setDoc(doc(db,'opex_baseline_meta','current'),{fileName:model.fileName||'OPEX Baseline',mappingInfo:model.mappingInfo||{},departmentCount:published.length,departments:published,publishedBy:auth.currentUser.uid,publishedEmail:(auth.currentUser.email||'').toLowerCase(),publishedAt:serverTimestamp(),clientPublishedAt:new Date().toISOString(),schemaVersion:3},{merge:false});
  return{departments:published.length,fileName:model.fileName||''};
}
async function loadCloudOpexBaseline(p){
  if(!auth.currentUser)throw new Error('No signed-in Firebase user.');const metaSnap=await getDoc(doc(db,'opex_baseline_meta','current'));if(!metaSnap.exists())throw new Error('OPEX baseline is not published yet. Open OPEX once with the Main Admin account.');
  const meta=metaSnap.data()||{},admin=isAdminProfile(p),assigned=departmentsOf(p),deps={};
  if(admin||assigned.includes('ALL')){const s=await getDocs(collection(db,'opex_baseline_departments'));for(const x of s.docs)deps[x.id]=await decodeDepartment(x.data(),x.id)}
  else{
    if(!assigned.length)throw new Error('No departments are assigned to this user.');
    const errors=[];for(const cc of assigned){try{const s=await getDoc(doc(db,'opex_baseline_departments',cc));if(s.exists())deps[cc]=await decodeDepartment(s.data(),cc);else errors.push(`${cc} not found`)}catch(e){errors.push(`${cc}: ${e.code||e.message}`)}}
    if(!Object.keys(deps).length)throw new Error(errors.length?errors.join(' | '):'No assigned OPEX departments were found.');
  }
  return{fileName:meta.fileName||'Cloud OPEX Baseline',mappingInfo:meta.mappingInfo||{},departments:deps,accountMaster:rebuildMaster(deps),cloud:true,cloudPublishedAt:meta.clientPublishedAt||''};
}
function applyDepartmentFilter(p){
  if(!OPEX_PAGES.has(pathNow())||isAdminProfile(p)||departmentsOf(p).includes('ALL'))return;
  const allowed=departmentsOf(p),set=new Set(allowed),sel=document.getElementById('deptFilter'),m=localOpex();if(!sel)return;
  if(!m?.departments){if(sel.dataset.cloudState!=='error')setDeptMessage('Waiting for shared OPEX baseline...');return}
  const list=Object.values(m.departments).filter(d=>set.has(clean(d.cc))).sort((a,b)=>clean(a.name||a.cc).localeCompare(clean(b.name||b.cc)));
  if(!list.length){setDeptMessage('No assigned department found in shared OPEX baseline',true);return}
  const old=sel.value;sel.innerHTML='';list.forEach(d=>{const o=document.createElement('option');o.value=clean(d.cc);o.textContent=`${clean(d.cc)} · ${clean(d.name||d.cc)}`;sel.appendChild(o)});sel.value=set.has(old)&&m.departments[old]?old:(allowed.find(x=>m.departments[x])||clean(list[0].cc));sel.disabled=list.length===1;sel.dataset.cloudState='ready';localStorage.setItem('dadBudgetOPEXSelectedDept',sel.value);sel.dispatchEvent(new Event('change',{bubbles:true}));
}
async function syncOpex(p){
  if(!OPEX_PAGES.has(pathNow()))return true;
  try{
    if(isAdminProfile(p)){
      const local=localOpex();if(local?.departments){setDeptMessage('Publishing shared OPEX baseline...');const r=await publishOpexBaseline(local);window.dispatchEvent(new CustomEvent('dad-opex-cloud-published',{detail:r}));const s=document.getElementById('deptFilter');if(s)s.dataset.cloudState='ready';return true}
      const cloud=await loadCloudOpexBaseline(p);saveOpexLocal(cloud);return true;
    }
    setDeptMessage('Loading your OPEX departments...');const cloud=await loadCloudOpexBaseline(p);saveOpexLocal(cloud);applyDepartmentFilter(p);return true;
  }catch(e){console.error('OPEX cloud sync failed:',e);setDeptMessage(`Cloud error: ${e.code||e.message||'Unknown error'}`,true);window.dispatchEvent(new CustomEvent('dad-opex-cloud-error',{detail:{message:e.message||String(e),code:e.code||''}}));return false}
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
  try{
    await ensureMainAdminProfile(user);const p=await getProfile(user.uid);if(!p||p.enabled===false){await signOut(auth);clearSession();location.replace('login.html');return}
    cacheSession(user,p);setupLogout();applyUserAccess(p);const ok=await syncOpex(p);if(ok)applyDepartmentFilter(p);setupUploadAudit(p);window.addEventListener('dad-opex-cloud-ready',()=>applyDepartmentFilter(p));window.dispatchEvent(new CustomEvent('dad-user-ready',{detail:{user,profile:p}}));
  }catch(e){console.error('Budget user session error:',e);if(OPEX_PAGES.has(pathNow()))setDeptMessage(`Session error: ${e.code||e.message||'Unknown error'}`,true)}
});
window.dispatchEvent(new CustomEvent('dad-firebase-ready',{detail:{projectId:firebaseConfig.projectId,mainAdminUid:MAIN_ADMIN_UID}}));
