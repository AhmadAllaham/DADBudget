(function(){
'use strict';

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CACHE_KEY='dadBudgetSubscriptionsSimpleCacheV1';
const clean=v=>String(v??'').trim();
const num=v=>{
  if(typeof v==='number'&&Number.isFinite(v))return v;
  let s=clean(v).replace(/,/g,'');
  if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
  const n=Number(s);
  return Number.isFinite(n)?n:0;
};
const monthKey=i=>`2027-${String(i+1).padStart(2,'0')}`;

function indexOfHeader(headers,names){
  const wanted=(Array.isArray(names)?names:[names]).map(x=>clean(x).toLowerCase());
  return headers.findIndex(x=>wanted.includes(clean(x).toLowerCase()));
}
function readCachedPlan(cc){
  try{
    const cache=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'{}')||{};
    return cache[`plan:${cc}`]?.value||null;
  }catch(_){return null}
}
function sourceRowMap(headers,row){
  const get=names=>{
    const i=indexOfHeader(headers,names);
    return i>=0?row[i]:'';
  };
  return {
    cc:clean(get('Fund Center')),
    departmentName:clean(get('Department')),
    gl:clean(get('G/L Account')),
    accountName:clean(get('Subscription Account')),
    details:clean(get(['Item Details / شرح البند','Details','Item Details','شرح البند'])),
    landing:num(get('Landing')),
    months:Object.fromEntries(MONTHS.map((m,i)=>[monthKey(i),num(get(m))]))
  };
}
function buildBudgetRows(sourceHeaders,sourceRows,cc){
  const source=sourceRows.map(r=>sourceRowMap(sourceHeaders,r)).filter(r=>r.cc&&r.gl);
  const sourceByGl=new Map(source.map(r=>[r.gl,r]));
  const plan=readCachedPlan(cc);
  const planRows=Array.isArray(plan?.rows)?plan.rows:[];
  const rows=[];

  planRows.forEach(r=>{
    const gl=clean(r?.gl);
    if(!gl)return;
    const base=sourceByGl.get(gl)||{};
    const months=Object.fromEntries(MONTHS.map((_,i)=>[monthKey(i),num(r?.newBudgetByMonth?.[monthKey(i)])]));
    rows.push({
      cc:clean(r?.cc||cc||base.cc),
      departmentName:clean(r?.departmentName||base.departmentName),
      gl,
      accountName:clean(r?.accountName||base.accountName||gl),
      details:clean(r?.details),
      landing:num(r?.landing),
      months
    });
  });

  const represented=new Set(rows.map(r=>r.gl));
  source.forEach(r=>{
    if(represented.has(r.gl))return;
    rows.push({...r,details:r.details||'',months:{...r.months}});
  });

  return rows;
}
function makeBudgetSheet(sourceHeaders,sourceRows,cc){
  const headers=['Fund Center','Department','G/L Account','Subscription Account','Item Details / شرح البند','Landing',...MONTHS,'FY Budget 2027'];
  const detailed=buildBudgetRows(sourceHeaders,sourceRows,cc);
  const data=detailed.map(r=>[
    r.cc,r.departmentName,r.gl,r.accountName,r.details,r.landing,
    ...MONTHS.map((_,i)=>num(r.months?.[monthKey(i)])),0
  ]);
  const ws=XLSX.utils.aoa_to_sheet([headers,...data]);
  const lastRow=Math.max(2,data.length+1);
  for(let row=2;row<=lastRow;row++){
    const fy=XLSX.utils.encode_cell({r:row-1,c:18});
    ws[fy]={t:'n',f:`SUM(G${row}:R${row})`};
  }
  ws['!cols']=[14,32,14,38,48,15,...Array(12).fill(12),17].map(w=>({wch:w}));
  ws['!autofilter']={ref:`A1:S${lastRow}`};
  ws['!freeze']={xSplit:5,ySplit:1};
  return ws;
}
function makeReferenceSheet(sourceHeaders,sourceRows){
  const end=indexOfHeader(sourceHeaders,'FY Budget 2026');
  const stop=end>=0?end:sourceHeaders.length-1;
  const headers=sourceHeaders.slice(0,stop+1);
  const data=sourceRows.map(r=>headers.map((_,i)=>r[i]??''));
  const ws=XLSX.utils.aoa_to_sheet([headers,...data]);
  const lastRow=Math.max(2,data.length+1),lastCol=XLSX.utils.encode_col(Math.max(0,headers.length-1));
  ws['!cols']=headers.map((h,i)=>({wch:i===1?32:i===3?38:i===4?48:17}));
  ws['!autofilter']={ref:`A1:${lastCol}${lastRow}`};
  ws['!freeze']={xSplit:5,ySplit:1};
  return ws;
}
function transformWorkbook(wb){
  if(!wb?.SheetNames?.length||wb.SheetNames.includes('Budget 2027'))return wb;
  const sourceName=wb.SheetNames.find(n=>/^subscriptions$/i.test(clean(n)))||wb.SheetNames[0];
  const sourceSheet=wb.Sheets[sourceName];
  if(!sourceSheet)return wb;
  const matrix=XLSX.utils.sheet_to_json(sourceSheet,{header:1,defval:'',raw:true});
  if(!matrix.length)return wb;
  const headers=matrix[0]||[],rows=matrix.slice(1);
  if(indexOfHeader(headers,'Fund Center')<0||indexOfHeader(headers,'G/L Account')<0||indexOfHeader(headers,'FY Budget 2026')<0)return wb;
  const cc=clean(document.getElementById('subscriptionDept')?.value);
  if(!cc||cc==='ALL')return wb;
  const out=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(out,makeBudgetSheet(headers,rows,cc),'Budget 2027');
  XLSX.utils.book_append_sheet(out,makeReferenceSheet(headers,rows),'OPEX Reference');
  return out;
}
function install(){
  if(!window.XLSX?.writeFile||window.XLSX.__dadSubscriptionsTwoSheet)return false;
  const original=window.XLSX.writeFile.bind(window.XLSX);
  window.XLSX.writeFile=function(wb,filename,opts){
    try{
      if(/subscriptions\.html$/i.test((location.pathname||'').split('?')[0]))wb=transformWorkbook(wb);
    }catch(e){console.warn('Subscriptions two-sheet workbook fallback',e)}
    return original(wb,filename,opts);
  };
  window.XLSX.__dadSubscriptionsTwoSheet=true;
  return true;
}
if(!install()){
  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer)},50);
}
})();
