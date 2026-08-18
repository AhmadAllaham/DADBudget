import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
const clean=v=>String(v??'').trim();
let profile=null,subUnsub=null,statusUnsub=null,subStatus='',financeStatus='';

function isAdmin(){return auth.currentUser?.uid===MAIN||profile?.role==='admin'||profile?.isMainAdmin===true}
function controls(){return{
  upload:document.getElementById('opexUploadBtn'),
  input:document.getElementById('opexUploadInput'),
  submit:[...document.querySelectorAll('button')].find(b=>clean(b.textContent)==='Submit Budget')
}}
function ensureNote(){
  let n=document.getElementById('opexApprovalLockNote');if(n)return n;
  const bar=document.querySelector('.sheet-toolbar');if(!bar)return null;
  n=document.createElement('div');n.id='opexApprovalLockNote';
  n.style.cssText='display:none;margin:0 16px 10px;padding:10px 12px;border-radius:8px;background:#fff0ee;border:1px solid #f2c8c3;color:#9e2f2f;font-size:11px;font-weight:1000;box-shadow:0 0 10px rgba(178,59,59,.08)';
  n.textContent='Approved by Finance · Upload and editing are locked until Finance returns this budget.';
  bar.insertAdjacentElement('afterend',n);return n
}
function applyState(){
  let locked=!isAdmin()&&(subStatus==='approved'||financeStatus==='approved');
  const c=controls(),n=ensureNote();
  if(c.upload){
    c.upload.disabled=locked;
    c.upload.style.display=locked?'none':'';
    c.upload.style.opacity=locked?'.45':'';
    c.upload.style.cursor=locked?'not-allowed':'';
  }
  if(c.input){c.input.disabled=locked;if(locked)c.input.value=''}
  if(c.submit){c.submit.disabled=locked;c.submit.style.display=locked?'none':'';c.submit.style.opacity=locked?'.45':'';c.submit.style.cursor=locked?'not-allowed':''}
  if(n)n.style.display=locked?'block':'none';
  document.body.dataset.opexApprovedLock=locked?'1':'0';
}
async function profileFor(user){try{const s=await getDoc(doc(db,'users',user.uid));profile=s.exists()?s.data()||{}:{}}catch(_){profile={}}}
function stopWatch(){if(subUnsub){subUnsub();subUnsub=null}if(statusUnsub){statusUnsub();statusUnsub=null}}
function watch(cc){
  stopWatch();subStatus='';financeStatus='';cc=clean(cc);
  if(!cc||isAdmin()){applyState();return}
  subUnsub=onSnapshot(doc(db,'opex_budget_submissions',cc),s=>{subStatus=s.exists()?clean(s.data()?.workflowStatus):'';applyState()},()=>{subStatus='';applyState()});
  statusUnsub=onSnapshot(doc(db,'budget_submission_status',cc),()=>{financeStatus='';applyState()},()=>{financeStatus='';applyState()});
}
function selected(){return clean(document.getElementById('deptFilter')?.value)}
function installGuards(){
  const c=controls();
  if(c.upload&&!c.upload.dataset.approvalGuard){c.upload.dataset.approvalGuard='1';c.upload.addEventListener('click',e=>{if(document.body.dataset.opexApprovedLock==='1'){e.preventDefault();e.stopImmediatePropagation();alert('This OPEX budget is approved and locked. Finance must return it before another upload.')}},true)}
  if(c.input&&!c.input.dataset.approvalGuard){c.input.dataset.approvalGuard='1';c.input.addEventListener('change',e=>{if(document.body.dataset.opexApprovedLock==='1'){e.preventDefault();e.stopImmediatePropagation();c.input.value='';alert('This OPEX budget is approved and locked. Finance must return it first.')}},true)}
}
async function start(user){await profileFor(user);installGuards();watch(selected());const sel=document.getElementById('deptFilter');if(sel&&!sel.dataset.approvalLock){sel.dataset.approvalLock='1';sel.addEventListener('change',()=>watch(selected()))}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGuards);else installGuards();
onAuthStateChanged(auth,u=>{if(u)start(u)});
window.addEventListener('dad-user-ready',e=>{profile=e.detail?.profile||profile;if(e.detail?.user||auth.currentUser)start(e.detail?.user||auth.currentUser)});
