function replaceText(root=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];let n;
  while((n=walker.nextNode()))nodes.push(n);
  nodes.forEach(node=>{
    const p=node.parentElement;
    if(!p||['SCRIPT','STYLE'].includes(p.tagName))return;
    node.nodeValue=node.nodeValue
      .replace(/Budget YTD 2026/g,'Budget YTD')
      .replace(/Show Budget YTD 2026/g,'Show Budget YTD')
      .replace(/Budget 2027 vs Budget YTD 2026/g,'Budget 2027 vs Budget YTD');
  });
}

function apply(){replaceText(document)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
const observer=new MutationObserver(()=>apply());
observer.observe(document.documentElement,{childList:true,subtree:true});

import('./manager-workflow.js?v=20260817-submit-label-1').catch(e=>console.error('OPEX review workflow failed:',e));
import('./opex-template-all-rows.js?v=20260818-monthly-input-lock-1').catch(e=>console.error('OPEX full template exporter failed:',e));
import('./opex-budget-increase-alerts.js?v=20260817-budget-increase-alerts-1').catch(e=>console.error('OPEX budget increase alerts failed:',e));
import('./opex-approved-hard-lock.js?v=20260817-pending-manager-lock-6').catch(e=>console.error('OPEX workflow hard lock failed:',e));
