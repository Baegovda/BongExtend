// 다크 모드 시작 직후의 흰 번쩍임 방지.
// 페이지가 바뀔 때 콘텐츠 스크립트가 설정을 읽는 동안(비동기) 브라우저가 흰 바탕을 먼저 그려요.
// 스크립트가 시작하자마자 어두운 바탕을 동기로 칠하고, 다크 리더의 스타일이 올라온 뒤에 걷어내요.
// 이 임시 스타일은 배경색·글자색·color-scheme만 바꾸고 사진, 영상, 배경 이미지는 건드리지 않아요.

export const EARLY_STYLE_ATTR = "data-bong-dark-early";
const FAILSAFE_MS = 9000;
// 다크 리더가 사이트의 바깥 스타일시트(네이버 등)를 읽어 어둡게 바꾸는 데 시간이 걸려요.
// 그동안 원래의 흰 배경이 잠깐 드러나지 않도록, 페이지 로딩이 끝난 뒤에도 이 시간만큼 더 어두운 바탕을 유지해요.
const SETTLE_MS = 700;

export const earlyDarkCss = (background = "#181a1b", text = "#e8e6e3") =>
    `html{color-scheme:dark !important;}` +
    `html,body,body :not(iframe):not(img):not(video):not(canvas):not(svg):not(picture){background-color:${background} !important;border-color:#776e62 !important;color:${text} !important;}`;

const safeColor = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback);

export function createEarlyDarkGuard(doc, {background, text, schedule = (fn) => (doc.defaultView?.requestAnimationFrame ? doc.defaultView.requestAnimationFrame(fn) : setTimeout(fn, 16)), setTimer = setTimeout, clearTimer = clearTimeout, settleMs = SETTLE_MS} = {}) {
    let style = null;
    let timer = 0;
    let waiting = false;
    const css = earlyDarkCss(safeColor(background, "#181a1b"), safeColor(text, "#e8e6e3"));

    const mount = () => {
        if (style) return true;
        const host = doc.documentElement;
        if (!host) return false;
        style = doc.createElement("style");
        style.setAttribute(EARLY_STYLE_ATTR, "");
        style.textContent = css;
        host.appendChild(style);
        return true;
    };

    return {
        // 문서 루트가 아직 없으면 생길 때까지 기다렸다가 칠해요.
        start() {
            if (style || waiting) return;
            clearTimer(timer);
            timer = setTimer(() => this.release(true), FAILSAFE_MS);
            if (mount()) return;
            waiting = true;
            const observer = new (doc.defaultView?.MutationObserver || MutationObserver)(() => {
                if (mount()) { waiting = false; observer.disconnect(); }
            });
            observer.observe(doc, {childList: true, subtree: true});
        },
        // 다크 리더가 자기 스타일을 올린 뒤(두 프레임 뒤) 또는 즉시 걷어내요.
        release(immediate = false) {
            clearTimer(timer);
            const remove = () => { style?.remove(); style = null; };
            if (!style) return;
            if (immediate) { remove(); return; }
            // 두 프레임 뒤, 페이지 로딩이 끝나고 settleMs 가 더 지난 뒤에 걷어내요(실패해도 FAILSAFE_MS 에 걷어내요).
            const afterSettle = () => { if (settleMs > 0) setTimer(remove, settleMs); else remove(); };
            const whenLoaded = () => {
                if (doc.readyState === "complete" || settleMs <= 0) afterSettle();
                else doc.defaultView?.addEventListener("load", afterSettle, {once: true});
            };
            schedule(() => schedule(whenLoaded));
        },
        active: () => Boolean(style)
    };
}
