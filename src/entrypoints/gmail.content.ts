export default defineContentScript({
    matches: ["https://mail.google.com/*"],
    runAt: "document_idle",
    main() {
        let timer = 0;
        let lastTitle = document.title;
        let watching = false;

        const signal = () => {
            try {
                chrome.runtime.sendMessage({type: "gmail-tab-signal"});
            } catch {
                // 서비스 워커가 잠들어 있으면 다음 알람이 다시 확인한다.
            }
        };

        const watchTitle = () => {
            if (document.title === lastTitle) return;
            lastTitle = document.title;
            signal();
        };

        const arm = () => {
            window.clearInterval(timer);
            timer = window.setInterval(() => {
                watchTitle();
                signal();
            }, document.hidden ? 20000 : 10000);
        };

        const start = () => {
            if (watching) {
                arm();
                return;
            }
            watching = true;
            const title = document.querySelector("title");
            if (title) {
                new MutationObserver(watchTitle).observe(title, {subtree: true, childList: true, characterData: true});
            }
            document.addEventListener("visibilitychange", arm);
            arm();
            signal();
        };

        const stop = () => {
            watching = false;
            window.clearInterval(timer);
        };

        chrome.storage.local.get("core.modules").then((stored) => {
            const modules = stored["core.modules"] as {gmail?: boolean} | undefined;
            if (modules?.gmail === false) return;
            start();
        }).catch(() => start());

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local" || !changes["core.modules"]) return;
            const next = changes["core.modules"].newValue as {gmail?: boolean} | undefined;
            if (next?.gmail === false) stop();
            else start();
        });
    }
});
