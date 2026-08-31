import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,query,where,getDocs,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const MANAR_EMAIL='manar.alasaad@dadgroup.com';
const GROUP_IDS=['1000401101','1000401104','1000401105','1000401106'];
const MEDICAL_CC='1000200105',MEDICAL_NAME='Medical Department',FORMULATION_CC='1000401104',FORMULATION_NAME='Formulation Department';
const MANAGED_IDS=[...GROUP_IDS,MEDICAL_CC];
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
const email=v=>clean(v).toLowerCase();

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
 }catch(error){console.warn('Manar exact email lookup failed',error)}
 const rememberedUid=localManarUid();
 if(rememberedUid){
  try{const remembered=await getDoc(doc(db,'users',rememberedUid));if(remembered.exists())return remembered}catch(error){console.warn('Manar saved UID lookup failed',error)}
 }
 return null;
}
async function syncApprovalRoute(adminUser,userDoc,fundCenter,departmentName){
 const managerUid=userDoc.id,assignment={fundCenter,departmentName,managerUid,managerEmail:MANAR_EMAIL,managerAssignedClientAt:new Date().toISOString()};
 await setDoc(doc(db,'budget_submission_status',fundCenter),{...assignment,managerStatus:'assigned'},{merge:true});
 const ref=doc(db,'opex_budget_submissions',fundCenter),snap=await getDoc(ref);
 if(!snap.exists())return;
 const current=snap.data()||{},workflow=clean(current.workflowStatus||current.status).toLowerCase(),hasUpload=!!clean(current.payload)||!!clean(current.fileName);
 const update={...assignment,workflowUpdatedAt:serverTimestamp()};
 if(workflow==='uploaded'&&hasUpload){
  update.workflowStatus='pending_manager';
  update.status='pending_manager';
  update.financeStatus='waiting_manager';
  update.managerStatus='pending';
 }
 await setDoc(ref,update,{merge:true});
 console.info(`${departmentName} approval route synchronized for Manar:`,managerUid,workflow||'no-status');
}
async function ensureManarGroupAccess(user,profile){
 const isMainAdmin=user.uid===MAIN_ADMIN_UID||profile?.isMainAdmin===true;
 if(!isMainAdmin)return false;
 const userDoc=await findManarProfile();
 if(!userDoc){
  console.warn('Manar access sync: profile was not found by exact email or saved UID.');
  try{sessionStorage.setItem('dadBudgetRdGroupSyncStatus','profile-not-found')}catch(_){}
  return false;
 }
 const data=userDoc.data()||{},current=departmentsOf(data),merged=[...new Set([...current,...MANAGED_IDS])];
 await setDoc(doc(db,'users',userDoc.id),{
  email:email(data.email)||MANAR_EMAIL,
  department:clean(data.department)||merged[0]||GROUP_IDS[0],
  departments:merged,
  rdAnalyticalPackagingGroup:true,
  formulationFundCenter:FORMULATION_CC,
  rdGroupFundCenters:GROUP_IDS,
  medicalApprovalFundCenter:MEDICAL_CC,
  rdGroupUpdatedAt:serverTimestamp(),
  rdGroupUpdatedBy:user.uid
 },{merge:true});
 await Promise.all([
  syncApprovalRoute(user,userDoc,MEDICAL_CC,MEDICAL_NAME),
  syncApprovalRoute(user,userDoc,FORMULATION_CC,FORMULATION_NAME)
 ]);
 try{
  const rows=JSON.parse(localStorage.getItem('dadBudgetUserProfiles')||'[]')||[],i=rows.findIndex(x=>x.uid===userDoc.id||email(x.email)===MANAR_EMAIL);
  const patched={...(i>=0?rows[i]:{}),uid:userDoc.id,email:MANAR_EMAIL,departments:merged,department:clean(data.department)||merged[0]};
  if(i>=0)rows[i]=patched;else rows.push(patched);
  localStorage.setItem('dadBudgetUserProfiles',JSON.stringify(rows));
  sessionStorage.setItem('dadBudgetRdGroupSyncStatus',`ok:${userDoc.id}:${merged.join(',')}`);
 }catch(_){}
 console.info('R&D / Medical access synced for Manar:',userDoc.id,merged.join(', '));
 return true;
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
 }catch(error){
  console.warn('R&D / Medical access sync failed',error);
  try{sessionStorage.setItem('dadBudgetRdGroupSyncStatus',`error:${error.code||error.message||error}`)}catch(_){}
 }
}
onAuthStateChanged(auth,run);
