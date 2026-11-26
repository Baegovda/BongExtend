// 왼쪽 탭 목록과 오른쪽 내용 사이의 경계를 끌어서 탭 목록 폭을 바꿔요. 두 번 누르면 원래 폭으로 돌아가요.
// 아주 좁히면 글자는 숨기고 아이콘만 보여요.
export const SIDE_WIDTH_KEY = "core.popupSideWidth";
export const SIDE_DEFAULT = 176;
export const SIDE_MIN = 64;
export const SIDE_MAX = 360;
export const SIDE_COMPACT_AT = 120;

export const clampSide = (value: unknown) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? Math.min(SIDE_MAX, Math.max(SIDE_MIN, n)) : SIDE_DEFAULT;
};

export function setupSideResize(doc: Document = document) {
    const body = doc.body;
    if (!body.classList.contains("be-page") || doc.documentElement.classList.contains("embed")) return;
    const apply = (width: number) => {
        body.style.setProperty("--side-w", `${width}px`);
        body.classList.toggle("side-compact", width < SIDE_COMPACT_AT);
        handle.setAttribute("aria-valuenow", String(width));
    };
    const handle = doc.createElement("div");
    handle.className = "side-resizer";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", "탭 목록 폭 조절");
    handle.setAttribute("aria-valuemin", String(SIDE_MIN));
    handle.setAttribute("aria-valuemax", String(SIDE_MAX));
    handle.title = "끌어서 탭 목록 폭 조절 · 두 번 누르면 원래대로";
    handle.tabIndex = 0;
    body.append(handle);
    let width = SIDE_DEFAULT;
    apply(width);
    const save = () => { void chrome.storage.local.set({[SIDE_WIDTH_KEY]: width}).catch(() => {}); };
    void chrome.storage.local.get(SIDE_WIDTH_KEY).then((local) => { if (local[SIDE_WIDTH_KEY] != null) { width = clampSide(local[SIDE_WIDTH_KEY]); apply(width); } }).catch(() => {});

    let drag: {id: number; startX: number; startW: number} | undefined;
    handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        drag = {id: event.pointerId, startX: event.clientX, startW: width};
        handle.setPointerCapture(event.pointerId);
        doc.documentElement.classList.add("side-resizing");
    });
    handle.addEventListener("pointermove", (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        width = clampSide(drag.startW + event.clientX - drag.startX);
        apply(width);
    });
    const end = (event: PointerEvent) => {
        if (!drag || drag.id !== event.pointerId) return;
        drag = undefined;
        doc.documentElement.classList.remove("side-resizing");
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        save();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    handle.addEventListener("dblclick", () => { width = SIDE_DEFAULT; apply(width); save(); });
    handle.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 40 : 10;
        if (event.key === "ArrowLeft") width = clampSide(width - step);
        else if (event.key === "ArrowRight") width = clampSide(width + step);
        else if (event.key === "Home") width = SIDE_MIN;
        else if (event.key === "End") width = SIDE_MAX;
        else return;
        event.preventDefault();
        apply(width);
        save();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[SIDE_WIDTH_KEY] && !drag) { width = clampSide(changes[SIDE_WIDTH_KEY].newValue); apply(width); }
    });
}
