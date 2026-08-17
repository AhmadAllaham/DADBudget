import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id),clean=v=>String(v??'').trim();
let profile=null,rows=[];

async function readAssigned(ids){
  const out=[];
  await Promise.all(ids.map(async cc=>{
    const s=await getDoc(doc(db,'opex_budget_submissions',cc));
    if(!s.exists())return;
    out.push({cc,...s.data(),upload:s.data()});
  }));
  return out;
}

function workflowOf(r){return r.workflowStatus||r.status||'uploaded'}
function render(){
  $('kPending').textContent=rows.filter(r=>workflowOf(r)==='pending_manager').length;
  $('kApproved').textContent=rows.filter(r=>workflowOf(r)==='manager_approved').length;
  $('kReturned').textContent=rows.filter(r=>workflowOf(r)==='manager_returned').length;
  if(!rows.length){$('body').innerHTML='<tr><td colspan="7" class="empty">No department budgets waiting for your approval.</td></tr>';return}
  $('body').innerHTML=rows.map(r=>{const st=workflowOf(r);return `<tr data-cc="${r.cc}"><td><span class="dept">${r.departmentName||r.name||r.cc}</span><div class="muted">${r.cc}</div></td><td>${r.submittedByEmail||r.submittedEmail||'—'}</td><td>${r.fileName||'—'}</td><td>${r.revision?'R'+r.revision:'—'}</td><td><span class="badge ${st}">${st==='pending_manager'?'Pending Manager Approval':st==='manager_approved'?'Manager Approved':'Returned by Manager'}</span></td><td><input class="note" data-note value="${String(r.managerNote||'').replace(/"/g,'&quot;')}" placeholder="Optional note"></td><td>${st==='pending_manager'?'<button class="approve" data-action="approve">Approve</button><button class="return" data-action="return">Return</button>':'<span class="muted">Decision saved</span>'}</td></tr>`}).join('');
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>decide(b.closest('tr'),b.dataset.action,b));
}

async function load(){
  try{
    const ids=(profile?.departments||[]).map(String).filter(x=>x&&x!=='ALL');
    $('body').innerHTML='<tr><td colspan="7" class="empty">Loading assigned departments...</td></tr>';
    rows=(await readAssigned(ids)).filter(r=>['pending_manager','manager_approved','manager_returned'].includes(workflowOf(r)));
    render();
  }catch(e){console.error('Manager approval v2 load failed',e);$('body').innerHTML=`<tr><td colspan="7" class="empty">Unable to load approvals: ${e.code||e.message||'Unknown error'}</td></tr>`}
}

async function decide(tr,action,btn){
  const cc=tr.dataset.cc,note=tr.querySelector('[data-note]').value.trim(),user=auth.currentUser;
  try{
    btn.disabled=true;
    const approved=action==='approve';
    await setDoc(doc(db,'opex_budget_submissions',cc),{
      workflowStatus:approved?'manager_approved':'manager_returned',
      managerStatus:approved?'approved':'returned',managerNote:note,
      managerApprovedAt:approved?serverTimestamp():null,
      managerApprovedBy:approved?user.uid:null,
      managerApprovedByEmail:approved?clean(user.email).toLowerCase():null,
      managerDecisionAt:serverTimestamp(),managerDecisionBy:user.uid,
      managerDecisionEmail:clean(user.email).toLowerCase(),workflowUpdatedAt:serverTimestamp()
    },{merge:true});
    await load();
  }catch(e){alert('Approval failed: '+e.message)}finally{btn.disabled=false}
}

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
    const ps=await getDoc(doc(db,'users',user.uid));profile=ps.exists()?ps.data():{};
    if(!['manager','admin'].includes(profile.role)&&profile.isMainAdmin!==true)return;
    await load();
  }catch(e){console.error('Manager profile load failed',e)}
});