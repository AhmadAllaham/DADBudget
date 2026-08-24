(function(){
'use strict';
const STORAGE_KEY='dadBudgetHeadcountHideZeroRows';
const $=id=>document.getElementById(id);
let hideZero=localStorage.getItem(STORAGE_KEY)==='1',applying=false;

function numberFromCell(cell){
  const raw=String(cell?.textContent||'').replace(/,/g,'').trim();
  const value=Number(raw);
  return Number.isFinite(value)?value:0;
}
function isZeroDepartmentRow(row){
  if(!row||row.classList.contains('total-row')||row.querySelector('.empty'))return false;
  const cells=row.cells;
  if(!cells||cells.length<8)return false;
  return [2,3,4,5,6,7].every(index=>Math.abs(numberFromCell(cells[index]))<0.000001);
}
function apply(){
  if(applying)return;applying=true;
  try{
    const body=$('headcountBody'),button=$('headcountZeroToggle');
    if(!body)return;
    let visible=0,zeroCount=0;
    [...body.rows].forEach(row=>{
      if(row.classList.contains('total-row')||row.querySelector('.empty'))return;
      const zero=isZeroDepartmentRow(row);
      row.dataset.zeroRow=zero?'1':'0';
      row.hidden=hideZero&&zero;
      if(zero)zeroCount++;
      if(!row.hidden)visible++;
    });
    const totalRow=body.querySelector('.total-row');
    if(totalRow?.cells?.[1])totalRow.cells[1].textContent=`${visible} Departments`;
    if(button){
      button.textContent=hideZero?'Show Zero Rows':'Hide Zero Rows';
      button.classList.toggle('active',hideZero);
      button.title=hideZero?`${zeroCount} all-zero departments are hidden`:'Hide departments where every Headcount value is zero';
      button.setAttribute('aria-pressed',hideZero?'true':'false');
    }
  }finally{applying=false}
}
function installSalaryNav(){
  const sub=document.querySelector('.hr-subnav');if(!sub||sub.querySelector('a[href="hr-salaries.html"]'))return;
  const a=document.createElement('a');a.href='hr-salaries.html';a.textContent='Salaries Budget';sub.appendChild(a);
}
function install(){
  installSalaryNav();
  const tools=document.querySelector('.filter-tools'),body=$('headcountBody');
  if(!tools||!body)return;
  if(!$('headcountZeroToggle')){
    const button=document.createElement('button');
    button.id='headcountZeroToggle';button.type='button';button.className='headcount-zero-toggle';
    button.addEventListener('click',()=>{hideZero=!hideZero;localStorage.setItem(STORAGE_KEY,hideZero?'1':'0');apply()});
    tools.insertBefore(button,tools.firstChild);
  }
  if(!document.getElementById('headcountZeroFilterStyle')){
    const style=document.createElement('style');style.id='headcountZeroFilterStyle';style.textContent='.headcount-zero-toggle{height:40px;border:1px solid #55cfc4;border-radius:9px;background:#fff;color:#08756d;padding:0 13px;font-size:12px;font-weight:1000;cursor:pointer;white-space:nowrap}.headcount-zero-toggle.active{background:#e4f8f4;border-color:#13a79b;color:#056a63}.headcount-table tr[hidden]{display:none!important}';document.head.appendChild(style);
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(apply));observer.observe(body,{childList:true,subtree:true,characterData:true});
  $('headcountSearch')?.addEventListener('input',()=>requestAnimationFrame(apply));
  $('headcountDepartmentButton')?.addEventListener('click',()=>setTimeout(apply,0));
  apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();