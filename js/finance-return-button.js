function installStyle(){if(document.getElementById('financeReturnStyle'))return;const s=document.createElement('style');s.id='financeReturnStyle';s.textContent=`.finance-return-btn{height:32px;border:1px solid #efb7b1;border-radius:7px;padding:0 10px;background:#fff0ee;color:#a53d35;font-size:9px;font-weight:1000;cursor:pointer;margin-left:6px}.finance-return-btn:hover{background:#ffe5e1}.finance-return-btn:disabled{opacity:.5;cursor:not-allowed}`;document.head.appendChild(s)}
function enhance(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='submission-control.html')return;
  installStyle();
  document.querySelectorAll('#body tr[data-cc]').forEach(tr=>{
    const approved=!!tr.querySelector('.badge.approved');
    let btn=tr.querySelector('.finance-return-btn');
    if(!approved){if(btn)btn.remove();return}
    if(btn)return;
    const save=tr.querySelector('[data-save]');if(!save)return;
    btn=document.createElement('button');btn.type='button';btn.className='finance-return-btn';btn.textContent='Return';btn.title='Return this budget to the department for editing and re-upload';
    btn.onclick=()=>{
      const sel=tr.querySelector('[data-status]');
      if(!sel)return;
      sel.value='returned';
      btn.disabled=true;btn.textContent='Returning...';
      save.click();
      setTimeout(()=>{btn.disabled=false;btn.textContent='Return'},1500);
    };
    save.insertAdjacentElement('afterend',btn);
  });
}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(enhance,40)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
const body=document.getElementById('body');if(body)new MutationObserver(schedule).observe(body,{childList:true,subtree:true});
window.addEventListener('focus',schedule);
