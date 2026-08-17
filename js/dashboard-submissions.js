import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
const workflowWeights={not_submitted:0,uploaded:25,pending_manager:40,manager_returned:35,manager_approved:55,submitted:55,under_review:75,returned:50,approved:100};
const labels={not_submitted:'Not Submitted',uploaded:'Uploaded',pending_manager:'Pending Manager Approval',manager_returned:'Returned by Manager',manager_approved:'Manager Approved',submitted:'Submitted',under_review:'Finance Review',returned:'Returned by Finance',approved:'Approved'};
const WORKFLOW_SHARE=70,SALARIES_SHARE=15,DEPRECIATION_SHARE=15;
function statusOf(st,hasUpload){return st?.status||st?.workflowStatus||(hasUpload?'uploaded':'not_submitted')}
function departmentProgress(st,hasUpload){const workflow=statusOf(st,hasUpload),workflowPct=workflowWeights[workflow]??0;return Math.round((workflowPct/100)*WORKFLOW_SHARE+(st?.salariesReady===true?SALARIES_SHARE:0)+(st?.depreciationReady===true?DEPRECIATION_SHARE:0))}
function inputTag(label,ready){return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 6px;border-radius:999px;background:${ready?'#eaf8f4':'#f2f4f5'};color:${ready?'#087a64':'#71878b'};font-size:8px;font-weight:1000">${label}: ${ready?'Loaded':'Finance Pending'}</span>`}
function ensureSection(){
  let s=document.getElementById('submissionStatusSection');if(s)return s;
  s=document.createElement('section');s.id='submissionStatusSection';s.className='card roadmap-preview';
  s.innerHTML='<div class="section-head"><div><span class="eyebrow">SUBMISSION STATUS</span><h2>Your Budget Workflow</h2><p id="submissionSummary" style="margin:4px 0 0;color:#71878b;font-size:11px">Loading...</p></div><div style="display:flex;gap:7px"><a id="managerApprovalLink" class="teal-btn" href="manager-approval.html" style="display:none;text-decoration:none;align-items:center">Approval Center</a><a id="submissionAdminLink" class="teal-btn" href="submission-control.html" style="display:none;text-decoration:none;align-items:center">Submission Control</a></div></div><div id="submissionStatusGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin-top:12px"></div>';
  const road=document.querySelector('.roadmap-preview:last-of-type');road?.parentNode?.insertBefore(s,road);return s;
}
function buildDepartmentNameMap(profile={}){
  const map={};
  const deps=Array.isArray(profile.departments)?profile.departments.map(String):[];
  const labs=Array.isArray(profile.departmentLabels)?profile.departmentLabels:[];
  labs.forEach((raw,i)=>{const text=String(raw||'').trim();if(!text)return;let cc=deps[i]||'',name=text;const m=text.match(/^\s*([^·|]+?)\s*[·|]\s*(.+)$/);if(m){cc=String(m[1]||'').trim();name=String(m[2]||'').trim()}if(cc&&name&&name!==cc)map[String(cc)]=name});
  if(profile.department&&profile.departmentLabel&&!map[String(profile.department)]){const text=String(profile.departmentLabel||'').trim(),m=text.match(/^\s*([^·|]+?)\s*[·|]\s*(.+)$/);map[String(profile.department)]=m?String(m[2]||'').trim():text}
  return map;
}
async function readAssigned(ids){const statuses={},uploads={};await Promise.all(ids.map(async cc=>{const [ss,us]=await Promise.all([getDoc(doc(db,'budget_submission_status',cc)),getDoc(doc(db,'opex_budget_submissions',cc))]);if(ss.exists())statuses[cc]=ss.data();if(us.exists())uploads[cc]=us.data()}));return{statuses,uploads}}
async function readAdmin(){const [statusSnap,uploadSnap]=await Promise.all([getDocs(collection(db,'budget_submission_status')),getDocs(collection(db,'opex_budget_submissions'))]),statuses={},uploads={};statusSnap.forEach(x=>statuses[x.id]=x.data());uploadSnap.forEach(x=>uploads[x.id]=x.data());return{statuses,uploads}}
async function load(user){
  ensureSection();const summary=document.getElementById('submissionSummary'),grid=document.getElementById('submissionStatusGrid');summary.textContent='Loading your department workflow...';grid.innerHTML='';
  try{
    const ps=await getDoc(doc(db,'users',user.uid));if(!ps.exists())throw new Error('User profile not found in Firestore.');
    const p=ps.data()||{},admin=user.uid===MAIN||p.role==='admin'||p.isMainAdmin===true,manager=p.role==='manager';
    document.getElementById('submissionAdminLink').style.display=admin?'inline-flex':'none';
    document.getElementById('managerApprovalLink').style.display=(manager||admin)?'inline-flex':'none';
    const assigned=Array.isArray(p.departments)?p.departments.map(String).filter(x=>x&&x!=='ALL'):[],profileNames=buildDepartmentNameMap(p);let statuses={},uploads={},ids=[];
    if(admin){({statuses,uploads}=await readAdmin());ids=[...new Set([...Object.keys(statuses),...Object.keys(uploads)])]}else{ids=[...new Set(assigned)];if(!ids.length){summary.textContent='No departments assigned.';return}({statuses,uploads}=await readAssigned(ids))}
    if(!ids.length){summary.textContent=admin?'No department submissions yet.':'No departments assigned.';return}
    let total=0,submittedCount=0,pendingManager=0,managerApproved=0;
    const cards=ids.map(cc=>{
      const upload=uploads[cc]||{},data={...upload,...(statuses[cc]||{})},st=statusOf(data,!!uploads[cc]),name=data.departmentName||upload.name||profileNames[cc]||cc,w=departmentProgress(data,!!uploads[cc]);total+=w;
      if(['manager_approved','submitted','under_review','approved'].includes(st))submittedCount++;if(st==='pending_manager')pendingManager++;if(st==='manager_approved')managerApproved++;
      const workflowContribution=Math.round(((workflowWeights[st]??0)/100)*WORKFLOW_SHARE);
      const managerInfo=data.managerEmail?`<div style="font-size:8px;color:#7b8f92;margin-top:5px">Manager: ${data.managerEmail}</div>`:'';
      const managerNote=data.managerNote?`<div style="font-size:8px;color:${st==='manager_returned'?'#a63b3b':'#7b8f92'};margin-top:5px">Manager note: ${data.managerNote}</div>`:'';
      return `<div style="border:1px solid #d9e9e6;border-radius:10px;padding:12px 14px;background:#fbfdfd"><div style="font-size:9px;color:#74898d;font-weight:900">${cc}</div><div style="font-size:12px;font-weight:1000;color:#173f46;margin-top:2px">${name}</div><div style="margin-top:8px;display:flex;justify-content:space-between;gap:8px;align-items:center"><span style="font-size:9px;font-weight:1000;color:${st==='manager_returned'?'#a63b3b':'#087a64'}">${labels[st]||st}</span><span style="font-size:9px;color:#173f46;font-weight:1000">${w}%</span></div><div style="height:7px;border-radius:999px;background:#e7efee;margin-top:6px;overflow:hidden"><div style="height:100%;width:${w}%;background:#12a397"></div></div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px"><span style="display:inline-flex;padding:4px 6px;border-radius:999px;background:#eef7ff;color:#225c8e;font-size:8px;font-weight:1000">Workflow: ${workflowContribution}/${WORKFLOW_SHARE}</span>${inputTag('Salaries',data.salariesReady===true)}${inputTag('Depreciation',data.depreciationReady===true)}</div>${managerInfo}${managerNote}${data.note?`<div style="font-size:8px;color:#7b8f92;margin-top:6px">Finance note: ${data.note}</div>`:''}${upload.fileName?`<div style="font-size:8px;color:#7b8f92;margin-top:4px">Latest upload: ${upload.fileName}${upload.revision?` · R${upload.revision}`:''}</div>`:''}</div>`;
    }).join('');
    const progress=Math.round(total/ids.length);grid.innerHTML=cards;summary.textContent=manager?`${pendingManager} awaiting your approval · ${managerApproved} manager approved · Overall progress ${progress}%`:`${ids.length} department(s) · ${pendingManager} waiting for manager approval · Overall progress ${progress}%`;
    const kpi=[...document.querySelectorAll('.kpi-card')].find(x=>x.querySelector('span')?.textContent.trim()==='Budget Progress');if(kpi){kpi.querySelector('strong').textContent=progress+'%';kpi.querySelector('small').textContent=`${submittedCount} / ${ids.length} passed manager stage · central inputs included`}
  }catch(e){console.error('Dashboard submission status failed',e);summary.textContent=`Workflow load failed: ${e.code||e.message||'Unknown error'}`;grid.innerHTML=''}
}
let lastUid='';function run(user){if(!user)return;if(lastUid===user.uid&&document.getElementById('submissionStatusGrid')?.children.length)return;lastUid=user.uid;load(user)}
onAuthStateChanged(auth,user=>{if(user)run(user)});window.addEventListener('dad-user-ready',e=>{const u=e.detail?.user||auth.currentUser;if(u)run(u)});
