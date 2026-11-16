// 확장 프로그램이 업데이트되면 열려 있던 탭의 예전 다크 모드 스크립트가 확장 없이 계속 돌아요(고아).
// 새 스크립트가 들어오면 다크 리더 두 벌이 한 페이지에서 서로 스타일을 지우고 다시 넣어요.
// 숨겨진 탭에서 이렇게 되면 다크 리더의 임시 바탕(.darkreader--fallback, 모든 요소를 어둡게 칠함)이
// 걷히지 않아 유튜브 영상 위 투명한 층까지 회색으로 덮여요.

export const TAKEOVER_EVENT = "bongextend-dark-takeover";

// 새 스크립트: 다른 실행 공간에 남은 예전 스크립트에게 물러나라고 알려요. 자기 테마를 켜기 전에 불러요.
export function announceTakeover(doc) {
    const Ctor = doc.defaultView?.CustomEvent || CustomEvent;
    doc.dispatchEvent(new Ctor(TAKEOVER_EVENT));
}

// 예전 스크립트: 확장과 연결이 끊긴(고아) 경우에만 물러나요. 페이지가 이 이벤트를 보내도 살아 있는 스크립트는 그대로예요.
export function listenForTakeover(doc, isOrphaned, retire) {
    const listener = () => {
        if (!isOrphaned()) return;
        doc.removeEventListener(TAKEOVER_EVENT, listener);
        retire();
    };
    doc.addEventListener(TAKEOVER_EVENT, listener);
    return () => doc.removeEventListener(TAKEOVER_EVENT, listener);
}

export const FALLBACK_SETTLE_MS = 3000;

// 안전망: 탭이 보이고 문서가 준비된 채 settle 시간이 지났는데도 임시 바탕이 남아 있으면 비워요.
// (예전 버전의 고아 스크립트는 물러나라는 신호를 모르기 때문이에요.)
export function createFallbackSweeper(doc, {isActive, onSweep, delay = FALLBACK_SETTLE_MS, setTimer = setTimeout, clearTimer = clearTimeout} = {}) {
    let timer = 0;
    let running = false;
    const sweep = () => {
        timer = 0;
        if (!running || doc.visibilityState !== "visible" || !isActive()) return;
        if (doc.readyState === "loading") { timer = setTimer(sweep, delay); return; }
        if (doc.documentElement?.getAttribute("data-darkreader-scheme") !== "dark") return;
        let cleared = 0;
        for (const style of doc.querySelectorAll("style.darkreader--fallback")) {
            if (style.textContent) { style.textContent = ""; cleared++; }
        }
        onSweep?.(cleared);
    };
    const schedule = () => {
        if (timer) clearTimer(timer);
        timer = 0;
        if (running && doc.visibilityState === "visible") timer = setTimer(sweep, delay);
    };
    return {
        start() {
            if (!running) { running = true; doc.addEventListener("visibilitychange", schedule); }
            schedule();
        },
        stop() {
            running = false;
            doc.removeEventListener("visibilitychange", schedule);
            if (timer) clearTimer(timer);
            timer = 0;
        }
    };
}
