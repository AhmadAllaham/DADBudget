(function(){
'use strict';
const YEAR=2027,MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],$=id=>document.getElementById(id),clean=v=>String(v??'').trim(),num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:0};
function normalizeMonths(raw={}){const out={};MONTHS.forEach((m,i)=>{const key=`${YEAR}-${String(i+1).padStart(2,'0')}`,v=raw?.[key]??raw?.[m]??raw?.[`${m} ${YEAR}`];if(v!==undefined&&v!==null&&clean(v)!=='')out[key]=num(v)});return out}
function monthValues(row={}){const months=normalizeMonths(row.months2027||row.monthly2027||{}),values=MONTHS.map((m,i)=>num(months[`${YEAR}-${String(i+1).padStart(2,'0')}`]));if(values.some(v=>Math.abs(v)>.00001))return values;if(Math.abs(num(row.unitValue))>.00001)values[0]=num(row.unitValue);return values}
async function exportSavedLicensing(){
 const button=$('downloadLicensingSaved');if(!button)return;const old=button.textContent;
 try{
  if(typeof ExcelJS==='undefined')throw new Error('Excel engine is still loading.');
  const api=window.DADFirebase;if(!api?.db||!api.auth?.currentUser)throw new Error('Secure cloud connection is not ready.');
  button.disabled=true;button.textContent='Preparing saved data...';
  const fs=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js'),snapshot=await fs.getDoc(fs.doc(api.db,'system_status','licensing_budget_fy2027'));
  if(!snapshot.exists())throw new Error('No saved Licensing Budget data was found yet.');
  const data=snapshot.data()||{},rows=Array.isArray(data.rows)?data.rows:[];
  if(!rows.length)throw new Error('The saved Licensing Budget has no project rows.');
  const workbook=new ExcelJS.Workbook();workbook.creator='DAD Budget 2027';workbook.created=new Date();
  const sheet=workbook.addWorksheet('Licensing Budget');
  sheet.addRow(['Department','Project Name',...MONTHS.map(m=>`${m} ${YEAR}`),`FY ${YEAR} Total (JOD)`,'FY 2028 Total (JOD)']);
  rows.forEach(row=>{const monthly=monthValues(row),r=sheet.addRow([clean(row.department),clean(row.projectName),...monthly,'',num(row.fy2028Total)]),rn=r.number;r.getCell(15).value={formula:`SUM(C${rn}:N${rn})`}});
  const totalRow=sheet.addRow(['TOTAL','',...Array(12).fill(''),'','']),rn=totalRow.number;for(let c=3;c<=16;c++){const letter=sheet.getColumn(c).letter;totalRow.getCell(c).value={formula:`SUM(${letter}2:${letter}${rn-1})`}}
  sheet.columns=[{width:36},{width:58},...MONTHS.map(()=>({width:14})),{width:20},{width:20}];
  for(let column=1;column<=16;column++){const cell=sheet.getRow(1).getCell(column);cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true}}sheet.getRow(1).height=32;
  for(let c=3;c<=16;c++)sheet.getColumn(c).numFmt='#,##0.00;[Red]-#,##0.00';sheet.views=[{state:'frozen',ySplit:1,xSplit:2}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:16}};
  for(let column=1;column<=16;column++){const cell=totalRow.getCell(column);cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082765'}}}
  const savedTotal=Number.isFinite(Number(data.total))?Number(data.total):rows.reduce((sum,row)=>sum+num(row.unitValue),0),savedTotal2028=Number.isFinite(Number(data.total2028))?Number(data.total2028):rows.reduce((sum,row)=>sum+num(row.fy2028Total),0);
  const info=workbook.addWorksheet('Info');info.addRow(['DAD BUDGET 2027 - LICENSING SAVED DATA']);info.addRow(['Fiscal Year',data.fiscalYear||YEAR]);info.addRow(['Currency',data.currency||'JOD']);info.addRow(['Projects',rows.length]);info.addRow([`FY ${YEAR} Total`,savedTotal]);info.addRow(['FY 2028 Total',savedTotal2028]);info.getColumn(1).width=24;info.getColumn(2).width=40;info.getRow(1).font={bold:true,size:15,color:{argb:'FF0A2C61'}};
  const buffer=await workbook.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Licensing_Budget_2027_2028_Saved_Data_JOD.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){alert('Saved Licensing data download failed: '+(error?.message||error))}finally{button.disabled=false;button.textContent=old}
}
function install(){const button=$('downloadLicensingSaved');if(button)button.onclick=exportSavedLicensing}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();