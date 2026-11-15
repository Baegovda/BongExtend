// 파일을 받는 동안 도구막대의 BongExtend 아이콘에 스피너를 돌려요. 다 받으면 원래 아이콘으로 돌아와요.
// 아이콘 위 안 읽은 메일 숫자(배지)는 건드리지 않아요. 번역 중인 탭의 아이콘(탭별 설정)이 있으면 그 탭에서는 그쪽이 먼저 보여요.
import {renderProgressFrames} from "../trans/toolbar-progress.js";

const VIDEO_STATUS_KEY = "core.video:status";

// 받는 중인 항목들 → {active, count, percent(전체 크기를 아는 것만 합산, 모르면 null)}
export function summarizeDownloads(items, videoStatus) {
    const running = (items || []).filter((item) => item && item.state === "in_progress" && !item.paused);
    let got = 0, total = 0, known = running.length > 0;
    for (const item of running) {
        if (item.totalBytes > 0) { got += item.bytesReceived || 0; total += item.totalBytes; } else known = false;
    }
    const video = videoStatus && ["started", "progress"].includes(videoStatus.type);
    const count = running.length + (video ? 1 : 0);
    const percent = known && total > 0 && !video ? Math.min(100, Math.floor(got / total * 100)) : null;
    return {active: count > 0, count, percent};
}

export function startDownloadSpinner(api = chrome, {setTimer = setTimeout, clearTimer = clearTimeout, loadFrames} = {}) {
    if (!api?.downloads?.search || !api?.action?.setIcon) return null;
    const manifest = api.runtime.getManifest();
    const iconPaths = manifest.action?.default_icon || manifest.icons;
    const title = manifest.action?.default_title || "BongExtend";
    const frames = () => (loadFrames ? loadFrames() : renderProgressFrames(api.runtime.getURL("icons/128.png")));
    let framesPromise = null, timer = null, poll = null, phase = 0, spinning = false, lastTitle = "";
    const ignore = (value) => Promise.resolve(value).catch(() => {});

    async function paint() {
        timer = null;
        if (!spinning) return;
        try {
            framesPromise ||= frames();
            const list = await framesPromise;
            if (!spinning) return;
            await ignore(api.action.setIcon({imageData: list[phase % list.length]}));
            phase = (phase + 1) % list.length;
        } catch { /* 그림을 못 그려도 다운로드에는 영향이 없어요. */ }
        if (spinning) timer = setTimer(paint, 160);
    }
    function stop() {
        if (!spinning) return;
        spinning = false;
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
        const nextTitle = `${title} · 다운로드 중 ${summary.count}개${summary.percent == null ? "" : ` (${summary.percent}%)`}`;
        if (nextTitle !== lastTitle) { lastTitle = nextTitle; void ignore(api.action.setTitle({title: nextTitle})); }
        if (!spinning) { spinning = true; void paint(); }
        // 이벤트를 놓쳐도 끝난 걸 알아채도록, 도는 동안에는 2초마다 다시 확인해요.
        if (poll != null) clearTimer(poll);
        poll = setTimer(() => { poll = null; void check(); }, 2000);
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
