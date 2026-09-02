import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
let loading=false,lastLoadedAt=0;

function isFinanceApproved(record={}){
  const workflow=clean(record.workflowStatus||record.status).toLowerCase();
  const status=clean(record.status).toLowerCase();
  const finance=clean(record.financeStatus).toLowerCase();
  if(['returned','manager_returned','pending_manager','pending_it','uploaded','not_submitted'].includes(workflow))return false;
  if(['returned','not_submitted','pending','under_review'].includes(finance))return false;
  return finance==='approved'||workflow==='approved'||status==='approved';
}

function capexTotal(record={}){
  const rowTotal=(Array.isArray(record.rows)?record.rows:[]).reduce((s,r)=>s+num(r?.total),0);
  const stored=Number(record.total);
  if(Number.isFinite(stored)&&Math.abs(stored)>.005)return stored;
  return rowTotal;
}

function paymentRows(record={}){
  if(Array.isArray(record.payments))return record.payments;
  if(Array.isArray(record.paymentSchedule))return record.paymentSchedule;
  if(Array.isArray(record.paymentRows))return record.paymentRows;
  return [];
}

function metric(label,value,note=''){
  return `<div class="plan-metric"><span>${label}</span><strong>${value}</strong>${note?`<small>${note}</small>`:''}</div>`;
}

function summarize(records){
  let budget=0,requests=0,departments=0,pay2027=0,pay2028=0,payOther=0;
  const byCc={};
  records.forEach(record=>{
    if(!isFinanceApproved(record))return;
    const cc=clean(record.cc||record.fundCenter);
    const total=capexTotal(record);
    if(cc)byCc[cc]=total;
    departments++;
    budget+=total;
    requests+=(Array.isArray(record.rows)?record.rows:[]).length;
    paymentRows(record).forEach(p=>{
      const amount=num(p?.amount),date=clean(p?.expectedPaymentDate||p?.date);
      if(date.startsWith('2027-'))pay2027+=amount;
      else if(date.startsWith('2028-'))pay2028+=amount;
      else payOther+=amount;
    });
  });
  return{budget,requests,departments,pay2027,pay2028,payOther,byCc};
}

function patchShared(summary){
  const shared=window.DADExecutiveShared;
  if(!shared)return;
  if(shared.planningSummary){
    shared.planningSummary.capexBudget=summary.budget;
    shared.planningSummary.capexRequests=summary.requests;
    shared.planningSummary.capexDepartments=summary.departments;
    shared.planningSummary.capexPayments2027=summary.pay2027;
    shared.planningSummary.capexPayments2028=summary.pay2028;
    shared.planningSummary.capexPaymentsOther=summary.payOther;
  }
  if(Array.isArray(shared.departments))shared.departments.forEach(row=>{row.capex=num(summary.byCc[clean(row.cc)])});
}

function patchDom(summary){
  const remaining=Math.max(0,summary.budget-summary.pay2027-summary.pay2028-summary.payOther);
  if($('capexSummaryMetrics'))$('capexSummaryMetrics').innerHTML=metric('FY Budget 2027',money(summary.budget),'JOD')+metric('Requests',summary.requests.toLocaleString(),`${summary.departments} departments`);
  if($('capexPaymentMetrics'))$('capexPaymentMetrics').innerHTML=metric('Pay in 2027',money(summary.pay2027),'JOD')+metric('Pay in 2028',money(summary.pay2028),'JOD')+metric('Remaining / Unscheduled',money(remaining),'JOD');
  if($('kpiCapex27'))$('kpiCapex27').textContent=money(summary.budget);
}

async function refresh(force=false){
  if(loading)return;
  if(!force&&Date.now()-lastLoadedAt<1500)return;
  const app=getApps()[0];if(!app)return;
  loading=true;
  try{
    const snap=await getDocs(collection(getFirestore(app),'capex_budget_submissions'));
    const records=[];snap.forEach(d=>records.push({cc:d.id,...(d.data()||{})}));
    const summary=summarize(records);
    lastLoadedAt=Date.now();
    patchShared(summary);
    patchDom(summary);
    try{sessionStorage.removeItem('dadBudgetExecutiveCacheV3')}catch(_){}
    window.dispatchEvent(new CustomEvent('dad-executive-capex-ready',{detail:summary}));
  }catch(err){console.warn('Executive CAPEX finance sync failed',err)}finally{loading=false}
}

window.addEventListener('dad-executive-data-ready',()=>refresh(true));
window.addEventListener('focus',()=>refresh(true));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>refresh(true),250));else setTimeout(()=>refresh(true),250);
setTimeout(()=>refresh(true),1800);
