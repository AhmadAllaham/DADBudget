// DAD Budget 2027 - IMS Sales downloadable template
(function(){
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-ims-xlsx]');
      if(existing){existing.addEventListener('load',()=>resolve(window.XLSX),{once:true});existing.addEventListener('error',reject,{once:true});return}
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.dataset.imsXlsx='1';
      s.onload=()=>resolve(window.XLSX);
      s.onerror=()=>reject(new Error('Excel template engine could not be loaded.'));
      document.head.appendChild(s);
    });
  }

  function style(ws,widths){ws['!cols']=widths.map(w=>({wch:w}));ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};}

  async function downloadTemplate(btn){
    const old=btn.textContent;
    try{
      btn.disabled=true;btn.textContent='Preparing...';
      const XLSX=await loadXLSX();
      const wb=XLSX.utils.book_new();

      const instructions=[
        ['DAD BUDGET 2027 - IMS SALES TEMPLATE'],
        [],
        ['HOW TO USE'],
        ['1','Fill the B26 sheet. One row should represent one SKU / Agent / Market combination.'],
        ['2','Enter monthly quantities in Jan-Dec. Total QTY is calculated automatically.'],
        ['3','Price USD is the selling price per unit. B26 Bonus % may be entered as 10% or 0.10.'],
        ['4','Optional supporting sheets are included for Reduction, special commissions, FTE Cost and FTE Distribution.'],
        ['5','Keep sheet names and header names unchanged so the system can read the workbook.'],
        ['6','Upload the completed workbook from Data Admin as the Main Budget Workbook.']
      ];
      const iw=XLSX.utils.aoa_to_sheet(instructions);style(iw,[18,95]);XLSX.utils.book_append_sheet(wb,iw,'Instructions');

      const b26Headers=['Region','Type','Country','Sub Market','Agent','Sector','Brand','SKU','Product Category','Price USD',...MONTHS,'Total QTY','B26 Bonus %'];
      const b26=[b26Headers];
      for(let i=0;i<150;i++)b26.push(Array(b26Headers.length).fill(''));
      const bw=XLSX.utils.aoa_to_sheet(b26);
      for(let r=2;r<=151;r++)bw[`W${r}`]={t:'n',f:`SUM(K${r}:V${r})`};
      style(bw,[16,14,18,18,22,16,18,18,22,13,...Array(12).fill(11),13,14]);
      bw['!autofilter']={ref:`A1:X151`};
      XLSX.utils.book_append_sheet(wb,bw,'B26');

      const reduction=[['Channel','Market','Rate','Type'],['','','','Commissions'],['','','','Returns'],['','','','Discounts']];
      const rw=XLSX.utils.aoa_to_sheet(reduction);style(rw,[20,20,14,18]);XLSX.utils.book_append_sheet(wb,rw,'reduction');

      const commission=[['SKU','Commission %','Agent']];for(let i=0;i<50;i++)commission.push(['','','']);
      const cw=XLSX.utils.aoa_to_sheet(commission);style(cw,[22,16,24]);XLSX.utils.book_append_sheet(wb,cw,'roya + omds commision');

      const fteCost=[['Market','Position','Total AnnualSalary']];for(let i=0;i<50;i++)fteCost.push(['','','']);
      const fcw=XLSX.utils.aoa_to_sheet(fteCost);style(fcw,[20,28,22]);XLSX.utils.book_append_sheet(wb,fcw,'FTE Cost');

      const fteDis=[['Market','Channel','Product Category','Brand','FTE','Supervisor']];for(let i=0;i<100;i++)fteDis.push(['','','','','','']);
      const fdw=XLSX.utils.aoa_to_sheet(fteDis);style(fdw,[20,20,22,22,14,14]);XLSX.utils.book_append_sheet(wb,fdw,'FTE Dis');

      XLSX.writeFile(wb,'DAD_Budget_2027_IMS_Sales_Template.xlsx');
    }catch(e){alert('IMS template download failed: '+e.message)}finally{btn.disabled=false;btn.textContent=old}
  }

  function setup(){
    if((location.pathname.split('/').pop()||'').toLowerCase()!=='ims-sales.html')return;
    const actions=document.querySelector('.ims-actions');if(!actions||document.getElementById('imsTemplateBtn'))return;
    const btn=document.createElement('button');
    btn.id='imsTemplateBtn';btn.type='button';btn.className='sales-detail-toggle';btn.textContent='⇩ Download Template';
    btn.title='Download the Budget 2027 IMS Sales workbook template';
    btn.addEventListener('click',()=>downloadTemplate(btn));
    actions.prepend(btn);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
