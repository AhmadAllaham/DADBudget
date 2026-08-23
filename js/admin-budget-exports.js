import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
const num=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};

function bytesFromBase64(value){const raw=atob(value||''),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function decodeSubmission(data,id){
  if(!data?.payload)return null;
  if(data.encoding==='gzip-base64-v1'){
    if(typeof DecompressionStream==='undefined')throw new Error('Please use an updated Chrome or Edge browser.');
    const stream=new Blob([bytesFromBase64(data.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return{...JSON.parse(await new Response(stream).text()),cc:clean(id)};
  }
  if(data.encoding==='json-v1')return{...JSON.parse(data.payload||'{}'),cc:clean(id)};
  return{...data,cc:clean(id)};
}
function category(code){const value=clean(code),prefix=value.slice(0,3),map={'601':'Employees Benefits','602':'Travel Costs','603':'Depreciation and Amortization','604':'Maintenance cost','605':'A&P, Marketing Activities','606':'IT and Connectivity Expenses','607':'Professional & Consultation Expenses','608':'Utilities Expenses','609':'Insurance Expenses','610':'Logistic Expenses','611':'Governmental and Taxes Expenses','612':'Vehicles Expenses','613':'Products related Expense','614':'Other Expenses'};if(value==='6050015'||value==='6050016')return'Other Expenses';if(value==='6140019')return'Products related Expense';return map[prefix]||'Other Expenses'}
function styleSheet(ws,widths){
  ws.views=[{state:'frozen',ySplit:1}];
  ws.autoFilter={from:{row:1,column:1},to:{row:1,column:widths.length}};
  ws.getRow(1).height=24;ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2C61'}};ws.getRow(1).alignment={vertical:'middle'};
  widths.forEach((width,index)=>ws.getColumn(index+1).width=width);
}
function moneyColumns(ws,start,end){for(let c=start;c<=end;c++)ws.getColumn(c).numFmt='#,##0.00;[Red](#,##0.00);-'}
async function saveWorkbook(wb,fileName){const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function dateText(value){if(value?.toDate)return value.toDate().toLocaleString();if(value?.seconds)return new Date(value.seconds*1000).toLocaleString();return clean(value)}
function workflow(data){return data&&Object.keys(data).length?clean(data.workflowStatus||data.financeStatus||data.status||'uploaded'):'Not submitted'}
function mergeOpexDepartment(baseline,submitted){
  const merged={...(baseline||{}),items:{...(baseline?.items||{})}};
  Object.entries(submitted?.items||{}).forEach(([key,item])=>{const code=clean(item?.code||key);if(!code)return;const current=merged.items[code]||merged.items[key]||{code,name:clean(item?.name)||code},budget={...(item?.newBudgetByMonth||{})},hasValues=Object.values(budget).some(value=>Math.abs(num(value))>.00001),travel=/^60200(0[1-9]|10)$/.test(code);merged.items[code]={...current,name:clean(current.name||item?.name||code),newBudgetByMonth:travel&&!hasValues?{...(current.newBudgetByMonth||{})}:budget};if(code!==key)delete merged.items[key]});
  return merged;
}

async function exportOpex(btn){
  const old=btn.textContent;btn.disabled=true;btn.textContent='Preparing OPEX Excel...';
  try{
    if(typeof ExcelJS==='undefined')throw new Error('Excel export engine is still loading.');
    const [metaSnap,baselineSnap,submissionSnap]=await Promise.all([getDoc(doc(db,'opex_baseline_meta','current')),getDocs(collection(db,'opex_baseline_departments')),getDocs(collection(db,'opex_budget_submissions'))]);
    if(!metaSnap.exists())throw new Error('The Finance OPEX baseline is not published yet.');
    const baselineMap=new Map(),submissionMap=new Map();baselineSnap.forEach(record=>baselineMap.set(record.id,record.data()||{}));submissionSnap.forEach(record=>submissionMap.set(record.id,record.data()||{}));
    const metaData=metaSnap.data()||{},master=(Array.isArray(metaData.accountMaster)?metaData.accountMaster:[]).map(item=>({code:clean(item?.code),name:clean(item?.name||item?.code)})).filter(item=>item.code),orderedIds=[...(Array.isArray(metaData.departments)?metaData.departments.map(clean).filter(Boolean):[])];baselineSnap.forEach(record=>{if(!orderedIds.includes(record.id))orderedIds.push(record.id)});
    const departments=[];
    for(const cc of orderedIds){
      const baselineMeta=baselineMap.get(cc)||{},submissionMeta=submissionMap.get(cc)||{},baseline=baselineMeta.payload?await decodeSubmission(baselineMeta,cc):{cc,name:baselineMeta.name,items:{}},submitted=submissionMeta.payload&&workflow(submissionMeta)==='approved'?await decodeSubmission(submissionMeta,cc):null,data=mergeOpexDepartment(baseline,submitted),items=data.items||{},seen=new Set(),orderedItems=[];
      master.forEach(account=>{seen.add(account.code);orderedItems.push({...account,...(items[account.code]||{}),code:account.code,name:clean(items[account.code]?.name||account.name||account.code)})});Object.values(items).forEach(item=>{const code=clean(item?.code);if(code&&!seen.has(code)){seen.add(code);orderedItems.push(item)}});
      const lines=orderedItems.map(item=>{const months=MONTHS.map((_,i)=>num(item?.newBudgetByMonth?.[`2027-${String(i+1).padStart(2,'0')}`])),total=months.reduce((sum,value)=>sum+value,0),budget=Object.entries(item?.budgetByMonth||{}).filter(([key])=>key.startsWith('2026-')).reduce((sum,[,value])=>sum+num(value),0),actual=Object.entries(item?.actualByMonth||{}).filter(([key])=>key.startsWith('2026-')).reduce((sum,[,value])=>sum+num(value),0)+num(item?.actualUnperiodized),fy2026=num(item?.fyBudget);return{code:clean(item?.code),name:clean(item?.name||item?.code),category:category(item?.code),budget,actual,fy2026,remaining:fy2026-actual,months,total}});
      departments.push({cc,name:clean(data.name||baselineMeta.name||submissionMeta.name||cc),lines,total:lines.reduce((sum,line)=>sum+line.total,0),meta:submissionMeta});
    }
    if(!departments.length)throw new Error('No OPEX departments were found in the Finance baseline.');
    const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();
    const summary=wb.addWorksheet('Summary');summary.addRow(['Fund Center','Department','Budget Lines','FY Budget 2027','Status','Revision','Submitted By','Submitted At','Source File']);departments.forEach(d=>summary.addRow([d.cc,d.name,d.lines.length,d.total,workflow(d.meta),num(d.meta.revision),clean(d.meta.submittedEmail),dateText(d.meta.submittedAt)||clean(d.meta.clientSubmittedAt),clean(d.meta.fileName)]));styleSheet(summary,[18,34,14,20,20,11,28,22,38]);moneyColumns(summary,4,4);
    const headers=['Fund Center','Department','G/L Account','Account Name','Category','Budget YTD 2026','Actual YTD 2026','Budget YTD Vs Actual','FY Budget 2026','Remaining',...MONTHS,'FY Budget 2027','Status','Revision','Submitted By','Source File'];
    const widths=[18,34,14,38,30,18,18,22,18,18,...Array(12).fill(13),20,20,11,28,38];
    const all=wb.addWorksheet('All OPEX');all.addRow(headers);
    departments.forEach(d=>{
      const rows=d.lines.map(line=>[d.cc,d.name,line.code,line.name,line.category,line.budget,line.actual,line.budget-line.actual,line.fy2026,line.remaining,...line.months,line.total,workflow(d.meta),num(d.meta.revision),clean(d.meta.submittedEmail),clean(d.meta.fileName)]);
      rows.forEach(row=>all.addRow(row));
    });
    styleSheet(all,widths);moneyColumns(all,6,23);
    await saveWorkbook(wb,'OPEX_FY_Budget_2027_All_Departments_All_Rows.xlsx');
  }catch(error){alert('OPEX admin export failed: '+(error?.message||error))}finally{btn.disabled=false;btn.textContent=old}
}

async function exportCapex(btn){
  const old=btn.textContent;btn.disabled=true;btn.textContent='Preparing CAPEX Excel...';
  try{
    if(typeof ExcelJS==='undefined')throw new Error('Excel export engine is still loading.');
    const [baselineMetaSnap,baselineSnap,capexSnap]=await Promise.all([getDoc(doc(db,'opex_baseline_meta','current')),getDocs(collection(db,'opex_baseline_departments')),getDocs(collection(db,'capex_budget_submissions'))]),capexMap=new Map(),nameMap=new Map();capexSnap.forEach(record=>capexMap.set(record.id,record.data()||{}));baselineSnap.forEach(record=>nameMap.set(record.id,clean(record.data()?.name)||record.id));
    const metaData=baselineMetaSnap.exists()?(baselineMetaSnap.data()||{}):{},orderedIds=[...(Array.isArray(metaData.departments)?metaData.departments.map(clean).filter(Boolean):[])];baselineSnap.forEach(record=>{if(!orderedIds.includes(record.id))orderedIds.push(record.id)});capexSnap.forEach(record=>{if(!orderedIds.includes(record.id))orderedIds.push(record.id)});
    const departments=orderedIds.map(cc=>{const meta=capexMap.get(cc)||{},approved=workflow(meta)==='approved',raw=approved&&Array.isArray(meta.rows)?meta.rows:[],payments=approved&&Array.isArray(meta.payments)?meta.payments:[],lines=raw.map((row,index)=>{const months=MONTHS.map((_,i)=>num(row?.months?.[i])),total=months.reduce((sum,value)=>sum+value,0);return{...row,requestId:clean(row?.requestId)||`${cc}-CAPEX-${String(index+1).padStart(3,'0')}`,months,total}});return{cc,name:clean(meta.departmentName||lines[0]?.department||nameMap.get(cc)||cc),lines,payments,total:lines.reduce((sum,line)=>sum+line.total,0),paymentTotal:payments.reduce((sum,p)=>sum+num(p.amount),0),meta}});
    if(!departments.length)throw new Error('No CAPEX departments were found.');
    const wb=new ExcelJS.Workbook();wb.creator='DAD Budget 2027';wb.created=new Date();
    const summary=wb.addWorksheet('Summary');summary.addRow(['Fund Center','Department','CAPEX Requests','FY CAPEX 2027','Scheduled Payments','Status','Revision','Submitted By','Submitted At','Source File']);departments.forEach(d=>summary.addRow([d.cc,d.name,d.lines.length,d.total,d.paymentTotal,workflow(d.meta),num(d.meta.revision),clean(d.meta.submittedEmail),dateText(d.meta.submittedAt)||clean(d.meta.clientSubmittedAt),clean(d.meta.fileName)]));styleSheet(summary,[18,34,16,20,20,20,11,28,22,38]);moneyColumns(summary,4,5);
    const headers=['Request ID','Company','Fund Center','Department','Asset Category','Budget Description','Justification','Priority','Quantity',...MONTHS,'Q1 2027','Q2 2027','Q3 2027','Q4 2027','FY CAPEX 2027','Status','Revision','Submitted By','Source File'];
    const widths=[22,18,18,32,28,42,42,14,12,...Array(12).fill(13),16,16,16,16,20,20,11,28,38];
    const all=wb.addWorksheet('All CAPEX');all.addRow(headers);
    departments.forEach(d=>{
      const sourceLines=d.lines.length?d.lines:[{requestId:'',months:Array(12).fill(0),total:0}],rows=sourceLines.map(line=>{const q1=line.months.slice(0,3).reduce((s,v)=>s+v,0),q2=line.months.slice(3,6).reduce((s,v)=>s+v,0),q3=line.months.slice(6,9).reduce((s,v)=>s+v,0),q4=line.months.slice(9,12).reduce((s,v)=>s+v,0);return[clean(line.requestId),clean(line.company),d.cc,d.name,clean(line.category),clean(line.description),clean(line.justification),clean(line.priority),num(line.quantity),...line.months,q1,q2,q3,q4,line.total,workflow(d.meta),num(d.meta.revision),clean(d.meta.submittedEmail),clean(d.meta.fileName)]});
      rows.forEach(row=>all.addRow(row));
    });
    styleSheet(all,widths);moneyColumns(all,10,26);
    const paymentSheet=wb.addWorksheet('Payment Schedule');paymentSheet.addRow(['Fund Center','Department','Asset Category','Budget Description','FY CAPEX 2027',...MONTHS,'Q1 Payments','Q2 Payments','Q3 Payments','Q4 Payments','FY 2027 Payments','2028','Total Payments','Remaining','Workflow Status','Revision','Source File']);departments.forEach(d=>d.lines.forEach(line=>{const requestPayments=d.payments.filter(p=>clean(p.requestId)===clean(line.requestId)),months=Array(12).fill(0);requestPayments.filter(p=>clean(p.expectedPaymentDate).startsWith('2027-')).forEach(p=>{const month=Number(clean(p.expectedPaymentDate).slice(5,7))-1;if(month>=0&&month<12)months[month]+=num(p.amount)});const quarters=[months.slice(0,3),months.slice(3,6),months.slice(6,9),months.slice(9,12)].map(a=>a.reduce((s,v)=>s+v,0)),paid2027=months.reduce((s,v)=>s+v,0),paid2028=requestPayments.filter(p=>clean(p.expectedPaymentDate).startsWith('2028-')).reduce((s,p)=>s+num(p.amount),0),paid=paid2027+paid2028;paymentSheet.addRow([d.cc,d.name,clean(line.category),clean(line.description),num(line.total),...months,...quarters,paid2027,paid2028,paid,num(line.total)-paid,workflow(d.meta),num(d.meta.revision),clean(d.meta.fileName)])}));styleSheet(paymentSheet,[18,32,28,42,18,...Array(12).fill(13),16,16,16,16,18,16,18,18,20,11,38]);moneyColumns(paymentSheet,5,25);
    await saveWorkbook(wb,'CAPEX_FY_Budget_2027_All_Departments_All_Rows.xlsx');
  }catch(error){alert('CAPEX admin export failed: '+(error?.message||error))}finally{btn.disabled=false;btn.textContent=old}
}

function addButton(page){
  if(document.getElementById('adminAllDepartmentsExport'))return;
  const parent=page==='opex'?document.querySelector('.toolbar-actions'):document.querySelector('.actions');if(!parent)return;
  const btn=document.createElement('button');btn.id='adminAllDepartmentsExport';btn.type='button';btn.className=page==='opex'?'ghost-btn':'download-btn';btn.textContent=page==='opex'?'Download All OPEX Data':'Download All CAPEX Data';btn.title='Main Admin only · all departments and all rows in the original order';btn.addEventListener('click',()=>page==='opex'?exportOpex(btn):exportCapex(btn));
  const upload=page==='opex'?document.getElementById('opexUploadBtn'):document.getElementById('uploadBtn');parent.insertBefore(btn,upload||null);
}

async function run(user){
  if(!user)return;
  const profile=await getDoc(doc(db,'users',user.uid)),data=profile.exists()?profile.data():{};
  if(user.uid!==MAIN_ADMIN_UID&&data.isMainAdmin!==true)return;
  const page=(location.pathname.split('/').pop()||'').toLowerCase();if(page==='opex.html'||page==='capex.html')addButton(page.slice(0,-5));
}

onAuthStateChanged(auth,user=>{if(user)run(user).catch(error=>console.error('Admin export setup failed:',error))});
window.addEventListener('dad-user-ready',event=>{const user=event.detail?.user||auth.currentUser;if(user)run(user).catch(error=>console.error('Admin export setup failed:',error))});
