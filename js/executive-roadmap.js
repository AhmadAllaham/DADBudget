(function(){
'use strict';
const clean=v=>String(v??'').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateValue=v=>{const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?null:d};
const fmtDate=v=>{const d=dateValue(v);return d?d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}):'—'};
const dayStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());

function injectStyle(){
 if(document.getElementById('cfoRoadmapPremiumStyle'))return;
 const s=document.createElement('style');s.id='cfoRoadmapPremiumStyle';s.textContent=`
 .exec-tab[data-tab="roadmap"]{position:relative;padding-left:34px}.exec-tab[data-tab="roadmap"]:before{content:"";position:absolute;left:14px;top:50%;width:10px;height:10px;border:2px solid currentColor;border-radius:50%;transform:translateY(-50%);box-shadow:7px 0 0 -4px currentColor}
 .cfo-roadmap-shell{display:grid;gap:14px}.cfo-roadmap-hero{position:relative;overflow:hidden;padding:24px;border-radius:18px;background:linear-gradient(135deg,#082f5d 0%,#0a5d6d 58%,#0b887d 100%);color:#fff;box-shadow:0 16px 38px rgba(8,47,93,.18)}
 .cfo-roadmap-hero:after{content:"";position:absolute;right:-70px;top:-95px;width:260px;height:260px;border-radius:50%;border:38px solid rgba(255,255,255,.06)}
 .cfo-roadmap-hero-head{position:relative;z-index:1;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.cfo-roadmap-eyebrow{font-size:10px;font-weight:1000;letter-spacing:.16em;color:rgba(255,255,255,.7)}
 .cfo-roadmap-hero h2{margin:5px 0 6px;font-size:27px;letter-spacing:-.025em}.cfo-roadmap-hero p{margin:0;max-width:720px;font-size:13px;line-height:1.55;color:rgba(255,255,255,.76);font-weight:750}.cfo-roadmap-live{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);font-size:10px;font-weight:1000;white-space:nowrap}
 .cfo-roadmap-kpis{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:20px}.cfo-roadmap-kpi{padding:13px 14px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.09);backdrop-filter:blur(5px)}.cfo-roadmap-kpi span{display:block;font-size:9px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.65)}.cfo-roadmap-kpi strong{display:block;margin-top:6px;font-size:20px;color:#fff}.cfo-roadmap-kpi small{display:block;margin-top:4px;font-size:9.5px;color:rgba(255,255,255,.65);font-weight:800}
 .cfo-roadmap-progress{position:relative;z-index:1;margin-top:16px}.cfo-roadmap-progress-head{display:flex;justify-content:space-between;gap:12px;font-size:11px;font-weight:900;color:rgba(255,255,255,.8)}.cfo-roadmap-track{height:9px;margin-top:8px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden}.cfo-roadmap-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#8ff0df,#fff)}
 .cfo-roadmap-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:14px}.cfo-roadmap-card{padding:20px;border-radius:16px}.cfo-roadmap-card h3{margin:0 0 5px;font-size:20px;color:#123e63}.cfo-roadmap-card .sub{margin:0 0 14px;font-size:12.5px;color:#6c8287;line-height:1.5;font-weight:720}
 .cfo-current-list{display:grid;gap:9px}.cfo-current-item{position:relative;padding:13px 13px 13px 17px;border:1px solid #d9e9e6;border-radius:11px;background:#fbfefd}.cfo-current-item:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:4px;border-radius:0 5px 5px 0;background:#12a397}.cfo-current-item b{display:block;color:#173f47;font-size:13.5px}.cfo-current-item span{display:block;margin-top:5px;color:#6d8388;font-size:10.5px;font-weight:800}.cfo-current-item strong{display:inline-block;margin-top:7px;color:#08776c;font-size:10.5px}
 .cfo-next-milestone{padding:16px;border-radius:13px;background:linear-gradient(145deg,#f2fbf8,#eaf7f5);border:1px solid #d3e9e5}.cfo-next-milestone span{display:block;font-size:9px;font-weight:1000;color:#6c8387;text-transform:uppercase;letter-spacing:.08em}.cfo-next-milestone b{display:block;margin-top:6px;color:#0b5965;font-size:16px;line-height:1.35}.cfo-next-milestone strong{display:block;margin-top:8px;color:#0a3560;font-size:13px}
 .cfo-roadmap-list{display:grid;gap:8px;max-height:590px;overflow:auto;padding-right:4px}.cfo-roadmap-row{display:grid;grid-template-columns:34px minmax(260px,1fr) 180px 145px;gap:11px;align-items:center;padding:11px 12px;border:1px solid #e0ebe9;border-radius:10px;background:#fff}.cfo-roadmap-row.current{border-color:#9bd8cf;background:#f0fbf8;box-shadow:inset 4px 0 0 #12a397}.cfo-roadmap-row.milestone{background:#fffaf0;border-color:#ead9ae}.cfo-roadmap-row.completed{opacity:.66}.cfo-roadmap-dot{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#edf4f3;color:#6b8588;font-size:10px;font-weight:1000}.cfo-roadmap-row.current .cfo-roadmap-dot{background:#0b897e;color:#fff}.cfo-roadmap-row.milestone .cfo-roadmap-dot{background:#fff0bf;color:#866000}.cfo-roadmap-task b{display:block;color:#24464d;font-size:12.5px}.cfo-roadmap-task small,.cfo-roadmap-owner,.cfo-roadmap-date{font-size:10px;color:#75898d;font-weight:800}.cfo-roadmap-owner{color:#516f75}.cfo-roadmap-date{text-align:right;white-space:nowrap}.cfo-roadmap-status{display:inline-flex;margin-top:5px;padding:4px 7px;border-radius:999px;background:#edf4f3;color:#60787d;font-size:8.5px;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}.cfo-roadmap-row.current .cfo-roadmap-status{background:#dff6f1;color:#08776c}.cfo-roadmap-row.milestone .cfo-roadmap-status{background:#fff0c8;color:#866000}
 @media(max-width:1050px){.cfo-roadmap-kpis{grid-template-columns:repeat(2,1fr)}.cfo-roadmap-grid{grid-template-columns:1fr}.cfo-roadmap-row{grid-template-columns:34px 1fr 150px}.cfo-roadmap-date{grid-column:2/4;text-align:left}}
 @media(max-width:650px){.cfo-roadmap-hero-head{flex-direction:column}.cfo-roadmap-kpis{grid-template-columns:1fr}.cfo-roadmap-row{grid-template-columns:30px 1fr}.cfo-roadmap-owner,.cfo-roadmap-date{grid-column:2;text-align:left}}
 `;document.head.appendChild(s)
}

function statusFor(task,today){const start=dateValue(task.start),finish=dateValue(task.finish);if(!start||!finish)return'upcoming';if(finish<today)return'completed';if(start<=today&&finish>=today)return'current';return'upcoming'}

function renderRoadmap(){
 const panel=document.querySelector('.exec-panel[data-panel="roadmap"]');if(!panel)return;
 const tasks=Array.isArray(window.DAD_ROADMAP_TASKS)?window.DAD_ROADMAP_TASKS:[];
 if(!tasks.length){panel.innerHTML='<article class="card panel-card"><div class="empty-state">Roadmap data is not available.</div></article>';return}
 const today=dayStart(new Date()),decorated=tasks.map((t,i)=>({...t,index:i+1,state:statusFor(t,today)})),completed=decorated.filter(x=>x.state==='completed'),current=decorated.filter(x=>x.state==='current'),upcoming=decorated.filter(x=>x.state==='upcoming'),milestones=decorated.filter(x=>x.milestone&&x.state!=='completed'),nextMilestone=milestones[0]||decorated.filter(x=>x.milestone).slice(-1)[0],finalTask=decorated.find(x=>/Finalized\s*&\s*Approved Budget/i.test(x.task))||decorated[decorated.length-1],progress=Math.round(completed.length/decorated.length*100),activeLabel=current.length?`${current.length} Active`:'No Active Tasks';
 panel.innerHTML=`<div class="cfo-roadmap-shell">
  <section class="cfo-roadmap-hero">
   <div class="cfo-roadmap-hero-head"><div><span class="cfo-roadmap-eyebrow">BUDGET 2027 · EXECUTIVE ROADMAP</span><h2>Budget Planning Timeline</h2><p>Persistent CFO view of the complete Budget 2027 process, current activities, management milestones and final approval date.</p></div><div class="cfo-roadmap-live">LIVE TIMELINE · ${today.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}</div></div>
   <div class="cfo-roadmap-kpis"><div class="cfo-roadmap-kpi"><span>Overall Progress</span><strong>${progress}%</strong><small>${completed.length} of ${decorated.length} activities completed</small></div><div class="cfo-roadmap-kpi"><span>Current Activities</span><strong>${current.length}</strong><small>${activeLabel}</small></div><div class="cfo-roadmap-kpi"><span>Next Milestone</span><strong>${nextMilestone?fmtDate(nextMilestone.start):'—'}</strong><small>${nextMilestone?esc(nextMilestone.task):'No milestone scheduled'}</small></div><div class="cfo-roadmap-kpi"><span>Final Approval</span><strong>${finalTask?fmtDate(finalTask.finish):'—'}</strong><small>${finalTask?esc(finalTask.task):'Budget 2027'}</small></div></div>
   <div class="cfo-roadmap-progress"><div class="cfo-roadmap-progress-head"><span>Planning cycle progress</span><span>${completed.length} completed · ${current.length} active · ${upcoming.length} upcoming</span></div><div class="cfo-roadmap-track"><i style="width:${Math.max(1,progress)}%"></i></div></div>
  </section>
  <div class="cfo-roadmap-grid">
   <article class="card cfo-roadmap-card"><h3>Current Focus</h3><p class="sub">Activities that are active today for the Budget 2027 process.</p><div class="cfo-current-list">${current.length?current.map(x=>`<div class="cfo-current-item"><b>${esc(x.task)}</b><span>${esc(x.owner)} · ${fmtDate(x.start)} — ${fmtDate(x.finish)}</span><strong>${x.milestone?'Management Milestone':'In Progress'}</strong></div>`).join(''):'<div class="empty-state">No activity is scheduled for today.</div>'}</div></article>
   <article class="card cfo-roadmap-card"><h3>Next Management Milestone</h3><p class="sub">The next milestone requiring management visibility.</p>${nextMilestone?`<div class="cfo-next-milestone"><span>Next milestone</span><b>${esc(nextMilestone.task)}</b><strong>${fmtDate(nextMilestone.start)} · ${esc(nextMilestone.owner)}</strong></div>`:'<div class="empty-state">No upcoming management milestone.</div>'}</article>
  </div>
  <article class="card cfo-roadmap-card"><h3>Full Budget Roadmap</h3><p class="sub">Complete process from kick-off through final Board Budget Committee discussion.</p><div class="cfo-roadmap-list">${decorated.map(x=>`<div class="cfo-roadmap-row ${x.state} ${x.milestone?'milestone':''}"><div class="cfo-roadmap-dot">${x.milestone?'◆':x.index}</div><div class="cfo-roadmap-task"><b>${esc(x.task)}</b><small>${esc(x.duration||'')}</small><span class="cfo-roadmap-status">${x.state==='current'?'In Progress':x.state==='completed'?'Completed':x.milestone?'Milestone':'Upcoming'}</span></div><div class="cfo-roadmap-owner">${esc(x.owner)}</div><div class="cfo-roadmap-date">${fmtDate(x.start)} → ${fmtDate(x.finish)}</div></div>`).join('')}</div></article>
 </div>`
}

function ensureRoadmapPanel(){
 injectStyle();
 const tabs=document.querySelector('.exec-tabs');if(!tabs)return;
 let tab=tabs.querySelector('[data-tab="roadmap"]');
 if(!tab){tab=document.createElement('button');tab.type='button';tab.className='exec-tab';tab.dataset.tab='roadmap';tab.textContent='Roadmap';const overview=tabs.querySelector('[data-tab="overview"]');overview?.insertAdjacentElement('afterend',tab)}
 let panel=document.querySelector('.exec-panel[data-panel="roadmap"]');
 if(!panel){panel=document.createElement('section');panel.className='exec-panel';panel.dataset.panel='roadmap';const first=document.querySelector('.exec-panel[data-panel="departments"]');first?.parentNode?.insertBefore(panel,first)}
 if(tab.dataset.cfoRoadmapBound!=='1'){
  tab.dataset.cfoRoadmapBound='1';
  tab.addEventListener('click',()=>{document.querySelectorAll('.exec-tab').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('.exec-panel').forEach(x=>x.classList.toggle('active',x===panel));renderRoadmap()});
 }
 document.querySelectorAll('.exec-tab:not([data-tab="roadmap"])').forEach(x=>{if(x.dataset.cfoRoadmapHideBound==='1')return;x.dataset.cfoRoadmapHideBound='1';x.addEventListener('click',()=>{tab.classList.remove('active');panel.classList.remove('active')})});
 renderRoadmap()
}

function loadRoadmapData(){
 if(Array.isArray(window.DAD_ROADMAP_TASKS)){ensureRoadmapPanel();return}
 let script=document.querySelector('script[data-cfo-roadmap-data]');if(script){script.addEventListener('load',ensureRoadmapPanel,{once:true});return}
 script=document.createElement('script');script.src='js/roadmap-data.js?v=20260824-cfo-roadmap-1';script.dataset.cfoRoadmapData='1';script.onload=ensureRoadmapPanel;script.onerror=ensureRoadmapPanel;document.head.appendChild(script)
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadRoadmapData,{once:true});else loadRoadmapData();
window.addEventListener('dad-user-ready',loadRoadmapData);
})();
