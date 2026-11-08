// 인증번호는 URL·저장소에 넣지 않고 일회용 메모리 토큰으로만 전달해요.
export function createOtpToast(chromeApi=chrome) {
 const pending=new Map();
 chromeApi.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='BONG_OTP_TOAST_READ' || sender.id!==chromeApi.runtime.id || !sender.url?.startsWith(chromeApi.runtime.getURL('otp-toast.html')))return;
  const entry=pending.get(message.token);pending.delete(message.token);
  if(entry)clearTimeout(entry.timer);
  reply(entry && Date.now()<entry.expires?{code:entry.code}:{});
 });
 return async code=>{
  const token=crypto.randomUUID();pending.set(token,{code,expires:Date.now()+15000});
  const expire=setTimeout(()=>pending.delete(token),15000);
  pending.get(token).timer=expire;
  try{
   const parent=await chromeApi.windows.getLastFocused({windowTypes:['normal']});
   await chromeApi.windows.create({url:chromeApi.runtime.getURL('otp-toast.html')+'?token='+token,type:'popup',width:380,height:230,focused:false,
    left:Math.round((parent.left || 0)+Math.max(0,((parent.width || 380)-380)/2)),top:Math.round((parent.top || 0)+Math.max(0,((parent.height || 230)-230)/2))});
  }catch{clearTimeout(expire);pending.delete(token);}
 };
}
