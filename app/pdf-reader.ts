import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type {PdfItem} from './statement-parser';
export async function readPdf(file:File,onPassword:(submit:(password:string)=>void,cancel:()=>void,incorrect:boolean)=>void,onProgress:(message:string)=>void){
 if(file.size>15*1024*1024)throw Error('PDF 大於 15 MB，請先縮小檔案或分開月份。');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});
 task.onPassword=(update:(password:string)=>void,reason:number)=>onPassword(update,()=>{void task.destroy()},reason===pdfjs.PasswordResponses.INCORRECT_PASSWORD);
 try{const doc=await task.promise;if(doc.numPages>50)throw Error('帳單超過 50 頁，請分批匯入。');const pages:PdfItem[][]=[];for(let i=1;i<=doc.numPages;i++){onProgress(`解析第 ${i} / ${doc.numPages} 頁…`);const page=await doc.getPage(i);const content=await page.getTextContent();pages.push(content.items.filter((x):x is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in x).map(x=>({text:x.str,x:x.transform[4],y:x.transform[5],w:x.width})));}return pages}finally{await task.destroy()}
}
