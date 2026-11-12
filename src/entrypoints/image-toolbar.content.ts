// @ts-ignore plain JS shared with the popup and the worker
import {IMAGE_SETTINGS_KEY, activeEngines, buildEngineUrl, imageSource, isEligibleImage, normalizeToolbarSettings, originalImageUrl} from "@/modules/image/toolbar.js";

// 사진 위에 마우스를 올리면 왼쪽 위에 나타나는 이미지 도구 막대(이미지 검색 · 다운로드/복사 · 더보기).
// 닫힌 Shadow DOM 안에만 그려서 사이트 스타일과 서로 영향을 주지 않아요. 이미지는 저장하거나 밖으로 보내지 않아요.
export default defineContentScript({
    // 빌드용 값이에요(필수 권한에 전체 사이트가 들어가지 않게 이미 있는 주소만 적어요). 실제 범위는 백그라운드가 사용자가 허용한 뒤 런타임에 등록해요.
    matches: ["https://mail.google.com/*"],
    registration: "runtime",
    runAt: "document_idle",
    main() {
        // 네이버 블로그처럼 본문이 iframe 안에 있는 사이트도 있어서 모든 프레임에서 동작해요(작은 프레임은 사진 크기 조건으로 걸러져요).
        const flag = "__bongextendImageToolbar";
        // 확장이 업데이트되면 이미 열려 있던 페이지의 옛 스크립트는 연결이 끊겨요. 그때는 새로고침을 안내해요.
        const STALE = "확장 프로그램이 업데이트됐어요. 이 페이지를 새로고침해 주세요";
        const stale = () => !chrome.runtime?.id;
        const scope = globalThis as unknown as Record<string, boolean | undefined>;
        if (scope[flag]) return;
        scope[flag] = true;

        let settings = normalizeToolbarSettings(null) as ReturnType<typeof normalizeToolbarSettings>;
        let enabled = false;
        const load = async () => {
            try {
                const stored = await chrome.storage.local.get([IMAGE_SETTINGS_KEY, "core.modules"]);
                settings = normalizeToolbarSettings(stored[IMAGE_SETTINGS_KEY]);
                const moduleOn = (stored["core.modules"] as Record<string, unknown> | undefined)?.image !== false;
                enabled = moduleOn && settings.toolbar;
            } catch { enabled = false; }
            host.dataset.enabled = String(enabled);
            if (!enabled) hide();
        };

        // ----- 화면 요소 -----
        const host = document.createElement("div");
        host.id = "bongextend-image-toolbar";
        host.style.cssText = "all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;";
        const shadow = host.attachShadow({mode: "closed"});
        const style = document.createElement("style");
        style.textContent = `
            :host{all:initial}
            .bar{position:fixed;display:none;gap:2px;padding:4px;border-radius:11px;background:rgba(36,38,46,.7);border:1px solid rgba(255,255,255,.2);box-shadow:0 8px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.14);backdrop-filter:blur(18px) saturate(180%);-webkit-backdrop-filter:blur(18px) saturate(180%);font:13px/1.3 system-ui,'Malgun Gothic',sans-serif;color:#f2f3f7}
            .bar.on{display:flex}
            button{all:unset;box-sizing:border-box;display:grid;place-items:center;width:30px;height:28px;border-radius:8px;cursor:pointer;color:#f2f3f7}
            button:hover,button.open{background:linear-gradient(135deg,rgba(150,170,255,.3),rgba(120,200,190,.2))}
            svg{width:18px;height:18px;fill:none;stroke:url(#bgrad);stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
            .menu{position:absolute;top:36px;left:0;min-width:184px;padding:5px;border-radius:11px;background:rgba(32,34,42,.78);border:1px solid rgba(255,255,255,.2);box-shadow:0 12px 30px rgba(0,0,0,.4);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);display:none}
            .menu.on{display:block}
            .item{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;color:#f2f3f7;font:13px/1.3 system-ui,'Malgun Gothic',sans-serif}
            .item:hover{background:linear-gradient(135deg,rgba(150,170,255,.28),rgba(120,200,190,.18))}
            .sep{height:1px;margin:4px 6px;background:rgba(255,255,255,.14)}
            .toast{position:fixed;display:none;padding:8px 14px;border-radius:10px;background:rgba(28,30,38,.85);color:#fff;font:600 12px/1.3 system-ui,'Malgun Gothic',sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none}
            .toast.on{display:block}
            @media (prefers-reduced-transparency:reduce){.bar,.menu{background:#22242b;backdrop-filter:none;-webkit-backdrop-filter:none}}`;
        // 아이콘 색: 앱 테마와 같은 진주빛 파랑 → 보라 → 청록 그라데이션
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        defs.setAttribute("width", "0"); defs.setAttribute("height", "0"); defs.setAttribute("aria-hidden", "true");
        defs.setAttribute("style", "position:absolute");
        defs.innerHTML = '<defs><linearGradient id="bgrad" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21"><stop offset="0" stop-color="#b9dcff"/><stop offset=".5" stop-color="#cdb6f5"/><stop offset="1" stop-color="#8fe3cf"/></linearGradient></defs>';
        const bar = document.createElement("div");
        bar.className = "bar";
        const toast = document.createElement("div");
        toast.className = "toast";
        shadow.append(style, defs, bar, toast);

        const icon = (paths: string[]) => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 24 24");
            for (const d of paths) { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); svg.append(p); }
            return svg;
        };
        const ICONS = {
            search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "m20 20-3.5-3.5", "M9 11a2 2 0 1 0 4 0 2 2 0 0 0-4 0"],
            download: ["M12 4v11", "m7 11 5 5 5-5", "M5 20h14"],
            more: ["M12 6h.01", "M12 12h.01", "M12 18h.01"],
            copy: ["M8 8h11v12H8z", "M5 16V4h11"],
            link: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
            open: ["M14 4h6v6", "M20 4 10 14", "M18 14v5H5V6h5"],
            hide: ["M3 3l18 18", "M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8 6 8 6a14 14 0 0 1-3 3.6", "M6.5 7.7C4.4 9.2 3 12 3 12s3 6 9 6a9 9 0 0 0 3.4-.7"],
            gear: ["M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"]
        };
        const makeButton = (paths: string[], title: string) => {
            const button = document.createElement("button");
            button.type = "button"; button.title = title; button.setAttribute("aria-label", title);
            button.append(icon(paths));
            return button;
        };
        const makeItem = (paths: string[], label: string, action: () => void) => {
            const item = document.createElement("button");
            item.type = "button"; item.className = "item";
            item.append(icon(paths).cloneNode(true), document.createTextNode(label));
            item.firstElementChild!.setAttribute("style", "width:17px;height:17px;flex:0 0 17px");
            item.addEventListener("click", (event) => { event.stopPropagation(); closeMenus(); if (stale()) { say(STALE); return; } action(); });
            return item;
        };

        const searchButton = makeButton(ICONS.search, "이미지 검색");
        const downloadButton = makeButton(ICONS.download, "이미지 저장·복사");
        const moreButton = makeButton(ICONS.more, "더보기");
        const searchMenu = document.createElement("div"); searchMenu.className = "menu";
        const downloadMenu = document.createElement("div"); downloadMenu.className = "menu";
        const moreMenu = document.createElement("div"); moreMenu.className = "menu";
        bar.append(searchButton, downloadButton, moreButton, searchMenu, downloadMenu, moreMenu);
        document.documentElement.appendChild(host);

        let current: HTMLImageElement | null = null;
        let hideTimer = 0;
        let toastTimer = 0;
        const closeMenus = () => { for (const [button, menu] of [[searchButton, searchMenu], [downloadButton, downloadMenu], [moreButton, moreMenu]] as const) { menu.classList.remove("on"); button.classList.remove("open"); } };
        function hide() { clearTimeout(hideTimer); bar.classList.remove("on"); closeMenus(); current = null; }
        const scheduleHide = () => { clearTimeout(hideTimer); hideTimer = window.setTimeout(hide, 350); };
        const say = (text: string) => {
            toast.textContent = text;
            const rect = bar.getBoundingClientRect();
            toast.style.left = `${Math.max(8, rect.left)}px`; toast.style.top = `${Math.max(8, rect.bottom + 8)}px`;
            toast.classList.add("on");
            clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => toast.classList.remove("on"), 1800);
        };

        const send = async (message: Record<string, unknown>) => {
            if (stale()) { say(STALE); return {ok: false, error: STALE}; }
            const reply = await chrome.runtime.sendMessage(message).catch((error: unknown) => ({ok: false, error: String(error)}));
            host.dataset.reply = `${String(message.type)}:${JSON.stringify(reply ?? null).slice(0, 80)}`;
            return reply;
        };
        const sourceOfCurrent = () => (current ? imageSource(current) : "");

        // 클립보드 쓰기는 클릭 직후에만 허용돼요. 이미지를 가져오는 동안 그 시간이 지나지 않게, 클릭 즉시 복사를 시작하고 이미지(PNG)는 나중에 채워요.
        const copyImage = (src: string) => {
            const pngBlob = (async () => {
                const reply = await send({type: "bongextend-image-fetch", url: src, pageUrl: location.href});
                if (!reply?.ok) throw new Error(`가져오기: ${reply?.error || "실패"}`);
                const bytes = Uint8Array.from(atob(reply.data), (c) => c.charCodeAt(0));
                let bitmap: ImageBitmap;
                try { bitmap = await createImageBitmap(new Blob([bytes], {type: reply.mime})); } catch { throw new Error("그림을 열지 못했어요"); }
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width; canvas.height = bitmap.height;
                canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
                return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG 변환 실패"))), "image/png"));
            })();
            return navigator.clipboard.write([new ClipboardItem({"image/png": pngBlob})]);
        };
        const reasonOf = (error: unknown) => {
            if (stale()) return STALE;
            const name = (error as {name?: string})?.name;
            const message = String((error as {message?: string})?.message || "");
            if (name === "NotAllowedError") return "클립보드 권한이 필요해요";
            return (message || name || "알 수 없는 오류").slice(0, 40);
        };

        const fillMenus = () => {
            searchMenu.replaceChildren();
            for (const engine of activeEngines(settings) as Array<{name: string; url?: string; site?: string}>) {
                searchMenu.append(makeItem(ICONS.search, engine.name, () => {
                    const src = sourceOfCurrent();
                    if (!src) { say("이 사진은 검색할 수 없어요"); return; }
                    if (engine.site) {
                        say(`${engine.name}에서 검색하고 있어요…`);
                        void send({type: "bongextend-image-site-search", site: engine.site, url: src, pageUrl: location.href}).then((reply) => { if (reply && reply.ok === false) say(reply.error || "검색을 시작하지 못했어요"); });
                    } else {
                        const url = buildEngineUrl(engine.url, src);
                        if (url) void send({type: "bongextend-image-open", url}); else say("이 사진은 검색할 수 없어요");
                    }
                }));
            }
            const sep = document.createElement("div"); sep.className = "sep"; searchMenu.append(sep);
            searchMenu.append(makeItem(ICONS.gear, "이미지 검색 엔진 관리", () => void send({type: "bongextend-image-settings"})));

            downloadMenu.replaceChildren(
                makeItem(ICONS.download, "이미지 다운로드", () => {
                    const src = sourceOfCurrent();
                    if (!src) return;
                    say("이미지를 가져오고 있어요…");
                    void send({type: "bongextend-image-download", url: src, pageUrl: location.href}).then((reply) => {
                        if (!reply?.ok) { say("저장하지 못했어요"); return; }
                        const bytes = Uint8Array.from(atob(reply.data), (c) => c.charCodeAt(0));
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(new Blob([bytes], {type: reply.mime}));
                        link.download = String(reply.filename || "image.jpg");
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        setTimeout(() => URL.revokeObjectURL(link.href), 30000);
                        say("저장했어요");
                    });
                }),
                makeItem(ICONS.link, "이미지 링크 복사", () => {
                    const src = sourceOfCurrent();
                    if (!src) return;
                    void navigator.clipboard.writeText(src).then(() => say("링크를 복사했어요"), () => say("복사하지 못했어요"));
                }),
                makeItem(ICONS.copy, "이미지 복사", () => {
                    const src = sourceOfCurrent();
                    if (!src) return;
                    say("이미지를 가져오고 있어요…");
                    copyImage(src).then(() => say("이미지를 복사했어요"), (error) => say(`이미지를 복사하지 못했어요 · ${reasonOf(error)}`));
                }),
                makeItem(ICONS.open, "원본 이미지 보기", () => {
                    const src = sourceOfCurrent();
                    if (src) void send({type: "bongextend-image-open", url: originalImageUrl(src)});
                })
            );

            moreMenu.replaceChildren(
                makeItem(ICONS.gear, "이미지 도구 설정", () => void send({type: "bongextend-image-settings"}))
            );
        };

        const toggle = (button: HTMLElement, menu: HTMLElement) => {
            const wasOpen = menu.classList.contains("on");
            closeMenus();
            if (!wasOpen) { fillMenus(); menu.classList.add("on"); button.classList.add("open"); }
        };
        searchButton.addEventListener("click", (event) => { event.stopPropagation(); toggle(searchButton, searchMenu); });
        downloadButton.addEventListener("click", (event) => { event.stopPropagation(); toggle(downloadButton, downloadMenu); });
        moreButton.addEventListener("click", (event) => { event.stopPropagation(); toggle(moreButton, moreMenu); });
        bar.addEventListener("mouseenter", () => clearTimeout(hideTimer));
        bar.addEventListener("mouseleave", scheduleHide);

        const place = (img: HTMLImageElement) => {
            const rect = img.getBoundingClientRect();
            const left = Math.min(Math.max(8, rect.left + 8), window.innerWidth - 120);
            const top = Math.min(Math.max(8, rect.top + 8), window.innerHeight - 48);
            bar.style.left = `${left}px`; bar.style.top = `${top}px`;
        };
        const imageAt = (x: number, y: number): HTMLImageElement | null => {
            for (const el of document.elementsFromPoint(x, y)) {
                if (el === host) return null;
                if (el instanceof HTMLImageElement) {
                    const rect = el.getBoundingClientRect();
                    if (imageSource(el) && isEligibleImage({width: rect.width, height: rect.height, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight})) return el;
                }
            }
            return null;
        };

        let pending = 0;
        let lastX = 0;
        let lastY = 0;
        document.addEventListener("mousemove", (event) => {
            if (!enabled) return;
            // 도구 막대 위에서는 사진 위에 있는 것으로 보고 그대로 둬요.
            if (event.composedPath().includes(host)) { clearTimeout(hideTimer); return; }
            lastX = event.clientX; lastY = event.clientY;
            if (pending) return;
            pending = requestAnimationFrame(() => {
                pending = 0;
                const img = imageAt(lastX, lastY);
                host.dataset.hover = img ? "1" : "0";
                if (img) {
                    clearTimeout(hideTimer);
                    if (img !== current) { closeMenus(); current = img; }
                    place(img);
                    bar.classList.add("on");
                } else if (bar.classList.contains("on")) scheduleHide();
            });
        }, {passive: true});
        window.addEventListener("scroll", () => { if (bar.classList.contains("on") && current) { if (current.isConnected) place(current); else hide(); } }, {passive: true, capture: true});
        document.addEventListener("click", (event) => { if (!event.composedPath().includes(host)) closeMenus(); }, true);
        document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenus(); }, true);

        void load();
        chrome.storage.onChanged.addListener((changes, area) => {
            if (stale()) return;
            if (area === "local" && (changes[IMAGE_SETTINGS_KEY] || changes["core.modules"])) void load();
        });
    }
});
