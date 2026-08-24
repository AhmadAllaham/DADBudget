import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim(),num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
let rows=[],loaded=false,loading=false,hideZero=true,productionIds=new Set();

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
function fy2027(item){return Object.entries(item?.newBudgetByMonth||{}).reduce((s,[k,v])=>String(k).startsWith('2027-')?s+num(v):s,0)}
function isTravel(code){const n=Number(clean(code));return Number.isFinite(n)&&n>=6020001&&n<=6020010}
function isProject(item,code){
  const text=[item?.name,item?.accountName,item?.glName,item?.description,item?.category,item?.label,item?.title,code].map(clean).join(' ').toUpperCase();
  return /(^|[^A-Z])PROJECTS?([^A-Z]|$)/.test(text);
}
function workflow(upload){return clean(upload?.workflowStatus||upload?.status||'uploaded').toLowerCase()||'uploaded'}
function esc(v){return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function badge(status){const label={uploaded:'Uploaded',pending_manager:'Pending Manager',manager_returned:'Manager Returned',manager_approved:'Manager Approved',submitted:'Submitted',under_review:'Finance Review',returned:'Returned',approved:'Approved',mixed:'Mixed Status'}[status]||status;const cls=status==='approved'?'good':status.includes('returned')?'bad':status==='mixed'?'':'warn';return `<span class="badge ${cls}">${esc(label)}</span>`}

async function ensureProductionIds(){
  if(productionIds.size)return productionIds;
  if(window.DADDepartmentGroups?.groups?.PRODUCTION?.ids){productionIds=new Set(window.DADDepartmentGroups.groups.PRODUCTION.ids.map(String));return productionIds}
  await new Promise(resolve=>{
    let script=document.querySelector('script[data-cfo-department-groups]');
    if(script){script.addEventListener('load',resolve,{once:true});setTimeout(resolve,700);return}
    script=document.createElement('script');script.src='js/department-groups.js?v=20260824-cfo-production-1';script.dataset.cfoDepartmentGroups='1';script.onload=resolve;script.onerror=resolve;document.head.appendChild(script)
  });
  productionIds=new Set((window.DADDepartmentGroups?.groups?.PRODUCTION?.ids||[]).map(String));
  return productionIds
}

function injectPremiumStyle(){
  if(document.getElementById('cfoPremiumOverviewStyle'))return;
  const style=document.createElement('style');style.id='cfoPremiumOverviewStyle';style.textContent=`
  .exec-panel[data-panel="overview"]>.kpi-grid.cfo-premium-kpis{grid-template-columns:repeat(4,minmax(180px,1fr));gap:14px;margin-bottom:20px}
  .cfo-premium-kpis .exec-kpi{position:relative;overflow:hidden;min-height:138px;padding:21px 20px 18px;border:1px solid rgba(12,112,103,.16);border-radius:17px;background:linear-gradient(145deg,#ffffff 0%,#fbfefd 62%,#eefaf7 100%);box-shadow:0 10px 28px rgba(18,65,68,.08)}
  .cfo-premium-kpis .exec-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#0b847b,#34c7ba)}
  .cfo-premium-kpis .exec-kpi:after{content:"EXECUTIVE KPI";position:absolute;right:14px;top:13px;font-size:8px;font-weight:1000;letter-spacing:.13em;color:#a2b6b7}
  .cfo-premium-kpis .exec-kpi span{font-size:11px;letter-spacing:.07em;color:#597278}
  .cfo-premium-kpis .exec-kpi strong{margin-top:15px;font-size:29px;letter-spacing:-.025em;color:#0a3560}
  .cfo-premium-kpis .exec-kpi small{margin-top:8px;font-size:11px;color:#6b8488}
  .cfo-premium-kpis .cfo-sales-card{grid-column:span 2;background:linear-gradient(135deg,#0b3563 0%,#0a596b 58%,#0b847b 100%);border-color:transparent;box-shadow:0 14px 32px rgba(10,53,96,.18)}
  .cfo-premium-kpis .cfo-sales-card:before{background:rgba(255,255,255,.85)}
  .cfo-premium-kpis .cfo-sales-card:after{color:rgba(255,255,255,.48)}
  .cfo-premium-kpis .cfo-sales-card span,.cfo-premium-kpis .cfo-sales-card small{color:rgba(255,255,255,.78)}
  .cfo-premium-kpis .cfo-sales-card strong{color:#fff}
  .planning-summary.cfo-planning-premium{margin-top:0;margin-bottom:16px}
  .cfo-planning-premium .planning-summary-head{margin-bottom:12px}
  .cfo-planning-premium .planning-summary-head h2{font-size:22px}
  .cfo-planning-premium .planning-summary-head p{font-size:13px}
  .cfo-planning-premium .planning-summary-card{padding:19px;min-height:176px;border-radius:14px}
  .cfo-planning-premium .planning-summary-card h3{font-size:18px}
  .cfo-planning-premium .plan-chip{font-size:10px!important;padding:6px 9px!important}
  .cfo-planning-premium .plan-metric{padding:10px 11px}
  .cfo-planning-premium .plan-metric span{font-size:11px}
  .cfo-planning-premium .plan-metric strong{font-size:18px}
  .cfo-planning-premium .plan-metric small{font-size:10px}
  #cfoDepartmentBreakdown{margin-top:0!important;margin-bottom:16px;border-radius:14px}
  #cfoDepartmentBreakdown h2{font-size:21px}
  #cfoDepartmentBreakdown .cfo-zero-toggle{height:40px;border:1px solid #b8d9d5;border-radius:9px;background:#eaf8f6;color:#08766d;padding:0 13px;font-size:12px;font-weight:1000;cursor:pointer}
  #cfoDepartmentBreakdown .cfo-zero-toggle.off{background:#fff;color:#587177}
  #cfoDepartmentBreakdown tr.production-summary td{background:#effaf8;font-weight:900}
  .exec-panel[data-panel="departments"] .panel-card{padding:22px;border-radius:16px;box-shadow:0 10px 30px rgba(18,65,68,.07)}
  .exec-panel[data-panel="departments"] .panel-card h2{font-size:24px;letter-spacing:-.02em;color:#123e63}
  .exec-panel[data-panel="departments"] .panel-card .sub{font-size:13.5px;line-height:1.55;color:#667f84;margin-bottom:17px}
  .exec-panel[data-panel="departments"] .toolbar{margin-bottom:15px}
  .exec-panel[data-panel="departments"] .toolbar input,.exec-panel[data-panel="departments"] .toolbar select{height:43px;border-radius:10px;font-size:13px;font-weight:850;border-color:#c7ddda;box-shadow:0 2px 7px rgba(25,82,82,.035)}
  .exec-panel[data-panel="departments"] .table-wrap{max-height:650px;border-radius:14px;border-color:#d3e5e2;box-shadow:0 7px 22px rgba(20,67,70,.055)}
  .exec-panel[data-panel="departments"] .exec-table{font-size:13.5px}
  .exec-panel[data-panel="departments"] .exec-table th{padding:14px 12px;background:linear-gradient(180deg,#0a3568,#092e5b);font-size:11.5px;font-weight:1000;letter-spacing:.025em;text-transform:uppercase}
  .exec-panel[data-panel="departments"] .exec-table td{padding:13px 12px;color:#29474d;font-weight:720}
  .exec-panel[data-panel="departments"] .exec-table td:first-child{min-width:235px}
  .exec-panel[data-panel="departments"] .exec-table td:first-child b{font-size:14px;color:#173f47;font-weight:1000}
  .exec-panel[data-panel="departments"] .exec-table td:first-child small{display:inline-block;margin-top:4px;color:#819397;font-size:10.5px;font-weight:800;letter-spacing:.02em}
  .exec-panel[data-panel="departments"] .exec-table td.num{font-size:13px;font-weight:950;color:#1e4b58}
  .exec-panel[data-panel="departments"] .exec-table td:nth-child(8){background:#f1faf7;color:#08715f;font-weight:1000}
  .exec-panel[data-panel="departments"] .exec-table tbody tr:hover td{background:#effbf9}
  .exec-panel[data-panel="departments"] .exec-table tbody tr:hover td:nth-child(8){background:#e6f8f2}
  .exec-panel[data-panel="departments"] .badge.good{padding:6px 10px;font-size:10.5px;background:#e4f7ef;color:#06715c;border:1px solid #c8eadf}
  .exec-panel[data-panel="departments"] .cfo-dept-total td{position:sticky;bottom:0;z-index:3;background:#0a2f5e!important;color:#fff!important;border-top:2px solid #08264c;font-weight:1000;box-shadow:0 -5px 14px rgba(10,47,94,.12)}
  .exec-panel[data-panel="departments"] .cfo-dept-total td:nth-child(8){background:#0b665f!important;color:#fff!important}
  .exec-panel[data-panel="departments"] .cfo-dept-total small{color:rgba(255,255,255,.72)!important}
  @media(max-width:1100px){.exec-panel[data-panel="overview"]>.kpi-grid.cfo-premium-kpis{grid-template-columns:repeat(2,1fr)}.cfo-premium-kpis .cfo-sales-card{grid-column:span 2}}
  @media(max-width:650px){.exec-panel[data-panel="overview"]>.kpi-grid.cfo-premium-kpis{grid-template-columns:1fr}.cfo-premium-kpis .cfo-sales-card{grid-column:span 1}}
  `;document.head.appendChild(style)
}

function arrangeOverview(){
  injectPremiumStyle();
  const overview=document.querySelector('.exec-panel[data-panel="overview"]');if(!overview)return;
  const grid=overview.querySelector(':scope > .kpi-grid');if(grid){
    grid.classList.add('cfo-premium-kpis');
    const order=[['kpiSales',1],['kpiBudgetYtd',2],['kpiActual',3],['kpiRemaining',4],['kpiFyLanding',5],['kpiCapex27',6],['kpiOpex27',7]];
    order.forEach(([id,n])=>{const card=document.getElementById(id)?.closest('.exec-kpi');if(card){card.style.order=String(n);if(id==='kpiSales')card.classList.add('cfo-sales-card')}});
    const over=document.getElementById('kpiOverspent')?.closest('.exec-kpi');if(over)over.style.display='none'
  }
  const planning=overview.querySelector('.planning-summary'),grid2=overview.querySelector('.grid-2');
  if(planning){planning.classList.add('cfo-planning-premium');if(grid2&&planning.previousElementSibling!==grid)overview.insertBefore(planning,grid2)}
}

function parseCellNumber(cell){const text=clean(cell?.textContent).replace(/,/g,'').replace(/[^0-9.()\-]/g,'');if(!text)return 0;if(/^\(.*\)$/.test(text))return-num(text.slice(1,-1));return num(text)}
let departmentPolishBusy=false;
function polishDepartmentsTable(){
  if(departmentPolishBusy)return;
  const body=document.getElementById('departmentBody');if(!body)return;
  departmentPolishBusy=true;
  try{
    body.querySelectorAll('.cfo-dept-total').forEach(x=>x.remove());
    [...body.querySelectorAll('tr')].forEach(row=>{
      if(row.querySelector('.empty-state'))return;
      const approved=row.querySelector('.badge.good')&&clean(row.querySelector('.badge.good')?.textContent).toLowerCase()==='approved';
      if(!approved)row.remove()
    });
    const visible=[...body.querySelectorAll('tr')].filter(row=>!row.querySelector('.empty-state'));
    body.querySelectorAll('tr').forEach(row=>{if(row.querySelector('.empty-state')&&visible.length)row.remove()});
    if(!visible.length){body.innerHTML='<tr><td colspan="10" class="empty-state">No Finance Approved departments match the selected filters.</td></tr>';return}
    const sums=Array(9).fill(0);visible.forEach(row=>{[2,3,4,5,6,7,8].forEach(i=>sums[i]+=parseCellNumber(row.cells[i]))});
    const total=document.createElement('tr');total.className='cfo-dept-total';
    total.innerHTML=`<td><b>TOTAL</b><br><small>${visible.length} Approved Departments</small></td><td>—</td><td class="num">${money(sums[2])}</td><td class="num">${money(sums[3])}</td><td class="num ${sums[4]<0?'negative':'positive'}">${money(sums[4])}</td><td class="num">${money(sums[5])}</td><td class="num ${sums[6]<0?'negative':''}">${money(sums[6])}</td><td class="num">${money(sums[7])}</td><td class="num">${money(sums[8])}</td><td><span class="badge good">Approved</span></td>`;
    body.appendChild(total)
  }finally{departmentPolishBusy=false}
}
function setupDepartmentsPanel(){
  injectPremiumStyle();
  const panel=document.querySelector('.exec-panel[data-panel="departments"]'),body=document.getElementById('departmentBody');if(!panel||!body||body.dataset.cfoApprovedOnly==='1')return;
  body.dataset.cfoApprovedOnly='1';
  const sub=panel.querySelector('.sub');if(sub)sub.textContent='Finance Approved departments only. Executive comparison of Budget YTD, Actual, FY Budget 2026, Remaining, FY Budget 2027 and approved CAPEX.';
  let timer=null;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(polishDepartmentsTable,0)}).observe(body,{childList:true,subtree:true});
  document.getElementById('departmentSearch')?.addEventListener('input',()=>setTimeout(polishDepartmentsTable,0));
  document.getElementById('sectorFilter')?.addEventListener('change',()=>setTimeout(polishDepartmentsTable,0));
  setTimeout(polishDepartmentsTable,350)
}

function ensurePanel(){
  arrangeOverview();
  const overview=document.querySelector('.exec-panel[data-panel="overview"]');if(!overview)return null;
  let card=document.getElementById('cfoDepartmentBreakdown');if(card)return card;
  card=document.createElement('article');card.id='cfoDepartmentBreakdown';card.className='card panel-card';
  card.innerHTML=`<h2>Department Budget Breakdown</h2><p class="sub">FY 2027 OPEX breakdown by department. Zero OPEX rows are hidden by default and Production Fund Centers are consolidated into one line.</p><div class="toolbar"><input id="cfoBreakdownSearch" type="search" placeholder="Search department or Fund Center..."><select id="cfoBreakdownFilter"><option value="all">All OPEX 2027</option><option value="project">Project Budget Only</option><option value="travel">Travel Budget Only</option></select><button id="cfoHideZero" class="cfo-zero-toggle" type="button">Hide Zero: ON</button></div><div class="table-wrap" style="max-height:520px"><table class="exec-table"><thead><tr><th>Department</th><th>Project FY 2027</th><th>Travel FY 2027</th><th>Other OPEX FY 2027</th><th>Total OPEX FY 2027</th><th>Status</th></tr></thead><tbody id="cfoBreakdownBody"><tr><td colspan="6" class="empty-state">Loading department breakdown...</td></tr></tbody></table></div>`;
  const planning=overview.querySelector('.planning-summary'),grid2=overview.querySelector('.grid-2');
  if(planning)planning.insertAdjacentElement('afterend',card);else if(grid2)overview.insertBefore(card,grid2);else overview.appendChild(card);
  document.getElementById('cfoBreakdownSearch')?.addEventListener('input',render);
  document.getElementById('cfoBreakdownFilter')?.addEventListener('change',render);
  document.getElementById('cfoHideZero')?.addEventListener('click',()=>{hideZero=!hideZero;const btn=document.getElementById('cfoHideZero');if(btn){btn.textContent=`Hide Zero: ${hideZero?'ON':'OFF'}`;btn.classList.toggle('off',!hideZero)}render()});
  return card;
}

function consolidateProduction(source){
  const production=source.filter(x=>productionIds.has(String(x.cc))),others=source.filter(x=>!productionIds.has(String(x.cc)));
  if(!production.length)return others;
  const totals=production.reduce((o,x)=>{o.project27+=x.project27;o.travel27+=x.travel27;o.other27+=x.other27;o.total27+=x.total27;o.statuses.add(x.status);return o},{project27:0,travel27:0,other27:0,total27:0,statuses:new Set()});
  others.push({cc:`${production.length} Fund Centers`,name:'Production',status:totals.statuses.size===1?[...totals.statuses][0]:'mixed',project27:totals.project27,travel27:totals.travel27,other27:totals.other27,total27:totals.total27,isProduction:true});
  return others
}

function render(){
  ensurePanel();const body=document.getElementById('cfoBreakdownBody');if(!body)return;
  const q=clean(document.getElementById('cfoBreakdownSearch')?.value).toLowerCase(),filter=document.getElementById('cfoBreakdownFilter')?.value||'all';
  let data=consolidateProduction(rows);
  data=data.filter(x=>(!hideZero||Math.abs(x.total27)>.005)&&(!q||`${x.cc} ${x.name}`.toLowerCase().includes(q))&&(filter==='all'||(filter==='project'&&Math.abs(x.project27)>.005)||(filter==='travel'&&Math.abs(x.travel27)>.005)));
  data=data.sort((a,b)=>(b.isProduction?1:0)-(a.isProduction?1:0)||b.total27-a.total27||a.name.localeCompare(b.name));
  if(!data.length){body.innerHTML='<tr><td colspan="6" class="empty-state">No departments with OPEX FY 2027 match the selected filter.</td></tr>';return}
  const totals=data.reduce((o,x)=>{o.project27+=x.project27;o.travel27+=x.travel27;o.other27+=x.other27;o.total27+=x.total27;return o},{project27:0,travel27:0,other27:0,total27:0});
  body.innerHTML=data.map(x=>`<tr class="${x.isProduction?'production-summary':''}"><td><b>${esc(x.name)}</b><br><small>${esc(x.cc)}</small></td><td class="num">${money(x.project27)}</td><td class="num">${money(x.travel27)}</td><td class="num">${money(x.other27)}</td><td class="num"><b>${money(x.total27)}</b></td><td>${badge(x.status)}</td></tr>`).join('')+`<tr><td><b>TOTAL</b><br><small>${data.length} Displayed Lines</small></td><td class="num"><b>${money(totals.project27)}</b></td><td class="num"><b>${money(totals.travel27)}</b></td><td class="num"><b>${money(totals.other27)}</b></td><td class="num"><b>${money(totals.total27)}</b></td><td></td></tr>`;
}

async function load(){
  if(loaded||loading)return;loading=true;ensurePanel();
  try{
    await ensureProductionIds();
    const uploadSnap=await getDocs(collection(db,'opex_budget_submissions')),out=[];
    for(const snap of uploadSnap.docs){
      const cc=snap.id,upload=snap.data()||{};if(!cc||cc==='16')continue;
      let data=null;try{data=await decode(upload,cc)}catch(e){console.warn('CFO breakdown submission decode failed',cc,e)}
      data=data||upload||{};const items=Object.entries(data.items||{});let project27=0,travel27=0,total27=0;
      items.forEach(([raw,item])=>{const code=clean(item?.code||raw),value=fy2027(item);total27+=value;if(isTravel(code))travel27+=value;if(isProject(item,code))project27+=value});
      const name=clean(data.name||upload.name||upload.departmentName||cc),status=workflow(upload),other27=total27-project27-travel27;
      out.push({cc,name,status,project27,travel27,other27,total27})
    }
    rows=out;loaded=true;render();
  }catch(error){console.error('CFO department breakdown failed',error);const body=document.getElementById('cfoBreakdownBody');if(body)body.innerHTML=`<tr><td colspan="6" class="empty-state">Department breakdown could not load: ${esc(error.code||error.message||error)}</td></tr>`}
  finally{loading=false}
}
function start(user){if(!user)return;ensurePanel();setupDepartmentsPanel();load()}
arrangeOverview();ensurePanel();setupDepartmentsPanel();onAuthStateChanged(auth,start);window.addEventListener('dad-user-ready',e=>start(e.detail?.user||auth.currentUser));
