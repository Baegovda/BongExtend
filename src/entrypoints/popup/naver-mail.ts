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
 let revision=0,observer:MutationObserver|undefined,railObserver:MutationObserver|undefined,section:HTMLElement|undefined,signature='';
 // 왼쪽 계정 아이콘 줄의 네이버 메일 아이콘. 툴바 숫자에는 네이버 메일도 더해지는데 아이콘 줄에는 Gmail만 있어서 합이 안 맞아 보였어요.
 // 메일 엔진은 '.accountAvatar' 칸마다 Gmail 계정 정보가 있다고 여겨서, 같은 모양이지만 다른 이름(be-naver-avatar)을 써요.
 let avatarInfo:{show:boolean;id:string;unread:number}={show:false,id:'',unread:0};
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
  // 메일 새로고침: 왼쪽 아래 버튼과 같은 일을 맨 위 계정 줄에서도 바로 할 수 있게 해요.
  const first=sorted[0]?.querySelector<HTMLElement>('.accountHeader,.be-naver-header');
  let again=inbox.querySelector<HTMLButtonElement>('.be-mail-refresh');
  if(!again&&first){
   again=button(doc,'',()=>{$('mailRefreshNow').click();again?.classList.add('is-spinning');setTimeout(()=>again?.classList.remove('is-spinning'),1200);});
   again.className='be-mail-refresh';again.title='메일 새로고침';again.setAttribute('aria-label','메일 새로고침');
   again.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17"/></svg>';
   again.addEventListener('click',event=>event.stopPropagation());again.addEventListener('keydown',event=>event.stopPropagation());
  }
  if(again&&first&&again.parentElement!==first)first.insertBefore(again,first.querySelector('.be-account-order'));
  orderRail(doc);
 };
 // 왼쪽 계정 아이콘 줄도 메일 목록의 계정 순서와 똑같이 늘어놓아요.
 const avatarKey=(el:Element)=>el.id==='bongextendNaverAvatar'?section?.dataset.accountKey||'':(()=>{const account=(el as Element&{_account?:{email?:string;getEmail?:()=>string}})._account;return `gmail:${String(account?.email||account?.getEmail?.()||'').trim().toLowerCase()}`;})();
 const railAvatars=(rail:Element)=>Array.from(rail.children).filter(el=>el.matches('.accountAvatar,.be-naver-avatar'));
 const orderRail=(doc:Document)=>{
  const rail=doc.getElementById('accountAvatars'),inbox=doc.getElementById('inbox');if(!rail||!inbox)return;
  const keys=Array.from(inbox.children).filter(el=>el.matches('.account')||el.id==='bongextendNaverAccount').map(row=>row.id==='bongextendNaverAccount'?(row as HTMLElement).dataset.accountKey||'':`gmail:${String(row.getAttribute('email')||(row as HTMLElement&{_account?:{email?:string}})._account?.email||'').trim().toLowerCase()}`);
  const avatars=railAvatars(rail);
  const rank=(el:Element)=>{const i=keys.indexOf(avatarKey(el));return i<0?keys.length+avatars.indexOf(el):i;};
  const sorted=[...avatars].sort((a,b)=>rank(a)-rank(b));
  // 이미 제자리면 건드리지 않아요(아이콘 줄 감시가 다시 불려도 끝없이 돌지 않게).
  if(avatars.some((el,i)=>el!==sorted[i]))for(const el of sorted)rail.append(el);
 };
 // 아이콘을 끌어서 위아래로 놓으면 계정 순서가 바뀌어요(계정 줄의 ⠿ 손잡이와 같은 저장 방식).
 let railCleanup:(()=>void)|undefined;
 const installRailDrag=(doc:Document)=>{
  railCleanup?.();railCleanup=undefined;
  const rail=doc.getElementById('accountAvatars');if(!rail)return;
  type RailDrag={avatar:HTMLElement;id:number;startY:number;startX:number;active:boolean;target?:Element;placement?:'before'|'after'};
  let drag:RailDrag|undefined,swallowClick=false;
  const clear=()=>{for(const el of rail.querySelectorAll('.be-avatar-drop-before,.be-avatar-drop-after'))el.classList.remove('be-avatar-drop-before','be-avatar-drop-after');};
  const finish=(commit:boolean)=>{
   if(!drag)return;const state=drag;drag=undefined;clear();
   state.avatar.classList.remove('be-avatar-dragging');rail.classList.remove('be-avatar-drag-active');
   if(rail.hasPointerCapture?.(state.id))rail.releasePointerCapture(state.id);
   if(!state.active)return;
   swallowClick=true;setTimeout(()=>{swallowClick=false;},0);
   if(!commit||!state.target||!state.placement)return;
   const sourceKey=avatarKey(state.avatar),targetKey=avatarKey(state.target);
   if(!sourceKey||sourceKey==='gmail:'||!targetKey||targetKey==='gmail:'||sourceKey===targetKey)return;
   doc.dispatchEvent(new CustomEvent('bongextend-mail-account-move',{cancelable:true,detail:{sourceKey,targetKey,placement:state.placement}}));
  };
  const down=(event:PointerEvent)=>{
   const avatar=(event.target as Element|null)?.closest?.('.accountAvatar,.be-naver-avatar') as HTMLElement|null;
   if(!avatar||avatar.parentElement!==rail||event.button!==0||!event.isPrimary||drag)return;
   drag={avatar,id:event.pointerId,startX:event.clientX,startY:event.clientY,active:false};
  };
  const move=(event:PointerEvent)=>{
   if(!drag||drag.id!==event.pointerId)return;
   if(!drag.active){
    if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<5)return;
    drag.active=true;drag.avatar.classList.add('be-avatar-dragging');rail.classList.add('be-avatar-drag-active');
    try{rail.setPointerCapture(event.pointerId);}catch{}
   }
   event.preventDefault();clear();
   const others=railAvatars(rail).filter(el=>el!==drag!.avatar);
   let target:Element|undefined,placement:'before'|'after'='after';
   for(const el of others){const box=el.getBoundingClientRect();if(event.clientY<box.top+box.height/2){target=el;placement='before';break;}}
   if(!target){target=others.at(-1);placement='after';}
   drag.target=target;drag.placement=target?placement:undefined;
   target?.classList.add(placement==='before'?'be-avatar-drop-before':'be-avatar-drop-after');
  };
  const up=(event:PointerEvent)=>{if(drag?.id===event.pointerId)finish(true);};
  const cancel=(event:PointerEvent)=>{if(drag?.id===event.pointerId)finish(false);};
  const key=(event:KeyboardEvent)=>{if(drag?.active&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(false);}};
  // 끌어서 놓은 직후의 누름은 "그 계정으로 이동"으로 치지 않아요.
  const click=(event:MouseEvent)=>{if(swallowClick){event.preventDefault();event.stopImmediatePropagation();swallowClick=false;}};
  const noNativeDrag=(event:DragEvent)=>event.preventDefault();
  rail.addEventListener('pointerdown',down);rail.addEventListener('pointermove',move);rail.addEventListener('pointerup',up);
  rail.addEventListener('pointercancel',cancel);rail.addEventListener('lostpointercapture',cancel);
  rail.addEventListener('click',click,true);rail.addEventListener('dragstart',noNativeDrag);doc.addEventListener('keydown',key,true);
  railCleanup=()=>{finish(false);rail.removeEventListener('pointerdown',down);rail.removeEventListener('pointermove',move);rail.removeEventListener('pointerup',up);
   rail.removeEventListener('pointercancel',cancel);rail.removeEventListener('lostpointercapture',cancel);
   rail.removeEventListener('click',click,true);rail.removeEventListener('dragstart',noNativeDrag);doc.removeEventListener('keydown',key,true);};
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
 const syncAvatar=(doc:Document)=>{
  const rail=doc.getElementById('accountAvatars');if(!rail)return;
  let avatar=doc.getElementById('bongextendNaverAvatar');
  if(!avatarInfo.show){avatar?.remove();return;}
  if(!avatar){
   avatar=doc.createElement('div');avatar.id='bongextendNaverAvatar';avatar.className='be-naver-avatar';avatar.setAttribute('role','button');avatar.tabIndex=0;
   const img=doc.createElement('img');img.className='accountPhoto';img.src=chrome.runtime.getURL(LOGO);img.alt='';
   const count=doc.createElement('div');count.className='accountAvatarUnreadCount';
   avatar.append(img,count);
   const go=()=>{const target=doc.getElementById('bongextendNaverAccount');target?.scrollIntoView({behavior:'smooth',block:'start'});};
   avatar.addEventListener('click',go);avatar.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();go();}});
  }
  avatar.title=`${avatarInfo.id}@naver.com`;avatar.setAttribute('aria-label',`${avatarInfo.id}@naver.com · 미읽음 ${avatarInfo.unread}통`);
  const count=avatar.querySelector<HTMLElement>('.accountAvatarUnreadCount')!;
  count.textContent=String(avatarInfo.unread);count.hidden=avatarInfo.unread<1;count.style.display=avatarInfo.unread<1?'none':'';
  if(avatar.parentElement!==rail)rail.append(avatar);
 };
 // 메일 엔진이 아이콘 줄을 다시 그려도 네이버 아이콘을 넣고, 메일 목록의 계정 순서와 같게 맞춰요.
 const syncRail=(doc:Document)=>{syncAvatar(doc);orderRail(doc);};
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
  syncAvatar(doc);
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
  avatarInfo={show:Boolean(config?.enabled)&&(local['core.modules'] as {gmail?:boolean}|undefined)?.gmail!==false,id:String(config?.id||''),unread:connected?Math.max(0,Number(state!.unread)||0):0};
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
  reader?.dispose();reader=undefined;observer?.disconnect();railObserver?.disconnect();section=undefined;signature='';
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
  observer=new MutationObserver(()=>mount());observer.observe(inbox,{childList:true});
  // 메일 엔진이 아이콘 줄을 다시 그리면(계정 새로 고침 등) 네이버 아이콘을 다시 넣어요.
  const rail=doc!.getElementById('accountAvatars');if(rail){railObserver=new MutationObserver(()=>syncRail(doc!));railObserver.observe(rail,{childList:true});}
  installRailDrag(doc!);
  void render();
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
