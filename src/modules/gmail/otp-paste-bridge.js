import {watchOtpPaste} from './otp-paste-watch.js';

// Reuse existing host grants and activeTab; never request a new permission.
export function startOtpPasteBridge(tracker, chromeApi=chrome) {
 const recipients=new Map(),inflight=new Set(),sessionKey='core.mailOtpPastePending';let expiresAt=0;
 const saveRecipients=async()=>{
  const state=(await chromeApi.storage.session.get(sessionKey))[sessionKey];
  if(state&&state.token===tracker.current()?.token){state.recipients=[...recipients];await chromeApi.storage.session.set({[sessionKey]:state});}
 };
 const clear=async()=>{tracker.clear();recipients.clear();await chromeApi.storage.session.remove(sessionKey);};
 const arm=async(mail,code)=>{
  const token=tracker.arm(mail,code);recipients.clear();expiresAt=Date.now()+600000;
  await chromeApi.storage.session.remove(sessionKey);
  if(token)await chromeApi.storage.session.set({[sessionKey]:{token,mailId:mail.id,accountId:mail.account?.id,accountEmail:mail.account?.getEmail?.()||null,expires:expiresAt,recipients:[]}});
 };
 const inject=async tab=>{
  const current=tracker.current();
  if(!current||!Number.isInteger(tab?.id)||!/^https?:\/\//.test(tab.url||''))return;
  try{
   const results=await chromeApi.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:watchOtpPaste,args:[current.code,current.token,Math.max(1,expiresAt-Date.now())]});
   if(tracker.current()?.token!==current.token)return;
   for(const result of results||[])recipients.set(`${tab.id}:${result.frameId}`,{token:current.token,documentId:result.documentId});
  }catch{/* Unpermitted/internal pages remain unread. */}
 };
 const refresh=async()=>{
  recipients.clear();
  const tabs=await chromeApi.tabs.query({});
  const eligible=tabs.filter(t=>/^https?:\/\//.test(t.url||'')).sort((a,b)=>Number(b.active)-Number(a.active)).slice(0,64);
  for(let i=0;i<eligible.length;i+=4)await Promise.allSettled(eligible.slice(i,i+4).map(inject));
  await saveRecipients();
 };
 chromeApi.tabs.onActivated.addListener(async({tabId})=>{if(tracker.current())try{await inject(await chromeApi.tabs.get(tabId));await saveRecipients();}catch{}});
 chromeApi.tabs.onUpdated.addListener((_id,change,tab)=>{if(change.status==='complete'&&tracker.current())void inject(tab).then(saveRecipients).catch(()=>{});});
 chromeApi.tabs.onRemoved.addListener(tabId=>{for(const key of recipients.keys())if(key.startsWith(`${tabId}:`))recipients.delete(key);});
 chromeApi.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='bongextend-otp-pasted')return;
  if(sender.id!==chromeApi.runtime.id||!/^https?:\/\//.test(sender.url||'')){reply({ok:false});return false;}
  void (async()=>{
   const state=(await chromeApi.storage.session.get(sessionKey))[sessionKey];
   const grant=recipients.get(`${sender.tab?.id}:${sender.frameId}`)||new Map(state?.recipients||[]).get(`${sender.tab?.id}:${sender.frameId}`);
   if(!state||state.token!==message.token||state.expires<=Date.now()||!grant||grant.token!==message.token||(grant.documentId&&grant.documentId!==sender.documentId)||inflight.has(message.token)){reply({ok:false});return;}
   const stored=await chromeApi.storage.local.get(['core.mailOtpEnabled','core.modules']);
   if(stored['core.mailOtpEnabled']===false||stored['core.modules']?.gmail===false){await clear();reply({ok:false});return;}
   const latestState=(await chromeApi.storage.session.get(sessionKey))[sessionKey];
   if(latestState?.token!==message.token||inflight.has(message.token)){reply({ok:false});return;}
   inflight.add(message.token);
   try{
    let ok=false;
    if(tracker.current()?.token===message.token)ok=await tracker.consume(message.token);
    else if(state.accountEmail){
     const account=globalThis.getAccountByEmail?.(state.accountEmail);
     const mail=account?.getMails?.().find(m=>m.id===state.mailId);
     if(mail&&typeof mail.markAsRead==='function'){await mail.markAsRead();ok=true;}
    }
    if(ok){recipients.clear();const latest=(await chromeApi.storage.session.get(sessionKey))[sessionKey];if(latest?.token===message.token)await chromeApi.storage.session.remove(sessionKey);}
    reply({ok});
   }finally{inflight.delete(message.token);}
  })().catch(()=>reply({ok:false}));return true;
 });
 return {arm,refresh};
}
