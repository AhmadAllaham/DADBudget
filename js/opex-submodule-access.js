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
let applying=false,queued=false,observer=null;
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
function setVisible(a,show){
  const hidden=a.style.getPropertyValue('display')==='none'&&a.style.getPropertyPriority('display')==='important';
  if(show){if(hidden)a.style.removeProperty('display')}else if(!hidden)a.style.setProperty('display','none','important')
}
function applyNav(){
  const p=profile();if(!p)return;
  const nav=document.querySelector('.sidebar-nav');if(!nav)return;
  ITEMS.forEach(item=>nav.querySelectorAll(`a[href^="${item.page}"]`).forEach(a=>setVisible(a,allowed(item.key,p))));
  const sub=nav.querySelector('.opex-subnav'),parent=sub?.previousElementSibling;
  if(sub&&parent?.tagName==='A'){
    const any=ITEMS.some(item=>allowed(item.key,p)&&sub.querySelector(`a[href^="${item.page}"]`));
    setVisible(parent,any||isAdmin(p));
    parent.href=allowed('opex_detail',p)?'opex.html':'#';
  }
}
function enforcePage(){
  const p=profile(),page=currentPage(),key=byPage[page];if(!p||!key||isAdmin(p))return;
  if(!allowed(key,p)&&!window.__dadOpexAccessRedirecting){window.__dadOpexAccessRedirecting=true;location.replace('index.html')}
}
function run(){
  if(applying){queued=true;return}applying=true;
  try{addUserSettingsOptions();applyNav();enforcePage()}finally{applying=false;if(queued){queued=false;setTimeout(run,0)}}
}
function observeNav(){
  if(observer)return;const nav=document.querySelector('.sidebar-nav');if(!nav)return;
  let timer=null;observer=new MutationObserver(()=>{if(applying)return;clearTimeout(timer);timer=setTimeout(run,0)});
  observer.observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['style','href']});
}
function start(){run();observeNav()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.addEventListener('dad-user-ready',()=>setTimeout(start,0));
window.addEventListener('dad-firebase-ready',()=>setTimeout(start,0));
window.addEventListener('storage',e=>{if(e.key==='dadBudgetCurrentProfile')setTimeout(run,0)});
let tries=0;const settle=setInterval(()=>{tries++;start();if(tries>=40)clearInterval(settle)},250);
if(currentPage()==='subscriptions.html')import('./subscriptions-loading-guard.js?v=20260901-murad-loading-1').catch(e=>console.warn('Subscriptions fail-safe unavailable',e));
})();