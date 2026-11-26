// 파일을 받는 동안 도구막대의 BongExtend 아이콘에 스피너를 돌려요. 다 받으면 원래 아이콘으로 돌아와요.
// 아이콘 위 안 읽은 메일 숫자(배지)는 건드리지 않아요. 번역 중인 탭의 아이콘(탭별 설정)이 있으면 그 탭에서는 그쪽이 먼저 보여요.
import {renderProgressFrames} from "../trans/toolbar-progress.js";

const VIDEO_STATUS_KEY = "core.video:status";

// 받는 중인 항목들 → {active, count, percent(전체 크기를 아는 것만 합산, 모르면 null), top(가장 많이 받은 것의 %, 모르면 null)}
export function summarizeDownloads(items, videoStatus) {
    const running = (items || []).filter((item) => item && item.state === "in_progress" && !item.paused);
    let got = 0, total = 0, known = running.length > 0, top = null;
    for (const item of running) {
        if (item.totalBytes > 0) {
            got += item.bytesReceived || 0; total += item.totalBytes;
            const mine = Math.min(100, Math.max(0, Math.floor((item.bytesReceived || 0) / item.totalBytes * 100)));
            top = top == null ? mine : Math.max(top, mine);
        } else known = false;
    }
    const video = videoStatus && ["started", "progress"].includes(videoStatus.type);
    const count = running.length + (video ? 1 : 0);
    const percent = known && total > 0 && !video ? Math.min(100, Math.floor(got / total * 100)) : null;
    const videoPercent = video ? Number(videoStatus.percent) : NaN;
    if (Number.isFinite(videoPercent)) { const mine = Math.min(100, Math.max(0, Math.floor(videoPercent))); top = top == null ? mine : Math.max(top, mine); }
    return {active: count > 0, count, percent, top};
}

// 진행률 원: 12시 방향에서 시계 방향으로 percent 만큼 차요(스피너와 같은 색·굵기).
export async function loadIconBitmap(iconUrl) {
    const response = await fetch(iconUrl);
    if (!response.ok) throw new Error("Toolbar icon unavailable");
    return createImageBitmap(await response.blob());
}
export function drawPercentFrame(bitmap, percent) {
    const images = {};
    for (const size of [16, 32]) {
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext("2d", {willReadFrequently: true});
        const center = size / 2, radius = size * .43, start = -Math.PI / 2;
        ctx.drawImage(bitmap, size * .17, size * .17, size * .66, size * .66);
        ctx.lineWidth = size * .11;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#27435d";
        ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI * 2); ctx.stroke();
        const amount = Math.min(100, Math.max(0, percent)) / 100;
        if (amount > 0) {
            ctx.strokeStyle = "#72e5ff";
            ctx.lineCap = amount >= 1 ? "butt" : "round";
            ctx.beginPath(); ctx.arc(center, center, radius, start, start + Math.PI * 2 * amount); ctx.stroke();
        }
        images[size] = ctx.getImageData(0, 0, size, size);
    }
    return images;
}

export function startDownloadSpinner(api = chrome, {setTimer = setTimeout, clearTimer = clearTimeout, loadFrames, drawPercent} = {}) {
    if (!api?.downloads?.search || !api?.action?.setIcon) return null;
    const manifest = api.runtime.getManifest();
    const iconPaths = manifest.action?.default_icon || manifest.icons;
    const title = manifest.action?.default_title || "BongExtend";
    const frames = () => (loadFrames ? loadFrames() : renderProgressFrames(api.runtime.getURL("icons/128.png")));
    let framesPromise = null, timer = null, poll = null, phase = 0, spinning = false, lastTitle = "";
    // 크기를 아는 다운로드가 있으면 가장 많이 받은 것의 진행률(0~100)로 원을 채우고, 모르면 스피너를 돌려요.
    let top = null, paintedTop = null, bitmapPromise = null;
    const percentFrame = async (value) => {
        if (drawPercent) return drawPercent(value);
        bitmapPromise ||= loadIconBitmap(api.runtime.getURL("icons/128.png"));
        return drawPercentFrame(await bitmapPromise, value);
    };
    const ignore = (value) => Promise.resolve(value).catch(() => {});

    async function paint() {
        timer = null;
        if (!spinning) return;
        try {
            if (top != null) {
                // 진행률이 바뀔 때만 다시 그려요.
                if (top !== paintedTop) {
                    const value = top, image = await percentFrame(value);
                    if (!spinning) return;
                    await ignore(api.action.setIcon({imageData: image}));
                    paintedTop = value;
                }
            } else {
                framesPromise ||= frames();
                const list = await framesPromise;
                if (!spinning) return;
                await ignore(api.action.setIcon({imageData: list[phase % list.length]}));
                phase = (phase + 1) % list.length;
                paintedTop = null;
            }
        } catch { /* 그림을 못 그려도 다운로드에는 영향이 없어요. */ }
        if (spinning) timer = setTimer(paint, top != null ? 400 : 160);
    }
    function stop() {
        if (!spinning) return;
        spinning = false;
        top = null; paintedTop = null;
        if (timer != null) { clearTimer(timer); timer = null; }
        if (poll != null) { clearTimer(poll); poll = null; }
        lastTitle = "";
        void ignore(api.action.setIcon({path: iconPaths}));
        void ignore(api.action.setTitle({title}));
    }
    async function check() {
        let summary;
        try {
            const [items, stored] = await Promise.all([
                api.downloads.search({state: "in_progress"}),
                api.storage?.local?.get ? api.storage.local.get(VIDEO_STATUS_KEY) : Promise.resolve({})
            ]);
            summary = summarizeDownloads(items, stored?.[VIDEO_STATUS_KEY]);
        } catch { return; }
        if (!summary.active) { stop(); return; }
        top = summary.top;
        const nextTitle = `${title} · 다운로드 중 ${summary.count}개${summary.top == null ? "" : ` · 가장 많이 받은 것 ${summary.top}%`}`;
        if (nextTitle !== lastTitle) { lastTitle = nextTitle; void ignore(api.action.setTitle({title: nextTitle})); }
        if (!spinning) { spinning = true; void paint(); }
        // 받은 양은 크롬이 알려 주지 않아서, 받는 동안에는 1초마다 다시 확인해요(끝난 것도 이때 알아채요).
        if (poll != null) clearTimer(poll);
        poll = setTimer(() => { poll = null; void check(); }, 1000);
    }
    let pending = null;
    const soon = () => { if (pending != null) clearTimer(pending); pending = setTimer(() => { pending = null; void check(); }, 150); };
    api.downloads.onCreated?.addListener(soon);
    api.downloads.onChanged?.addListener(soon);
    api.downloads.onErased?.addListener(soon);
    api.storage?.onChanged?.addListener((changes, area) => { if (area === "local" && changes[VIDEO_STATUS_KEY]) soon(); });
    void check();
    return {check, isSpinning: () => spinning};
}
