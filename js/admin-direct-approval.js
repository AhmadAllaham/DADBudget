import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',OPEX_KEY='dadBudgetOPEXBaselineV17';
const clean=v=>String(v??'').trim();
const cachedProfile=()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||{}}catch(_){return{}}};
const validCc=cc=>/^\d{8,12}$/.test(clean(cc));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function context(){
  const app=window.DADFirebase?.app||getApps()[0];if(!app)return null;
  const auth=window.DADFirebase?.auth||getAuth(app),user=auth.currentUser,profile=cachedProfile();
  if(!user||!(user.uid===MAIN||profile.isMainAdmin===true))return null;
  return{app,auth,user,profile,db:window.DADFirebase?.db||getFirestore(app)}
}
function approvalFields(user){
  const email=clean(user?.email).toLowerCase();
  return{workflowStatus:'approved',status:'approved',financeStatus:'approved',financeReturnPending:false,financeReturnNote:'',financeReturnedAt:null,managerStatus:'approved_by_finance',managerNote:'',financeUpdatedBy:user.uid,financeUpdatedEmail:email,workflowUpdatedAt:serverTimestamp(),approvedAt:serverTimestamp(),approvedBy:user.uid,approvedByEmail:email,directAdminEntry:true,directAdminApprovedAt:serverTimestamp()}
}
function budgetSnapshot(department={}){const out={};Object.entries(department.items||{}).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(code)out[code]={...(item?.newBudgetByMonth||{})}});return out}
function travelSnapshot(department={}){const out={};Object.entries(department.items||{}).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(/^60200(0[1-9]|10)$/.test(code))out[code]={...(item?.newBudgetByMonth||{})}});return out}
function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)}
async function encodeDepartment(department,cc){
  const raw=JSON.stringify({...department,cc});
  if(typeof CompressionStream!=='undefined'){
    const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes=new Uint8Array(await new Response(stream).arrayBuffer()),payload=bytesToBase64(bytes);
    if(new Blob([payload]).size<900000)return{encoding:'gzip-base64-v1',payload}
  }
  if(new Blob([raw]).size<900000)return{encoding:'json-v1',payload:raw};
  throw new Error('Department data is too large for Firestore')
}
function invalidateViews(cc,module){
  try{sessionStorage.removeItem('dadBudgetDashboardSubmissionCacheV1');sessionStorage.removeItem('dadBudgetOPEXSummaryCloudReadAt')}catch(_){}
  try{localStorage.setItem('dadBudgetDashboardRefreshToken',String(Date.now()))}catch(_){}
  if(module==='OPEX'&&cc){try{const states=JSON.parse(localStorage.getItem('dadBudgetOPEXSubmissionStatus')||'{}')||{};states[cc]='approved';localStorage.setItem('dadBudgetOPEXSubmissionStatus',JSON.stringify(states))}catch(_){}}
}
async function markCentralStatus(ctx,cc,module,name=''){
  try{await setDoc(doc(ctx.db,'budget_submission_status',cc),{cc,departmentName:clean(name||cc),workflowStatus:'approved',status:'approved',financeStatus:'approved',directAdminEntry:true,directAdminModule:module,financeUpdatedBy:ctx.user.uid,financeUpdatedEmail:clean(ctx.user.email).toLowerCase(),workflowUpdatedAt:serverTimestamp()},{merge:true})}catch(e){console.warn('Central admin approval status update skipped',e)}
}
function setOpexApprovedStatus(fileName){const el=document.getElementById('opexUploadStatus');if(el){el.textContent=`${clean(fileName||'Admin OPEX Entry')} · Approved`;el.classList.remove('error');el.classList.add('ready')}}
function suppressAdminSubmit(){
  if(!context())return;
  [...document.querySelectorAll('button')].forEach(btn=>{const text=clean(btn.textContent).toLowerCase();if(['submit budget','submit','under review','sending for review...','submitting...'].includes(text)){btn.disabled=true;btn.hidden=true;btn.style.setProperty('display','none','important');btn.dataset.adminAutoApproved='1'}})
}

async function approveOpexModel(model,fileName=''){
  const ctx=context(),cc=clean(model?.lastUploadedDepartment),department=model?.departments?.[cc];
  if(!ctx||!validCc(cc)||!department)return false;
  const subRef=doc(ctx.db,'opex_budget_submissions',cc),prev=await getDoc(subRef),prevData=prev.exists()?prev.data()||{}:{},desiredFile=clean(fileName||model.fileName||'Admin OPEX Entry');
  if(prev.exists()&&prevData.directAdminEntry===true&&clean(prevData.workflowStatus).toLowerCase()==='approved'&&clean(prevData.fileName)===desiredFile&&Number(prevData.sourceClientParsedAt||0)===Number(model.clientParsedAt||0)){
    await markCentralStatus(ctx,cc,'OPEX',department.name||cc);invalidateViews(cc,'OPEX');setOpexApprovedStatus(desiredFile);suppressAdminSubmit();return true
  }
  const encoded=await encodeDepartment(department,cc),revision=Number(prevData.revision||0)+1,email=clean(ctx.user.email).toLowerCase(),snapshot=budgetSnapshot(department),travel=travelSnapshot(department);
  await setDoc(subRef,{cc,fundCenter:cc,name:clean(department.name||cc),departmentName:clean(department.name||cc),encoding:encoded.encoding,payload:encoded.payload,fileName:desiredFile,revision,travelBudgetByGl:travel,financeApprovedBudgetByGl:snapshot,financeApprovedSnapshotAt:serverTimestamp(),submittedBy:ctx.user.uid,submittedByEmail:email,submittedEmail:email,submittedAt:serverTimestamp(),clientSubmittedAt:new Date().toISOString(),sourceClientParsedAt:Number(model.clientParsedAt||Date.now()),...approvalFields(ctx.user)},{merge:true});
  await markCentralStatus(ctx,cc,'OPEX',department.name||cc);invalidateViews(cc,'OPEX');setOpexApprovedStatus(desiredFile);suppressAdminSubmit();window.dispatchEvent(new CustomEvent('dad-admin-direct-budget-approved',{detail:{module:'OPEX',cc,status:'approved'}}));return true
}

async function captureAdminOpexUpload(file,startedAt){
  if(!context()||!file)return;
  for(let i=0;i<80;i++){
    await sleep(100);
    let model=null;try{model=JSON.parse(localStorage.getItem(OPEX_KEY)||'null')}catch(_){}
    if(!model||clean(model.fileName)!==clean(file.name)||Number(model.clientParsedAt||0)<startedAt)continue;
    const cc=clean(model.lastUploadedDepartment);
    if(!validCc(cc)||!model.departments?.[cc])return;
    try{await approveOpexModel(model,file.name)}catch(err){console.error('Admin direct OPEX approval failed',err);const el=document.getElementById('opexUploadStatus');if(el){el.textContent=`Admin approval failed: ${err?.code||err?.message||err}`;el.classList.add('error')}}
    return
  }
}

async function approveDirectCapex(cc){
  const ctx=context();cc=clean(cc);if(!ctx||!validCc(cc))return;
  const ref=doc(ctx.db,'capex_budget_submissions',cc),snap=await getDoc(ref);if(!snap.exists())return;const data=snap.data()||{},email=clean(ctx.user.email).toLowerCase();
  if(!(data.directAdminEntry===true&&clean(data.workflowStatus).toLowerCase()==='approved'))await setDoc(ref,{...approvalFields(ctx.user),financeNote:'Approved automatically because the budget was entered directly by Main Admin.',financeApprovedAt:serverTimestamp(),financeApprovedBy:ctx.user.uid,financeApprovedByEmail:email},{merge:true});
  await markCentralStatus(ctx,cc,'CAPEX',data.departmentName||cc);invalidateViews(cc,'CAPEX');
  const mirrorRef=doc(ctx.db,'capex_it_requests',cc);try{await setDoc(mirrorRef,{workflowStatus:'approved',status:'approved',financeStatus:'approved',updatedBy:ctx.user.uid,updatedByEmail:email,updatedAt:serverTimestamp()},{merge:true})}catch(e){console.warn('Admin direct CAPEX mirror approval skipped',e)}
  const el=document.getElementById('capexStatus');if(el){el.textContent=`${clean(data.fileName||'CAPEX')} · Approved`;el.classList.remove('error');el.classList.add('ready')}
  window.dispatchEvent(new CustomEvent('dad-admin-direct-budget-approved',{detail:{module:'CAPEX',cc,status:'approved'}}))
}
function hookCapex(){
  if(!/capex\.html$/i.test((location.pathname||'').split('?')[0]))return;
  let tries=0;const timer=setInterval(()=>{tries++;const api=window.DADCapexCloud;if(!api?.saveSubmission){if(tries>80)clearInterval(timer);return}if(api.saveSubmission.__adminDirectApproval){clearInterval(timer);return}const original=api.saveSubmission.bind(api);const wrapped=async(parsed,fileName)=>{const revision=await original(parsed,fileName);if(context())await approveDirectCapex(parsed?.cc);return revision};wrapped.__adminDirectApproval=true;api.saveSubmission=wrapped;clearInterval(timer)},125)
}
function hookOpex(){
  if(!/opex\.html$/i.test((location.pathname||'').split('?')[0]))return;
  const bind=()=>{const input=document.getElementById('opexUploadInput');if(!input||input.dataset.adminDirectApprovalBound==='1')return;input.dataset.adminDirectApprovalBound='1';input.addEventListener('change',()=>{const file=input.files?.[0],startedAt=Date.now();if(file&&context())captureAdminOpexUpload(file,startedAt).catch(err=>console.error('Admin OPEX upload capture failed',err))})};
  bind();new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('dad-user-ready',()=>{suppressAdminSubmit();bind()});
  setTimeout(suppressAdminSubmit,400);setTimeout(suppressAdminSubmit,1200)
}
hookOpex();hookCapex();
