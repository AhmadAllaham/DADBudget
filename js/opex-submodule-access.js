(function(){
'use strict';
const ITEMS=[
  {key:'opex_detail',label:'OPEX Planning · OPEX Detail',page:'opex.html'},
  {key:'opex_summary',label:'OPEX Planning · Summary',page:'opex-summary.html'},
  {key:'ap',label:'OPEX Planning · A&P',page:'ap-budget.html'},
  {key:'travel',label:'OPEX Planning · Travel',page:'travel-budget.html'},
  {key:'subscriptions',label:'OPEX Planning · Subscriptions',page:'subscriptions.html'},
  {key:'training',label:'OPEX Planning · Training Expense',page:'training-expense.html'},
  {key:'licensing',label:'OPEX Planning · Licensing',page:'licensing.html'}
];
const byPage=Object.fromEntries(ITEMS.map(x=>[x.page,x.key]));
const clean=v=>String(v??'').trim();
function profile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||null}catch(_){return null}}
function isAdmin(p){return p?.isMainAdmin===true||p?.role==='admin'}
function modules(p){return new Set(Array.isArray(p?.modules)?p.modules:[])}
function allowed(key,p=profile()){if(!p)return true;return isAdmin(p)||modules(p).has(key)}
function currentPage(){return (location.pathname.split('/').pop()||'').toLowerCase()}
function addUserSettingsOptions(){
  if(currentPage()!=='user-settings.html')return;
  const host=document.getElementById('permissions');if(!host)return;
  ITEMS.forEach(item=>{
    if(host.querySelector(`input[value="${item.key}"]`))return;
    const label=document.createElement('label');label.className='perm';label.innerHTML=`<input type="checkbox" value="${item.key}"> ${item.label}`;host.appendChild(label)
  });
}
function applyNav(){
  const p=profile();if(!p)return;
  const nav=document.querySelector('.sidebar-nav');if(!nav)return;
  ITEMS.forEach(item=>{
    nav.querySelectorAll(`a[href^="${item.page}"]`).forEach(a=>{
      if(allowed(item.key,p))a.style.removeProperty('display');else a.style.setProperty('display','none','important')
    })
  });
  const sub=nav.querySelector('.opex-subnav'),parent=sub?.previousElementSibling;
  if(sub&&parent?.tagName==='A'){
    const any=[...sub.querySelectorAll('a')].some(a=>getComputedStyle(a).display!=='none');
    if(any||isAdmin(p))parent.style.removeProperty('display');else parent.style.setProperty('display','none','important');
    if(!allowed('opex_detail',p))parent.href='#';
  }
}
function enforcePage(){
  const p=profile(),page=currentPage(),key=byPage[page];if(!p||!key||isAdmin(p))return;
  if(!allowed(key,p))location.replace('index.html')
}
function run(){addUserSettingsOptions();applyNav();enforcePage()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
window.addEventListener('dad-user-ready',()=>setTimeout(run,0));
window.addEventListener('dad-firebase-ready',()=>setTimeout(run,0));
setTimeout(run,500);
})();
