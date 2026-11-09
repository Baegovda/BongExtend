// @ts-ignore shared provider
import {CONFIG_KEY,STATE_KEY,naverId,mailUrl} from '@/modules/naver-mail/client.js';
type NaverConfig={enabled?:boolean;id?:string;notify?:boolean};
type NaverState={id:string;unread:number;checkedAt:number;error?:string;messages:{id:string;subject:string;sender:string;snippet:string;time:number}[]};
export function setupNaverMail(){
 const $=(id:string)=>document.getElementById(id)!;
 const view=$('naverMailPanel'),frame=$('checkerPlusMailFrame'),gmail=$('providerGmail'),naver=$('providerNaver');
 const status=$('naverMailStatus'),list=$('naverMailList'),id=$('naverMailId') as HTMLInputElement;
 const connect=$('naverMailConnect') as HTMLButtonElement;
 const notify=$('naverMailNotify') as HTMLInputElement;
 let revision=0;
 const refresh=()=>{const port=chrome.runtime.connect({name:'bongextend-naver-mail'});const timer=setTimeout(()=>port.disconnect(),20000);port.onMessage.addListener(()=>{clearTimeout(timer);port.disconnect();void render();});port.onDisconnect.addListener(()=>clearTimeout(timer));port.postMessage({refresh:true});};
 const render=async()=>{
  const current=++revision;
  const [local,session]=await Promise.all([chrome.storage.local.get(CONFIG_KEY),chrome.storage.session.get(STATE_KEY)]);
  if(current!==revision)return;
  const config=local[CONFIG_KEY] as NaverConfig|undefined,state=session[STATE_KEY] as NaverState|undefined;
  if(document.activeElement!==id)id.value=config?.id||'';
  notify.checked=config?.notify!==false;
  $('naverMailDisconnect').hidden=!config?.enabled;
  list.replaceChildren();
  const connected=config?.enabled && state?.id===config.id;
  status.textContent=!config?.enabled?'네이버 메일에 로그인한 뒤 아이디를 넣고 연결해 주세요.':!connected?'메일을 확인하고 있어요…':state!.error||`${config.id}@naver.com · 미읽음 ${state!.unread}통 · ${new Date(state!.checkedAt).toLocaleTimeString('ko-KR')} 확인`;
  if(connected&&!state!.error){
   for(const message of state!.messages||[]){
    const row=document.createElement('li'),button=document.createElement('button');button.type='button';
    const sender=document.createElement('span'),subject=document.createElement('strong'),snippet=document.createElement('span'),time=document.createElement('time');
    sender.textContent=message.sender||'보낸 사람';subject.textContent=message.subject;snippet.textContent=message.snippet;
    time.textContent=message.time?new Date(message.time).toLocaleString('ko-KR'):'';
    button.append(sender,subject,snippet,time);button.addEventListener('click',()=>{void chrome.tabs.create({url:mailUrl(message.id)});});row.append(button);list.append(row);
   }
   if(!state!.messages?.length)status.textContent+=' · 읽지 않은 받은 메일이 없어요.';
  }
 };
 const select=(provider:string)=>{
  const on=provider==='naver';view.hidden=!on;frame.hidden=on;
  gmail.setAttribute('aria-pressed',String(!on));naver.setAttribute('aria-pressed',String(on));
  $('mailSettingsOpen').hidden=on;$('mailRefreshNow').hidden=on;
  if(on){$('checkerPlusMailHome').hidden=true;void render();refresh();}
  void chrome.storage.local.set({'core.mailProvider':provider});
 };
 gmail.addEventListener('click',()=>select('gmail'));naver.addEventListener('click',()=>select('naver'));
 $('naverMailForm').addEventListener('submit',async event=>{
  event.preventDefault();const account=naverId(id.value);
  if(!account){status.textContent='네이버 아이디 또는 @naver.com 메일 주소를 입력해 주세요.';return;}
  connect.disabled=true;
  try{
   const allowed=await chrome.permissions.request({origins:['https://mail.naver.com/*']});
   if(!allowed){status.textContent='네이버 메일 연결 권한을 허용해 주세요.';return;}
   await chrome.storage.local.set({[CONFIG_KEY]:{enabled:true,id:account,notify:notify.checked}});refresh();void render();
  }catch{status.textContent='연결을 저장하지 못했어요. 다시 시도해 주세요.';}
  finally{connect.disabled=false;}
 });
 $('naverMailDisconnect').addEventListener('click',async()=>{await chrome.storage.local.remove(CONFIG_KEY);await chrome.storage.session.remove(STATE_KEY);void render();});
 notify.addEventListener('change',async()=>{const local=await chrome.storage.local.get(CONFIG_KEY);if(local[CONFIG_KEY])await chrome.storage.local.set({[CONFIG_KEY]:{...(local[CONFIG_KEY] as NaverConfig),notify:notify.checked}});});
 $('naverMailRefresh').addEventListener('click',refresh);
 $('naverMailOpen').addEventListener('click',()=>{void chrome.tabs.create({url:mailUrl('')});});
 $('naverMailCompose').addEventListener('click',()=>{void chrome.tabs.create({url:'https://mail.naver.com/v2/new'});});
 chrome.storage.onChanged.addListener((changes,area)=>{if((area==='session'&&changes[STATE_KEY])||(area==='local'&&changes[CONFIG_KEY]))void render();});
 void chrome.storage.local.get('core.mailProvider').then(local=>select(local['core.mailProvider']==='naver'?'naver':'gmail'));
}
