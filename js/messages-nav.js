import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,onSnapshot,query,where} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
let inboxUnsub=null,watchedEmail='';
const THEME_KEY='dadBudgetColorTheme';

function currentTheme(){return document.documentElement.dataset.theme==='dark'?'dark':'light'}
function applyTheme(theme){const next=theme==='dark'?'dark':'light';document.documentElement.dataset.theme=next;try{localStorage.setItem(THEME_KEY,next)}catch(_){}const button=document.getElementById('themeHeaderToggle');if(button){const dark=next==='dark';button.title=dark?'Switch to Light Mode':'Switch to Dark Mode';button.setAttribute('aria-label',button.title);button.querySelector('.theme-icon').textContent=dark?'☀':'☾';button.querySelector('.theme-label').textContent=dark?'Light Mode':'Dark Mode'}}
function ensureThemeToggle(){
  let button=document.getElementById('themeHeaderToggle');if(button){applyTheme(currentTheme());return button}
  button=document.createElement('button');button.id='themeHeaderToggle';button.type='button';button.innerHTML='<span class="theme-icon" aria-hidden="true">☾</span><span class="theme-label">Dark Mode</span>';button.style.cssText='position:fixed;top:18px;right:114px;z-index:9999;width:96px;height:38px;border-radius:11px;border:1px solid rgba(18,163,151,.32);background:rgba(255,255,255,.96);color:#0a6f68;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 9px;font-size:10px;font-weight:1000;cursor:pointer;box-shadow:0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08);transition:.18s ease;backdrop-filter:blur(8px)';button.onclick=()=>applyTheme(currentTheme()==='dark'?'light':'dark');button.onmouseenter=()=>{button.style.transform='translateY(-1px) scale(1.02)'};button.onmouseleave=()=>{button.style.transform='translateY(0) scale(1)'};document.body.appendChild(button);applyTheme(currentTheme());return button
}

function currentProfile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')}catch(_){return null}}
function applyAccessPolish(profile=currentProfile()){
  const admin=profile?.isMainAdmin===true||profile?.role==='admin';
  document.querySelectorAll('.sidebar-nav a').forEach(a=>{
    if(String(a.textContent||'').trim().toLowerCase().includes('assumption'))a.style.display=admin?'':'none';
  });
}
function applySummaryTypography(){
  const path=(location.pathname.split('/').pop()||'').toLowerCase();
  if(path!=='opex-summary.html'||document.getElementById('dadSummaryTypography'))return;
  const st=document.createElement('style');st.id='dadSummaryTypography';st.textContent=`
    .summary-page{font-size:16px!important}
    .page-head h1{font-size:34px!important;font-weight:1000!important;line-height:1.15!important}
    .page-head p{font-size:15px!important;font-weight:750!important;line-height:1.5!important}
    .page-head .eyebrow{font-size:12px!important;font-weight:1000!important}
    .filter-card label{font-size:11.5px!important;font-weight:1000!important}
    .filter-card input{font-size:14px!important;font-weight:850!important;height:42px!important}
    .kpi span{font-size:11px!important;font-weight:1000!important}
    .kpi strong{font-size:25px!important;font-weight:1000!important}
    .summary-toolbar h2{font-size:23px!important;font-weight:1000!important}
    .summary-toolbar p{font-size:13px!important;font-weight:750!important}
    .summary-table{font-size:14px!important}
    .summary-table thead th{font-size:13px!important;padding:13px 14px!important;font-weight:1000!important}
    .summary-table td{font-size:13.5px!important;padding:13px 14px!important;font-weight:800!important}
    .summary-table td:first-child{font-size:14px!important;font-weight:1000!important}
    .status{font-size:11.5px!important;padding:6px 10px!important}
    .note{font-size:12px!important;font-weight:750!important;line-height:1.5!important}
    @media(max-width:700px){.page-head h1{font-size:30px!important}.summary-table{font-size:13px!important}}
  `;document.head.appendChild(st);
}
function removeSidebarLinks(){document.querySelectorAll('.sidebar-nav a[href="messages.html"],.sidebar-nav a[href="notifications.html"]').forEach(x=>x.remove())}
function styleIcon(a,right){
  a.style.cssText=`position:fixed;top:18px;right:${right}px;z-index:9999;width:38px;height:38px;border-radius:11px;border:1px solid rgba(18,163,151,.32);background:rgba(255,255,255,.96);color:#0a6f68;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08);transition:.18s ease;backdrop-filter:blur(8px)`;
  a.onmouseenter=()=>{a.style.boxShadow='0 0 18px rgba(31,220,198,.30),0 7px 18px rgba(15,72,75,.10)';a.style.transform='translateY(-1px) scale(1.03)'};
  a.onmouseleave=()=>{a.style.boxShadow='0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08)';a.style.transform='translateY(0) scale(1)'};
}
function styleBadge(badge,color='#2ee0c8'){
  badge.style.cssText=`display:none;position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:${color};color:#063d40;border:2px solid #fff;font-size:8px;font-weight:1000;align-items:center;justify-content:center;box-shadow:0 0 9px rgba(46,224,200,.40)`;
}
function ensureIcons(){
  removeSidebarLinks();applyAccessPolish();applySummaryTypography();
  if(!document.body)return null;
  ensureThemeToggle();
  let messages=document.getElementById('messagesHeaderIcon');
  if(!messages){
    messages=document.createElement('a');messages.id='messagesHeaderIcon';messages.href='messages.html';messages.title='Messages';messages.setAttribute('aria-label','Messages');
    messages.innerHTML='<span aria-hidden="true" style="font-size:17px;line-height:1">✉</span><span id="messagesUnreadBadge"></span>';
    styleIcon(messages,22);styleBadge(messages.querySelector('#messagesUnreadBadge'));document.body.appendChild(messages)
  }
  let notifications=document.getElementById('notificationsHeaderIcon');
  if(!notifications){
    notifications=document.createElement('a');notifications.id='notificationsHeaderIcon';notifications.href='notifications.html';notifications.title='Notifications';notifications.setAttribute('aria-label','Notifications');
    notifications.innerHTML='<span aria-hidden="true" style="font-size:17px;line-height:1">🔔</span><span id="notificationsUnreadBadge"></span>';
    styleIcon(notifications,68);styleBadge(notifications.querySelector('#notificationsUnreadBadge'),'#ffce56');document.body.appendChild(notifications)
  }
  return{messages,notifications}
}
function showCount(badge,n){if(!badge)return;if(n){badge.textContent=n>99?'99+':String(n);badge.style.display='inline-flex'}else badge.style.display='none'}
function watchInbox(user){
  const icons=ensureIcons(),email=String(user?.email||'').trim().toLowerCase();
  if(!icons||!email)return;
  if(inboxUnsub&&watchedEmail===email)return;
  if(inboxUnsub)inboxUnsub();watchedEmail=email;
  const qy=query(collection(db,'messages'),where('toEmail','==',email));
  inboxUnsub=onSnapshot(qy,s=>{
    let messages=0,notifications=0;
    s.docs.forEach(x=>{const d=x.data()||{};if(d.read===true)return;if(d.kind==='notification')notifications++;else messages++});
    showCount(icons.messages.querySelector('#messagesUnreadBadge'),messages);
    showCount(icons.notifications.querySelector('#notificationsUnreadBadge'),notifications);
  },()=>{
    showCount(icons.messages.querySelector('#messagesUnreadBadge'),0);
    showCount(icons.notifications.querySelector('#notificationsUnreadBadge'),0);
  })
}
function install(){applyAccessPolish();applySummaryTypography();const icons=ensureIcons();if(!icons){setTimeout(install,200);return}if(auth.currentUser)watchInbox(auth.currentUser)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
onAuthStateChanged(auth,u=>{if(u){applyAccessPolish();watchInbox(u)}});window.addEventListener('dad-user-ready',e=>{applyAccessPolish(e.detail?.profile||currentProfile());watchInbox(e.detail?.user||auth.currentUser)});window.addEventListener('focus',()=>{applyAccessPolish();if(auth.currentUser)watchInbox(auth.currentUser)});

const page=(location.pathname.split('/').pop()||'').toLowerCase();
if(page==='opex.html'||page==='opex-summary.html') import('./opex-fy27-integrity-fix.js?v=20260818-fy27-full-year-2').catch(e=>console.error('OPEX FY27 integrity fix failed:',e));
if(page==='submission-control.html') import('./finance-return-button.js?v=20260818-keep-approved-value-1').catch(e=>console.error('Finance return button failed:',e));
