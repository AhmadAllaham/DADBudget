const KEY='dadBudgetOPEXBaselineV17';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COUNTRIES=['Jordan','Saudi Arabia','United Arab Emirates','Qatar','Bahrain','Kuwait','Oman','Iraq','Algeria','Egypt','Lebanon','Palestine','Yemen','Morocco','Tunisia','Libya','Sudan','Syria','Turkey','United States','United Kingdom','France','Germany','Italy','Spain','Switzerland','Netherlands','Belgium','Austria','Greece','Cyprus','India','Pakistan','Bangladesh','Sri Lanka','China','Japan','South Korea','Singapore','Malaysia','Indonesia','Philippines','Thailand','Australia','New Zealand','Canada','Brazil','South Africa','Kenya','Nigeria','Ghana','Ethiopia'];
const n=v=>{const x=Number(v||0);return Number.isFinite(x)?x:0};
function loadModel(){try{const m=JSON.parse(localStorage.getItem(KEY)||'null');if(m?.departments)return m}catch(_){}const keys=Object.keys(localStorage).filter(k=>/^dadBudgetOPEXBaselineV\d+$/i.test(k)).sort((a,b)=>Number((b.match(/\d+$/)||[0])[0])-Number((a.match(/\d+$/)||[0])[0]));for(const k of keys){try{const m=JSON.parse(localStorage.getItem(k)||'null');if(m?.departments)return m}catch(_){}}return null}
function controlled(code){const x=Number(String(code||'').trim());return (x>=6010001&&x<=6010031)||(x>=6020001&&x<=6020010)||(x>=6030010&&x<=6030180&&x%10===0)}
function category(code){const c=String(code||''),p=c.slice(0,3),m={'601':'Employees Benefits','602':'Travel Costs','603':'Depreciation and Amortization','604':'Maintenance cost','605':'A&P, Marketing Activities','606':'IT and Connectivity Expenses','607':'Professional & Consultation Expenses','608':'Utilities Expenses','609':'Insurance Expenses','610':'Logistic Expenses','611':'Governmental and Taxes Expenses','612':'Vehicles Expenses','613':'Products related Expense','614':'Other Expenses'};if(c==='6050015'||c==='6050016')return'Other Expenses';if(c==='6140019')return'Products related Expense';return m[p]||'Other Expenses'}
function actualYTD(x){return Object.values(x?.actualByMonth||{}).reduce((s,v)=>s+n(v),0)+n(x?.actualUnperiodized)}
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
  const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();
  const info=wb.addWorksheet('Instructions');[
    ['DAD BUDGET 2027 - DEPARTMENT TEMPLATE'],['Department',d.name],['Fund Center',d.cc],[],['HOW TO USE'],
    ['1','Fill OPEX Budget 2027 monthly values for normal OPEX accounts.'],
    ['2','All available OPEX accounts are included even when Actual YTD 2026 and FY Budget 2026 are zero.'],
    ['3','Employee Benefits G/L 6010001-6010031 are controlled by the separate HR Budget model.'],
    ['4','Travel G/L 6020001-6020010 are controlled by the Travel Budget sheet.'],
    ['5','Depreciation and Amortization G/L 6030010-6030180 are controlled by a separate model.'],
    ['6','Travel Budget dropdowns are provided for Department, Country and Month.'],
    ['7','Upload this same workbook once after completion.']
  ].forEach(r=>info.addRow(r));info.getColumn(1).width=18;info.getColumn(2).width=90;

  const op=wb.addWorksheet('OPEX Budget 2027');
  op.addRow(['Fund Center','G/L Account','Account Name','Category','Actual YTD 2026','FY Budget 2026',...MONTHS,'FY Budget 2027','Source / Note']);
  const accounts=allAccounts(m,d);
  accounts.forEach(a=>{const item=d.items?.[a.code];const row=op.addRow([d.cc,a.code,a.name,category(a.code),actualYTD(item),n(item?.fyBudget),...Array(12).fill(null),null,'Department Input']);row.getCell(19).value={formula:`SUM(G${row.number}:R${row.number})`}});
  [17,13,34,28,16,16,...Array(12).fill(12),16,26].forEach((w,i)=>op.getColumn(i+1).width=w);op.views=[{state:'frozen',ySplit:1}];

  const tr=wb.addWorksheet('Travel Budget');const headers=['Employee Number','Fund Center','Employee Name','Title','From City','Destination','Round trip flight','Reason','Month','number of nights','Travel Tickets $','Travel Hotels $','Travel Transportation $','Travel Meals $','Travel Visa $','Travel Per Diem $','Travel Insurance $','Local Per Diem $','Local Transportaion $','Other Travel Cost $'];tr.addRow(headers);for(let i=0;i<40;i++)tr.addRow([null,d.cc,null,null,null,null,null,null,null,null,...Array(10).fill(null)]);[16,22,24,20,18,18,18,28,12,16,...Array(10).fill(20)].forEach((w,i)=>tr.getColumn(i+1).width=w);tr.views=[{state:'frozen',ySplit:1}];
  const lists=wb.addWorksheet('Lists');lists.state='veryHidden';lists.addRow(['Countries','Departments','Months']);COUNTRIES.forEach((v,i)=>lists.getCell(i+2,1).value=v);const deps=Object.values(m.departments||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name)));deps.forEach((v,i)=>lists.getCell(i+2,2).value=v.name||v.cc);MONTHS.forEach((v,i)=>lists.getCell(i+2,3).value=v);
  const countryFormula=`Lists!$A$2:$A$${COUNTRIES.length+1}`,deptFormula=`Lists!$B$2:$B$${deps.length+1}`,monthFormula='Lists!$C$2:$C$13';for(let r=2;r<=41;r++){tr.getCell(r,2).dataValidation={type:'list',allowBlank:false,formulae:[deptFormula],showErrorMessage:true,errorTitle:'Select Department',error:'Please select a department from the list.'};tr.getCell(r,5).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula],showErrorMessage:true,errorTitle:'Select Country',error:'Please select a country from the list.'};tr.getCell(r,6).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula],showErrorMessage:true,errorTitle:'Select Country',error:'Please select a country from the list.'};tr.getCell(r,9).dataValidation={type:'list',allowBlank:false,formulae:[monthFormula],showErrorMessage:true,errorTitle:'Select Month',error:'Please select a month from the list.'}}
  [info,op,tr].forEach(ws=>{ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};ws.getRow(1).alignment={vertical:'middle'};ws.autoFilter=ws===info?undefined:{from:{row:1,column:1},to:{row:1,column:ws.columnCount}}});
  for(let c=11;c<=20;c++){const cell=tr.getRow(1).getCell(c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF9DD7F5'}};cell.font={bold:true,color:{argb:'FF0A2C61'}};cell.alignment={vertical:'middle',horizontal:'center'}}
  const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Budget_2027_${String(d.name).replace(/[^A-Za-z0-9]+/g,'_')}_${d.cc}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function install(){const b=document.getElementById('masterTemplateBtn');if(!b)return setTimeout(install,250);b.onclick=downloadAllRows;b.dataset.allRowsTemplate='1'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();window.addEventListener('load',()=>setTimeout(install,0));