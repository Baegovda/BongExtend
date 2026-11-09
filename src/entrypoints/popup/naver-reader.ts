// @ts-ignore shared provider helpers
import {CONFIG_KEY,fetchNaverMessage,mailUrl} from '@/modules/naver-mail/client.js';
// @ts-ignore scriptless message document
import {messageDocument} from '@/modules/naver-mail/message.js';
type Summary={id:string;subject:string;sender:string;snippet?:string;time?:number};
type Body={id:string;html:string;plain?:boolean;subject?:string;sender?:string;address?:string};
export function createNaverReader(doc:Document){
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=chrome.runtime.getURL('naver-reader.css');doc.head.append(sheet);
 const view=doc.createElement('section');view.id='beNaverReader';view.className='be-naver-reader';view.hidden=true;
 view.setAttribute('role','region');view.setAttribute('aria-labelledby','beNaverSubject');
 const bar=doc.createElement('header'),subject=doc.createElement('h2'),sender=doc.createElement('p'),notice=doc.createElement('p');
 subject.id='beNaverSubject';sender.className='be-naver-reader-sender';notice.className='be-naver-reader-status';notice.setAttribute('role','status');
 const body=doc.createElement('iframe');body.id='beNaverBody';body.title='네이버 메일 본문';body.hidden=true;
 body.setAttribute('sandbox','allow-same-origin allow-popups allow-popups-to-escape-sandbox');body.referrerPolicy='no-referrer';
 const make=(text:string,click:()=>void)=>{const button=doc.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',click);return button;};
 let current:{account:string;summary:Summary}|null=null,opener:HTMLElement|null=null,controller:AbortController|null=null,generation=0,zoom=80;
 const connected=(stored:Record<string,unknown>,account:string)=>{const config=stored[CONFIG_KEY] as {enabled?:boolean;id?:string}|undefined;return config?.enabled&&config.id===account&&(stored['core.modules'] as {gmail?:boolean}|undefined)?.gmail!==false;};
 let wrapper:HTMLElement|null=null,wasInert=false;
 const close=()=>{generation++;controller?.abort();controller=null;current=null;body.srcdoc='';body.hidden=true;view.hidden=true;doc.documentElement.classList.remove('be-naver-reading');if(wrapper)wrapper.inert=wasInert;wrapper=null;if(opener?.isConnected)opener.focus();else doc.querySelector<HTMLButtonElement>('#naverMailList button')?.focus();};
 const back=make('← 메일함',close),original=make('네이버에서 열기',()=>{if(current)void chrome.tabs.create({url:mailUrl(current.summary.id)});});
 original.title='답장·첨부 파일 등 전체 기능은 네이버에서 사용할 수 있어요.';
 const scale=make('80%',()=>{zoom=zoom===80?100:80;scale.textContent=zoom+'%';scale.setAttribute('aria-pressed',String(zoom===100));if(body.contentDocument)body.contentDocument.body.style.zoom=String(zoom/100);});
 scale.title='메일 본문 배율 전환 (80% / 100%)';scale.setAttribute('aria-label',scale.title);scale.setAttribute('aria-pressed','false');
 const retry=make('다시 시도',()=>{if(current)void load();});retry.hidden=true;
 bar.append(back,original,scale);view.append(bar,subject,sender,notice,retry,body);doc.body.append(view);
 view.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
 view.addEventListener('mouseup',event=>event.stopPropagation());
 async function load(){
  if(!current)return;const selected=current,own=++generation;controller?.abort();const request=controller=new AbortController();body.srcdoc='';body.hidden=true;retry.hidden=true;
  notice.textContent='메일 본문을 불러오고 있어요…';view.setAttribute('aria-busy','true');
  try{
   const local=await chrome.storage.local.get([CONFIG_KEY,'core.modules']);
   if(!connected(local,selected.account))throw Error('네이버 계정을 다시 연결해 주세요.');
   if(!await chrome.permissions.contains({origins:['https://mail.naver.com/*']}))throw Error('메일 설정에서 네이버 연결 권한을 허용해 주세요.');
   const result=await fetchNaverMessage(selected.account,selected.summary.id,{signal:request.signal}) as Body;
   const latest=await chrome.storage.local.get([CONFIG_KEY,'core.modules']);
   if(request.signal.aborted||own!==generation||current!==selected)return;
   if(!connected(latest,selected.account)){close();return;}
   subject.textContent=result.subject||selected.summary.subject;sender.textContent=[result.sender||selected.summary.sender,result.address].filter(Boolean).join(' · ');
   body.srcdoc=messageDocument(doc,result,zoom);body.hidden=false;notice.textContent='';
  }catch(error){if(own!==generation||request.signal.aborted)return;notice.textContent=(error as Error).name==='TimeoutError'?'응답이 늦어지고 있어요. 다시 시도해 주세요.':(error as Error).message||'메일을 불러오지 못했어요.';retry.hidden=false;}
  finally{if(own===generation)view.setAttribute('aria-busy','false');}
 }
 return {
  open(account:string,summary:Summary,trigger:HTMLElement){
   opener=trigger;current={account,summary};zoom=80;scale.textContent='80%';scale.setAttribute('aria-pressed','false');
   if(view.hidden){wrapper=doc.querySelector<HTMLElement>('.pageWrapper');wasInert=Boolean(wrapper?.inert);if(wrapper)wrapper.inert=true;}
   view.hidden=false;doc.documentElement.classList.add('be-naver-reading');subject.textContent=summary.subject;sender.textContent=summary.sender;back.focus();void load();
  },
  close,
  dispose(){close();view.remove();sheet.remove();},
 };
}
