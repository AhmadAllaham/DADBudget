const KEY='dadBudgetOPEXBaselineV17';
const TRAVEL_NAMES={
  '6020001':'Travel Tickets',
  '6020002':'Travel Hotels',
  '6020003':'Travel Transportation',
  '6020004':'Travel Meals',
  '6020005':'Travel Visa',
  '6020006':'Travel Per Diem',
  '6020007':'Travel Insurance',
  '6020008':'Local Per Diem',
  '6020009':'Local Transportation',
  '6020010':'Other Travel Cost'
};
const clean=v=>String(v??'').trim();
function model(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){return null}}
function goodName(name,code){const n=clean(name),c=clean(code);return n&&n!==c&&!/^unknown account$/i.test(n)}
function buildNames(m){
  const names={...TRAVEL_NAMES};
  Object.entries(m?.accountMaster||{}).forEach(([code,a])=>{if(goodName(a?.name,code))names[clean(code)]=clean(a.name)});
  Object.values(m?.departments||{}).forEach(d=>Object.values(d?.items||{}).forEach(x=>{
    const code=clean(x?.code);if(code&&goodName(x?.name,code)&&!names[code])names[code]=clean(x.name)
  }));
  return names;
}
function fix(){
  const m=model();if(!m)return;
  const names=buildNames(m);
  document.querySelectorAll('#opexBody tr.detail-row td:first-child').forEach(td=>{
    const code=clean(td.querySelector('.gl-code')?.textContent);if(!code)return;
    const span=td.querySelector('.gl-code');
    let current='';
    for(const node of [...td.childNodes]){if(node.nodeType===Node.TEXT_NODE){current+=node.textContent}}
    current=clean(current);
    if(goodName(current,code))return;
    const name=names[code]||`Unknown Account`;
    for(const node of [...td.childNodes]){if(node.nodeType===Node.TEXT_NODE)node.remove()}
    td.insertBefore(document.createTextNode(name),span||td.firstChild);
  });
}
function start(){
  const body=document.getElementById('opexBody');if(!body)return;
  fix();
  const obs=new MutationObserver(()=>fix());obs.observe(body,{childList:true,subtree:true});
  window.addEventListener('dad-opex-cloud-ready',()=>setTimeout(fix,0));
  window.addEventListener('dad-opex-refresh-departments',()=>setTimeout(fix,0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
