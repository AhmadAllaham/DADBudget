import {doc,getDoc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
const api=()=>window.DADFirebase,page=window.DADCapexPage;
let revision=0,started=false,busy=false;
const ref=()=>doc(api().db,'tunis_budget','capex_2027');
const status=(s,error=false)=>page.setStatus(s,error);
function unpack(raw){
  return (raw||[]).map((r,i)=>{
    const months=Array.isArray(r.months)&&r.months.length===12?r.months.map(Number):Array(12).fill(0);
    if(months.some(v=>!Number.isFinite(v)||v<0))throw Error('Saved CAPEX amounts need correction. No data was changed.');
    const quarters=[0,3,6,9].map(m=>months.slice(m,m+3).reduce((s,v)=>s+v,0));
    return {...r,requestId:r.requestId||r.code||`TUNIS-CAPEX-${i+1}`,company:'Tunis',cc:'TUNIS',department:'Tunis',category:r.category||'',description:r.description||'',months,q1:quarters[0],q2:quarters[1],q3:quarters[2],q4:quarters[3],total:quarters.reduce((s,v)=>s+v,0),workflowLabel:'Saved',payments:r.payments||[]};
  });
}
async function start(){
  if(started||!api()?.auth.currentUser)return;started=true;
  try{const p=await api().getUserProfile(api().auth.currentUser.uid),modules=Array.isArray(p?.modules)?p.modules:[];if(!p||p.enabled===false||!(p.isMainAdmin===true||modules.includes('tunis')))throw Error('DAD Tunis permission is required.');const snapshot=await getDoc(ref()),data=snapshot.exists()?snapshot.data():null,rows=unpack(data?.rows);revision=data?.revision||0;page.saveRows(rows);page.savePayments(rows.flatMap(r=>r.payments));page.render();status(rows.length?'Saved Tunis CAPEX loaded.':'Download the Tunis template to enter your CAPEX budget.');
    window.DADCapexCloud={saveSubmission:async parsed=>{
      if(busy)throw Error('A save is already in progress.');if(parsed.cc!=='TUNIS')throw Error('Upload a Tunis workbook only.');if(parsed.rows.length>500)throw Error('Use at most 500 CAPEX requests.');
      busy=true;document.getElementById('uploadBtn').disabled=true;
      try{const packed=parsed.rows.map(row=>({...row,payments:parsed.payments.filter(p=>p.requestId===row.requestId)})),total=packed.reduce((s,r)=>s+Number(r.total),0);
        if(!Number.isFinite(total)||total<0)throw Error('Invalid CAPEX total.');
        await runTransaction(api().db,async tx=>{const current=await tx.get(ref());if((current.exists()?current.data().revision||0:0)!==revision)throw Error('Another session updated Tunis CAPEX. Reload this page before uploading again.');tx.set(ref(),{fiscalYear:2027,scope:'tunis_standalone',budgetType:'capex',sector:'CAPEX',currency:'JOD',rows:packed,total,revision:revision+1,updatedBy:api().auth.currentUser.uid,updatedAt:serverTimestamp()});});revision++;return revision;
      }finally{busy=false;document.getElementById('uploadBtn').disabled=false}
    }};document.getElementById('uploadBtn').disabled=false;document.getElementById('downloadTemplate').disabled=false;
  }catch(error){status(error.message,true);started=false;}
}
window.addEventListener('dad-user-ready',start);start();