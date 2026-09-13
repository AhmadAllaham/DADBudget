export const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const budgetType=value=>value==='capex'?'capex':'opex';
export const planId=type=>`${budgetType(type)}_2027`;
export const blankRow=()=>({code:'',description:'',months:Array(12).fill(0)});
export function validateRows(rows){
  if(!Array.isArray(rows)||rows.length>500)throw Error('Use at most 500 budget lines.');
  return rows.map((r,i)=>{
    const code=String(r.code||'').trim(),description=String(r.description||'').trim();
    if(code.length>80||description.length>250)throw Error(`Line ${i+1}: code or description is too long.`);
    if(!Array.isArray(r.months)||r.months.length!==12)throw Error(`Line ${i+1}: all 12 months are required.`);
    const months=r.months.map((v,m)=>{
      const n=v===''?0:Number(v);
      if(!Number.isFinite(n)||n<0||n>1e10)throw Error(`Line ${i+1}, ${MONTHS[m]}: enter a valid non-negative amount.`);
      return Math.round(n*100)/100;
    });
    if(!description&&(code||months.some(v=>v!==0)))throw Error(`Line ${i+1}: enter a description.`);
    return {code,description,months};
  }).filter(r=>r.description||r.code||r.months.some(v=>v!==0));
}
export const rowTotal=row=>row.months.reduce((s,v)=>s+Math.round(Number(v||0)*100),0)/100;
export const total=rows=>rows.reduce((s,r)=>s+Math.round(rowTotal(r)*100),0)/100;
export function payload(type,rows,revision,uid,timestamp){
  const budget=budgetType(type),clean=validateRows(rows);
  return {fiscalYear:2027,scope:'tunis_standalone',budgetType:budget,sector:budget==='opex'?'G&A':'CAPEX',currency:'JOD',rows:clean,total:total(clean),revision:revision+1,updatedBy:uid,updatedAt:timestamp};
}
