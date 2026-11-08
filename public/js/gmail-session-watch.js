// 로그인된 Gmail 세션의 새 메일 변화를 로컬에서 확인해요.
(() => {
    const signatures = new Map();
    const retries = new Map();
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
                const retry=retries.get(index);
                if(retry && Date.now()<retry.nextAt)return;
                const defer=(delay=0)=>{const fails=(retry?.fails || 0)+1;retries.set(index,{fails,nextAt:Date.now()+Math.max(delay,Math.min(60000,1000*2**Math.min(fails,6)))});};
                try {
                    const response = await fetch(`https://mail.google.com/mail/u/${index}/feed/atom`, {credentials: "include", cache: "no-store", signal: AbortSignal.timeout(8000)});
                    if (!response.ok || !response.url.startsWith("https://mail.google.com/")) {
                        const header=response.headers?.get('Retry-After');
                        const delay=header ? (/^\d+$/.test(header)?Number(header)*1000:Math.max(0,Date.parse(header)-Date.now())) : 0;
                        defer(response.status===401||response.status===403?Math.max(60000,delay||0):delay||0);return;
                    }
                    const doc = new DOMParser().parseFromString(await response.text(), "text/xml");
                    if (!doc.querySelector("feed") || doc.querySelector("parsererror")) {defer(60000);return;}
                    retries.delete(index);
                    const signature = [doc.querySelector("fullcount")?.textContent, ...[...doc.querySelectorAll("entry id")].map(node => node.textContent)].join("|");
                    if (signatures.has(index) && signatures.get(index) !== signature) changed = true;
                    signatures.set(index, signature);
                } catch { defer(); }
            }));
            if (changed) await chrome.runtime.sendMessage({command: "BongExtendMailSessionChanged"});
        } catch { /* 서비스 워커가 다시 준비되면 연결해요. */ }
        finally { running = false; }
    }
    setInterval(tick, 1000);
    void tick();
})();
