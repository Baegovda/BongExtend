export default defineContentScript({
    matches: ["https://mail.google.com/*"],
    runAt: "document_idle",
    main() {
        let lastTitle = document.title;
        let watching = false;

        const signal = () => {
            if (document.title === lastTitle) return;
            lastTitle = document.title;
            try {
                chrome.runtime.sendMessage({type: "gmail-tab-signal"});
            } catch {
                // 백그라운드 확인이 곧 같은 변화를 본다.
            }
        };

        const start = () => {
            if (watching) return;
            watching = true;
            const title = document.querySelector("title");
            if (title) new MutationObserver(signal).observe(title, {subtree: true, childList: true, characterData: true});
            signal();
        };

        chrome.storage.local.get("core.modules").then((stored) => {
            const modules = stored["core.modules"] as {gmail?: boolean} | undefined;
            if (modules?.gmail === false) return;
            start();
        }).catch(() => start());
    }
});
