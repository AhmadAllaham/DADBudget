import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);

function removeSidebarLink(){document.querySelectorAll('.sidebar-nav a[href="messages.html"]').forEach(x=>x.remove())}
function ensureIcon(){
  removeSidebarLink();
  let a=document.getElementById('messagesHeaderIcon');
  if(a){
    if(a.parentElement!==document.body)document.body.appendChild(a);
    return a;
  }
  if(!document.body)return null;
  a=document.createElement('a');
  a.id='messagesHeaderIcon';a.href='messages.html';a.title='Messages';a.setAttribute('aria-label','Messages');
  a.innerHTML='<span aria-hidden="true" style="font-size:17px;line-height:1">✉</span><span id="messagesUnreadBadge"></span>';
  a.style.cssText='position:fixed;top:18px;right:22px;z-index:9999;width:38px;height:38px;border-radius:11px;border:1px solid rgba(18,163,151,.32);background:rgba(255,255,255,.96);color:#0a6f68;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08);transition:.18s ease;backdrop-filter:blur(8px)';
  a.onmouseenter=()=>{a.style.boxShadow='0 0 18px rgba(31,220,198,.30),0 7px 18px rgba(15,72,75,.10)';a.style.transform='translateY(-1px) scale(1.03)'};
  a.onmouseleave=()=>{a.style.boxShadow='0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08)';a.style.transform='translateY(0) scale(1)'};
  const badge=a.querySelector('#messagesUnreadBadge');
  badge.style.cssText='display:none;position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#2ee0c8;color:#063d40;border:2px solid #fff;font-size:8px;font-weight:1000;align-items:center;justify-content:center;box-shadow:0 0 9px rgba(46,224,200,.40)';
  document.body.appendChild(a);
  return a;
}
async function refresh(user){const link=ensureIcon();if(!link||!user?.email)return;const badge=link.querySelector('#messagesUnreadBadge');try{const s=await getDocs(query(collection(db,'messages'),where('toEmail','==',String(user.email).toLowerCase())));const n=s.docs.filter(x=>x.data()?.read!==true).length;if(n){badge.textContent=n>99?'99+':String(n);badge.style.display='inline-flex'}else badge.style.display='none'}catch(_){badge.style.display='none'}}
function install(){const a=ensureIcon();if(!a){setTimeout(install,200);return}const u=auth.currentUser;if(u)refresh(u)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
onAuthStateChanged(auth,u=>{if(u)refresh(u)});window.addEventListener('dad-user-ready',e=>refresh(e.detail?.user||auth.currentUser));window.addEventListener('focus',()=>{if(auth.currentUser)refresh(auth.currentUser)});
