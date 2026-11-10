// Runs in the isolated content-script world. Clipboard text never leaves this frame.
export function watchOtpPaste(code, token, ttlMs) {
 const key='__bongextendOtpPasteWatch';
 globalThis[key]?.();
 let pending=null, sending=false;
 const stop=()=>{clearTimeout(timer);document.removeEventListener('paste',paste,true);document.removeEventListener('input',input,true);if(globalThis[key]===stop)delete globalThis[key];};
 const editable=event=>{
  const el=event.composedPath()[0];
  if(!(el instanceof HTMLElement)||el.closest('[inert],[hidden],[aria-disabled="true"]'))return null;
  if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)return !el.disabled&&!el.readOnly?el:null;
  return el.isContentEditable?el:null;
 };
 const text=el=>'value'in el?el.value:el.textContent;
 const paste=event=>{
  pending=null;
  if(!event.isTrusted||sending)return;
  const el=editable(event),value=event.clipboardData?.getData('text/plain');
  if(!el||!value||value.trim().replace(/[ \t]/g,'')!==code)return;
  const before=text(el),start=el.selectionStart,end=el.selectionEnd;
  pending={el,event,before,expected:typeof start==='number'&&typeof end==='number'?before.slice(0,start)+value+before.slice(end):null,at:Date.now(),value};
 };
 const input=async event=>{
  const state=pending;
  if(!state||!event.isTrusted||editable(event)!==state.el||Date.now()-state.at>1500)return;
  pending=null;
  if(state.event.defaultPrevented||event.inputType!=='insertFromPaste')return;
  const after=text(state.el);
  if(state.expected!==null?after!==state.expected:after===state.before||!after.includes(state.value))return;
  sending=true;
  try{const result=await chrome.runtime.sendMessage({type:'bongextend-otp-pasted',token});if(result?.ok)stop();}catch{}finally{sending=false;}
 };
 const timer=setTimeout(stop,Math.min(600000,Math.max(1,ttlMs)));
 globalThis[key]=stop;document.addEventListener('paste',paste,true);document.addEventListener('input',input,true);
}
