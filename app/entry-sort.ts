import type {Account,Data} from './model';
import {row,value} from './model';
import {isAutoStock,stockGain} from './finance';
export type EntrySortField='name'|'category'|'currency'|'due'|'rate'|'qty'|'buy'|'amount';
export type EntrySort={field:EntrySortField|'';direction:'asc'|'desc'};
export const entrySortLabels:Record<EntrySortField,string>={name:'帳戶 / 項目',category:'類別',currency:'幣別',due:'還款日',rate:'換算台幣',qty:'QTY 數量',buy:'本月新增數量',amount:'台幣金額'};
export function entrySortFields(kind:Account['kind']):EntrySortField[]{return ['name','category','currency',...(kind==='debt'?['due' as const]:[]),'rate','qty',...(kind==='asset'?['buy' as const]:[]),'amount']}
const collator=new Intl.Collator('zh-Hant',{numeric:true,sensitivity:'base'});
export function entrySortValue(d:Data,m:string,a:Account,field:EntrySortField):string|number|null {
 const r=row(d,m,a.id),auto=isAutoStock(a),historic=auto&&!!r.source&&!r.autoStock;
 const missing=auto&&!historic&&stockGain(d,m,a)===null;
 switch(field){
  case 'name':return a.name;
  case 'category':return a.category;
  case 'currency':return a.currency;
  case 'due':return r.dueDate||(a.due?`${m}-${a.due.padStart(2,'0')}`:null);
  case 'rate':return auto?1:r.rate;
  case 'qty':return auto?(missing?null:value(d,m,a)):r.qty;
  case 'buy':return a.kind==='asset'&&(a.symbol||a.category.includes('股票'))?r.buy:null;
  case 'amount':return missing?null:value(d,m,a);
 }
}
export function sortEntryAccounts(accounts:Account[],d:Data,m:string,sort:EntrySort):Account[]{
 if(!sort.field)return [...accounts];
 const field=sort.field;
 return accounts.map((account,index)=>({account,index,key:entrySortValue(d,m,account,field)})).sort((a,b)=>{
  // Blank / unavailable values stay last in either direction.
  if(a.key===null||b.key===null)return a.key===b.key?a.index-b.index:a.key===null?1:-1;
  const compared=typeof a.key==='number'&&typeof b.key==='number'?a.key-b.key:collator.compare(String(a.key),String(b.key));
  return compared===0?a.index-b.index:compared*(sort.direction==='asc'?1:-1);
 }).map(x=>x.account);
}
