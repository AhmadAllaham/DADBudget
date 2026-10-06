const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const fixture = {
  fiscalYear: 2027,
  scenario: 'V1 Budget 2027',
  displayScenario: 'FY Budget 27',
  category: 'COGS',
  sourceFile: 'Sales Platform Template.xlsx',
  revision: 1,
  rows: [
    { country: 'Iraq', agent: 'Mena', rank: 6, amount: -3307.801556562087 },
    { country: 'Iraq', agent: 'Dara', rank: 6, amount: -8677.495256274608 },
    { country: 'Jordan', agent: 'Jordan Team', rank: 6, amount: -4152 },
  ],
};
fixture.total = fixture.rows.reduce((sum, row) => sum + row.amount, 0);

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
  await page.getByText('Sales Platform Template.xlsx · 3 COGS rows · Revision 1').waitFor();
  assert.equal(await page.locator('#plBody tr').count(), 9);
  assert.equal(await page.locator('#plBody tr.cogs td').nth(1).innerText(), '(16,137)');
  assert.equal(await page.locator('#plBody tr:not(.cogs) td:last-child').filter({ hasText: '—' }).count(), 8);
  assert.equal(await page.locator('.pl-table th').nth(1).innerText(), 'FY Budget 27');
  await page.locator('#plCountry').selectOption('Iraq');
  await page.locator('#plAgent').selectOption('Mena');
  assert.equal(await page.locator('#plBody tr.cogs td').nth(1).innerText(), '(3,308)');
  assert.equal(await page.locator('#plCogsValue').innerText(), '(3,308)');
  await page.screenshot({ path: '/tmp/pl-cogs-v1-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('#plCountry').isVisible());
  assert(await page.locator('#plBody tr.cogs').isVisible());
  await page.screenshot({ path: '/tmp/pl-cogs-v1-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: P&L keeps the full category layout and populates only COGS from FY Budget 27, including country/agent filters and responsive layout.');
  await browser.close();
  server.close();
})().catch(error => { console.error(error); process.exit(1); });
