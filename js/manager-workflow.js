import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();

function currentDepartment(){
  const sel=document.getElementById('deptFilter');
  const cc=clean(sel?.value),label=clean(sel?.selectedOptions?.[0]?.textContent||'');
  const name=label.includes('·')?clean(label.split('·').slice(1).join('·')):label||cc;
  return{cc,name};
}

async function sendUnderReview(btn){
  const user=auth.currentUser;if(!user)throw new Error('Sign in first.');
  const {cc,name}=currentDepartment();if(!cc)throw new Error('Select a department first.');
  if(document.body.dataset.opexApprovedLock==='1')throw new Error('This OPEX budget is approved and locked. Finance must return it first.');

  await setDoc(doc(db,'opex_budget_submissions',cc),{
    fundCenter:cc,
    name,
    departmentName:name,
    workflowStatus:'under_review',
    financeStatus:'under_review',
    submittedBy:user.uid,
    submittedByEmail:clean(user.email).toLowerCase(),
    workflowSubmittedAt:serverTimestamp(),
    workflowClientSubmittedAt:new Date().toISOString(),
    workflowUpdatedAt:serverTimestamp()
  },{merge:true});

  btn.textContent='Under Review';
  btn.disabled=true;
  alert('Budget sent to Finance and is now Under Review.');
}

function install(){
  const buttons=[...document.querySelectorAll('button')];
  const btn=buttons.find(b=>{
    const t=clean(b.textContent).toLowerCase();
    return t==='submit budget'||t==='under review';
  });
  if(!btn||btn.dataset.financeReviewWorkflow)return;
  btn.dataset.financeReviewWorkflow='1';
  btn.textContent='Under Review';
  btn.addEventListener('click',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    try{
      btn.disabled=true;btn.textContent='Sending for Review...';
      await sendUnderReview(btn);
    }catch(err){
      btn.disabled=false;btn.textContent='Under Review';
      alert('Budget review submission failed: '+(err?.message||err));
    }
  },true);
}

window.addEventListener('dad-user-ready',install);
window.addEventListener('load',install);
setTimeout(install,500);
