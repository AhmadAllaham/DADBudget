const KEY='dadBudgetOPEXBaselineV17';
const NEW_YEAR=2027;
const CATS=[['Employees Benefits','601'],['Travel Costs','602'],['Depreciation and Amortization','603'],['Maintenance cost','604'],['A&P, Marketing Activities','605'],['IT and Connectivity Expenses','606'],['Professional & Consultation Expenses','607'],['Utilities Expenses','608'],['Insurance Expenses','609'],['Logistic Expenses','610'],['Governmental and Taxes Expenses','611'],['Vehicles Expenses','612'],['Products related Expense','613'],['Other Expenses','614']];
const clean=v=>String(v??'').trim();
const num=v=>{const x=Number(v||0);return Number.isFinite(x)?x:0};
const fmt=v=>Math.abs(num(v))<.005?'—':num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const pct=(a,b)=>Math.abs(num(b))<.005?null:(num(a)-num(b))/Math.abs(num(b))*100;
function loadModel(){try{const m=JSON.parse(localStorage.getItem(KEY)||'null');return m?.departments?m:null}catch(_){return null}}
function fy27(item){let s=0;Object.entries(item?.newBudgetByMonth||{}).forEach(([k,v])=>{if(String(k).startsWith(String(NEW_YEAR)+'-'))s+=num(v)});return s}
function fy26(item){return num(item?.fyBudget)}
function cat(code){if(code==='6050015'||code==='6050016')return'Other Expenses';if(code==='6140019')return'Products related Expense';return(CATS.find(x=>x[1]===String(code).slice(0,3))||['Other Expenses'])[0]}
function setVarianceCell(cell,value,isPct=false){if(!cell)return;cell.classList.remove('positive-var','negative-var');if(value===null){cell.textContent='—';return}cell.textContent=isPct?value.toLocaleString(undefined,{maximumFractionDigits:1})+'%':fmt(value);if(value>0)cell.classList.add('positive-var');else if(value<0)cell.classList.add('negative-var')}
function updateOpex(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='opex.html')return;
  const m=loadModel(),cc=document.getElementById('deptFilter')?.value,d=m?.departments?.[cc],body=document.getElementById('opexBody');if(!d||!body)return;
  const byCat={};CATS.forEach(([c])=>byCat[c]=0);let total=0;
  Object.values(d.items||{}).forEach(x=>{const v=fy27(x);total+=v;(byCat[cat(x.code)]??=0);byCat[cat(x.code)]+=v});
  body.querySelectorAll('.detail-row').forEach(row=>{const code=clean(row.querySelector('.gl-code')?.textContent),item=d.items?.[code],cell=row.querySelector('.new-budget-cell');if(item&&cell)cell.textContent=fmt(fy27(item))});
  body.querySelectorAll('.group-row').forEach(row=>{const name=clean(row.querySelector('td:first-child')?.textContent),cell=row.querySelector('.new-budget-cell');if(cell&&Object.prototype.hasOwnProperty.call(byCat,name))cell.textContent=fmt(byCat[name])});
  const totalCell=body.querySelector('.total-row .new-budget-cell');if(totalCell)totalCell.textContent=fmt(total);
  const kpi=document.getElementById('kpiNewBudget');if(kpi)kpi.textContent=fmt(total);
}
function updateSummary(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='opex-summary.html')return;
  // The Summary page now calculates and renders its columns directly.
  // Do not rewrite cells by numeric index here: the column order is configurable,
  // and the legacy index mapping overwrote "Vs Budget" with FY Budget 2026.
}
let busy=false,timer;
function apply(){if(busy)return;busy=true;try{updateOpex();updateSummary()}finally{busy=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(apply,40)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
const target=document.getElementById('opexBody')||document.getElementById('summaryBody');if(target)new MutationObserver(schedule).observe(target,{childList:true,subtree:true,characterData:true});
['change','input'].forEach(ev=>document.addEventListener(ev,e=>{if(['deptFilter','dateFrom','dateTo','searchDept'].includes(e.target?.id))schedule()}));
window.addEventListener('dad-opex-cloud-ready',schedule);window.addEventListener('dad-opex-refresh-departments',schedule);
