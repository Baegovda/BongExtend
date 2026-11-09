// @ts-ignore shared provider
import {CONFIG_KEY,STATE_KEY,naverId,mailUrl} from '@/modules/naver-mail/client.js';
type NaverConfig={enabled?:boolean;id?:string;notify?:boolean};
type NaverMessage={id:string;subject:string;sender:string;snippet:string;time:number};
type NaverState={id:string;unread:number;checkedAt:number;error?:string;messages:NaverMessage[]};
const LOGO='icons/naver.ico'; // Official public favicon from https://www.naver.com/favicon.ico?1
export function setupNaverMail(){
 const $=(id:string)=>document.getElementById(id)!;
 const frame=$('checkerPlusMailFrame') as HTMLIFrameElement;
 const status=$('naverMailStatus'),id=$('naverMailId') as HTMLInputElement;
 const connect=$('naverMailConnect') as HTMLButtonElement,notify=$('naverMailNotify') as HTMLInputElement;
 let revision=0,observer:MutationObserver|undefined,section:HTMLElement|undefined,signature='';
 const refresh=()=>{
  const port=chrome.runtime.connect({name:'bongextend-naver-mail'});
  const timer=setTimeout(()=>port.disconnect(),20000);
  port.onMessage.addListener(()=>{clearTimeout(timer);port.disconnect();void render();});
  port.onDisconnect.addListener(()=>clearTimeout(timer));port.postMessage({refresh:true});
 };
 const openSettings=()=>{$('mailSettingsOpen').click();};
 const logo=(doc:Document)=>{const img=doc.createElement('img');img.className='be-naver-logo';img.src=chrome.runtime.getURL(LOGO);img.alt='네이버';img.width=28;img.height=28;return img;};
 const button=(doc:Document,text:string,click:()=>void)=>{const el=doc.createElement('button');el.type='button';el.textContent=text;el.addEventListener('click',click);return el;};
 const hint=(doc:Document)=>{
  const inbox=doc.getElementById('inbox');if(!inbox)return;
  let empty=doc.getElementById('bongextendGmailEmpty');
  if(!empty){empty=doc.createElement('section');empty.id='bongextendGmailEmpty';empty.className='be-mail-empty';const note=doc.createElement('p');note.textContent='연결된 Gmail 계정이 없어요.';empty.append(note,button(doc,'Gmail 로그인',()=>{void chrome.tabs.create({url:'https://mail.google.com/'});}));inbox.prepend(empty);}
  empty.hidden=Boolean(inbox.querySelector('.account'));
 };
 const mount=()=>{
  const doc=frame.contentDocument,inbox=doc?.getElementById('inbox');
  if(!doc||!inbox)return;
  hint(doc);
  if(section?.ownerDocument!==doc){section=doc.createElement('section');section.id='bongextendNaverAccount';section.className='be-naver-account';section.dataset.provider='naver';signature='';}
  if(inbox.lastElementChild!==section)inbox.append(section!);
 };
 const render=async()=>{
  const current=++revision;
  const [local,session]=await Promise.all([chrome.storage.local.get([CONFIG_KEY,'core.modules']),chrome.storage.session.get(STATE_KEY)]);
  if(current!==revision)return;
  const config=local[CONFIG_KEY] as NaverConfig|undefined,state=session[STATE_KEY] as NaverState|undefined;
  if(document.activeElement!==id)id.value=config?.id||'';
  notify.checked=config?.notify!==false;$('naverMailDisconnect').hidden=!config?.enabled;
  const connected=config?.enabled && state?.id===config.id;
  status.textContent=!config?.enabled?'네이버 메일에 로그인한 뒤 아이디를 넣고 연결해 주세요.':!connected?'메일을 확인하고 있어요…':state!.error||`${config.id}@naver.com · 미읽음 ${state!.unread}통 · ${new Date(state!.checkedAt).toLocaleTimeString('ko-KR')} 확인`;
  mount();if(!section)return;
  section.hidden=(local['core.modules'] as {gmail?:boolean}|undefined)?.gmail===false;
  const next=JSON.stringify([config,connected?{id:state!.id,unread:state!.unread,error:state!.error,messages:state!.messages}:null]);if(next===signature)return;signature=next;
  const doc=section.ownerDocument;section.replaceChildren();
  const header=doc.createElement('header');header.className='be-naver-header';
  const title=doc.createElement('div');title.className='be-naver-title';title.append(logo(doc));
  const email=doc.createElement('strong');email.textContent=config?.enabled?`${config.id}@naver.com`:'네이버 메일';title.append(email);header.append(title);
  if(config?.enabled){const count=doc.createElement('span');count.className='be-naver-unread';count.textContent=String(connected?state!.unread:0);count.setAttribute('aria-label',`미읽음 ${count.textContent}통`);header.append(count);
   header.append(button(doc,'메일함',()=>{void chrome.tabs.create({url:mailUrl('')});}),button(doc,'작성',()=>{void chrome.tabs.create({url:'https://mail.naver.com/v2/new'});}));
  }else header.append(button(doc,'계정 연결',openSettings));
  section.append(header);
  const note=doc.createElement('p');note.className='be-naver-note';note.setAttribute('role','status');
  note.textContent=!config?.enabled?'메일 설정에서 네이버 계정을 연결하면 Gmail과 함께 보여요.':!connected?'네이버 메일을 확인하고 있어요…':state!.error||(!state!.messages?.length?'읽지 않은 받은 메일이 없어요.':'');
  note.hidden=!note.textContent;section.append(note);
  if(connected&&!state!.error){
   const list=doc.createElement('ul');list.id='naverMailList';list.className='be-naver-list';
   for(const message of state!.messages||[]){
    const row=doc.createElement('li'),open=button(doc,'',()=>{void chrome.tabs.create({url:mailUrl(message.id)});});
    const sender=doc.createElement('span'),subject=doc.createElement('strong'),snippet=doc.createElement('span'),time=doc.createElement('time');
    sender.className='be-naver-sender';subject.className='be-naver-subject';snippet.className='be-naver-snippet';time.className='be-naver-time';
    sender.textContent=message.sender||'보낸 사람';subject.textContent=message.subject;snippet.textContent=message.snippet;time.textContent=message.time?new Date(message.time).toLocaleString('ko-KR'):'';
    open.append(sender,time,subject,snippet);row.append(open);list.append(row);
   }
   section.append(list);
  }
 };
 const loaded=()=>{
  observer?.disconnect();section=undefined;signature='';
  const doc=frame.contentDocument,inbox=doc?.getElementById('inbox');if(!inbox)return;
  observer=new MutationObserver(()=>mount());observer.observe(inbox,{childList:true});void render();
 };
 frame.addEventListener('load',loaded);
 if(frame.contentDocument?.readyState==='complete')loaded();
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
 $('naverMailRefresh').addEventListener('click',refresh);$('mailRefreshNow').addEventListener('click',refresh);
 chrome.storage.onChanged.addListener((changes,area)=>{if((area==='session'&&changes[STATE_KEY])||(area==='local'&&(changes[CONFIG_KEY]||changes['core.modules'])))void render();});
 void render();refresh();
}
