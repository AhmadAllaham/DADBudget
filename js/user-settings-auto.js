const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const loadLocal=()=>{try{return JSON.parse(localStorage.getItem('dadBudgetUserProfiles')||'[]')||[]}catch(_){return[]}};
const saveLocal=a=>localStorage.setItem('dadBudgetUserProfiles',JSON.stringify(a));
function upsertLocal(u){const a=loadLocal();const i=a.findIndex(x=>(u.uid&&x.uid===u.uid)||clean(x.email).toLowerCase()===clean(u.email).toLowerCase());if(i>=0)a[i]={...a[i],...u};else a.push(u);saveLocal(a)}
function selectedDepartments(){const chips=[...document.querySelectorAll('#selectedDepartments .dep-chip')];return chips.map(ch=>{const cc=ch.querySelector('[data-remove-dep]')?.dataset.removeDep||'';const txt=[...ch.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();return{cc,label:txt||cc}}).filter(x=>x.cc)}
function selectedModules(){return[...document.querySelectorAll('#permissions input:checked')].map(x=>x.value)}
function setStatus(msg,ok=true){const s=$('statusLine');if(!s)return;s.textContent=msg;s.className='status-line '+(ok?'ok':'err')}
function hideUidUi(){const uid=$('uid');if(uid){const field=uid.closest('.field');if(field)field.style.display='none'}document.querySelectorAll('.uid-text').forEach(x=>x.style.display='none');const th=document.querySelector('.user-table thead th:first-child');if(th)th.textContent='Email';const sub=document.querySelector('.form-card .sub');if(sub)sub.textContent='Create the login account and Firestore access profile automatically.';const note=document.querySelector('.password-box small');if(note)note.textContent='For a new user, this password becomes the Firebase login password. It is never stored in Firestore or LocalStorage. For an existing user, use Password Reset to change the login password.'}
async function saveUserAutomatically(){
  const email=clean($('email')?.value).toLowerCase(),password=$('passwordInput')?.value||'',uid=clean($('uid')?.value),role=$('role')?.value||'department_user',enabled=$('enabled')?.value==='true',btn=$('saveBtn');
  if(!email||!email.includes('@')){setStatus('Enter a valid email address.',false);return}
  const deps=selectedDepartments(),depIds=deps.map(x=>x.cc),depLabels=deps.map(x=>x.label),profile={email,role,department:depIds[0]||'',departments:depIds,departmentLabel:depLabels[0]||'Not Restricted',departmentLabels:depLabels,modules:selectedModules(),enabled,updatedAt:new Date().toISOString()};
  try{
    btn.disabled=true;btn.textContent=uid?'Updating...':'Creating user...';
    if(!window.DADFirebase)throw new Error('Firebase is still loading.');
    let finalUid=uid;
    if(uid){await window.DADFirebase.saveUserProfile(uid,profile)}else{
      if(!password||password.length<6)throw new Error('Enter a password of at least 6 characters for the new user.');
      const created=await window.DADFirebase.createUserAccount(email,password,profile);finalUid=created.uid;
    }
    upsertLocal({...profile,uid:finalUid,cloudSynced:true,createdAt:new Date().toISOString()});
    setStatus(uid?'User updated successfully.':'User created successfully. Login is ready immediately.');
    $('clearBtn')?.click();
    setTimeout(()=>{hideUidUi();window.dispatchEvent(new Event('resize'))},0);
    // Refresh cloud list using the existing page loader when available.
    window.dispatchEvent(new CustomEvent('dad-user-profile-saved',{detail:{uid:finalUid,email}}));
  }catch(err){
    const code=err?.code||'';
    let msg=err?.message||String(err);
    if(code==='auth/email-already-in-use')msg='This email already has a Firebase login account. Open the existing user from the Users list and update it instead.';
    if(code==='auth/weak-password')msg='Password is too weak. Use at least 6 characters.';
    setStatus('User save failed: '+msg,false);
  }finally{btn.disabled=false;btn.textContent=clean($('uid')?.value)?'Update in Firebase':'Create User'}
}
function install(){
  hideUidUi();
  const btn=$('saveBtn');if(btn){btn.textContent=clean($('uid')?.value)?'Update in Firebase':'Create User';btn.onclick=saveUserAutomatically}
  const email=$('email');email?.addEventListener('input',()=>{if(!clean($('uid')?.value)&&btn)btn.textContent='Create User'});
  const observer=new MutationObserver(()=>hideUidUi());const body=$('userBody');if(body)observer.observe(body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)setTimeout(()=>{hideUidUi();if(btn)btn.textContent='Update in Firebase'},0);const clear=e.target.closest('#clearBtn');if(clear)setTimeout(()=>{hideUidUi();if(btn)btn.textContent='Create User'},0)},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
