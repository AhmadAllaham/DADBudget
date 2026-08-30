(function(){
'use strict';
const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
function cached(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||{}}catch(_){return{}}}
function allowed(profile={}){const modules=Array.isArray(profile.modules)?profile.modules:[];return profile.uid===MAIN||profile.isMainAdmin===true||modules.includes('hr')}
function ensureShortcut(show){
  if(!/hr-budget\.html$/i.test((location.pathname||'').split('?')[0]))return;
  let link=document.getElementById('hrSalariesShortcut');
  if(show&&!link){
    const actions=document.querySelector('.head-actions');if(!actions)return;
    link=document.createElement('a');link.id='hrSalariesShortcut';link.href='hr-salaries.html';link.className='action-btn primary';link.textContent='Open Salaries Budget';link.style.textDecoration='none';link.style.display='inline-flex';link.style.alignItems='center';actions.insertBefore(link,actions.firstChild);
  }
  if(link)link.style.display=show?'inline-flex':'none';
}
function apply(profile=cached()){
  const show=allowed(profile);
  document.querySelectorAll('a[href="hr-salaries.html"]').forEach(link=>{
    link.style.setProperty('display',show?'block':'none','important');
    if(show&&link.id!=='hrSalariesShortcut'){
      link.style.setProperty('font-weight','1000','important');
      link.style.setProperty('color','#fff','important');
      link.style.setProperty('background','rgba(62,225,208,.16)','important');
      link.textContent='Salaries Budget';
    }
  });
  ensureShortcut(show);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply());else apply();
window.addEventListener('dad-user-ready',e=>apply(e.detail?.profile||cached()));
if(/hr-salaries\.html$/i.test((location.pathname||'').split('?')[0]))import('./hr-salaries-combined.js?v=20260824-total-salaries-1').catch(e=>console.error('Total Salaries view failed:',e));
})();
