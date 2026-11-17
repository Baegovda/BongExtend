// 원래부터 어두운 사이트(자체 다크 테마) 감지.
// 이미 어두운 사이트에 다크 리더를 한 번 더 입히면 흰 글자가 검정·회색으로 바뀌어 읽을 수 없어요(예: Tripo).
// 다크 리더와 우리 임시 스타일을 같은 작업 안에서 잠깐 끄고(화면은 다시 그려지지 않음) 사이트 본래 색을 재요.

export const NATIVE_DARK_KEY = "core.darkNativeSites";
const MAX_SITES = 100;
const NATIVE_DARK_TTL = 30 * 24 * 60 * 60 * 1000;

const srgb = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };

// 색 문자열 → [밝기(0~1, OKLab L에 가까움), 불투명도]. 모르는 형식은 null.
export function colorLightness(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "transparent") return [0, 0];
    let m = v.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
        // getComputedStyle는 숫자만 돌려줘요(퍼센트 없음).
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        if (p.length < 3 || p.slice(0, 3).some(n => !Number.isFinite(n))) return null;
        const y = 0.2126 * srgb(p[0]) + 0.7152 * srgb(p[1]) + 0.0722 * srgb(p[2]);
        return [Math.cbrt(y), p.length > 3 && Number.isFinite(p[3]) ? p[3] : 1];
    }
    m = v.match(/^ok(?:lab|lch)\(\s*([\d.]+)(%?)[^/)]*(?:\/\s*([\d.]+)(%?))?\s*\)$/);
    if (m) {
        const l = parseFloat(m[1]) / (m[2] ? 100 : 1);
        const a = m[3] === undefined ? 1 : parseFloat(m[3]) / (m[4] ? 100 : 1);
        return [l, a];
    }
    return null;
}

const DARK_L = 0.4, LIGHT_TEXT_L = 0.62;

// 표본 판정: 바탕 표본의 70% 이상이 어둡고, 어두운 바탕 위 글자 표본이 있으면 그중 60% 이상이 밝아야 해요.
// 표본이 너무 적으면 아직 모른다(null)고 답해요.
export function classifyNativeDark({backgrounds, texts}) {
    if (backgrounds.length < 8) return null;
    const darkBg = backgrounds.filter(l => l < DARK_L).length / backgrounds.length;
    if (darkBg < 0.7) return false;
    if (texts.length >= 5 && texts.filter(l => l > LIGHT_TEXT_L).length / texts.length < 0.6) return false;
    return true;
}

const SKIP = /^(IMG|VIDEO|CANVAS|SVG|IFRAME|PICTURE|OBJECT|EMBED)$/i;

// 지금 화면에서 바탕·글자 밝기 표본을 모아요. 다크 리더 스타일은 이 함수 안에서만 꺼져요.
export function sampleNativeColors(doc) {
    const win = doc.defaultView;
    const root = doc.documentElement;
    // 색이 부드럽게 바뀌는 효과(transition)가 있으면 스타일을 꺼도 잠깐은 다크 모드 색이 읽혀요(예: Tripo 분류 칩).
    // 재는 동안만 그 효과를 멈춰요. darkreader 클래스라서 다크 리더가 이 스타일을 건드리지 않아요.
    const calm = doc.createElement("style");
    calm.className = "darkreader bong-native-probe";
    calm.textContent = "*,*::before,*::after{transition:none !important}";
    const sheets = [];
    for (const style of doc.querySelectorAll("style.darkreader, style[data-bong-dark-early]")) {
        if (style.sheet && !style.sheet.disabled) { style.sheet.disabled = true; sheets.push(style.sheet); }
    }
    root.appendChild(calm);
    try {
        const lightOf = el => colorLightness(win.getComputedStyle(el).backgroundColor);
        const rootL = (() => {
            for (const el of [root, doc.body]) {
                const c = el && lightOf(el);
                if (c && c[1] >= 0.9) return c[0];
            }
            // 바탕색이 없으면 브라우저 기본 캔버스: 사이트가 dark color-scheme을 쓰면 어둡고 아니면 흰색이에요.
            return /dark/.test(win.getComputedStyle(root).colorScheme) && !/light/.test(win.getComputedStyle(root).colorScheme) ? 0.15 : 1;
        })();
        // 요소 뒤의 바탕 밝기: 불투명한 바탕을 찾을 때까지 위로 올라가요. 배경 그림이 있으면 모른다(undefined).
        const backgroundOf = el => {
            for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
                const s = win.getComputedStyle(n);
                if (s.backgroundImage !== "none") return undefined;
                const c = colorLightness(s.backgroundColor);
                if (c && c[1] >= 0.9) return c[0];
            }
            return rootL;
        };
        const backgrounds = [];
        const w = win.innerWidth, h = win.innerHeight;
        for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
            const el = doc.elementFromPoint((col + 0.5) * w / 6, (row + 0.5) * h / 5);
            if (!el || SKIP.test(el.tagName) || el.closest("svg")) continue;
            const l = backgroundOf(el);
            if (l !== undefined) backgrounds.push(l);
        }
        // 글자는 어두운 바탕 위에 있는 것만 봐요(어두운 사이트에도 흰 단추 위 검정 글자는 흔해요).
        const texts = [];
        const walker = doc.createTreeWalker(doc.body || root, 4);
        for (let node, seen = 0; (node = walker.nextNode()) && texts.length < 30 && seen < 600; seen++) {
            if (node.textContent.trim().length < 2) continue;
            const el = node.parentElement;
            if (!el || el.closest("[data-bong-contrast-owned],[hidden],script,style,noscript")) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > h) continue;
            const s = win.getComputedStyle(el);
            if (s.visibility !== "visible" || s.backgroundClip === "text") continue;
            const c = colorLightness(s.color);
            if (!c || c[1] < 0.5) continue;
            const behind = backgroundOf(el);
            if (behind !== undefined && behind < DARK_L) texts.push(c[0]);
        }
        return {backgrounds, texts};
    } finally {
        for (const sheet of sheets) sheet.disabled = false;
        // 원래 스타일로 다시 계산한 뒤에 효과를 되돌려야 색이 바뀌는 애니메이션이 생기지 않아요.
        root.getBoundingClientRect();
        calm.remove();
    }
}

// 한 번 잰 결과를 믿을지 정해요.
// "어둡다"는 1.5초 간격으로 두 번 연속 나와야 믿어요(로딩 중 잠깐 어두운 화면 때문에 꺼지지 않게).
// "밝다"는 페이지가 다 불러와졌거나 마지막 확인일 때 믿어요(끝없이 불러오는 페이지에서 확인을 포기하지 않게).
export function settleNativeCheck(result, darkStreak, {complete, last}) {
    const streak = result === true ? darkStreak + 1 : 0;
    if (result === true && streak >= 2) return {verdict: true, streak};
    if (result === false && (complete || last)) return {verdict: false, streak};
    return {verdict: null, streak};
}

// 저장해 둔 사이트 목록. 값이 양수면 "원래 어두운 사이트"(처음부터 그대로 둬요),
// 음수면 "페이지마다 달라요"(어두운 페이지도 밝은 페이지도 봤어요: 다크 모드를 먼저 입히고 페이지마다 확인만 해요).
// 타오바오·티몰 상품 페이지처럼 가게마다 꾸밈이 다른 사이트가 통째로 꺼지지 않게 해요.
export function nativeDarkSites(value, now = Date.now()) {
    const out = {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [host, at] of Object.entries(value)) {
            if (typeof host === "string" && host.length < 256 && Number.isFinite(at) && at !== 0 && now - Math.abs(at) < NATIVE_DARK_TTL) out[host] = at;
        }
    }
    return out;
}

// 처음부터 다크 모드 없이 띄울 사이트인가요?
export function startsNativeDark(value, host, now = Date.now()) {
    return nativeDarkSites(value, now)[host] > 0;
}

export function withNativeDark(value, host, dark, now = Date.now()) {
    const sites = nativeDarkSites(value, now);
    const prev = sites[host];
    delete sites[host];
    if (dark) sites[host] = prev < 0 ? -now : now;
    else if (prev) sites[host] = -now;
    const entries = Object.entries(sites).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, MAX_SITES);
    return Object.fromEntries(entries);
}
