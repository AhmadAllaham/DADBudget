import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,query,where,getDocs,doc,getDoc,setDoc} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const MAIN_ADMIN_UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
const MANAR_EMAIL='manar.alasaad@dadgroup.com';
const GROUP_IDS=['1000401101','1000401105','1000401106'];
const app=getApps()[0];
if(!app)throw new Error('Firebase app is not initialized');
const auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
const email=v=>clean(v).toLowerCase();

function departmentsOf(profile={}){
 const list=Array.isArray(profile.departments)?profile.departments.map(clean).filter(Boolean):[];
 if(profile.department&& !list.includes(clean(profile.department)))list.push(clean(profile.department));
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
async function ensureManarGroupAccess(user,profile){
 const isAdmin=user.uid===MAIN_ADMIN_UID||profile?.isMainAdmin===true||profile?.role==='admin';
 if(!isAdmin)return;
 const snap=await getDocs(query(collection(db,'users'),where('email','==',MANAR_EMAIL)));
 if(snap.empty){console.warn('R&D group access sync: Manar profile was not found by email.');return}
 for(const userDoc of snap.docs){
  const data=userDoc.data()||{},current=departmentsOf(data),merged=[...new Set([...current,...GROUP_IDS])];
  if(GROUP_IDS.every(cc=>current.includes(cc)))continue;
  await setDoc(doc(db,'users',userDoc.id),{departments:merged},{merge:true});
  console.info('R&D group access synced for Manar:',GROUP_IDS.join(', '));
 }
}
async function run(user){
 if(!user)return;
 try{
  const profile=await currentProfile(user);
  writeCachedProfile(profile,user);
  await ensureManarGroupAccess(user,profile);
  if(email(user.email)===MANAR_EMAIL){
   const fresh=await currentProfile(user);
   writeCachedProfile(fresh,user);
   window.dispatchEvent(new CustomEvent('dad-rd-group-access-ready',{detail:{departments:departmentsOf(fresh)}}));
  }
 }catch(error){console.warn('R&D group access sync skipped',error)}
}
onAuthStateChanged(auth,run);
