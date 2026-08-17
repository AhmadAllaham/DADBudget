import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);

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
function removeSidebarLink(){document.querySelectorAll('.sidebar-nav a[href="messages.html"]').forEach(x=>x.remove())}
function ensureIcon(){
  removeSidebarLink();
  applyAccessPolish();applySummaryTypography();
  let a=document.getElementById('messagesHeaderIcon');
  if(a){if(a.parentElement!==document.body)document.body.appendChild(a);return a}
  if(!document.body)return null;
  a=document.createElement('a');
  a.id='messagesHeaderIcon';a.href='messages.html';a.title='Messages';a.setAttribute('aria-label','Messages');
  a.innerHTML='<span aria-hidden="true" style="font-size:17px;line-height:1">✉</span><span id="messagesUnreadBadge"></span>';
  a.style.cssText='position:fixed;top:18px;right:22px;z-index:9999;width:38px;height:38px;border-radius:11px;border:1px solid rgba(18,163,151,.32);background:rgba(255,255,255,.96);color:#0a6f68;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08);transition:.18s ease;backdrop-filter:blur(8px)';
  a.onmouseenter=()=>{a.style.boxShadow='0 0 18px rgba(31,220,198,.30),0 7px 18px rgba(15,72,75,.10)';a.style.transform='translateY(-1px) scale(1.03)'};
  a.onmouseleave=()=>{a.style.boxShadow='0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08)';a.style.transform='translateY(0) scale(1)'};
  const badge=a.querySelector('#messagesUnreadBadge');
  badge.style.cssText='display:none;position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#2ee0c8;color:#063d40;border:2px solid #fff;font-size:8px;font-weight:1000;align-items:center;justify-content:center;box-shadow:0 0 9px rgba(46,224,200,.40)';
  document.body.appendChild(a);return a;
}
async function refresh(user){const link=ensureIcon();if(!link||!user?.email)return;const badge=link.querySelector('#messagesUnreadBadge');try{const s=await getDocs(query(collection(db,'messages'),where('toEmail','==',String(user.email).toLowerCase())));const n=s.docs.filter(x=>x.data()?.read!==true).length;if(n){badge.textContent=n>99?'99+':String(n);badge.style.display='inline-flex'}else badge.style.display='none'}catch(_){badge.style.display='none'}}
function install(){applyAccessPolish();applySummaryTypography();const a=ensureIcon();if(!a){setTimeout(install,200);return}const u=auth.currentUser;if(u)refresh(u)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
onAuthStateChanged(auth,u=>{if(u){applyAccessPolish();refresh(u)}});window.addEventListener('dad-user-ready',e=>{applyAccessPolish(e.detail?.profile||currentProfile());refresh(e.detail?.user||auth.currentUser)});window.addEventListener('focus',()=>{applyAccessPolish();if(auth.currentUser)refresh(auth.currentUser)});
