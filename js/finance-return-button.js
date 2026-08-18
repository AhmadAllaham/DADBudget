import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
function base64ToBytes(s){const b=atob(s||''),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function financeApprovedBudgetSnapshot(upload={}){if(!upload?.payload)return null;let parsed;if(upload.encoding==='gzip-base64-v1'){const stream=new Blob([base64ToBytes(upload.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));parsed=JSON.parse(await new Response(stream).text())}else if(upload.encoding==='json-v1')parsed=JSON.parse(upload.payload||'{}');else parsed=upload;const out={};Object.entries(parsed.items||{}).forEach(([key,item])=>{const code=String(item?.code||key).trim();if(code)out[code]={...(item?.newBudgetByMonth||{})}});Object.entries(upload.travelBudgetByGl||parsed.travelBudgetByGl||{}).forEach(([code,months])=>{if(String(code).trim())out[String(code).trim()]={...(months||{})}});return Object.keys(out).length?out:null}
async function notifyBudgetUsers({emails=[],cc='',name='',revision=0,module='OPEX',managerAction=false}={}){const user=auth.currentUser,fromEmail=String(user?.email||'').trim().toLowerCase(),targets=[...new Set(emails.map(x=>String(x||'').trim().toLowerCase()).filter(x=>x&&x.includes('@')&&x!==fromEmail))],label=managerAction?'Returned by Finance · Manager Action Required':'Returned by Finance',page=managerAction?'manager-approval.html':module==='CAPEX'?'capex.html':'opex.html';await Promise.all(targets.map(toEmail=>{const ref=doc(collection(db,'messages'));return setDoc(ref,{kind:'notification',notificationType:'budget_workflow',status:'returned',module,department:cc,departmentName:name||cc,fromUid:user.uid,fromEmail,toEmail,subject:`Budget 2027 · ${module} · ${label}`,body:`${name||cc} (${cc}) · ${module} · ${label}`,note:'',revision:Number(revision||0),targetUrl:`${page}?department=${encodeURIComponent(cc)}`,read:false,createdAt:serverTimestamp(),clientCreatedAt:new Date().toISOString()})}))}

function installStyle(){
  if(document.getElementById('financeReturnStyle'))return;
  const s=document.createElement('style');s.id='financeReturnStyle';
  s.textContent=`.finance-return-btn{height:32px;border:1px solid #efb7b1;border-radius:7px;padding:0 10px;background:#fff0ee;color:#a53d35;font-size:9px;font-weight:1000;cursor:pointer;margin-left:6px}.finance-return-btn:hover{background:#ffe5e1}.finance-return-btn:disabled{opacity:.5;cursor:not-allowed}`;
  document.head.appendChild(s)
}

async function returnBudget(tr,btn){
  const user=auth.currentUser;if(!user||user.uid!==MAIN){alert('Main Admin only');return}
  const cc=String(tr.dataset.cc||'').trim(),module=String(tr.dataset.module||'OPEX').toUpperCase(),collectionName=module==='CAPEX'?'capex_budget_submissions':'opex_budget_submissions';if(!cc)return;
  try{
    btn.disabled=true;btn.textContent='Returning...';
    const [before,statusSnap]=await Promise.all([getDoc(doc(db,collectionName,cc)),getDoc(doc(db,'budget_submission_status',cc))]),submission=before.exists()?before.data()||{}:{},assignment=statusSnap.exists()?statusSnap.data()||{}:{},managerEmail=String(submission.managerEmail||assignment.managerEmail||'').trim().toLowerCase(),returnToManager=!!managerEmail;
    const approvedSnapshot=module==='OPEX'?await financeApprovedBudgetSnapshot(submission):null;
    await setDoc(doc(db,collectionName,cc),{
        workflowStatus:returnToManager?'pending_manager':'returned',status:returnToManager?'pending_manager':'returned',financeStatus:'returned',financeReturnPending:returnToManager,financeReturnNote:'',financeReturnedAt:serverTimestamp(),managerStatus:returnToManager?'pending':'returned',managerNote:returnToManager?'':submission.managerNote||'',managerApprovedAt:returnToManager?null:submission.managerApprovedAt||null,managerApprovedBy:returnToManager?null:submission.managerApprovedBy||null,managerApprovedByEmail:returnToManager?null:submission.managerApprovedByEmail||null,workflowUpdatedAt:serverTimestamp(),financeUpdatedBy:user.uid,financeUpdatedEmail:(user.email||'').toLowerCase()
        ,...(approvedSnapshot?{financeApprovedBudgetByGl:approvedSnapshot,financeApprovedSnapshotAt:serverTimestamp()}: {})
      },{merge:true});
    await notifyBudgetUsers({emails:returnToManager?[managerEmail]:[submission.submittedEmail,submission.submittedByEmail],cc,name:submission.departmentName||submission.name||cc,revision:submission.revision||0,module,managerAction:returnToManager});
    btn.textContent='Returned ✓';
    setTimeout(()=>location.reload(),350);
  }catch(e){
    btn.disabled=false;btn.textContent='Return';alert('Return failed: '+(e?.message||e));
  }
}

function enhance(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='submission-control.html')return;
  installStyle();
  document.querySelectorAll('#body tr[data-cc]').forEach(tr=>{
    const approved=!!tr.querySelector('.badge.approved');
    let btn=tr.querySelector('.finance-return-btn');
    if(!approved){if(btn)btn.remove();return}
    if(btn)return;
    const save=tr.querySelector('[data-save]');if(!save)return;
    btn=document.createElement('button');btn.type='button';btn.className='finance-return-btn';btn.textContent='Return';btn.title='Return this approved budget to the department for editing and re-upload';
    btn.onclick=()=>returnBudget(tr,btn);
    save.insertAdjacentElement('afterend',btn);
  })
}

let timer;function schedule(){clearTimeout(timer);timer=setTimeout(enhance,40)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('focus',schedule);
