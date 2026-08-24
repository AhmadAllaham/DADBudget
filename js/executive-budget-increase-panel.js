(function(){
'use strict';
const $=id=>document.getElementById(id);
const num=v=>{const s=String(v??'').replace(/,/g,'').replace(/[—–]/g,'').trim();const n=Number(s);return Number.isFinite(n)?n:0};
const money=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:0});
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
let timer=null;
function rowsFromDepartmentTable(){
  const body=$('departmentBody');if(!body)return[];
  return [...body.querySelectorAll('tr')].map(tr=>{
    const cells=[...tr.cells];if(cells.length<8)return null;
    const name=cells[0].querySelector('b')?.textContent?.trim()||'';
    const cc=cells[0].querySelector('small')?.textContent?.trim()||'';
    const fy26=num(cells[5]?.textContent),fy27=num(cells[7]?.textContent);
    return{name,cc,fy26,fy27,increase:fy27-fy26};
  }).filter(Boolean);
}
function render(){
  const host=$('overviewExceptions');if(!host)return;
  const rows=rowsFromDepartmentTable().filter(x=>x.fy27>x.fy26+0.004).sort((a,b)=>b.increase-a.increase);
  host.style.maxHeight='430px';host.style.overflow='auto';host.style.paddingRight='4px';
  host.innerHTML=rows.length?rows.map(x=>{
    const pct=x.fy26>0?(x.increase/x.fy26*100):null;
    const change=pct===null?`+${money(x.increase)} · New budget`:`+${money(x.increase)} · +${pct.toLocaleString(undefined,{maximumFractionDigits:1})}%`;
    return `<div class="exception"><div><b>${esc(x.name||x.cc)}</b><small>${esc(x.cc)} · FY 2026 ${money(x.fy26)} → FY 2027 ${money(x.fy27)}</small></div><strong>${change}</strong></div>`;
  }).join(''):'<div class="empty-state">No departments have FY Budget 2027 above FY Budget 2026.</div>';
}
function queue(){clearTimeout(timer);timer=setTimeout(render,30)}
function start(){
  const body=$('departmentBody');if(!body)return setTimeout(start,150);
  new MutationObserver(queue).observe(body,{childList:true,subtree:true,characterData:true});
  queue();
}
window.addEventListener('load',start);window.addEventListener('dad-user-ready',()=>setTimeout(start,150));setTimeout(start,400);
})();
