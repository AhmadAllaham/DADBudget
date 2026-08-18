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
  window.DADDepartmentGroups={groups,all:Object.values(groups),groupFor,idsFor,includes};
})();
