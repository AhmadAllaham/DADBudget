(function(){
'use strict';
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const money=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0};

function makeReadOnly(){
  const body=$('salaryBody');
  if(!body)return;
  body.querySelectorAll('input[data-cc][data-gl]').forEach(input=>{
    const span=document.createElement('span');
    span.className='salary-readonly-value';
    span.dataset.readonlySalary='1';
    span.textContent=money(input.value).toLocaleString(undefined,{maximumFractionDigits:2});
    input.replaceWith(span);
  });
}

function installReadOnlyMode(){
  const save=$('salarySaveBtn');
  if(save)save.remove();
  const pageText=document.querySelector('.page-head p');
  if(pageText)pageText.textContent='HR completes the Salaries Budget through the Excel template only. Uploaded values are reflected automatically into each department OPEX.';
  const matrixText=document.querySelector('.matrix-card .tools p');
  if(matrixText)matrixText.textContent='Read-only view of the latest uploaded Salaries Budget. Download the Excel template, complete it, then upload it here.';
  const note=document.querySelector('.matrix-card .note');
  if(note)note.innerHTML='<b>Excel-only workflow:</b> Salaries cannot be entered directly on this page. Download the template, complete the department values in Excel, then upload it. <b>6010020 Training</b> remains controlled by L&amp;D.';
  if(!document.getElementById('salaryExcelOnlyStyle')){
    const style=document.createElement('style');
    style.id='salaryExcelOnlyStyle';
    style.textContent='.salary-readonly-value{display:block;min-width:118px;padding:8px 9px;text-align:right;font-weight:1000;color:#123e63;background:#f5f8fa;border-radius:6px}.salary-matrix td{vertical-align:middle}.excel-only-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#eaf8f5;color:#087a64;font-size:9px;font-weight:1000;margin-left:8px}';
    document.head.appendChild(style);
  }
  const title=document.querySelector('.page-head h1');
  if(title&&!title.querySelector('.excel-only-badge')){
    const badge=document.createElement('span');badge.className='excel-only-badge';badge.textContent='EXCEL INPUT ONLY';title.appendChild(badge);
  }
  const body=$('salaryBody');
  if(body){
    new MutationObserver(()=>requestAnimationFrame(makeReadOnly)).observe(body,{childList:true,subtree:true});
    makeReadOnly();
  }
}

function tableData(){
  const headers=[...document.querySelectorAll('#salaryHead th')].map(th=>clean(th.textContent).replace(/\s+/g,' '));
  const rows=[...document.querySelectorAll('#salaryBody tr.salary-row')].map(tr=>[...tr.cells].map((td,i)=>{
    if(i<2)return clean(td.textContent);
    const input=td.querySelector('input');
    if(input)return money(input.value);
    const span=td.querySelector('[data-readonly-salary]');
    if(span)return money(span.textContent);
    return money(td.textContent);
  }));
  if(headers.length<4||!rows.length)throw new Error('Salaries matrix is still loading. Please try again in a few seconds.');
  return{headers,rows};
}

async function downloadExcel(editable){
  if(typeof ExcelJS==='undefined')throw new Error('Excel engine is still loading.');
  const {headers,rows}=tableData(),wb=new ExcelJS.Workbook();
  wb.creator='DAD Budget 2027';wb.created=new Date();wb.calcProperties.fullCalcOnLoad=true;wb.calcProperties.forceFullCalc=true;wb.calcProperties.calcMode='auto';
  const info=wb.addWorksheet('Instructions'),ws=wb.addWorksheet('Salaries Budget');
  const navy='FF0A2C61',white='FFFFFFFF',blue='FFE5F3FF',green='FFEAF9F5',gray='FFF4F7F8',border='FFDCE8E6';
  info.addRow(['DAD BUDGET 2027 · HR SALARIES']);info.addRow([]);info.addRow(['HOW TO USE']);
  info.addRow(['1','This is the only input method for HR Salaries Budget. Direct page entry is disabled.']);
  info.addRow(['2','Enter FY Budget 2027 annual values in the blue department cells.']);
  info.addRow(['3','Company Total for every salary item is calculated automatically.']);
  info.addRow(['4','The TOTAL row calculates the total salary budget for every department and the company grand total.']);
  info.addRow(['5','Do not change Fund Center headers, Account No., or the Salaries Budget sheet name.']);
  info.addRow(['6','Upload the completed workbook from HR Planning > Salaries Budget.']);
  info.getColumn(1).width=14;info.getColumn(2).width=108;info.getRow(1).font={bold:true,size:16,color:{argb:navy}};

  ws.addRow(headers);
  const deptStart=3,companyCol=headers.length,deptEnd=companyCol-1;
  rows.forEach((source,index)=>{
    const excelRow=index+2;
    const row=ws.addRow(source.slice(0,companyCol));
    for(let c=deptStart;c<=deptEnd;c++){
      const cell=row.getCell(c);cell.numFmt='#,##0.00';
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:editable?blue:green}};
      if(editable)cell.dataValidation={type:'decimal',operator:'greaterThanOrEqual',allowBlank:true,formulae:[0],showErrorMessage:true,errorTitle:'Invalid value',error:'Enter a value equal to or greater than zero.'};
    }
    const first=ws.getColumn(deptStart).letter,last=ws.getColumn(deptEnd).letter,totalCell=row.getCell(companyCol);
    totalCell.value={formula:`SUM(${first}${excelRow}:${last}${excelRow})`};totalCell.numFmt='#,##0.00';totalCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:green}};totalCell.font={bold:true};
  });

  const totalRowNumber=rows.length+2,total=ws.addRow(['TOTAL','FY Budget 2027',...Array(Math.max(0,deptEnd-deptStart+1)).fill(''),'']);
  for(let c=deptStart;c<=deptEnd;c++){
    const letter=ws.getColumn(c).letter;total.getCell(c).value={formula:`SUM(${letter}2:${letter}${totalRowNumber-1})`};total.getCell(c).numFmt='#,##0.00';
  }
  const companyLetter=ws.getColumn(companyCol).letter;total.getCell(companyCol).value={formula:`SUM(${companyLetter}2:${companyLetter}${totalRowNumber-1})`};total.getCell(companyCol).numFmt='#,##0.00';
  total.font={bold:true,color:{argb:white}};total.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};

  ws.getRow(1).height=50;ws.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true}});
  ws.views=[{state:'frozen',ySplit:1,xSplit:2}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:companyCol}};
  ws.getColumn(1).width=15;ws.getColumn(2).width=38;for(let c=deptStart;c<=deptEnd;c++)ws.getColumn(c).width=23;ws.getColumn(companyCol).width=20;
  for(let r=2;r<totalRowNumber;r++)ws.getRow(r).eachCell(cell=>cell.border={bottom:{style:'thin',color:{argb:border}},right:{style:'thin',color:{argb:border}}});
  if(!editable){for(let r=2;r<totalRowNumber;r++){ws.getRow(r).getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:gray}};ws.getRow(r).getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:gray}}}}

  const buffer=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');
  a.href=url;a.download=editable?'Budget_2027_HR_Salaries_Template.xlsx':'Budget_2027_HR_Salaries_Saved_Data.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function interceptDownloads(){
  const bind=(id,editable)=>{
    const button=$(id);if(!button||button.dataset.excelOnlyBound==='1')return;button.dataset.excelOnlyBound='1';
    button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const old=button.textContent;button.disabled=true;button.textContent='Preparing...';downloadExcel(editable).catch(e=>alert(e.message||e)).finally(()=>{button.disabled=false;button.textContent=old})},true);
  };
  bind('salaryTemplateBtn',true);bind('salarySavedBtn',false);
}

function install(){installReadOnlyMode();interceptDownloads()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.addEventListener('dad-user-ready',()=>setTimeout(()=>{installReadOnlyMode();interceptDownloads();makeReadOnly()},250));
setTimeout(()=>{installReadOnlyMode();interceptDownloads();makeReadOnly()},700);
})();
