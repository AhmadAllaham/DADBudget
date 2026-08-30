(function(){
'use strict';
const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',DIR_DOC='department_directory_fy2027',SESSION_KEY='dadBudgetDirectoryRepairV2';
const clean=v=>String(v??'').trim();
let inFlight=false;
function bytesFromBase64(text){const binary=atob(text||''),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out}
async function payloadName(data,cc){
  const direct=clean(data?.name||data?.departmentName);if(direct&&direct!==cc)return direct;
  try{
    if(data?.encoding==='json-v1')return clean(JSON.parse(data.payload||'{}')?.name)||direct||cc;
    if(data?.encoding==='gzip-base64-v1'&&typeof DecompressionStream!=='undefined'){
      const stream=new Blob([bytesFromBase64(data.payload||'')]).stream().pipeThrough(new DecompressionStream('gzip'));
      const decoded=JSON.parse(await new Response(stream).text());return clean(decoded?.name)||direct||cc;
    }
  }catch(e){console.warn('Department name decode failed',cc,e)}
  return direct||cc;
}
async function repair(user,profile={}){
  if(!user||user.uid!==MAIN||inFlight||sessionStorage.getItem(SESSION_KEY)==='1')return;
  const api=window.DADFirebase;if(!api?.db)return;inFlight=true;
  try{
    const f=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');
    const [metaSnap,dirSnap]=await Promise.all([
      f.getDoc(f.doc(api.db,'opex_baseline_meta','current')),
      f.getDoc(f.doc(api.db,'system_status',DIR_DOC))
    ]);
    const expected=Math.max(0,Number(metaSnap.data()?.departmentCount||0)),sharedCount=Math.max(0,Number(dirSnap.data()?.departmentCount||0)),metaDirectory=Array.isArray(metaSnap.data()?.departmentDirectory)?metaSnap.data().departmentDirectory:[];
    if(expected&&metaDirectory.length>=expected&&sharedCount>=expected){sessionStorage.setItem(SESSION_KEY,'1');return}
    const snap=await f.getDocs(f.collection(api.db,'opex_baseline_departments'));
    if(!snap.docs.length)return;
    const directory=[];
    for(const docSnap of snap.docs){
      const cc=clean(docSnap.id);if(!cc||cc==='16')continue;
      directory.push({cc,name:await payloadName(docSnap.data()||{},cc)});
    }
    directory.sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}));
    const ids=directory.map(x=>x.cc);
    await Promise.all([
      f.setDoc(f.doc(api.db,'system_status',DIR_DOC),{fiscalYear:2027,departmentCount:directory.length,directory,source:'Canonical Finance OPEX baseline',updatedBy:user.uid,updatedByEmail:clean(user.email||profile.email).toLowerCase(),updatedAt:f.serverTimestamp(),clientUpdatedAt:new Date().toISOString()},{merge:false}),
      f.setDoc(f.doc(api.db,'opex_baseline_meta','current'),{departments:ids,departmentDirectory:directory,departmentCount:directory.length,directoryUpdatedAt:f.serverTimestamp()},{merge:true})
    ]);
    sessionStorage.setItem(SESSION_KEY,'1');
    window.dispatchEvent(new CustomEvent('dad-department-directory-repaired',{detail:{count:directory.length}}));
    console.info(`Department directory repaired from Finance OPEX baseline · ${directory.length} Fund Centers`);
  }finally{inFlight=false}
}
window.addEventListener('dad-user-ready',e=>repair(e.detail?.user||window.DADFirebase?.auth?.currentUser,e.detail?.profile||{}).catch(err=>console.warn('Department directory repair failed',err)));
window.addEventListener('dad-firebase-ready',()=>{const user=window.DADFirebase?.auth?.currentUser;if(user)repair(user,{}).catch(err=>console.warn('Department directory repair failed',err))});
})();
if(/index\.html$|\/$/i.test((location.pathname||'/').split('?')[0]))import('./rd-group-access-sync.js?v=20260830-medical-manager-1').catch(e=>console.warn('Manager access sync failed',e));
