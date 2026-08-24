import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim(),num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
let rows=[],loaded=false,loading=false;

function bytesFromBase64(value){const raw=atob(value||''),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function decode(raw,id){
  if(!raw)return null;
  if(raw.encoding==='gzip-base64-v1'){
    const stream=new Blob([bytesFromBase64(raw.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return {...JSON.parse(await new Response(stream).text()),cc:id};
  }
  if(raw.encoding==='json-v1')return {...JSON.parse(raw.payload||'{}'),cc:id};
  return {...raw,cc:id};
}
function merge(base,submitted){
  if(!base)return submitted||{};
  if(!submitted?.items)return base;
  const out={...base,items:{...(base.items||{})}};
  Object.entries(submitted.items||{}).forEach(([key,incoming])=>{
    const code=clean(incoming?.code||key),existing=out.items[code]||out.items[key]||{};
    out.items[code]={...existing,...incoming,code,newBudgetByMonth:{...(incoming?.newBudgetByMonth||{})}};
    if(code!==key)delete out.items[key];
  });
  return out;
}
function fy2027(item){return Object.entries(item?.newBudgetByMonth||{}).reduce((s,[k,v])=>String(k).startsWith('2027-')?s+num(v):s,0)}
function isTravel(code){const n=Number(clean(code));return Number.isFinite(n)&&n>=6020001&&n<=6020010}
function isProject(item,code){
  const text=[item?.name,item?.accountName,item?.glName,item?.description,item?.category,item?.label,item?.title,code].map(clean).join(' ').toUpperCase();
  return /(^|[^A-Z])PROJECTS?([^A-Z]|$)/.test(text);
}
function workflow(upload){return clean(upload?.workflowStatus||upload?.status||'uploaded').toLowerCase()||'uploaded'}
function esc(v){return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function badge(status){const label={uploaded:'Uploaded',pending_manager:'Pending Manager',manager_returned:'Manager Returned',manager_approved:'Manager Approved',submitted:'Submitted',under_review:'Finance Review',returned:'Returned',approved:'Approved'}[status]||status;const cls=status==='approved'?'good':status.includes('returned')?'bad':'warn';return `<span class="badge ${cls}">${esc(label)}</span>`}

function ensurePanel(){
  const overview=document.querySelector('.exec-panel[data-panel="overview"]');if(!overview)return null;
  let card=document.getElementById('cfoDepartmentBreakdown');if(card)return card;
  card=document.createElement('article');card.id='cfoDepartmentBreakdown';card.className='card panel-card';card.style.marginTop='14px';
  card.innerHTML=`<h2>Department Budget Breakdown</h2><p class="sub">Uploaded departments with their FY 2027 Project and Travel budget amounts.</p><div class="toolbar"><input id="cfoBreakdownSearch" type="search" placeholder="Search department or Fund Center..."><select id="cfoBreakdownFilter"><option value="all">All Uploaded</option><option value="project">Project Budget Only</option><option value="travel">Travel Budget Only</option></select></div><div class="table-wrap" style="max-height:520px"><table class="exec-table"><thead><tr><th>Department</th><th>Project FY 2027</th><th>Travel FY 2027</th><th>Other OPEX FY 2027</th><th>Total OPEX FY 2027</th><th>Status</th></tr></thead><tbody id="cfoBreakdownBody"><tr><td colspan="6" class="empty-state">Loading department breakdown...</td></tr></tbody></table></div>`;
  overview.appendChild(card);
  document.getElementById('cfoBreakdownSearch')?.addEventListener('input',render);
  document.getElementById('cfoBreakdownFilter')?.addEventListener('change',render);
  return card;
}
function render(){
  ensurePanel();const body=document.getElementById('cfoBreakdownBody');if(!body)return;
  const q=clean(document.getElementById('cfoBreakdownSearch')?.value).toLowerCase(),filter=document.getElementById('cfoBreakdownFilter')?.value||'all';
  let data=rows.filter(x=>(!q||`${x.cc} ${x.name}`.toLowerCase().includes(q))&&(filter==='all'||(filter==='project'&&Math.abs(x.project27)>.005)||(filter==='travel'&&Math.abs(x.travel27)>.005)));
  data=data.sort((a,b)=>b.total27-a.total27||a.name.localeCompare(b.name));
  if(!data.length){body.innerHTML='<tr><td colspan="6" class="empty-state">No uploaded departments match the selected filter.</td></tr>';return}
  const totals=data.reduce((o,x)=>{o.project27+=x.project27;o.travel27+=x.travel27;o.other27+=x.other27;o.total27+=x.total27;return o},{project27:0,travel27:0,other27:0,total27:0});
  body.innerHTML=data.map(x=>`<tr><td><b>${esc(x.name)}</b><br><small>${esc(x.cc)}</small></td><td class="num">${money(x.project27)}</td><td class="num">${money(x.travel27)}</td><td class="num">${money(x.other27)}</td><td class="num"><b>${money(x.total27)}</b></td><td>${badge(x.status)}</td></tr>`).join('')+`<tr><td><b>TOTAL</b><br><small>${data.length} Departments</small></td><td class="num"><b>${money(totals.project27)}</b></td><td class="num"><b>${money(totals.travel27)}</b></td><td class="num"><b>${money(totals.other27)}</b></td><td class="num"><b>${money(totals.total27)}</b></td><td></td></tr>`;
}
async function load(){
  if(loaded||loading)return;loading=true;ensurePanel();
  try{
    const [baseSnap,uploadSnap]=await Promise.all([getDocs(collection(db,'opex_baseline_departments')),getDocs(collection(db,'opex_budget_submissions'))]);
    const bases={},uploads={};baseSnap.forEach(s=>bases[s.id]=s.data()||{});uploadSnap.forEach(s=>uploads[s.id]=s.data()||{});
    const out=[];
    for(const [cc,upload] of Object.entries(uploads)){
      if(!cc||cc==='16')continue;
      let base=null,submitted=null;try{base=await decode(bases[cc],cc)}catch(e){console.warn('CFO breakdown baseline decode failed',cc,e)}try{submitted=await decode(upload,cc)}catch(e){console.warn('CFO breakdown submission decode failed',cc,e)}
      const data=merge(base,submitted)||submitted||base||{},items=Object.entries(data.items||{});let project27=0,travel27=0,total27=0;
      items.forEach(([raw,item])=>{const code=clean(item?.code||raw),value=fy2027(item);total27+=value;if(isTravel(code))travel27+=value;if(isProject(item,code))project27+=value});
      const name=clean(data.name||upload.name||upload.departmentName||bases[cc]?.name||cc),status=workflow(upload),other27=total27-project27-travel27;
      out.push({cc,name,status,project27,travel27,other27,total27});
    }
    rows=out;loaded=true;render();
  }catch(error){console.error('CFO department breakdown failed',error);const body=document.getElementById('cfoBreakdownBody');if(body)body.innerHTML=`<tr><td colspan="6" class="empty-state">Department breakdown could not load: ${esc(error.code||error.message||error)}</td></tr>`}
  finally{loading=false}
}
function start(user){if(!user)return;ensurePanel();load()}
ensurePanel();onAuthStateChanged(auth,start);window.addEventListener('dad-user-ready',e=>start(e.detail?.user||auth.currentUser));
