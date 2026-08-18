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
    PRODUCTION:{key:'PRODUCTION',value:'GROUP:PRODUCTION',label:'Production',ids:productionIds}
  };
  const byValue=Object.fromEntries(Object.values(groups).map(group=>[group.value,group]));
  const groupFor=value=>byValue[String(value||'').trim()]||null;
  const idsFor=value=>groupFor(value)?.ids.slice()||[];
  const includes=(value,fundCenter)=>idsFor(value).includes(String(fundCenter||'').trim());
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
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){close();trigger.focus();return}
      if(event.key!=='Enter')return;const first=[...list.querySelectorAll('.department-combo-option')].find(item=>!item.hidden&&!item.disabled);if(!first)return;first.click();event.preventDefault();
    });
    select.addEventListener('change',()=>{sync();close()});document.addEventListener('click',event=>{if(!host.contains(event.target))close()});new MutationObserver(rebuild).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});rebuild();
  }
  window.DADDepartmentGroups={groups,all:Object.values(groups),groupFor,idsFor,includes,bindSearch};
})();
