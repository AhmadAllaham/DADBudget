(function(){
'use strict';
const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
function cached(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||{}}catch(_){return{}}}
function allowed(profile={}){const modules=Array.isArray(profile.modules)?profile.modules:[];return profile.uid===MAIN||profile.isMainAdmin===true||modules.includes('hr')}
function apply(profile=cached()){
  const show=allowed(profile);
  document.querySelectorAll('a[href="hr-salaries.html"]').forEach(link=>link.style.setProperty('display',show?'block':'none','important'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply());else apply();
window.addEventListener('dad-user-ready',e=>apply(e.detail?.profile||cached()));
})();
