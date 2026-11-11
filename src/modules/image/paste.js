// 이미지 모듈: 클립보드 이미지를 붙여넣기를 지원하지 않는 사이트(네이버 톡톡, 구글 렌즈)의 업로드로 넘겨줘요.
// 이미지는 이 브라우저 탭 안에서 사이트의 업로드 입력칸으로만 옮기고, 저장하거나 다른 곳으로 보내지 않아요.

export const IMAGE_SETTINGS_KEY = "image.settings";
export const IMAGE_FEATURES = ["talk", "lens"];

export const normalizeImageSettings = (value) => ({
    talk: value?.talk !== false,
    lens: value?.lens !== false
});

const TALK_HOSTS = ["talk.naver.com", "partner.talk.naver.com"];
const LENS_HOSTS = ["lens.google.com", "www.google.com", "images.google.com"];

// 어느 기능이 이 주소에서 일하는지.
export function featureForHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (TALK_HOSTS.includes(host)) return "talk";
    if (LENS_HOSTS.includes(host)) return "lens";
    return "";
}

// 구글 검색 화면은 렌즈 업로드 창이 열려 있을 때만 다뤄요(검색창에 일반 이미지를 붙이는 경우는 건드리지 않아요).
export function lensSurfaceOpen(doc) {
    return Boolean(findImageInput(doc, null));
}

// 구글 첫 화면·검색 결과의 이미지 검색(렌즈) 버튼. 언어별 이름과 렌즈 전용 속성을 함께 봐요.
const LENS_BUTTONS = [
    '[role="button"][aria-label*="이미지로 검색"]', '[role="button"][aria-label*="Search by image"]',
    '[role="button"][aria-label*="렌즈"]', '[role="button"][aria-label*="Lens"]', '[data-base-lens-url]'
];

export function findLensButton(doc) {
    for (const selector of LENS_BUTTONS) {
        const found = Array.from(doc?.querySelectorAll?.(selector) || []).find((el) => !el.closest?.('[hidden], [aria-hidden="true"]'));
        if (found) return found;
    }
    return null;
}

export const isSearchBox = (target) => Boolean(target?.matches?.('textarea[name="q"], input[name="q"]'));

// 렌즈 업로드 창이 닫혀 있으면 버튼을 눌러 열고, 업로드 입력칸이 나타날 때까지 잠깐 기다려요.
export async function openLensSurface(doc, {wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), tries = 14} = {}) {
    if (lensSurfaceOpen(doc)) return true;
    const button = findLensButton(doc);
    if (!button) return false;
    button.click();
    for (let i = 0; i < tries; i++) {
        await wait(150);
        if (lensSurfaceOpen(doc)) return true;
    }
    return false;
}

export function imageFilesOf(clipboard) {
    const files = Array.from(clipboard?.files || []).filter((file) => /^image\//i.test(file?.type || ""));
    if (files.length) return files;
    const fromItems = [];
    for (const item of Array.from(clipboard?.items || [])) {
        if (item?.kind !== "file" || !/^image\//i.test(item.type || "")) continue;
        const file = item.getAsFile?.();
        if (file) fromItems.push(file);
    }
    return fromItems;
}

// 글자가 함께 복사된 경우(일반 텍스트 붙여넣기)는 사이트의 기본 동작에 맡겨요.
export function hasPlainText(clipboard) {
    try { return String(clipboard?.getData?.("text/plain") || "").trim().length > 0; }
    catch { return false; }
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|heic|heif|avif|tiff?)$/i;

export function acceptsImage(input) {
    const accept = String(input?.getAttribute?.("accept") || input?.accept || "").trim();
    if (!accept) return true;
    return accept.split(",").map((token) => token.trim()).some((token) => token === "*/*" || /^image\//i.test(token) || IMAGE_EXTENSIONS.test(token));
}

export function findImageInput(doc, target) {
    const inputs = Array.from(doc?.querySelectorAll?.('input[type="file"]') || []).filter((input) => !input.disabled && acceptsImage(input));
    if (!inputs.length) return null;
    const scope = target?.closest?.("form, dialog, [role='dialog']");
    return (scope && inputs.find((input) => scope.contains(input))) || inputs[0];
}

function defaultSetFiles(input, file, view) {
    const transfer = new view.DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    return input.files?.length === 1;
}

function defaultDrop(target, file, view) {
    const transfer = new view.DataTransfer();
    transfer.items.add(file);
    let accepted = false;
    for (const type of ["dragenter", "dragover", "drop"]) {
        const event = new view.DragEvent(type, {bubbles: true, cancelable: true, dataTransfer: transfer});
        target.dispatchEvent(event);
        if (type === "drop") accepted = event.defaultPrevented;
    }
    return accepted;
}

// 1) 사이트의 이미지 업로드 입력칸에 파일을 넣고 change를 알려요. 2) 입력칸이 없으면 붙여넣은 자리에 끌어놓기를 흉내 내요.
export function attachImage(file, {doc, view = doc?.defaultView, target = null, setFiles = defaultSetFiles, drop = defaultDrop} = {}) {
    const input = findImageInput(doc, target);
    if (input) {
        try {
            if (setFiles(input, file, view)) {
                input.dispatchEvent(new view.Event("input", {bubbles: true}));
                input.dispatchEvent(new view.Event("change", {bubbles: true}));
                return "input";
            }
        } catch { /* 입력칸에 넣지 못하면 끌어놓기를 시도해요. */ }
    }
    const zone = target && target.nodeType === 1 ? target : doc?.activeElement || doc?.body;
    if (zone) {
        try { if (drop(zone, file, view)) return "drop"; } catch { /* 지원하지 않는 사이트예요. */ }
    }
    return "";
}

// 페이지가 붙여넣기를 스스로 처리해 업로드를 시작했는지. 구글 렌즈는 일부 화면에서 직접 처리해서, 이중 업로드를 피하려고 확인해요.
export function nativeUploadStarted(since, perf = globalThis.performance) {
    try {
        return perf.getEntriesByType("resource").some((entry) => entry.startTime >= since && /upload/i.test(entry.name));
    } catch { return false; }
}

export const LENS_WAIT_MS = 2200;

// 붙여넣기 이벤트 하나를 처리해요. 사이트가 이미 처리했거나 글자 붙여넣기면 건드리지 않아요.
// 톡톡은 바로 업로드 칸에 넣고(true), 렌즈는 페이지가 직접 업로드하지 않았을 때만 잠시 뒤에 이어받아요(false).
export function handlePaste(event, {
    settings, feature, doc, view = doc?.defaultView, now = Date.now, last = {at: 0, name: ""}, attach = attachImage,
    schedule = (task, ms) => setTimeout(task, ms), clock = () => globalThis.performance?.now?.() ?? 0,
    nativeUploaded = nativeUploadStarted, onAttached = () => {}, openLens = openLensSurface
}) {
    if (!feature || !settings?.[feature]) return false;
    if (event.defaultPrevented) return false;
    const clipboard = event.clipboardData;
    if (!clipboard || hasPlainText(clipboard)) return false;
    const files = imageFilesOf(clipboard);
    if (!files.length) return false;
    const file = files[0];
    const stamp = `${file.name}:${file.size}`;
    if (last.name === stamp && now() - last.at < 600) return feature !== "lens";
    if (feature === "lens") {
        const surface = lensSurfaceOpen(doc);
        // 렌즈 창이 없어도 구글 검색창에 붙여넣으면 렌즈 창을 열어서 바로 이미지 검색해요.
        if (!surface && !(isSearchBox(event.target) && findLensButton(doc))) return false;
        const startedAt = clock();
        const target = event.target;
        if (!surface) event.preventDefault();
        schedule(async () => {
            if (surface && nativeUploaded(startedAt)) return;
            if (last.name === stamp && now() - last.at < 600) return;
            if (!surface && !(await openLens(doc))) return;
            if (!attach(file, {doc, view, target: null})) return;
            last.at = now();
            last.name = stamp;
            onAttached();
        }, surface ? LENS_WAIT_MS : 0);
        return false;
    }
    const method = attach(file, {doc, view, target: event.target});
    if (!method) return false;
    last.at = now();
    last.name = stamp;
    event.preventDefault();
    onAttached();
    return true;
}
