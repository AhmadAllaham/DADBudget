const KEY='dadBudgetOPEXBaselineV17';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COUNTRIES=['Jordan','Saudi Arabia','United Arab Emirates','Qatar','Bahrain','Kuwait','Oman','Iraq','Algeria','Egypt','Lebanon','Palestine','Yemen','Morocco','Tunisia','Libya','Sudan','Syria','Turkey','United States','United Kingdom','France','Germany','Italy','Spain','Switzerland','Netherlands','Belgium','Austria','Greece','Cyprus','India','Pakistan','Bangladesh','Sri Lanka','China','Japan','South Korea','Singapore','Malaysia','Indonesia','Philippines','Thailand','Australia','New Zealand','Canada','Brazil','South Africa','Kenya','Nigeria','Ghana','Ethiopia'];
const n=v=>{const x=Number(v||0);return Number.isFinite(x)?x:0};
function loadModel(){try{const m=JSON.parse(localStorage.getItem(KEY)||'null');if(m?.departments)return m}catch(_){}const keys=Object.keys(localStorage).filter(k=>/^dadBudgetOPEXBaselineV\d+$/i.test(k)).sort((a,b)=>Number((b.match(/\d+$/)||[0])[0])-Number((a.match(/\d+$/)||[0])[0]));for(const k of keys){try{const m=JSON.parse(localStorage.getItem(k)||'null');if(m?.departments)return m}catch(_){}}return null}
function controlled(code){const x=Number(String(code||'').trim());return (x>=6010001&&x<=6010031)||(x>=6020001&&x<=6020010)||(x>=6030010&&x<=6030180&&x%10===0)}
function category(code){const c=String(code||''),p=c.slice(0,3),m={'601':'Employees Benefits','602':'Travel Costs','603':'Depreciation and Amortization','604':'Maintenance cost','605':'A&P, Marketing Activities','606':'IT and Connectivity Expenses','607':'Professional & Consultation Expenses','608':'Utilities Expenses','609':'Insurance Expenses','610':'Logistic Expenses','611':'Governmental and Taxes Expenses','612':'Vehicles Expenses','613':'Products related Expense','614':'Other Expenses'};if(c==='6050015'||c==='6050016')return'Other Expenses';if(c==='6140019')return'Products related Expense';return m[p]||'Other Expenses'}
function actualYTD(x){return Object.values(x?.actualByMonth||{}).reduce((s,v)=>s+n(v),0)+n(x?.actualUnperiodized)}
function selectedRange(){const from=document.getElementById('dateFrom')?.value||document.getElementById('from')?.value||localStorage.getItem('dadBudgetOPEXDateFrom')||'2026-01',to=document.getElementById('dateTo')?.value||document.getElementById('to')?.value||localStorage.getItem('dadBudgetOPEXDateTo')||'2026-07';return{from,to}}
function sumRange(map,from,to){return Object.entries(map||{}).reduce((s,[key,value])=>key>=from&&key<=to?s+n(value):s,0)}
function referenceValues(item){const range=selectedRange(),hasActual=Object.keys(item?.actualByMonth||{}).length>0,budget=sumRange(item?.budgetByMonth,range.from,range.to),actual=hasActual?sumRange(item?.actualByMonth,range.from,range.to):n(item?.actualUnperiodized),fy=n(item?.fyBudget);return{budget,actual,variance:budget-actual,fy,remaining:fy-actual}}
function allAccounts(m,d){
  const merged=new Map();
  Object.values(m.accountMaster||{}).forEach(a=>{const code=String(a?.code||'').trim();if(code)merged.set(code,{code,name:String(a?.name||code).trim()||code})});
  Object.values(d.items||{}).forEach(a=>{const code=String(a?.code||'').trim();if(!code)return;const prev=merged.get(code)||{};merged.set(code,{code,name:String(a?.name||prev.name||code).trim()||code})});
  return [...merged.values()]
    .filter(a=>/^6(01|02|03|04|05|06|07|08|09|10|11|12|13|14)/.test(String(a.code))&&!controlled(a.code))
    .sort((a,b)=>String(a.code).localeCompare(String(b.code)));
}
async function downloadAllRows(){
  const m=loadModel(),cc=document.getElementById('deptFilter')?.value,d=m?.departments?.[cc];
  if(!m||!d){alert('Upload the Finance OPEX baseline first, then select a department.');return}
  if(typeof ExcelJS==='undefined'){alert('Excel template engine is still loading. Please try again in a few seconds.');return}
  const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();wb.calcProperties.fullCalcOnLoad=true;wb.calcProperties.forceFullCalc=true;
  const info=wb.addWorksheet('Instructions');[
    ['DAD BUDGET 2027 - DEPARTMENT TEMPLATE'],['Department',d.name],['Fund Center',d.cc],[],['HOW TO USE'],
    ['1','Enter Budget 2027 only in the green Jan-Dec monthly cells. FY Budget 2027 totals calculate automatically.'],
    ['2','The OPEX sheet follows the same order as the online table: Budget YTD, Actual, variance, FY Budget 2026, Remaining, then FY Budget 2027 months.'],
    ['3','All available OPEX accounts are included even when Actual YTD 2026 and FY Budget 2026 are zero.'],
    ['4','Employee Benefits G/L 6010001-6010031 are controlled by the separate HR Budget model.'],
    ['5','Travel G/L 6020001-6020010 are controlled by the Travel Budget sheet.'],
    ['6','Depreciation and Amortization G/L 6030010-6030180 are controlled by a separate model.'],
    ['7','Travel Budget dropdowns are provided for Department, Country and Month.'],
    ['8','Upload this same workbook once after completion.']
  ].forEach(r=>info.addRow(r));info.getColumn(1).width=18;info.getColumn(2).width=90;

  const op=wb.addWorksheet('OPEX Budget 2027'),range=selectedRange();
  op.addRow(['FY BUDGET 2027 · MONTHLY DISTRIBUTION']);op.mergeCells('A1:X1');
  op.getCell('A1').font={bold:true,size:16,color:{argb:'FFFFFFFF'}};op.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082765'}};op.getCell('A1').alignment={vertical:'middle',horizontal:'left'};op.getRow(1).height=30;
  op.addRow(['Fund Center','G/L Account','Account Name','Category','Group / Expense','Budget YTD','Actual','Budget YTD Vs Actual','FY Budget 2026','Remaining',...MONTHS,'FY Budget 2027','Source / Note']);
  const header=op.getRow(2);header.height=30;header.eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={bottom:{style:'thin',color:{argb:'FF4CCFC4'}},right:{style:'thin',color:{argb:'FF315782'}}}});
  for(let c=11;c<=22;c++){const cell=header.getCell(c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF087F77'}};cell.note=`${MONTHS[c-11]} 2027 · Department input`}
  header.getCell(23).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B665F'}};
  const accounts=allAccounts(m,d),groups=new Map();accounts.forEach(a=>{const key=category(a.code);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a)});
  const categoryOrder=['Employees Benefits','Travel Costs','Depreciation and Amortization','Maintenance cost','A&P, Marketing Activities','IT and Connectivity Expenses','Professional & Consultation Expenses','Utilities Expenses','Insurance Expenses','Logistic Expenses','Governmental and Taxes Expenses','Vehicles Expenses','Products related Expense','Other Expenses'];
  const detailRows=[],groupRows=[];
  categoryOrder.filter(name=>groups.has(name)).forEach(groupName=>{
    const items=groups.get(groupName),groupRow=op.addRow([null,null,null,groupName,groupName,null,null,null,null,null,...Array(12).fill(null),null,null]),groupNumber=groupRow.number,start=groupNumber+1;groupRows.push(groupNumber);
    groupRow.height=24;groupRow.eachCell({includeEmpty:true},cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFED0'}};cell.font={bold:true,color:{argb:'FF22363B'}};cell.border={bottom:{style:'thin',color:{argb:'FFE4EEEE'}}}});groupRow.getCell(5).font={bold:true,size:12,color:{argb:'FF18353B'}};
    items.forEach(a=>{const item=d.items?.[a.code],ref=referenceValues(item),row=op.addRow([d.cc,a.code,a.name,groupName,`${a.name}  ${a.code}`,ref.budget,ref.actual,ref.variance,ref.fy,ref.remaining,...Array(12).fill(null),null,'Department Input']);row.getCell(23).value={formula:`SUM(K${row.number}:V${row.number})`};row.height=22;detailRows.push(row.number);for(let c=1;c<=24;c++){const cell=row.getCell(c);cell.border={bottom:{style:'hair',color:{argb:'FFDCE9E7'}},right:{style:'hair',color:{argb:'FFE7F0EF'}}};cell.alignment={vertical:'middle'};if(c>=6)cell.numFmt='#,##0;[Red]-#,##0;–'}for(let c=6;c<=10;c++)row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:c===9?'FFF1FAF8':'FFF6F9FB'}};for(let c=11;c<=22;c++){row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF9F5'}};row.getCell(c).protection={locked:false}}row.getCell(23).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDDF6ED'}};row.getCell(23).font={bold:true,color:{argb:'FF08734D'}};row.getCell(5).font={bold:true,color:{argb:'FF20383E'}}});
    const end=op.lastRow.number;for(let c=6;c<=23;c++){const letter=op.getColumn(c).letter;groupRow.getCell(c).value={formula:`SUM(${letter}${start}:${letter}${end})`};groupRow.getCell(c).numFmt='#,##0;[Red]-#,##0;–'}
  });
  const totalRow=op.addRow([null,null,null,'TOTAL','Total OPEX',null,null,null,null,null,...Array(12).fill(null),null,null]);for(let c=6;c<=23;c++){const letter=op.getColumn(c).letter;totalRow.getCell(c).value={formula:`SUM(${groupRows.map(r=>`${letter}${r}`).join(',')})`};totalRow.getCell(c).numFmt='#,##0;[Red]-#,##0;–'}totalRow.height=26;totalRow.eachCell({includeEmpty:true},cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082765'}};cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.border={top:{style:'medium',color:{argb:'FF35D8C7'}}}});
  [17,13,34,28,38,16,16,20,17,16,...Array(12).fill(13),18,25].forEach((w,i)=>op.getColumn(i+1).width=w);[1,2,3,4].forEach(c=>op.getColumn(c).hidden=true);op.views=[{state:'frozen',ySplit:2,xSplit:0}];op.autoFilter={from:{row:2,column:5},to:{row:2,column:24}};op.properties.defaultRowHeight=22;
  op.getCell('A1').note=`Reference period: ${range.from} to ${range.to}. Enter Budget 2027 only in the green monthly cells.`;

  const tr=wb.addWorksheet('Travel Budget');const headers=['Employee Number','Fund Center','Employee Name','Title','From City','Destination','Round trip flight','Reason','Month','number of nights','Travel Tickets $','Travel Hotels $','Travel Transportation $','Travel Meals $','Travel Visa $','Travel Per Diem $','Travel Insurance $','Local Per Diem $','Local Transportaion $','Other Travel Cost $'];tr.addRow(headers);for(let i=0;i<40;i++)tr.addRow([null,d.cc,null,null,null,null,null,null,null,null,...Array(10).fill(null)]);[16,22,24,20,18,18,18,28,12,16,...Array(10).fill(20)].forEach((w,i)=>tr.getColumn(i+1).width=w);tr.views=[{state:'frozen',ySplit:1}];
  const lists=wb.addWorksheet('Lists');lists.state='veryHidden';lists.addRow(['Countries','Departments','Months']);COUNTRIES.forEach((v,i)=>lists.getCell(i+2,1).value=v);const deps=Object.values(m.departments||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name)));deps.forEach((v,i)=>lists.getCell(i+2,2).value=v.name||v.cc);MONTHS.forEach((v,i)=>lists.getCell(i+2,3).value=v);
  const countryFormula=`Lists!$A$2:$A$${COUNTRIES.length+1}`,deptFormula=`Lists!$B$2:$B$${deps.length+1}`,monthFormula='Lists!$C$2:$C$13';for(let r=2;r<=41;r++){tr.getCell(r,2).dataValidation={type:'list',allowBlank:false,formulae:[deptFormula],showErrorMessage:true,errorTitle:'Select Department',error:'Please select a department from the list.'};tr.getCell(r,5).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula],showErrorMessage:true,errorTitle:'Select Country',error:'Please select a country from the list.'};tr.getCell(r,6).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula],showErrorMessage:true,errorTitle:'Select Country',error:'Please select a country from the list.'};tr.getCell(r,9).dataValidation={type:'list',allowBlank:false,formulae:[monthFormula],showErrorMessage:true,errorTitle:'Select Month',error:'Please select a month from the list.'}}
  [info,op,tr].forEach(ws=>{ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};ws.getRow(1).alignment={vertical:'middle'};ws.autoFilter=ws===info?undefined:{from:{row:1,column:1},to:{row:1,column:ws.columnCount}}});
  for(let c=11;c<=20;c++){const cell=tr.getRow(1).getCell(c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF9DD7F5'}};cell.font={bold:true,color:{argb:'FF0A2C61'}};cell.alignment={vertical:'middle',horizontal:'center'}}
  const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Budget_2027_${String(d.name).replace(/[^A-Za-z0-9]+/g,'_')}_${d.cc}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function install(){const b=document.getElementById('masterTemplateBtn');if(!b)return setTimeout(install,250);b.onclick=downloadAllRows;b.dataset.allRowsTemplate='1'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();window.addEventListener('load',()=>setTimeout(install,0));
