function installWorkflowGroups(){
  const grid=document.getElementById('submissionStatusGrid');
  if(!grid||grid.dataset.groupingInstalled)return;
  grid.dataset.groupingInstalled='1';

  const host=grid.parentElement;
  const activeWrap=document.createElement('div');
  activeWrap.id='workflowActiveWrap';
  activeWrap.style.marginTop='14px';
  activeWrap.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
      <div><div style="font-size:11px;font-weight:1000;color:#0b756d;letter-spacing:.11em;text-transform:uppercase">Active / In Progress</div><div id="workflowActiveCount" style="font-size:10px;color:#71878b;font-weight:800;margin-top:2px">0 departments</div></div>
    </div>
    <div id="workflowActiveGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px"></div>`;

  const pendingWrap=document.createElement('div');
  pendingWrap.id='workflowNotStartedWrap';
  pendingWrap.style.cssText='margin-top:16px;padding-top:14px;border-top:1px solid #dce9e7';
  pendingWrap.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px">
      <div><div style="font-size:11px;font-weight:1000;color:#667d82;letter-spacing:.11em;text-transform:uppercase">Not Started</div><div id="workflowNotStartedCount" style="font-size:10px;color:#829397;font-weight:800;margin-top:2px">0 departments</div></div>
      <button id="workflowToggleNotStarted" type="button" style="border:1px solid #cfe1de;background:#fff;color:#527078;border-radius:8px;padding:7px 10px;font-size:9px;font-weight:1000;cursor:pointer">Hide</button>
    </div>
    <div id="workflowNotStartedGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:7px"></div>`;

  host.insertBefore(activeWrap,grid);
  host.insertBefore(pendingWrap,grid);
  grid.style.display='none';

  const activeGrid=document.getElementById('workflowActiveGrid');
  const pendingGrid=document.getElementById('workflowNotStartedGrid');
  const activeCount=document.getElementById('workflowActiveCount');
  const pendingCount=document.getElementById('workflowNotStartedCount');
  const toggle=document.getElementById('workflowToggleNotStarted');
  let pendingVisible=true;

  toggle.onclick=()=>{
    pendingVisible=!pendingVisible;
    pendingGrid.style.display=pendingVisible?'grid':'none';
    toggle.textContent=pendingVisible?'Hide':'Show';
  };

  function nameOf(card){
    const children=[...card.children];
    const nameNode=children.find((x,i)=>i>0&&x.textContent.trim()&&x.style.display!=='none');
    return nameNode?.textContent.trim()||'Department';
  }

  function statusOfCard(card){
    const text=card.textContent||'';
    return /Not Submitted/i.test(text)?'not_started':'active';
  }

  let busy=false;
  function regroup(){
    if(busy)return;
    const cards=[...grid.children].filter(x=>x.nodeType===1);
    if(!cards.length)return;
    busy=true;
    try{
      activeGrid.innerHTML='';
      pendingGrid.innerHTML='';
      let a=0,n=0;
      cards.forEach(card=>{
        if(statusOfCard(card)==='not_started'){
          n++;
          const item=document.createElement('div');
          item.style.cssText='border:1px solid #dce8e6;background:#f8fbfb;border-radius:9px;padding:10px 12px;font-size:11px;font-weight:900;color:#36565d;min-height:18px;display:flex;align-items:center';
          item.textContent=nameOf(card);
          pendingGrid.appendChild(item);
        }else{
          a++;
          activeGrid.appendChild(card.cloneNode(true));
        }
      });
      activeCount.textContent=`${a} department${a===1?'':'s'}`;
      pendingCount.textContent=`${n} department${n===1?'':'s'}`;
      if(!a)activeGrid.innerHTML='<div style="padding:14px;border:1px dashed #d4e4e1;border-radius:9px;color:#789094;font-size:10px;font-weight:800">No active departments yet.</div>';
      if(!n)pendingGrid.innerHTML='<div style="padding:12px;color:#087a64;font-size:10px;font-weight:900">All departments have started.</div>';
    }finally{busy=false}
  }

  const obs=new MutationObserver(()=>setTimeout(regroup,0));
  obs.observe(grid,{childList:true,subtree:false});
  regroup();
}

function start(){
  const grid=document.getElementById('submissionStatusGrid');
  if(grid)installWorkflowGroups();
  else setTimeout(start,250);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
