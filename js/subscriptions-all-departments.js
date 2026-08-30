import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,collection,query,orderBy,startAt,endAt,documentId} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',authDomain:'budget-8c575.firebaseapp.com',projectId:'budget-8c575',storageBucket:'budget-8c575.firebasestorage.app',messagingSenderId:'990142203884',appId:'1:990142203884:web:5c22dc2c14855528a022c9'};
const DOC_PREFIX='subscription_budget_',CACHE_KEY='dadBudgetSubscriptionsPlansV1',CACHE_MS=10*60*1000;
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const clean=v=>String(v??'').trim();
let directory=[],busy=false,observer=null;

function fullCache(){try{const x=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null');return x&&x.scope==='all'&&Date.now()-Number(x.ts||0)<CACHE_MS?x:null}catch(_){return null}}
function saveFullCache(plans){try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),scope:'all',plans}))}catch(_){}}
async function preloadPlans(){if(fullCache())return;const q=query(collection(db,'system_status'),orderBy(documentId()),startAt(DOC_PREFIX),endAt(`${DOC_PREFIX}\uf8ff`)),s=await getDocs(q),plans={};s.docs.forEach(x=>{const cc=clean(x.id).slice(DOC_PREFIX.length);if(cc)plans[cc]=x.data()||{}});saveFullCache(plans)}
async function loadDirectory(){const s=await getDoc(doc(db,'opex_baseline_meta','current'));if(!s.exists())return[];const data=s.data()||{},raw=Array.isArray(data.departmentDirectory)?data.departmentDirectory:(Array.isArray(data.departments)?data.departments.map(cc=>({cc,name:cc})):[]);return raw.map(x=>({cc:clean(x.cc),name:clean(x.name||x.departmentName||x.cc)})).filter(x=>x.cc&&x.cc!=='16').sort((a,b)=>a.name.localeCompare(b.name)||a.cc.localeCompare(b.cc,undefined,{numeric:true}))}
function enforceAllDepartments(){const sel=document.getElementById('subscriptionDept');if(!sel||!directory.length||busy)return;busy=true;observer?.disconnect();try{const previous=clean(sel.value),existing=new Set([...sel.options].map(o=>o.value));if(!existing.has('ALL')){const all=document.createElement('option');all.value='ALL';all.textContent='All Departments';sel.insertBefore(all,sel.firstChild);existing.add('ALL')}directory.forEach(d=>{if(existing.has(d.cc))return;const o=document.createElement('option');o.value=d.cc;o.textContent=`${d.cc} · ${d.name}`;sel.appendChild(o)});if(previous&&[...sel.options].some(o=>o.value===previous))sel.value=previous;sel.disabled=false}finally{busy=false;if(observer&&document.body.contains(sel))observer.observe(sel,{childList:true,subtree:true})}}
function watchSelect(){const sel=document.getElementById('subscriptionDept');if(!sel)return false;if(!observer){observer=new MutationObserver(()=>{if(!busy)setTimeout(enforceAllDepartments,0)});observer.observe(sel,{childList:true,subtree:true})}enforceAllDepartments();return true}
async function boot(user){if(!user)return;try{await Promise.all([preloadPlans(),loadDirectory().then(x=>directory=x)]);let tries=0;const timer=setInterval(()=>{tries++;if(watchSelect()||tries>60)clearInterval(timer)},100);window.addEventListener('load',()=>setTimeout(enforceAllDepartments,250))}catch(error){console.warn('Subscriptions all-departments preload skipped',error)}}
onAuthStateChanged(auth,boot);
