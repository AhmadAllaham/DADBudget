import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,writeBatch,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',IT_FUND_CENTER='1000300110';
const IT_CATEGORIES=new Set(['COMPUTERSPRINTERS','COMPUTERSOFTWARE']);
const clean=value=>String(value??'').trim();
const categoryKey=value=>clean(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
const isItRow=row=>IT_CATEGORIES.has(categoryKey(row?.category));
const isAdmin=(user,profile)=>user?.uid===MAIN||profile?.role==='admin'||profile?.isMainAdmin===true;
const assigned=profile=>Array.isArray(profile?.departments)?profile.departments.map(clean).filter(x=>x&&x!=='ALL'):[];

function mirrorPayload(cc,payload,user,profile){
  const rows=(Array.isArray(payload.rows)?payload.rows:[]).filter(isItRow),ids=new Set(rows.map(row=>clean(row.requestId)).filter(Boolean)),payments=(Array.isArray(payload.payments)?payload.payments:[]).filter(payment=>ids.has(clean(payment.requestId)));
  return{cc,departmentName:clean(payload.departmentName||rows[0]?.department||cc),rows,payments,total:rows.reduce((sum,row)=>sum+Number(row.total||0),0),paymentTotal:payments.reduce((sum,payment)=>sum+Number(payment.amount||0),0),sourceFile:clean(payload.fileName),sourceRevision:Number(payload.revision||0),workflowStatus:clean(payload.workflowStatus),itStatus:clean(payload.itStatus),itNote:'',itRevision:0,managerUid:clean(payload.managerUid),managerEmail:clean(payload.managerEmail).toLowerCase(),submittedEmail:clean(payload.submittedEmail||payload.submittedByEmail).toLowerCase(),updatedBy:user.uid,updatedByEmail:clean(user.email||profile?.email).toLowerCase(),updatedAt:serverTimestamp()}
}

async function itReviewerEmails(){
  const snap=await getDocs(collection(db,'users')),emails=[];
  snap.forEach(record=>{const data=record.data()||{};if(data.enabled!==false&&Array.isArray(data.modules)&&data.modules.includes('capex_it')&&clean(data.email).includes('@'))emails.push(clean(data.email).toLowerCase())});
  return[...new Set(emails)]
}

async function notify(emails,{cc,name,status,subject,body,targetUrl}){
  const user=auth.currentUser,fromEmail=clean(user?.email).toLowerCase(),targets=[...new Set(emails.filter(Boolean).map(x=>clean(x).toLowerCase()).filter(x=>x.includes('@')&&x!==fromEmail))];
  await Promise.all(targets.map(toEmail=>setDoc(doc(collection(db,'messages')),{kind:'notification',notificationType:'budget_workflow',status,module:'CAPEX',department:cc,departmentName:name||cc,fromUid:user.uid,fromEmail,toEmail,subject,body,targetUrl,read:false,createdAt:serverTimestamp(),clientCreatedAt:new Date().toISOString()})))
}

async function install(user){
  if(!user)return;const profileSnap=await getDoc(doc(db,'users',user.uid));if(!profileSnap.exists())return;const profile=profileSnap.data()||{};
  for(let attempt=0;attempt<100&&!window.DADCapexCloud?.saveSubmission;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
  if(!window.DADCapexCloud?.saveSubmission||window.DADCapexCloud.itWorkflowInstalled)return;
  window.DADCapexCloud.itWorkflowInstalled=true;
  window.DADCapexCloud.saveSubmission=async(parsed,fileName)=>{
    const current=auth.currentUser;if(!current)throw new Error('Your session expired. Please sign in again.');const admin=isAdmin(current,profile),cc=clean(parsed.cc);if(!admin&&!assigned(profile).includes(cc))throw new Error('You cannot upload CAPEX for this department.');
    const ref=doc(db,'capex_budget_submissions',cc),previous=await getDoc(ref),previousData=previous.exists()?previous.data()||{}:{},oldState=clean(previousData.workflowStatus||previousData.status).toLowerCase();
    if(!admin&&previous.exists()&&!['returned','manager_returned'].includes(oldState))throw new Error('CAPEX is already submitted and locked until the Manager or Finance returns it.');
    const assignmentSnap=await getDoc(doc(db,'budget_submission_status',cc)),assignment=assignmentSnap.exists()?assignmentSnap.data()||{}:{},managerUid=clean(assignment.managerUid),managerEmail=clean(assignment.managerEmail).toLowerCase(),needsManager=!admin&&!!managerUid&&managerUid!==current.uid,rows=Array.isArray(parsed.rows)?parsed.rows:[],payments=Array.isArray(parsed.payments)?parsed.payments:[],needsItReview=!admin&&cc!==IT_FUND_CENTER&&rows.some(isItRow),next=needsItReview?'pending_it':needsManager?'pending_manager':'under_review',first=rows[0]||{},revision=Number(previousData.revision||0)+1;
    const payload={cc,departmentName:clean(first.department||cc),rows,payments,total:rows.reduce((sum,row)=>sum+Number(row.total||0),0),paymentTotal:payments.reduce((sum,payment)=>sum+Number(payment.amount||0),0),payment2027Total:payments.filter(payment=>clean(payment.expectedPaymentDate).startsWith('2027-')).reduce((sum,payment)=>sum+Number(payment.amount||0),0),paymentScheduleVersion:parsed.legacyPaymentSchedule?0:3,fileName:clean(fileName),revision,workflowStatus:next,status:next,financeStatus:needsItReview?'waiting_it':needsManager?'waiting_manager':'under_review',financeReturnPending:false,financeReturnNote:'',financeReturnedAt:null,managerUid:managerUid||null,managerEmail:managerEmail||null,managerStatus:needsItReview?'waiting_it':needsManager?'pending':'not_required',managerNote:'',managerDecisionBy:null,managerDecisionEmail:null,managerDecisionAt:null,itReviewRequired:needsItReview,itStatus:needsItReview?'pending':'not_required',itNote:'',itRevision:0,itReviewedAt:null,itReviewedBy:null,itReviewedByEmail:null,submittedBy:current.uid,submittedByEmail:clean(current.email||profile.email).toLowerCase(),submittedEmail:clean(current.email||profile.email).toLowerCase(),submittedAt:serverTimestamp(),clientSubmittedAt:new Date().toISOString(),returnedAt:null,returnNote:''};
    const batch=writeBatch(db);batch.set(ref,payload,{merge:true});if(needsItReview)batch.set(doc(db,'capex_it_requests',cc),mirrorPayload(cc,payload,current,profile),{merge:false});else batch.set(doc(db,'capex_it_requests',cc),mirrorPayload(cc,payload,current,profile),{merge:true});await batch.commit();
    if(needsItReview){const emails=await itReviewerEmails().catch(error=>{console.warn('IT reviewer email lookup is not available to this user:',error);return[]});if(emails.length)await notify(emails,{cc,name:payload.departmentName,status:'pending_it',subject:'Budget 2027 · CAPEX IT review required',body:`${payload.departmentName} (${cc}) · IT-related CAPEX is waiting for IT review`,targetUrl:`it-planning.html?department=${encodeURIComponent(cc)}`})}
    else if(needsManager&&managerEmail)await notify([managerEmail],{cc,name:payload.departmentName,status:'pending_manager',subject:'Budget 2027 · CAPEX manager approval required',body:`${payload.departmentName} (${cc}) · CAPEX is waiting for your approval`,targetUrl:`manager-approval.html?department=${encodeURIComponent(cc)}`});
    else try{await window.DADFirebase?.notifyAdminBudgetUpload({module:'CAPEX',cc,departmentName:payload.departmentName,fileName,revision,submittedEmail:payload.submittedEmail})}catch(error){console.warn('Finance CAPEX notification failed:',error)}
    document.body.dataset.capexUploadLocked=admin?'0':'1';const button=document.getElementById('uploadBtn');if(button&&!admin)button.disabled=true;return revision
  }
}

onAuthStateChanged(auth,install);window.addEventListener('dad-user-ready',event=>install(event.detail?.user||auth.currentUser));
