import { getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app=getApps()[0],auth=getAuth(app),db=getFirestore(app);
const MAIN='PST3chwdZmaQGeG25t4ym9Vlixe2';
const cache=new Map();
const managerLabels={pending_manager:'Pending Manager',manager_approved:'Manager Approved',manager_returned:'Returned by Manager'};

function styleOnce(){
  if(document.getElementById('centralProgressStyle'))return;
  const s=document.createElement('style');s.id='centralProgressStyle';s.textContent=`
    .central-input-cell{min-width:118px}.central-input-wrap{display:flex;align-items:center;gap:6px;white-space:nowrap}
    .central-check{width:14px;height:14px;accent-color:#0b9187;cursor:pointer}.central-label{font-size:8px;font-weight:1000;color:#6f8589}
    .central-label.ready{color:#087a64}.central-save{height:28px;border:1px solid #b9dcd7;background:#fff;color:#24716b;border-radius:6px;padding:0 8px;font-size:8px;font-weight:1000;cursor:pointer}
    .central-save:disabled{opacity:.5;cursor:wait}.central-head{background:#0a2c61!important;color:#fff!important}
    .manager-gate{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:1000;white-space:nowrap}
    .manager-gate.pending_manager{background:#fff7dc;color:#826400}.manager-gate.manager_approved{background:#eaf8f4;color:#087a64}.manager-gate.manager_returned{background:#fff0ee;color:#b23b3b}.manager-gate.none{background:#f2f4f5;color:#6f8589}
  `;document.head.appendChild(s);
}
function addHeaders(){
  const tr=document.querySelector('.sub-table thead tr');if(!tr||tr.dataset.centralReady)return;
  tr.dataset.centralReady='1';const cells=[...tr.children],status=cells.find(x=>x.textContent.trim()==='Current Status'),note=cells.find(x=>x.textContent.trim()==='Note');
  const mh=document.createElement('th');mh.className='central-head';mh.textContent='Manager Gate';status?tr.insertBefore(mh,status):tr.appendChild(mh);
  ['Salaries / HR','Depreciation'].forEach(t=>{const th=document.createElement('th');th.className='central-head';th.textContent=t;note?tr.insertBefore(th,note):tr.appendChild(th)});
}
async function stateFor(cc,module){const key=`${module}:${cc}`;if(cache.has(key))return cache.get(key);const collectionName=module==='CAPEX'?'capex_budget_submissions':'opex_budget_submissions',[s,u]=await Promise.all([getDoc(doc(db,'budget_submission_status',cc)),getDoc(doc(db,collectionName,cc))]),d={...(s.exists()?s.data():{}),...(u.exists()?u.data():{})};cache.set(key,d);return d}
function makeCell(kind,value){
  const td=document.createElement('td');td.className='central-input-cell';const label=kind==='salaries'?'HR':'DEP';
  td.innerHTML=`<div class="central-input-wrap"><input class="central-check" type="checkbox" data-central="${kind}" ${value?'checked':''}><span class="central-label ${value?'ready':''}">${value?'Loaded':'Pending'}</span></div>`;
  const x=td.querySelector('input'),l=td.querySelector('.central-label');x.onchange=()=>{l.textContent=x.checked?'Loaded':'Pending';l.classList.toggle('ready',x.checked)};return td;
}
function managerCell(st){const td=document.createElement('td'),status=st?.workflowStatus||st?.status||'',key=managerLabels[status]?status:'none';td.innerHTML=`<span class="manager-gate ${key}">${managerLabels[status]||'Not sent to Manager'}</span>${st?.managerEmail?`<div style="font-size:8px;color:#74898d;margin-top:4px">${st.managerEmail}</div>`:''}`;return td}
function syncStatusSelect(tr,st){const sel=tr.querySelector('[data-status]'),status=st?.workflowStatus||st?.status||'';if(!sel||!managerLabels[status])return;for(const key of Object.keys(managerLabels)){if(![...sel.options].some(o=>o.value===key)){const o=document.createElement('option');o.value=key;o.textContent=managerLabels[key];sel.appendChild(o)}}sel.value=status;if(status==='pending_manager'||status==='manager_returned'){sel.disabled=true;sel.title='Manager approval is required before Finance can change the workflow status.'}else if(status==='manager_approved'){sel.disabled=false;sel.title='Manager approved. Finance can now move this to Under Review.'}}
async function enhanceRow(tr){
  if(!tr?.dataset?.cc||tr.dataset.centralReady)return;tr.dataset.centralReady='1';const cc=tr.dataset.cc,module=tr.dataset.module||'OPEX';
  try{const st=await stateFor(cc,module),cells=[...tr.children],currentStatus=cells.find(x=>x.querySelector?.('.badge')),note=cells.find(x=>x.querySelector?.('[data-note]'));
    const mg=managerCell(st);currentStatus?tr.insertBefore(mg,currentStatus):tr.appendChild(mg);syncStatusSelect(tr,st);
    const sal=makeCell('salaries',st.salariesReady===true),dep=makeCell('depreciation',st.depreciationReady===true);note?tr.insertBefore(sal,note):tr.appendChild(sal);note?tr.insertBefore(dep,note):tr.appendChild(dep);
    const action=[...tr.children].find(x=>x.querySelector?.('[data-save]'));if(action&&!action.querySelector('.central-save')){const b=document.createElement('button');b.type='button';b.className='central-save';b.textContent='Save Inputs';b.style.marginTop='5px';b.onclick=()=>saveInputs(tr,b);action.appendChild(b)}
  }catch(e){console.warn('Central input state failed',cc,e)}
}
async function saveInputs(tr,btn){
  const user=auth.currentUser,cc=tr.dataset.cc,module=tr.dataset.module||'OPEX',cacheKey=`${module}:${cc}`;if(!user||user.uid!==MAIN){alert('Main Admin only');return}
  const sal=tr.querySelector('[data-central="salaries"]')?.checked===true,dep=tr.querySelector('[data-central="depreciation"]')?.checked===true;
  try{btn.disabled=true;btn.textContent='Saving...';await setDoc(doc(db,'budget_submission_status',cc),{salariesReady:sal,depreciationReady:dep,centralInputsUpdatedBy:user.uid,centralInputsUpdatedEmail:(user.email||'').toLowerCase(),centralInputsUpdatedAt:serverTimestamp(),centralInputsClientTime:new Date().toISOString()},{merge:true});cache.set(cacheKey,{...(cache.get(cacheKey)||{}),salariesReady:sal,depreciationReady:dep});btn.textContent='Saved ✓';setTimeout(()=>btn.textContent='Save Inputs',1200)}catch(e){btn.textContent='Failed';alert('Central inputs save failed: '+(e.message||e))}finally{btn.disabled=false}}
function scan(){styleOnce();addHeaders();document.querySelectorAll('.sub-table tbody tr[data-cc]').forEach(enhanceRow)}
const obs=new MutationObserver(scan);function start(){scan();const body=document.querySelector('.sub-table tbody');if(body)obs.observe(body,{childList:true});else setTimeout(start,250)}
start();
import('./finance-return-button.js?v=20260818-manager-chain-1').catch(e=>console.error('Finance return button failed:',e));
