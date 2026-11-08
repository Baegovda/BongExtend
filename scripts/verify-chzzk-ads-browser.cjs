const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {readFileSync} = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
(async () => {
  const server = http.createServer((req,res)=>res.end('<!doctype html><title>Local playback response test</title>'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${server.address().port}`);
    await page.evaluate(()=>{window.nativeParse=JSON.parse;});
    // Simulate an old content script remaining on an already-open page.
    await page.evaluate(()=>{window.__bongAdHook=true;});
    await page.addScriptTag({content:readFileSync('src/modules/chzzk/lib/ads.js','utf8')});
    const result = await page.evaluate(async()=>{
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12)), encoder=new TextEncoder(), decoder=new TextDecoder();
      let enabled=true;
      BongAds.installAdHooks(window,()=>enabled);
      const installedDecrypt=crypto.subtle.decrypt;
      if (BongAds.installAdHooks(window,()=>enabled) !== false || crypto.subtle.decrypt !== installedDecrypt) throw Error('duplicate hooks installed');
      const roundtrip=async value=>{
        const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(value)));
        return nativeParse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher)));
      };
      const original={content:{livePlaybackJson:{liveId:true,chatChannelId:true}}};
      const decision=await roundtrip(original);
      const media={content:{liveId:123,livePlaybackJson:'{"media":[{"path":"https://cdn.example/live.m3u8"}]}',chatChannelId:'chat'}};
      const kept=await roundtrip(media);
      const poll=await roundtrip({content:{adControlType:'INTEGRATION_CONTROL',event:'START',adCount:2}});
      enabled=false;
      const disabled=await roundtrip(original);
      return {decision,kept,poll,disabled};
    });
    assert.equal(result.decision.content.playerAdDisplayResponse.preRoll,false);
    assert.equal(result.decision.content.playerAdDisplayResponse.midRoll,false);
    assert.equal(result.kept.content.livePlaybackJson,'{"media":[{"path":"https://cdn.example/live.m3u8"}]}');
    assert.equal(result.kept.content.chatChannelId,'chat');
    assert.equal(result.poll.content.event,'ABORT');
    assert.equal('playerAdDisplayResponse' in result.disabled.content,false);
    console.log('PASS native Chrome encrypted responses: pre/mid flags off, poll abort, playback preserved, disabled unchanged');
    await page.setContent('<main><video style="width:400px;height:200px"></video></main><div id="noticeBackdrop"><section role="alertdialog">광고 차단 프로그램을 사용 중이신가요? 확장 프로그램이 재생 환경에 영향을 줄 수 있어요.<button>확인</button></section></div><div id="ordinary"><section role="alertdialog">구독을 취소하시겠어요?<button>확인</button></section></div>');
    await page.evaluate(()=>{window.__bongAdFlagHook=true; window.chrome ||= {}; chrome.runtime={id:'fixture'};});
    await page.addScriptTag({content:readFileSync('src/modules/chzzk/lib/player.js','utf8')});
    await page.addScriptTag({content:readFileSync('src/modules/chzzk/content-adflag.js','utf8')});
    assert.equal(await page.locator('#noticeBackdrop').isVisible(),false);
    assert.equal(await page.locator('#ordinary').isVisible(),true);
    assert.equal(await page.locator('video').isVisible(),true);
    await page.evaluate(()=>document.documentElement.setAttribute('data-bong-adblock','0'));
    await page.locator('#noticeBackdrop').waitFor({state:'visible'});
    console.log('PASS native Chrome notice backdrop hidden, player and other dialogs preserved, disabling restores the notice');
  } finally {await browser.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
