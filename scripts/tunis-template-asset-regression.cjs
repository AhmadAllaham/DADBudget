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
  for(let row=2;row<=178;row++)for(const column of ['D','E','F','G']){
    const cell=sheetXml.match(new RegExp(`<x:c r="${column}${row}"[^>]*>([\\s\\S]*?)<\\/x:c>`));
    assert(cell,`${column}${row} is required`);
    const value=cell[1].match(/<x:v>([^<]*)<\/x:v>/);
    assert(value,`${column}${row} must contain a cached numeric value`);
    assert.equal(Number(value[1]),0,`${column}${row} must not expose a historical financial value`);
  }
  console.log('PASS: replacement Tunis OPEX asset has 20 columns, 176 account rows, zeroed public comparisons, visible Jan-Dec inputs, and FY total formulas.');
})().catch(error=>{console.error(error);process.exit(1)});
