export function startVerticalTabBridge(){
 const last=new Map();
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='BONG_COLLAPSE_VERTICAL_TABS'||sender.id!==chrome.runtime.id||!sender.tab?.active||!/^https:\/\/chzzk\.naver\.com\/(live|video)\//.test(sender.url||''))return;
  const tab=sender.tab;
  void (async()=>{
   const stored=await chrome.storage.local.get('core.modules');if(stored['core.modules']?.chzzk===false){reply({ok:false});return;}
   const window=await chrome.windows.get(tab.windowId);if(!window.focused){reply({ok:false});return;}
   if(Date.now()-(last.get(tab.windowId)||0)<3000){reply({ok:true});return;}last.set(tab.windowId,Date.now());
   const port=chrome.runtime.connectNative('com.bongextend.video');let finished=false;
   const finish=async status=>{if(finished)return;finished=true;clearTimeout(timeout);await chrome.storage.local.set({'core.chzzkTabs:status':status});reply({ok:status==='shortcut-sent'||status==='already-collapsed',status});port.disconnect();};
   const timeout=setTimeout(()=>void finish('helper-timeout'),5000);
   port.onMessage.addListener(value=>void finish(value.type==='tabs'?value.status:'helper-update-required'));
   port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(!finished)void finish('helper-missing');});
   port.postMessage({type:'collapse-tabs',title:tab.title,url:tab.url,expandedHint:message.expandedHint===true});
  })().catch(()=>reply({ok:false}));return true;
 });
}
