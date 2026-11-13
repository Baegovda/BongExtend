// 유튜브 영상이 "저절로" 재생되지 않게 막아요.
// 브라우저를 켜서 복원된 탭, 새로고침·뒤로가기로 다시 열린 탭, 백그라운드로 열린 탭에서
// 사용자가 아무것도 누르지 않았는데 시작되는 재생만 멈춰요. 직접 누른 재생은 그대로 돼요.
export const YOUTUBE_SCRIPT_ID = "bongextend-youtube-hold";
export const YOUTUBE_SCRIPT_FILE = "content-scripts/youtube-hold.js";
export const YOUTUBE_MATCHES = ["https://www.youtube.com/*"];
export const HOLD_WINDOW_MS = 20000;

// 탭을 연 방식으로 "자동 재생을 막을 상황"인지 판단해요.
export function shouldHold({navigationType = "navigate", hidden = false, startupRecent = false, hasUserActivation = false} = {}) {
    if (hasUserActivation) return false;
    return navigationType === "reload" || navigationType === "back_forward" || hidden || startupRecent;
}

// 막기 시작한 뒤 사용자가 직접 한 일(클릭·키·터치)이 있으면 막기를 끝내요.
export function installHold(win, {now = () => Date.now(), windowMs = HOLD_WINDOW_MS, startupRecent = false} = {}) {
    const doc = win.document;
    const nav = win.performance?.getEntriesByType?.("navigation")?.[0];
    let holding = shouldHold({
        navigationType: nav?.type || "navigate",
        hidden: doc.visibilityState === "hidden",
        startupRecent,
        hasUserActivation: Boolean(win.navigator?.userActivation?.hasBeenActive)
    });
    if (!holding) return {isHolding: () => false, stop() {}};
    const startedAt = now();
    const events = ["pointerdown", "keydown", "touchstart"];
    let timer = null;
    const stop = () => {
        doc.removeEventListener("play", onPlay, true);
        for (const name of events) doc.removeEventListener(name, onUser, true);
        if (timer !== null) win.clearInterval?.(timer);
    };
    const release = () => { holding = false; stop(); };
    function onPlay(event) {
        if (!holding) return;
        const video = event.target;
        if (!video || video.tagName !== "VIDEO") return;
        if (now() - startedAt > windowMs || win.navigator?.userActivation?.isActive) { release(); return; }
        try { video.pause(); } catch { /* 이미 멈춘 영상이에요. */ }
    }
    function onUser(event) { if (event.isTrusted !== false) release(); }
    doc.addEventListener("play", onPlay, true);
    for (const name of events) doc.addEventListener(name, onUser, true);
    // 영상이 이미 재생을 시작해 버린 경우에도 멈춰요.
    const sweep = () => { for (const video of doc.querySelectorAll("video")) if (!video.paused) onPlay({target: video}); };
    sweep();
    if (holding) {
        timer = win.setInterval?.(() => {
            if (!holding || now() - startedAt > windowMs) { release(); return; }
            sweep();
        }, 400) ?? null;
    }
    return {isHolding: () => holding, stop: release};
}
