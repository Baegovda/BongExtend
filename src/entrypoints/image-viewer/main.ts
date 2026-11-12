// BongExtend 이미지 보기 창: 휠로 확대·축소, 끌어서 이동, 정보 표시, 복사·저장.
// 이미지는 백그라운드가 (필요하면 Referer를 붙여) 가져와서 이 창에서만 보여줘요. 어디에도 저장하거나 보내지 않아요.
// @ts-ignore plain JS shared with the toolbar
import {filenameFromUrl} from "@/modules/image/toolbar.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage");
const img = $<HTMLImageElement>("img");
const bar = $("bar");
const info = $("info");
const toastEl = $("toast");
const msg = $("msg");
const msgText = $("msgText");

const params = new URLSearchParams(location.search);
const srcUrl = params.get("u") || "";
const pageUrl = params.get("p") || "";

let natW = 0;
let natH = 0;
let scale = 1;
let tx = 0;
let ty = 0;
let rotation = 0; // 0, 90, 180, 270
let fileName = "image.jpg";
let blob: Blob | null = null;
let blobUrl = "";
const MIN = 0.05;
const MAX = 40;

const toast = (text: string) => {
    toastEl.textContent = text;
    toastEl.classList.add("on");
    clearTimeout((toast as unknown as {t?: number}).t);
    (toast as unknown as {t?: number}).t = window.setTimeout(() => toastEl.classList.remove("on"), 1800);
};

const showMessage = (text: string, error = false) => {
    msg.hidden = false;
    msg.classList.toggle("error", error);
    msgText.textContent = text;
    $("spin").style.display = error ? "none" : "";
};

const viewSize = () => ({w: stage.clientWidth, h: stage.clientHeight});
const rotated = () => rotation % 180 !== 0;
const dims = () => (rotated() ? {w: natH, h: natW} : {w: natW, h: natH});

const apply = (smooth = false) => {
    img.classList.toggle("smooth", smooth);
    // 회전은 이미지 중심 기준으로 돌린 뒤 이동·확대해요.
    const shift = rotation === 90 ? [natH, 0] : rotation === 180 ? [natW, natH] : rotation === 270 ? [0, natW] : [0, 0];
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale}) ${rotation ? `translate(${shift[0]}px, ${shift[1]}px) rotate(${rotation}deg)` : ""}`;
    $("zoomLabel").textContent = `${Math.round(scale * 100)}%`;
    $("infoZoom").textContent = `${Math.round(scale * 100)}%`;
    $("zoomLabel").classList.toggle("on", Math.abs(scale - 1) < 0.005);
};

const clampPan = () => {
    const {w, h} = viewSize();
    const d = dims();
    const iw = d.w * scale;
    const ih = d.h * scale;
    // 그림이 창보다 작으면 가운데, 크면 가장자리가 창 밖으로 너무 나가지 않게 해요.
    tx = iw <= w ? (w - iw) / 2 : Math.min(60, Math.max(w - iw - 60, tx));
    ty = ih <= h ? (h - ih) / 2 : Math.min(60, Math.max(h - ih - 60, ty));
};

const fit = (smooth = true) => {
    const {w, h} = viewSize();
    const d = dims();
    if (!d.w || !d.h) return;
    scale = Math.min(w / d.w, h / d.h, 1);
    tx = (w - d.w * scale) / 2;
    ty = (h - d.h * scale) / 2;
    apply(smooth);
};

const zoomAt = (factor: number, cx: number, cy: number, smooth = false) => {
    const next = Math.min(MAX, Math.max(MIN, scale * factor));
    const k = next / scale;
    tx = cx - (cx - tx) * k;
    ty = cy - (cy - ty) * k;
    scale = next;
    clampPan();
    apply(smooth);
};
const zoomCenter = (factor: number) => { const {w, h} = viewSize(); zoomAt(factor, w / 2, h / 2, true); };
const actualSize = () => { const {w, h} = viewSize(); zoomAt(1 / scale, w / 2, h / 2, true); };

stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    // 터치패드 핀치(ctrl+휠)는 더 민감하게, 일반 휠은 한 칸에 약 12%씩.
    const speed = event.ctrlKey ? 0.01 : 0.0016;
    zoomAt(Math.exp(-event.deltaY * speed), event.clientX, event.clientY);
}, {passive: false});

let drag: {x: number; y: number; tx: number; ty: number} | null = null;
stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = {x: event.clientX, y: event.clientY, tx, ty};
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("dragging");
    img.classList.remove("smooth");
});
stage.addEventListener("pointermove", (event) => {
    wake();
    if (!drag) return;
    tx = drag.tx + (event.clientX - drag.x);
    ty = drag.ty + (event.clientY - drag.y);
    clampPan();
    apply();
});
const endDrag = (event: PointerEvent) => { drag = null; stage.classList.remove("dragging"); try { stage.releasePointerCapture(event.pointerId); } catch { /* 이미 놓았어요 */ } };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("dblclick", (event) => {
    if (Math.abs(scale - 1) < 0.01) fit(); else zoomAt(1 / scale, event.clientX, event.clientY, true);
});

// 도구 막대는 마우스를 가만히 두면 흐려져요.
let idleTimer = 0;
const wake = () => { bar.classList.remove("idle"); clearTimeout(idleTimer); idleTimer = window.setTimeout(() => { if (!bar.matches(":hover")) bar.classList.add("idle"); }, 2600); };

const rotate = () => {
    rotation = (rotation + 90) % 360;
    fit();
};

const formatBytes = (value: number) => (value >= 1048576 ? `${(value / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`);
const extOf = (mime: string) => ({"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp", "image/avif": "avif"} as Record<string, string>)[mime] || "jpg";

const toPng = async () => {
    if (!blob) throw new Error("이미지가 아직 없어요");
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const turned = rotated();
    canvas.width = turned ? bitmap.height : bitmap.width;
    canvas.height = turned ? bitmap.width : bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("그림을 그리지 못했어요");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("PNG 변환 실패"))), "image/png"));
};

const copy = async () => {
    try {
        await navigator.clipboard.write([new ClipboardItem({"image/png": toPng()})]);
        toast("이미지를 복사했어요");
    } catch (error) {
        toast(`복사하지 못했어요 · ${String((error as Error)?.message || error).slice(0, 40)}`);
    }
};

const save = () => {
    if (!blobUrl) return;
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast("저장했어요");
};

const setupInfo = (bytes: number, mime: string) => {
    $("infoName").textContent = fileName;
    $("infoSize").textContent = `${natW} × ${natH} px`;
    $("infoBytes").textContent = formatBytes(bytes);
    $("infoType").textContent = mime.replace("image/", "").toUpperCase();
    try { $("infoHost").textContent = new URL(srcUrl).hostname; } catch { $("infoHost").textContent = "–"; }
};

// 창 크기: 그림 크기에 맞추되 화면의 85%를 넘지 않게, 가운데에 두어요.
const fitWindow = async () => {
    try {
        const current = await chrome.windows.getCurrent();
        if (!current.id || current.type !== "popup") return;
        const availW = (screen as unknown as {availWidth: number}).availWidth;
        const availH = (screen as unknown as {availHeight: number}).availHeight;
        const left0 = (screen as unknown as {availLeft?: number}).availLeft ?? 0;
        const top0 = (screen as unknown as {availTop?: number}).availTop ?? 0;
        const chromeW = Math.max(0, window.outerWidth - window.innerWidth);
        const chromeH = Math.max(0, window.outerHeight - window.innerHeight);
        const maxW = Math.floor(availW * 0.85) - chromeW;
        const maxH = Math.floor(availH * 0.85) - chromeH;
        const k = Math.min(1, maxW / natW, maxH / natH);
        const innerW = Math.max(520, Math.round(natW * k));
        const innerH = Math.max(380, Math.round(natH * k));
        const width = innerW + chromeW;
        const height = innerH + chromeH;
        await chrome.windows.update(current.id, {width, height, left: Math.round(left0 + (availW - width) / 2), top: Math.round(top0 + (availH - height) / 2)});
    } catch { /* 크기 조정이 안 돼도 보는 데는 문제없어요 */ }
};

const load = async () => {
    if (!/^https?:\/\//i.test(srcUrl)) { showMessage("열 수 있는 이미지 주소가 아니에요.", true); return; }
    let reply: {ok?: boolean; mime?: string; data?: string; error?: string} | undefined;
    try { reply = await chrome.runtime.sendMessage({type: "bongextend-viewer-fetch", url: srcUrl, pageUrl}); }
    catch (error) { showMessage(`이미지를 가져오지 못했어요 · ${String((error as Error)?.message || error).slice(0, 60)}`, true); return; }
    if (!reply?.ok || !reply.data || !reply.mime) { showMessage(`이미지를 가져오지 못했어요${reply?.error ? ` · ${reply.error}` : ""}`, true); return; }
    const bytes = Uint8Array.from(atob(reply.data), (c) => c.charCodeAt(0));
    blob = new Blob([bytes], {type: reply.mime});
    blobUrl = URL.createObjectURL(blob);
    fileName = filenameFromUrl(srcUrl).replace(/\.[a-z0-9]+$/i, "") + "." + extOf(reply.mime);
    document.title = fileName;
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("그림을 열지 못했어요")); img.src = blobUrl; })
        .catch((error: Error) => { showMessage(error.message, true); throw error; });
    natW = img.naturalWidth;
    natH = img.naturalHeight;
    img.style.width = `${natW}px`;
    img.style.height = `${natH}px`;
    setupInfo(bytes.length, reply.mime);
    await fitWindow();
    msg.hidden = true;
    fit(false);
    img.classList.add("ready");
    wake();
};

$("zoomIn").addEventListener("click", () => zoomCenter(1.25));
$("zoomOut").addEventListener("click", () => zoomCenter(0.8));
$("zoomLabel").addEventListener("click", actualSize);
$("fit").addEventListener("click", () => fit());
$("rotate").addEventListener("click", rotate);
$("copy").addEventListener("click", () => void copy());
$("save").addEventListener("click", save);
const toggleInfo = () => { info.classList.toggle("hidden"); $("toggleInfo").classList.toggle("on", !info.classList.contains("hidden")); };
$("toggleInfo").addEventListener("click", toggleInfo);
window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (event.ctrlKey && key === "c") { event.preventDefault(); void copy(); }
    else if (event.ctrlKey && key === "s") { event.preventDefault(); save(); }
    else if (key === "+" || key === "=") zoomCenter(1.25);
    else if (key === "-") zoomCenter(0.8);
    else if (key === "0") fit();
    else if (key === "1") actualSize();
    else if (key === "r") rotate();
    else if (key === "i") toggleInfo();
    else if (key === "escape") window.close();
    wake();
});
window.addEventListener("resize", () => { if (natW) { clampPan(); apply(); } });
bar.addEventListener("mouseenter", wake);
window.addEventListener("beforeunload", () => { if (blobUrl) URL.revokeObjectURL(blobUrl); });

showMessage("이미지를 불러오고 있어요…");
void load();
