(function(){
  const USD_TO_JD=0.709;
  const norm=value=>String(value??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  const aliases={
    KSA:'Saudi Arabia',SAUDIARABIA:'Saudi Arabia',RIYADH:'Saudi Arabia',JEDDAH:'Saudi Arabia',DAMMAM:'Saudi Arabia',KHOBAR:'Saudi Arabia',ALKHOBAR:'Saudi Arabia',
    UAE:'United Arab Emirates',UNITEDARABEMIRATES:'United Arab Emirates',DUBAI:'United Arab Emirates',ABUDHABI:'United Arab Emirates',SHARJAH:'United Arab Emirates',
    ENGLAND:'United Kingdom',UNITEDKINGDOM:'United Kingdom',LONDON:'United Kingdom',
    PHILIPPINE:'Philippines',PHILIPPINES:'Philippines',MANILA:'Philippines',
    SPHI:'SPHI',
    AMMAN:'Jordan',AQABA:'Jordan',IRBID:'Jordan',ZARQA:'Jordan',MADABA:'Jordan',SALT:'Jordan',ALSALT:'Jordan',JERASH:'Jordan',KARAK:'Jordan',ALKARAK:'Jordan',MAAN:'Jordan',AJLOUN:'Jordan',TAFILA:'Jordan',JORDAN:'Jordan',
    ALGIERS:'Algeria',ALGERIA:'Algeria',DOHA:'Qatar',QATAR:'Qatar',MUSCAT:'Oman',OMAN:'Oman',KUWAITCITY:'Kuwait',KUWAIT:'Kuwait',MANAMA:'Bahrain',BAHRAIN:'Bahrain',
    BAGHDAD:'Iraq',ERBIL:'Iraq',IRAQ:'Iraq',BEIRUT:'Lebanon',LEBANON:'Lebanon',CAIRO:'Egypt',EGYPT:'Egypt',ISTANBUL:'Turkey',ANKARA:'Turkey',TURKEY:'Turkey',
    CASABLANCA:'Morocco',RABAT:'Morocco',MOROCCO:'Morocco',TUNIS:'Tunisia',TUNISIA:'Tunisia',TRIPOLI:'Libya',LIBYA:'Libya',
    ROME:'Italy',MILAN:'Italy',ITALY:'Italy',BUCHAREST:'Romania',ROMANIA:'Romania',DUBLIN:'Ireland',IRELAND:'Ireland',
    DELHI:'India',NEWDELHI:'India',MUMBAI:'India',INDIA:'India',BERLIN:'Germany',FRANKFURT:'Germany',MUNICH:'Germany',GERMANY:'Germany'
  };
  const country=value=>aliases[norm(value)]||String(value??'').trim();
  const jd=value=>Math.round((Number(value)||0)*USD_TO_JD);
  const sourceRates=[
    ['Jordan',140,100,30,35,0,0,20,25],['Algeria',200,100,0,35,0,100,20,25],['Saudi Arabia',220,140,30,35,225,0,20,25],
    ['United Arab Emirates',250,140,30,35,100,0,20,25],['Qatar',140,100,30,35,100,0,20,25],['Oman',140,100,30,35,100,0,20,25],
    ['Kuwait',140,100,30,35,100,0,20,25],['Bahrain',140,100,30,35,100,0,20,25],['SPHI',700,700,100,70,170,0,20,50],
    ['Lebanon',140,100,30,35,0,0,20,25],['Iraq',200,100,30,35,0,0,20,25],['Libya',140,100,30,35,0,0,20,25],
    ['Yemen',140,100,30,35,0,0,20,25],['Tunisia',140,100,30,35,0,0,20,25],['Ireland',450,350,50,50,170,0,20,25],
    ['Italy',450,350,50,50,120,0,20,25],['Turkey',250,140,30,35,0,0,20,25],['Morocco',220,140,30,35,100,0,20,25],
    ['United Kingdom',550,350,50,70,70,0,20,25],['Tanzania',200,100,30,35,0,0,20,25],['Pakistan',140,100,30,35,0,0,20,25],
    ['Egypt',140,100,30,35,0,0,20,25],['Romania',200,100,70,50,170,0,20,25]
  ];
  const sourceTickets=[
    ['Algeria','Morocco',1800,1000],['Algeria','Tanzania',1800,1000],['Algeria','Tunisia',1800,800],['Jordan','Saudi Arabia',1400,500],
    ['Jordan','Algeria',1800,800],['Algeria','Jordan',1800,1000],['Jordan','Iraq',1600,500],['Jordan','Italy',1600,900],
    ['Iraq','Jordan',1600,800],['Jordan','Kuwait',1600,500],['United Arab Emirates','Oman',1600,500],['United Arab Emirates','Kuwait',1600,500],
    ['India','Jordan',1600,900],['Jordan','Turkey',1400,500],['Jordan','Egypt',1400,500],['Jordan','Morocco',1800,1000],
    ['Jordan','India',1800,600],['Jordan','United Kingdom',1800,700],['Qatar','United Arab Emirates',1800,500],['United Arab Emirates','Philippines',1800,800],
    ['Jordan','Germany',1800,700],['Jordan','Oman',1500,500],['Jordan','Qatar',1500,500],['Jordan','Libya',1800,900],
    ['Jordan','United Arab Emirates',1400,500],['Ireland','Jordan',1400,550],['Jordan','Romania',1400,500],['Jordan','SPHI',2200,1200],
    ['Jordan','Tunisia',1800,800]
  ];

  // Existing Jordan standard is the fallback for missing destination components.
  // Visa can legitimately be zero; all other standard travel components receive a usable rate.
  const DEFAULT_RATE_USD=[140,100,30,35,0,20,20,25];
  const DEFAULT_TICKET_USD={business:1400,economy:500};
  function completeUsdRate(row){
    const out=[...row];
    [1,2,3,4,6,7,8].forEach((index)=>{if(Number(out[index])<=0)out[index]=DEFAULT_RATE_USD[index-1]});
    return out;
  }

  const explicitUsdRates=sourceRates.map(row=>completeUsdRate(row));
  const explicitNames=new Set(explicitUsdRates.map(row=>norm(row[0])));
  const routeCountries=[...new Set(sourceTickets.flatMap(row=>[country(row[0]),country(row[1])]))];
  const fallbackCountries=routeCountries.filter(name=>!explicitNames.has(norm(name)));
  const completedUsdRates=[...explicitUsdRates,...fallbackCountries.map(name=>[name,...DEFAULT_RATE_USD])];
  const rates=completedUsdRates.map(row=>[country(row[0]),...row.slice(1).map(jd)]),rateMap=new Map(rates.map(row=>[norm(row[0]),row]));
  const tickets=sourceTickets.map(row=>[country(row[0]),country(row[1]),jd(row[2]),jd(row[3])]);
  const ticketMap=new Map();tickets.forEach(row=>ticketMap.set(`${norm(row[0])}|${norm(row[1])}`,row));
  const countries=[...new Set([...rates.map(r=>r[0]),...tickets.flatMap(r=>[r[0],r[1]])])].sort((a,b)=>a.localeCompare(b));
  const isBusiness=title=>['CLEVEL','DIRECTOR'].includes(norm(title));
  const fallbackBusinessTicket=jd(DEFAULT_TICKET_USD.business),fallbackEconomyTicket=jd(DEFAULT_TICKET_USD.economy),standardPerDiem=jd(DEFAULT_RATE_USD[5]);
  const fallbackRate=DEFAULT_RATE_USD.map(jd);

  function quote({title,fromCity,destination,numberOfNights}){
    const from=country(fromCity),to=country(destination),nights=Math.max(0,Number(numberOfNights)||0),rate=rateMap.get(norm(to))||[to,...fallbackRate],local=!!from&&!!to&&norm(from)===norm(to);
    const direct=ticketMap.get(`${norm(from)}|${norm(to)}`),reverse=ticketMap.get(`${norm(to)}|${norm(from)}`),ticket=direct||reverse;
    const ticketAmount=local?0:ticket?(isBusiness(title)?ticket[2]:ticket[3]):(isBusiness(title)?fallbackBusinessTicket:fallbackEconomyTicket);
    const perDiem=Math.max(standardPerDiem,Number(rate[6])||0);
    const amounts={
      '6020001':ticketAmount,
      '6020002':(isBusiness(title)?rate[1]:rate[2])*nights,
      '6020003':rate[3]*nights,
      '6020004':rate[4]*nights,
      '6020005':rate[5],
      '6020006':local?0:perDiem*nights,
      '6020007':rate[7],
      '6020008':local?perDiem*nights:0,
      '6020009':0,
      '6020010':rate[8]
    };
    const calculatedTotal=Object.values(amounts).reduce((s,v)=>s+v,0),usedFallbackDestination=fallbackCountries.some(name=>norm(name)===norm(to)),usedFallbackRoute=!local&&!ticket;
    return{from,to,hasRoute:local||!!ticket,hasDestinationRate:!usedFallbackDestination,usedFallbackDestination,usedFallbackRoute,unpriced:false,pricingStatus:(usedFallbackDestination||usedFallbackRoute)?'fallback':'fixed',amounts,calculatedTotal,total:calculatedTotal};
  }

  function formulaFor(row,column){
    const rateRange="'Travel Rates'!$A$2:$I$200",routeKeys="'Travel Rates'!$L$2:$L$200",business="'Travel Rates'!$M$2:$M$200",economy="'Travel Rates'!$N$2:$N$200";
    const destination=`$F${row}`,nights=`$I${row}`,title=`$D${row}`,from=`$E${row}`,route=`${from}&\"|\"&${destination}`,reverseRoute=`${destination}&\"|\"&${from}`,businessTitle=`OR(${title}=\"C Level\",${title}=\"Director\")`;
    const ready=`AND(${title}<>\"\",${from}<>\"\",${destination}<>\"\",${nights}<>\"\")`,rateValue=(index,fallback)=>`IFERROR(VLOOKUP(${destination},${rateRange},${index},FALSE),${fallback})`;
    if(column==='J')return`IF(${ready},IF(${from}=${destination},0,IF(${businessTitle},IF(SUMIFS(${business},${routeKeys},${route})>0,SUMIFS(${business},${routeKeys},${route}),IF(SUMIFS(${business},${routeKeys},${reverseRoute})>0,SUMIFS(${business},${routeKeys},${reverseRoute}),${fallbackBusinessTicket})),IF(SUMIFS(${economy},${routeKeys},${route})>0,SUMIFS(${economy},${routeKeys},${route}),IF(SUMIFS(${economy},${routeKeys},${reverseRoute})>0,SUMIFS(${economy},${routeKeys},${reverseRoute}),${fallbackEconomyTicket})))),\"\")`;
    if(column==='K')return`IF(${ready},IF(${businessTitle},${rateValue(2,fallbackRate[0])},${rateValue(3,fallbackRate[1])})*${nights},\"\")`;
    if(column==='L')return`IF(${ready},${rateValue(4,fallbackRate[2])}*${nights},\"\")`;
    if(column==='M')return`IF(${ready},${rateValue(5,fallbackRate[3])}*${nights},\"\")`;
    if(column==='N')return`IF(${ready},${rateValue(6,fallbackRate[4])},\"\")`;
    if(column==='O')return`IF(${ready},IF(${from}<>${destination},MAX(${standardPerDiem},${rateValue(7,standardPerDiem)})*${nights},0),\"\")`;
    if(column==='P')return`IF(${ready},${rateValue(8,fallbackRate[6])},\"\")`;
    if(column==='Q')return`IF(${ready},IF(${from}=${destination},MAX(${standardPerDiem},${rateValue(7,standardPerDiem)})*${nights},0),\"\")`;
    if(column==='R')return`IF(${ready},0,\"\")`;
    if(column==='S')return`IF(${ready},${rateValue(9,fallbackRate[7])},\"\")`;
    return`IF(${ready},0,\"\")`;
  }

  async function configureExcelJs(workbook,sheet,{cc,rows=[],rowCount=40,months=[]}={}){
    const totalRows=Math.max(rowCount,rows.length),titles=['C Level','Director','Manager','Other'],nightValues=Array.from({length:20},(_,i)=>i+1);
    for(let i=0;i<totalRows;i++){
      const old=rows[i]||{},q=quote(old),r=sheet.addRow([old.employeeNumber||null,cc,old.employeeName||null,old.title||null,old.fromCity||null,old.destination||null,old.reason||null,old.month||null,old.numberOfNights||null,...Array(10).fill(null)]);
      const calculated=['6020001','6020002','6020003','6020004','6020005','6020006','6020007','6020008','6020009','6020010'];
      calculated.forEach((gl,index)=>{const cell=r.getCell(10+index),letter=sheet.getColumn(10+index).letter,started=!!(old.title&&old.fromCity&&old.destination&&old.numberOfNights);cell.value={formula:formulaFor(r.number,letter),result:started?q.amounts[gl]:''};cell.numFmt='#,##0;[Red]-#,##0;–';cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF4FB'}};cell.protection={locked:true}});
      [1,3,4,5,6,7,8,9].forEach(col=>{r.getCell(col).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF9F5'}};r.getCell(col).protection={locked:false}});
    }
    const lists=workbook.getWorksheet('Lists')||workbook.addWorksheet('Lists');lists.state='veryHidden';lists.addRow(['Countries','Months','Titles','Number of Nights']);countries.forEach((v,i)=>lists.getCell(i+2,1).value=v);months.forEach((v,i)=>lists.getCell(i+2,2).value=v);titles.forEach((v,i)=>lists.getCell(i+2,3).value=v);nightValues.forEach((v,i)=>lists.getCell(i+2,4).value=v);
    const pricing=workbook.addWorksheet('Travel Rates');pricing.state='veryHidden';pricing.addRow(['Destination','Hotel C Level / Director JD','Hotel Manager / Other JD','Transportation JD / Night','Meals JD / Night','Visa JD','Per Diem JD / Night','Insurance JD','Other Cost JD','','','Route','Business Ticket JD','Economy Ticket JD']);rates.forEach(r=>pricing.addRow(r));tickets.forEach((r,i)=>{pricing.getCell(i+2,12).value=`${r[0]}|${r[1]}`;pricing.getCell(i+2,13).value=r[2];pricing.getCell(i+2,14).value=r[3]});
    const countryFormula=`Lists!$A$2:$A$${countries.length+1}`,monthFormula=`Lists!$B$2:$B$${months.length+1}`;for(let r=2;r<=totalRows+1;r++){sheet.getCell(r,4).dataValidation={type:'list',allowBlank:false,formulae:['Lists!$C$2:$C$5']};sheet.getCell(r,5).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula]};sheet.getCell(r,6).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula]};sheet.getCell(r,8).dataValidation={type:'list',allowBlank:false,formulae:[monthFormula]};sheet.getCell(r,9).dataValidation={type:'list',allowBlank:false,formulae:['Lists!$D$2:$D$21']}}
    await sheet.protect('DAD-Travel-2027',{selectLockedCells:true,selectUnlockedCells:true,autoFilter:true});return{lists,pricing};
  }
  window.DADTravelPricing={USD_TO_JD,countries,rates,tickets,country,quote,configureExcelJs,pricingVersion:'20261018-complete-rates-perdiem-1',fallback:{countries:fallbackCountries,businessTicket:fallbackBusinessTicket,economyTicket:fallbackEconomyTicket,perDiem:standardPerDiem,rate:fallbackRate}};
})();

(function(){
  if(!/opex\.html$/i.test((location.pathname||'').split('?')[0]))return;
  if(document.querySelector('script[data-complete-opex-template]'))return;
  const s=document.createElement('script');s.src='js/opex-template-complete.js?v=20261026-download-init-1';s.dataset.completeOpexTemplate='1';document.head.appendChild(s);
})();
