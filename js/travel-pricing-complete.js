(function(){
'use strict';
const base=window.DADTravelPricing;
if(!base)return;

const norm=value=>String(value??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const clean=value=>String(value??'').trim();
const titleBusiness=title=>['CLEVEL','DIRECTOR'].includes(norm(title));
const sameCountry=(a,b)=>norm(a)&&norm(a)===norm(b);

const sourceRates=(base.rates||[]).map(row=>[...row]);
const sourceTickets=(base.tickets||[]).map(row=>[...row]);
const sourceRateMap=new Map(sourceRates.map(row=>[norm(row[0]),row]));
const jordanRate=sourceRateMap.get('JORDAN')||sourceRates[0]||['Jordan',99,71,21,25,0,14,14,18];
const standardPerDiem=Math.max(1,num(jordanRate[7])||14);
const fallbackRate=[
  'Fallback',
  Math.max(1,num(jordanRate[1])||99),
  Math.max(1,num(jordanRate[2])||71),
  Math.max(1,num(jordanRate[3])||21),
  Math.max(1,num(jordanRate[4])||25),
  Math.max(0,num(jordanRate[5])),
  standardPerDiem,
  Math.max(1,num(jordanRate[7])||14),
  Math.max(1,num(jordanRate[8])||18)
];

function completeRate(name,row){
  const out=row?[...row]:[name,...fallbackRate.slice(1)];
  out[0]=name;
  [1,2,3,4,6,7,8].forEach(index=>{if(num(out[index])<=0)out[index]=fallbackRate[index]});
  return out;
}

const allCountries=[...new Set([...(base.countries||[]),...sourceRates.map(row=>row[0]),...sourceTickets.flatMap(row=>[row[0],row[1]])].map(value=>base.country?base.country(value):clean(value)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const fallbackCountries=new Set();
const rates=allCountries.map(name=>{
  const found=sourceRateMap.get(norm(name));
  if(!found)fallbackCountries.add(norm(name));
  return completeRate(name,found);
});
const rateMap=new Map(rates.map(row=>[norm(row[0]),row]));

const ticketMap=new Map();
sourceTickets.forEach(row=>ticketMap.set(`${norm(row[0])}|${norm(row[1])}`,row));
const standardTicket=sourceTickets.find(row=>norm(row[0])==='JORDAN'&&norm(row[1])==='SAUDIARABIA')||sourceTickets.find(row=>num(row[2])>0&&num(row[3])>0)||['Jordan','Saudi Arabia',993,355];
const fallbackBusinessTicket=Math.max(1,num(standardTicket[2])||993);
const fallbackEconomyTicket=Math.max(1,num(standardTicket[3])||355);

function quote({title,fromCity,destination,numberOfNights}){
  const from=base.country?base.country(fromCity):clean(fromCity),to=base.country?base.country(destination):clean(destination),nights=Math.max(0,Number(numberOfNights)||0),rate=rateMap.get(norm(to))||completeRate(to||'Fallback',null);
  const local=sameCountry(from,to),direct=ticketMap.get(`${norm(from)}|${norm(to)}`),reverse=ticketMap.get(`${norm(to)}|${norm(from)}`),ticket=direct||reverse;
  const ticketAmount=local?0:ticket?(titleBusiness(title)?num(ticket[2]):num(ticket[3])):(titleBusiness(title)?fallbackBusinessTicket:fallbackEconomyTicket);
  const perDiem=Math.max(standardPerDiem,num(rate[6]));
  const amounts={
    '6020001':ticketAmount,
    '6020002':(titleBusiness(title)?num(rate[1]):num(rate[2]))*nights,
    '6020003':num(rate[3])*nights,
    '6020004':num(rate[4])*nights,
    '6020005':num(rate[5]),
    '6020006':local?0:perDiem*nights,
    '6020007':num(rate[7]),
    '6020008':local?perDiem*nights:0,
    '6020009':0,
    '6020010':num(rate[8])
  };
  const calculatedTotal=Object.values(amounts).reduce((sum,value)=>sum+num(value),0),usedFallbackDestination=fallbackCountries.has(norm(to)),usedFallbackRoute=!local&&!ticket;
  return{from,to,hasRoute:local||!!ticket,hasDestinationRate:!usedFallbackDestination,usedFallbackRoute,usedFallbackDestination,unpriced:false,pricingStatus:(usedFallbackRoute||usedFallbackDestination)?'fallback':'fixed',amounts,calculatedTotal,total:calculatedTotal};
}

function excelFormula(row,column){
  const rateRange="'Travel Rates'!$A$2:$I$200",routeKeys="'Travel Rates'!$L$2:$L$200",businessTickets="'Travel Rates'!$M$2:$M$200",economyTickets="'Travel Rates'!$N$2:$N$200";
  const title=`$D${row}`,from=`$E${row}`,destination=`$F${row}`,nights=`$I${row}`,route=`${from}&\"|\"&${destination}`,reverseRoute=`${destination}&\"|\"&${from}`,business=`OR(${title}=\"C Level\",${title}=\"Director\")`,ready=`AND(${title}<>\"\",${from}<>\"\",${destination}<>\"\",${nights}<>\"\")`;
  const rateValue=(index,fallback)=>`IFERROR(VLOOKUP(${destination},${rateRange},${index},FALSE),${fallback})`;
  if(column==='J')return`IF(${ready},IF(${from}=${destination},0,IF(${business},IF(SUMIFS(${businessTickets},${routeKeys},${route})>0,SUMIFS(${businessTickets},${routeKeys},${route}),IF(SUMIFS(${businessTickets},${routeKeys},${reverseRoute})>0,SUMIFS(${businessTickets},${routeKeys},${reverseRoute}),${fallbackBusinessTicket})),IF(SUMIFS(${economyTickets},${routeKeys},${route})>0,SUMIFS(${economyTickets},${routeKeys},${route}),IF(SUMIFS(${economyTickets},${routeKeys},${reverseRoute})>0,SUMIFS(${economyTickets},${routeKeys},${reverseRoute}),${fallbackEconomyTicket})))),\"\")`;
  if(column==='K')return`IF(${ready},IF(${business},${rateValue(2,fallbackRate[1])},${rateValue(3,fallbackRate[2])})*${nights},\"\")`;
  if(column==='L')return`IF(${ready},${rateValue(4,fallbackRate[3])}*${nights},\"\")`;
  if(column==='M')return`IF(${ready},${rateValue(5,fallbackRate[4])}*${nights},\"\")`;
  if(column==='N')return`IF(${ready},${rateValue(6,fallbackRate[5])},\"\")`;
  if(column==='O')return`IF(${ready},IF(${from}<>${destination},MAX(${standardPerDiem},${rateValue(7,standardPerDiem)})*${nights},0),\"\")`;
  if(column==='P')return`IF(${ready},${rateValue(8,fallbackRate[7])},\"\")`;
  if(column==='Q')return`IF(${ready},IF(${from}=${destination},MAX(${standardPerDiem},${rateValue(7,standardPerDiem)})*${nights},0),\"\")`;
  if(column==='R')return`IF(${ready},0,\"\")`;
  if(column==='S')return`IF(${ready},${rateValue(9,fallbackRate[8])},\"\")`;
  return`IF(${ready},0,\"\")`;
}

async function configureExcelJs(workbook,sheet,{cc,rows=[],rowCount=40,months=[]}={}){
  const totalRows=Math.max(rowCount,rows.length),titles=['C Level','Director','Manager','Other'],nightValues=Array.from({length:20},(_,index)=>index+1),calculated=['6020001','6020002','6020003','6020004','6020005','6020006','6020007','6020008','6020009','6020010'];
  for(let index=0;index<totalRows;index++){
    const old=rows[index]||{},q=quote(old),r=sheet.addRow([old.employeeNumber||null,cc,old.employeeName||null,old.title||null,old.fromCity||null,old.destination||null,old.reason||null,old.month||null,old.numberOfNights||null,...Array(10).fill(null)]),started=!!(old.title&&old.fromCity&&old.destination&&old.numberOfNights);
    calculated.forEach((gl,offset)=>{const cell=r.getCell(10+offset),letter=sheet.getColumn(10+offset).letter;cell.value={formula:excelFormula(r.number,letter),result:started?q.amounts[gl]:''};cell.numFmt='#,##0;[Red]-#,##0;–';cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF4FB'}};cell.protection={locked:true}});
    [1,3,4,5,6,7,8,9].forEach(column=>{r.getCell(column).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF9F5'}};r.getCell(column).protection={locked:false}});
  }
  const lists=workbook.getWorksheet('Lists')||workbook.addWorksheet('Lists');lists.state='veryHidden';
  if(lists.rowCount===0)lists.addRow(['Countries','Months','Titles','Number of Nights']);
  allCountries.forEach((value,index)=>lists.getCell(index+2,1).value=value);months.forEach((value,index)=>lists.getCell(index+2,2).value=value);titles.forEach((value,index)=>lists.getCell(index+2,3).value=value);nightValues.forEach((value,index)=>lists.getCell(index+2,4).value=value);
  const oldPricing=workbook.getWorksheet('Travel Rates');if(oldPricing)workbook.removeWorksheet(oldPricing.id);
  const pricing=workbook.addWorksheet('Travel Rates');pricing.state='veryHidden';pricing.addRow(['Destination','Hotel C Level / Director JD','Hotel Manager / Other JD','Transportation JD / Night','Meals JD / Night','Visa JD','Per Diem JD / Night','Insurance JD','Other Cost JD','','','Route','Business Ticket JD','Economy Ticket JD']);
  rates.forEach(row=>pricing.addRow(row));sourceTickets.forEach((row,index)=>{pricing.getCell(index+2,12).value=`${row[0]}|${row[1]}`;pricing.getCell(index+2,13).value=row[2];pricing.getCell(index+2,14).value=row[3]});
  const countryFormula=`Lists!$A$2:$A$${allCountries.length+1}`,monthFormula=`Lists!$B$2:$B$${months.length+1}`;
  for(let r=2;r<=totalRows+1;r++){
    sheet.getCell(r,4).dataValidation={type:'list',allowBlank:false,formulae:['Lists!$C$2:$C$5']};
    sheet.getCell(r,5).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula]};
    sheet.getCell(r,6).dataValidation={type:'list',allowBlank:false,formulae:[countryFormula]};
    sheet.getCell(r,8).dataValidation={type:'list',allowBlank:false,formulae:[monthFormula]};
    sheet.getCell(r,9).dataValidation={type:'list',allowBlank:false,formulae:['Lists!$D$2:$D$21']};
  }
  await sheet.protect('DAD-Travel-2027',{selectLockedCells:true,selectUnlockedCells:true,autoFilter:true});
  return{lists,pricing};
}

window.DADTravelPricing={...base,countries:allCountries,rates,tickets:sourceTickets,quote,configureExcelJs,pricingVersion:'20261018-complete-rates-perdiem-1',fallback:{standardPerDiem,fallbackBusinessTicket,fallbackEconomyTicket,fallbackRate:fallbackRate.slice(1),countries:[...fallbackCountries]}};
})();
