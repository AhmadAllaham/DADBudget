(function(){
'use strict';
const ENGINEERING=new Set(['1000100301','100100301']);
const clean=v=>String(v??'').trim();
let subscriptionVarianceSync=false,subscriptionDefaultDone=false;
function profile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||{}}catch(_){return{}}}
function departments(p){const out=Array.isArray(p?.departments)?p.departments.map(clean).filter(Boolean):(p?.department?[clean(p.department)]:[]);return [...new Set(out)]}
function modules(p){return new Set(Array.isArray(p?.modules)?p.modules:[])}
function allowedOpexLink(href,p){
 const path=clean(href).split('?')[0].toLowerCase(),mods=modules(p),deps=departments(p),email=clean(p?.email).toLowerCase(),admin=p?.isMainAdmin===true||p?.role==='admin',departmentAccess=deps.some(x=>x&&x!=='ALL'),opex=mods.has('opex')||mods.has('opex_detail');
 if(admin)return true;
 if(path==='opex.html')return opex;
 if(path==='opex-summary.html')return mods.has('opex_summary')||opex;
 if(path==='travel-budget.html')return mods.has('travel');
 if(path==='training-expense.html')return mods.has('training')||p?.role==='manager'||['nouralhuda.hasan@dadgroup.com','hazem.amyreh@dadgroup.com'].includes(email);
 if(path==='subscriptions.html')return mods.has('capex_it')||opex||departmentAccess;
 if(path==='utilities.html')return deps.some(x=>ENGINEERING.has(x));
 return true;
}
function ensureOpexNavigation(){
 const nav=document.querySelector('.sidebar-nav');if(!nav)return false;
 let sub=nav.querySelector('.opex-subnav'),parent=null;
 if(!sub){parent=[...nav.querySelectorAll(':scope > a')].find(a=>/opex planning/i.test(clean(a.textContent)));if(!parent)return false;sub=document.createElement('div');sub.className='opex-subnav';parent.insertAdjacentElement('afterend',sub)}else parent=sub.previousElementSibling;
 const wanted=[['opex.html','OPEX Detail'],['opex-summary.html','Summary'],['travel-budget.html','Travel'],['subscriptions.html','Subscriptions'],['training-expense.html','Training Expense'],['utilities.html','Utilities'],['utilities.html?plan=maintenance','Maintenance']];
 wanted.forEach(([href,label])=>{const base=href.split('?')[0],query=href.includes('?')?href.split('?')[1]:'';let link=[...sub.querySelectorAll('a')].find(a=>{const ah=clean(a.getAttribute('href'));return query?ah===href:ah.split('?')[0]===base});if(!link){link=document.createElement('a');link.href=href;link.textContent=label;sub.appendChild(link)}});
 const p=profile();[...sub.querySelectorAll('a')].forEach(a=>{const href=clean(a.getAttribute('href'));if(!allowedOpexLink(href,p))a.style.setProperty('display','none','important');else a.style.removeProperty('display')});
 if(parent?.tagName==='A'){parent.href='opex.html';parent.classList.add('opex-parent-toggle','opex-parent-open');parent.style.removeProperty('display')}
 sub.classList.add('opex-subnav-open');
 if(!document.getElementById('dadOpexStableNavStyle')){const st=document.createElement('style');st.id='dadOpexStableNavStyle';st.textContent='.opex-subnav{display:block!important;margin:-3px 10px 6px 22px;padding-left:10px;border-left:1px solid rgba(255,255,255,.18)}.opex-subnav a{padding:7px 10px!important;margin:2px 0!important;font-size:10px!important;border-radius:7px!important}.opex-parent-toggle{display:flex!important;align-items:center;justify-content:space-between}';document.head.appendChild(st)}
 const page=(location.pathname.split('/').pop()||'').toLowerCase(),maintenance=new URLSearchParams(location.search).get('plan')==='maintenance';[...sub.querySelectorAll('a')].forEach(a=>{const raw=clean(a.getAttribute('href')),path=raw.split('?')[0].toLowerCase(),isMaintenance=raw.includes('plan=maintenance'),active=path===page&&(page!=='utilities.html'||isMaintenance===maintenance);a.classList.toggle('active',active)});
 return true;
}
function numberFromCell(td){if(!td)return 0;let s=clean(td.textContent).replace(/,/g,'').replace(/%/g,'');if(!s||s==='—'||s==='-')return 0;if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);const x=Number(s);return Number.isFinite(x)?x:0}
function displayMoney(v){return Math.abs(v)<.005?'—':v.toLocaleString(undefined,{maximumFractionDigits:0})}
function normalizeSubscriptionVariance(){
 if(subscriptionVarianceSync)return;const body=document.getElementById('subscriptionBody');if(!body)return;subscriptionVarianceSync=true;
 try{[...body.rows].forEach(tr=>{if(tr.querySelector('.empty-state')||tr.cells.length<19)return;const budget=numberFromCell(tr.cells[7]),actual=numberFromCell(tr.cells[8]),delta=actual-budget,money=displayMoney(delta),pct=Math.abs(budget)<.005?'—':`${(delta/Math.abs(budget)*100).toFixed(1)}%`;if(clean(tr.cells[9].textContent)!==money)tr.cells[9].textContent=money;if(clean(tr.cells[10].textContent)!==pct)tr.cells[10].textContent=pct;[tr.cells[9],tr.cells[10]].forEach(td=>{const wanted=delta>0?'bad':'good';if(!td.classList.contains(wanted)){td.classList.remove('good','bad');td.classList.add(wanted)}})})}finally{subscriptionVarianceSync=false}
}
function defaultSubscriptionsToAll(){
 if(subscriptionDefaultDone||(location.pathname.split('/').pop()||'').toLowerCase()!=='subscriptions.html')return;const sel=document.getElementById('subscriptionDept');if(!sel)return;const all=[...sel.options].find(o=>clean(o.value)==='ALL');if(!all)return;subscriptionDefaultDone=true;try{localStorage.setItem('dadBudgetSubscriptionDept','ALL')}catch(_){}if(sel.value!=='ALL'){sel.value='ALL';sel.dispatchEvent(new Event('change',{bubbles:true}))}const search=document.getElementById('subscriptionDeptQuickSearch');if(search)search.value=clean(all.textContent)}
function installSubscriptionGuard(){const body=document.getElementById('subscriptionBody');if(body&&!body.dataset.dadStabilityObserver){body.dataset.dadStabilityObserver='1';new MutationObserver(()=>setTimeout(normalizeSubscriptionVariance,0)).observe(body,{childList:true,subtree:true,characterData:true})}defaultSubscriptionsToAll();normalizeSubscriptionVariance()}
function run(){ensureOpexNavigation();installSubscriptionGuard()}
window.addEventListener('dad-user-ready',()=>setTimeout(run,0));window.addEventListener('load',()=>setTimeout(run,0));document.addEventListener('DOMContentLoaded',run);let tries=0;const timer=setInterval(()=>{tries++;run();if(tries>=30)clearInterval(timer)},250);
})();
