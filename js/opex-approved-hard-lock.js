import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
const clean=v=>String(v??'').trim().toLowerCase();
let subUnsub=null,statusUnsub=null;
let submissionState='',financeState='';

function isMainAdmin(){return auth.currentUser?.uid===MAIN}
function selected(){return String(document.getElementById('deptFilter')?.value||'').trim()}
function isApproved(){return submissionState==='approved'||financeState==='approved'}

function note(){
  let n=document.getElementById('hardApprovedLockNote');
  if(n)return n;
  const bar=document.querySelector('.sheet-toolbar');if(!bar)return null;
  n=document.createElement('div');n.id='hardApprovedLockNote';
  n.textContent='Approved by Finance · OPEX is locked. Upload will be available again only after Finance returns this budget.';
  n.style.cssText='display:none;margin:0 16px 10px;padding:10px 12px;border-radius:8px;background:#fff0ee;border:1px solid #f2c8c3;color:#9e2f2f;font-size:11px;font-weight:1000';
  bar.insertAdjacentElement('afterend',n);return n
}

function reviewButton(){
  return [...document.querySelectorAll('button')].find(b=>{
    const t=String(b.textContent||'').trim().toLowerCase();
    return t==='under review'||t==='submit budget'||t==='submitting...'||t==='sending for review...';
  })||null;
}

function apply(){
  const locked=isApproved()&&!isMainAdmin();
  const up=document.getElementById('opexUploadBtn'),inp=document.getElementById('opexUploadInput'),review=reviewButton(),n=note();
  if(up){up.hidden=locked;up.disabled=locked;up.style.setProperty('display',locked?'none':'','important')}
  if(inp){inp.disabled=locked;if(locked)inp.value=''}
  if(review){review.hidden=locked;review.disabled=locked;review.style.setProperty('display',locked?'none':'','important')}
  if(n)n.style.display=locked?'block':'none';
  document.body.dataset.opexApprovedLock=locked?'1':'0';
}

function stop(){if(subUnsub){subUnsub();subUnsub=null}if(statusUnsub){statusUnsub();statusUnsub=null}}

function readSubmissionState(data={}){
  const workflow=clean(data.workflowStatus),finance=clean(data.financeStatus);
  if(workflow==='approved'||finance==='approved')return'approved';
  if(workflow==='returned'||finance==='returned')return'returned';
  return workflow||finance||'';
}

async function watch(){
  stop();submissionState='';financeState='';
  const cc=selected();
  if(!cc||isMainAdmin()){apply();return}
  try{
    const [a,b]=await Promise.all([
      getDoc(doc(db,'opex_budget_submissions',cc)),
      getDoc(doc(db,'budget_submission_status',cc))
    ]);
    submissionState=a.exists()?readSubmissionState(a.data()||{}):'';
    financeState=b.exists()?clean(b.data()?.status):'';
  }catch(e){console.warn('OPEX approval state read failed',e)}
  apply();
  subUnsub=onSnapshot(doc(db,'opex_budget_submissions',cc),s=>{
    submissionState=s.exists()?readSubmissionState(s.data()||{}):'';
    apply();
  },e=>console.warn('OPEX submission lock listener failed',e));
  statusUnsub=onSnapshot(doc(db,'budget_submission_status',cc),s=>{
    financeState=s.exists()?clean(s.data()?.status):'';
    apply();
  },e=>console.warn('OPEX finance lock listener failed',e));
}

async function start(){
  const sel=document.getElementById('deptFilter');
  if(sel&&!sel.dataset.hardLock){sel.dataset.hardLock='1';sel.addEventListener('change',watch)}
  await watch();
}

onAuthStateChanged(auth,u=>{if(u)start()});
window.addEventListener('dad-user-ready',()=>{if(auth.currentUser)start()});
new MutationObserver(()=>apply()).observe(document.documentElement,{childList:true,subtree:true});
