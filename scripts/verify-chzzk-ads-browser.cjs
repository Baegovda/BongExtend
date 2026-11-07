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
    await page.addScriptTag({content:readFileSync('src/modules/chzzk/lib/ads.js','utf8')});
    const result = await page.evaluate(async()=>{
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12)), encoder=new TextEncoder(), decoder=new TextDecoder();
      let enabled=true;
      BongAds.installAdHooks(window,()=>enabled);
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
  } finally {await browser.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
