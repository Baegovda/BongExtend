// 아이콘 아래 말풍선(다운로드 시작·새 메일). 배경이 저장해 둔 글을 보여 주고 잠깐 뒤 스스로 닫혀요.
// 확장 창 안에서 도는 화면 코드라 JavaScript로 써요(브라우저 안에서는 이것만 돼요).
const KEY='core.download:startBubble',SHOW_MS=4000;
const TABS={download:'download',mail:'gmail'},HINTS={download:'눌러서 다운로더 열기',mail:'눌러서 메일 열기'};
const text=document.getElementById('text'),bubble=document.getElementById('bubble');
let timer=0,hover=false,kind='download';
const later=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!hover)window.close();},SHOW_MS);};
const paint=value=>{if(value?.text){kind=TABS[value.kind]?value.kind:'download';text.textContent=value.text;bubble.title=value.text+'\n'+HINTS[kind];document.body.dataset.kind=kind;}later();};
chrome.storage.session.get(KEY).then(v=>paint(v[KEY])).catch(()=>later());
chrome.storage.session.onChanged.addListener(changes=>{if(changes[KEY]?.newValue)paint(changes[KEY].newValue);});
bubble.addEventListener('mouseenter',()=>{hover=true;clearTimeout(timer);});
bubble.addEventListener('mouseleave',()=>{hover=false;later();});
// 누르면 같은 창에서 BongExtend를 열어요: 다운로드 말풍선 → 다운로더 탭, 메일 말풍선 → 메일 탭.
bubble.addEventListener('click',()=>{clearTimeout(timer);location.href='popup.html?tab='+TABS[kind];});
