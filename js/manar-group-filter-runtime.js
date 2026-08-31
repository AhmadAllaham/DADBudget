(function(){
  if(!/opex\.html$/i.test((location.pathname||'').split('?')[0]))return;
  const IDS=['1000401101','1000401104','1000401105','1000401106'];
  const VALUE='GROUP:RD_ANALYTICAL';
  const LABEL='R&D + Analytical + Packaging Development + Formulation · 4 Fund Centers';
  let busy=false,timer=0;

  function patchGroupApi(){
    const api=window.DADDepartmentGroups,group=api?.groups?.RD_ANALYTICAL;
    if(!group)return;
    group.ids=IDS.slice();
    group.label='R&D + Analytical + Packaging Development + Formulation';
    group.names={...(group.names||{}),'1000401104':'Formulation Department'};
  }

  function ensure(){
    if(busy)return;
    const select=document.getElementById('deptFilter');
    if(!select)return;
    patchGroupApi();
    const values=new Set([...select.options].map(option=>String(option.value||'').trim()));
    if(!IDS.every(cc=>values.has(cc)))return;
    const existing=[...select.options].find(option=>option.value===VALUE);
    if(existing){if(existing.textContent!==LABEL)existing.textContent=LABEL;return}
    busy=true;
    const previous=select.value,option=document.createElement('option');
    option.value=VALUE;
    option.textContent=LABEL;
    select.insertBefore(option,select.firstChild);
    if(previous&&[...select.options].some(item=>item.value===previous))select.value=previous;
    busy=false;
  }

  function start(){
    const select=document.getElementById('deptFilter');
    if(!select){setTimeout(start,150);return}
    ensure();
    new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(ensure,0)}).observe(select,{childList:true,subtree:true});
    ['dad-opex-cloud-ready','dad-opex-refresh-departments','dad-rd-group-access-ready'].forEach(name=>window.addEventListener(name,ensure));
    let attempts=0;const interval=setInterval(()=>{ensure();if(++attempts>=30)clearInterval(interval)},500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
