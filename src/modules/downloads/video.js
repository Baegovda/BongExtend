import {isModuleEnabled} from '../core-modules.js';
let port, active=false;
const key='core.video:status';
const save=value=>chrome.storage.local.set({[key]:value});
export function startVideoHost(){
 void chrome.storage.local.get(key).then(saved=>{
  if(!port && ['started','progress','connecting'].includes(saved[key]?.type))void save({type:'error',message:'이전 다운로드 연결이 종료됐어요. 다시 시작해 주세요.'});
 });
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')) || message?.type!=='BONG_VIDEO')return;
  if(!['ping','download','cancel'].includes(message.action)){reply({ok:false});return;}
  void (async()=>{
  if(message.action==='download' && !(await isModuleEnabled('download'))){reply({ok:false,message:'설정에서 다운로더 모듈을 켜 주세요.'});return;}
  if(message.action==='download' && active){reply({ok:false,message:'진행 중인 영상이 있어요.'});return;}
  if(message.action==='cancel' && !port){reply({ok:true});return;}
  try{
   if(!port){
    port=chrome.runtime.connectNative('com.bongextend.video');
    const current=port;
    current.onMessage.addListener(value=>{
     if(value.type==='ready' && active)return;
     void save(value);
     if(['done','error'].includes(value.type) || value.type==='ready' && !active){active=false;port=null;current.disconnect();}
    });
    current.onDisconnect.addListener(()=>{
     const error=chrome.runtime.lastError;
     if(port!==current)return;
     port=null;active=false;
     void save({type:'missing',message:error?.message || '보조 프로그램 연결이 끊겼어요. 다시 연결해 주세요.'});
    });
   }
   if(message.action==='download')active=true;
   if(message.action!=='cancel')void save({type:active?'started':'connecting'});
   port.postMessage({type:message.action,url:message.url,quality:message.quality});reply({ok:true});
  }catch{active=false;port?.disconnect();port=null;void save({type:'missing'});reply({ok:false});}
  })().catch(()=>reply({ok:false,message:'다운로더 설정을 확인하지 못했어요.'}));
  return true;
 });
}
