import {getApps} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,EmailAuthProvider,reauthenticateWithCredential,updatePassword} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const app=getApps()[0],auth=getAuth(app);
const $=id=>document.getElementById(id);
let busy=false;

function errorMessage(error){
  const code=String(error?.code||'');
  if(code.includes('invalid-credential')||code.includes('wrong-password'))return 'Current password is incorrect.';
  if(code.includes('weak-password'))return 'New password is too weak. Use at least 6 characters.';
  if(code.includes('too-many-requests'))return 'Too many attempts. Please wait a little and try again.';
  if(code.includes('network-request-failed'))return 'Network error. Please check your connection and try again.';
  if(code.includes('requires-recent-login'))return 'Please sign out, sign in again, then change your password.';
  return error?.message||'Password could not be changed.';
}

function closeModal(){const modal=$('selfPasswordModal');if(modal&&!busy)modal.classList.remove('open')}
function openModal(){
  const modal=$('selfPasswordModal');if(!modal)return;
  ['selfCurrentPassword','selfNewPassword','selfConfirmPassword'].forEach(id=>{const input=$(id);if(input)input.value=''});
  const status=$('selfPasswordStatus');if(status){status.textContent='';status.className='self-password-status'}
  modal.classList.add('open');setTimeout(()=>$('selfCurrentPassword')?.focus(),40)
}

function installStyles(){
  if($('selfPasswordStyles'))return;
  const style=document.createElement('style');style.id='selfPasswordStyles';style.textContent=`
  .self-password-btn{position:fixed;top:18px;right:218px;z-index:9999;width:104px;height:38px;border-radius:11px;border:1px solid rgba(18,163,151,.32);background:rgba(255,255,255,.96);color:#0a6f68;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 9px;font-size:10px;font-weight:1000;cursor:pointer;box-shadow:0 0 14px rgba(31,220,198,.14),0 5px 16px rgba(15,72,75,.08);transition:.18s ease;backdrop-filter:blur(8px)}
  .self-password-btn:hover{transform:translateY(-1px) scale(1.02);box-shadow:0 0 18px rgba(31,220,198,.30),0 7px 18px rgba(15,72,75,.10)}
  .self-password-overlay{display:none;position:fixed;inset:0;z-index:12000;background:rgba(6,32,40,.46);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px}
  .self-password-overlay.open{display:flex}
  .self-password-card{width:min(430px,100%);background:#fff;border:1px solid #cfe5e2;border-radius:16px;box-shadow:0 24px 70px rgba(10,52,58,.28);overflow:hidden;color:#173f46}
  .self-password-head{padding:19px 21px 14px;border-bottom:1px solid #e3efed;display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
  .self-password-head h2{margin:0;font-size:21px;color:#143c5c;font-weight:1000}.self-password-head p{margin:5px 0 0;font-size:11px;color:#71878b;font-weight:750;line-height:1.45}
  .self-password-x{border:0;background:#f3f8f7;color:#557075;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:17px;font-weight:900}
  .self-password-body{padding:18px 21px 21px}.self-password-field{margin-bottom:13px}.self-password-field label{display:block;margin-bottom:6px;font-size:10px;color:#587178;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}.self-password-field input{box-sizing:border-box;width:100%;height:42px;border:1px solid #cfe2df;border-radius:9px;padding:0 11px;font-size:13px;font-weight:800;color:#24454b;background:#fff;outline:none}.self-password-field input:focus{border-color:#1aa99d;box-shadow:0 0 0 3px rgba(26,169,157,.10)}
  .self-password-hint{font-size:10px;color:#7d9094;font-weight:700;margin:-3px 0 13px}.self-password-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:7px}.self-password-actions button{height:38px;border-radius:8px;padding:0 13px;font-size:10px;font-weight:1000;cursor:pointer}.self-password-cancel{border:1px solid #cfe2df;background:#fff;color:#4d6a70}.self-password-save{border:1px solid #159b90;background:linear-gradient(90deg,#0e8f86,#13a79b);color:#fff}.self-password-save:disabled{opacity:.55;cursor:wait}.self-password-status{min-height:18px;margin-top:11px;font-size:11px;font-weight:850}.self-password-status.error{color:#b23b3b}.self-password-status.success{color:#087a64}
  html[data-theme="dark"] .self-password-btn{background:rgba(15,38,43,.96);color:#70eadb;border-color:rgba(65,218,200,.38)}html[data-theme="dark"] .self-password-card{background:#122b31;color:#eaf7f5;border-color:#28535a}html[data-theme="dark"] .self-password-head{border-color:#29484e}html[data-theme="dark"] .self-password-head h2{color:#eaf7f5}html[data-theme="dark"] .self-password-head p,html[data-theme="dark"] .self-password-hint{color:#9bb0b4}html[data-theme="dark"] .self-password-field label{color:#a7bdc1}html[data-theme="dark"] .self-password-field input{background:#0d2227;border-color:#31555b;color:#eefaf8}html[data-theme="dark"] .self-password-x,html[data-theme="dark"] .self-password-cancel{background:#18363c;border-color:#31555b;color:#c8dddd}
  @media(max-width:760px){.self-password-btn{right:164px;width:38px;padding:0}.self-password-btn .self-password-label{display:none}}
  `;document.head.appendChild(style)
}

function installModal(){
  if($('selfPasswordModal'))return;
  const modal=document.createElement('div');modal.id='selfPasswordModal';modal.className='self-password-overlay';modal.innerHTML=`<div class="self-password-card" role="dialog" aria-modal="true" aria-labelledby="selfPasswordTitle"><div class="self-password-head"><div><h2 id="selfPasswordTitle">Change Password</h2><p>Change the password for your own Budget 2027 account.</p></div><button class="self-password-x" id="selfPasswordClose" type="button" aria-label="Close">×</button></div><form class="self-password-body" id="selfPasswordForm"><div class="self-password-field"><label for="selfCurrentPassword">Current Password</label><input id="selfCurrentPassword" type="password" autocomplete="current-password" required></div><div class="self-password-field"><label for="selfNewPassword">New Password</label><input id="selfNewPassword" type="password" autocomplete="new-password" minlength="6" required></div><div class="self-password-field"><label for="selfConfirmPassword">Confirm New Password</label><input id="selfConfirmPassword" type="password" autocomplete="new-password" minlength="6" required></div><div class="self-password-hint">Minimum 6 characters. Your new password must be different from the current password.</div><div class="self-password-actions"><button class="self-password-cancel" id="selfPasswordCancel" type="button">Cancel</button><button class="self-password-save" id="selfPasswordSave" type="submit">Change Password</button></div><div class="self-password-status" id="selfPasswordStatus" aria-live="polite"></div></form></div>`;
  document.body.appendChild(modal);
  $('selfPasswordClose').onclick=closeModal;$('selfPasswordCancel').onclick=closeModal;
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeModal()});
  $('selfPasswordForm').addEventListener('submit',changePassword)
}

async function changePassword(event){
  event.preventDefault();if(busy)return;
  const user=auth.currentUser,current=$('selfCurrentPassword')?.value||'',next=$('selfNewPassword')?.value||'',confirm=$('selfConfirmPassword')?.value||'',status=$('selfPasswordStatus'),save=$('selfPasswordSave');
  const fail=message=>{status.textContent=message;status.className='self-password-status error'};
  if(!user?.email)return fail('Your signed-in email could not be found. Please sign in again.');
  if(!current)return fail('Enter your current password.');
  if(next.length<6)return fail('New password must contain at least 6 characters.');
  if(next!==confirm)return fail('New password and confirmation do not match.');
  if(next===current)return fail('New password must be different from the current password.');
  try{
    busy=true;save.disabled=true;save.textContent='Changing...';status.textContent='Verifying current password...';status.className='self-password-status';
    const credential=EmailAuthProvider.credential(user.email,current);
    await reauthenticateWithCredential(user,credential);
    await updatePassword(user,next);
    ['selfCurrentPassword','selfNewPassword','selfConfirmPassword'].forEach(id=>{const input=$(id);if(input)input.value=''});
    status.textContent='Password changed successfully.';status.className='self-password-status success';save.textContent='Changed ✓';
    setTimeout(()=>{busy=false;save.disabled=false;save.textContent='Change Password';closeModal()},1100)
  }catch(error){
    busy=false;save.disabled=false;save.textContent='Change Password';fail(errorMessage(error))
  }
}

function installButton(){
  if($('selfPasswordButton')||!document.body)return;
  const button=document.createElement('button');button.id='selfPasswordButton';button.type='button';button.className='self-password-btn';button.title='Change Password';button.setAttribute('aria-label','Change Password');button.innerHTML='<span aria-hidden="true">🔐</span><span class="self-password-label">Password</span>';button.onclick=openModal;document.body.appendChild(button)
}

function install(){if((location.pathname.split('/').pop()||'').toLowerCase()==='login.html')return;installStyles();installModal();installButton()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.addEventListener('dad-user-ready',install);
