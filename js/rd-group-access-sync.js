import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,query,where,getDocs,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const MANAR_EMAIL='manar.alasaad@dadgroup.com';
const GROUP_VALUE='GROUP:RD_ANALYTICAL';
const GROUP_IDS=['1000401101','1000401105','1000401106'];
const GROUP_NAMES={
 '1000401101':'Research & Development Department',
 '1000401105':'Analytical Research Department',
 '1000401106':'Packaging Development Department'
};
const OPEX_KEY='dadBudgetOPEXBaselineV17';
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
const email=v=>clean(v).toLowerCase();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>Math.abs(num(v))<.005?'—':num(v).toLocaleString(undefined,{maximumFractionDigits:0});

function departmentsOf(profile={}){
 const list=Array.isArray(profile.departments)?profile.departments.map(clean).filter(Boolean):[];
 if(profile.department&&!list.includes(clean(profile.department)))list.push(clean(profile.department));
 return list;
}
function writeCachedProfile(profile,user){
 try{
  const cached=JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'{}')||{};
  localStorage.setItem('dadBudgetCurrentProfile',JSON.stringify({...cached,...profile,uid:user.uid,email:email(profile.email||user.email)}));
 }catch(_){}
}
function localManarUid(){
 try{
  const rows=JSON.parse(localStorage.getItem('dadBudgetUserProfiles')||'[]')||[];
  return clean(rows.find(x=>email(x?.email)===MANAR_EMAIL)?.uid);
 }catch(_){return''}
}
async function currentProfile(user){
 const snap=await getDoc(doc(db,'users',user.uid));
 return snap.exists()?snap.data()||{}:{};
}
async function findManarProfile(){
 try{
  const exact=await getDocs(query(collection(db,'users'),where('email','==',MANAR_EMAIL)));
  if(!exact.empty)return exact.docs[0];
 }catch(error){console.warn('R&D group exact email lookup failed',error)}
 const rememberedUid=localManarUid();
 if(rememberedUid){
  try{const remembered=await getDoc(doc(db,'users',rememberedUid));if(remembered.exists())return remembered}catch(error){console.warn('R&D group saved UID lookup failed',error)}
 }
 const all=await getDocs(collection(db,'users'));
 const byEmail=all.docs.find(x=>email(x.data()?.email)===MANAR_EMAIL);
 if(byEmail)return byEmail;
 const candidates=all.docs.filter(x=>{
  const deps=departmentsOf(x.data()||{});
  return deps.includes('1000401101')&&deps.includes('1000401105');
 });
 return candidates.length===1?candidates[0]:null;
}
async function ensureManarGroupAccess(user,profile){
 const isMainAdmin=user.uid===MAIN_ADMIN_UID||profile?.isMainAdmin===true;
 if(!isMainAdmin)return false;
 const userDoc=await findManarProfile();
 if(!userDoc){
  console.warn('R&D group access sync: Manar profile was not uniquely found.');
  try{sessionStorage.setItem('dadBudgetRdGroupSyncStatus','profile-not-found')}catch(_){}
  return false;
 }
 const data=userDoc.data()||{},current=departmentsOf(data),merged=[...new Set([...current,...GROUP_IDS])];
 await setDoc(doc(db,'users',userDoc.id),{
  email:email(data.email)||MANAR_EMAIL,
  department:clean(data.department)||merged[0]||GROUP_IDS[0],
  departments:merged,
  rdAnalyticalPackagingGroup:true,
  rdGroupFundCenters:GROUP_IDS,
  rdGroupUpdatedAt:serverTimestamp(),
  rdGroupUpdatedBy:user.uid
 },{merge:true});
 try{
  const rows=JSON.parse(localStorage.getItem('dadBudgetUserProfiles')||'[]')||[],i=rows.findIndex(x=>x.uid===userDoc.id||email(x.email)===MANAR_EMAIL);
  const patched={...(i>=0?rows[i]:{}),uid:userDoc.id,email:MANAR_EMAIL,departments:merged,department:clean(data.department)||merged[0]};
  if(i>=0)rows[i]=patched;else rows.push(patched);
  localStorage.setItem('dadBudgetUserProfiles',JSON.stringify(rows));
  sessionStorage.setItem('dadBudgetRdGroupSyncStatus',`ok:${userDoc.id}:${merged.join(',')}`);
 }catch(_){}
 console.info('R&D group access synced for Manar:',userDoc.id,merged.join(', '));
 return true;
}

function localOpexModel(){
 try{const m=JSON.parse(localStorage.getItem(OPEX_KEY)||'null');return m?.departments?m:null}catch(_){return null}
}
function selectedRange(){
 let from=clean(document.getElementById('dateFrom')?.value)||'2026-01',to=clean(document.getElementById('dateTo')?.value)||'2026-12';
 if(from>to)[from,to]=[to,from];
 return{from,to};
}
function sumPeriod(map,from,to){
 let total=0;
 Object.entries(map||{}).forEach(([key,value])=>{if(key>=from&&key<=to)total+=num(value)});
 return total;
}
function departmentYtd(department){
 const {from,to}=selectedRange();let budget=0,actual=0;
 Object.values(department?.items||{}).forEach(item=>{
  budget+=sumPeriod(item?.budgetByMonth,from,to);
  const actualMap=item?.actualByMonth||{};
  actual+=sumPeriod(actualMap,from,to)+(Object.keys(actualMap).length?0:num(item?.actualUnperiodized));
 });
 return{budget,actual};
}
function ensureSummaryStyle(){
 if(document.getElementById('rdGroupYtdStyle'))return;
 const style=document.createElement('style');style.id='rdGroupYtdStyle';style.textContent=`
 .rd-group-ytd{display:none;margin:0 0 12px;overflow:hidden;border:1px solid #d8e9e6;border-radius:14px;background:linear-gradient(145deg,#fff,#f7fbfa);box-shadow:0 8px 22px rgba(20,67,70,.05)}
 .rd-group-ytd.show{display:block}.rd-group-ytd-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 16px;border-bottom:1px solid #e0ecea}.rd-group-ytd-head b{font-size:14px;color:#173f47}.rd-group-ytd-head span{font-size:10px;font-weight:850;color:#72878b}.rd-group-ytd table{width:100%;border-collapse:collapse;font-size:12px}.rd-group-ytd th{padding:9px 12px;background:#f3f9f8;color:#667f84;text-align:right;font-size:9px;font-weight:1000;text-transform:uppercase}.rd-group-ytd th:first-child,.rd-group-ytd td:first-child{text-align:left}.rd-group-ytd td{padding:10px 12px;border-top:1px solid #e8f0ef;text-align:right;font-weight:800;color:#314d52;font-variant-numeric:tabular-nums}.rd-group-ytd td b{display:block;color:#173f47}.rd-group-ytd td small{display:block;margin-top:2px;color:#8a999c;font-size:9px}.rd-group-ytd .actual{color:#0a746d;font-weight:1000}.rd-group-ytd .budget{color:#173f68;font-weight:1000}.rd-group-ytd .rd-total td{background:#0a3568;color:#fff!important;font-weight:1000;border-top:0}
 `;document.head.appendChild(style)
}
function ensureSummaryPanel(){
 ensureSummaryStyle();let panel=document.getElementById('rdGroupYtdSummary');if(panel)return panel;
 const kpis=document.querySelector('.kpi-strip');if(!kpis)return null;
 panel=document.createElement('section');panel.id='rdGroupYtdSummary';panel.className='rd-group-ytd';panel.innerHTML='<div class="rd-group-ytd-head"><div><b>R&D Group YTD Summary</b><span id="rdGroupYtdPeriod"></span></div><span>Budget YTD vs Actual YTD</span></div><table><thead><tr><th>Department</th><th>Budget YTD</th><th>Actual YTD</th></tr></thead><tbody id="rdGroupYtdBody"></tbody></table>';
 kpis.insertAdjacentElement('afterend',panel);return panel;
}
function renderGroupYtdSummary(){
 const panel=ensureSummaryPanel(),select=document.getElementById('deptFilter');if(!panel||!select)return;
 if(clean(select.value)!==GROUP_VALUE){panel.classList.remove('show');return}
 const model=localOpexModel();if(!model?.departments){panel.classList.remove('show');return}
 const rows=GROUP_IDS.map(cc=>({cc,department:model.departments?.[cc]})).filter(x=>x.department).map(x=>({...x,...departmentYtd(x.department)}));
 if(!rows.length){panel.classList.remove('show');return}
 let totalBudget=0,totalActual=0;rows.forEach(x=>{totalBudget+=x.budget;totalActual+=x.actual});
 const body=document.getElementById('rdGroupYtdBody');body.innerHTML=rows.map(x=>`<tr><td><b>${clean(x.department?.name||GROUP_NAMES[x.cc]||x.cc)}</b><small>${x.cc}</small></td><td class="budget">${money(x.budget)}</td><td class="actual">${money(x.actual)}</td></tr>`).join('')+`<tr class="rd-total"><td>TOTAL</td><td>${money(totalBudget)}</td><td>${money(totalActual)}</td></tr>`;
 const {from,to}=selectedRange(),period=document.getElementById('rdGroupYtdPeriod');if(period)period.textContent=`${from} → ${to}`;
 panel.classList.add('show')
}
function bindGroupYtdSummary(){
 ensureSummaryPanel();const select=document.getElementById('deptFilter'),from=document.getElementById('dateFrom'),to=document.getElementById('dateTo');
 if(select&&!select.dataset.rdYtdBound){select.dataset.rdYtdBound='1';select.addEventListener('change',()=>setTimeout(renderGroupYtdSummary,20))}
 if(from&&!from.dataset.rdYtdBound){from.dataset.rdYtdBound='1';from.addEventListener('change',()=>setTimeout(renderGroupYtdSummary,20))}
 if(to&&!to.dataset.rdYtdBound){to.dataset.rdYtdBound='1';to.addEventListener('change',()=>setTimeout(renderGroupYtdSummary,20))}
 ['dad-opex-cloud-ready','dad-opex-refresh-departments','dad-rd-group-access-ready'].forEach(name=>window.addEventListener(name,()=>setTimeout(renderGroupYtdSummary,60)));
 setTimeout(renderGroupYtdSummary,250)
}

async function run(user){
 if(!user)return;
 try{
  const profile=await currentProfile(user);
  writeCachedProfile(profile,user);
  const synced=await ensureManarGroupAccess(user,profile);
  if(synced)window.dispatchEvent(new CustomEvent('dad-rd-group-admin-sync-complete'));
  if(email(user.email)===MANAR_EMAIL||email(profile.email)===MANAR_EMAIL){
   const fresh=await currentProfile(user);
   writeCachedProfile(fresh,user);
   window.dispatchEvent(new CustomEvent('dad-rd-group-access-ready',{detail:{departments:departmentsOf(fresh)}}));
  }
  bindGroupYtdSummary();
 }catch(error){
  console.warn('R&D group access sync failed',error);
  try{sessionStorage.setItem('dadBudgetRdGroupSyncStatus',`error:${error.code||error.message||error}`)}catch(_){}
  bindGroupYtdSummary();
 }
}
onAuthStateChanged(auth,run);
window.addEventListener('load',()=>setTimeout(bindGroupYtdSummary,250));
