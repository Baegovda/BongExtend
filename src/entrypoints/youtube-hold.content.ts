// @ts-ignore plain JS shared with the worker and tests
import {installHold} from "@/modules/youtube/hold.js";

// 유튜브 자동 재생 막기. 백그라운드가 권한이 있을 때만 런타임에 등록해요.
export default defineContentScript({
    // 빌드용 값이에요(필수 권한이 늘지 않게 이미 있는 주소만 적어요). 실제 범위는 백그라운드가 런타임에 등록해요.
    matches: ["https://mail.google.com/*"],
    registration: "runtime",
    runAt: "document_start",
    main() {
        const flag = "__bongextendYoutubeHold";
        const scope = globalThis as unknown as Record<string, boolean | undefined>;
        if (scope[flag]) return;
        scope[flag] = true;
        void (async () => {
            let startupRecent = false;
            try {
                const state = await chrome.runtime.sendMessage({type: "bongextend-youtube-hold-state"}) as {on?: boolean; startupRecent?: boolean} | undefined;
                if (state && state.on === false) return;
                startupRecent = Boolean(state?.startupRecent);
            } catch { /* 백그라운드가 깨어나지 않으면 기본 판단만 써요. */ }
            installHold(window, {startupRecent});
        })();
    }
});
