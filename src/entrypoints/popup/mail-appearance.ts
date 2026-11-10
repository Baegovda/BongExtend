import {createMailThemeController} from '@/modules/dark/mail-theme.js';
// @ts-ignore shared settings
import {normalizeDarkSettings,darkThemeForSite} from '@/modules/dark/settings.js';
const THEME_KEY='core.mailBodyTheme',DARK_KEY='core.darkMode';
type Mode='auto'|'dark'|'original';
let mode:Mode='auto',settings=normalizeDarkSettings(),moduleOn=true,loaded=false;
let colors:typeof import('darkreader');
// The upstream API installs a runtime messaging shim on import. Color-only use
// must preserve Chrome's native Promise/callback API for mail settings/actions.
const nativeSend=chrome.runtime.sendMessage,nativeAdd=chrome.runtime.onMessage.addListener;
const colorReady=import('darkreader').then(library=>{colors=library;return library;}).finally(()=>{
 chrome.runtime.sendMessage=nativeSend;chrome.runtime.onMessage.addListener=nativeAdd;
});
const listeners=new Set<()=>void>(),media=window.matchMedia('(prefers-color-scheme: dark)');
const validMode=(value:unknown):Mode=>value==='dark'||value==='original'?value:'auto';
const notify=()=>listeners.forEach(fn=>fn());
const ready=colorReady.then(()=>chrome.storage.local.get([THEME_KEY,DARK_KEY,'core.modules'])).then(stored=>{mode=validMode(stored[THEME_KEY]);settings=normalizeDarkSettings(stored[DARK_KEY]);moduleOn=(stored['core.modules'] as {dark?:boolean}|undefined)?.dark!==false;loaded=true;notify();});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local')return;let changed=false;
 if(changes[THEME_KEY]){mode=validMode(changes[THEME_KEY].newValue);changed=true;}
 if(changes[DARK_KEY]){settings=normalizeDarkSettings(changes[DARK_KEY].newValue);changed=true;}
 if(changes['core.modules']){moduleOn=(changes['core.modules'].newValue as {dark?:boolean}|undefined)?.dark!==false;changed=true;}
 if(changed)notify();
});
media.addEventListener('change',notify);
const mapper=(name:'modifyBackgroundColor'|'modifyForegroundColor'|'modifyBorderColor')=>(c:number[],theme:object)=>colors[name]({r:c[0],g:c[1],b:c[2],a:c[3]??1},theme,false);
const mappers={background:mapper('modifyBackgroundColor'),foreground:mapper('modifyForegroundColor'),border:mapper('modifyBorderColor')};
export function createMailThemeView(doc:Document,hostname:string){
 const controllers=new Map<HTMLElement,ReturnType<typeof createMailThemeController>>();
 const select=doc.createElement('select');select.className='be-mail-body-theme';select.setAttribute('aria-label','메일 본문 테마');
 for(const [value,label] of [['auto','자동 다크'],['dark','다크'],['original','원본 색']]){const option=doc.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 select.addEventListener('change',()=>{const wanted=validMode(select.value);void chrome.storage.local.set({[THEME_KEY]:wanted}).catch(()=>{select.value=mode;select.title='저장하지 못했어요. 다시 선택해 주세요.';});});
 for(const name of ['mouseup','keydown'])select.addEventListener(name,event=>event.stopPropagation());
 const apply=()=>{
  const enabled=loaded&&moduleOn&&mode!=='original'&&(mode==='dark'||media.matches);
  const theme={lightSchemeBackgroundColor:'#dcdad7',lightSchemeTextColor:'#181a1b',...darkThemeForSite(settings,hostname),mode:1};
  select.value=mode;select.disabled=!loaded||!moduleOn;select.title=!moduleOn?'다크 모듈을 켜면 본문에도 적용할 수 있어요.':'자동: 앱 테마에 맞춤 · 다크: 항상 적용 · 원본 색: 발신자 색으로 보기';
  for(const [root,controller] of controllers){
   controller.update(enabled,theme);
   if(root===root.ownerDocument.documentElement){const frame=root.ownerDocument.defaultView?.frameElement as HTMLElement|null;if(frame)frame.dataset.beMailTheme=enabled?'dark':'original';}
  }
 };
 listeners.add(apply);void ready.then(apply);
 return {
  sync(roots:HTMLElement[],toolbar:HTMLElement|null){
   for(const [root,controller] of controllers)if(!roots.includes(root)){controller.stop();controllers.delete(root);}
   for(const root of roots)if(!controllers.has(root))controllers.set(root,createMailThemeController(root,mappers));
   if(toolbar&&select.parentElement!==toolbar)toolbar.append(select);
   apply();
  },
  stop(){listeners.delete(apply);for(const controller of controllers.values())controller.stop();controllers.clear();select.remove();}
 };
}
export function watchGmailTheme(doc:Document){
 const view=createMailThemeView(doc,'mail.google.com');let queued=false;
 const sync=()=>{queued=false;const section=doc.getElementById('openEmailSection');view.sync(section?.classList.contains('active')?Array.from(section.querySelectorAll<HTMLElement>('.messageBody')):[],section?.querySelector<HTMLElement>('.utility-items')||null);};
 const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(sync);}});
 const section=doc.getElementById('openEmailSection');if(section)observer.observe(section,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});sync();
 return ()=>{observer.disconnect();view.stop();};
}
