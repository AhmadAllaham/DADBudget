const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const categories = [
  ['Gross Sales', 'grosssales', 6552.9985, 6370.4542, 8611.49],
  ['Return', 'return', 0, 0, 0],
  ['Discount', 'discount', -195.79, -190.3, -258.3447],
  ['Commission', 'commission', -655.29985, -637.04542, -861.149],
  ['Net of sales', 'netofsales', 5701.90865, 5543.10878, 7491.9963],
  ['COGS', 'cogs', -3673.41636, -3179, -3307.80156],
  ['Gross Profit', 'grossprofit', 2028.49229, 2364.10878, 4184.19474],
  ['S&M', 'sm', -173.71217, -125.4585, -162.26545],
  ['Net Profit', 'netprofit', 1854.78012, 2238.65028, 4021.92929],
];
const fixture = {
  fiscalYear: 2027, scenario: 'V1 Budget 2027', displayScenario: 'FY Budget 27',
  sourceFile: 'Sales Platform Template.xlsx', revision: 2,
  rows: categories.map(([category, categoryKey, b26, l26, b27], index) => ({ country: 'Iraq', agent: 'Mena', rank: index + 1, category, categoryKey, b26, l26, b27 })),
};

const server = http.createServer((request, response) => {
  const file = path.join(root, new URL(request.url, 'http://localhost').pathname);
  if (!file.startsWith(root) || !fs.existsSync(file)) { response.writeHead(404); return response.end(); }
  response.setHeader('Content-Type', file.endsWith('.js') || file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  response.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('/js/firebase.js')) return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (url.includes('firebase-app.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const getApps=()=>[{}];' });
    if (url.includes('firebase-auth.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const getAuth=()=>({});export const onAuthStateChanged=(auth,callback)=>{callback({uid:"fixture"});return()=>{}};' });
    if (url.includes('firebase-firestore.js')) return route.fulfill({ contentType: 'text/javascript', body: `export const getFirestore=()=>({});export const doc=(db,c,id)=>c+'/'+id;export const getDoc=async()=>({exists:()=>true,data:()=>(${JSON.stringify(fixture)})});` });
    if (!url.startsWith('http://127.0.0.1:')) return route.abort();
    return route.continue();
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(base + '/pl.html');
  await page.getByText('Sales Platform Template.xlsx · 9 rows · Revision 2').waitFor();
  assert.equal(await page.locator('#plBody tr').count(), 9);
  assert.equal(await page.locator('.pl-table th').count(), 10);
  assert.deepEqual(await page.locator('#plBody tr.cogs td').evaluateAll(cells => cells.map(cell => cell.innerText)), ['COGS', '(3,673)', '(3,179)', '(3,308)', '494', '13%', '366', '10%', '(129)', '(4%)']);
  assert.equal(await page.locator('#plRatiosBody tr').count(), 5);
  assert.deepEqual(await page.locator('#plRatiosBody tr').first().locator('td').evaluateAll(cells => cells.map(cell => cell.innerText)), ['56%', '50%', '38%']);
  assert.equal(await page.locator('#plCountry').inputValue(), '');
  await page.locator('#plCountry').selectOption('Iraq');
  await page.locator('#plAgent').selectOption('Mena');
  assert.equal(await page.locator('#plRowCount').innerText(), '9');
  await page.screenshot({ path: '/tmp/pl-summary-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('#plCountry').isVisible());
  assert(await page.locator('#plBody tr.cogs').isVisible());
  await page.screenshot({ path: '/tmp/pl-summary-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: P&L renders B26, L26, V1 B27, comparison columns, ratios and filters.');
  await browser.close();
  server.close();
})().catch(error => { console.error(error); process.exit(1); });
