(function(){
  let rows=[],payments=[];
  const $=id=>document.getElementById(id);
  const categories=['Buildings','Machinery & Equipment','Tools','Laboratory equipments','Computers & Printers','Computer software','Fixtures and Furniture','Vehicles'];
  categories.forEach(v=>$('categoryFilter').add(new Option(v,v)));['High','Medium','Low'].forEach(v=>$('priorityFilter').add(new Option(v,v)));
  $('deptFilter').disabled=true;
  window.DADCapexConfig={standalone:true,company:'Tunis',departments:{TUNIS:{cc:'TUNIS',name:'Tunis'}},loadPayments:()=>payments,savePayments:value=>{payments=value},validateWorkbook:wb=>{
    const number=v=>v===''?0:Number(String(v).replace(/,/g,'')),norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const sheet=wb.SheetNames.find(n=>norm(n)==='CAPEXBUDGET2027');if(!sheet)throw Error('Use the Tunis CAPEX template.');
    const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:true}),header=matrix[0],index=name=>header.findIndex(v=>norm(v)===norm(name));
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if(['Fund Center','Budget Description','Asset Category','Quantity',...months].some(n=>index(n)<0))throw Error('CAPEX headers are incomplete. Use the Tunis template.');
    for(const [i,r] of matrix.slice(1).entries()){if(!r[index('Budget Description')]&&!r[index('Asset Category')])continue;if(r[index('Fund Center')]!=='TUNIS')throw Error('Upload a Tunis workbook only.');if(!String(r[index('Budget Description')]||'').trim()||!categories.includes(r[index('Asset Category')]))throw Error(`Row ${i+2}: enter a description and select an approved asset category.`);for(const name of ['Quantity',...months])if(!Number.isFinite(number(r[index(name)]))||number(r[index(name)])<0)throw Error(`Row ${i+2}: ${name} must be a non-negative number.`);}
    const ps=wb.Sheets['Payment Schedule'];if(!ps)throw Error('Payment Schedule is required.');const pm=XLSX.utils.sheet_to_json(ps,{header:1,defval:'',raw:true}),ph=pm[0]||[];
    for(const r of pm.slice(1))for(const m of [...months,'2028']){const i=ph.findIndex(v=>norm(v)===norm(m));if(i<0)throw Error('Use the current monthly Payment Schedule.');if(!Number.isFinite(number(r[i]))||number(r[i])<0)throw Error('Payment amounts must be non-negative numbers.');}
  }};
  window.DADCapexPage={loadRows:()=>rows,saveRows:value=>{rows=value},render:()=>{},setStatus:(message,error=false)=>{const el=$('capexStatus');el.textContent=message;el.title=message;el.classList.toggle('error',error);el.classList.toggle('ready',!error)}};
})();
