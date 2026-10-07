import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>num(v).toLocaleString(undefined,{maximumFractionDigits:0});
const salesK=v=>Math.round(num(v)/1000).toLocaleString('en-US',{maximumFractionDigits:0});
const JOD_PER_USD=0.709;
const usdK=v=>Math.round((num(v)/JOD_PER_USD)/1000).toLocaleString('en-US',{maximumFractionDigits:0});
const norm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const escapeHtml=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let loading=false,lastLoadedAt=0,salesSources=null;

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

function addPaymentTotals(target,rows=[]){
  rows.forEach(p=>{
    const amount=num(p?.amount),date=clean(p?.expectedPaymentDate||p?.date);
    if(date.startsWith('2027-'))target.pay2027+=amount;
    else if(date.startsWith('2028-'))target.pay2028+=amount;
    else target.payOther+=amount;
  });
}

function summarize(records,tunis={}){
  const summary={budget:0,approvedBudget:0,requests:0,departments:0,approvedDepartments:0,pay2027:0,pay2028:0,payOther:0,byCc:{},tunisBudget:0};
  records.forEach(record=>{
    const cc=clean(record.cc||record.fundCenter);
    const total=capexTotal(record);
    if(cc)summary.byCc[cc]=total;
    summary.departments++;
    summary.budget+=total;
    summary.requests+=(Array.isArray(record.rows)?record.rows:[]).length;
    addPaymentTotals(summary,paymentRows(record));
    if(isFinanceApproved(record)){
      summary.approvedBudget+=total;
      summary.approvedDepartments++;
    }
  });
  const tunisRows=Array.isArray(tunis?.rows)?tunis.rows:[];
  const tunisStored=Number(tunis?.total);
  const tunisBudget=Number.isFinite(tunisStored)?tunisStored:tunisRows.reduce((s,r)=>s+num(r?.total),0);
  if(tunisRows.length||Math.abs(tunisBudget)>.005){
    summary.tunisBudget=tunisBudget;
    summary.budget+=tunisBudget;
    summary.requests+=tunisRows.length;
    summary.departments++;
    summary.byCc.TUNIS=tunisBudget;
    const tunisPayments=Array.isArray(tunis?.payments)?tunis.payments:tunisRows.flatMap(r=>Array.isArray(r?.payments)?r.payments:[]);
    addPaymentTotals(summary,tunisPayments);
  }
  return summary;
}

function patchShared(summary){
  const shared=window.DADExecutiveShared;
  if(!shared)return;
  if(shared.planningSummary){
    shared.planningSummary.capexUploadedBudget=summary.budget;
    shared.planningSummary.capexBudget=summary.approvedBudget;
    shared.planningSummary.capexRequests=summary.requests;
    shared.planningSummary.capexDepartments=summary.departments;
    shared.planningSummary.capexPayments2027=summary.pay2027;
    shared.planningSummary.capexPayments2028=summary.pay2028;
    shared.planningSummary.capexPaymentsOther=summary.payOther;
    shared.planningSummary.capexTunisBudget=summary.tunisBudget;
  }
}

function setCardNote(id,text){
  const note=$(id)?.closest('.exec-kpi')?.querySelector('small');
  if(note)note.textContent=text;
}

function patchOverviewCurrency(){
  const rows=Array.isArray(window.DADExecutiveShared?.departments)?window.DADExecutiveShared.departments:[];
  if(!rows.length)return;
  const total=key=>rows.reduce((sum,row)=>sum+num(row?.[key]),0);
  if($('kpiBudgetYtd'))$('kpiBudgetYtd').textContent=usdK(total('budgetYtd'));
  if($('kpiActual'))$('kpiActual').textContent=usdK(total('actualYtd'));
  if($('kpiRemaining'))$('kpiRemaining').textContent=usdK(total('remaining'));
  if($('kpiFyLanding'))$('kpiFyLanding').textContent=usdK(total('fyLanding'));
  if($('kpiOpex27'))$('kpiOpex27').textContent=usdK(total('fy27'));
  setCardNote('kpiBudgetYtd',"OPEX baseline · USD '000");
  setCardNote('kpiActual',"All departments · USD '000");
  setCardNote('kpiRemaining',"FY budget less actual · USD '000");
  setCardNote('kpiFyLanding',"Actual YTD + Landing · USD '000");
  setCardNote('kpiOpex27',"All budgeted departments · USD '000");
}

function patchCapexDom(summary){
  const remaining=Math.max(0,summary.budget-summary.pay2027-summary.pay2028-summary.payOther);
  const host=$('capexSummaryMetrics');
  if(host){
    host.innerHTML=metric('FY Budget 2027',money(summary.budget),'All uploaded · JOD')+metric('Requests',summary.requests.toLocaleString(),`${summary.departments} uploaded sources`)+metric('Approved Portion',money(summary.approvedBudget),`${summary.approvedDepartments} approved departments`);
    const chip=host.closest('.planning-summary-card')?.querySelector('.plan-chip');
    if(chip)chip.textContent='All Uploaded';
  }
  if($('capexPaymentMetrics'))$('capexPaymentMetrics').innerHTML=metric('Pay in 2027',money(summary.pay2027),'All uploaded · JOD')+metric('Pay in 2028',money(summary.pay2028),'All uploaded · JOD')+metric('Remaining / Unscheduled',money(remaining),'JOD');
  if($('kpiCapex27'))$('kpiCapex27').textContent=usdK(summary.budget);
  setCardNote('kpiCapex27',"All uploaded submissions · USD '000");
}

function salesValueScale(meta,rows){
  if(meta?.schema!=='ims-platform-v1')return 1;
  const headers=(meta.headers||[]).map(v=>clean(v).replace(/\s+/g,' ').toUpperCase()),priceIndex=headers.indexOf('PRICE USD');
  if(priceIndex<0)return 1;
  const sample=rows.find(r=>num(r.totalSales)>0&&num(r.totalQty)>0&&num(r.displayValues?.[priceIndex])>0);
  if(!sample)return 1;
  const ratio=num(sample.displayValues[priceIndex])*num(sample.totalQty)/num(sample.totalSales);
  return ratio>990&&ratio<1010?1000:1;
}

function readLocalSales(source='ims'){
  const tms=source==='tms',base=tms?'dadBudgetTMSSales':'dadBudgetIMSSales',label=tms?'TMS':'IMS';
  let meta=null;
  try{meta=JSON.parse(localStorage.getItem(`${base}Meta`)||'null')}catch(_){}
  if(!meta)return{source,label,available:false,total:0,countries:[]};
  const rows=[];
  for(let i=0;i<num(meta.chunkCount);i++){
    try{const chunk=JSON.parse(localStorage.getItem(`${base}Chunk_${i}`)||'[]');if(Array.isArray(chunk))rows.push(...chunk)}catch(_){}
  }
  const scale=salesValueScale(meta,rows),countryMap={};let total=0;
  rows.forEach(r=>{const country=clean(r.country)||'Unspecified',value=num(r.totalSales)*scale;countryMap[country]=(countryMap[country]||0)+value;total+=value});
  return{source,label,available:true,total,countries:Object.entries(countryMap).map(([country,value])=>({country,value})).sort((a,b)=>b.value-a.value),fileName:meta.fileName||localStorage.getItem(tms?'dadBudgetTMSFileName':'dadBudgetIMSFileName')||`${label} Sales`,fromWorkbook:true};
}

function plPayloadFromLocal(){
  try{return JSON.parse(localStorage.getItem('dadBudgetPLSummaryV1')||'null')}catch(_){return null}
}

function algeriaGrossSalesFromPayload(payload){
  const rows=Array.isArray(payload?.rows)?payload.rows:[];
  const matches=rows.filter(row=>norm(row?.country)==='ALGERIA'&&(clean(row?.categoryKey).toLowerCase()==='grosssales'||norm(row?.category)==='GROSSSALES'));
  return{available:matches.length>0,total:matches.reduce((sum,row)=>sum+num(row?.b27)*1000,0)};
}

function mergeAlgeriaIntoIms(ims,algeria){
  if(!algeria.available)return ims;
  const countryMap={};
  (ims.countries||[]).forEach(item=>{countryMap[item.country]=(countryMap[item.country]||0)+num(item.value)});
  const existingName=Object.keys(countryMap).find(name=>norm(name)==='ALGERIA');
  if(existingName){
    countryMap[existingName]=algeria.total;
  }else{
    countryMap.Algeria=algeria.total;
  }
  const countries=Object.entries(countryMap).map(([country,value])=>({country,value})).sort((a,b)=>b.value-a.value);
  const total=countries.reduce((sum,item)=>sum+num(item.value),0);
  return{...ims,available:true,total,countries,algeriaGrossSales:algeria.total,fileName:ims.fileName||'IMS Sales'};
}

function renderSales(source){
  const label=source.label||'IMS';
  if($('salesSubtitle'))$('salesSubtitle').textContent=`Total ${label} sales and country contribution.`;
  if($('salesNote')){
    if(source.available){
      const alg=label==='IMS'&&source.algeriaGrossSales?` + Algeria from P&L ${salesK(source.algeriaGrossSales)}`:'';
      $('salesNote').textContent=`Source: ${source.fileName||`${label} Sales`} · Sales by country from ${label} Sales${alg} · USD '000.`;
    }else $('salesNote').textContent=`${label} Sales data is not available on this device.`;
  }
  if($('countryGrid'))$('countryGrid').innerHTML=source.available?source.countries.map(x=>`<div class="country-card"><span>${escapeHtml(x.country)}</span><strong>${salesK(x.value)}</strong></div>`).join(''):`<div class="empty-state">${label} Sales source is not available on this device.</div>`;
}

function patchSalesOverview(){
  if(!salesSources)return;
  const ims=salesSources.ims;
  const title=$('kpiSales')?.closest('.exec-kpi')?.querySelector('span');
  if(title)title.textContent='TOTAL IMS SALES';
  if($('kpiSales'))$('kpiSales').textContent=ims.available?salesK(ims.total):'—';
  if($('kpiSalesNote'))$('kpiSalesNote').textContent=ims.available?`IMS ${salesK(ims.total)} · USD '000`:'IMS file is not available on this device';
}

function bindSalesSwitch(){
  if(!salesSources)return;
  const buttons=[...document.querySelectorAll('[data-sales-source]')];
  buttons.forEach(button=>{button.onclick=()=>{buttons.forEach(x=>{const active=x===button;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active?'true':'false')});renderSales(salesSources[button.dataset.salesSource]||salesSources.ims)}});
  const active=buttons.find(x=>x.classList.contains('active'))||buttons[0];
  renderSales(active?.dataset?.salesSource==='tms'?salesSources.tms:salesSources.ims);
}

async function refreshCapex(db){
  const [snap,tunisSnap]=await Promise.all([getDocs(collection(db,'capex_budget_submissions')),getDoc(doc(db,'tunis_budget','capex_2027')).catch(()=>null)]);
  const records=[];snap.forEach(d=>records.push({cc:d.id,...(d.data()||{})}));
  const tunis=tunisSnap?.exists?.()?tunisSnap.data()||{}:{};
  const summary=summarize(records,tunis);
  patchShared(summary);
  patchCapexDom(summary);
  patchOverviewCurrency();
  try{sessionStorage.removeItem('dadBudgetExecutiveCacheV3');sessionStorage.removeItem('dadBudgetExecutiveCacheV4');sessionStorage.removeItem('dadBudgetExecutiveCacheV5')}catch(_){}
  window.dispatchEvent(new CustomEvent('dad-executive-capex-ready',{detail:summary}));
}

async function refreshSales(db){
  let payload=null;
  try{const snap=await getDoc(doc(db,'system_status','pl_summary_v1_2027'));if(snap.exists())payload=snap.data()||null}catch(err){console.warn('Executive Algeria P&L source unavailable',err)}
  if(!payload)payload=plPayloadFromLocal();
  const imsWorkbook=readLocalSales('ims');
  const algeria=algeriaGrossSalesFromPayload(payload);
  const ims=mergeAlgeriaIntoIms(imsWorkbook,algeria);
  const tms=readLocalSales('tms');
  salesSources={ims,tms};
  patchSalesOverview();
  bindSalesSwitch();
}

async function refresh(force=false){
  if(loading)return;
  if(!force&&Date.now()-lastLoadedAt<1500)return;
  const app=getApps()[0];if(!app)return;
  loading=true;
  const db=getFirestore(app);
  try{
    patchOverviewCurrency();
    const results=await Promise.allSettled([refreshCapex(db),refreshSales(db)]);
    results.forEach(result=>{if(result.status==='rejected')console.warn('Executive live sync failed',result.reason)});
    patchOverviewCurrency();
    lastLoadedAt=Date.now();
  }finally{loading=false}
}

window.addEventListener('dad-executive-data-ready',()=>setTimeout(()=>{patchOverviewCurrency();refresh(true)},0));
window.addEventListener('focus',()=>refresh(true));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>refresh(true),250));else setTimeout(()=>refresh(true),250);
setTimeout(()=>refresh(true),1800);
