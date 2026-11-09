// 메일 페이지의 명시적인 번역 요청만 처리해요. API 키는 배경에 남겨요.
(() => {
    let library, session;
    function loadLibrary() {
        if (globalThis.__pageTranslator?.createSession) return Promise.resolve();
        return library ||= new Promise((resolve, reject) => {
            globalThis.__pageTranslator = {libraryOnly: true};
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('trans/content/content.js');
            script.onload = resolve;
            script.onerror = () => {library = null; script.remove(); reject(Error('번역기를 불러오지 못했어요. 다시 시도해 주세요.'));};
            document.head.appendChild(script);
        });
    }
    function translateBatch(texts) {
        return new Promise((resolve, reject) => {
            const port = chrome.runtime.connect({name: 'bongextend-translation-batch'});
            let settled = false;
            const finish = (fn, result) => {
                if (settled) return;
                settled = true; fn(result);
                try {port.disconnect();} catch { /* 이미 닫힌 연결이에요. */ }
            };
            port.onMessage.addListener(message => {
                if (message?.type === 'BONGEXTEND_TRANSLATION_BATCH_RESULT') finish(resolve, message.response);
            });
            port.onDisconnect.addListener(() => finish(reject, Error(chrome.runtime.lastError?.message || '번역 연결이 끊겼어요. 다시 시도해 주세요.')));
            port.postMessage({type: 'BONGEXTEND_TRANSLATION_BATCH', texts});
        });
    }
    async function translatePage() {
        const naver = document.querySelector('#beNaverReader:not([hidden]) #beNaverBody');
        const root = naver ? naver.contentDocument?.body : document.querySelector('#openEmailSection.active #openEmailMessages') || document.querySelector('#inboxSection.active #inbox');
        if (!root) return;
        let status = document.getElementById('beMailTranslationStatus');
        if (!status) {
            status = document.createElement('div'); status.id = 'beMailTranslationStatus'; status.className = 'be-mail-translation-status'; status.setAttribute('role', 'status');
            root.parentElement.insertBefore(status, root);
        }
        status.textContent = '이 페이지를 번역하고 있어요…';
        try {
            const modules = (await chrome.storage.local.get('core.modules'))['core.modules'];
            if (modules?.trans === false) throw Error('설정에서 번역 모듈을 켜 주세요.');
            await loadLibrary();
            const prefs = await chrome.runtime.sendMessage({type: 'GET_PREFS'});
            session?.setEnabled(false);
            session = globalThis.__pageTranslator.createSession({root, walkRoot: root, enableBanner: false, sendBatch: translateBatch,
                onStatus: value => {status.textContent = value.error || (value.pending ? '이 페이지를 번역하고 있어요…' : '페이지 번역을 적용했어요.');},
            });
            session.setPrefs(prefs || {}); session.start();
        } catch (error) {status.textContent = error.message || '번역을 시작하지 못했어요.';}
    }
    chrome.runtime.onMessage.addListener((message, sender) => {
        if (sender.id === chrome.runtime.id && message?.type === 'BONGEXTEND_TRANSLATE_MAIL_PAGE' && message.documentUrl === location.href) void translatePage();
    });
})();
