import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const num=v=>{const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)?n:0};
const money=v=>Number(v||0);
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SHEETS={
  licences:'Licences Exp',
  subscriptions:'Subscriptions & Magazines',
  consultation:'General Consultation',
  internet:'Internet'
};

function setStatus(text,error=false){const el=$('status');if(!el)return;el.textContent=text;el.className='status '+(error?'error':'ready')}
function styleHeader(row){row.height=28;row.font={bold:true,color:{argb:'FFFFFFFF'}};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};row.alignment={vertical:'middle',wrapText:true}}
function styleSheet(ws,widths=[]){styleHeader(ws.getRow(1));widths.forEach((w,i)=>ws.getColumn(i+1).width=w);ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:Math.max(1,ws.columnCount)}};ws.eachRow((row,n)=>{row.eachCell(cell=>{cell.border={bottom:{style:'thin',color:{argb:'FFDCE8E6'}},right:{style:'thin',color:{argb:'FFDCE8E6'}}};if(n>1)cell.alignment={vertical:'middle',wrapText:true}})})}
function addTotalRow(ws,labelCol,numericCols){const row=ws.addRow([]);row.getCell(labelCol).value='TOTAL';row.font={bold:true,color:{argb:'FFFFFFFF'}};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF08756D'}};numericCols.forEach(c=>{let total=0;for(let r=2;r<row.number;r++)total+=num(ws.getRow(r).getCell(c).value);row.getCell(c).value=total;row.getCell(c).numFmt='#,##0.00'});return row}
function allocationKeys(rows){const out=[],seen=new Set();rows.forEach(r=>Object.keys(r?.allocations||{}).forEach(k=>{const key=clean(k);if(key&&!seen.has(key)){seen.add(key);out.push(key)}}));return out}
function addOperatingSheet(wb,key,rows){const title=SHEETS[key],ws=wb.addWorksheet(title.slice(0,31)),allocs=allocationKeys(rows);const heads=['Description','QTY','Agreement Type','Unit Value (JOD)','Total Value (JOD)','New / Renew',...allocs,'Allocated Total'];ws.addRow(heads);rows.forEach(r=>ws.addRow([clean(r.description),num(r.quantity),clean(r.agreementType),money(r.unitValueJd),money(r.total),clean(r.newRenew),...allocs.map(a=>money(r.allocations?.[a])),money(r.allocatedTotal)]));const numeric=[2,4,5,...allocs.map((_,i)=>7+i),7+allocs.length];addTotalRow(ws,1,numeric);styleSheet(ws,[42,10,18,16,18,14,...allocs.map(()=>18),18]);[4,5,...allocs.map((_,i)=>7+i),7+allocs.length].forEach(c=>ws.getColumn(c).numFmt='#,##0.00')}
function addProjectSheet(wb,rows){if(!rows.length)return;const ws=wb.addWorksheet('IT Project');ws.addRow(['Description','QTY','Agreement Type','Unit Value JD','Unit Value USD',...MONTHS,'Total','Mapped Category']);rows.forEach(r=>ws.addRow([clean(r.description),num(r.quantity),clean(r.agreementType),money(r.unitValueJd),money(r.unitValueUsd),...(Array.isArray(r.months)?r.months:[]).map(money),money(r.total),clean(r.category)]));const numeric=[2,4,5,...MONTHS.map((_,i)=>6+i),18];addTotalRow(ws,1,numeric);styleSheet(ws,[42,10,18,16,16,...MONTHS.map(()=>12),18,24]);[4,5,...MONTHS.map((_,i)=>6+i),18].forEach(c=>ws.getColumn(c).numFmt='#,##0.00')}
function addRequestsSheet(wb,requests){const rows=requests.flatMap(d=>(Array.isArray(d.rows)?d.rows:[]).map(r=>({...r,sourceRevision:r.sourceRevision||d.sourceRevision||d.revision||0,department:r.department||d.departmentName||d.name||'',cc:r.cc||d.cc||d.fundCenter||''}))),ws=wb.addWorksheet('Department Requests');ws.addRow(['Description','Department','Fund Center','Category','Quantity','FY 2027','Source Revision','Justification']);rows.forEach(r=>ws.addRow([clean(r.description),clean(r.department),clean(r.cc),clean(r.category),num(r.quantity),money(r.total),`R${Number(r.sourceRevision||0)}`,clean(r.justification)]));addTotalRow(ws,1,[5,6]);styleSheet(ws,[42,30,18,24,12,18,14,42]);ws.getColumn(6).numFmt='#,##0.00';return rows}
function addSummary(wb,plan,requestRows){const ws=wb.addWorksheet('Summary'),operatingKeys=Object.keys(SHEETS),operatingTotal=operatingKeys.flatMap(k=>Array.isArray(plan?.sheets?.[k])?plan.sheets[k]:[]).reduce((s,r)=>s+money(r.total||r.allocatedTotal),0),requestTotal=requestRows.reduce((s,r)=>s+money(r.total),0),activeLines=operatingKeys.flatMap(k=>Array.isArray(plan?.sheets?.[k])?plan.sheets[k]:[]).filter(r=>Math.abs(money(r.total||r.allocatedTotal))>.005).length;ws.addRow(['IT Planning Report','Value']);ws.addRow(['Fiscal Year',2027]);ws.addRow(['Workbook Revision',plan?.revision?`R${plan.revision}`:'—']);ws.addRow(['Source File',clean(plan?.sourceFile)||'—']);ws.addRow(['Department IT Requests Total',requestTotal]);ws.addRow(['IT Operating Budget',operatingTotal]);ws.addRow(['Active Operating Lines',activeLines]);ws.addRow(['Generated At',new Date().toLocaleString()]);styleSheet(ws,[34,28]);ws.getColumn(2).numFmt='#,##0.00';ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'},size:13};}

async function downloadReport(){
  if(typeof ExcelJS==='undefined')throw new Error('Excel report engine is still loading.');
  if(!auth.currentUser)throw new Error('Sign in first.');
  const btn=$('downloadReport');if(btn){btn.disabled=true;btn.textContent='Building Report...'}
  try{
    setStatus('Building IT Planning report...');
    const [reqSnap,planSnap]=await Promise.all([getDocs(collection(db,'capex_it_requests')),getDoc(doc(db,'it_budget_plans','fy2027'))]);
    const requests=reqSnap.docs.map(x=>({id:x.id,...x.data()})),plan=planSnap.exists()?planSnap.data()||{sheets:{}}:{sheets:{}};
    const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.title='IT Planning Report 2027';wb.subject='IT Planning consolidated report';wb.created=new Date();
    const requestRows=addRequestsSheet(wb,requests);
    Object.entries(SHEETS).forEach(([key])=>addOperatingSheet(wb,key,Array.isArray(plan?.sheets?.[key])?plan.sheets[key]:[]));
    addProjectSheet(wb,Array.isArray(plan?.sheets?.project)?plan.sheets.project:[]);
    addSummary(wb,plan,requestRows);
    wb.worksheets.forEach(ws=>{ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};ws.properties.defaultRowHeight=18});
    const buf=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=`IT_Planning_Report_2027_${new Date().toISOString().slice(0,10)}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus('IT Planning report downloaded.');
  }finally{if(btn){btn.disabled=false;btn.textContent='Download Report'}}
}

function bind(){const btn=$('downloadReport');if(!btn||btn.dataset.bound==='1')return;btn.dataset.bound='1';btn.addEventListener('click',()=>downloadReport().catch(e=>{setStatus(e.message,true);alert('IT report download failed: '+e.message)}))}
bind();window.addEventListener('dad-user-ready',bind);window.addEventListener('load',bind);
