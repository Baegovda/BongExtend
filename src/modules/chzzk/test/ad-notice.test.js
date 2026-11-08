import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';

test('열린 탭의 옛 스타일 가드와 무관하게 광고 안내를 정리하고 일반 확인창은 남긴다', async () => {
  const window=new Window(), document=window.document;
  const context=vm.createContext({document, window, chrome:{runtime:{id:'fixture'}}, MutationObserver:window.MutationObserver, __bongAdFlagHook:true});
  vm.runInContext(readFileSync(new URL('../lib/player.js',import.meta.url),'utf8'),context);
  const source=readFileSync(new URL('../content-adflag.js',import.meta.url),'utf8');
  const insert=(text)=>{
    const dialog=document.createElement('section'); dialog.setAttribute('role','alertdialog'); dialog.textContent=text;
    const button=document.createElement('button'); button.textContent='확인';
    button.addEventListener('click',event=>{if(event.isTrusted)dialog.remove();}); dialog.appendChild(button);
    const backdrop=document.createElement('div'); backdrop.appendChild(dialog); document.body.appendChild(backdrop); return dialog;
  };
  const notice='광고 차단 프로그램을 사용 중이신가요? 사용 중인 확장 프로그램이 재생 환경에 영향을 줄 수 있어요.';
  const existing=insert(notice), ordinary=insert('구독을 취소하시겠어요?');
  vm.runInContext(source,context);
  assert.equal(existing.parentElement.style.display,'none'); assert.equal(ordinary.parentElement.style.display,'');
  const later=insert(notice); await window.happyDOM.whenAsyncComplete(); assert.equal(later.parentElement.style.display,'none');
  document.documentElement.setAttribute('data-bong-adblock','0');
  const disabled=insert(notice); await window.happyDOM.whenAsyncComplete(); assert.equal(disabled.parentElement.style.display,'');
  assert.equal(existing.parentElement.style.display,''); assert.equal(existing.parentElement.hasAttribute('aria-hidden'),false);
  await window.happyDOM.close();
});
