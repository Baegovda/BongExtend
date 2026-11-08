// 페이지의 닫힌 Shadow DOM 안에만 표시해 사이트 스크립트가 번호를 읽지 못하게 해요.
export function renderCopiedOtpToast(code) {
 document.getElementById('bongextend-otp-toast')?.remove();
 const host=document.createElement('div');host.id='bongextend-otp-toast';
 host.style.cssText='position:fixed;inset:0;margin:0;padding:0;border:0;width:100vw;height:100vh;max-width:none;max-height:none;background:transparent;z-index:2147483647;pointer-events:none;';
 const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style'),card=document.createElement('section');
 style.textContent=`:host{all:initial}.toast{position:absolute;left:50%;bottom:clamp(28px,8vh,90px);transform:translateX(-50%);width:max-content;max-width:calc(100vw - 40px);box-sizing:border-box;padding:18px 28px;border-radius:20px;color:#f8fbff;background:linear-gradient(130deg,rgba(28,34,52,.94),rgba(16,22,34,.94));border:1px solid rgba(180,210,255,.35);box-shadow:0 14px 50px #0005, inset 0 1px 0 #ffffff20;backdrop-filter:blur(22px);font-family:system-ui,'Malgun Gothic',sans-serif;text-align:center;pointer-events:none;animation:enter .25s ease-out both}.label{font-size:11px;letter-spacing:.1em;color:#bdcce6}.code{display:block;font-size:34px;font-weight:700;letter-spacing:.16em;line-height:1.3;margin:6px 0;background:linear-gradient(100deg,#b6e8ff,#e3c6ff,#b5f4dc);background-clip:text;-webkit-background-clip:text;color:transparent}.message{margin:5px 0 0;font-size:12px;color:#d0d9e9}.leaving{animation:leave .35s ease-in both}@keyframes enter{from{opacity:0;translate:0 12px}to{opacity:1;translate:0 0}}@keyframes leave{to{opacity:0;translate:0 8px}}@media(prefers-reduced-motion:reduce){.toast,.leaving{animation-duration:.01s}}`;
 card.className='toast';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
 const label=document.createElement('span'),number=document.createElement('strong'),message=document.createElement('p');label.className='label';label.textContent='인증번호';number.className='code';number.textContent=code;message.className='message';message.textContent='클립보드에 복사되었습니다';card.append(label,number,message);shadow.append(style,card);(document.fullscreenElement?.tagName!=='VIDEO' && document.fullscreenElement || document.documentElement).append(host);
 if(typeof host.showPopover==='function'){try{host.setAttribute('popover','manual');host.showPopover();}catch{host.removeAttribute('popover');}}
 setTimeout(()=>{card.classList.add('leaving');setTimeout(()=>host.remove(),400);},6500);
 return true;
}
export function createOtpToast(chromeApi=chrome) {
 return async code=>{
  try{
   const window=await chromeApi.windows.getLastFocused({windowTypes:['normal']});
   const [tab]=await chromeApi.tabs.query({active:true,windowId:window.id});
   if(!tab?.id || !/^https?:/.test(tab.url || ''))return false;
   await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:renderCopiedOtpToast,args:[code]});return true;
  }catch{return false;}
 };
}
