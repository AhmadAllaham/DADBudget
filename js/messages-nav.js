import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);

function removeSidebarLink(){document.querySelectorAll('.sidebar-nav a[href="messages.html"]').forEach(x=>x.remove())}
function ensureIcon(){
  removeSidebarLink();
  let a=document.getElementById('messagesHeaderIcon');if(a)return a;
  const logout=document.getElementById('logoutBtn');
  const host=logout?.parentElement||document.querySelector('.page-header')||document.querySelector('.main-content');
  if(!host)return null;
  a=document.createElement('a');
  a.id='messagesHeaderIcon';a.href='messages.html';a.title='Messages';
  a.innerHTML='<span aria-hidden="true" style="font-size:16px;line-height:1">✉</span><span id="messagesUnreadBadge"></span>';
  a.style.cssText='position:relative;width:36px;height:36px;border-radius:10px;border:1px solid rgba(18,163,151,.28);background:rgba(255,255,255,.92);color:#0a6f68;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 0 12px rgba(31,220,198,.10);transition:.18s ease;flex:0 0 auto';
  a.onmouseenter=()=>{a.style.boxShadow='0 0 15px rgba(31,220,198,.24)';a.style.transform='translateY(-1px)'};
  a.onmouseleave=()=>{a.style.boxShadow='0 0 12px rgba(31,220,198,.10)';a.style.transform='translateY(0)'};
  const badge=a.querySelector('#messagesUnreadBadge');
  badge.style.cssText='display:none;position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#2ee0c8;color:#063d40;border:2px solid #fff;font-size:8px;font-weight:1000;align-items:center;justify-content:center;box-shadow:0 0 9px rgba(46,224,200,.36)';
  if(logout)logout.parentElement.insertBefore(a,logout);else host.appendChild(a);
  return a;
}
async function refresh(user){const link=ensureIcon();if(!link||!user?.email)return;const badge=link.querySelector('#messagesUnreadBadge');try{const s=await getDocs(query(collection(db,'messages'),where('toEmail','==',String(user.email).toLowerCase())));const n=s.docs.filter(x=>x.data()?.read!==true).length;if(n){badge.textContent=n>99?'99+':String(n);badge.style.display='inline-flex'}else badge.style.display='none'}catch(_){badge.style.display='none'}}
function install(){const a=ensureIcon();if(!a)setTimeout(install,300);const u=auth.currentUser;if(u)refresh(u)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
onAuthStateChanged(auth,u=>{if(u)refresh(u)});window.addEventListener('dad-user-ready',e=>refresh(e.detail?.user||auth.currentUser));window.addEventListener('focus',()=>{if(auth.currentUser)refresh(auth.currentUser)});