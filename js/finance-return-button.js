import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';

function installStyle(){
  if(document.getElementById('financeReturnStyle'))return;
  const s=document.createElement('style');s.id='financeReturnStyle';
  s.textContent=`.finance-return-btn{height:32px;border:1px solid #efb7b1;border-radius:7px;padding:0 10px;background:#fff0ee;color:#a53d35;font-size:9px;font-weight:1000;cursor:pointer;margin-left:6px}.finance-return-btn:hover{background:#ffe5e1}.finance-return-btn:disabled{opacity:.5;cursor:not-allowed}`;
  document.head.appendChild(s)
}

async function returnBudget(tr,btn){
  const user=auth.currentUser;if(!user||user.uid!==MAIN){alert('Main Admin only');return}
  const cc=String(tr.dataset.cc||'').trim();if(!cc)return;
  try{
    btn.disabled=true;btn.textContent='Returning...';
    await Promise.all([
      setDoc(doc(db,'opex_budget_submissions',cc),{
        workflowStatus:'returned',financeStatus:'returned',workflowUpdatedAt:serverTimestamp(),financeUpdatedBy:user.uid,financeUpdatedEmail:(user.email||'').toLowerCase()
      },{merge:true}),
      setDoc(doc(db,'budget_submission_status',cc),{
        status:'returned',updatedBy:user.uid,updatedByEmail:(user.email||'').toLowerCase(),updatedAt:serverTimestamp(),clientUpdatedAt:new Date().toISOString()
      },{merge:true})
    ]);
    btn.textContent='Returned ✓';
    setTimeout(()=>location.reload(),350);
  }catch(e){
    btn.disabled=false;btn.textContent='Return';alert('Return failed: '+(e?.message||e));
  }
}

function enhance(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='submission-control.html')return;
  installStyle();
  document.querySelectorAll('#body tr[data-cc]').forEach(tr=>{
    const approved=!!tr.querySelector('.badge.approved');
    let btn=tr.querySelector('.finance-return-btn');
    if(!approved){if(btn)btn.remove();return}
    if(btn)return;
    const save=tr.querySelector('[data-save]');if(!save)return;
    btn=document.createElement('button');btn.type='button';btn.className='finance-return-btn';btn.textContent='Return';btn.title='Return this approved budget to the department for editing and re-upload';
    btn.onclick=()=>returnBudget(tr,btn);
    save.insertAdjacentElement('afterend',btn);
  })
}

let timer;function schedule(){clearTimeout(timer);timer=setTimeout(enhance,40)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('focus',schedule);
