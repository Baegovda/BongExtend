import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';

test('이미지 차단은 본문 배경색과 그라데이션을 보존한다', async () => {
    const window=new Window(), root=window.document.createElement('div');
    root.innerHTML='<div id="solid" style="background:#111;color:#fff">어두운 원문</div><div id="remote" style="background:#fff url(https://example.invalid/tracker.png);color:#111">밝은 원문</div><div id="gradient" style="background:linear-gradient(#111,#333);color:#fff">그라데이션</div>';
    const source=readFileSync(new URL('../../../../public/js/popup.js',import.meta.url),'utf8');
    const fn=source.slice(source.indexOf('function hideRemoteMessageBackgrounds('),source.indexOf('function showImages('));
    const context=vm.createContext({}); vm.runInContext(fn,context);
    assert.equal(context.hideRemoteMessageBackgrounds(root),true);
    assert.equal(root.querySelector('#solid').style.backgroundColor,'#111');
    assert.equal(root.querySelector('#remote').style.backgroundColor,'#fff');
    assert.equal(root.querySelector('#remote').style.backgroundImage,'none');
    assert.match(root.querySelector('#gradient').style.backgroundImage,/linear-gradient/);
    await window.happyDOM.close();
});

test('모듈은 전체 메뉴를 지우지 않고 번역 메뉴를 보존한다', async () => {
    const source=readFileSync(new URL('../../../../public/js/background.js',import.meta.url),'utf8');
    const fn=source.slice(source.indexOf('function initContextMenus()'),source.indexOf('function setBadgeEllipsis()'));
    const menus=new Map([['toggle-translation',{title:'이 페이지 번역하기'}],['mail',{title:'old'}]]);
    const context=vm.createContext({ContextMenu:{OPEN_GMAIL:'mail',AllContexts:['page']},chrome:{contextMenus:{async remove(id){menus.delete(id);}}},
        getMessage:s=>s,getUniqueId:()=>1,initQuickContactContextMenu(){},createContextMenu(id,title){menus.set(id,{title});},console});
    vm.runInContext(fn,context); context.initContextMenus(); await new Promise(resolve=>setImmediate(resolve));
    assert.equal(menus.get('toggle-translation').title,'이 페이지 번역하기');
    assert.equal(menus.get('mail').title,'openGmailTab');
});
