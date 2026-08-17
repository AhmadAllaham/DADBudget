import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
const clean=v=>String(v??'').trim().toLowerCase();
const LOCKED_STATES=new Set(['pending_manager','manager_approved','submitted','under_review','approved']);
let subUnsub=null,statusUnsub=null,selectionObserver=null;
let submissionState='',financeState='',watchedCc='',stateLoaded=false,watchTimer=null;

function isMainAdmin(){return auth.currentUser?.uid===MAIN}
function selected(){return String(document.getElementById('deptFilter')?.value||'').trim()}
function stateIsLocked(v){return LOCKED_STATES.has(clean(v))}
function isWorkflowLocked(){return stateIsLocked(submissionState)||stateIsLocked(financeState)}
function shouldBlockUpload(){return !isMainAdmin()&&(!selected()||!stateLoaded||isWorkflowLocked())}

function note(){
  let n=document.getElementById('hardApprovedLockNote');
  if(n)return n;
  const bar=document.querySelector('.sheet-toolbar');if(!bar)return null;
  n=document.createElement('div');n.id='hardApprovedLockNote';
  n.style.cssText='display:none;margin:0 16px 10px;padding:10px 12px;border-radius:8px;background:#fff0ee;border:1px solid #f2c8c3;color:#9e2f2f;font-size:11px;font-weight:1000';
  bar.insertAdjacentElement('afterend',n);return n
}

function reviewButton(){
  return [...document.querySelectorAll('button')].find(b=>{
    const t=String(b.textContent||'').trim().toLowerCase();
    return t==='under review'||t==='submit budget'||t==='submitting...'||t==='sending for review...';
  })||null;
}

function lockMessage(){
  const state=clean(submissionState||financeState);
  if(state==='pending_manager')return'Pending Manager Approval · Upload is locked until the manager returns this budget.';
  if(state==='manager_approved')return'Manager Approved · Upload is locked while the budget moves to Finance review.';
  if(state==='submitted'||state==='under_review')return'Under Finance Review · Upload is locked until Finance returns this budget.';
  if(state==='approved')return'Approved by Finance · OPEX is locked. Upload will be available again only after Finance returns this budget.';
  return'Budget review is in progress · Upload is temporarily locked.';
}

function apply(){
  const blocked=shouldBlockUpload(),workflowLocked=isWorkflowLocked()&&!isMainAdmin();
  const up=document.getElementById('opexUploadBtn'),inp=document.getElementById('opexUploadInput'),review=reviewButton(),n=note();
  if(up){up.hidden=blocked;up.disabled=blocked;up.style.setProperty('display',blocked?'none':'','important')}
  if(inp){inp.disabled=blocked;if(blocked)inp.value=''}
  if(review){review.hidden=workflowLocked;review.disabled=workflowLocked;review.style.setProperty('display',workflowLocked?'none':'','important')}
  if(n){n.textContent=lockMessage();n.style.display=workflowLocked?'block':'none'}
  document.body.dataset.opexApprovedLock=workflowLocked?'1':'0';
  document.body.dataset.opexWorkflowLock=blocked?'1':'0';
}

function stop(){if(subUnsub){subUnsub();subUnsub=null}if(statusUnsub){statusUnsub();statusUnsub=null}}

function readState(data={}){
  const workflow=clean(data.workflowStatus),finance=clean(data.financeStatus),legacy=clean(data.status);
  return workflow||finance||legacy||'';
}

async function watch(){
  stop();submissionState='';financeState='';stateLoaded=false;
  const cc=selected();watchedCc=cc;apply();
  if(!cc||isMainAdmin()){stateLoaded=true;apply();return}
  try{
    const [a,b]=await Promise.all([
      getDoc(doc(db,'opex_budget_submissions',cc)),
      getDoc(doc(db,'budget_submission_status',cc))
    ]);
    if(watchedCc!==cc)return;
    submissionState=a.exists()?readState(a.data()||{}):'';
    financeState=b.exists()?readState(b.data()||{}):'';
  }catch(e){console.warn('OPEX workflow lock state read failed',e)}
  stateLoaded=true;apply();
  subUnsub=onSnapshot(doc(db,'opex_budget_submissions',cc),s=>{
    if(watchedCc!==cc)return;
    submissionState=s.exists()?readState(s.data()||{}):'';
    stateLoaded=true;apply();
  },e=>console.warn('OPEX submission lock listener failed',e));
  statusUnsub=onSnapshot(doc(db,'budget_submission_status',cc),s=>{
    if(watchedCc!==cc)return;
    financeState=s.exists()?readState(s.data()||{}):'';
    stateLoaded=true;apply();
  },e=>console.warn('OPEX finance lock listener failed',e));
}

function syncSelection(){
  clearTimeout(watchTimer);
  watchTimer=setTimeout(()=>{if(selected()!==watchedCc)watch();else apply()},0);
}

function installGuards(){
  const up=document.getElementById('opexUploadBtn'),inp=document.getElementById('opexUploadInput');
  if(up&&!up.dataset.workflowLockGuard){up.dataset.workflowLockGuard='1';up.addEventListener('click',e=>{if(!shouldBlockUpload())return;e.preventDefault();e.stopImmediatePropagation()},true)}
  if(inp&&!inp.dataset.workflowLockGuard){inp.dataset.workflowLockGuard='1';inp.addEventListener('change',e=>{if(!shouldBlockUpload())return;e.preventDefault();e.stopImmediatePropagation();inp.value=''},true)}
}

async function start(){
  const sel=document.getElementById('deptFilter');
  installGuards();
  if(sel&&!sel.dataset.hardLock){
    sel.dataset.hardLock='1';
    sel.addEventListener('change',syncSelection);
    selectionObserver=new MutationObserver(syncSelection);
    selectionObserver.observe(sel,{childList:true,subtree:true,attributes:true,attributeFilter:['value','disabled']});
  }
  await watch();
}

onAuthStateChanged(auth,u=>{if(u)start()});
window.addEventListener('dad-user-ready',()=>{if(auth.currentUser)start()});
new MutationObserver(()=>{installGuards();syncSelection()}).observe(document.documentElement,{childList:true,subtree:true});
