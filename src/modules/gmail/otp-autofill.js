// 인증번호가 복사된 순간, 보고 있는 탭에서 커서가 인증번호 칸에 있으면 번호를 넣고 확인 버튼을 눌러요.
// 웹페이지 안에서 도는 코드라 JavaScript로 써요(브라우저 안에서는 이것만 돼요).
// fillFocusedOtp는 executeScript로 페이지(모든 프레임)에 들어가요. 바깥 변수를 쓰면 안 돼요.
export function fillFocusedOtp(code) {
 const el=document.activeElement;
 if(!(el instanceof HTMLInputElement)||el.disabled||el.readOnly)return {filled:false};
 if(!['text','tel','number'].includes(el.type))return {filled:false};
 const words=[el.autocomplete,el.name,el.id,el.placeholder,el.getAttribute('aria-label'),el.labels?.[0]?.textContent,el.inputMode].join(' ').toLowerCase();
 const hint=/one-time-code|otp|code|verif|auth|pin|token|passcode|인증|확인\s*번호|보안\s*코드|코드/.test(words)&&!/zip|postal|coupon|promo|gift|referr|쿠폰|우편|할인|추천/.test(words);
 const max=el.maxLength>0?el.maxLength:0;
 // 숫자 한 칸씩 나뉜 입력(maxlength=1)이면 같은 묶음의 칸들을 차례로 채워요.
 const group=max===1?[...(el.form||el.parentElement?.parentElement||document).querySelectorAll('input')].filter(i=>i.maxLength===1&&!i.disabled&&!i.readOnly&&['text','tel','number'].includes(i.type)):[];
 const split=group.length>=code.length&&group.indexOf(el)===0;
 if(!split&&!(hint||(max>=code.length&&max<=8&&el.inputMode==='numeric')))return {filled:false};
 if(!split&&max&&max<code.length)return {filled:false};
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
 const put=(input,value)=>{input.focus();setter.call(input,value);input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));input.dispatchEvent(new Event('change',{bubbles:true}));};
 if(split)[...code].forEach((ch,i)=>put(group[i],ch));else put(el,code);
 const target=split?group[code.length-1]:el;
 return new Promise(resolve=>setTimeout(()=>{
  // 사이트가 번호를 받자마자 스스로 넘어갔으면 더 누르지 않아요.
  if(!target.isConnected)return resolve({filled:true,submitted:true});
  const label=b=>(b.textContent||b.value||b.getAttribute('aria-label')||'').trim();
  const usable=b=>!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&b.offsetParent!==null;
  const okWords=/확인|인증|완료|제출|다음|계속|로그인|verify|submit|confirm|continue|next|sign\s*in|log\s*in|done/i;
  const form=target.form;
  let button=form&&[...form.querySelectorAll('button,input[type=submit]')].find(b=>usable(b)&&(b.type==='submit'||okWords.test(label(b))));
  if(!button){let box=target.parentElement;for(let i=0;i<6&&box&&!button;i++,box=box.parentElement)button=[...box.querySelectorAll('button,[role=button],input[type=submit]')].find(b=>usable(b)&&okWords.test(label(b))&&!/취소|cancel|재전송|다시|resend|back|뒤로/i.test(label(b)));}
  if(button){button.click();return resolve({filled:true,submitted:true});}
  if(form&&typeof form.requestSubmit==='function'){try{form.requestSubmit();return resolve({filled:true,submitted:true});}catch{}}
  resolve({filled:true,submitted:false});
 },350));
}

export function createOtpAutofill(chromeApi=chrome) {
 return async code=>{
  try{
   const stored=await chromeApi.storage.local.get('core.mailOtpAutofill');
   if(stored['core.mailOtpAutofill']===false)return {filled:false};
   const win=await chromeApi.windows.getLastFocused({windowTypes:['normal']});
   const [tab]=await chromeApi.tabs.query({active:true,windowId:win.id});
   if(!tab?.id||!/^https?:/.test(tab.url||''))return {filled:false};
   const results=await chromeApi.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:fillFocusedOtp,args:[code]});
   return (results||[]).map(r=>r.result).find(r=>r?.filled)||{filled:false};
  }catch{return {filled:false};}
 };
}
