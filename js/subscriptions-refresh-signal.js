import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
let busy=false,last='';

async function publish(cc){
  cc=clean(cc);if(!cc||busy||!auth.currentUser)return;
  const key=`${cc}:${Date.now()}`;if(key===last)return;last=key;busy=true;
  try{
    await setDoc(doc(db,'system_status','subscription_budget_refresh_fy2027'),{
      cc,
      fiscalYear:2027,
      changedBy:auth.currentUser.uid,
      changedByEmail:clean(auth.currentUser.email).toLowerCase(),
      changedAt:serverTimestamp(),
      clientChangedAt:new Date().toISOString()
    },{merge:false});
  }catch(e){console.warn('Subscriptions refresh signal skipped',e)}finally{busy=false}
}

window.addEventListener('dad-subscriptions-updated',e=>publish(e.detail?.cc));
