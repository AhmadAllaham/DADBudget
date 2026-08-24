(function(){
  const productionIds=[
    '1000140112','1000100302','1000100501','1000100505','1000110101','1000110102','1000110103','1000110104','1000110109','1000110110',
    '1000110112','1000110113','1000110114','1000110115','1000110116','1000110117','1000110118','1000110120','1000120101','1000120102',
    '1000120103','1000120104','1000120105','1000120106','1000120107','1000120108','1000120109','1000120110','1000120111','1000120112',
    '1000120114','1000120116','1000120117','1000130101','1000130102','1000130103','1000130104','1000130105','1000130106','1000130107',
    '1000130109','1000130112','1000130113','1000130114','1000140101','1000140102','1000140103','1000140104','1000140105','1000140106',
    '1000140107','1000140108','1000140109','1000140110','1000140111','1000140113','1000140114','1000140115','1000140116'
  ];
  const groups={
    PRODUCTION:{key:'PRODUCTION',value:'GROUP:PRODUCTION',label:'Production',ids:productionIds,adminOnly:true},
    RD_ANALYTICAL:{key:'RD_ANALYTICAL',value:'GROUP:RD_ANALYTICAL',label:'R&D + Analytical Research',ids:['1000401101','1000401105'],allowedEmails:['manar.alasaad@dadgroup.com']}
  };
  const byValue=Object.fromEntries(Object.values(groups).map(group=>[group.value,group]));
  const groupFor=value=>byValue[String(value||'').trim()]||null;
  const idsFor=value=>groupFor(value)?.ids.slice()||[];
  const includes=(value,fundCenter)=>idsFor(value).includes(String(fundCenter||'').trim());
  const cachedProfile=()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')}catch(_){return null}};
  function visibleGroups(profile=cachedProfile()){const admin=profile?.isMainAdmin===true||profile?.role==='admin',email=String(profile?.email||'').trim().toLowerCase();return Object.values(groups).filter(group=>admin||(!group.adminOnly&&(!group.allowedEmails||group.allowedEmails.map(x=>String(x).toLowerCase()).includes(email))))}
  function bindSearch(select,input){
    if(!select||!input||input.dataset.departmentSearchBound==='1')return;
    input.dataset.departmentSearchBound='1';
    const host=select.closest('.department-filter-stack')||select.parentElement;
    const trigger=document.createElement('button'),menu=document.createElement('div'),list=document.createElement('div');
    trigger.type='button';trigger.className='department-combo-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    menu.className='department-combo-menu';list.className='department-combo-list';list.setAttribute('role','listbox');
    input.placeholder='Search department or Fund Center...';menu.append(input,list);host.append(trigger,menu);select.classList.add('department-native-select');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    const sync=()=>{const option=select.selectedOptions?.[0];trigger.textContent=option?.textContent?.trim()||'Select Department';trigger.title=trigger.textContent;trigger.disabled=select.disabled;[...list.querySelectorAll('.department-combo-option')].forEach(x=>{const on=x.dataset.value===select.value;x.classList.toggle('selected',on);x.setAttribute('aria-selected',on?'true':'false')})};
    const apply=()=>{const query=String(input.value||'').trim().toLowerCase();[...list.querySelectorAll('.department-combo-option')].forEach(item=>item.hidden=!!query&&!item.textContent.toLowerCase().includes(query));[...list.querySelectorAll('.department-combo-group')].forEach(group=>{const key=group.dataset.group;group.hidden=![...list.querySelectorAll(`.department-combo-option[data-group="${key}"]`)].some(item=>!item.hidden)})};
    const addOption=(option,group='')=>{const item=document.createElement('button');item.type='button';item.className='department-combo-option';item.dataset.value=option.value;item.dataset.group=group;item.textContent=option.textContent;item.disabled=option.disabled;item.setAttribute('role','option');item.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close()};list.appendChild(item)};
    const rebuild=()=>{list.innerHTML='';let groupIndex=0;[...select.children].forEach(child=>{if(child.tagName==='OPTGROUP'){const key=`group-${groupIndex++}`,label=document.createElement('div');label.className='department-combo-group';label.dataset.group=key;label.textContent=child.label;list.appendChild(label);[...child.children].forEach(option=>addOption(option,key))}else if(child.tagName==='OPTION')addOption(child)});sync();apply()};
    const open=()=>{if(trigger.disabled)return;host.classList.add('department-combo-open');trigger.setAttribute('aria-expanded','true');input.value='';apply();requestAnimationFrame(()=>input.focus())};
    const close=()=>{host.classList.remove('department-combo-open');trigger.setAttribute('aria-expanded','false')};
    trigger.addEventListener('click',event=>{event.stopPropagation();host.classList.contains('department-combo-open')?close():open()});input.addEventListener('input',apply);
    input.addEventListener('keydown',event=>{if(event.key==='Escape'){close();trigger.focus();return}if(event.key!=='Enter')return;const first=[...list.querySelectorAll('.department-combo-option')].find(item=>!item.hidden&&!item.disabled);if(!first)return;first.click();event.preventDefault()});
    select.addEventListener('change',()=>{sync();close()});document.addEventListener('click',event=>{if(!host.contains(event.target))close()});new MutationObserver(rebuild).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});rebuild();
  }
  window.DADDepartmentGroups={groups,all:Object.values(groups),visibleGroups,groupFor,idsFor,includes,bindSearch};
})();

(function(){
  if(!/user-settings\.html$/i.test((location.pathname||'').split('?')[0]))return;
  const EMAIL_FUNCTION_URL='https://us-central1-budget-8c575.cloudfunctions.net/adminSetUserEmail';
  window.addEventListener('DOMContentLoaded',()=>{
    const saveBtn=document.getElementById('saveBtn'),emailInput=document.getElementById('email'),uidInput=document.getElementById('uid'),statusLine=document.getElementById('statusLine');if(!saveBtn||!emailInput||!uidInput||saveBtn.dataset.authEmailSyncBound==='1')return;
    saveBtn.dataset.authEmailSyncBound='1';const originalSave=saveBtn.onclick;let editingExistingUser=false;
    document.addEventListener('click',event=>{const editButton=event.target.closest?.('[data-edit]');if(!editButton)return;setTimeout(()=>{editingExistingUser=!!uidInput.value.trim()},0)},true);
    const setStatus=(message,isError=false)=>{if(!statusLine)return;statusLine.textContent=message;statusLine.className=isError?'status-line err':'status-line ok'};
    saveBtn.onclick=async function(event){const uid=uidInput.value.trim(),email=emailInput.value.trim().toLowerCase();if(editingExistingUser&&uid&&email){try{saveBtn.disabled=true;saveBtn.textContent='Syncing login email...';const currentUser=window.DADFirebase?.auth?.currentUser;if(!currentUser)throw new Error('Sign in as Main Admin first.');const token=await currentUser.getIdToken(true),response=await fetch(EMAIL_FUNCTION_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({uid,email})});let result={};try{result=await response.json()}catch(_){}if(!response.ok||result.ok!==true){const code=result.error||('HTTP '+response.status);if(code==='main-admin-required')throw new Error('Only the Main Admin can change a login email.');if(code==='email-already-exists')throw new Error('This email is already used by another Firebase Authentication account.');if(code==='user-not-found')throw new Error('Firebase Authentication user was not found.');throw new Error(code)}if(result.changed)setStatus('Login email synced in Firebase Authentication. Saving user profile...')}catch(err){saveBtn.disabled=false;saveBtn.textContent='Update in Firebase';setStatus('Email update failed: '+err.message,true);return}}saveBtn.disabled=false;if(typeof originalSave==='function')return originalSave.call(saveBtn,event)};
  });
})();

(function(){
  if(!/opex\.html$/i.test((location.pathname||'').split('?')[0]))return;
  if(document.querySelector('script[data-hr-salary-opex-sync]'))return;
  const script=document.createElement('script');script.type='module';script.src='js/hr-salary-opex-sync.js?v=20260824-hr-salary-2';script.dataset.hrSalaryOpexSync='1';document.head.appendChild(script);
})();

(function(){
  const page=(location.pathname||'').split('?')[0];
  if(!/(?:opex|capex)\.html$/i.test(page))return;
  if(document.querySelector('script[data-admin-direct-approval]'))return;
  const script=document.createElement('script');script.type='module';script.src='js/admin-direct-approval.js?v=20260824-admin-auto-approve-1';script.dataset.adminDirectApproval='1';document.head.appendChild(script);
})();