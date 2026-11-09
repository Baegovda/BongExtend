import {CONFIG_KEY,STATE_KEY,UNREAD_KEY,naverId,fetchNaverInbox,mailUrl} from './client.js';
import {paintToolbarBadge} from '../toolbar-badge.js';
const ALARM='naver-mail-check';
export function startNaverMail() {
 let busy=null, generation=0, nextAt=0;
 const check=()=>{
  if(busy)return busy;
  const current=generation;
  busy=(async()=>{
   const stored=await chrome.storage.local.get([CONFIG_KEY,'core.modules']);
   const config=stored[CONFIG_KEY];
   const permitted=await chrome.permissions.contains({origins:['https://mail.naver.com/*']});
   if(!config?.enabled || !naverId(config.id) || stored['core.modules']?.gmail===false || !permitted){
    await chrome.storage.session.remove(STATE_KEY);await chrome.storage.local.set({[UNREAD_KEY]:0});await paintToolbarBadge();return;
   }
   if(Date.now()<nextAt)return;
   nextAt=Date.now()+30000;
   try{
    const previous=(await chrome.storage.session.get(STATE_KEY))[STATE_KEY];
    const inbox=await fetchNaverInbox(config.id);
    if(current!==generation)return;
    const state={...inbox,id:config.id,checkedAt:Date.now(),error:''};
    const seen=new Set(previous?.id===config.id?(previous.messages||[]).map(m=>m.id):[]);
    await chrome.storage.session.set({[STATE_KEY]:state});await chrome.storage.local.set({[UNREAD_KEY]:inbox.unread});
    if(previous?.id===config.id && !previous.error && config.notify!==false){
     for(const m of inbox.messages.filter(m=>!seen.has(m.id)).slice(0,3)){
      await chrome.notifications.create('naver-mail-'+m.id,{type:'basic',iconUrl:chrome.runtime.getURL('icons/128.png'),title:'네이버 메일 · '+(m.sender||config.id),message:m.subject});
     }
    }
   }catch(error){
    if(current!==generation)return;
    nextAt=Date.now()+Math.max(60000,error.retryAfter||0);
    // 인증 오류 때 옛 계정의 메일을 계속 노출하지 않아요.
    await chrome.storage.session.set({[STATE_KEY]:{id:config.id,messages:[],unread:0,error:error.message,checkedAt:Date.now()}});
    await chrome.storage.local.set({[UNREAD_KEY]:0});
   }
   await paintToolbarBadge();
  })().catch(()=>{}).finally(()=>{busy=null;});return busy;
 };
 chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='bongextend-naver-mail' || port.sender?.id!==chrome.runtime.id || !port.sender?.url?.startsWith(chrome.runtime.getURL('/')))return;
  port.onMessage.addListener(()=>{void check().then(()=>{try{port.postMessage({ok:true});}catch{}});});
 });
 const changed=()=>{generation++;nextAt=0;const pending=busy;void Promise.resolve(pending).then(check);};
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes[CONFIG_KEY]||changes['core.modules']))changed();});
 chrome.permissions.onRemoved.addListener(changed);
 chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)void check();});
 chrome.notifications.onClicked.addListener(id=>{if(/^naver-mail-\d+$/.test(id))void chrome.tabs.create({url:mailUrl(id.slice(11))});});
 void chrome.alarms.create(ALARM,{periodInMinutes:0.5});void check();
}
