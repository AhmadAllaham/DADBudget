import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {accountList,alignAccounts,parseOpexMatrix,opexCategory,templateAccountList,TUNIS_OPEX_HEADERS} from '../js/tunis-opex-workbook.js';
import {MONTHS} from '../js/tunis-budget-model.js';

const master=accountList([{code:'601',name:'Approved Salary'},{code:'602',name:'Travel Tickets'}]);
const filtered=accountList([{code:'601',name:'Approved Salary'},{code:'Commitment Item',name:'Commitment Item'},{code:'RCMMTITEM',name:'RCMMTITEM'},{code:'X',name:'X'},{code:'24',name:'24'},{code:'999',name:'Commitment Item (G/L Accounts-Expenses)'}]);
assert.deepEqual(filtered.map(row=>row.code),['601']);
assert.equal(opexCategory('6050015'),'A&P, Marketing Activities');
assert.equal(opexCategory('6059999'),'A&P, Marketing Activities');
assert.equal(opexCategory('6140019'),'Other Expenses');
assert.equal(opexCategory('6149999'),'Other Expenses');

const detail=(code,name,jan=0)=>[code,name,'G&A',100,70,50,120,jan,...Array(11).fill(0),jan];
const matrix=[TUNIS_OPEX_HEADERS,detail('601','Approved Salary',100),detail('602','Travel Tickets',25),['','','Total',200,140,100,240,...Array(12).fill(''),125]];
assert.deepEqual(templateAccountList(matrix).map(row=>row.code),['601','602']);
assert.equal(parseOpexMatrix(matrix,master)[1].months[0],25);
assert.equal(alignAccounts(master,[{code:'601',description:'Old name',months:Array(12).fill(1)}])[0].description,'Approved Salary');
assert.equal(alignAccounts(master,[{code:'601',description:'Old name',months:Array(12).fill(1)},{code:'X',description:'X',months:Array(12).fill(0)}]).length,2);
assert.throws(()=>parseOpexMatrix([TUNIS_OPEX_HEADERS,matrix[1],matrix[1]],master),/duplicate/);
assert.throws(()=>parseOpexMatrix([TUNIS_OPEX_HEADERS,matrix[1]],master),/every approved/);
assert.throws(()=>parseOpexMatrix([TUNIS_OPEX_HEADERS,[...matrix[1].slice(0,2),'S&M',...matrix[1].slice(3)],matrix[2]],master),/classification/);
assert.throws(()=>alignAccounts(master,[{code:'999',description:'Existing legacy row',months:Array(12).fill(1)}]),/kept/);
const excludedTemplate=[TUNIS_OPEX_HEADERS,matrix[1],matrix[2],['RCMMTITEM','RCMMTITEM','G&A',...Array(17).fill(0)]];
assert.equal(parseOpexMatrix(excludedTemplate,master).length,2);
const oldHeaders=['Account Code','Account Name','Sector',...MONTHS.map(month=>`${month} 2027`),'FY 2027 Total (JOD)'];
assert.throws(()=>parseOpexMatrix([oldHeaders],master),/current Tunis OPEX 2027 template/);

// Execute the existing CAPEX parser against matrices without a cloud connection.
const context={window:{},document:{getElementById:()=>null},localStorage:{getItem:()=>{throw Error('Tunis must not read shared localStorage')}},setTimeout:()=>{},console};
context.window.DADCapexConfig={standalone:true,departments:{TUNIS:{cc:'TUNIS',name:'Tunis'}},loadPayments:()=>[],savePayments:()=>{}};
context.XLSX={utils:{sheet_to_json:sheet=>sheet,aoa_to_sheet:sheet=>sheet}};context.window.XLSX=context.XLSX;vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/capex-payment-schedule.js',import.meta.url),'utf8'),context);
const requests=[['Request ID','Company','Fund Center','Department','Asset Category','Budget Description','Justification','Priority','Quantity',...MONTHS],['TUNIS-CAPEX-001','Tunis','TUNIS','Tunis','Computers & Printers','Laptop','Replacement','High',1,1000,...Array(11).fill(0)]];
const paymentHeaders=['Fund Center','Department','Asset Category','Budget Description','FY CAPEX 2027',...MONTHS,'2028'];
function workbook(amount=400){return{SheetNames:['CAPEX Budget 2027','Payment Schedule'],Sheets:{'CAPEX Budget 2027':requests,'Payment Schedule':[paymentHeaders,['TUNIS','Tunis','Computers & Printers','Laptop',1000,600,...Array(11).fill(0),amount]]}}}
const parsed=context.window.DADCapexPaymentSchedule.parseWorkbook(workbook(),'tunis.xlsx');assert.equal(parsed.rows[0].q1,1000);assert.equal(parsed.payments.length,2);assert.equal(parsed.payments[1].expectedPaymentDate,'2028-01-01');assert.equal(parsed.payments[1].amount,400);assert.throws(()=>context.window.DADCapexPaymentSchedule.parseWorkbook(workbook(300),'bad.xlsx'),/must equal/);
assert.equal(context.window.DADCapexPaymentSchedule.loadPayments().length,0);
const cloud=fs.readFileSync(new URL('../js/tunis-capex-cloud.js',import.meta.url),'utf8');assert(!cloud.includes("'capex_budget_submissions'"));assert(!cloud.includes("'system_status'"));
console.log('PASS: replacement Tunis OPEX headers, template accounts, monthly import, mapping guards, and isolated CAPEX workflow.');
