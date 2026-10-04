import {MONTHS,validateRows} from './tunis-budget-model.js';

const clean=value=>String(value??'').trim();
const EXCLUDED_ACCOUNTS=new Set(['COMMITMENTITEM','COMMITMENTITEMGLACCOUNTSEXPENSES','RCMMTITEM','X','24']);
const CATEGORY_BY_PREFIX={'601':'Employees Benefits','602':'Travel Costs','603':'Depreciation and Amortization','604':'Maintenance cost','605':'A&P, Marketing Activities','606':'IT and Connectivity Expenses','607':'Professional & Consultation Expenses','608':'Utilities Expenses','609':'Insurance Expenses','610':'Logistic Expenses','611':'Governmental and Taxes Expenses','612':'Vehicles Expenses','613':'Products related Expense','614':'Other Expenses'};
const accountKey=value=>clean(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
const MONTH_START_INDEX=7;
const MONTH_END_INDEX=MONTH_START_INDEX+MONTHS.length;

export const TUNIS_OPEX_TEMPLATE_URL='templates/Tunis_OPEX_2027.xlsx?v=20261004-template-1';
export const TUNIS_OPEX_HEADERS=['Account Code','Account Name','Sector','Act LY (JOD)','YTD July (JOD)','Landing (JOD)','FY Landing (JOD)',...MONTHS.map(month=>`${month} 2027`),'FY 2027 Total (JOD)'];
export const isExcludedTunisOpexAccount=(code,name)=>EXCLUDED_ACCOUNTS.has(accountKey(code))||EXCLUDED_ACCOUNTS.has(accountKey(name));
export const opexCategory=code=>CATEGORY_BY_PREFIX[clean(code).slice(0,3)]||'Other Expenses';

let templateBytesPromise;

function validateTemplateHeaders(matrix){
  if(!TUNIS_OPEX_HEADERS.every((header,index)=>clean(matrix[0]?.[index])===header))throw Error('Use the current Tunis OPEX 2027 template without changing its headers.');
}

function isTotalRow(row){
  return !clean(row?.[0])&&!clean(row?.[1])&&clean(row?.[2]).toLowerCase()==='total';
}

async function templateBytes(){
  if(!templateBytesPromise){
    templateBytesPromise=fetch(TUNIS_OPEX_TEMPLATE_URL,{cache:'no-store'}).then(response=>{
      if(!response.ok)throw Error(`The Tunis OPEX template could not be loaded (${response.status}).`);
      return response.arrayBuffer();
    }).catch(error=>{templateBytesPromise=null;throw error});
  }
  return templateBytesPromise;
}

export function accountList(raw){
  const map=new Map();
  for(const [key,value] of Object.entries(raw||{})){
    const code=clean(value?.code||(Array.isArray(raw)?'':key)),name=clean(value?.name);
    if(code&&name&&!isExcludedTunisOpexAccount(code,name))map.set(code,{code,description:name,months:Array(12).fill(0)});
  }
  if(!map.size)throw Error('The approved OPEX account list is not available.');
  if(map.size>500)throw Error('The approved account list exceeds the 500-line Tunis plan limit.');
  return [...map.values()].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
}

export function templateAccountList(matrix){
  validateTemplateHeaders(matrix);
  const rows=[],seen=new Set();
  matrix.slice(1).forEach((row,index)=>{
    if(!row.some(value=>clean(value))||isTotalRow(row)||isExcludedTunisOpexAccount(row[0],row[1]))return;
    const code=clean(row[0]),description=clean(row[1]),sector=clean(row[2]);
    if(!code||!description)throw Error(`Template row ${index+2}: account code and name are required.`);
    if(sector!=='G&A')throw Error(`Template row ${index+2}: Tunis OPEX must remain classified as G&A.`);
    if(seen.has(code))throw Error(`Template row ${index+2}: duplicate account ${code}.`);
    seen.add(code);rows.push({code,description,months:Array(12).fill(0)});
  });
  if(!rows.length)throw Error('The Tunis OPEX template does not contain any approved accounts.');
  if(rows.length>500)throw Error('The Tunis OPEX template exceeds the 500-line plan limit.');
  return rows;
}

export async function loadOpexTemplateMaster(){
  if(!window.XLSX)throw Error('The Excel template engine is still loading.');
  const workbook=XLSX.read((await templateBytes()).slice(0),{type:'array'}),sheet=workbook.Sheets['Tunis OPEX 2027'];
  if(!sheet)throw Error('The Tunis OPEX 2027 template sheet is missing.');
  return templateAccountList(XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}));
}

export function alignAccounts(master,saved){
  const known=new Map(master.map(row=>[row.code,row])),values=new Map();
  for(const row of validateRows(saved||[])){
    if(isExcludedTunisOpexAccount(row.code,row.description))continue;
    if(!known.has(row.code))throw Error(`Saved account ${row.code||row.description} is not in the approved Tunis template. Your saved data has been kept; update its mapping before replacing it.`);
    if(values.has(row.code))throw Error(`Saved account ${row.code} is duplicated. Resolve its mapping before replacing it.`);
    values.set(row.code,row.months);
  }
  return master.map(row=>({...row,months:[...(values.get(row.code)||Array(12).fill(0))]}));
}

export function parseOpexMatrix(matrix,master){
  validateTemplateHeaders(matrix);
  const allowed=new Map(master.map(row=>[row.code,row])),seen=new Set(),rows=[];
  matrix.slice(1).forEach((row,index)=>{
    if(!row.some(value=>clean(value))||isTotalRow(row)||isExcludedTunisOpexAccount(row[0],row[1]))return;
    const code=clean(row[0]);
    if(!allowed.has(code))throw Error(`Row ${index+2}: account ${code||'(blank)'} is not approved.`);
    if(seen.has(code))throw Error(`Row ${index+2}: duplicate account ${code}.`);
    seen.add(code);
    if(clean(row[1])!==allowed.get(code).description||clean(row[2])!=='G&A')throw Error(`Row ${index+2}: keep the approved account name and G&A classification.`);
    rows.push({code,description:allowed.get(code).description,months:row.slice(MONTH_START_INDEX,MONTH_END_INDEX).map(value=>value===''?0:value)});
  });
  if(seen.size!==master.length)throw Error('Keep every approved account row in the template; leave unused amounts at zero.');
  return alignAccounts(master,validateRows(rows));
}

export function populateOpexTemplateWorksheet(worksheet,rows){
  if(!worksheet)throw Error('The Tunis OPEX 2027 template sheet is missing.');
  const values=new Map(rows.map(row=>[clean(row.code),row])),found=new Set();
  for(let rowNumber=2;rowNumber<=worksheet.rowCount;rowNumber++){
    const row=worksheet.getRow(rowNumber),code=clean(row.getCell(1).value),sector=clean(row.getCell(3).value);
    if(!code&&sector.toLowerCase()==='total'){
      row.getCell(20).value={formula:`SUM(T2:T${rowNumber-1})`};
      continue;
    }
    if(!values.has(code))continue;
    const budgetRow=values.get(code);found.add(code);
    budgetRow.months.forEach((value,month)=>{row.getCell(MONTH_START_INDEX+month+1).value=Number(value||0)});
    row.getCell(20).value={formula:`SUM(H${rowNumber}:S${rowNumber})`};
  }
  const missing=[...values.keys()].filter(code=>!found.has(code));
  if(missing.length)throw Error(`The Tunis OPEX template is missing approved account ${missing[0]}.`);
  return worksheet;
}

export async function downloadOpex(rows){
  if(!window.ExcelJS)throw Error('The Excel template engine is still loading.');
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load((await templateBytes()).slice(0));
  populateOpexTemplateWorksheet(workbook.getWorksheet('Tunis OPEX 2027'),rows);
  workbook.creator='DAD Budget 2027';workbook.calcProperties.fullCalcOnLoad=true;
  const data=await workbook.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');
  link.href=url;link.download='Tunis_OPEX_2027.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
