const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const server=http.createServer((request,response)=>{
  const file=path.join(root,new URL(request.url,'http://localhost').pathname);
  if(!file.startsWith(root)||!fs.existsSync(file)){response.writeHead(404);return response.end()}
  response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/html');
  response.end(fs.readFileSync(file));
});
const mock=`export const doc=(db,c,id)=>c+'/'+id;export const serverTimestamp=()=>123;export async function getDoc(r){const d=JSON.parse(localStorage.getItem('fixture:'+r)||'null');return{exists:()=>!!d,data:()=>d}};export async function runTransaction(db,cb){if(window.failSave)throw Error('Connection lost');let write;const result=await cb({get:getDoc,set:(r,d)=>{write=[r,d]}});localStorage.setItem('fixture:'+write[0],JSON.stringify(write[1]));return result}`;
const headers=['Account Code','Account Name','Sector','Act LY (JOD)','YTD July (JOD)','Landing (JOD)','FY Landing (JOD)','Jan 2027','Feb 2027','Mar 2027','Apr 2027','May 2027','Jun 2027','Jul 2027','Aug 2027','Sep 2027','Oct 2027','Nov 2027','Dec 2027','FY 2027 Total (JOD)'];
const matrix=[headers,['601','Office rent','G&A',0,0,0,0,100.1,200.2,0,0,0,0,0,0,0,0,0,0,300.3],['602','Travel Tickets','G&A',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],['','','Total',0,0,0,0,'','','','','','','','','','','','','']];
const xlsxMock=`window.XLSX={read:()=>({Sheets:{'Tunis OPEX 2027':${JSON.stringify(matrix)}}}),utils:{sheet_to_json:s=>s}};`;

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.includes('firebase-firestore.js'))return route.fulfill({contentType:'text/javascript',body:mock});
    if(url.includes('xlsx.full.min.js'))return route.fulfill({contentType:'text/javascript',body:xlsxMock});
    if(url.includes('/js/firebase.js'))return route.fulfill({contentType:'text/javascript',body:`window.DADFirebase={db:{},auth:{currentUser:{uid:'fixture-admin'}},getUserProfile:async()=>({role:'admin',isMainAdmin:true,enabled:true})};window.dispatchEvent(new CustomEvent('dad-user-ready'));`});
    if(!url.startsWith('http://127.0.0.1:'))return route.abort();
    return route.continue();
  });
  await page.addInitScript(()=>localStorage.setItem('dadBudgetCurrentProfile',JSON.stringify({role:'admin',isMainAdmin:true,modules:[],departments:['ALL']})));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/tunis-budget.html');
  await page.getByText('Approved Tunis OPEX template loaded. Download it, complete the monthly budget, then upload it.').waitFor();
  assert.equal(await page.locator('.group-row').count(),2);
  assert.equal(await page.locator('.group-row').first().locator('td').first().innerText(),'Employees Benefits');
  assert.equal(await page.locator('#tunisHeader th').first().innerText(),'Group / Expense');
  assert.equal(await page.locator('#tunisBody input').count(),0);
  assert.equal(await page.locator('#saveBudget').count(),0);
  assert.equal(await page.locator('.expense-name').first().innerText(),'Office rent');
  assert(await page.locator('#downloadOpex').isEnabled());
  await page.locator('#opexFile').setInputFiles({name:'Tunis_OPEX_2027.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('fixture')});
  await page.getByText('Tunis_OPEX_2027.xlsx uploaded and saved successfully · revision 1.').waitFor();
  assert.equal(await page.locator('#totalValue').innerText(),'300.30');
  await page.locator('#summaryToggle').click();
  assert.equal(await page.locator('.detail-row:visible').count(),0);
  assert.equal(await page.locator('#summaryToggle').innerText(),'Show Details');
  await page.locator('#summaryToggle').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('fixture:tunis_budget/opex_2027')));
  assert.equal(saved.sector,'G&A');assert.equal(saved.total,300.3);assert.equal(saved.scope,'tunis_standalone');
  await page.reload();
  await page.getByText('Loaded saved OPEX 2027 · revision 1.').waitFor();
  assert.equal(await page.locator('.expense-name').first().innerText(),'Office rent');
  await page.screenshot({path:'/tmp/tunis-template-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert(await page.locator('#uploadOpex').isVisible());
  await page.screenshot({path:'/tmp/tunis-template-mobile.png'});
  console.log('PASS: replacement Tunis OPEX template, Excel-only upload, totals, saved reload, and responsive controls. Browser fixture uses mocked Firebase.');
  console.log('Browser errors:',errors);assert.deepEqual(errors,[]);
  await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
