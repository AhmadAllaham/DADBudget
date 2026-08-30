// DAD Budget 2027 - shared frontend logic
(function(){
  const THEME_KEY='dadBudgetColorTheme';
  function ensureTheme(){
    if(!document.querySelector('link[data-dad-dark-theme]')){const link=document.createElement('link');link.rel='stylesheet';link.href='css/dark-mode.css?v=20260818-neon-dark-1';link.dataset.dadDarkTheme='1';document.head.appendChild(link)}
    let theme='light';try{theme=localStorage.getItem(THEME_KEY)==='dark'?'dark':'light'}catch(_){}document.documentElement.dataset.theme=theme;
  }
  ensureTheme();
  const BASE='dadBudgetIMSSales', META=BASE+'Meta', PREFIX=BASE+'Chunk_', CHUNK_SIZE=250;
  const REDUCTION_KEY='dadBudgetReductionRates', EXCEPTION_KEY='dadBudgetCommissionExceptions';
  const FTE_COST_KEY='dadBudgetFTECost', FTE_DIST_KEY='dadBudgetFTEDistribution';
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const n=v=>{const x=Number(String(v??'').replace(/,/g,'').replace('%','').trim());return Number.isFinite(x)?x:0};
  const money=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const qty=v=>Math.round(Number(v||0)).toLocaleString();
  const norm=v=>String(v??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  const rateFraction=v=>{const x=n(v);return Math.abs(x)<=1?x:x/100};
  const marketNorm=v=>{const z=norm(v);return z==='KSA'?'SAUDI':z==='SAUDIARABIA'?'SAUDI':z};

  function currentProfile(){try{return JSON.parse(localStorage.getItem('dadBudgetCurrentProfile')||'null')}catch(e){return null}}
  function moduleForLink(link){
    const href=(link.getAttribute('href')||'').split('?')[0].toLowerCase(),label=String(link.textContent||'').trim().toLowerCase();
    if(href.includes('executive-command-center'))return'executive';
    if(href.includes('user-settings'))return'admin_only';
    if(href.includes('data-admin'))return'main_admin';
    if(href.includes('ims-sales'))return'ims';
    if(href.includes('it-planning')||href.includes('projects')||label==='projects')return'capex_it';
    if(href.includes('capex'))return'capex';
    if(href.includes('opex-summary'))return'opex_summary';
    if(href.includes('training-expense'))return'training';
    if(href.includes('travel-budget'))return'travel';
    if(href.includes('hr-salaries'))return'hr';
    if(href.includes('hr-budget'))return'hr';
    if(href.includes('ap-budget'))return'ap';
    if(href.includes('opex'))return'opex_detail';
    if(href.includes('index'))return'dashboard';
    if(label.includes('p&l'))return'pl';
    if(label.includes('approval'))return'approvals';
    return'';
  }
  function applyCachedAccess(){
    const p=currentProfile();if(!p)return;
    const isAdmin=p.isMainAdmin===true||p.role==='admin',mainAdmin=p.isMainAdmin===true,mods=new Set(Array.isArray(p.modules)?p.modules:[]),departmentAccess=(Array.isArray(p.departments)?p.departments:[p.department]).some(x=>x&&x!=='ALL'),trainingReportViewer=String(p.email||'').trim().toLowerCase()==='nouralhuda.hasan@dadgroup.com',allowedModule=req=>mods.has(req)||(req==='training'&&trainingReportViewer)||(req==='capex'&&mods.has('capex_it'))||(req==='hr'&&(mods.has('hr_it')||departmentAccess))||(mods.has('opex')&&(req==='opex_detail'||req==='opex_summary'));
    const nav=document.querySelector('.sidebar-nav');
    if(nav){
      nav.querySelectorAll('a').forEach(a=>{const req=moduleForLink(a);if(!req)return;const allowed=req==='main_admin'?mainAdmin:req==='admin_only'?isAdmin:(isAdmin||allowedModule(req));if(allowed)a.style.removeProperty('display');else a.style.setProperty('display','none','important')});
      const opexSub=nav.querySelector('.opex-subnav'),opexParent=opexSub?.previousElementSibling;if(opexSub&&opexParent?.tagName==='A'){const anyChild=[...opexSub.querySelectorAll('a')].some(a=>getComputedStyle(a).display!=='none');if(isAdmin||allowedModule('opex_detail')||anyChild)opexParent.style.removeProperty('display');else opexParent.style.setProperty('display','none','important');opexParent.href=(isAdmin||allowedModule('opex_detail'))?'opex.html':'#'}
      const hrSub=nav.querySelector('.hr-subnav'),hrParent=hrSub?.previousElementSibling;if(hrSub&&hrParent?.tagName==='A'){const anyChild=[...hrSub.querySelectorAll('a')].some(a=>getComputedStyle(a).display!=='none');if(isAdmin||anyChild)hrParent.style.removeProperty('display');else hrParent.style.setProperty('display','none','important')}
      nav.querySelectorAll('.nav-section').forEach(s=>{if(String(s.textContent||'').trim().toUpperCase()==='ADMIN'){let el=s.nextElementSibling,show=false;while(el&&!el.classList.contains('nav-section')){if(el.tagName==='A'&&el.style.display!=='none')show=true;el=el.nextElementSibling}s.style.display=show?'':'none'}});
    }
    const allowed=Array.isArray(p.departments)?p.departments.filter(Boolean):(p.department?[p.department]:[]),all=isAdmin||allowed.includes('ALL');
    const restrictDepartmentSelect=()=>{
      const sel=document.getElementById('deptFilter');if(!sel||all||!allowed.length)return;
      const allowedSet=new Set(allowed.map(String));
      [...sel.options].forEach(o=>{if(o.value&&!allowedSet.has(String(o.value)))o.remove()});
      if(!allowedSet.has(String(sel.value||''))){const next=[...sel.options].find(o=>o.value&&allowedSet.has(String(o.value)));if(next){sel.value=next.value;sel.dispatchEvent(new Event('change',{bubbles:true}))}}
      if(allowed.length===1)sel.disabled=true;
    };
    restrictDepartmentSelect();
    const sel=document.getElementById('deptFilter');if(sel&&!all){let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(restrictDepartmentSelect,0)}).observe(sel,{childList:true})}
  }
  function ensureFirebaseSession(){
    const path=(location.pathname.split('/').pop()||'').toLowerCase();if(path==='login.html'||path==='')return;
    if(document.querySelector('script[src*="js/firebase.js"]'))return;
    const s=document.createElement('script');s.type='module';s.src='js/firebase.js?v=20260817-budget-notifications-9';document.head.appendChild(s);
  }

  function setupShell(){
    const lo=document.getElementById('logoutBtn');if(lo)lo.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();try{if(window.DADFirebase)await window.DADFirebase.signOut()}catch(_){}localStorage.removeItem('dadBudgetCurrentUid');localStorage.removeItem('dadBudgetCurrentEmail');localStorage.removeItem('dadBudgetCurrentProfile');location.replace('login.html')},true);
    const shell=document.querySelector('.app-shell'),side=document.querySelector('.sidebar');if(!shell||!side)return;
    const nav=side.querySelector('.sidebar-nav');
    if(nav){
      nav.querySelectorAll('a').forEach(link=>{
        const label=String(link.textContent||'').trim().toUpperCase();
        if(label.startsWith('OPEX PLANNING'))link.href='opex.html';
        if(label.startsWith('CAPEX PLANNING'))link.href='capex.html';
        if(label==='PROJECTS')link.href='projects.html';
      });
    }
    if(nav&&!nav.querySelector('a[href="data-admin.html"]')){const s=document.createElement('div');s.className='nav-section';s.textContent='ADMIN';const a=document.createElement('a');a.href='data-admin.html';a.textContent='Data Admin';nav.append(s,a)}
    if(nav&&!nav.querySelector('a[href="it-planning.html"]')){const capex=nav.querySelector('a[href="capex.html"]'),a=document.createElement('a');a.href='it-planning.html';a.textContent='IT Planning';if(capex)capex.after(a);else nav.appendChild(a)}
    if(nav&&!nav.querySelector('a[href="projects.html"]')){const it=nav.querySelector('a[href="it-planning.html"]'),a=document.createElement('a');a.href='projects.html';a.textContent='Projects';if(it)it.after(a);else nav.appendChild(a)}
    if(nav&&!nav.querySelector('.hr-subnav')){
      const headcount=nav.querySelector('a[href="hr-budget.html"]')||document.createElement('a'),parent=document.createElement('a'),subnav=document.createElement('div'),capex=nav.querySelector('a[href="capex.html"]');headcount.href='hr-budget.html';headcount.textContent='Headcount';parent.href='#';parent.textContent='HR Planning';subnav.className='hr-subnav';subnav.appendChild(headcount);if(capex){nav.insertBefore(parent,capex);nav.insertBefore(subnav,capex)}else nav.append(parent,subnav)
    }
    const globalHrSub=side.querySelector('.hr-subnav');
    if(globalHrSub&&!globalHrSub.querySelector('a[href="hr-salaries.html"]')){const salaries=document.createElement('a');salaries.href='hr-salaries.html';salaries.textContent='Salaries Budget';globalHrSub.appendChild(salaries)}
    const sub=side.querySelector('.opex-subnav');
    if(sub){
      const parent=sub.previousElementSibling;
      if(parent&&parent.tagName==='A'){
        if(!sub.querySelector('a[href="opex.html"]')){const detail=document.createElement('a');detail.href='opex.html';detail.textContent='OPEX Detail';sub.prepend(detail)}
        if(!sub.querySelector('a[href="training-expense.html"]')){const training=document.createElement('a');training.href='training-expense.html';training.textContent='Training Expense';sub.append(training)}
        parent.classList.add('opex-parent-toggle');
        if(!parent.querySelector('.opex-nav-caret')){const c=document.createElement('span');c.className='opex-nav-caret';c.textContent='▾';parent.appendChild(c)}
        const path=(location.pathname.split('/').pop()||'').toLowerCase(),opexPage=['opex.html','opex-summary.html','ap-budget.html','travel-budget.html','training-expense.html'].includes(path);
        const stored=localStorage.getItem('dadBudgetOPEXNavOpen');
        const open=stored===null?opexPage:stored==='true';
        sub.classList.toggle('opex-subnav-open',open);parent.classList.toggle('opex-parent-open',open);
        parent.addEventListener('click',e=>{const href=parent.getAttribute('href');if(href&&href!=='#')return;e.preventDefault();const next=!sub.classList.contains('opex-subnav-open');sub.classList.toggle('opex-subnav-open',next);parent.classList.toggle('opex-parent-open',next);localStorage.setItem('dadBudgetOPEXNavOpen',next?'true':'false')});
        const st=document.createElement('style');st.textContent='.opex-parent-toggle{display:flex!important;align-items:center;justify-content:space-between}.opex-nav-caret{font-size:10px;transition:transform .18s ease}.opex-parent-open .opex-nav-caret{transform:rotate(180deg)}.opex-subnav{display:none!important}.opex-subnav.opex-subnav-open{display:block!important}';document.head.appendChild(st);
      }
    }
    const hrSub=side.querySelector('.hr-subnav');
    if(hrSub){
      const parent=hrSub.previousElementSibling;
      if(parent&&parent.tagName==='A'){
        parent.href='#';parent.classList.add('hr-parent-toggle');
        if(!parent.querySelector('.hr-nav-caret')){const c=document.createElement('span');c.className='hr-nav-caret';c.textContent='▾';parent.appendChild(c)}
        const path=(location.pathname.split('/').pop()||'').toLowerCase(),hrPage=['hr-budget.html','hr-salaries.html'].includes(path),stored=localStorage.getItem('dadBudgetHRNavOpen'),open=stored===null?hrPage:stored==='true';
        hrSub.classList.toggle('hr-subnav-open',open);parent.classList.toggle('hr-parent-open',open);
        parent.addEventListener('click',e=>{e.preventDefault();const next=!hrSub.classList.contains('hr-subnav-open');hrSub.classList.toggle('hr-subnav-open',next);parent.classList.toggle('hr-parent-open',next);localStorage.setItem('dadBudgetHRNavOpen',next?'true':'false')});
        const st=document.createElement('style');st.textContent='.hr-parent-toggle{display:flex!important;align-items:center;justify-content:space-between}.hr-nav-caret{font-size:10px;transition:transform .18s ease}.hr-parent-open .hr-nav-caret{transform:rotate(180deg)}.hr-subnav{display:none!important;margin:-3px 10px 6px 22px;padding-left:10px;border-left:1px solid rgba(255,255,255,.18)}.hr-subnav.hr-subnav-open{display:block!important}.hr-subnav a{display:block;padding:8px 10px;margin:2px 0;font-size:12px;border-radius:7px;color:rgba(255,255,255,.76)}';document.head.appendChild(st);
      }
    }
    let b=side.querySelector('.sidebar-toggle');if(!b){b=document.createElement('button');b.type='button';b.className='sidebar-toggle';b.title='Open / Close Sidebar';b.textContent='‹';side.appendChild(b)}
    if(localStorage.getItem('dadBudgetSidebarCollapsed')==='true')shell.classList.add('sidebar-collapsed');
    b.addEventListener('click',()=>{shell.classList.toggle('sidebar-collapsed');localStorage.setItem('dadBudgetSidebarCollapsed',shell.classList.contains('sidebar-collapsed')?'true':'false')});
    applyCachedAccess();ensureFirebaseSession();
  }

  function clearIMS(){let meta=null;try{meta=JSON.parse(localStorage.getItem(META)||'null')}catch(e){};for(let i=0;i<n(meta?.chunkCount);i++)localStorage.removeItem(PREFIX+i);localStorage.removeItem(META);localStorage.removeItem(BASE);localStorage.removeItem('dadBudgetIMSSalesData')}
  function saveIMS(payload){clearIMS();const rows=payload.rows||[],count=Math.ceil(rows.length/CHUNK_SIZE);for(let i=0;i<count;i++)localStorage.setItem(PREFIX+i,JSON.stringify(rows.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE)));const meta={...payload,rows:undefined,chunked:true,chunkSize:CHUNK_SIZE,chunkCount:count,rowCount:rows.length};delete meta.rows;localStorage.setItem(META,JSON.stringify(meta));localStorage.setItem(BASE,JSON.stringify({chunked:true,chunkSize:CHUNK_SIZE,chunkCount:count,rowCount:rows.length}));return meta}
  function loadMeta(){try{return JSON.parse(localStorage.getItem(META)||'null')}catch(e){return null}}
  function loadAllRows(){const m=loadMeta();if(!m)return[];const out=[];for(let i=0;i<n(m.chunkCount);i++){try{const a=JSON.parse(localStorage.getItem(PREFIX+i)||'[]');if(Array.isArray(a))out.push(...a)}catch(e){}}return out}

  function findHeaderRow(matrix){for(let i=0;i<Math.min(matrix.length,15);i++){const h=(matrix[i]||[]).map(v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' '));if(h.includes('region')&&h.includes('country')&&h.includes('agent')&&h.includes('sku')&&h.includes('total qty'))return i}return-1}
  function hidx(h,names){const c=h.map(v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' '));for(const x of names){const i=c.indexOf(x.toLowerCase());if(i>=0)return i}return-1}
  function bonus(v){const x=n(v);return Math.abs(x)<=1?x*100:x}

  function parseReductionSheets(wb){
    const rates={},exceptions={};let rateRows=0,exceptionRows=0;
    const redName=wb.SheetNames.find(x=>norm(x)==='REDUCTION');
    if(redName){const mx=XLSX.utils.sheet_to_json(wb.Sheets[redName],{header:1,defval:'',raw:true});for(let i=1;i<mx.length;i++){const r=mx[i]||[],channel=String(r[0]??'').trim(),market=String(r[1]??'').trim(),kind=String(r[3]??'').trim();if(!channel||!market||!kind)continue;rates[`${norm(channel)}|${norm(market)}|${norm(kind)}`]=rateFraction(r[2]);rateRows++}}
    const exName=wb.SheetNames.find(x=>{const z=norm(x);return (z.includes('OMDS')||z.includes('ROYA'))&&z.includes('COMMISION')});
    if(exName){const mx=XLSX.utils.sheet_to_json(wb.Sheets[exName],{header:1,defval:'',raw:true});for(let i=1;i<mx.length;i++){const r=mx[i]||[],sku=String(r[0]??'').trim(),agent=String(r[2]??'').trim();if(!sku||!agent)continue;exceptions[`${norm(agent)}|${norm(sku)}`]=rateFraction(r[1]);exceptionRows++}}
    return{rates,exceptions,rateRows,exceptionRows,rateSheet:redName||'',exceptionSheet:exName||''};
  }

  function parseFTEValue(v){const raw=String(v??'').trim();if(!raw)return{value:0,invalid:false,fixed:false};const clean=raw.replace(/,/g,'');const exact=Number(clean);if(Number.isFinite(exact))return{value:exact,invalid:false,fixed:false};const m=clean.match(/^(-?\d+)\.\.(\d+)$/);if(m){const fixed=Number(`${m[1]}.${m[2]}`);return{value:Number.isFinite(fixed)?fixed:0,invalid:false,fixed:true}}return{value:0,invalid:true,fixed:false}}

  function parseFTESheets(wb){
    const costName=wb.SheetNames.find(x=>norm(x)==='FTECOST');
    const distName=wb.SheetNames.find(x=>norm(x)==='FTEDIS'||norm(x)==='FTEDISTRIBUTION');
    const costs=[],distribution={};let costRows=0,distributionRows=0,invalidValues=0,autoFixedValues=0;
    if(costName){const mx=XLSX.utils.sheet_to_json(wb.Sheets[costName],{header:1,defval:'',raw:true});const hi=mx.findIndex(r=>{const h=(r||[]).map(norm);return h.includes('MARKET')&&h.includes('POSITION')&&h.includes('TOTALANNUALSALARY')});if(hi>=0){const h=(mx[hi]||[]).map(norm),marketI=h.indexOf('MARKET'),positionI=h.indexOf('POSITION'),annualI=h.indexOf('TOTALANNUALSALARY');for(let i=hi+1;i<mx.length;i++){const r=mx[i]||[],market=String(r[marketI]??'').trim(),position=String(r[positionI]??'').trim();if(!market&&!position)continue;costs.push({market,position,totalAnnual:n(r[annualI])});costRows++}}}
    if(distName){const mx=XLSX.utils.sheet_to_json(wb.Sheets[distName],{header:1,defval:'',raw:true});const hi=mx.findIndex(r=>{const h=(r||[]).map(norm);return h.includes('MARKET')&&h.includes('CHANNEL')&&h.includes('BRAND')&&h.includes('FTE')&&h.includes('SUPERVISOR')});if(hi>=0){const h=(mx[hi]||[]).map(norm),marketI=h.indexOf('MARKET'),channelI=h.indexOf('CHANNEL'),categoryI=h.indexOf('PRODUCTCATEGORY'),brandI=h.indexOf('BRAND'),fteI=h.indexOf('FTE'),supI=h.indexOf('SUPERVISOR');for(let i=hi+1;i<mx.length;i++){const r=mx[i]||[],market=String(r[marketI]??'').trim(),channel=String(r[channelI]??'').trim(),category=categoryI>=0?String(r[categoryI]??'').trim():'',brand=String(r[brandI]??'').trim();if(!market&&!channel&&!brand)continue;const mr=parseFTEValue(r[fteI]),sup=parseFTEValue(r[supI]);if(mr.invalid)invalidValues++;if(sup.invalid)invalidValues++;if(mr.fixed)autoFixedValues++;if(sup.fixed)autoFixedValues++;const key=`${marketNorm(market)}|${norm(channel)}|${norm(brand)}`;if(!distribution[key])distribution[key]={market,channel,category,brand,mrFTE:0,supervisorFTE:0};distribution[key].mrFTE+=mr.value;distribution[key].supervisorFTE+=sup.value;distributionRows++}}}
    return{costs,distribution,costRows,distributionRows,invalidValues,autoFixedValues,costSheet:costName||'',distributionSheet:distName||''};
  }

  async function parseIMS(file){
    if(typeof XLSX==='undefined')throw new Error('Excel reader is not loaded');
    const data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array'}),sn=wb.SheetNames.find(x=>String(x).trim().toUpperCase()==='B26')||wb.SheetNames[0],mx=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:true}),hi=findHeaderRow(mx);
    if(hi<0)throw new Error('B26 sales headers were not found');
    const h=mx[hi],ix={region:hidx(h,['Region']),type:hidx(h,['Type']),country:hidx(h,['Country']),subMarket:hidx(h,['Sub Market']),agent:hidx(h,['Agent']),sector:hidx(h,['Sector']),brand:hidx(h,['Brand']),sku:hidx(h,['SKU']),category:hidx(h,['Product Category']),price:hidx(h,['Price USD']),totalQty:hidx(h,['Total QTY']),bonus:hidx(h,['B26 Bonus %','Bonus %'])};
    const mi=MONTHS.map(m=>hidx(h,[m]));if([ix.region,ix.country,ix.agent,ix.sku,ix.price,ix.totalQty,...mi].some(i=>i<0))throw new Error('Required IMS columns are missing');
    const rows=[];let tq=0,ts=0,mm=0;
    for(let r=hi+1;r<mx.length;r++){const x=mx[r]||[],sku=String(x[ix.sku]??'').trim(),country=String(x[ix.country]??'').trim(),agent=String(x[ix.agent]??'').trim();if(!sku&&!country&&!agent)continue;const months=mi.map(i=>n(x[i])),calc=months.reduce((a,b)=>a+b,0),src=n(x[ix.totalQty]);if(Math.abs(calc-src)>.0001)mm++;const price=n(x[ix.price]),use=src||calc,sales=months.map(q=>q*price),row={region:String(x[ix.region]??'').trim(),type:ix.type>=0?String(x[ix.type]??'').trim():'',country,subMarket:ix.subMarket>=0?String(x[ix.subMarket]??'').trim():'',agent,sector:ix.sector>=0?String(x[ix.sector]??'').trim():'',brand:ix.brand>=0?String(x[ix.brand]??'').trim():'',sku,category:ix.category>=0?String(x[ix.category]??'').trim():'',price,months,totalQty:use,sourceTotalQty:src,bonusPct:ix.bonus>=0?bonus(x[ix.bonus]):0,sales,totalSales:use*price};rows.push(row);tq+=use;ts+=row.totalSales}
    if(!rows.length)throw new Error('No IMS sales rows were found');
    const reductions=parseReductionSheets(wb),fte=parseFTESheets(wb);
    return{version:7,fileName:file.name,uploadedAt:new Date().toISOString(),sheetName:sn,rows,reductions,fte,validation:{rows:rows.length,totalQty:tq,totalSales:ts,totalQtyMismatches:mm}};
  }

  function setupAdminUpload(){
    const input=document.getElementById('imsInput');if(!input)return;
    input.addEventListener('change',async e=>{e.stopImmediatePropagation();const file=e.target.files?.[0];if(!file)return;const st=document.getElementById('imsStatus'),fe=document.getElementById('imsFile');try{if(st){st.textContent='Reading...';st.classList.remove('ready','error')}const payload=await parseIMS(file),reductions=payload.reductions||{rates:{},exceptions:{}},fte=payload.fte||{costs:[],distribution:{}};localStorage.setItem(REDUCTION_KEY,JSON.stringify(reductions.rates||{}));localStorage.setItem(EXCEPTION_KEY,JSON.stringify(reductions.exceptions||{}));localStorage.setItem(FTE_COST_KEY,JSON.stringify({rows:fte.costs||[],sheet:fte.costSheet||''}));localStorage.setItem(FTE_DIST_KEY,JSON.stringify({map:fte.distribution||{},sheet:fte.distributionSheet||''}));const savePayload={...payload};delete savePayload.reductions;delete savePayload.fte;const meta=saveIMS(savePayload);localStorage.setItem('dadBudgetIMSFileName',file.name);localStorage.setItem('dadBudgetAdmin_ims',JSON.stringify({name:file.name,updated:payload.uploadedAt,rows:payload.validation.rows,totalQty:payload.validation.totalQty,totalSales:payload.validation.totalSales,mismatches:payload.validation.totalQtyMismatches,chunks:meta.chunkCount,reductionRows:reductions.rateRows||0,commissionExceptions:reductions.exceptionRows||0,fteCostRows:fte.costRows||0,fteDistributionRows:fte.distributionRows||0,fteInvalidValues:fte.invalidValues||0,fteAutoFixedValues:fte.autoFixedValues||0,statusText:`${payload.validation.rows} rows • Sales + Reductions + FTE`}));if(fe)fe.textContent=file.name;if(st){st.textContent=`${payload.validation.rows} rows • Sales + Reductions + FTE`;st.classList.add('ready')}alert(`Main Budget workbook loaded successfully\n\nSales rows: ${payload.validation.rows.toLocaleString()}\nReduction rows: ${(reductions.rateRows||0).toLocaleString()}\nSpecial commission SKUs: ${(reductions.exceptionRows||0).toLocaleString()}\nFTE Cost rows: ${(fte.costRows||0).toLocaleString()}\nFTE Distribution rows: ${(fte.distributionRows||0).toLocaleString()}\nFTE values auto-fixed: ${(fte.autoFixedValues||0).toLocaleString()}\nFTE invalid values: ${(fte.invalidValues||0).toLocaleString()}\nTotal QTY: ${qty(payload.validation.totalQty)}\nTotal Sales USD: ${money(payload.validation.totalSales)}\nQTY check issues: ${payload.validation.totalQtyMismatches}`)}catch(err){if(st){st.textContent='Upload error';st.classList.add('error')}alert('IMS upload error: '+err.message)}finally{input.value=''}},true);
    const m=loadMeta();if(m){const st=document.getElementById('imsStatus'),fe=document.getElementById('imsFile');if(fe)fe.textContent=m.fileName||'Loaded file';if(st){st.textContent=`${n(m.rowCount)} rows • loaded`;st.classList.add('ready')}}
  }

  function setupIMS(){
    const table=document.getElementById('budgetTable');if(!table)return;
    const tbody=table.tBodies[0],wrap=document.querySelector('.table-wrap'),meta=loadMeta(),all=loadAllRows();
    const costMap=(()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCostMaster')||'{}')||{}}catch(e){return{}}})();
    const costBreakdown=(()=>{try{return JSON.parse(localStorage.getItem('dadBudgetCostBreakdown')||'{}')?.map||{}}catch(e){return{}}})();
    const rateMap=(()=>{try{return JSON.parse(localStorage.getItem(REDUCTION_KEY)||'{}')||{}}catch(e){return{}}})();
    const exceptionMap=(()=>{try{return JSON.parse(localStorage.getItem(EXCEPTION_KEY)||'{}')||{}}catch(e){return{}}})();
    const fteCosts=(()=>{try{return JSON.parse(localStorage.getItem(FTE_COST_KEY)||'{}')?.rows||[]}catch(e){return[]}})();
    const fteDist=(()=>{try{return JSON.parse(localStorage.getItem(FTE_DIST_KEY)||'{}')?.map||{}}catch(e){return{}}})();
    let filtered=all,page=0;const PAGE=250;

    const style=document.createElement('style');style.textContent=`.budget-table tbody tr:not(.total-row):hover td{font-weight:900!important;color:#063f3d!important;background:#e6fffb!important;text-shadow:0 0 7px rgba(20,225,205,.72);box-shadow:inset 0 0 14px rgba(28,222,202,.22)}.reduction-group{background:#8b5a43!important}.reduction-head{background:#744936!important;color:#fff!important}.reduction-pct,.reduction-usd{font-weight:900!important}.net-sales-group,.net-sales-head{background:#1f6673!important;color:#fff!important}.gp-group,.gp-head,.gp-pct-head{background:#176d63!important;color:#fff!important}.fte-group,.fte-head{background:#31566e!important;color:#fff!important}.fte-value{font-weight:900!important}.fte-cost-local{font-weight:900!important;color:#274f69!important}.direct-cost-group,.direct-cost-head{background:#514d70!important;color:#fff!important}.fte-sep,.reduction-sep,.direct-cost-sep,.fte-sep-head,.reduction-sep-head,.direct-cost-sep-head{min-width:18px!important;width:18px!important;max-width:18px!important;padding:0!important;background:#eef2f2!important}.ims-chunk-nav{display:flex;align-items:center;gap:7px}.ims-chunk-nav button{border:1px solid #b9dcd8;background:#fff;color:#0b6661;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:900}.ims-chunk-nav button:disabled{opacity:.4;cursor:default}.ims-chunk-nav span{font-size:10px;color:#60777c;font-weight:800}.special-commission{background:#fff4dd!important;color:#825a13!important}`;document.head.appendChild(style);

    const group=table.querySelector('thead .group-row'),head=table.querySelector('thead .column-row'),costGroup=table.querySelector('.cost-group');
    if(!head.querySelector('.bonus-head')){const g=document.createElement('th');g.className='bonus-group';g.colSpan=2;g.textContent='BONUS 2026';group.insertBefore(g,costGroup);const h1=document.createElement('th'),h2=document.createElement('th');h1.className='bonus-head';h1.textContent='Bonus %';h2.className='bonus-head';h2.textContent='Bonus QTY';head.children[35].after(h1,h2)}
    if(!head.querySelector('.reduction-head')){const g=document.createElement('th');g.className='reduction-group';g.colSpan=8;g.textContent='REDUCTIONS';group.insertBefore(g,costGroup);let a=[...head.children].find(x=>x.textContent.trim()==='Bonus QTY');[['Commission %','commission-pct'],['Commission USD','commission-usd'],['','reduction-sep'],['Returns %','returns-pct'],['Returns USD','returns-usd'],['','reduction-sep'],['Discount %','discount-pct'],['Discount USD','discount-usd']].forEach(([t,c])=>{const th=document.createElement('th');th.className='reduction-head '+(c.includes('sep')?'reduction-sep-head ':'')+c;th.textContent=t;a.after(th);a=th})}
    if(!head.querySelector('.net-sales-head')){const g=document.createElement('th');g.className='net-sales-group';g.colSpan=1;g.textContent='NET SALES';group.insertBefore(g,costGroup);const h=document.createElement('th');h.className='net-sales-head';h.textContent='Net Sales';[...head.children].find(x=>x.textContent.trim()==='Discount USD').after(h)}
    if(!head.querySelector('.gp-head')){const g=document.createElement('th');g.className='gp-group';g.colSpan=2;g.textContent='PROFITABILITY';group.appendChild(g);const a=document.createElement('th'),b=document.createElement('th');a.className='gp-head';a.textContent='Gross Profit';b.className='gp-pct-head';b.textContent='GP%';head.append(a,b)}
    if(!head.querySelector('.fte-head')){const g=document.createElement('th');g.className='fte-group';g.colSpan=7;g.textContent='FTE / PRODUCT';group.appendChild(g);let a=head.querySelector('.gp-pct-head');[['MR FTE','fte-mr-pct'],['MR Cost','fte-mr-usd'],['','fte-sep'],['SUP FTE','fte-mgr-pct'],['SUP Cost','fte-mgr-usd'],['','fte-sep'],['Total FTE Cost','fte-total-head']].forEach(([t,c])=>{const th=document.createElement('th');th.className='fte-head '+(c.includes('sep')?'fte-sep-head ':'')+c;th.textContent=t;a.after(th);a=th})}
    if(!head.querySelector('.direct-cost-head')){const g=document.createElement('th');g.className='direct-cost-group';g.colSpan=7;g.textContent='DIRECT COSTS / PROFIT';group.appendChild(g);let a=head.querySelector('.fte-total-head');[['B26 Samples QTY','samples-qty-head'],['B26 Samples USD','samples-usd-head'],['','direct-cost-sep-head'],['A&P USD $','ap-head'],['','direct-cost-sep-head'],['Profit after direct costs','profit-direct-head'],['Net Profit %','net-profit-pct-head']].forEach(([t,c])=>{const th=document.createElement('th');th.className='direct-cost-head '+c;th.textContent=t;a.after(th);a=th})}

    const td=(t,c='')=>{const x=document.createElement('td');x.textContent=t;x.className=c;return x};
    function reductionFor(r){const channel=norm(r.sector),market=norm(r.region),get=kind=>n(rateMap[`${channel}|${market}|${norm(kind)}`]);let commission=get('Commissions'),special=false;const exKey=`${norm(r.agent)}|${norm(r.sku)}`;if(Object.prototype.hasOwnProperty.call(exceptionMap,exKey)){commission=n(exceptionMap[exKey]);special=true}const returns=get('Returns'),discount=get('Discounts'),base=n(r.totalSales),commissionUsd=-(base*commission),returnsUsd=-(base*returns),discountUsd=-(base*discount),netSales=base+commissionUsd+returnsUsd+discountUsd;return{commission,returns,discount,commissionUsd,returnsUsd,discountUsd,netSales,special}}
    function costFor(r){const key=norm(r.sku),stored=n(costMap[key]);if(stored)return stored;const d=costBreakdown[key]||{};return ['RM','PM','Direct DL','Direct OH','In-Direct DL','In-Direct OH'].reduce((s,k)=>s+n(d[k]),0)}
    const brandSales={};all.forEach(r=>{const k=`${marketNorm(r.country)}|${norm(r.sector)}|${norm(r.brand)}`;brandSales[k]=(brandSales[k]||0)+n(r.totalSales)});
    const fteProfile={};fteCosts.forEach(r=>{const mk=marketNorm(r.market),p=norm(r.position),annual=n(r.totalAnnual);if(!mk||!annual)return;let type='';if(p.includes('MEDICALREPRESENTATIVE'))type='mr';else if(p.includes('SUPERVISOR'))type='sup';if(!type)return;const key=`${mk}|${type}`;if(!fteProfile[key])fteProfile[key]={sum:0,count:0};fteProfile[key].sum+=annual;fteProfile[key].count++});Object.values(fteProfile).forEach(x=>x.avg=x.count?x.sum/x.count:0);
    function fteFor(r){const k=`${marketNorm(r.country)}|${norm(r.sector)}|${norm(r.brand)}`,d=fteDist[k]||{},salesTotal=n(brandSales[k]),share=salesTotal?n(r.totalSales)/salesTotal:0;const mr=n(d.mrFTE)*share,sup=n(d.supervisorFTE)*share;const mrP=fteProfile[`${marketNorm(r.country)}|mr`]||{},supP=fteProfile[`${marketNorm(r.country)}|sup`]||{};const mrCost=mr*n(mrP.avg),supCost=sup*n(supP.avg);return{mr,sup,mrCost,supCost,totalCost:mrCost+supCost,hasAllocation:!!(n(d.mrFTE)||n(d.supervisorFTE)),share}}
    function calcTotals(data){const qm=Array(12).fill(0),sm=Array(12).fill(0);let tq=0,ts=0,bq=0,commissionUsd=0,returnsUsd=0,discountUsd=0,netSales=0,mr=0,mrCost=0,sup=0,supCost=0,totalFteCost=0;data.forEach(r=>{r.months.forEach((v,i)=>qm[i]+=n(v));r.sales.forEach((v,i)=>sm[i]+=n(v));tq+=n(r.totalQty);ts+=n(r.totalSales);bq+=n(r.totalQty)*n(r.bonusPct)/100;const z=reductionFor(r),f=fteFor(r);commissionUsd+=z.commissionUsd;returnsUsd+=z.returnsUsd;discountUsd+=z.discountUsd;netSales+=z.netSales;mr+=f.mr;mrCost+=f.mrCost;sup+=f.sup;supCost+=f.supCost;totalFteCost+=f.totalCost});return{qm,sm,tq,ts,bq,commissionUsd,returnsUsd,discountUsd,netSales,mr,mrCost,sup,supCost,totalFteCost}}
    function rowEl(r){const tr=document.createElement('tr');tr.dataset.sku=r.sku||'';const base=[r.region,r.type,r.country,r.subMarket,r.agent,r.sector,r.brand,r.sku,r.category];base.forEach((v,i)=>tr.appendChild(td(v||'',`text sticky-${i+1}`)));tr.appendChild(td(money(r.price),'price-col sticky-10'));r.months.forEach(v=>tr.appendChild(td(qty(v),'qty-cell')));tr.appendChild(td(qty(r.totalQty),'total-cell'));r.sales.forEach(v=>tr.appendChild(td(money(v),'sales-cell')));tr.appendChild(td(money(r.totalSales),'total-cell'));const bp=n(r.bonusPct),bq=n(r.totalQty)*bp/100;tr.append(td(bp.toFixed(2)+'%','bonus-percent'),td(qty(bq),'bonus-qty'));const z=reductionFor(r);[['commission',z.commission,z.commissionUsd],['returns',z.returns,z.returnsUsd],['discount',z.discount,z.discountUsd]].forEach(([k,rate,usd],i)=>{tr.append(td((rate*100).toFixed(2)+'%',`reduction-pct ${k}-pct${k==='commission'&&z.special?' special-commission':''}`),td(money(usd),`reduction-usd ${k}-usd${usd<0?' negative':''}`));if(i<2)tr.appendChild(td('','reduction-sep'))});tr.appendChild(td(money(z.netSales),'net-sales-cell'+(z.netSales<0?' negative':'')));const cost=costFor(r);tr.appendChild(td(cost?money(cost):'—','cost-unit'+(cost?'':' unmatched-cost')));for(let i=0;i<12;i++)tr.appendChild(td(cost?money(n(r.months[i])*cost):'—','cogs-cell'));const cogs=(n(r.totalQty)+bq)*cost;tr.appendChild(td(cost?money(cogs):'—','cogs-total'));const gp=n(r.totalSales)-(cost?cogs:0);tr.append(td(money(gp),'gp-cell'+(gp<0?' negative':'')),td(z.netSales?(gp/z.netSales*100).toFixed(2)+'%':'—','gp-pct-cell'));const f=fteFor(r);tr.append(td(f.hasAllocation?f.mr.toFixed(3):'0.000','fte-value fte-mr-pct-cell'),td(f.mrCost?money(f.mrCost):'0','fte-cost-local fte-mr-usd-cell'),td('','fte-sep'),td(f.hasAllocation?f.sup.toFixed(3):'0.000','fte-value fte-mgr-pct-cell'),td(f.supCost?money(f.supCost):'0','fte-cost-local fte-mgr-usd-cell'),td('','fte-sep'),td(f.totalCost?money(f.totalCost):'0','fte-cost-local fte-total-cell'));[['0','samples-qty-cell'],['0','samples-usd-cell'],['','direct-cost-sep'],['0','ap-cell'],['','direct-cost-sep'],[money(gp),'profit-direct-cell'],[z.netSales?(gp/z.netSales*100).toFixed(2)+'%':'—','net-profit-pct-cell']].forEach(([t,c])=>tr.appendChild(td(t,c)));return tr}
    function render(){const pages=Math.max(1,Math.ceil(filtered.length/PAGE));if(page>=pages)page=pages-1;const slice=filtered.slice(page*PAGE,(page+1)*PAGE),frag=document.createDocumentFragment();slice.forEach(r=>frag.appendChild(rowEl(r)));const T=calcTotals(filtered),tr=document.createElement('tr');tr.className='total-row';tr.appendChild(td('TOTAL','text sticky-1'));for(let i=2;i<=10;i++)tr.appendChild(td('',`sticky-${i}`));T.qm.forEach(v=>tr.appendChild(td(qty(v))));tr.appendChild(td(qty(T.tq)));T.sm.forEach(v=>tr.appendChild(td(money(v))));tr.appendChild(td(money(T.ts)));tr.append(td('—','bonus-total'),td(qty(T.bq),'bonus-total'));[T.commissionUsd,T.returnsUsd,T.discountUsd].forEach((v,i)=>{const pct=T.ts?Math.abs(v)/T.ts*100:0;tr.append(td(pct.toFixed(2)+'%','reduction-total'),td(money(v),'reduction-total'+(v<0?' negative':'')));if(i<2)tr.appendChild(td('','reduction-sep'))});tr.appendChild(td(money(T.netSales),'net-sales-total'));for(let i=0;i<14;i++)tr.appendChild(td(i===0?'—':'','cost-total-row'));tr.append(td('','gp-total'),td('','gp-pct-total'));tr.append(td(T.mr.toFixed(3),'fte-total-row'),td(money(T.mrCost),'fte-total-row'),td('','fte-sep'),td(T.sup.toFixed(3),'fte-total-row'),td(money(T.supCost),'fte-total-row'),td('','fte-sep'),td(money(T.totalFteCost),'fte-total-row'));for(let i=0;i<7;i++)tr.appendChild(td('',i===2||i===4?'direct-cost-sep':'fte-total-row'));tbody.replaceChildren(frag,tr);document.getElementById('imsEmpty').style.display=filtered.length?'none':'block';document.getElementById('imsRowBadge').textContent=`${filtered.length.toLocaleString()} Rows`;document.getElementById('imsSourceLine').textContent=meta?`${meta.fileName||'IMS Sales'} • ${filtered.length.toLocaleString()} rows • showing ${slice.length} rows`:'No IMS Sales file loaded yet.';navInfo.textContent=`Chunk ${page+1} / ${pages}`;prev.disabled=page<=0;next.disabled=page>=pages-1;if(wrap)wrap.scrollTop=0}
    const badge=document.querySelector('.sheet-badges'),nav=document.createElement('div'),prev=document.createElement('button'),next=document.createElement('button'),navInfo=document.createElement('span');nav.className='ims-chunk-nav';prev.textContent='‹ Prev';next.textContent='Next ›';nav.append(prev,navInfo,next);badge?.prepend(nav);prev.addEventListener('click',()=>{if(page>0){page--;render()}});next.addEventListener('click',()=>{if((page+1)*PAGE<filtered.length){page++;render()}});const ids=[['filterRegion','region'],['filterCountry','country'],['filterAgent','agent'],['filterSector','sector']];ids.forEach(([id,key])=>{const el=document.getElementById(id);[...new Set(all.map(r=>r[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b))).forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)})});function apply(){const rv=document.getElementById('filterRegion').value,cv=document.getElementById('filterCountry').value,av=document.getElementById('filterAgent').value,sv=document.getElementById('filterSector').value,qv=document.getElementById('filterSearch').value.trim().toLowerCase();filtered=all.filter(r=>(!rv||r.region===rv)&&(!cv||r.country===cv)&&(!av||r.agent===av)&&(!sv||r.sector===sv)&&(!qv||String(r.brand).toLowerCase().includes(qv)||String(r.sku).toLowerCase().includes(qv)));page=0;render()}ids.forEach(([id])=>document.getElementById(id).addEventListener('change',apply));document.getElementById('filterSearch').addEventListener('input',apply);document.getElementById('clearFilters').addEventListener('click',()=>{ids.forEach(([id])=>document.getElementById(id).value='');document.getElementById('filterSearch').value='';filtered=all;page=0;render()});render();
  }

  document.addEventListener('DOMContentLoaded',()=>{setupShell();setupAdminUpload();setupIMS();setTimeout(applyCachedAccess,0)});
  window.addEventListener('dad-user-ready',()=>setTimeout(applyCachedAccess,0));
})();
