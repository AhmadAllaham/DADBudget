(function(){
'use strict';
const YEAR=2027,$=id=>document.getElementById(id),clean=v=>String(v??'').trim(),num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:0};
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
  sheet.addRow(['Department','Project Name','Unit Value (JOD)']);
  rows.forEach(row=>sheet.addRow([clean(row.department),clean(row.projectName),num(row.unitValue)]));
  const savedTotal=Number.isFinite(Number(data.total))?Number(data.total):rows.reduce((sum,row)=>sum+num(row.unitValue),0);
  sheet.addRow(['Total','',savedTotal]);
  sheet.columns=[{width:36},{width:58},{width:22}];
  for(let column=1;column<=3;column++){const cell=sheet.getRow(1).getCell(column);cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};cell.alignment={vertical:'middle',horizontal:'center'}}
  sheet.getColumn(3).numFmt='#,##0;[Red]-#,##0';sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:3}};
  const last=sheet.getRow(sheet.rowCount);for(let column=1;column<=3;column++){const cell=last.getCell(column);cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082765'}}}
  const info=workbook.addWorksheet('Info');info.addRow(['DAD BUDGET 2027 - LICENSING SAVED DATA']);info.addRow(['Fiscal Year',data.fiscalYear||YEAR]);info.addRow(['Currency',data.currency||'JOD']);info.addRow(['Projects',rows.length]);info.addRow(['Saved Total',savedTotal]);info.getColumn(1).width=24;info.getColumn(2).width=40;info.getRow(1).font={bold:true,size:15,color:{argb:'FF0A2C61'}};
  const buffer=await workbook.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Licensing_Budget_2027_Saved_Data_JOD.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){alert('Saved Licensing data download failed: '+(error?.message||error))}finally{button.disabled=false;button.textContent=old}
}
function install(){const button=$('downloadLicensingSaved');if(button)button.onclick=exportSavedLicensing}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();