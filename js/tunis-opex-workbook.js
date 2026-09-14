import {MONTHS,validateRows} from './tunis-budget-model.js';
const clean=v=>String(v??'').trim();
const EXCLUDED_ACCOUNTS=new Set(['COMMITMENTITEM','COMMITMENTITEMGLACCOUNTSEXPENSES','RCMMTITEM','X','24']);
const CATEGORY_BY_PREFIX={'601':'Employees Benefits','602':'Travel Costs','603':'Depreciation and Amortization','604':'Maintenance cost','605':'A&P, Marketing Activities','606':'IT and Connectivity Expenses','607':'Professional & Consultation Expenses','608':'Utilities Expenses','609':'Insurance Expenses','610':'Logistic Expenses','611':'Governmental and Taxes Expenses','612':'Vehicles Expenses','613':'Products related Expense','614':'Other Expenses'};
const accountKey=value=>clean(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
export const isExcludedTunisOpexAccount=(code,name)=>EXCLUDED_ACCOUNTS.has(accountKey(code))||EXCLUDED_ACCOUNTS.has(accountKey(name));
export const opexCategory=code=>CATEGORY_BY_PREFIX[clean(code).slice(0,3)]||'Other Expenses';
export function accountList(raw){
  const map=new Map();
  for(const [key,value] of Object.entries(raw||{})){const code=clean(value?.code||(Array.isArray(raw)?'':key)),name=clean(value?.name);if(code&&name&&!isExcludedTunisOpexAccount(code,name))map.set(code,{code,description:name,months:Array(12).fill(0)})}
  if(!map.size)throw Error('The approved OPEX account list is not available. Publish the OPEX baseline first.');
  if(map.size>500)throw Error('The approved account list exceeds the 500-line Tunis plan limit.');
  return [...map.values()].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
}
export function alignAccounts(master,saved){
  const known=new Map(master.map(r=>[r.code,r])),values=new Map();
  for(const row of validateRows(saved||[])){
    if(isExcludedTunisOpexAccount(row.code,row.description))continue;
    if(!known.has(row.code))throw Error(`Saved account ${row.code||row.description} is not in the approved OPEX list. Your saved data has been kept; update its mapping before replacing it.`);
    if(values.has(row.code))throw Error(`Saved account ${row.code} is duplicated. Resolve its mapping before replacing it.`);
    values.set(row.code,row.months);
  }
  return master.map(row=>({...row,months:[...(values.get(row.code)||Array(12).fill(0))]}));
}
export function parseOpexMatrix(matrix,master){
  const headers=['Account Code','Account Name','Sector',...MONTHS.map(m=>`${m} 2027`),'FY 2027 Total (JOD)'];
  if(!headers.every((h,i)=>clean(matrix[0]?.[i])===h))throw Error('Use the Tunis OPEX 2027 template without changing its headers.');
  const allowed=new Map(master.map(r=>[r.code,r])),seen=new Set(),rows=[];
  matrix.slice(1).forEach((r,i)=>{
    if(!r.some(v=>clean(v)))return;
    const code=clean(r[0]);if(isExcludedTunisOpexAccount(code,r[1]))return;if(!allowed.has(code))throw Error(`Row ${i+2}: account ${code||'(blank)'} is not approved.`);
    if(seen.has(code))throw Error(`Row ${i+2}: duplicate account ${code}.`);seen.add(code);
    if(clean(r[1])!==allowed.get(code).description||clean(r[2])!=='G&A')throw Error(`Row ${i+2}: keep the approved account name and G&A classification.`);
    rows.push({code,description:allowed.get(code).description,months:r.slice(3,15).map(v=>v===''?0:v)});
  });
  if(seen.size!==master.length)throw Error('Keep every approved account row in the template; leave unused amounts at zero.');
  return alignAccounts(master,validateRows(rows));
}
export async function downloadOpex(rows){
  if(!window.ExcelJS)throw Error('The Excel template engine is still loading.');
  const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.calcProperties.fullCalcOnLoad=true;
  const ws=wb.addWorksheet('Tunis OPEX 2027');ws.addRow(['Account Code','Account Name','Sector',...MONTHS.map(m=>`${m} 2027`),'FY 2027 Total (JOD)']);
  rows.forEach(row=>{const r=ws.addRow([row.code,row.description,'G&A',...row.months,0]);r.getCell(16).value={formula:`SUM(D${r.number}:O${r.number})`};for(let c=4;c<=15;c++){const cell=r.getCell(c);cell.protection={locked:false};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF9F5'}};cell.numFmt='#,##0.00';cell.dataValidation={type:'decimal',operator:'between',formulae:[0,10000000000],allowBlank:true,showErrorMessage:true,error:'Enter a non-negative amount.'}}r.getCell(16).numFmt='#,##0.00';});
  ws.getRow(1).height=30;ws.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};cell.alignment={wrapText:true,vertical:'middle'}});
  [18,48,14,...Array(12).fill(15),23].forEach((w,i)=>ws.getColumn(i+1).width=w);ws.views=[{state:'frozen',ySplit:1,xSplit:3}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:16}};
  await ws.protect('DAD-Budget-2027',{selectLockedCells:true,selectUnlockedCells:true,autoFilter:true});
  const data=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='Tunis_OPEX_2027.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
