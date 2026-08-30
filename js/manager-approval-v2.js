import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const MANAR_EMAIL='manar.alasaad@dadgroup.com',MEDICAL_CC='1000200105';
const $=id=>document.getElementById(id),clean=v=>String(v??'').trim();
let profile=null,rows=[];
async function notifyBudgetUsers({emails=[],cc='',name='',status='',note='',revision=0}={}){const user=auth.currentUser,fromEmail=clean(user?.email).toLowerCase(),targets=[...new Set(emails.map(x=>clean(x).toLowerCase()).filter(x=>x&&x.includes('@')&&x!==fromEmail))],label=status==='manager_approved'?'Approved by Manager':'Returned by Manager';await Promise.all(targets.map(toEmail=>{const ref=doc(collection(db,'messages'));return setDoc(ref,{kind:'notification',notificationType:'budget_workflow',status,department:cc,departmentName:name||cc,fromUid:user.uid,fromEmail,toEmail,subject:`Budget 2027 · ${label}`,body:`${name||cc} (${cc}) · ${label}${note?`\n${note}`:''}`,note,revision:Number(revision||0),targetUrl:`opex.html?department=${encodeURIComponent(cc)}`,read:false,createdAt:serverTimestamp(),clientCreatedAt:new Date().toISOString()})}))}

function assignedIds(){
  const ids=(Array.isArray(profile?.departments)?profile.departments:(profile?.department?[profile.department]:[])).map(String).filter(x=>x&&x!=='ALL');
  if(clean(auth.currentUser?.email||profile?.email).toLowerCase()===MANAR_EMAIL&&!ids.includes(MEDICAL_CC))ids.push(MEDICAL_CC);
  return [...new Set(ids)];
}
async function readAssigned(ids){
  const out=[];
  await Promise.all(ids.map(async cc=>{
    try{
      const s=await getDoc(doc(db,'opex_budget_submissions',cc));
      if(!s.exists())return;
      out.push({cc,...s.data(),upload:s.data()});
    }catch(error){console.warn('Approval read skipped',cc,error.code||error.message)}
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
    const ids=assignedIds();
    $('body').innerHTML='<tr><td colspan="7" class="empty">Loading assigned departments...</td></tr>';
    rows=(await readAssigned(ids)).filter(r=>['pending_manager','manager_approved','manager_returned'].includes(workflowOf(r)));
    render();
  }catch(e){console.error('Manager approval v2 load failed',e);$('body').innerHTML=`<tr><td colspan="7" class="empty">Unable to load approvals: ${e.code||e.message||'Unknown error'}</td></tr>`}
}

async function decide(tr,action,btn){
  const cc=tr.dataset.cc,note=tr.querySelector('[data-note]').value.trim(),user=auth.currentUser,r=rows.find(x=>x.cc===cc)||{};
  try{
    btn.disabled=true;
    const approved=action==='approve',next=approved?'manager_approved':'manager_returned';
    await setDoc(doc(db,'opex_budget_submissions',cc),{
      workflowStatus:next,
      managerStatus:approved?'approved':'returned',managerNote:note,
      managerApprovedAt:approved?serverTimestamp():null,
      managerApprovedBy:approved?user.uid:null,
      managerApprovedByEmail:approved?clean(user.email).toLowerCase():null,
      managerDecisionAt:serverTimestamp(),managerDecisionBy:user.uid,
      managerDecisionEmail:clean(user.email).toLowerCase(),workflowUpdatedAt:serverTimestamp()
    },{merge:true});
    await notifyBudgetUsers({emails:[r.submittedEmail,r.submittedByEmail],cc,name:r.departmentName||r.name||cc,status:next,note,revision:r.revision||0,source:'manager'});
    rows=rows.map(x=>x.cc===cc?{...x,workflowStatus:next,managerStatus:approved?'approved':'returned',managerNote:note}:x);
    render();
  }catch(e){alert('Approval failed: '+(e.code||e.message||e))}finally{btn.disabled=false}
}

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
    const ps=await getDoc(doc(db,'users',user.uid));profile=ps.exists()?ps.data():{};
    if(!['manager','admin'].includes(profile.role)&&profile.isMainAdmin!==true)return;
    await load();
  }catch(e){console.error('Manager profile load failed',e)}
});
