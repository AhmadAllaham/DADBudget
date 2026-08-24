import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
let checked=false;

function modulesOf(profile={}){return Array.isArray(profile.modules)?profile.modules:[]}
function isAllowed(user,profile={}){return user?.uid===MAIN||modulesOf(profile).includes('hr')}

async function check(user){
  if(checked||!user)return;
  checked=true;
  try{
    const app=getApps()[0],db=getFirestore(app),snap=await getDoc(doc(db,'users',user.uid)),profile=snap.exists()?snap.data()||{}:{};
    if(!isAllowed(user,profile)){
      location.replace('index.html');
      return;
    }
    document.documentElement.dataset.hrSalariesAllowed='1';
    window.dispatchEvent(new CustomEvent('dad-hr-salaries-access-ready',{detail:{allowed:true}}));
  }catch(error){
    console.warn('HR Salaries access check failed',error);
    location.replace('index.html');
  }
}

const app=getApps()[0],auth=getAuth(app);
if(auth.currentUser)check(auth.currentUser);
onAuthStateChanged(auth,user=>{if(user)check(user)});
window.addEventListener('dad-user-ready',e=>check(e.detail?.user||auth.currentUser));
