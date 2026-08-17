const THRESHOLD=5;

function parseNumber(text){
  const s=String(text??'').replace(/,/g,'').replace(/[^0-9.()\-]/g,'').trim();
  if(!s)return 0;
  if(/^\(.*\)$/.test(s))return -Number(s.slice(1,-1))||0;
  const n=Number(s);return Number.isFinite(n)?n:0;
}

function ensureStyle(){
  if(document.getElementById('opexBudgetIncreaseAlertStyle'))return;
  const st=document.createElement('style');
  st.id='opexBudgetIncreaseAlertStyle';
  st.textContent=`
    .budget-increase-dot{
      display:inline-block;
      width:8px;height:8px;
      margin-left:8px;
      border-radius:50%;
      background:#ff3b3b;
      vertical-align:middle;
      box-shadow:0 0 5px rgba(255,59,59,.75),0 0 10px rgba(255,59,59,.35);
      animation:budgetAlertPulse 1.8s ease-in-out infinite;
      cursor:help;
    }
    @keyframes budgetAlertPulse{
      0%,100%{box-shadow:0 0 4px rgba(255,59,59,.58),0 0 8px rgba(255,59,59,.24)}
      50%{box-shadow:0 0 7px rgba(255,59,59,.9),0 0 13px rgba(255,59,59,.42)}
    }
  `;
  document.head.appendChild(st);
}

function evaluateRow(row){
  if(!row.classList.contains('detail-row'))return;
  const label=row.querySelector('td:first-child');
  const fyCell=row.querySelector('.fy-cell');
  const newCell=row.querySelector('.new-budget-cell');
  if(!label||!fyCell||!newCell)return;

  label.querySelectorAll('.budget-increase-dot').forEach(x=>x.remove());
  const fy=parseNumber(fyCell.textContent);
  const next=parseNumber(newCell.textContent);
  let increasePct=null,flag=false;

  if(Math.abs(fy)<0.005){
    if(next>0){flag=true;increasePct=Infinity}
  }else{
    increasePct=((next-fy)/Math.abs(fy))*100;
    flag=increasePct>THRESHOLD;
  }

  if(!flag)return;
  const dot=document.createElement('span');
  dot.className='budget-increase-dot';
  dot.setAttribute('aria-label','Budget increase alert');
  dot.title=increasePct===Infinity
    ? `FY Budget 2027 increased from 0 to ${next.toLocaleString()} — review required`
    : `FY Budget 2027 is ${increasePct.toFixed(1)}% above FY Budget 2026`;
  label.appendChild(dot);
}

function applyAlerts(){
  ensureStyle();
  document.querySelectorAll('#opexBody .detail-row').forEach(evaluateRow);
}

let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(applyAlerts,30)}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyAlerts);else applyAlerts();
const body=document.getElementById('opexBody');
if(body)new MutationObserver(schedule).observe(body,{childList:true,subtree:true,characterData:true});
window.addEventListener('dad-opex-cloud-ready',schedule);
window.addEventListener('dad-opex-refresh-departments',schedule);
