import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
const weights={not_submitted:0,uploaded:25,submitted:45,under_review:70,returned:50,approved:100};
const labels={not_submitted:'Not Submitted',uploaded:'Uploaded',submitted:'Submitted',under_review:'Under Review',returned:'Returned',approved:'Approved'};
function statusOf(st,hasUpload){return st?.status||(hasUpload?'uploaded':'not_submitted')}
function ensureSection(){
  let s=document.getElementById('submissionStatusSection');if(s)return s;
  s=document.createElement('section');s.id='submissionStatusSection';s.className='card roadmap-preview';
  s.innerHTML='<div class="section-head"><div><span class="eyebrow">SUBMISSION STATUS</span><h2>Your Budget Workflow</h2><p id="submissionSummary" style="margin:4px 0 0;color:#71878b;font-size:11px">Loading...</p></div><a id="submissionAdminLink" class="teal-btn" href="submission-control.html" style="display:none;text-decoration:none;align-items:center">Submission Control</a></div><div id="submissionStatusGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:12px"></div>';
  const road=document.querySelector('.roadmap-preview:last-of-type');road?.parentNode?.insertBefore(s,road);return s;
}
async function readAssigned(ids){
  const statuses={},uploads={};
  await Promise.all(ids.map(async cc=>{
    const [ss,us]=await Promise.all([
      getDoc(doc(db,'budget_submission_status',cc)),
      getDoc(doc(db,'opex_budget_submissions',cc))
    ]);
    if(ss.exists())statuses[cc]=ss.data();
    if(us.exists())uploads[cc]=us.data();
  }));
  return{statuses,uploads};
}
async function readAdmin(){
  const [statusSnap,uploadSnap]=await Promise.all([
    getDocs(collection(db,'budget_submission_status')),
    getDocs(collection(db,'opex_budget_submissions'))
  ]),statuses={},uploads={};
  statusSnap.forEach(x=>statuses[x.id]=x.data());
  uploadSnap.forEach(x=>uploads[x.id]=x.data());
  return{statuses,uploads};
}
async function load(user){
  const s=ensureSection(),summary=document.getElementById('submissionSummary'),grid=document.getElementById('submissionStatusGrid');
  summary.textContent='Loading your department workflow...';grid.innerHTML='';
  try{
    const ps=await getDoc(doc(db,'users',user.uid));
    if(!ps.exists())throw new Error('User profile not found in Firestore.');
    const p=ps.data()||{},admin=user.uid===MAIN||p.role==='admin'||p.isMainAdmin===true,link=document.getElementById('submissionAdminLink');
    if(admin)link.style.display='inline-flex';
    const assigned=Array.isArray(p.departments)?p.departments.map(String).filter(x=>x&&x!=='ALL'):[];
    let statuses={},uploads={},ids=[];
    if(admin){
      ({statuses,uploads}=await readAdmin());
      ids=[...new Set([...Object.keys(statuses),...Object.keys(uploads)])];
    }else{
      ids=[...new Set(assigned)];
      if(!ids.length){summary.textContent='No departments assigned.';return}
      ({statuses,uploads}=await readAssigned(ids));
    }
    if(!ids.length){summary.textContent=admin?'No department submissions yet.':'No departments assigned.';return}
    let total=0,submittedCount=0;
    const cards=ids.map(cc=>{
      const st=statusOf(statuses[cc],!!uploads[cc]),name=statuses[cc]?.departmentName||uploads[cc]?.name||cc,w=weights[st]??0;
      total+=w;if(['submitted','under_review','approved'].includes(st))submittedCount++;
      return `<div style="border:1px solid #d9e9e6;border-radius:10px;padding:10px 12px;background:#fbfdfd"><div style="font-size:9px;color:#74898d;font-weight:900">${cc}</div><div style="font-size:12px;font-weight:1000;color:#173f46;margin-top:2px">${name}</div><div style="margin-top:8px;display:flex;justify-content:space-between;gap:8px;align-items:center"><span style="font-size:9px;font-weight:1000;color:#087a64">${labels[st]||st}</span><span style="font-size:9px;color:#74898d">${w}%</span></div><div style="height:6px;border-radius:999px;background:#e7efee;margin-top:6px;overflow:hidden"><div style="height:100%;width:${w}%;background:#12a397"></div></div>${statuses[cc]?.note?`<div style="font-size:8px;color:#7b8f92;margin-top:6px">${statuses[cc].note}</div>`:''}${uploads[cc]?.fileName?`<div style="font-size:8px;color:#7b8f92;margin-top:4px">Latest upload: ${uploads[cc].fileName}${uploads[cc].revision?` · R${uploads[cc].revision}`:''}</div>`:''}</div>`;
    }).join('');
    const progress=Math.round(total/ids.length);grid.innerHTML=cards;summary.textContent=`${ids.length} department(s) · Overall workflow progress ${progress}%`;
    const kpi=[...document.querySelectorAll('.kpi-card')].find(x=>x.querySelector('span')?.textContent.trim()==='Budget Progress');
    if(kpi){kpi.querySelector('strong').textContent=progress+'%';kpi.querySelector('small').textContent=`${submittedCount} / ${ids.length} departments submitted`}
  }catch(e){
    console.error('Dashboard submission status failed',e);
    summary.textContent=`Workflow load failed: ${e.code||e.message||'Unknown error'}`;
    grid.innerHTML='';
  }
}
let lastUid='';
function run(user){if(!user)return;if(lastUid===user.uid&&document.getElementById('submissionStatusGrid')?.children.length)return;lastUid=user.uid;load(user)}
onAuthStateChanged(auth,user=>{if(user)run(user)});
window.addEventListener('dad-user-ready',e=>{const u=e.detail?.user||auth.currentUser;if(u)run(u)});
