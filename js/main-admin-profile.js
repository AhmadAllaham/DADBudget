// DAD Budget 2027 - bootstrap the permanent main administrator profile
(function(){
  const KEY='dadBudgetUserProfiles';
  const UID='PST3chwdZmaQGeG25t4ym9Vlixe2';
  const EMAIL='allaham@dadgroup.com';
  const MODULES=['dashboard','opex_detail','opex_summary','capex','capex_it','travel','hr','ap','training','ims','pl','approvals','data_admin'];
  let users=[];
  try{users=JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch(e){users=[]}
  const i=users.findIndex(u=>String(u?.email||'').trim().toLowerCase()===EMAIL||String(u?.uid||'')===UID);
  const base={
    uid:UID,
    email:EMAIL,
    displayEmail:'Allaham@dadgroup.com',
    role:'admin',
    department:'ALL',
    departmentLabel:'All Departments',
    modules:MODULES,
    enabled:true,
    isMainAdmin:true,
    mainAdmin:true,
    protected:true,
    updatedAt:new Date().toISOString()
  };
  if(i>=0) users[i]={...users[i],...base,createdAt:users[i].createdAt||new Date().toISOString()};
  else users.unshift({...base,createdAt:new Date().toISOString()});
  localStorage.setItem(KEY,JSON.stringify(users));
  localStorage.setItem('dadBudgetMainAdminUid',UID);
  localStorage.setItem('dadBudgetMainAdminEmail',EMAIL);
})();
