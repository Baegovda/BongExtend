// 로그인된 Gmail 세션의 새 메일 변화를 로컬에서 확인해요.
(() => {
    const signatures = new Map();
    let running = false;
    async function tick() {
        if (running || !navigator.onLine) return;
        running = true;
        try {
            const config = await chrome.runtime.sendMessage({command: "BongExtendGetSessionWatchConfig"});
            if (!config?.enabled) return;
            let changed = false;
            const accounts = [...new Set(config.accounts || [])].filter(index => Number.isInteger(index) && index >= 0 && index <= 19);
            await Promise.all(accounts.map(async index => {
                try {
                    const response = await fetch(`https://mail.google.com/mail/u/${index}/feed/atom`, {credentials: "include", cache: "no-store", signal: AbortSignal.timeout(8000)});
                    if (!response.ok || !response.url.startsWith("https://mail.google.com/")) return;
                    const doc = new DOMParser().parseFromString(await response.text(), "text/xml");
                    if (!doc.querySelector("feed") || doc.querySelector("parsererror")) return;
                    const signature = [doc.querySelector("fullcount")?.textContent, ...[...doc.querySelectorAll("entry id")].map(node => node.textContent)].join("|");
                    if (signatures.has(index) && signatures.get(index) !== signature) changed = true;
                    signatures.set(index, signature);
                } catch { /* 일시적인 네트워크 오류는 다음 확인에서 재시도해요. */ }
            }));
            if (changed) await chrome.runtime.sendMessage({command: "BongExtendMailSessionChanged"});
        } catch { /* 서비스 워커가 다시 준비되면 연결해요. */ }
        finally { running = false; }
    }
    setInterval(tick, 10000);
    void tick();
})();
