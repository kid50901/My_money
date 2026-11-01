import type {Expense,StatementMeta} from './model';
export type PdfItem={text:string;x:number;y:number;w?:number};
export type ParsedStatement={transactions:Expense[];meta:StatementMeta;warnings:string[];verified:boolean};
const hash=(s:string)=>{let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i)}return (a>>>0).toString(16)+(b>>>0).toString(16)};
const amount=(s:string)=>Number(s.replaceAll(',',''));
const moneyPattern=/^-?\d[\d,]*\.\d{2}$/;
const cents=(n:number)=>Math.round(n*100);
function isoDate(s:string){const [d,m,y]=s.split('/').map(Number);let year=y<100?2000+y:y;if(year>2400)year-=543;const result=`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;if(new Date(result+'T00:00:00Z').toISOString().slice(0,10)!==result)throw Error('帳單日期格式無法辨識');return result}
export function parseBangkokStatement(pages:PdfItem[][],fileName:string,rate:number):ParsedStatement {
 const all=pages.flat().map(i=>i.text).join(' ');if(!/Bangkok Bank|ธนาคารกรุงเทพ/i.test(all))throw Error('目前支援 Bangkok Bank 存款帳單（與範本相同格式）。其他銀行或掃描圖片帳單尚無法自動解析。');
 const accountRaw=all.match(/\b\d{3}-\d-\d{5}-\d\b/)?.[0];if(!accountRaw)throw Error('找不到帳號，請使用完整原始銀行 PDF。');
 const currency=(all.match(/\b(?:THB|USD|TWD|JPY|EUR)\b/)||['THB'])[0];
 const period=all.match(/\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}/)?.[0]||'';
 const meta:StatementMeta={id:'statement-'+hash(accountRaw+'|'+period),fileName,account:accountRaw.slice(0,3)+'-*-***'+accountRaw.replaceAll('-','').slice(-3),currency,period,importedAt:new Date().toISOString(),debit:0,credit:0,debitCount:0,creditCount:0};
 const transactions:Expense[]=[],warnings:string[]=[],occurrences=new Map<string,number>();let summaryDebit:number|undefined,summaryCredit:number|undefined,summaryDebitCount:number|undefined,summaryCreditCount:number|undefined;
 for(const page of pages){const lines:{y:number;items:PdfItem[]}[]=[];for(const item of page){if(!item.text.trim())continue;let line=lines.find(l=>Math.abs(l.y-item.y)<1.5);if(!line){line={y:item.y,items:[]};lines.push(line)}line.items.push(item)}lines.sort((a,b)=>b.y-a.y);
  for(const line of lines){const items=line.items.sort((a,b)=>a.x-b.x),text=items.map(x=>x.text).join(' ');
   if(/Total Debit Amount/i.test(text)){summaryDebit=amount(text.match(/Total Debit Amount\s+([\d,]+\.\d{2})/i)?.[1]||'NaN');summaryDebitCount=Number(text.match(/Total No\. of Debits\s+(\d+)/i)?.[1]);}
   if(/Total Credit Amount/i.test(text)){summaryCredit=amount(text.match(/Total Credit Amount\s+([\d,]+\.\d{2})/i)?.[1]||'NaN');summaryCreditCount=Number(text.match(/Total No\. of Credits\s+(\d+)/i)?.[1]);}
   const dateItem=items.find(x=>x.x<56&&/^\d{2}\/\d{2}\/\d{2}(?:\d{2})?$/.test(x.text.trim()));if(!dateItem)continue;
   const description=items.filter(x=>x.x>=55&&x.x<210).map(x=>x.text).join(' ').trim();
   const getAmount=(low:number,high:number)=>{const found=items.filter(x=>x.x>=low&&x.x<high&&moneyPattern.test(x.text.trim()));return found.length?amount(found.map(x=>x.text).join('')):null};
   const balance=getAmount(370,432);if(/^B\/F|BALANCE FORWARD/i.test(description)){if(meta.opening===undefined&&balance!==null)meta.opening=balance;continue}
   const debit=getAmount(210,305),credit=getAmount(305,370);if((debit===null)===(credit===null)){warnings.push(`${dateItem.text} 有無法區分收支的交易，未匯入。`);continue}
   const direction=debit!==null?'debit':'credit',sum=debit??credit!;const date=isoDate(dateItem.text.trim());const via=items.filter(x=>x.x>=432).map(x=>x.text).join(' ');const identity=[accountRaw,date,description,direction,sum,balance].join('|'),n=occurrences.get(identity)||0;occurrences.set(identity,n+1);
   const payment=direction==='debit'&&/PMT|PURCHASE|FEE|CHARGE/i.test(description);const category=payment?(/FEE|CHARGE/i.test(description)?'銀行手續費':'付款（待分類）'):'轉帳（待確認）';
   transactions.push({id:'txn-'+hash(identity+'|'+n),date,description,amount:sum,currency,rate,kind:payment?'expense':'transfer',direction,category,statementId:meta.id,...(balance===null?{}:{balance}),via});
   if(direction==='debit'){meta.debit+=sum;meta.debitCount++}else{meta.credit+=sum;meta.creditCount++}if(balance!==null)meta.closing=balance;
  }
 }
 if(!transactions.length)throw Error('無法擷取交易，檔案可能是掃描圖片或不同版型。請勿將空白結果當成零支出。');
 meta.debit=cents(meta.debit)/100;meta.credit=cents(meta.credit)/100;
 let lastBalance=meta.opening;for(const tx of transactions){if(lastBalance!==undefined&&tx.balance!==undefined&&Math.abs(cents(lastBalance+(tx.direction==='credit'?tx.amount:-tx.amount))-cents(tx.balance))>1){warnings.push(`${tx.date} 餘額核對不符，請確認是否有遺漏交易。`);break}lastBalance=tx.balance}
 const summaryVerified=Number.isFinite(summaryDebit)&&Number.isFinite(summaryCredit)&&Number.isFinite(summaryDebitCount)&&Number.isFinite(summaryCreditCount);
 if(!summaryVerified)warnings.push('缺少帳單末頁的收支合計，無法核對完整性，請上傳完整 PDF。');
 if(summaryVerified&&(cents(summaryDebit!)!==cents(meta.debit)||cents(summaryCredit!)!==cents(meta.credit)||summaryDebitCount!==meta.debitCount||summaryCreditCount!==meta.creditCount))warnings.push('解析筆數／金額與帳單末頁合計不符，為避免資料不完整，請確認 PDF 格式。');
 if(meta.opening===undefined)warnings.push('找不到期初餘額，無法完成餘額核對。');
 return {transactions,meta,warnings,verified:summaryVerified&&!warnings.length};
}
export function mergeTransactions(existing:Expense[],incoming:Expense[]){const ids=new Set(existing.map(x=>x.id));return [...existing,...incoming.filter(x=>!ids.has(x.id))]}
