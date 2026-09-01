import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
const clean=v=>String(v??'').trim();
function cachedProfile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||{}}catch(_){return{}}}
function isAdminUser(user=auth.currentUser,profile=cachedProfile()){return !!user&&(user.uid===MAIN||profile?.isMainAdmin===true||profile?.role==='admin')}
function profileDepartments(profile={}){const ids=Array.isArray(profile?.departments)?profile.departments:(profile?.department?[profile.department]:[]);return ids.map(clean).filter(Boolean)}
function managerOwnsDepartment(profile,cc){return profile?.role==='manager'&&profileDepartments(profile).includes(clean(cc))}
function currentDepartment(){const sel=document.getElementById('deptFilter'),cc=clean(sel?.value),label=clean(sel?.selectedOptions?.[0]?.textContent||''),name=label.includes('·')?clean(label.split('·').slice(1).join('·')):label||cc;return{cc,name}}
function submitButton(){return[...document.querySelectorAll('button')].find(b=>{const t=clean(b.textContent).toLowerCase();return ['submit budget','submit','under review','sending for review...','submitting...'].includes(t)})||null}
function suppressForAdmin(){const btn=submitButton();if(!btn||!isAdminUser())return false;btn.dataset.financeReviewWorkflow='admin-auto-approved';btn.disabled=true;btn.hidden=true;btn.style.setProperty('display','none','important');return true}

async function notify(toEmail,{cc,name,status}){
  const user=auth.currentUser,fromEmail=clean(user?.email).toLowerCase();if(!toEmail||clean(toEmail).toLowerCase()===fromEmail)return;
  await setDoc(doc(collection(db,'messages')),{kind:'notification',notificationType:'budget_workflow',status,department:cc,departmentName:name||cc,fromUid:user.uid,fromEmail,toEmail:clean(toEmail).toLowerCase(),subject:status==='pending_manager'?'Budget 2027 · Manager approval required':'Budget 2027 · Finance review required',body:`${name||cc} (${cc}) · ${status==='pending_manager'?'Waiting for your manager approval':'Ready for Finance review'}`,targetUrl:status==='pending_manager'?`manager-approval.html?department=${encodeURIComponent(cc)}`:`submission-control.html?department=${encodeURIComponent(cc)}`,read:false,createdAt:serverTimestamp(),clientCreatedAt:new Date().toISOString()});
}
async function sendUnderReview(btn){
  const user=auth.currentUser;if(!user)throw new Error('Sign in first.');
  if(isAdminUser(user)){suppressForAdmin();return}
  const {cc,name}=currentDepartment();if(!cc)throw new Error('Select a department first.');
  if(document.body.dataset.opexApprovedLock==='1')throw new Error('This OPEX budget is approved and locked. Finance must return it first.');
  const [assignmentSnap,profileSnap,submissionSnap]=await Promise.all([getDoc(doc(db,'budget_submission_status',cc)),getDoc(doc(db,'users',user.uid)),getDoc(doc(db,'opex_budget_submissions',cc))]);
  const profile=profileSnap.exists()?profileSnap.data()||{}:{};if(isAdminUser(user,profile)){suppressForAdmin();return}
  if(!submissionSnap.exists()||!submissionSnap.data()?.payload)throw new Error('Upload the department workbook before submitting it.');
  const submission=submissionSnap.data()||{};
  if(clean(submission.workflowStatus)==='manager_returned'&&Number(submission.revision||0)<=Number(submission.managerReturnedRevision||0))throw new Error('The Manager returned this budget. Upload the revised workbook before submitting again.');
  const assignment=assignmentSnap.exists()?assignmentSnap.data()||{}:{},configuredManagerUid=clean(assignment.managerUid)||clean(submission.managerUid),configuredManagerEmail=(clean(assignment.managerEmail)||clean(submission.managerEmail)).toLowerCase(),selfManager=managerOwnsDepartment(profile,cc),managerUid=selfManager?user.uid:configuredManagerUid,managerEmail=selfManager?clean(user.email).toLowerCase():configuredManagerEmail,needsManager=!selfManager&&!!configuredManagerUid&&configuredManagerUid!==user.uid;
  const next=needsManager?'pending_manager':'under_review';
  await setDoc(doc(db,'opex_budget_submissions',cc),{fundCenter:cc,name,departmentName:name,workflowStatus:next,financeStatus:needsManager?'waiting_manager':'under_review',managerUid:managerUid||null,managerEmail:managerEmail||null,managerStatus:needsManager?'pending':'not_required',submittedBy:user.uid,submittedByEmail:clean(user.email).toLowerCase(),workflowSubmittedAt:serverTimestamp(),workflowClientSubmittedAt:new Date().toISOString(),workflowUpdatedAt:serverTimestamp()},{merge:true});
  if(needsManager)await notify(managerEmail,{cc,name,status:next});else try{await window.DADFirebase?.notifyAdminBudgetUpload({module:'OPEX',cc,departmentName:name,fileName:submission.fileName||'OPEX workbook',revision:submission.revision||0,submittedEmail:user.email})}catch(error){console.warn('Finance notification failed:',error)}
  btn.textContent='Submit';btn.disabled=true;alert(needsManager?'Budget sent to your Manager for approval.':'Budget sent to Finance and is now Under Review.');
}
function install(){
  if(suppressForAdmin())return;
  const btn=submitButton();if(!btn||btn.dataset.financeReviewWorkflow)return;
  btn.dataset.financeReviewWorkflow='1';btn.textContent='Submit';
  btn.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();if(isAdminUser()){suppressForAdmin();return}try{btn.disabled=true;btn.textContent='Sending for Review...';await sendUnderReview(btn)}catch(err){btn.disabled=false;btn.textContent='Submit';alert('Budget review submission failed: '+(err?.message||err))}},true);
}
window.addEventListener('dad-user-ready',install);window.addEventListener('load',install);setTimeout(install,500);setTimeout(install,1400);
