(function(root){
'use strict';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const entries=o=>Object.entries(o&&typeof o==='object'&&!Array.isArray(o)?o:{});
function sumPeriod(map,from,to){return entries(map).reduce((sum,[period,value])=>period>=from&&period<=to?sum+num(value):sum,0)}
function sumYear(map,year){const prefix=`${year}-`;return entries(map).reduce((sum,[period,value])=>String(period).startsWith(prefix)?sum+num(value):sum,0)}
function actual(item,from='2026-01',to='2026-12'){const months=item?.actualByMonth||{},monthly=sumPeriod(months,from,to),unperiodized=Object.keys(months).length?0:num(item?.actualUnperiodized);return monthly+unperiodized}
function budget(item,from='2026-01',to='2026-12'){return sumPeriod(item?.budgetByMonth,from,to)}
function lastYear(item,from='2026-01',to='2026-12'){const shift=period=>{const [y,m]=String(period).split('-');return `${Number(y)-1}-${m}`},months=item?.lyByMonth||{},monthly=sumPeriod(months,shift(from),shift(to)),unperiodized=Object.keys(months).length?0:num(item?.lyUnperiodized);return monthly+unperiodized}
function fy2027(item){return sumYear(item?.newBudgetByMonth,2027)}
function varianceActualVsBudget(actualValue,budgetValue){return num(actualValue)-num(budgetValue)}
function variancePct(actualValue,budgetValue){const b=num(budgetValue);return Math.abs(b)<.000001?null:varianceActualVsBudget(actualValue,b)/Math.abs(b)*100}
function remaining(actualValue,fyBudget2026){return num(fyBudget2026)-num(actualValue)}
function remainingPct(actualValue,fyBudget2026){const fy=num(fyBudget2026);return Math.abs(fy)<.000001?null:remaining(actualValue,fy)/Math.abs(fy)*100}
function itemSnapshot(item,from='2026-01',to='2026-12'){const a=actual(item,from,to),b=budget(item,from,to),fy26=num(item?.fyBudget),landing=num(item?.landing),newBudget=fy2027(item);return{actual:a,budget:b,variance:varianceActualVsBudget(a,b),variancePct:variancePct(a,b),landing,fyLanding:a+landing,fyBudget2026:fy26,remaining:remaining(a,fy26),remainingPct:remainingPct(a,fy26),fyBudget2027:newBudget}}
function departmentSnapshot(department,from='2026-01',to='2026-12'){return Object.values(department?.items||{}).reduce((out,item)=>{const x=itemSnapshot(item,from,to);Object.keys(x).forEach(key=>{if(key==='variancePct'||key==='remainingPct')return;out[key]=(out[key]||0)+num(x[key])});return out},{actual:0,budget:0,variance:0,landing:0,fyLanding:0,fyBudget2026:0,remaining:0,fyBudget2027:0})}
root.DADOpexCalculation=Object.freeze({num,sumPeriod,sumYear,actual,budget,lastYear,fy2027,varianceActualVsBudget,variancePct,remaining,remainingPct,itemSnapshot,departmentSnapshot,version:'2026-08-31-stability-1'});
})(globalThis);
