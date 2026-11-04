// @ts-ignore Shared plain-JS helpers
import {DOWNLOAD_SETTINGS_KEY, cleanSuggestedFilename, downloadCategory, expandBatchUrls, normalizeDownloadSettings} from "@/modules/downloads/settings.js";

type DownloadItem = chrome.downloads.DownloadItem;
type Sniffed = {url: string; name: string; kind: string};
type Settings = ReturnType<typeof normalizeDownloadSettings>;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stateFilter = $<HTMLSelectElement>("stateFilter");
const typeFilter = $<HTMLSelectElement>("typeFilter");
const ageFilter = $<HTMLSelectElement>("ageFilter");
const searchInput = $<HTMLInputElement>("search");
const downloadList = $("downloadList");
const status = $("status");
const empty = $("empty");
const sniffPanel = $("sniffPanel");
const sniffList = $("sniffList");
const params = new URLSearchParams(location.search);
const sourceTabText = params.get("sourceTabId");
const sourceTabId = sourceTabText ? Number(sourceTabText) : Number.NaN;
const CHRONO_ACCESS_KEY = "chrono.siteAccess";
const CHRONO_ORIGINS = ["http://*/*", "https://*/*"];
const CHRONO_PERMISSIONS: chrome.runtime.ManifestPermission[] = ["webRequest", "clipboardRead", "downloads.open", "downloads.ui"];
const CHRONO_SITE_PERMISSION: chrome.runtime.ManifestPermission[] = ["webRequest"];
let items: DownloadItem[] = [];
let sniffed: Sniffed[] = [];
let settings: Settings = normalizeDownloadSettings(null) as Settings;
let refreshQueued = false;

const setStatus = (message: string, isError = false) => {
    status.textContent = message;
    status.classList.toggle("error", isError);
};
const formatSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes < 0) return "크기 모름";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
};
const formatDate = (value?: string) => {
    if (!value) return "시간 정보 없음";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "시간 정보 없음" : new Intl.DateTimeFormat("ko-KR", {dateStyle: "medium", timeStyle: "short"}).format(date);
};
const statusLabel = (item: DownloadItem) => {
    if (item.state === "complete") return "완료";
    if (item.state === "interrupted") return item.error ? `중단 · ${item.error}` : "중단됨";
    if (item.paused) return "일시 정지";
    return "받는 중";
};
const visibleItems = () => {
    const state = stateFilter.value;
    const type = typeFilter.value;
    const query = searchInput.value.trim().toLowerCase();
    const age = ageFilter.value;
    let regex: RegExp | null = null;
    const regexText = /^\/(.*)\/([iu]*)$/.exec(query);
    if (regexText && regexText[1].length <= 128) {
        try { regex = new RegExp(regexText[1], regexText[2]); } catch { regex = null; }
    }
    const now = Date.now();
    return items.filter((item) => {
        if (state !== "all" && item.state !== state) return false;
        if (type !== "all" && downloadCategory(item.filename, item.mime) !== type) return false;
        if (age !== "all") {
            const started = item.startTime ? new Date(item.startTime).getTime() : 0;
            const threshold = age === "day" ? new Date().setHours(0, 0, 0, 0) : now - (age === "week" ? 7 : 30) * 24 * 60 * 60 * 1000;
            if (!started || started < threshold) return false;
        }
        const haystack = `${item.filename} ${item.url} ${item.finalUrl}`.toLowerCase();
        if (query && !(regex ? regex.test(haystack) : haystack.includes(query))) return false;
        return true;
    });
};
const addButton = (parent: HTMLElement, label: string, action: () => void | Promise<void>) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => { void action(); });
    parent.appendChild(button);
};

const render = () => {
    const visible = visibleItems();
    downloadList.replaceChildren();
    downloadList.classList.toggle("table-view", !settings.listView);
    empty.hidden = visible.length > 0;
    for (const item of visible) {
        const row = document.createElement("article");
        row.className = "download-row";
        row.dataset.state = item.state;

        const main = document.createElement("div");
        main.className = "download-main";
        const name = document.createElement("strong");
        name.className = "download-name";
        name.textContent = item.filename?.replace(/\\/g, "/").split("/").pop() || "이름 없는 파일";
        name.title = item.filename || "";
        const origin = document.createElement("span");
        origin.className = "download-source";
        try { origin.textContent = new URL(item.finalUrl || item.url).hostname; }
        catch { origin.textContent = item.url || "주소 정보 없음"; }
        main.append(name, origin);

        const progress = document.createElement("div");
        progress.className = "download-progress";
        if (item.state === "in_progress" && item.totalBytes > 0) {
            const bar = document.createElement("progress");
            bar.max = item.totalBytes;
            bar.value = Math.max(0, item.bytesReceived);
            progress.appendChild(bar);
        }
        const progressText = document.createElement("span");
        const percent = item.totalBytes > 0 ? ` · ${Math.floor(item.bytesReceived / item.totalBytes * 100)}%` : "";
        progressText.textContent = `${statusLabel(item)} · ${formatSize(item.bytesReceived)}${item.totalBytes > 0 ? ` / ${formatSize(item.totalBytes)}` : ""}${percent}`;
        progress.appendChild(progressText);

        const details = document.createElement("span");
        details.className = "download-date muted";
        details.textContent = `${formatDate(item.startTime)} · ${formatSize(item.totalBytes)}`;

        const actions = document.createElement("div");
        actions.className = "download-actions";
        if (item.state === "in_progress") {
            if (item.paused) addButton(actions, "이어받기", () => chrome.downloads.resume(item.id));
            else addButton(actions, "잠시 멈춤", () => chrome.downloads.pause(item.id));
            addButton(actions, "취소", () => chrome.downloads.cancel(item.id));
        } else if (item.state === "complete") {
            addButton(actions, "열기", () => chrome.downloads.open(item.id));
            addButton(actions, "폴더 보기", () => chrome.downloads.show(item.id));
        } else {
            addButton(actions, "다시 받기", async () => { await startDownload(item.finalUrl || item.url, item.filename?.replace(/\\/g, "/").split("/").pop()); });
        }
        addButton(actions, "기록 지우기", async () => { await chrome.downloads.erase({id: item.id}); await refresh(); });
        row.append(main, progress, details, actions);
        downloadList.appendChild(row);
    }
};

const refresh = async () => {
    try {
        items = await chrome.downloads.search({orderBy: ["-startTime"], limit: 1000});
        const active = items.filter((item) => item.state === "in_progress").length;
        const completed = items.filter((item) => item.state === "complete").length;
        $("downloadStats").textContent = `${active}개 받는 중 · ${completed}개 완료 · 최근 기록 ${items.length}개`;
        render();
    } catch {
        setStatus("다운로드 목록을 읽지 못했어요. 확장 프로그램 권한을 확인해 주세요.", true);
    }
};
const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => { refreshQueued = false; void refresh(); }, 120);
};

const startDownload = async (url: string, filename = "") => {
    try {
        const name = cleanSuggestedFilename(filename);
        if (name) {
            const response = await chrome.runtime.sendMessage({type: "bongextend-download", url, filename: name});
            if (!response?.ok) throw new Error(response?.error || "다운로드를 시작하지 못했어요.");
        } else await chrome.downloads.download({url, conflictAction: "uniquify"});
        setStatus("다운로드를 시작했어요.");
        return true;
    } catch (error) {
        setStatus(`다운로드를 시작하지 못했어요: ${(error as Error)?.message || "주소를 확인해 주세요."}`, true);
        return false;
    }
};
const startBatch = async () => {
    const urls = expandBatchUrls($<HTMLTextAreaElement>("batchInput").value, 100) as string[];
    if (!urls.length) { setStatus("받을 수 있는 http 또는 https 주소를 넣어 주세요.", true); return; }
    let started = 0;
    for (const url of urls) {
        try { await chrome.downloads.download({url, conflictAction: "uniquify"}); started += 1; }
        catch { /* 실패한 주소는 다음에 계속 진행한다 */ }
    }
    setStatus(`${started}개 다운로드를 시작했어요${started < urls.length ? ` · ${urls.length - started}개는 시작하지 못했어요` : ""}.`, started === 0);
    await refresh();
};

const renderSniffed = () => {
    sniffList.replaceChildren();
    const kind = $<HTMLSelectElement>("sniffType").value;
    const query = $<HTMLInputElement>("sniffSearch").value.trim().toLowerCase();
    const regexText = /^\/(.*)\/([iu]*)$/.exec(query);
    let regex: RegExp | null = null;
    if (regexText && regexText[1].length <= 128) {
        try { regex = new RegExp(regexText[1], regexText[2]); } catch { regex = null; }
    }
    const visible = sniffed.map((item, index) => ({item, index})).filter(({item}) => {
        if (kind === "이미지" && item.kind !== "이미지") return false;
        if (kind === "미디어" && !["음성", "동영상", "미디어"].includes(item.kind)) return false;
        if (kind === "링크" && item.kind !== "링크") return false;
        const content = `${item.name} ${item.url} ${item.kind}`.toLowerCase();
        return !query || (regex ? regex.test(content) : content.includes(query));
    });
    $("sniffSummary").textContent = `${visible.length}개 표시 · ${sniffed.length}개 찾음. 페이지에 직접 보이는 주소만 수집해요.`;
    for (const {item, index} of visible) {
        const row = document.createElement("label");
        row.className = "sniff-row";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = true;
        check.dataset.index = String(index);
        const text = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = item.name || item.url;
        const url = document.createElement("small");
        url.textContent = item.url;
        text.append(title, url);
        const kind = document.createElement("small");
        kind.textContent = item.kind;
        row.append(check, text, kind);
        sniffList.appendChild(row);
    }
    sniffPanel.hidden = false;
};
const scanPage = async () => {
    if (!Number.isInteger(sourceTabId) || sourceTabId < 0) {
        setStatus("페이지 수집은 BongExtend 팝업에서 연 관리 창에서 사용할 수 있어요.", true);
        return;
    }
    setStatus("현재 페이지에서 링크와 미디어 주소를 찾고 있어요.");
    try {
        const results = await chrome.scripting.executeScript({
            target: {tabId: sourceTabId},
            func: () => {
                const found = new Map<string, {url: string; name: string; kind: string}>();
                const add = (raw: string | null, name: string | null, kind: string) => {
                    try {
                        if (!raw) return;
                        const url = new URL(raw, location.href);
                        if (!['http:', 'https:'].includes(url.protocol) || found.has(url.href)) return;
                        found.set(url.href, {url: url.href, name: String(name || url.pathname.split('/').pop() || url.hostname).trim().slice(0, 180), kind});
                    } catch { /* skip invalid URLs */ }
                };
                document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((node) => add(node.href, node.innerText || node.title, '링크'));
                document.querySelectorAll<HTMLImageElement | HTMLSourceElement | HTMLVideoElement | HTMLAudioElement>('img[src],img[data-src],source[src],video[src],audio[src]').forEach((node) => {
                    const tag = node.tagName.toLowerCase();
                    const kind = tag === 'img' ? '이미지' : tag === 'audio' ? '음성' : tag === 'video' ? '동영상' : '미디어';
                    let raw = node.getAttribute('src') || node.getAttribute('data-src');
                    if (tag === 'img') {
                        const image = node as HTMLImageElement;
                        raw = image.currentSrc || image.src || raw;
                    } else if (tag === 'video' || tag === 'audio') {
                        const media = node as HTMLMediaElement;
                        raw = media.currentSrc || media.src || raw;
                    }
                    add(raw, node.getAttribute('alt') || node.getAttribute('title') || node.getAttribute('aria-label'), kind);
                });
                document.querySelectorAll<HTMLVideoElement>('video[poster]').forEach((node) => add(node.poster, '동영상 썸네일', '이미지'));
                return [...found.values()].slice(0, 1000);
            }
        });
        sniffed = (results[0]?.result || []) as Sniffed[];
        renderSniffed();
        setStatus(sniffed.length ? "페이지 항목을 찾았어요." : "이 페이지에서 다운로드할 주소를 찾지 못했어요.");
    } catch {
        setStatus("페이지에 접근할 수 없어요. 페이지를 BongExtend 팝업에서 연 뒤 다시 시도해 주세요.", true);
    }
};

const saveSettings = async (patch: Partial<Settings>) => {
    settings = normalizeDownloadSettings({...settings, ...patch}) as Settings;
    await chrome.storage.local.set({[DOWNLOAD_SETTINGS_KEY]: settings});
    render();
};
const loadSettings = async () => {
    const stored = await chrome.storage.local.get(DOWNLOAD_SETTINGS_KEY);
    settings = normalizeDownloadSettings(stored[DOWNLOAD_SETTINGS_KEY]) as Settings;
    $<HTMLInputElement>("replaceChromeUi").checked = settings.replaceChromeUi;
    $<HTMLInputElement>("notifications").checked = settings.notifications;
    $<HTMLInputElement>("filenameMask").value = settings.filenameMask;
    $<HTMLInputElement>("folder").value = settings.folder;
    $<HTMLInputElement>("routeByType").checked = settings.routeByType;
    $<HTMLTextAreaElement>("filenameRules").value = JSON.stringify(settings.rules, null, 2);
    $("viewToggle").textContent = settings.listView ? "표 보기" : "목록 보기";
};

$<HTMLButtonElement>("startBatch").addEventListener("click", () => void startBatch());
$<HTMLTextAreaElement>("batchInput").addEventListener("input", (event) => {
    const urls = expandBatchUrls((event.currentTarget as HTMLTextAreaElement).value, 100) as string[];
    $("batchCount").textContent = `${urls.length}개 주소 · 최대 100개`;
});
$<HTMLButtonElement>("scanPage").addEventListener("click", () => void scanPage());
$<HTMLSelectElement>("sniffType").addEventListener("change", renderSniffed);
$<HTMLInputElement>("sniffSearch").addEventListener("input", renderSniffed);
$<HTMLButtonElement>("downloadSelected").addEventListener("click", async () => {
    const chosen = [...sniffList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')]
        .map((check) => sniffed[Number(check.dataset.index)])
        .filter(Boolean);
    let started = 0;
    for (const item of chosen) {
        const safeName = cleanSuggestedFilename(item.name);
        const extension = (() => { try { return new URL(item.url).pathname.split("/").pop()?.match(/\.[a-z0-9]{1,8}$/i)?.[0] || ""; } catch { return ""; } })();
        const filename = safeName && !/\.[a-z0-9]{1,8}$/i.test(safeName) ? `${safeName}${extension}` : safeName;
        if (await startDownload(item.url, filename)) started += 1;
    }
    setStatus(`${started}개 파일을 받기 시작했어요${started < chosen.length ? ` · ${chosen.length - started}개는 시작하지 못했어요` : ""}.`, started === 0);
});
$<HTMLButtonElement>("refresh").addEventListener("click", () => void refresh());
$<HTMLButtonElement>("openChromeDownloads").addEventListener("click", () => void chrome.tabs.create({url: "chrome://downloads/"}));
$<HTMLButtonElement>("openChronoManager").addEventListener("click", async () => {
    await chrome.windows.create({url: chrome.runtime.getURL("/pop/pop.html"), type: "popup", width: 960, height: 700});
});
$<HTMLButtonElement>("openChronoSettings").addEventListener("click", async () => {
    await chrome.tabs.create({url: chrome.runtime.getURL("/ui/options.html")});
});
const chronoAccessButton = $<HTMLButtonElement>("chronoSiteAccess");
const syncChronoAccessButton = async () => {
    const stored = await chrome.storage.local.get(CHRONO_ACCESS_KEY);
    const enabled = stored[CHRONO_ACCESS_KEY] === true && await chrome.permissions.contains({permissions: CHRONO_SITE_PERMISSION, origins: CHRONO_ORIGINS});
    chronoAccessButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    chronoAccessButton.textContent = enabled ? "사이트 감지 끄기" : "모든 사이트에서 감지 켜기";
};
chronoAccessButton.addEventListener("click", async () => {
    const enabled = chronoAccessButton.getAttribute("aria-pressed") === "true";
    if (enabled) {
        await chrome.storage.local.set({[CHRONO_ACCESS_KEY]: false});
        const result = await chrome.runtime.sendMessage({type: "chrono-sync-sites"});
        await chrome.permissions.remove({permissions: CHRONO_SITE_PERMISSION});
        if (!result?.ok) { setStatus(result?.error || "Chrono 사이트 연결을 끄지 못했어요.", true); return; }
        setStatus("Chrono 사이트 연결을 껐어요. 확장 프로그램을 새로 시작하고 있어요.");
        window.setTimeout(() => chrome.runtime.reload(), 400);
        return;
    }
    try {
        const granted = await chrome.permissions.request({permissions: CHRONO_PERMISSIONS, origins: CHRONO_ORIGINS});
        if (!granted) { setStatus("권한을 허용하지 않아 페이지 감지를 켜지 않았어요.", true); return; }
        await chrome.storage.local.set({[CHRONO_ACCESS_KEY]: true});
        const result = await chrome.runtime.sendMessage({type: "chrono-sync-sites"});
        if (!result?.ok) throw new Error(result?.error || "Chrono 페이지 연결을 등록하지 못했어요.");
        await syncChronoAccessButton();
        setStatus("페이지 자동 감지를 켰어요. 확장 프로그램을 새로 시작할게요.");
        window.setTimeout(() => chrome.runtime.reload(), 500);
    } catch (error) {
        setStatus(`Chrono 사이트 권한을 바꾸지 못했어요: ${(error as Error)?.message || "권한을 확인해 주세요."}`, true);
    }
});
void syncChronoAccessButton();
chrome.permissions.onAdded.addListener(() => void syncChronoAccessButton());
chrome.permissions.onRemoved.addListener(() => void syncChronoAccessButton());
stateFilter.addEventListener("change", render);
typeFilter.addEventListener("change", render);
ageFilter.addEventListener("change", render);
searchInput.addEventListener("input", render);
$<HTMLButtonElement>("viewToggle").addEventListener("click", () => {
    void saveSettings({listView: !settings.listView});
    $("viewToggle").textContent = settings.listView ? "표 보기" : "목록 보기";
});
$<HTMLInputElement>("replaceChromeUi").addEventListener("change", (event) => void saveSettings({replaceChromeUi: (event.currentTarget as HTMLInputElement).checked}));
$<HTMLInputElement>("notifications").addEventListener("change", (event) => void saveSettings({notifications: (event.currentTarget as HTMLInputElement).checked}));
$<HTMLInputElement>("filenameMask").addEventListener("change", (event) => void saveSettings({filenameMask: (event.currentTarget as HTMLInputElement).value}));
$<HTMLInputElement>("folder").addEventListener("change", (event) => void saveSettings({folder: (event.currentTarget as HTMLInputElement).value}));
$<HTMLInputElement>("routeByType").addEventListener("change", (event) => void saveSettings({routeByType: (event.currentTarget as HTMLInputElement).checked}));
$<HTMLButtonElement>("saveRules").addEventListener("click", async () => {
    try {
        const parsed = JSON.parse($<HTMLTextAreaElement>("filenameRules").value || "[]");
        if (!Array.isArray(parsed)) throw new Error("규칙은 JSON 목록이어야 해요.");
        await saveSettings({rules: parsed} as Partial<Settings>);
        $("rulesStatus").textContent = "자동 규칙을 저장했어요.";
        setStatus("다운로드 자동 규칙을 저장했어요.");
    } catch (error) {
        $("rulesStatus").textContent = (error as Error)?.message || "JSON 형식을 확인해 주세요.";
        setStatus("자동 규칙을 저장하지 못했어요. JSON 형식을 확인해 주세요.", true);
    }
});

chrome.downloads.onCreated.addListener(queueRefresh);
chrome.downloads.onChanged.addListener(queueRefresh);
chrome.downloads.onErased.addListener(queueRefresh);
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[DOWNLOAD_SETTINGS_KEY]) void loadSettings();
});
void loadSettings().then(refresh);
