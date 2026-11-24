import {isModuleEnabled} from '../core-modules.js';
import {addVideoHistory, VIDEO_STATUS_KEY, VIDEO_HISTORY_KEY} from './video-history.js';
import {createMediaSniffer} from './video-sniff.js';
let port, active=false, jobId;
const sniff=createMediaSniffer();
let lastSniff=null;
// 사이트를 몰라서 못 받았을 때, 영상 주소를 왜 못 찾았는지에 맞춰 안내를 바꿔요.
const sniffHint=(value)=>{
 if(value?.type!=='error'||!String(value.message||'').includes('주소만으로는')||!lastSniff)return value;
 if(lastSniff.reason==='no-access')return {...value,message:'이 사이트에 들어갈 권한이 없어서 영상 주소를 찾지 못했어요. 아래 ‘이 사이트 허용’을 누른 뒤 다시 받아 주세요.',needAccess:lastSniff.origin};
 if(lastSniff.reason==='not-found')return {...value,message:'영상 페이지에서 영상 주소를 찾지 못했어요. 영상을 재생한 상태에서 다시 받아 주세요. 그래도 안 되면 이 사이트는 받을 수 없어요.'};
 if(lastSniff.reason==='no-tab')return {...value,message:'이 사이트는 주소만으로는 받을 수 없어요. 영상 페이지를 연 탭에서 BongExtend → 다운로더 → ‘영상 받기’를 눌러 주세요.'};
 return value;
};
const key=VIDEO_STATUS_KEY;
const save=value=>chrome.storage.local.set({[key]:value});
async function saveCompleted(value, id){
 const stored=await chrome.storage.local.get(VIDEO_HISTORY_KEY);
 await chrome.storage.local.set({[VIDEO_HISTORY_KEY]:addVideoHistory(stored[VIDEO_HISTORY_KEY],{id,filename:value.filename,completedAt:Date.now()})});
}
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
  // 페이지 주소로 못 받는 사이트를 위해, 열린 영상 페이지에서 실제 영상 주소를 미리 찾아 둬요(보조 프로그램이 필요할 때만 써요).
  let fallback=null;
  if(message.action==='download'){active=true;jobId=crypto.randomUUID();void save({type:'started'});const found=await sniff(message.url,message.tabId);fallback=found.media;lastSniff=found;}
  if(message.action==='cancel' && !port){reply({ok:true});return;}
  try{
   if(!port){
    port=chrome.runtime.connectNative('com.bongextend.video');
    const current=port;
    current.onMessage.addListener(value=>{
     if(value.type==='ready' && active)return;
     void save(sniffHint(value));
     if(value.type==='done' && jobId)void saveCompleted(value,jobId);
     if(['done','error'].includes(value.type) || value.type==='ready' && !active){active=false;port=null;current.disconnect();}
    });
    current.onDisconnect.addListener(()=>{
     const error=chrome.runtime.lastError;
     if(port!==current)return;
     port=null;active=false;
     void save({type:'missing',message:error?.message || '보조 프로그램 연결이 끊겼어요. 다시 연결해 주세요.'});
    });
   }
   if(message.action!=='cancel')void save({type:active?'started':'connecting'});
   port.postMessage({type:message.action,url:message.url,quality:message.quality,...(fallback?{fallback}:{})});reply({ok:true});
  }catch{active=false;port?.disconnect();port=null;void save({type:'missing'});reply({ok:false});}
  })().catch(()=>reply({ok:false,message:'다운로더 설정을 확인하지 못했어요.'}));
  return true;
 });
}
