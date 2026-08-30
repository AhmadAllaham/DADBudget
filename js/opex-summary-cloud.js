import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,getDocs,doc,getDoc,query,orderBy,startAt,endAt,documentId} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2',KEY='dadBudgetOPEXBaselineV17',CACHE_TS='dadBudgetOPEXSummaryCloudReadAt',TTL=10*60*1000,SUMMARY_VERSION=3;
const clean=v=>String(v??'').trim(),num=v=>Number.isFinite(Number(v))?Number(v):0,key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const prefixQuery=prefix=>query(collection(db,'system_status'),orderBy(documentId()),startAt(prefix),endAt(`${prefix}\uf8ff`));
function bytes(s){const b=atob(s||''),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function decode(raw,id){if(!raw)return null;if(raw.encoding==='gzip-base64-v1'){if(typeof DecompressionStream==='undefined')return null;const stream=new Blob([bytes(raw.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));return{...JSON.parse(await new Response(stream).text()),cc:id,travelBudgetByGl:raw.travelBudgetByGl||{}}}if(raw.encoding==='json-v1')return{...JSON.parse(raw.payload||'{}'),cc:id,travelBudgetByGl:raw.travelBudgetByGl||{}};return{...raw,cc:id}}
async function safeDocs(ref,label){try{return await getDocs(ref)}catch(e){console.warn(`OPEX Summary ${label} read skipped`,e);return{docs:[],forEach:()=>{}}}}
async function safeDoc(ref,label){try{return await getDoc(ref)}catch(e){console.warn(`OPEX Summary ${label} read skipped`,e);return{exists:()=>false,data:()=>null}}}

function mergeSubmission(base,submitted){
 if(!base||!submitted?.items)return base;
 const out={...base,items:{...(base.items||{})}};
 Object.entries(submitted.items||{}).forEach(([raw,item])=>{
  const code=clean(item?.code||raw);if(!code||code.startsWith('604')||code.startsWith('608'))return;
  const current=out.items[code]||out.items[raw]||{code,name:clean(item?.name)||code,budgetByMonth:{},actualByMonth:{},lyByMonth:{},newBudgetByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};
  const incoming={...(item?.newBudgetByMonth||{})},has=Object.values(incoming).some(v=>Math.abs(num(v))>.00001),travel=/^60200(0[1-9]|10)$/.test(code);
  out.items[code]={...current,code:clean(current.code||code),name:clean(current.name||item?.name)||code,newBudgetByMonth:travel&&!has?{...(current.newBudgetByMonth||{})}:incoming,landing:num(item?.landing),professionalDetails:clean(item?.professionalDetails)};
  if(code!==raw)delete out.items[raw];
 });
 Object.entries(submitted.travelBudgetByGl||{}).forEach(([rawCode,months])=>{const code=clean(rawCode);if(!/^60200(0[1-9]|10)$/.test(code))return;const current=out.items[code]||{code,name:code,budgetByMonth:{},actualByMonth:{},lyByMonth:{},newBudgetByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};out.items[code]={...current,newBudgetByMonth:{...(months||{})}}});
 return out;
}
function approvedSnapshot(data={}){const items={};Object.entries(data.financeApprovedBudgetByGl||{}).forEach(([raw,months])=>{const code=clean(raw);if(code)items[code]={code,newBudgetByMonth:{...(months||{})}}});return Object.keys(items).length?{items}:null}
async function visibleSubmission(data,cc){if(clean(data?.workflowStatus).toLowerCase()==='approved')return decode(data,cc);return approvedSnapshot(data)}

function mergeLegacyUtilities(department,allocation){
 if(!department||!allocation)return department;
 const out={...department,items:{...(department.items||{})}},allocated=new Set();
 Object.entries(allocation?.items||{}).forEach(([raw,value])=>{const code=clean(value?.code||raw);if(!code.startsWith('608'))return;allocated.add(code);const current=out.items[code]||{code,name:clean(value?.name)||code,budgetByMonth:{},actualByMonth:{},lyByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};out.items[code]={...current,newBudgetByMonth:{...(value?.newBudgetByMonth||{})},landing:num(value?.landing),utilityControlled:true}});
 Object.entries(out.items).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(code.startsWith('608')&&!allocated.has(code))out.items[raw]={...item,newBudgetByMonth:{},landing:0,utilityControlled:true}});
 return out;
}
function annualMonths(total){const value=num(total);if(Math.abs(value)<.00001)return{};const cents=Math.round(value*100),base=Math.trunc(cents/12),used=base*11,out={};for(let m=1;m<=12;m++)out[`2027-${String(m).padStart(2,'0')}`]=(m===12?cents-used:base)/100;return out}
function addMonthMaps(...maps){const out={};maps.forEach(map=>Object.entries(map||{}).forEach(([month,value])=>out[month]=num(out[month])+num(value)));return out}
const IT_TARGETS={internet:'Internet and Connectivity Charges',consultation:'IT Consultation',subscriptions:'Subscriptions, Books and Magazines',licences:'Software Licenses'};
function mergeIT(department,allocation){if(!department||!allocation)return department;const out={...department,items:{...(department.items||{})}};Object.entries(IT_TARGETS).forEach(([source,targetName])=>{const value=allocation?.items?.[source]||{},target=key(targetName),found=Object.entries(out.items).find(([,item])=>key(item?.name)===target),accountCode=clean(value?.accountCode),match=found||(accountCode?[accountCode,{code:accountCode,name:targetName}]:null);if(!match)return;const[k,sourceItem]=match,current=out.items[k]||{code:clean(sourceItem?.code||k),name:clean(sourceItem?.name||targetName),budgetByMonth:{},actualByMonth:{},lyByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false},total=num(value?.total),itMonths=annualMonths(total);if(source==='subscriptions'){const departmentMonths={...(current?.departmentSubscriptionByMonth||(current?.subscriptionControlled?current?.newBudgetByMonth:{}))};out.items[k]={...current,newBudgetByMonth:addMonthMaps(departmentMonths,itMonths),departmentSubscriptionByMonth:departmentMonths,itSubscriptionAllocatedByMonth:itMonths,itControlled:true,itAllocatedTotal:total}}else out.items[k]={...current,newBudgetByMonth:itMonths,itControlled:true,itAllocatedTotal:total}});return out}
function mergeTraining(department,allocation){if(!department||!allocation)return department;const out={...department,items:{...(department.items||{})}},code='6010020',current=out.items[code]||{code,name:'Training',budgetByMonth:{},actualByMonth:{},lyByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};out.items[code]={...current,name:'Training',newBudgetByMonth:{...(allocation.trainingByMonth||annualMonths(allocation.trainingAnnual))},lndControlled:true,lndAllocatedTotal:num(allocation.trainingAnnual)};const incoming=allocation.travelByGl||{},codes=new Set([...Object.keys(incoming),...Object.entries(out.items).filter(([,item])=>item?.lndTravelAllocatedByMonth).map(([raw,item])=>clean(item?.code||raw))]);codes.forEach(c=>{if(!/^60200(0[1-9]|10)$/.test(c))return;const existing=out.items[c]||{code:c,name:c,budgetByMonth:{},actualByMonth:{},lyByMonth:{},newBudgetByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false},old=existing.lndTravelAllocatedByMonth||{},base={...(existing.newBudgetByMonth||{})};Object.entries(old).forEach(([month,value])=>base[month]=num(base[month])-num(value));const added={...(incoming[c]||{})};Object.entries(added).forEach(([month,value])=>base[month]=num(base[month])+num(value));out.items[c]={...existing,newBudgetByMonth:base,lndTravelAllocatedByMonth:added}});return out}

function isSalary(code){const n=Number(clean(code));return Number.isFinite(n)&&n>=6010001&&n<=6010031&&n!==6010020}
function salaryMonths(item){return item?.byMonth&&Object.keys(item.byMonth).length?item.byMonth:annualMonths(item?.annual)}
function combinedSalary(existingAllocation,newAllocation){const out=new Map(),add=(source,type)=>{Object.entries(source?.items||{}).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(!isSalary(code))return;const current=out.get(code)||{code,name:clean(item?.name)||code,existingAnnual:0,newAnnual:0,byMonth:{}};if(type==='existing')current.existingAnnual+=num(item?.annual);else current.newAnnual+=num(item?.annual);Object.entries(salaryMonths(item)).forEach(([month,value])=>current.byMonth[month]=num(current.byMonth[month])+num(value));out.set(code,current)})};add(existingAllocation,'existing');add(newAllocation,'new');return out}
function mergeHR(department,existingAllocation,newAllocation){if(!department)return department;const combined=combinedSalary(existingAllocation,newAllocation);if(!combined.size)return department;const out={...department,items:{...(department.items||{})}};combined.forEach(value=>{const current=out.items[value.code]||{code:value.code,name:value.name,budgetByMonth:{},actualByMonth:{},lyByMonth:{},newBudgetByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};out.items[value.code]={...current,newBudgetByMonth:{...value.byMonth},landing:0,hrControlled:true,hrAllocatedExistingTotal:value.existingAnnual,hrAllocatedNewEmployeesTotal:value.newAnnual,hrAllocatedTotal:value.existingAnnual+value.newAnnual}});return out}

function buildCentralUtilities(plan={}){const byCc=new Map();(Array.isArray(plan.rows)?plan.rows:[]).forEach(row=>{const cc=clean(row?.cc),gl=clean(row?.gl);if(!cc||!gl.startsWith('608'))return;let dep=byCc.get(cc);if(!dep){dep={items:{}};byCc.set(cc,dep)}const item=dep.items[gl]||(dep.items[gl]={code:gl,name:clean(row?.accountName)||gl,landing:0,newBudgetByMonth:{}});item.landing+=num(row?.landing);Object.entries(row?.newBudgetByMonth||{}).forEach(([month,value])=>item.newBudgetByMonth[month]=num(item.newBudgetByMonth[month])+num(value))});return byCc}
function mergeCentralUtilities(department,allocation){if(!department)return department;const out={...department,items:{...(department.items||{})}};Object.entries(out.items).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(code.startsWith('608'))out.items[raw]={...item,newBudgetByMonth:{},landing:0,utilityControlled:true}});Object.entries(allocation?.items||{}).forEach(([gl,value])=>{const current=out.items[gl]||{code:gl,name:clean(value?.name)||gl,budgetByMonth:{},actualByMonth:{},lyByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};out.items[gl]={...current,newBudgetByMonth:{...(value?.newBudgetByMonth||{})},landing:num(value?.landing),utilityControlled:true,utilitySource:'central-plan'}});return out}
function buildCentralMaintenance(plan={}){const byCc=new Map();(Array.isArray(plan.rows)?plan.rows:[]).forEach(row=>{const cc=clean(row?.cc),gl=clean(row?.gl);if(!cc||!gl.startsWith('604'))return;let dep=byCc.get(cc);if(!dep){dep={items:{}};byCc.set(cc,dep)}const item=dep.items[gl]||(dep.items[gl]={code:gl,name:clean(row?.accountName)||gl,landing:0,newBudgetByMonth:{}});item.landing+=num(row?.landing);Object.entries(row?.newBudgetByMonth||{}).forEach(([month,value])=>item.newBudgetByMonth[month]=num(item.newBudgetByMonth[month])+num(value))});return byCc}
function mergeCentralMaintenance(department,allocation){if(!department)return department;const out={...department,items:{...(department.items||{})}};Object.entries(out.items).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(code.startsWith('604'))out.items[raw]={...item,newBudgetByMonth:{},landing:0,maintenanceControlled:true}});Object.entries(allocation?.items||{}).forEach(([gl,value])=>{const current=out.items[gl]||{code:gl,name:clean(value?.name)||gl,budgetByMonth:{},actualByMonth:{},lyByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false};out.items[gl]={...current,newBudgetByMonth:{...(value?.newBudgetByMonth||{})},landing:num(value?.landing),maintenanceControlled:true,maintenanceSource:'central-plan'}});return out}

function subscriptionMatch(item={},raw=''){const code=clean(item?.code||raw),name=key(item?.name||item?.accountName);return['6140006','6141410'].includes(code)||(name.includes('SUBSCRIPTION')&&(name.includes('BOOK')||name.includes('MAGAZINE')))}
function aggregateSubscriptionPlan(plan={}){const out={};Object.entries(plan?.items||{}).forEach(([raw,value])=>{const gl=clean(value?.code||raw);if(gl)out[gl]={code:gl,name:clean(value?.name)||gl,landing:num(value?.landing),newBudgetByMonth:{...(value?.newBudgetByMonth||{})}}});if(!Object.keys(out).length)(Array.isArray(plan.rows)?plan.rows:[]).forEach(row=>{const gl=clean(row?.gl);if(!gl)return;const item=out[gl]||(out[gl]={code:gl,name:clean(row?.accountName)||gl,landing:0,newBudgetByMonth:{}});item.landing+=num(row?.landing);Object.entries(row?.newBudgetByMonth||{}).forEach(([month,value])=>item.newBudgetByMonth[month]=num(item.newBudgetByMonth[month])+num(value))});return out}
function mergeSubscriptions(department,plan){if(!department||!plan)return department;const incoming=aggregateSubscriptionPlan(plan),out={...department,items:{...(department.items||{})}},touched=new Set();Object.entries(incoming).forEach(([gl,value])=>{touched.add(gl);let found=Object.keys(out.items).find(k=>clean(out.items[k]?.code||k)===gl);if(!found)found=Object.keys(out.items).find(k=>subscriptionMatch(out.items[k],k));const current=found?out.items[found]:{code:gl,name:value.name||gl,budgetByMonth:{},actualByMonth:{},lyByMonth:{},newBudgetByMonth:{},fyBudget:0,actualUnperiodized:0,lyUnperiodized:0,hasLY:false},target=found||gl,departmentMonths={...(value.newBudgetByMonth||{})},itMonths={...(current.itSubscriptionAllocatedByMonth||{})};out.items[target]={...current,code:clean(current.code||gl),name:clean(current.name||value.name)||gl,newBudgetByMonth:addMonthMaps(departmentMonths,itMonths),departmentSubscriptionByMonth:departmentMonths,departmentSubscriptionLanding:num(value.landing),landing:num(value.landing),subscriptionControlled:true}});Object.entries(out.items).forEach(([raw,item])=>{const code=clean(item?.code||raw);if(item?.subscriptionControlled===true&&!touched.has(code))out.items[raw]={...item,newBudgetByMonth:{...(item?.itSubscriptionAllocatedByMonth||{})},departmentSubscriptionByMonth:{},departmentSubscriptionLanding:0,landing:0}});return out}

function cachedProfile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')||null}catch(_){return null}}
function cachedModel(){try{const m=JSON.parse(localStorage.getItem(KEY)||'null');return m?.departments&&m?.cloudAdminView&&m?.summaryOverlayVersion===SUMMARY_VERSION?m:null}catch(_){return null}}
function emitCached(model){let statuses={};try{statuses=JSON.parse(localStorage.getItem('dadBudgetOPEXSubmissionStatus')||'{}')||{}}catch(_){}window.dispatchEvent(new CustomEvent('dad-opex-summary-cloud',{detail:{model,statuses,cached:true}}))}
let loading=false,bootedUid='';

async function loadAdmin(){
 if(loading)return;loading=true;
 try{
  const [baseSnap,uploadSnap,metaSnap,legacyUtilitySnap,itSnap,trainingSnap,hrExistingSnap,hrNewSnap,subscriptionSnap,utilityPlanSnap,maintenancePlanSnap]=await Promise.all([
   getDocs(collection(db,'opex_baseline_departments')),
   getDocs(collection(db,'opex_budget_submissions')),
   getDoc(doc(db,'opex_baseline_meta','current')),
   safeDocs(collection(db,'opex_utilities_allocations'),'legacy Utilities'),
   safeDocs(collection(db,'opex_it_allocations'),'IT allocations'),
   safeDocs(prefixQuery('training_allocation_'),'Training allocations'),
   safeDocs(prefixQuery('hr_salary_allocation_'),'HR salary allocations'),
   safeDocs(prefixQuery('hr_new_salary_allocation_'),'HR new salary allocations'),
   safeDocs(prefixQuery('subscription_budget_'),'Subscriptions'),
   safeDoc(doc(db,'system_status','utilities_budget_fy2027'),'central Utilities'),
   safeDoc(doc(db,'system_status','maintenance_budget_fy2027'),'central Maintenance')
  ]);
  const uploads=new Map(uploadSnap.docs.map(x=>[clean(x.id),x.data()||{}])),legacyUtilities=new Map(legacyUtilitySnap.docs.map(x=>[clean(x.id),x.data()||{}])),itAllocations=new Map(itSnap.docs.map(x=>[clean(x.id),x.data()||{}])),training=new Map(trainingSnap.docs.map(x=>[clean(x.id).replace(/^training_allocation_/,''),x.data()||{}])),hrExisting=new Map(hrExistingSnap.docs.map(x=>[clean(x.id).replace(/^hr_salary_allocation_/,''),x.data()||{}])),hrNew=new Map(hrNewSnap.docs.map(x=>[clean(x.id).replace(/^hr_new_salary_allocation_/,''),x.data()||{}])),subscriptions=new Map(subscriptionSnap.docs.map(x=>[clean(x.id).replace(/^subscription_budget_/,''),x.data()||{}])),centralUtilities=buildCentralUtilities(utilityPlanSnap.exists()?utilityPlanSnap.data()||{}:{}),centralMaintenance=buildCentralMaintenance(maintenancePlanSnap.exists()?maintenancePlanSnap.data()||{}:{}),departments={},statuses={};
  await Promise.all(baseSnap.docs.map(async b=>{
   const cc=clean(b.id);if(!cc)return;let department=await decode(b.data(),cc);const upload=uploads.get(cc);if(upload){const visible=await visibleSubmission(upload,cc);if(visible?.items)department=mergeSubmission(department,visible);statuses[cc]=upload.workflowStatus||upload.status||'uploaded'}
   department=mergeLegacyUtilities(department,legacyUtilities.get(cc));
   department=mergeIT(department,itAllocations.get(cc));
   department=mergeTraining(department,training.get(cc));
   department=mergeHR(department,hrExisting.get(cc),hrNew.get(cc));
   department=mergeCentralUtilities(department,centralUtilities.get(cc));
   department=mergeCentralMaintenance(department,centralMaintenance.get(cc));
   department=mergeSubscriptions(department,subscriptions.get(cc));
   departments[cc]=department;
  }));
  const now=Date.now(),model={fileName:metaSnap.exists()?metaSnap.data()?.fileName||'Cloud OPEX Baseline':'Cloud OPEX Baseline',departments,cloud:true,cloudAdminView:true,summaryOverlayVersion:SUMMARY_VERSION,cloudReadAt:now};
  localStorage.setItem(KEY,JSON.stringify(model));localStorage.setItem('dadBudgetOPEXSubmissionStatus',JSON.stringify(statuses));sessionStorage.setItem(CACHE_TS,String(now));window.dispatchEvent(new CustomEvent('dad-opex-summary-cloud',{detail:{model,statuses}}));
 }finally{loading=false}
}
async function start(user,eventProfile=null){if(!user||bootedUid===user.uid)return;let profile=eventProfile||cachedProfile();if(!profile){const p=await getDoc(doc(db,'users',user.uid));profile=p.exists()?p.data()||{}:{}}const admin=user.uid===MAIN||profile.role==='admin'||profile.isMainAdmin===true;if(!admin)return;bootedUid=user.uid;const last=Number(sessionStorage.getItem(CACHE_TS)||0),model=cachedModel();if(model&&Date.now()-last<TTL){emitCached(model);return}await loadAdmin()}
onAuthStateChanged(auth,user=>{if(user)start(user).catch(console.error)});
window.addEventListener('dad-user-ready',e=>{const user=e.detail?.user||auth.currentUser;if(user)start(user,e.detail?.profile||null).catch(console.error)});
