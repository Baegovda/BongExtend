// yt-dlp가 모르는 사이트를 위해, 열려 있는 영상 페이지에서 실제 영상 파일 주소(m3u8·mpd·mp4 등)를 찾아요.
// 웹페이지 안에서 도는 코드라 JavaScript로 써요(브라우저 안에서는 이것만 돼요). 찾은 주소는 Rust 보조 프로그램이 받아요.
// findPageMedia는 executeScript로 페이지(모든 프레임, MAIN 세계)에 들어가요. 바깥 변수를 쓰면 안 돼요.
export function findPageMedia() {
 const items=[];const seen=new Set();
 const add=(value,from)=>{
  try{
   if(typeof value!=='string'||!value)return;
   const url=new URL(value,location.href);
   if(!/^https?:$/.test(url.protocol)||seen.has(url.href))return;
   const path=url.pathname.toLowerCase();
   const kind=/\.m3u8$/.test(path)?'hls':/\.mpd$/.test(path)?'dash':/\.(mp4|webm|m4v|mov|mkv|flv|ogv)$/.test(path)?'file':from!=='network'?'file':'';
   if(!kind)return;
   seen.add(url.href);items.push({url:url.href,kind,from});
  }catch{}
 };
 const videos=[...document.querySelectorAll('video')];
 for(const video of videos){add(video.currentSrc||video.src,'video');for(const source of video.querySelectorAll('source'))add(source.src,'video');}
 // 자주 쓰는 영상 재생기가 들고 있는 주소.
 try{const jw=globalThis.jwplayer?.();const item=jw?.getPlaylistItem?.();add(item?.file,'player');for(const s of item?.sources||[])add(s?.file,'player');}catch{}
 try{for(const player of Object.values(globalThis.videojs?.players||{}))add(player?.currentSrc?.(),'player');}catch{}
 try{for(const entry of performance.getEntriesByType('resource'))add(entry.name,'network');}catch{}
 return {page:location.href,playing:videos.some(video=>!video.paused||video.currentTime>0),items:items.slice(0,60)};
}

const AD=/(^|[/._-])(ads?|adv|vast|vmap|preroll|midroll|doubleclick|imasdk|banner|promo)([/._-]|$)/i;

// 프레임별 결과에서 가장 그럴듯한 영상 주소 하나를 골라요. 출처(referer)는 그 영상을 찾은 프레임 주소예요.
export function pickMedia(results) {
 let best=null;
 for(const frame of results||[]){
  if(!frame||typeof frame.page!=='string')continue;
  for(const item of frame.items||[]){
   let score=item.kind==='hls'||item.kind==='dash'?(/master|playlist|index/i.test(item.url)?5:4):item.from==='video'||item.from==='player'?3:2;
   if(item.from==='video'||item.from==='player')score+=0.5;
   if(frame.playing)score+=1;
   if(AD.test(item.url))score-=4;
   if(score>0&&(!best||score>best.score))best={score,url:item.url,referer:frame.page};
  }
 }
 return best?{url:best.url,referer:best.referer}:null;
}

const sameUrl=(a,b)=>{try{const x=new URL(a),y=new URL(b);x.hash='';y.hash='';return x.href===y.href;}catch{return false;}};

// 영상 페이지 탭(알려 준 탭, 없으면 같은 주소로 열린 탭)에서 예비 영상 주소를 찾아요. 못 찾으면 null.
export function createMediaSniffer(chromeApi) {
 return async (pageUrl,tabId)=>{
  try{
   const api=chromeApi||globalThis.chrome;
   let tab=Number.isInteger(tabId)?await api.tabs.get(tabId).catch(()=>null):null;
   if(!tab)tab=(await api.tabs.query({})).find(t=>sameUrl(t.url||'',pageUrl))||null;
   if(!tab?.id||!/^https?:/.test(tab.url||''))return null;
   const results=await api.scripting.executeScript({target:{tabId:tab.id,allFrames:true},world:'MAIN',func:findPageMedia});
   const picked=pickMedia((results||[]).map(r=>r?.result));
   return picked&&!sameUrl(picked.url,pageUrl)?picked:null;
  }catch{return null;}
 };
}
