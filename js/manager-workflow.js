import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();

async function findManager(cc){
  const snap=await getDocs(collection(db,'users'));
  const managers=snap.docs.map(x=>({id:x.id,...x.data()})).filter(u=>u.enabled!==false&&u.role==='manager'&&(u.departments||[]).map(String).includes(String(cc)));
  return managers[0]||null;
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
  const manager=await findManager(cc);
  if(!manager)throw new Error('No manager is assigned to this department yet. Assign a Manager role user to this Fund Center in User Settings.');
  await setDoc(doc(db,'budget_submission_status',cc),{
    fundCenter:cc,departmentName:name,status:'pending_manager',workflowStatus:'pending_manager',
    managerStatus:'pending',managerUid:manager.id,managerEmail:clean(manager.email).toLowerCase(),
    submittedBy:user.uid,submittedByEmail:clean(user.email).toLowerCase(),submittedAt:serverTimestamp(),clientSubmittedAt:new Date().toISOString(),
    managerNote:'',managerApprovedAt:null,managerApprovedBy:null,updatedAt:serverTimestamp()
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
