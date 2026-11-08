import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
const context={URL};vm.runInNewContext(readFileSync(new URL('../../../../public/js/bongextend-profile.js',import.meta.url),'utf8'),context);const profile=context.BongProfile;
test('session profile pictures are associated with the nearest matching account and restricted to Google avatars',()=>{
 const photo='https://lh3.googleusercontent.com/a/test=s96-c';
 assert.equal(profile.valid(photo),photo);assert.equal(profile.valid('https://googleusercontent.com.evil.test/a/photo'),null);assert.equal(profile.valid('http://lh3.googleusercontent.com/a/test'),null);
 assert.equal(profile.valid('https://lh3.googleusercontent.com/ogw/test=s32-c'),'https://lh3.googleusercontent.com/ogw/test=s32-c');
 assert.equal(profile.fromHtml('other@gmail.com "'+photo+'"','me@gmail.com'),null);
 assert.equal(profile.fromHtml('me@gmail.com "'+photo+'"','me@gmail.com'),photo);
});
test('cached and session profile photos replace the letter fallback and unhide account headers',async()=>{
 const window=new Window();let profile={imageUrl:'https://lh3.googleusercontent.com/a/real=s32'},requests=0;
 try{
  window.document.body.innerHTML='<div id="account"><img class="accountPhoto" hidden style="display:none"></div><div id="side"><img class="accountPhoto"></div>';
  const account={getSetting:async key=>key==='profileInfo'?profile:'#345',getEmailDisplayName:async()=> 'Example',getEmail:()=> 'me@gmail.com'},header=window.document.getElementById('account'),side=window.document.getElementById('side');side._account=account;
  const sandbox={setLetterAvatar:async img=>{await new Promise(resolve=>setImmediate(resolve));img.setAttribute('src','data:letter');},chrome:{runtime:{sendMessage:async()=>{requests++;return {imageUrl:'https://lh3.googleusercontent.com/ogw/session=s32'};}}}};
  const source=readFileSync(new URL('../../../../public/js/popup.js',import.meta.url),'utf8'),a=source.indexOf('async function setAccountAvatar('),b=source.indexOf('\nfunction setAvatarUnreadCount',a);vm.runInNewContext(source.slice(a,b),sandbox);
  await sandbox.setAccountAvatar(header,side);assert.equal(header.querySelector('img').hidden,false);assert.equal(header.querySelector('img').getAttribute('src'),profile.imageUrl);assert.equal(requests,0);
  profile=null;await sandbox.setAccountAvatar(header,side);assert.equal(requests,1);assert.equal(header.querySelector('img').getAttribute('src'),'https://lh3.googleusercontent.com/ogw/session=s32');
 }finally{await window.happyDOM.close();}
});
