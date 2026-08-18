(function(){
  function init(){
    const tasks=window.DAD_ROADMAP_TASKS||[];
    if(!tasks.length)return;
    const parse=s=>new Date(s+'T00:00:00'),today=new Date();
    today.setHours(0,0,0,0);
    const fmt=d=>d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});

    document.querySelectorAll('.sidebar-nav a').forEach(a=>{
      if((a.textContent||'').trim().toLowerCase()==='roadmap')a.href='roadmap.html';
    });
    document.querySelectorAll('button,a').forEach(x=>{
      if((x.textContent||'').trim()==='Open Roadmap'){
        if(x.tagName==='BUTTON')x.onclick=()=>location.href='roadmap.html';
        else x.href='roadmap.html';
      }
    });

    const next=tasks.filter(t=>parse(t.finish)>=today).sort((a,b)=>parse(a.finish)-parse(b.finish))[0];
    const kpi=[...document.querySelectorAll('.kpi-card')].find(x=>x.querySelector('span')?.textContent.trim()==='Next Deadline');
    if(kpi&&next){
      kpi.querySelector('strong').textContent=fmt(parse(next.finish));
      kpi.querySelector('small').textContent=next.task;
    }else if(kpi){
      kpi.querySelector('strong').textContent='Done';
      kpi.querySelector('small').textContent='Roadmap completed';
    }

    const current=tasks.filter(t=>parse(t.start)<=today&&parse(t.finish)>=today).sort((a,b)=>parse(a.finish)-parse(b.finish))[0];
    const road=document.querySelector('.roadmap-line');
    if(road&&current){
      const labels=[...road.querySelectorAll('b')],details=[...road.querySelectorAll('small')];
      if(labels[0])labels[0].textContent='Current';
      if(details[0])details[0].textContent=current.task;
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
