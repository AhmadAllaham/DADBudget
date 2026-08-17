import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();

async function managerForDepartment(cc){
  const submissionSnap=await getDoc(doc(db,'opex_budget_submissions',cc));
  if(submissionSnap.exists()){
    const d=submissionSnap.data()||{};
    const uid=clean(d.managerUid),email=clean(d.managerEmail).toLowerCase();
    if(uid)return{uid,email};
  }
  const statusSnap=await getDoc(doc(db,'budget_submission_status',cc));
  if(!statusSnap.exists())return null;
  const d=statusSnap.data()||{};
  const uid=clean(d.managerUid),email=clean(d.managerEmail).toLowerCase();
  return uid?{uid,email}:null;
}

function currentDepartment(){
  const sel=document.getElementById('deptFilter');
  const cc=clean(sel?.value),label=clean(sel?.selectedOptions?.[0]?.textContent||'');
  const name=label.includes('·')?clean(label.split('·').slice(1).join('·')):label||cc;
  return{cc,name};
}

async function submitForManager(btn){
  const user=auth.currentUser;if(!user)throw new Error('Sign in first.');
  const {cc,name}=currentDepartment();if(!cc)throw new Error('Select a department first.');
  const manager=await managerForDepartment(cc);
  if(!manager)throw new Error('No manager is linked to this department yet. Ask the Admin to open the Manager user in User Settings and save it once.');
  await setDoc(doc(db,'opex_budget_submissions',cc),{
    fundCenter:cc,name,departmentName:name,
    workflowStatus:'pending_manager',managerStatus:'pending',
    managerUid:manager.uid,managerEmail:manager.email,
    submittedBy:user.uid,submittedByEmail:clean(user.email).toLowerCase(),
    workflowSubmittedAt:serverTimestamp(),workflowClientSubmittedAt:new Date().toISOString(),
    managerNote:'',managerApprovedAt:null,managerApprovedBy:null,workflowUpdatedAt:serverTimestamp()
  },{merge:true});
  btn.textContent='Pending Manager Approval';
  btn.disabled=true;
  alert(`Budget submitted to ${manager.email||'the assigned manager'} for approval.`);
}

function install(){
  const buttons=[...document.querySelectorAll('button')];
  const btn=buttons.find(b=>clean(b.textContent).toLowerCase()==='submit budget');
  if(!btn||btn.dataset.managerWorkflow)return;
  btn.dataset.managerWorkflow='1';
  btn.addEventListener('click',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const old=btn.textContent;
    try{btn.disabled=true;btn.textContent='Submitting...';await submitForManager(btn)}catch(err){btn.disabled=false;btn.textContent=old;alert('Budget submission failed: '+(err?.message||err))}
  },true);
}

window.addEventListener('dad-user-ready',install);
window.addEventListener('load',install);
setTimeout(install,800);
