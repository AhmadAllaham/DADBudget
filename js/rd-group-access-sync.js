import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,query,where,getDocs,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const MANAR_EMAIL='manar.alasaad@dadgroup.com';
const GROUP_IDS=['1000401101','1000401105','1000401106'];
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
async function currentProfile(user){
 const snap=await getDoc(doc(db,'users',user.uid));
 return snap.exists()?snap.data()||{}:{};
}
async function findManarProfile(){
 // Fast path first. Firestore equality is case-sensitive, so fall back to one
 // Admin-only directory read and compare the saved email case-insensitively.
 try{
  const exact=await getDocs(query(collection(db,'users'),where('email','==',MANAR_EMAIL)));
  if(!exact.empty)return exact.docs[0];
 }catch(error){console.warn('R&D group exact email lookup failed',error)}
 const all=await getDocs(collection(db,'users'));
 return all.docs.find(x=>email(x.data()?.email)===MANAR_EMAIL)||null;
}
async function ensureManarGroupAccess(user,profile){
 const isMainAdmin=user.uid===MAIN_ADMIN_UID||profile?.isMainAdmin===true;
 if(!isMainAdmin)return false;
 const userDoc=await findManarProfile();
 if(!userDoc){
  console.warn('R&D group access sync: Manar profile was not found.');
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
 try{sessionStorage.setItem('dadBudgetRdGroupSyncStatus',`ok:${merged.join(',')}`)}catch(_){}
 console.info('R&D group access synced for Manar:',merged.join(', '));
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
  console.warn('R&D group access sync failed',error);
  try{sessionStorage.setItem('dadBudgetRdGroupSyncStatus',`error:${error.code||error.message||error}`)}catch(_){}
 }
}
onAuthStateChanged(auth,run);
