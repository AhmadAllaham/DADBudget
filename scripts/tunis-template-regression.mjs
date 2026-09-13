import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {accountList,alignAccounts,parseOpexMatrix} from '../js/tunis-opex-workbook.js';
import {MONTHS} from '../js/tunis-budget-model.js';
const master=accountList([{code:'601',name:'Approved Salary'},{code:'602',name:'Travel Tickets'}]);
const headers=['Account Code','Account Name','Sector',...MONTHS.map(m=>`${m} 2027`),'FY 2027 Total (JOD)'];
const mx=[headers,['601','Approved Salary','G&A',100,...Array(11).fill(0),100],['602','Travel Tickets','G&A',25,...Array(11).fill(0),25]];
assert.equal(parseOpexMatrix(mx,master)[1].months[0],25);
assert.equal(alignAccounts(master,[{code:'601',description:'Old name',months:Array(12).fill(1)}])[0].description,'Approved Salary');
assert.throws(()=>parseOpexMatrix([headers,mx[1],mx[1]],master),/duplicate/);
assert.throws(()=>parseOpexMatrix([headers,mx[1]],master),/every approved/);
assert.throws(()=>parseOpexMatrix([headers,[...mx[1].slice(0,2),'S&M',...mx[1].slice(3)],mx[2]],master),/classification/);
assert.throws(()=>alignAccounts(master,[{code:'999',description:'Existing legacy row',months:Array(12).fill(1)}]),/kept/);
// Execute the existing CAPEX parser against matrices without a cloud connection.
const context={window:{},document:{getElementById:()=>null},localStorage:{getItem:()=>{throw Error('Tunis must not read shared localStorage')}},setTimeout:()=>{},console};
context.window.DADCapexConfig={standalone:true,departments:{TUNIS:{cc:'TUNIS',name:'Tunis'}},loadPayments:()=>[],savePayments:()=>{}};
context.XLSX={utils:{sheet_to_json:s=>s,aoa_to_sheet:s=>s}};context.window.XLSX=context.XLSX;vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/capex-payment-schedule.js',import.meta.url),'utf8'),context);
const requests=[['Request ID','Company','Fund Center','Department','Asset Category','Budget Description','Justification','Priority','Quantity',...MONTHS],['TUNIS-CAPEX-001','Tunis','TUNIS','Tunis','Computers & Printers','Laptop','Replacement','High',1,1000,...Array(11).fill(0)]];
const paymentHeaders=['Fund Center','Department','Asset Category','Budget Description','FY CAPEX 2027',...MONTHS,'2028'];
function workbook(amount=400){return{SheetNames:['CAPEX Budget 2027','Payment Schedule'],Sheets:{'CAPEX Budget 2027':requests,'Payment Schedule':[paymentHeaders,['TUNIS','Tunis','Computers & Printers','Laptop',1000,600,...Array(11).fill(0),amount]]}}}
const parsed=context.window.DADCapexPaymentSchedule.parseWorkbook(workbook(),'tunis.xlsx');assert.equal(parsed.rows[0].q1,1000);assert.equal(parsed.payments.length,2);assert.equal(parsed.payments[1].expectedPaymentDate,'2028-01-01');assert.equal(parsed.payments[1].amount,400);assert.throws(()=>context.window.DADCapexPaymentSchedule.parseWorkbook(workbook(300),'bad.xlsx'),/must equal/);
assert.equal(context.window.DADCapexPaymentSchedule.loadPayments().length,0);
const cloud=fs.readFileSync(new URL('../js/tunis-capex-cloud.js',import.meta.url),'utf8');assert(!cloud.includes("'capex_budget_submissions'"));assert(!cloud.includes("'system_status'"));
console.log('PASS: approved account names/codes, totals, duplicate/missing/classification guards, legacy preservation, reused CAPEX parser, monthly + 2028 reconciliation, isolated payments and storage.');
