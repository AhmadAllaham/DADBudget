const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const JSZip=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'jszip'));

(async()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'../templates/Tunis_OPEX_2027.xlsx'));
  const zip=await JSZip.loadAsync(bytes),workbookXml=await zip.file('xl/workbook.xml').async('string'),sheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(workbookXml,/name="Tunis OPEX 2027"/);
  assert.equal((sheetXml.match(/<x:row r=/g)||[]).length,178);
  for(let column=8;column<=19;column++)assert.match(sheetXml,new RegExp(`<x:col min="${column}" max="${column}" width="15" hidden="0"`));
  assert.match(sheetXml,/r="T2"[^>]*>\s*<x:f[^>]*>SUM\(H2:S2\)<\/x:f>/);
  assert.match(sheetXml,/r="T178"[^>]*>\s*<x:f[^>]*>SUM\(T2:T177\)<\/x:f>/);
  assert.match(sheetXml,/r="A177"/);
  assert.match(sheetXml,/r="C178"/);
  const cachedNumber=(column,row)=>{
    const cell=sheetXml.match(new RegExp(`<x:c r="${column}${row}"[^>]*>([\\s\\S]*?)<\\/x:c>`));
    assert(cell,`${column}${row} is required`);
    const value=cell[1].match(/<x:v>([^<]*)<\/x:v>/);
    assert(value,`${column}${row} must contain a cached numeric value`);
    return Number(value[1]);
  };
  const landingTotal=Array.from({length:176},(_,index)=>cachedNumber('F',index+2)).reduce((sum,value)=>sum+value,0);
  assert(Math.abs(cachedNumber('F',2)-10224.7325)<1e-8,'F2 must retain the supplied Basic Salaries Landing');
  assert(Math.abs(landingTotal-11700.744994721)<1e-8,'Landing values must reconcile to the supplied workbook');
  console.log('PASS: replacement Tunis OPEX asset retains supplied Landing values, 20 columns, 176 account rows, visible Jan-Dec inputs, and FY total formulas.');
})().catch(error=>{console.error(error);process.exit(1)});
