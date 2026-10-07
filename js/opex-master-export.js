(function(){
'use strict';
if(!/opex\.html$/i.test((location.pathname||'').split('?')[0]))return;

const KEY='dadBudgetOPEXBaselineV17';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CATEGORIES=[['Employees Benefits','601'],['Travel Costs','602'],['Depreciation and Amortization','603'],['Maintenance cost','604'],['A&P, Marketing Activities','605'],['IT and Connectivity Expenses','606'],['Professional & Consultation Expenses','607'],['Utilities Expenses','608'],['Insurance Expenses','609'],['Logistic Expenses','610'],['Governmental and Taxes Expenses','611'],['Vehicles Expenses','612'],['Products related Expense','613'],['Other Expenses','614']];
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const clean=value=>String(value??'').trim();
const monthKey=(year,month)=>`${year}-${String(month).padStart(2,'0')}`;

function model(){
  try{const current=JSON.parse(localStorage.getItem(KEY)||'null');if(current?.departments)return current}catch(_){ }
  const keys=Object.keys(localStorage).filter(key=>/^dadBudgetOPEXBaselineV\d+$/i.test(key)).sort((a,b)=>Number((b.match(/\d+$/)||[0])[0])-Number((a.match(/\d+$/)||[0])[0]));
  for(const key of keys){try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value?.departments)return value}catch(_){ }}
  return null;
}
function category(code){
  const value=clean(code);
  if(value==='6050015'||value==='6050016')return'Other Expenses';
  if(value==='6140019')return'Products related Expense';
  return (CATEGORIES.find(([,prefix])=>value.startsWith(prefix))||['Other Expenses'])[0];
}
function sumMap(map){return Object.values(map||{}).reduce((sum,value)=>sum+num(value),0)}
function sumYear(map,year){const prefix=`${year}-`;return Object.entries(map||{}).reduce((sum,[period,value])=>String(period).startsWith(prefix)?sum+num(value):sum,0)}
function lastActualPeriod(department){
  let latest='';
  Object.values(department?.items||{}).forEach(item=>Object.entries(item?.actualByMonth||{}).forEach(([period,value])=>{
    if(/^2026-(0[1-9]|1[0-2])$/.test(period)&&Math.abs(num(value))>.00001&&period>latest)latest=period;
  }));
  return latest;
}
function sumThrough(map,year,cutoffMonth){
  let total=0;
  for(let month=1;month<=cutoffMonth;month++)total+=num(map?.[monthKey(year,month)]);
  return total;
}
function actualYtd(item){return sumYear(item?.actualByMonth,2026)+num(item?.actualUnperiodized)}
function lyYtd(item,cutoffMonth){
  const monthly=sumThrough(item?.lyByMonth,2025,cutoffMonth);
  const hasMonthly=Object.keys(item?.lyByMonth||{}).some(period=>String(period).startsWith('2025-'));
  return monthly+(hasMonthly?0:num(item?.lyUnperiodized));
}
function budgetYtd(item,cutoffMonth){return sumThrough(item?.budgetByMonth,2026,cutoffMonth)}
function fyBudget2027(item){return sumYear(item?.newBudgetByMonth,2027)}
function pct(value,base){return Math.abs(num(base))<.000001?null:num(value)/Math.abs(num(base))}
function rowsFromModel(data){
  const rows=[];
  Object.values(data?.departments||{}).filter(department=>clean(department?.cc)&&clean(department?.cc)!=='16').sort((a,b)=>clean(a.name||a.cc).localeCompare(clean(b.name||b.cc))||clean(a.cc).localeCompare(clean(b.cc),undefined,{numeric:true})).forEach(department=>{
    const cc=clean(department.cc),name=clean(department.name||cc),cutoff=lastActualPeriod(department),cutoffMonth=cutoff?Number(cutoff.slice(5,7)):12;
    Object.values(department?.items||{}).sort((a,b)=>clean(a?.code).localeCompare(clean(b?.code),undefined,{numeric:true})).forEach(item=>{
      const gl=clean(item?.code);if(!gl)return;
      const actual=actualYtd(item),budgetYtdValue=budgetYtd(item,cutoffMonth),ly=lyYtd(item,cutoffMonth),landing=num(item?.landing),fy26=num(item?.fyBudget),b27=fyBudget2027(item),variance=actual-budgetYtdValue,remaining=fy26-actual;
      const base=[`${cc}|${gl}`,cc,name,gl,clean(item?.name||gl),category(gl),cutoff||'',ly,budgetYtdValue,actual,variance,pct(variance,budgetYtdValue),landing,actual+landing,fy26,remaining,pct(remaining,fy26),b27,clean(item?.professionalDetails||'')];
      const b27Months=MONTHS.map((_,index)=>num(item?.newBudgetByMonth?.[monthKey(2027,index+1)]));
      const actualMonths=MONTHS.map((_,index)=>num(item?.actualByMonth?.[monthKey(2026,index+1)]));
      const budgetMonths=MONTHS.map((_,index)=>num(item?.budgetByMonth?.[monthKey(2026,index+1)]));
      rows.push([...base,...b27Months,...actualMonths,...budgetMonths]);
    });
  });
  return rows;
}
function headers(){
  return [
    'Key','Fund Center','Department','G/L Account','Account Name','Category','Actual Through','LY YTD','Budget YTD 2026','Actual YTD 2026','Vs Budget','Vs Budget %','Landing','FY Landing','FY Budget 2026','Remaining FY 2026','Remaining %','FY Budget 2027','Professional Details',
    ...MONTHS.map(month=>`Budget 2027 ${month}`),
    ...MONTHS.map(month=>`Actual 2026 ${month}`),
    ...MONTHS.map(month=>`Budget 2026 ${month}`)
  ];
}
async function download(){
  const data=model();
  if(!data?.departments){alert('OPEX data is not loaded yet. Refresh the OPEX page and try again.');return}
  if(typeof ExcelJS==='undefined'){alert('Excel export engine is still loading. Please try again in a few seconds.');return}
  const button=document.getElementById('opexMasterExportBtn'),old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Preparing Master...'}
  try{
    const exportRows=rowsFromModel(data);if(!exportRows.length)throw new Error('No OPEX rows were found.');
    const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();
    const ws=wb.addWorksheet('Master OPEX',{views:[{state:'frozen',ySplit:1,xSplit:3}]});
    const head=headers();ws.addRow(head);exportRows.forEach(row=>ws.addRow(row));
    ws.autoFilter={from:{row:1,column:1},to:{row:ws.rowCount,column:head.length}};
    const table=ws.addTable({name:'MasterOPEXTable',ref:'A1',headerRow:true,totalsRow:false,style:{theme:'TableStyleMedium2',showRowStripes:true},columns:head.map(name=>({name})),rows:exportRows});
    void table;
    ws.getRow(1).height=28;ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};ws.getRow(1).alignment={vertical:'middle',horizontal:'center'};
    const pctHeaders=new Set(['Vs Budget %','Remaining %']);
    head.forEach((title,index)=>{
      const column=ws.getColumn(index+1);
      if(index===0)column.width=28;
      else if(['Department','Account Name','Professional Details'].includes(title))column.width=34;
      else if(['Fund Center','G/L Account'].includes(title))column.width=16;
      else if(title==='Category')column.width=30;
      else if(title==='Actual Through')column.width=15;
      else column.width=17;
      if(pctHeaders.has(title))column.numFmt='0.0%;[Red]-0.0%';
      else if(index>=7)column.numFmt='#,##0.00;[Red]-#,##0.00';
    });
    ws.eachRow((row,rowNumber)=>{if(rowNumber===1)return;row.alignment={vertical:'middle'};row.getCell(1).alignment={vertical:'middle',horizontal:'left'};row.getCell(2).alignment={vertical:'middle',horizontal:'left'};row.getCell(3).alignment={vertical:'middle',horizontal:'left'};row.getCell(4).alignment={vertical:'middle',horizontal:'left'};row.getCell(5).alignment={vertical:'middle',horizontal:'left'};row.getCell(6).alignment={vertical:'middle',horizontal:'left'};row.getCell(7).alignment={vertical:'middle',horizontal:'center'};});
    const info=wb.addWorksheet('Read Me');
    [
      ['OPEX MASTER EXPORT'],
      ['Purpose','Flat master data for linking to external Excel files, Power Query, PivotTables and Power BI.'],
      ['Unique Key','Fund Center | G/L Account'],
      ['FY Landing','Actual YTD 2026 + Landing saved by the department'],
      ['FY Budget 2027','Sum of Jan-Dec 2027 department budget values'],
      ['Rows',exportRows.length],
      ['Departments',Object.values(data.departments||{}).filter(d=>clean(d?.cc)&&clean(d?.cc)!=='16').length],
      ['Source',clean(data.fileName||'OPEX Cloud Data')],
      ['Generated',new Date().toLocaleString()]
    ].forEach(row=>info.addRow(row));
    info.getColumn(1).width=22;info.getColumn(2).width=95;info.getRow(1).font={bold:true,size:16,color:{argb:'FF0A2C61'}};
    const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='OPEX_Master_All_Departments_2027.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }catch(error){console.error('Master OPEX export failed',error);alert('Master OPEX download failed: '+(error?.message||error))}
  finally{if(button){button.disabled=false;button.textContent=old||'Download Master OPEX'}}
}
function install(){
  if(document.getElementById('opexMasterExportBtn'))return;
  const toolbar=document.querySelector('.sheet-toolbar .toolbar-actions');if(!toolbar)return;
  const anchor=document.getElementById('expensesExportBtn'),button=document.createElement('button');button.type='button';button.id='opexMasterExportBtn';button.className='ghost-btn';button.textContent='Download Master OPEX';button.title='Download one flat master sheet with all OPEX departments and G/L accounts';button.addEventListener('click',download);
  if(anchor)anchor.insertAdjacentElement('afterend',button);else toolbar.appendChild(button);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.addEventListener('dad-opex-cloud-ready',install);
})();
