// @ts-ignore shared currency helpers
import {currencyLabel,currencySearchText} from '@/modules/fx/convert.js';
export function setupCurrencyPicker(codes:()=>string[],selection:()=>string[],save:(value:string[])=>void){
 const dialog=document.getElementById('fxPicker') as HTMLDialogElement;
 const search=document.getElementById('fxCurrencySearch') as HTMLInputElement;
 const list=document.getElementById('fxCurrencyList')!;
 const status=document.getElementById('fxCurrencyCount')!;
 let chosen=new Set<string>(),available:string[]=[];
 const render=()=>{
  const query=search.value.trim().toLowerCase();list.replaceChildren();
  const matches=available.filter(code=>currencySearchText(code).includes(query));
  for(const code of matches){
   const row=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
   input.type='checkbox';input.checked=chosen.has(code);input.dataset.currency=code;
   text.textContent=currencyLabel(code);input.addEventListener('change',()=>{if(input.checked)chosen.add(code);else chosen.delete(code);count(matches.length);});
   row.append(input,text);list.append(row);
  }
  count(matches.length);
 };
 const count=(shown:number)=>{status.textContent=`전체 ${available.length}개 · 검색 ${shown}개 · 선택 ${chosen.size}개`;};
 document.getElementById('fxManageCurrencies')!.addEventListener('click',()=>{available=codes();chosen=new Set(selection());search.value='';render();dialog.showModal();search.focus();});
 search.addEventListener('input',render);
 document.getElementById('fxSelectAll')!.addEventListener('click',()=>{chosen=new Set(available);render();});
 document.getElementById('fxSelectNone')!.addEventListener('click',()=>{chosen.clear();render();});
 document.getElementById('fxPickerCancel')!.addEventListener('click',()=>dialog.close());
 document.getElementById('fxPickerApply')!.addEventListener('click',()=>{if(available.length)save(available.filter(code=>chosen.has(code)));dialog.close();});
}
