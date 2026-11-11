// @ts-ignore shared provider
import {CONFIG_KEY,STATE_KEY,naverId,mailUrl} from '@/modules/naver-mail/client.js';
import {createNaverReader} from './naver-reader';
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
 let reader:ReturnType<typeof createNaverReader>|undefined;
 let moveDocument:Document|undefined,moveListener:EventListener|undefined;
 const ORDER_KEY='core.mailAccountOrder';let accountOrder:string[]=[];
 const orderAccounts=(doc:Document)=>{
  const inbox=doc.getElementById('inbox');if(!inbox)return;
  const rows=Array.from(inbox.children).filter((el):el is HTMLElement=>el instanceof doc.defaultView!.HTMLElement&&(el.matches('.account')||el.id==='bongextendNaverAccount'));
  const key=(row:HTMLElement)=>row.id==='bongextendNaverAccount'?row.dataset.accountKey||'':`gmail:${String(row.getAttribute('email')||(row as HTMLElement&{_account?:{email?:string}})._account?.email||'').trim().toLowerCase()}`;
  const valid=rows.filter(row=>key(row)&&key(row)!=='gmail:');
  const sorted=[...valid].sort((a,b)=>{const rank=(row:HTMLElement)=>{const i=accountOrder.indexOf(key(row));return i<0?accountOrder.length+(row.id==='bongextendNaverAccount'?1:0):i;};return rank(a)-rank(b);});
  if(valid.some((row,i)=>row!==sorted[i]))for(const row of sorted)inbox.append(row);
  sorted.forEach((row,index)=>{
   const header=row.querySelector('.accountHeader,.be-naver-header');if(!header)return;
   let controls=header.querySelector('.be-account-order');
   if(!controls){controls=doc.createElement('span');controls.className='be-account-order';
    for(const [delta,label,glyph] of [[-1,'계정 위로 이동','↑'],[1,'계정 아래로 이동','↓']] as const){
     const move=button(doc,glyph,()=>{const current=Array.from(inbox.children).filter(el=>el.matches('.account')||el.id==='bongextendNaverAccount') as HTMLElement[];const at=current.indexOf(row),target=at+delta;if(target<0||target>=current.length)return;
      [current[at],current[target]]=[current[target],current[at]];accountOrder=current.map(key);orderAccounts(doc);
      const focus=move.disabled?move.parentElement?.querySelector<HTMLButtonElement>('button:not(:disabled)'):move;focus?.focus();
      void chrome.storage.local.set({[ORDER_KEY]:accountOrder}).catch(()=>{status.textContent='계정 순서를 저장하지 못했어요. 다시 이동해 주세요.';});});
     move.title=label;move.setAttribute('aria-label',label);move.addEventListener('click',event=>event.stopPropagation());controls.append(move);
     move.addEventListener('keydown',event=>event.stopPropagation());
    }header.append(controls);
   }
   const buttons=controls.querySelectorAll('button');buttons[0].disabled=index===0;buttons[1].disabled=index===sorted.length-1;
  });
 };
 void chrome.storage.local.get(ORDER_KEY).then(local=>{accountOrder=Array.isArray(local[ORDER_KEY])?local[ORDER_KEY].filter((key:unknown)=>typeof key==='string'):[];if(frame.contentDocument)orderAccounts(frame.contentDocument);});
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
  // 메일 화면이 다시 로드돼도 네이버 줄이 두 개가 되지 않게, 이미 있는 줄은 이어받고 남는 줄은 지워요.
  const existing=Array.from(inbox.querySelectorAll<HTMLElement>(':scope > #bongextendNaverAccount,:scope > .be-naver-account'));
  if(section?.ownerDocument!==doc){
   section=existing[0];if(section)signature='';
   if(!section){section=doc.createElement('section');section.id='bongextendNaverAccount';section.className='be-naver-account';section.dataset.provider='naver';signature='';}
  }
  for(const extra of existing)if(extra!==section)extra.remove();
  if(section!.parentElement!==inbox)inbox.append(section!);
  orderAccounts(doc);
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
  const header=doc.createElement('header');header.className='accountHeader be-naver-header';
  const title=doc.createElement('div');title.className='be-naver-title';title.append(logo(doc));
  const email=doc.createElement('strong');email.textContent=config?.enabled?`${config.id}@naver.com`:'네이버 메일';title.append(email);header.append(title);
  const actions=doc.createElement('div');actions.className='be-naver-actions';
  const action=(icon:string,label:string,click:()=>void)=>{const el=doc.createElement('j-button');el.setAttribute('icon',icon);el.title=label;el.setAttribute('aria-label',label);el.addEventListener('click',click);actions.append(el);};
  if(config?.enabled){const count=doc.createElement('span');count.className='unreadCount be-naver-unread';count.textContent=String(connected?state!.unread:0);count.setAttribute('aria-label',`미읽음 ${count.textContent}통`);title.append(count);
   action('open-in-browser',`네이버에서 전체 메일 열기 · ${config.id}@naver.com`,()=>{void chrome.tabs.create({url:mailUrl('')});});
   action('create',`새 메일 작성 · ${config.id}@naver.com`,()=>{void chrome.tabs.create({url:'https://mail.naver.com/v2/new'});});
  }else action('settings','계정 연결',openSettings);
  header.append(actions);
  section.append(header);
  section.dataset.accountKey=`naver:${String(config?.id||'').toLowerCase()}@naver.com`;
  orderAccounts(doc);
  const note=doc.createElement('p');note.className='be-naver-note';note.setAttribute('role','status');
  note.textContent=!config?.enabled?'메일 설정에서 네이버 계정을 연결하면 Gmail과 함께 보여요.':!connected?'네이버 메일을 확인하고 있어요…':state!.error||(!state!.messages?.length?'읽지 않은 받은 메일이 없어요.':'');
  note.hidden=!note.textContent;section.append(note);
  if(connected&&!state!.error){
   const list=doc.createElement('ul');list.id='naverMailList';list.className='be-naver-list';
   for(const message of state!.messages||[]){
    const row=doc.createElement('li'),open=button(doc,'',()=>{reader?.open(config!.id!,message,open);});
    const sender=doc.createElement('span'),subject=doc.createElement('strong'),snippet=doc.createElement('span'),time=doc.createElement('time');
    sender.className='be-naver-sender';subject.className='be-naver-subject';snippet.className='be-naver-snippet';time.className='be-naver-time';
    sender.textContent=message.sender||'보낸 사람';subject.textContent=message.subject;snippet.textContent=message.snippet;time.textContent=message.time?new Date(message.time).toLocaleString('ko-KR'):'';
    open.append(sender,time,subject,snippet);row.append(open);list.append(row);
   }
   section.append(list);
  }
 };
 const loaded=()=>{
  if(moveListener)moveDocument?.removeEventListener('bongextend-mail-account-move',moveListener);
  reader?.dispose();reader=undefined;observer?.disconnect();section=undefined;signature='';
  const doc=frame.contentDocument,inbox=doc?.getElementById('inbox');if(!inbox)return;
  reader=createNaverReader(doc!);
  moveDocument=doc!;moveListener=event=>{
   if(!event.cancelable)return;
   const detail=(event as CustomEvent).detail;if(!detail||!['before','after'].includes(detail.placement))return;
   const key=(row:HTMLElement)=>row.id==='bongextendNaverAccount'?row.dataset.accountKey||'':`gmail:${String(row.getAttribute('email')||(row as HTMLElement&{_account?:{email?:string}})._account?.email||'').trim().toLowerCase()}`;
   const rows=Array.from(inbox.children).filter(el=>el.matches('.account')||el.id==='bongextendNaverAccount') as HTMLElement[];
   const source=rows.find(row=>key(row)===detail.sourceKey),target=rows.find(row=>key(row)===detail.targetKey);
   if(!source||!target||source===target)return;
   const next=rows.filter(row=>row!==source),at=next.indexOf(target)+(detail.placement==='after'?1:0);next.splice(at,0,source);
   event.preventDefault();accountOrder=next.map(key);orderAccounts(doc!);
   void chrome.storage.local.set({[ORDER_KEY]:accountOrder}).catch(()=>{status.textContent='계정 순서를 저장하지 못했어요. 다시 이동해 주세요.';});
  };doc!.addEventListener('bongextend-mail-account-move',moveListener);
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
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[ORDER_KEY]){accountOrder=Array.isArray(changes[ORDER_KEY].newValue)?changes[ORDER_KEY].newValue:[];if(frame.contentDocument)orderAccounts(frame.contentDocument);}if(area==='local'&&(changes[CONFIG_KEY]||(changes['core.modules']?.newValue as {gmail?:boolean}|undefined)?.gmail===false))reader?.close();if((area==='session'&&changes[STATE_KEY])||(area==='local'&&(changes[CONFIG_KEY]||changes['core.modules'])))void render();});
 void render();refresh();
}
