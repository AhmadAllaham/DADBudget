import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',OPEX_KEY='dadBudgetOPEXBaselineV17';
const clean=v=>String(v??'').trim();
const cachedProfile=()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||{}}catch(_){return{}}};
const validCc=cc=>/^\d{8,12}$/.test(clean(cc));

function context(){
  const app=window.DADFirebase?.app||getApps()[0];if(!app)return null;
  const auth=window.DADFirebase?.auth||getAuth(app),user=auth.currentUser,profile=cachedProfile();
  if(!user||!(user.uid===MAIN||profile.isMainAdmin===true))return null;
  return{app,auth,user,profile,db:window.DADFirebase?.db||getFirestore(app)}
}
function approvalFields(user){const email=clean(user?.email).toLowerCase();return{workflowStatus:'approved',status:'approved',financeStatus:'approved',financeReturnPending:false,financeReturnNote:'',financeReturnedAt:null,managerStatus:'approved_by_finance',managerNote:'',financeUpdatedBy:user.uid,financeUpdatedEmail:email,workflowUpdatedAt:serverTimestamp(),approvedAt:serverTimestamp(),approvedBy:user.uid,approvedByEmail:email,directAdminEntry:true,directAdminApprovedAt:serverTimestamp()}}
function budgetSnapshot(department={}){const out={};Object.entries(department.items||{}).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(code)out[code]={...(item?.newBudgetByMonth||{})}});return out}
function travelSnapshot(department={}){const out={};Object.entries(department.items||{}).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(/^60200(0[1-9]|10)$/.test(code))out[code]={...(item?.newBudgetByMonth||{})}});return out}

async function approveDirectOpex(fileName=''){
  const ctx=context();if(!ctx)return;
  let model=null;try{model=JSON.parse(localStorage.getItem(OPEX_KEY)||'null')}catch(_){}
  const cc=clean(model?.lastUploadedDepartment),department=model?.departments?.[cc];if(!validCc(cc)||!department)return;
  const baseRef=doc(ctx.db,'opex_baseline_departments',cc),subRef=doc(ctx.db,'opex_budget_submissions',cc),[base,prev]=await Promise.all([getDoc(baseRef),getDoc(subRef)]);if(!base.exists())return;
  const revision=Number(prev.exists()?prev.data()?.revision||0:0)+1,email=clean(ctx.user.email).toLowerCase(),baseData=base.data()||{},snapshot=budgetSnapshot(department),travel=travelSnapshot(department);
  await setDoc(subRef,{cc,name:clean(department.name||cc),encoding:baseData.encoding,payload:baseData.payload,fileName:clean(fileName||model.fileName||'Admin OPEX Entry'),revision,travelBudgetByGl:travel,financeApprovedBudgetByGl:snapshot,financeApprovedSnapshotAt:serverTimestamp(),submittedBy:ctx.user.uid,submittedByEmail:email,submittedEmail:email,submittedAt:serverTimestamp(),clientSubmittedAt:new Date().toISOString(),...approvalFields(ctx.user)},{merge:true});
  const el=document.getElementById('opexUploadStatus');if(el){el.textContent=`${clean(fileName||model.fileName||'OPEX')} · Approved`;el.classList.remove('error');el.classList.add('ready')}
  window.dispatchEvent(new CustomEvent('dad-admin-direct-budget-approved',{detail:{module:'OPEX',cc}}));
}

async function approveDirectCapex(cc){
  const ctx=context();cc=clean(cc);if(!ctx||!validCc(cc))return;
  const ref=doc(ctx.db,'capex_budget_submissions',cc),snap=await getDoc(ref);if(!snap.exists())return;const data=snap.data()||{},email=clean(ctx.user.email).toLowerCase();
  await setDoc(ref,{...approvalFields(ctx.user),financeNote:'Approved automatically because the budget was entered directly by Main Admin.',financeApprovedAt:serverTimestamp(),financeApprovedBy:ctx.user.uid,financeApprovedByEmail:email},{merge:true});
  const mirrorRef=doc(ctx.db,'capex_it_requests',cc);try{await setDoc(mirrorRef,{workflowStatus:'approved',updatedBy:ctx.user.uid,updatedByEmail:email,updatedAt:serverTimestamp()},{merge:true})}catch(e){console.warn('Admin direct CAPEX mirror approval skipped',e)}
  const el=document.getElementById('capexStatus');if(el){el.textContent=`${clean(data.fileName||'CAPEX')} · Approved`;el.classList.remove('error');el.classList.add('ready')}
  window.dispatchEvent(new CustomEvent('dad-admin-direct-budget-approved',{detail:{module:'CAPEX',cc}}));
}

function hookCapex(){
  if(!/capex\.html$/i.test((location.pathname||'').split('?')[0]))return;
  let tries=0;const timer=setInterval(()=>{tries++;const api=window.DADCapexCloud;if(!api?.saveSubmission){if(tries>80)clearInterval(timer);return}if(api.saveSubmission.__adminDirectApproval){clearInterval(timer);return}const original=api.saveSubmission.bind(api);const wrapped=async(parsed,fileName)=>{const revision=await original(parsed,fileName);const ctx=context();if(ctx)await approveDirectCapex(parsed?.cc);return revision};wrapped.__adminDirectApproval=true;api.saveSubmission=wrapped;clearInterval(timer)},125)
}
function hookOpex(){if(!/opex\.html$/i.test((location.pathname||'').split('?')[0]))return;window.addEventListener('dad-opex-baseline-published',e=>approveDirectOpex(e.detail?.fileName).catch(err=>console.warn('Admin direct OPEX approval failed',err)))}

hookOpex();hookCapex();
