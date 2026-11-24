// 페이지에서 실제 영상 주소 찾기(findPageMedia·pickMedia)를 실제 크롬에서 확인해요. 가짜 사이트만 쓰고 바깥 네트워크는 쓰지 않아요.
const {chromium}=require('playwright');const fs=require('node:fs'),assert=require('node:assert/strict');
const src=fs.readFileSync('src/modules/downloads/video-sniff.js','utf8');
const find=src.match(/export function findPageMedia\(\) \{[\s\S]*?\n\}\n/)[0].replace('export ','');
(async()=>{const {pickMedia}=await import('../src/modules/downloads/video-sniff.js');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage();
  await page.route('https://**/*',route=>{const u=route.request().url();
   if(u.endsWith('/watch'))return route.fulfill({contentType:'text/html',body:`<!doctype html><body><video id=ad src="https://ads.site.test/vast/preroll.mp4"></video><iframe src="https://player.test/embed/7"></iframe><script>fetch('https://cdn.site.test/hls/master.m3u8?t=1');fetch('https://cdn.site.test/hls/seg1.ts')</script>`});
   if(u.endsWith('/embed/7'))return route.fulfill({contentType:'text/html',body:`<!doctype html><body><video src="blob:https://player.test/x"></video><script>window.jwplayer=()=>({getPlaylistItem:()=>({file:'https://cdn.player.test/v/720.m3u8'})});fetch('https://cdn.player.test/v/master.m3u8')</script>`});
   return route.fulfill({status:200,body:'#EXTM3U'});});
  await page.goto('https://site.test/watch');await page.waitForTimeout(800);
  const results=[];for(const frame of page.frames())results.push(await frame.evaluate(`(${find})()`));
  const top=results[0];
  assert.ok(top.items.some(i=>i.url==='https://cdn.site.test/hls/master.m3u8?t=1'&&i.kind==='hls'),'network m3u8 found');
  assert.ok(!top.items.some(i=>i.url.endsWith('.ts')),'segments are ignored');
  const embed=results.find(r=>r.page==='https://player.test/embed/7');
  assert.ok(embed.items.some(i=>i.from==='player'&&i.url.endsWith('720.m3u8')),'jwplayer source found');
  assert.ok(!embed.items.some(i=>i.url.startsWith('blob:')),'blob: video is skipped');
  const picked=pickMedia(results);
  assert.ok(/master\.m3u8/.test(picked.url),'a master playlist wins');
  assert.ok(!/preroll/.test(picked.url),'the ad is not chosen');
  // 재생 목록 주소가 쿼리에 숨어 있거나, 재생기 객체만 주소를 들고 있는 사이트.
  await page.route('https://hidden.test/**',route=>{const u=route.request().url();
   if(u.endsWith('/v'))return route.fulfill({contentType:'text/html',body:`<!doctype html><body><video src="blob:https://hidden.test/x"></video><script>window.art={option:{url:'https://cdn.hidden.test/play/abc.m3u8?token=1'}};fetch('https://api.hidden.test/stream.php?id=9&type=m3u8')</script>`});
   return route.fulfill({status:200,body:'#EXTM3U'});});
  await page.goto('https://hidden.test/v');await page.waitForTimeout(500);
  const hidden=await page.mainFrame().evaluate(`(${find})()`);
  assert.ok(hidden.items.some(i=>i.from==='player'&&i.url.includes('abc.m3u8')),'player object address found');
  assert.ok(hidden.items.some(i=>i.kind==='hls'&&i.url.includes('type=m3u8')),'m3u8 named in the query is found');
  assert.ok(hidden.total>=1&&hidden.sample.some(x=>x.includes('stream.php')),'diagnostic sample lists fetched addresses');
  assert.deepEqual(hidden.videos,['blob:https://hidden.test/x']);
  console.log('PASS video sniff:',JSON.stringify(picked));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
