import {setupCurrencyPicker} from './fx-picker';
import {setupNaverMail} from './naver-mail';
import {watchGmailTheme} from './mail-appearance';
import {setupMailSettings} from "./mail-settings";
import {setupWindowControls} from "./window-controls";
// BongExtend 팝업: 탭 하나에 모듈 화면 하나. 각 모듈 화면은 옛 확장 팝업을 그대로 iframe으로 띄운다.
import "@/modules/theme/theme.css";
import {sendMessage} from "@/http/messaging";
import {isNewerVersion} from "@/core/update/availability";
import {isBongExtendManifest} from "@/core/update/release";
import {AUTO_ATTEMPT_KEY, INSTALL_STATE_KEY, type InstallState} from "@/core/update/autoInstall";
import {describeUpdateError, promiseWithTimeout, UPDATE_TIMEOUT_MESSAGE, UPDATE_UI_TIMEOUT_MS, UPDATE_UNKNOWN_MESSAGE} from "@/core/update/timeout";
// @ts-ignore 순수 JS
import {getModules, setModuleEnabled} from "@/modules/core-modules.js";
import {moveItem, normalizeTabOrder} from "@/core/popup/tabOrder";
import {createPointerDrag, edgeScrollDelta, gridDropIndex} from "@/core/popup/pointerDrag";
import type {DragEnd} from "@/core/popup/pointerDrag";
import {exportAllSettings, importSettingsText} from "@/modules/settings-io";
// @ts-ignore 순수 JS
import {FX_SELECTED_KEY, FX_DAILY_KEY, availableCurrencyCodes, selectedCurrencyCards, mergeRateTables, COMMON_CODES, CURRENCY_TINT, FX_FORM_KEY, FX_ORDER_KEY, FX_POPUP_REFRESH_MS, FX_URL, convertAmount, currencyCode, currencyColor, currencyIconPath, currencyLabel, currencyName, formatMoney, fxTabBadge, normalizeFxForm, orderCurrencyCards, parseRatePayload, shouldRefreshRates} from "@/modules/fx/convert.js";
// @ts-ignore 순수 JS
import {openQuoteStream} from "@/modules/fx/tradingview.js";
// @ts-ignore 순수 JS
import {composite} from "@/modules/theme/contrast.js";
// @ts-ignore 순수 JS
import {accountUnread, dedupeAccounts, formatMailTime, mailSenderLines, mailTabBadge, orderAccounts, preferInbox} from "@/modules/gmail/watch.js";
// @ts-ignore 순수 JS
import {ACCOUNT_COLORS, accountColor, accountInitial} from "@/modules/gmail/account-style.js";
// @ts-ignore 순수 JS
import {GMAIL_SOUND_KEY, SOUND_LABELS, SOUND_NAMES, defaultSound, normalizeSound, soundFile} from "@/modules/gmail/sound.js";
// @ts-ignore 순수 JS
import {createChromeEffects} from "@/platform/effects.js";
// @ts-ignore 순수 JS
import {gmailReadAccount, loadJson, openGmailPlace, openUrl, sendExtension} from "@/platform/popup-actions.js";
// @ts-ignore 순수 JS
import {gmailComposeUrl, gmailInboxUrl, gmailMessageUrl} from "@/modules/gmail/open.js";
// @ts-ignore settings helpers are plain JS
import {DARK_SETTINGS_KEY, darkSiteEnabled, darkSitePattern, normalizeDarkHost, normalizeDarkSettings} from "@/modules/dark/settings.js";
// @ts-ignore download settings helpers are plain JS
import {completedDownloadsBadge, DOWNLOAD_SETTINGS_KEY, normalizeDownloadSettings} from "@/modules/downloads/settings.js";
// @ts-ignore plain JS shared with the video bridge
import {VIDEO_HISTORY_KEY, VIDEO_STATUS_KEY, unseenVideos, videoHistory, videoInProgress} from "@/modules/downloads/video-history.js";

const effects = createChromeEffects();

type TabId = "chzzk" | "trans" | "dc" | "gmail" | "fx" | "dark" | "download" | "update";

const FRAMES: Partial<Record<TabId, string>> = {
    chzzk: "/chzzk/popup.html",
    trans: "/trans/popup/popup.html",
    dc: "/dc.html"
};
const NAMES: Partial<Record<TabId, string>> = {chzzk: "치지직", trans: "번역", dc: "디시", gmail: "메일", fx: "환율", dark: "다크 모드", download: "다운로더"};
const TAB_KEY = "core.popupTab";
// 탭 순서. core.* 이라 전체 백업·복원에 포함되고, 디시 초기화(refresher:*)와는 무관.
const ORDER_KEY = "core.popupTabOrder";
const DEFAULT_ORDER: TabId[] = ["chzzk", "trans", "dc", "gmail", "fx", "dark", "download"];
const TAB_IDS: TabId[] = [...DEFAULT_ORDER, "update"];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
setupNaverMail();
const checkerPlusMailFrame = $("checkerPlusMailFrame") as HTMLIFrameElement;
const initialMail = new URLSearchParams(location.search).get('mail');
if (initialMail && /^[a-zA-Z0-9_-]{1,128}$/.test(initialMail)) {
    checkerPlusMailFrame.dataset.src = `/checkerplus-popup.html?source=bongextend&previewMailId=${encodeURIComponent(initialMail)}`;
}
setupWindowControls(() => {
    const child = checkerPlusMailFrame.contentWindow as (Window & {BongExtendMailView?: {selection: () => string}}) | null;
    return child?.BongExtendMailView?.selection() || '';
});
const checkerPlusMailHome = $("checkerPlusMailHome") as HTMLButtonElement;
const chronoPopupFrame = $("chronoPopupFrame") as HTMLIFrameElement;
const applyEmbeddedTheme = (doc: Document, className: string, stylePath: string) => {
    const root = doc.documentElement;
    if (!root || root.classList.contains(className)) return;
    root.classList.add(className);
    root.style.colorScheme = getComputedStyle(document.documentElement).colorScheme;
    for (const href of ["theme/theme.css", stylePath]) {
        const stylesheet = doc.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = chrome.runtime.getURL(href);
        doc.head?.appendChild(stylesheet);
    }
};
let stopGmailTheme:(()=>void)|undefined;
checkerPlusMailFrame.addEventListener("load", () => {
    stopGmailTheme?.();stopGmailTheme=undefined;
    try {
        const doc = checkerPlusMailFrame.contentDocument;
        const optionsPage = checkerPlusMailFrame.contentWindow?.location.pathname.endsWith("/checkerplus-options.html");
        checkerPlusMailHome.hidden = !optionsPage;
        if (doc?.body?.id === "gmail-extension-popup") {
            applyEmbeddedTheme(doc, "bongextend-checkerplus-embedded", "checkerplus-embed.css");
            stopGmailTheme=watchGmailTheme(doc);
        }
    } catch {
        checkerPlusMailHome.hidden = true;
    }
});
checkerPlusMailHome.addEventListener("click", () => {
    checkerPlusMailFrame.src = checkerPlusMailFrame.dataset.src || "/checkerplus-popup.html?source=bongextend";
});
chronoPopupFrame.addEventListener("load", () => {
    try {
        const doc = chronoPopupFrame.contentDocument;
        if (!doc) return;
        // The native recent list already loads the shared theme before its own compact styles.
        if (doc.location.pathname === "/recent-downloads.html") return;
        applyEmbeddedTheme(doc, "bongextend-chrono-embedded", "pop/pop-embed.css");
    } catch (error) {
        console.warn("다운로더 화면을 BongExtend 탭에 맞추지 못했어요.", error);
    }
});
let current: TabId = "chzzk";
let pageBeforeSettings: TabId = "chzzk";

type ModuleId = "chzzk" | "trans" | "dc" | "gmail" | "fx" | "dark" | "download";
const moduleOptions = [...document.querySelectorAll<HTMLInputElement>("[data-module-toggle]")];
const paintModuleOptions = async () => {
    const modules = await getModules() as Record<ModuleId, boolean>;
    for (const input of moduleOptions) input.checked = modules[input.dataset.moduleToggle as ModuleId] !== false;
};
const paintCurrentModuleState = async () => {
    const tab = current;
    const modules = await getModules() as Record<ModuleId, boolean>;
    if (tab !== current) return;
    const off = tab !== "update" && modules[tab] === false;
    $("moduleStateNotice").hidden = !off;
    $("moduleStateText").textContent = off ? `${NAMES[tab]} 기능이 꺼져 있어요.` : "";
};
$("moduleEnableCurrent").addEventListener("click", async () => {
    const tab = current;
    if (tab === "update") return;
    const button = $<HTMLButtonElement>("moduleEnableCurrent");
    button.disabled = true;
    try { await setModuleEnabled(tab, true); await paintCurrentModuleState(); }
    catch { $("moduleStateText").textContent = "저장하지 못했어요. 다시 눌러 주세요."; }
    finally { button.disabled = false; }
});
for (const input of moduleOptions) {
    input.addEventListener("change", async () => {
        const id = input.dataset.moduleToggle as ModuleId;
        const wanted = input.checked;
        const status = $("moduleStatus");
        input.disabled = true;
        try {
            const next = await setModuleEnabled(id, wanted) as Record<ModuleId, boolean>;
            input.checked = next[id] !== false;
            status.textContent = `${NAMES[id]} 모듈을 ${wanted ? "켰어요" : "껐어요"}.`;
        } catch {
            input.checked = !wanted;
            status.textContent = `${NAMES[id]} 모듈 설정을 저장하지 못했어요.`;
        } finally {
            input.disabled = false;
        }
    });
}

const embed = new URLSearchParams(location.search).get("embed");
const embedded = embed === "gmail" || embed === "fx" || embed === "dark" || embed === "download" || embed === "update";

const showTab = async (tab: TabId, persist = true) => {
    if (tab === "update" && current !== "update") pageBeforeSettings = current;
    current = tab;
    void paintCurrentModuleState();
    document.documentElement.classList.toggle("mail-active", tab === "gmail");
    document.querySelectorAll<HTMLButtonElement>("#tabGroup button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("settingsGear").classList.toggle("on", tab === "update");
    document.querySelectorAll<HTMLElement>("[data-frame]").forEach((el) => {
        const on = el.dataset.frame === tab;
        if (el instanceof HTMLIFrameElement) {
            const src = FRAMES[el.dataset.frame as TabId];
            if (on && src && !el.src) el.src = src;
            el.classList.toggle("active", on);
            if (el.dataset.frame === "chzzk") el.classList.add("chzzk-frame");
        } else {
            el.hidden = !on;
        }
    });
    if (tab === "gmail") {
        if (!checkerPlusMailFrame.src) checkerPlusMailFrame.src = checkerPlusMailFrame.dataset.src || "/checkerplus-popup.html?source=bongextend";
    }
    if (tab === "download") {
        const stored = await chrome.storage.local.get("core.chronoPopup");
        const popup = typeof stored["core.chronoPopup"] === "string" && (stored["core.chronoPopup"] === "/recent-downloads.html" || /^\/(?:(?:pop\/(?:pop|sniffer))|(?:ui\/(?:index|options)))\.html(?:\?(?:mnu|recent)=1)?$/.test(stored["core.chronoPopup"]))
            ? (stored["core.chronoPopup"] === "/pop/pop.html" ? "/recent-downloads.html" : stored["core.chronoPopup"]) : "/recent-downloads.html";
        chronoPopupFrame.closest(".panel")?.classList.toggle("is-recent", popup === "/recent-downloads.html");
        if (chronoPopupFrame.src !== chrome.runtime.getURL(popup)) chronoPopupFrame.src = popup;
    }
    if (tab === "download") void acknowledgeDownloads();
    if (tab === "fx") void refreshFx();
    if (tab === "update") void paintModuleOptions();
    if (persist) void effects.storageSet({[TAB_KEY]: tab});
};

// ===== 탭 끌어서 순서 바꾸기 (포인터 이벤트, 의존성 없음) =====
const tabsNav = document.querySelector<HTMLElement>(".tabs")!;
const tabGroup = document.querySelector<HTMLElement>("#tabGroup")!;
const tabButtons = () => [...tabGroup.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
const currentOrder = () => tabButtons().map((b) => b.dataset.tab as TabId);
const applyOrder = (order: TabId[]) => {
    for (const id of order) {
        const b = tabGroup.querySelector(`button[data-tab="${id}"]`);
        if (b) tabGroup.appendChild(b);
    }
};
const saveOrder = () => void effects.storageSet({[ORDER_KEY]: currentOrder()});

let suppressClick = false;

const bindPointerReorder = (opts: {
    handle: HTMLElement;
    item: HTMLElement;
    list: HTMLElement;
    live?: HTMLElement;
    axis: "x" | "y";
    ignore?: (target: EventTarget | null) => boolean;
    onClick?: () => void;
    onDrop?: () => void;
}) => {
    const drag = createPointerDrag({axis: opts.axis, threshold: 5});
    const live = opts.live || opts.list;
    let slot: HTMLElement | null = null;
    let activeId: number | null = null;
    let grabX = 0;
    let grabY = 0;
    let originNext: ChildNode | null = null;
    let listening = false;
    let scrollTimer = 0;

    const clearVisual = () => {
        opts.item.classList.remove("dragging");
        live.classList.remove("reordering");
        opts.item.style.position = "";
        opts.item.style.left = "";
        opts.item.style.top = "";
        opts.item.style.width = "";
        opts.item.style.height = "";
        opts.item.style.transform = "";
        opts.item.style.zIndex = "";
        opts.item.style.margin = "";
        if (slot?.parentElement) slot.replaceWith(opts.item);
        slot = null;
    };
    const moveSlot = (clientX: number, clientY: number) => {
        if (!slot) return;
        const scroller = opts.list.closest(".panel") || opts.list;
        const view = scroller.getBoundingClientRect();
        const delta = edgeScrollDelta(view, {x: clientX, y: clientY});
        if (delta.x) scroller.scrollLeft += delta.x;
        if (delta.y) scroller.scrollTop += delta.y;
        const others = [...opts.list.children].filter((el) => el !== opts.item && el !== slot) as HTMLElement[];
        const boxes = others.map((el) => {
            const box = el.getBoundingClientRect();
            return {left: box.left, top: box.top, width: box.width, height: box.height};
        });
        const before = others[gridDropIndex(boxes, {x: clientX, y: clientY})] || null;
        const tops = new Map(others.map((el) => [el, opts.axis === "x" ? el.getBoundingClientRect().left : el.getBoundingClientRect().top]));
        let moved = false;
        if (before) {
            if (slot.nextElementSibling !== before) { opts.list.insertBefore(slot, before); moved = true; }
        } else if (opts.list.lastElementChild !== slot) {
            opts.list.appendChild(slot);
            moved = true;
        }
        if (!moved || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        for (const [el, prev] of tops) {
            const now = opts.axis === "x" ? el.getBoundingClientRect().left : el.getBoundingClientRect().top;
            const delta = prev - now;
            if (!delta) continue;
            const prop = opts.axis === "x" ? "translateX" : "translateY";
            el.animate([{transform: `${prop}(${delta}px)`}, {transform: "none"}], {duration: 180, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)"});
        }
    };
    const detach = () => {
        if (!listening) return;
        listening = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("keydown", onKey);
        document.removeEventListener("pointerleave", onLeave, true);
    };
    const finish = (result: DragEnd | null) => {
        if (!result) return;
        const id = activeId;
        activeId = null;
        try { if (id != null) opts.handle.releasePointerCapture(id); } catch { /* 이미 풀린 포인터 */ }
        if (scrollTimer) window.clearInterval(scrollTimer);
        scrollTimer = 0;
        detach();
        if (result === "revert" && slot) {
            if (originNext && originNext.parentNode === opts.list) opts.list.insertBefore(slot, originNext);
            else opts.list.appendChild(slot);
        }
        clearVisual();
        if (result === "drop") opts.onDrop?.();
        else if (result === "click") opts.onClick?.();
    };
    const onMove = (ev: PointerEvent) => {
        const step = drag.move(ev);
        if (step === "ignore" || step === "pending") return;
        ev.preventDefault();
        if (step === "start") {
            const rect = opts.item.getBoundingClientRect();
            grabX = ev.clientX - rect.left;
            grabY = ev.clientY - rect.top;
            originNext = opts.item.nextSibling;
            slot = document.createElement("div");
            slot.className = "drag-slot";
            slot.style.width = `${rect.width}px`;
            slot.style.height = `${rect.height}px`;
            opts.item.before(slot);
            opts.item.classList.add("dragging");
            live.classList.add("reordering");
            opts.item.style.position = "fixed";
            opts.item.style.margin = "0";
            opts.item.style.zIndex = "40";
            opts.item.style.width = `${rect.width}px`;
            opts.item.style.height = `${rect.height}px`;
            opts.item.style.transform = "none";
            opts.item.style.left = `${rect.left}px`;
            opts.item.style.top = `${rect.top}px`;
        }
        opts.item.style.left = `${ev.clientX - grabX}px`;
        opts.item.style.top = `${ev.clientY - grabY}px`;
        moveSlot(ev.clientX, ev.clientY);
    };
    const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        finish(drag.revert());
    };
    const onUp = (ev: PointerEvent) => finish(drag.up(ev));
    const onCancel = (ev?: Event) => {
        const pointerId = ev && "pointerId" in ev ? (ev as PointerEvent).pointerId : undefined;
        finish(drag.cancel(pointerId == null ? undefined : {pointerId}));
    };
    const onBlur = () => finish(drag.cancel());
    const onLeave = (ev: PointerEvent) => {
        if (ev.relatedTarget != null) return;
        finish(drag.cancel());
    };
    opts.handle.addEventListener("pointerdown", (ev) => {
        if (opts.ignore?.(ev.target)) return;
        if (!drag.down(ev)) return;
        ev.preventDefault();
        activeId = ev.pointerId;
        try { opts.handle.setPointerCapture(ev.pointerId); } catch { /* 포인터가 이미 떠남 */ }
        if (listening) return;
        listening = true;
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("blur", onBlur);
        window.addEventListener("keydown", onKey);
        document.addEventListener("pointerleave", onLeave, true);
        scrollTimer = window.setInterval(() => {
            if (drag.phase !== "dragging") return;
            moveSlot(drag.x, drag.y);
        }, 40);
    });
};

tabButtons().forEach((b) => {
    b.addEventListener("click", (e) => {
        if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; return; }
        void showTab(b.dataset.tab as TabId);
    });
    b.addEventListener("keydown", (e) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        const order = currentOrder();
        const from = order.indexOf(b.dataset.tab as TabId);
        applyOrder(moveItem(order, from, from + (e.key === "ArrowLeft" ? -1 : 1)));
        b.focus();
        saveOrder();
    });
    bindPointerReorder({
        handle: b,
        item: b,
        list: tabGroup,
        live: tabsNav,
        axis: "x",
        onClick: () => { void showTab(b.dataset.tab as TabId); },
        onDrop: () => {
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            saveOrder();
        }
    });
});
// 로고 더블클릭 = 기본 순서로 되돌리기
document.querySelector(".brand")?.addEventListener("dblclick", () => { applyOrder(DEFAULT_ORDER); saveOrder(); });

// ===== 업데이트 (BongExtend 전체에서 업데이트 UI는 이 탭 하나뿐) =====
type UpdateStatus = {
    currentVersion?: string; latestVersion?: string; updateAvailable?: boolean;
    releaseUrl?: string; downloadUrl?: string; releaseNotes?: string; error?: string;
    lastCheckedAt?: number; autoCheck?: boolean;
};
const updateStatus = $("updateStatus");
const doUpdate = $<HTMLButtonElement>("doUpdate");
const downloadZip = $<HTMLButtonElement>("downloadZip");
const openRelease = $<HTMLButtonElement>("openRelease");
const checkBtn = $<HTMLButtonElement>("checkUpdate");
const autoCheck = $<HTMLInputElement>("autoCheck");
const lastChecked = $("lastChecked");
const notesBox = $("releaseNotesBox");
const notes = $("releaseNotes");
const updateHint = $("updateHint");
const firefoxUpdateNote = $("firefoxUpdateNote");
const firefoxBuild = Boolean(import.meta.env.FIREFOX);
if (firefoxBuild) firefoxUpdateNote.hidden = false;
let releaseUrl = "";
$("ver").textContent = effects.getManifest().version;

const setStatus = (text: string, kind = "") => { updateStatus.textContent = text; updateStatus.className = kind; };

const renderUpdate = (s: UpdateStatus | null | undefined) => {
    if (!s) return;
    const cur = effects.getManifest().version;
    releaseUrl = s.releaseUrl || "";
    const available = Boolean(s.updateAvailable && s.latestVersion && isNewerVersion(s.latestVersion, cur));
    const notice = $("updateNotice");
    $("updateDot").hidden = !available;
    $("settingsGear").title = available ? `새 버전 ${s.latestVersion}이 있어요` : "업데이트·설정";
    notice.hidden = !available;
    notice.textContent = available ? `새 버전 ${s.latestVersion}이 있어요. 아래에서 받을 수 있어요.` : "";
    if (s.error) setStatus(s.error, "error");
    else if (available) setStatus(`${cur} → ${s.latestVersion} 업데이트할 수 있어요`, "ok");
    else if (s.latestVersion) setStatus("최신 버전이에요.", "be-prism-current");
    if (typeof s.autoCheck === "boolean") autoCheck.checked = s.autoCheck;
    lastChecked.textContent = s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString("ko-KR") : "아직 확인하지 않음";
    doUpdate.hidden = firefoxBuild || !available || !s.downloadUrl;
    downloadZip.hidden = firefoxBuild || !available || !s.downloadUrl;
    openRelease.hidden = !available || !releaseUrl;
    updateHint.hidden = doUpdate.hidden;
    firefoxUpdateNote.hidden = !firefoxBuild;
    notesBox.hidden = !(available && s.releaseNotes);
    notes.textContent = available ? s.releaseNotes || "" : "";
};

const CHECKING = "확인 중…";

const check = async (force: boolean) => {
    if (force) { checkBtn.disabled = true; setStatus(CHECKING); }
    try {
        const status = await promiseWithTimeout(
            sendMessage("checkForUpdate", {force}) as Promise<UpdateStatus>,
            UPDATE_UI_TIMEOUT_MS,
            UPDATE_TIMEOUT_MESSAGE
        );
        renderUpdate(status);
        if (force && status.updateAvailable && !status.error) setStatus("새 버전을 확인했어요. 자동 업데이트를 시작해요.");
        if (updateStatus.textContent === CHECKING || updateStatus.textContent === "확인 전") {
            setStatus(UPDATE_UNKNOWN_MESSAGE, "error");
        }
    } catch (error) {
        setStatus(describeUpdateError(error), "error");
    } finally {
        if (force) checkBtn.disabled = false;
    }
};

checkBtn.addEventListener("click", () => void check(true));

const saveInstallDirHandle = async (handle: FileSystemDirectoryHandle) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("bongextend-install", 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
            if (!request.result.objectStoreNames.contains("pending")) request.result.createObjectStore("pending");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(handle, "installDir");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
    localStorage.setItem("bongextend.installDirSaved", "1");
};

const validInstallDir = async (handle: FileSystemDirectoryHandle) => {
    try {
        const file = await handle.getFileHandle("manifest.json");
        return isBongExtendManifest(await (await file.getFile()).text());
    } catch {
        return false;
    }
};

const autoInstallStatus = $('autoInstallStatus');
const renderInstallState = (state?: InstallState) => {
    autoInstallStatus.textContent = state?.message || (localStorage.getItem('bongextend.installDirSaved') === '1'
        ? '저장된 폴더 권한이 있으면 새 버전을 자동 설치해요.' : '자동 설치를 위해 설치 폴더를 한 번 지정해 주세요.');
};
void browser.storage.local.get(INSTALL_STATE_KEY).then(value => renderInstallState(value[INSTALL_STATE_KEY] as InstallState | undefined));
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[INSTALL_STATE_KEY]) renderInstallState(changes[INSTALL_STATE_KEY].newValue as InstallState | undefined);
});
$('chooseUpdateFolder').addEventListener('click', async () => {
    try {
        if (!window.showDirectoryPicker) throw new Error('폴더 선택을 지원하는 Chrome에서 설정해 주세요.');
        const dir = await window.showDirectoryPicker({mode:'readwrite', id:'bongextend-install'});
        if (!(await validInstallDir(dir))) throw new Error('manifest.json이 있는 BongExtend 설치 폴더를 선택해 주세요.');
        await saveInstallDirHandle(dir);
        await browser.storage.local.remove([INSTALL_STATE_KEY, AUTO_ATTEMPT_KEY]);
        renderInstallState();
        await check(true);
        const saved = await browser.storage.local.get(['core.update:available', 'core.update:autoCheck', INSTALL_STATE_KEY]);
        if (saved['core.update:available'] && saved['core.update:autoCheck'] !== false && !saved[INSTALL_STATE_KEY]) {
            // Reuse a page that was waiting for permission; do not interrupt a
            // download already launched by check(), or steal the current focus.
            const [tab] = await browser.tabs.query({url: effects.getURL('/update.html') + '*'});
            const url = effects.getURL('/update.html?auto=1');
            if (tab?.id != null) await browser.tabs.update(tab.id, {url});
            else await browser.tabs.create({url, active:false});
        }
    } catch(error) {
        autoInstallStatus.textContent = (error as Error)?.name === 'AbortError' ? '폴더 선택을 취소했어요.' : (error as Error).message;
    }
});

doUpdate.addEventListener("click", async () => {
    doUpdate.disabled = true;
    setStatus("확장 프로그램 폴더를 확인하고 있어요.");
    try {
        if (localStorage.getItem("bongextend.installDirSaved") === "1") {
            await openUrl(effects, effects.getURL("/update.html?start=1"));
            return;
        }
        if (!window.showDirectoryPicker) throw new Error("폴더 선택을 지원하는 Chrome에서 업데이트해 주세요.");
        setStatus("manifest.json이 들어 있는 BongExtend 설치 폴더를 골라 주세요.");
        // Open the picker synchronously in the click handler while Chrome's
        // transient user activation is still available.
        const dir = await window.showDirectoryPicker({mode: "readwrite", id: "bongextend-install"});
        if (!(await validInstallDir(dir))) throw new Error("선택한 폴더가 BongExtend 설치 폴더가 아니에요.");
        await saveInstallDirHandle(dir);
        setStatus("설치 폴더를 확인했어요. 업데이트를 시작해요.", "ok");
        await openUrl(effects, effects.getURL("/update.html?start=1"));
    } catch (error) {
        const message = error instanceof DOMException && error.name === "AbortError"
            ? "폴더 선택을 취소했어요."
            : (error as Error)?.message || "업데이트를 시작하지 못했어요.";
        setStatus(message, "error");
    } finally {
        doUpdate.disabled = false;
    }
});
downloadZip.addEventListener("click", async () => {
    try {
        const r = await sendMessage("applyUpdate", undefined) as {ok: boolean; error?: string};
        if (!r?.ok) setStatus(r?.error || "zip 파일을 받지 못했어요.", "error");
        else setStatus("zip 파일을 받기 시작했어요. 기존 폴더에 압축을 풀어 덮어쓴 뒤 확장 프로그램을 새로고침해 주세요.", "ok");
    } catch {
        setStatus("zip 파일을 받지 못했어요.", "error");
    }
});
openRelease.addEventListener("click", () => { if (releaseUrl) void openUrl(effects, releaseUrl); });
$("manage").addEventListener("click", () => void openUrl(effects, `chrome://extensions/?id=${effects.runtimeId()}`));
autoCheck.addEventListener("change", async () => {
    const want = autoCheck.checked;
    try {
        renderUpdate(await sendMessage("setUpdateAutoCheck", {enabled: want}) as UpdateStatus);
    } catch {
        autoCheck.checked = !want;
        setStatus("자동 확인 설정을 저장하지 못했어요.", "error");
    }
});
$("settingsGear").addEventListener("click", () => {
    void showTab(current === "update" ? pageBeforeSettings : "update");
});

void (async () => {
    try {
        const status = await promiseWithTimeout(
            sendMessage("getUpdateStatus", undefined) as Promise<UpdateStatus>,
            UPDATE_UI_TIMEOUT_MS,
            UPDATE_TIMEOUT_MESSAGE
        );
        renderUpdate(status);
        if (status?.autoCheck) await check(false);
    } catch (error) {
        setStatus(describeUpdateError(error), "error");
    }
})();

// ===== 설정 내보내기·가져오기 =====
const ioStatus = $("ioStatus");
const setIo = (text: string, kind = "") => { ioStatus.textContent = text; ioStatus.className = kind; };
const importFile = $<HTMLInputElement>("importFile");

$("exportAll").addEventListener("click", async () => {
    try {
        const data = await exportAllSettings();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `bongextend-settings-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setIo("설정 파일을 저장했어요. Gemini API 키가 들어 있으니 이 파일은 공유하지 마세요.", "ok");
    } catch (error) {
        setIo(`저장하지 못했어요: ${(error as Error)?.message || error}`, "error");
    }
});

const runImport = async (text: string) => {
    try {
        const result = await importSettingsText(text);
        setIo(`${result.join(", ")} 설정을 불러왔어요. 열려 있는 페이지는 새로고침(F5)해 주세요.`, "ok");
        document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((f) => { if (f.src) f.src = f.src; });
    } catch (error) {
        setIo((error as Error)?.message || "불러오지 못했어요.", "error");
    }
};

$("importAll").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (file) await runImport(await file.text());
});
$("importPaste").addEventListener("click", async () => {
    const text = prompt("불러올 설정(JSON)을 붙여넣어 주세요.");
    if (text) await runImport(text);
});

if (embedded) {
    document.documentElement.classList.add("embed");
    tabsNav.classList.remove("order-pending");
    queueMicrotask(() => { void showTab(embed as TabId, false); });
} else effects.storageGet([TAB_KEY, ORDER_KEY]).then((v: Record<string, unknown>) => {
    applyOrder(normalizeTabOrder(v[ORDER_KEY], DEFAULT_ORDER));
    tabsNav.classList.remove("order-pending");
    const saved = v[TAB_KEY] as TabId | undefined;
    void showTab(new URLSearchParams(location.search).has("mailSettings") ? "gmail" : saved && TAB_IDS.includes(saved) ? saved : "chzzk");
});

// ===== 다크 모드 설정 =====
type DarkConfig = Record<string, any>;
let darkConfig: DarkConfig = normalizeDarkSettings(null) as DarkConfig;
let darkTabId: number | null = null;
let darkHost = "";
let darkHostLabel = "";
let darkSiteOrigin = "";
let darkPermissionGranted = false;
let darkAllSitesPermissionGranted = false;
let darkStyleAccessGranted = false;
const darkCssAccess = $<HTMLButtonElement>('darkCssAccess');
const darkStatus = $("darkStatus");
const darkInputs = {
    everywhere: $<HTMLInputElement>("darkEverywhere"),
    currentSite: $<HTMLInputElement>("darkCurrentSite"),
    followSystem: $<HTMLInputElement>("darkFollowSystem"),
    customSite: $<HTMLInputElement>("darkCustomSite"),
    mode: $<HTMLSelectElement>("darkMode"),
    brightness: $<HTMLInputElement>("darkBrightness"),
    contrast: $<HTMLInputElement>("darkContrast"),
    sepia: $<HTMLInputElement>("darkSepia"),
    grayscale: $<HTMLInputElement>("darkGrayscale"),
    font: $<HTMLInputElement>("darkFont"),
    background: $<HTMLInputElement>("darkBackground"),
    text: $<HTMLInputElement>("darkText")
};
const paintDarkValues = (config: DarkConfig) => {
    const siteTheme = darkHost && config.siteThemes?.[darkHost] ? config.siteThemes[darkHost] : null;
    const theme = {...config, ...(siteTheme || {})};
    darkInputs.everywhere.checked = Boolean(config.enabledByDefault && darkAllSitesPermissionGranted);
    darkInputs.currentSite.checked = Boolean(darkHost && darkPermissionGranted && darkSiteEnabled(config, darkHost));
    darkInputs.currentSite.disabled = !darkHost;
    darkInputs.followSystem.checked = Boolean(config.followSystem);
    darkInputs.customSite.checked = Boolean(siteTheme);
    darkInputs.customSite.disabled = !darkHost;
    $("darkThemeScope").textContent = siteTheme ? "이 사이트의 색상만 바꿔요." : "허용한 사이트에서 사용할 기본 색상을 바꿔요.";
    darkInputs.mode.value = String(theme.mode ?? 1);
    for (const key of ["brightness", "contrast", "sepia", "grayscale"] as const) {
        darkInputs[key].value = String(theme[key]);
        $(`dark${key[0].toUpperCase()}${key.slice(1)}Value`).textContent = `${theme[key]}%`;
    }
    darkInputs.font.value = theme.fontFamily || "";
    darkInputs.background.value = theme.darkSchemeBackgroundColor || "#181a1b";
    darkInputs.text.value = theme.darkSchemeTextColor || "#e8e6e3";
    $("darkSiteLabel").textContent = darkHostLabel || "이 페이지에서는 사용할 수 없어요";
    $("darkSiteNote").textContent = !darkHost
        ? "브라우저 내부 페이지에는 적용할 수 없어요."
        : !darkPermissionGranted
            ? `${darkSiteOrigin} 권한을 허용하면 켤 수 있어요.`
            : `${darkSiteOrigin}에 적용해요.`;
    $<HTMLSelectElement>("darkSiteListMode").value = config.siteListMode;
    $<HTMLTextAreaElement>("darkSiteList").value = config.siteList.join("\n");
};
const loadDarkConfig = async () => {
    const [tabs, stored] = await Promise.all([
        effects.tabsQuery({active: true, lastFocusedWindow: true}),
        effects.storageGet(DARK_SETTINGS_KEY)
    ]);
    const tab = tabs[0];
    darkTabId = typeof tab?.id === "number" ? tab.id : null;
    darkHost = "";
    darkHostLabel = "";
    darkSiteOrigin = "";
    darkPermissionGranted = false;
    darkAllSitesPermissionGranted = false;
    try {
        const url = new URL(tab?.url || "");
        if (url.protocol === "http:" || url.protocol === "https:") {
            darkHost = normalizeDarkHost(url.hostname) as string;
            if (darkHost) {
                darkHostLabel = url.hostname.toLowerCase();
                darkSiteOrigin = url.origin;
            }
        }
    } catch { /* 주소 표시줄이나 브라우저 내부 페이지 */ }
    if (darkHost && darkSiteOrigin) {
        const protocol = new URL(darkSiteOrigin).protocol;
        const pattern = darkSitePattern(darkHost).find((item: string) => item.startsWith(`${protocol}//`));
        if (pattern) darkPermissionGranted = await chrome.permissions.contains({origins: [pattern]});
    }
    darkAllSitesPermissionGranted = await chrome.permissions.contains({origins: ["https://*/*", "http://*/*"]});
    darkStyleAccessGranted = await chrome.permissions.contains({origins: ['https://*/*']});
    darkConfig = normalizeDarkSettings(stored[DARK_SETTINGS_KEY]) as DarkConfig;
    paintDarkValues(darkConfig);
    setDarkStatus(!darkHost ? "사이트별 적용은 웹사이트를 연 뒤 BongExtend 팝업에서 바꿀 수 있어요." : darkInputs.currentSite.checked ? "이 사이트에서 사용 중이에요. 변경 사항은 바로 저장돼요." : "위 스위치를 켜면 이 사이트에 적용해요.");
    darkCssAccess.hidden = darkStyleAccessGranted;
    $('darkCssNote').textContent = darkStyleAccessGranted
        ? '스타일 자동 연결을 허용했어요. 다크 모드를 켠 사이트에서 알아서 적용돼요.'
        : '한 번 허용하면 사이트마다 다시 연결할 필요가 없어요. Chrome에서 모든 HTTPS 사이트 접근 권한을 요청해요.';
};
const setDarkStatus = (message: string, error = false) => {
    darkStatus.textContent = message;
    darkStatus.classList.toggle("error", error);
};
const saveDarkConfig = async (next: DarkConfig, applyToCurrent = true) => {
    darkConfig = normalizeDarkSettings(next) as DarkConfig;
    await effects.storageSet({[DARK_SETTINGS_KEY]: darkConfig});
    paintDarkValues(darkConfig);
    if (applyToCurrent && darkTabId != null && darkHost) {
        try {
            await chrome.scripting.executeScript({target: {tabId: darkTabId, allFrames: true}, world: "MAIN", files: ["content-scripts/dark-proxy.js"]});
            await chrome.scripting.executeScript({target: {tabId: darkTabId, allFrames: true}, files: ["content-scripts/dark.js"]});
            setDarkStatus(darkSiteEnabled(darkConfig, darkHost) ? "현재 사이트에 적용했어요." : "현재 사이트에서 껐어요.");
        } catch {
            setDarkStatus("권한을 확인하고 페이지를 새로고침해 주세요.", true);
        }
    } else setDarkStatus("설정을 저장했어요.");
};
const requestDarkOrigin = async (patterns: string[]) => {
    try { return await chrome.permissions.request({origins: patterns}); }
    catch { return false; }
};

darkInputs.currentSite.addEventListener("change", async () => {
    if (!darkHost) return;
    const enabling = darkInputs.currentSite.checked;
    if (enabling && !darkPermissionGranted) {
        const protocol = new URL(darkSiteOrigin).protocol;
        const pattern = darkSitePattern(darkHost).find((item: string) => item.startsWith(`${protocol}//`));
        const origins = pattern ? [pattern] : [];
        const granted = pattern ? await requestDarkOrigin([...new Set(origins)]) : false;
        if (!granted) {
            darkInputs.currentSite.checked = false;
            setDarkStatus("사이트 권한을 허용하지 않아 켜지 않았어요.", true);
            return;
        }
        darkPermissionGranted = true;
    }
    const enabledSites = new Set<string>(darkConfig.enabledSites);
    const disabledSites = new Set<string>(darkConfig.disabledSites);
    if (enabling) { enabledSites.add(darkHost); disabledSites.delete(darkHost); }
    else { enabledSites.delete(darkHost); if (darkConfig.enabledByDefault) disabledSites.add(darkHost); else disabledSites.delete(darkHost); }
    await saveDarkConfig({...darkConfig, enabledSites: [...enabledSites], disabledSites: [...disabledSites]});
});

darkCssAccess.addEventListener('click', async () => {
    const granted = await requestDarkOrigin(['https://*/*']);
    if (!granted) {setDarkStatus('스타일 자동 연결을 허용하지 않았어요. 기존 적용은 유지해요.', true); return;}
    await loadDarkConfig();
    setDarkStatus('스타일 자동 연결을 허용했어요. 다크 모드를 켠 사이트에 자동 적용돼요.');
});
darkInputs.everywhere.addEventListener("change", async () => {
    const enabling = darkInputs.everywhere.checked;
    if (enabling) {
        const granted = await requestDarkOrigin(["https://*/*", "http://*/*"]);
        if (!granted) {
            darkInputs.everywhere.checked = false;
            setDarkStatus("모든 사이트 권한을 허용하지 않아 전체 적용을 켜지 않았어요.", true);
            return;
        }
        darkAllSitesPermissionGranted = true;
    }
    await saveDarkConfig({...darkConfig, enabledByDefault: enabling});
});
darkInputs.followSystem.addEventListener("change", () => void saveDarkConfig({...darkConfig, followSystem: darkInputs.followSystem.checked}));
darkInputs.customSite.addEventListener("change", async () => {
    if (!darkHost) return;
    const siteThemes = {...darkConfig.siteThemes};
    if (darkInputs.customSite.checked) {
        const {enabledByDefault, enabledSites, disabledSites, siteThemes: _siteThemes, followSystem, ...theme} = darkConfig;
        siteThemes[darkHost] = theme;
    } else delete siteThemes[darkHost];
    await saveDarkConfig({...darkConfig, siteThemes});
});
const updateDarkTheme = (key: string, value: unknown) => {
    let next = {...darkConfig};
    if (darkInputs.customSite.checked && darkHost) {
        next.siteThemes = {...darkConfig.siteThemes, [darkHost]: {...(darkConfig.siteThemes[darkHost] || {}), [key]: value}};
    } else next[key] = value;
    void saveDarkConfig(next);
};
darkInputs.mode.addEventListener("change", () => updateDarkTheme("mode", Number(darkInputs.mode.value) === 0 ? 0 : 1));
for (const key of ["brightness", "contrast", "sepia", "grayscale"] as const) {
    darkInputs[key].addEventListener("input", () => { $(`dark${key[0].toUpperCase()}${key.slice(1)}Value`).textContent = `${darkInputs[key].value}%`; });
    darkInputs[key].addEventListener("change", () => updateDarkTheme(key, Number(darkInputs[key].value)));
}
darkInputs.font.addEventListener("change", () => updateDarkTheme("fontFamily", darkInputs.font.value.trim()));
darkInputs.background.addEventListener("change", () => updateDarkTheme("darkSchemeBackgroundColor", darkInputs.background.value));
darkInputs.text.addEventListener("change", () => updateDarkTheme("darkSchemeTextColor", darkInputs.text.value));
$("saveDarkSiteList").addEventListener("click", async () => {
    const mode = $<HTMLSelectElement>("darkSiteListMode").value === "only" ? "only" : "exclude";
    const hosts = [...new Set($<HTMLTextAreaElement>("darkSiteList").value.split(/\r?\n/).map((host) => host.trim().toLowerCase().replace(/^\*\./, "")).filter((host) => /^[a-z0-9.-]+$/.test(host) && !host.includes("..")))].slice(0, 100);
    if (mode === "only" && !darkConfig.enabledByDefault && hosts.length) {
        const patterns = [...new Set(hosts.flatMap((host) => darkSitePattern(host)))];
        const granted = await requestDarkOrigin(patterns);
        if (!granted) {
            setDarkStatus("목록 사이트 권한을 허용하지 않아 저장하지 않았어요.", true);
            return;
        }
    }
    await saveDarkConfig({...darkConfig, siteListMode: mode, siteList: hosts});
});
effects.storageOnChanged((changes: Record<string, {newValue?: unknown}>, area: string) => {
    if (area === "local" && changes[DARK_SETTINGS_KEY] && current === "dark") void loadDarkConfig();
});
const refreshDarkAccess = () => {if (current === 'dark') void loadDarkConfig();};
chrome.permissions.onAdded.addListener(refreshDarkAccess);
chrome.permissions.onRemoved.addListener(refreshDarkAccess);
void loadDarkConfig();

type GmailMessage = {
    id: string; thread: string; subject: string; snippet: string;
    fromName: string; fromEmail: string; issued: string; link: string;
};
type GmailAccount = {index: number; email: string; unread: number; enabled?: boolean; messages: GmailMessage[]};
type GmailSnapshot = {checkedAt?: number; loggedOut?: boolean; unread?: number; accounts?: GmailAccount[]};

let mailBadgeRevision = 0;
let mailBadgeDisabled: unknown = [];
let mailBadgeAccounts: GmailAccount[] | undefined;
let mailBadgeUnreadOverride: number | null = null;
const paintMailBadge = (accounts: GmailAccount[] | undefined, disabled: unknown) => {
    const badge = $("mailBadge");
    if (!badge) return;
    mailBadgeRevision += 1;
    if (accounts !== undefined) mailBadgeAccounts = accounts;
    if (Array.isArray(disabled)) mailBadgeDisabled = disabled;
    const text = mailBadgeUnreadOverride === null
        ? mailTabBadge(mailBadgeAccounts, Array.isArray(mailBadgeDisabled) ? mailBadgeDisabled : []) as string
        : mailBadgeUnreadOverride > 99 ? "99+" : mailBadgeUnreadOverride > 0 ? String(mailBadgeUnreadOverride) : "";
    badge.textContent = text;
    badge.hidden = !text;
};

const gmailStatus = $("gmailStatus");
const gmailList = $("gmailList");
const gmailAccounts = $("gmailAccounts");
const gmailAccount = $("gmailAccount");
const gmailEmpty = $("gmailEmpty");
const gmailEmptyTitle = $("gmailEmptyTitle");
const gmailEmptyNote = $("gmailEmptyNote");
const mailPanel = document.querySelector<HTMLElement>(".mail-panel");
const gmailSend = (message: Record<string, unknown>) => sendExtension(effects, message) as Promise<{
    snapshot?: GmailSnapshot | null; error?: string; ok?: boolean;
}>;

let gmailView: GmailSnapshot | null = null;
let gmailPhotos: Record<string, string> = {};
let gmailColors: Record<string, string> = {};
let mailOrder: string[] = [];
let mailAccountFilter = "";
let renderedMailAccounts: GmailAccount[] = [];
const ACCOUNT_ORDER_KEY = "gmail.accountOrder";
const MAIL_EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";

const saveMailOrder = () => {
    const order = [...gmailAccounts.querySelectorAll<HTMLElement>(".mail-section")]
        .map((section) => section.dataset.email || "")
        .filter(Boolean);
    mailOrder = order;
    void effects.storageSet({[ACCOUNT_ORDER_KEY]: order});
};

const openMailPlace = (account: GmailAccount, url?: string) => {
    void openGmailPlace(effects, {index: account.index, email: account.email, url});
};

const bindMailDrag = (section: HTMLElement, head: HTMLElement, account: GmailAccount) => {
    bindPointerReorder({
        handle: head,
        item: section,
        list: gmailAccounts,
        axis: "y",
        ignore: (target) => Boolean((target as Element | null)?.closest?.("button, a")),
        onClick: () => {
            mailAccountFilter = account.email.trim().toLowerCase();
            renderGmail(gmailView);
        },
        onDrop: () => saveMailOrder()
    });
};

const lineIcon = (d: string) => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("aria-hidden", "true");
    const mark = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mark.setAttribute("d", d);
    mark.setAttribute("fill", "none");
    mark.setAttribute("stroke", "currentColor");
    mark.setAttribute("stroke-width", "2.2");
    mark.setAttribute("stroke-linecap", "round");
    mark.setAttribute("stroke-linejoin", "round");
    icon.append(mark);
    return icon;
};

const renderGmail = (snapshot: GmailSnapshot | null | undefined, error = "") => {
    const view = preferInbox(snapshot, gmailView) as GmailSnapshot | null;
    if (view) gmailView = view;
    const accounts = orderAccounts(dedupeAccounts(view?.accounts || []), mailOrder) as GmailAccount[];
    renderedMailAccounts = accounts;
    if (mailAccountFilter && !accounts.some((item) => item.email.trim().toLowerCase() === mailAccountFilter)) mailAccountFilter = "";
    const unread = accounts.filter((item) => item.enabled !== false).reduce((sum, item) => sum + accountUnread(item), 0);
    gmailAccounts.replaceChildren();
    gmailList.replaceChildren();
    const allCount = accounts.reduce((sum, item) => sum + (item.messages || []).length, 0);
    const allButton = $<HTMLButtonElement>("mailAllAccounts");
    allButton.textContent = `전체 계정 · ${allCount}`;
    allButton.classList.toggle("active", !mailAccountFilter);
    for (const item of accounts) {
        const email = item.email || `계정 ${item.index + 1}`;
        const color = accountColor(email, gmailColors) as string;
        const section = document.createElement("section");
        section.className = "mail-section";
        section.dataset.email = (item.email || "").trim().toLowerCase();
        section.classList.toggle("selected", section.dataset.email === mailAccountFilter);
        section.style.setProperty("--account-accent", color);
        const head = document.createElement("div");
        head.className = "mail-head";
        head.title = "누르면 이 계정 메일만 보기, 끌면 순서 바꾸기";
        const avatar = document.createElement("span");
        avatar.className = "mail-avatar";
        const photo = gmailPhotos[email.toLowerCase()];
        if (photo) {
            const img = document.createElement("img");
            img.alt = "";
            img.src = photo;
            avatar.append(img);
        } else avatar.textContent = accountInitial(email) as string;
        const who = document.createElement("div");
        who.className = "mail-who";
        const title = document.createElement("strong");
        title.textContent = email;
        who.append(title);
        const count = document.createElement("span");
        count.className = "mail-count";
        const unreadCount = accountUnread(item);
        count.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        count.hidden = unreadCount <= 0;
        count.setAttribute("aria-label", `읽지 않은 메일 ${unreadCount}통`);
        const quick = document.createElement("div");
        quick.className = "mail-quick";
        const quickButton = (label: string, icon: Node, run: () => void) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "mail-quick-btn";
            button.title = label;
            button.setAttribute("aria-label", label);
            button.append(icon);
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                run();
            });
            quick.append(button);
            return button;
        };
        quickButton("새 메일", lineIcon("M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z"), () => openMailPlace(item, gmailComposeUrl(item.index, item.email)));
        quickButton("받은편지함 열기", lineIcon("M4 13h4l2 3h4l2-3h4v5H4zM4 13l2-7h12l2 7"), () => openMailPlace(item, gmailInboxUrl(item.index, item.email)));
        quickButton("이 계정 메일 검색", lineIcon("M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM17 17l4 4"), () => {
            mailAccountFilter = item.email.trim().toLowerCase();
            renderGmail(gmailView);
            requestAnimationFrame(() => $<HTMLInputElement>("mailSearch").focus());
        });
        const markAll = quickButton("모두 읽음", lineIcon("M5 12.5 9.2 17 19 7"), () => void readAccount(item.index));
        markAll.disabled = !(item.messages || []).length;
        head.append(avatar, who, count, quick);
        section.append(head);
        bindMailDrag(section, head, item);
        gmailAccounts.appendChild(section);
    }
    const messages = accounts.reduce((sum, item) => sum + (item.messages || []).length, 0);
    const query = $<HTMLInputElement>("mailSearch").value.trim().toLocaleLowerCase();
    const sort = $<HTMLSelectElement>("mailSort").value;
    const rows = accounts.flatMap((account) => (account.messages || []).map((message) => ({account, message})))
        .filter(({account}) => !mailAccountFilter || account.email.trim().toLowerCase() === mailAccountFilter)
        .filter(({account, message}) => !query || `${account.email} ${message.subject} ${message.snippet} ${message.fromName} ${message.fromEmail}`.toLocaleLowerCase().includes(query))
        .sort((a, b) => {
            if (sort === "sender") return String(a.message.fromName || a.message.fromEmail).localeCompare(String(b.message.fromName || b.message.fromEmail));
            const diff = (Date.parse(a.message.issued || "") || 0) - (Date.parse(b.message.issued || "") || 0);
            return sort === "oldest" ? diff : -diff;
        });
    for (const {account, message} of rows) {
        const email = account.email || `계정 ${account.index + 1}`;
        const row = document.createElement("li");
        row.className = "mail-item";
        row.tabIndex = 0;
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", `${message.subject || "제목 없음"} · ${message.fromName || message.fromEmail || "보낸 사람 확인 불가"} · ${email} · Enter 키로 열기`);
        row.style.setProperty("--account-accent", accountColor(email, gmailColors) as string);
        const accountAvatar = document.createElement("span");
        accountAvatar.className = "mail-row-avatar";
        const photo = gmailPhotos[email.toLowerCase()];
        if (photo) {
            const img = document.createElement("img");
            img.alt = "";
            img.src = photo;
            accountAvatar.append(img);
        } else accountAvatar.textContent = accountInitial(email) as string;
        const body = document.createElement("div");
        body.className = "mail-body";
        const firstLine = document.createElement("div");
        firstLine.className = "mail-sender-line";
        const sender = mailSenderLines(message) as {name: string; email: string};
        const from = document.createElement("strong");
        from.className = "mail-from";
        from.textContent = sender.name || sender.email || "보낸 사람 확인 불가";
        const accountTag = document.createElement("span");
        accountTag.className = "mail-account-tag";
        accountTag.textContent = email;
        firstLine.append(from, accountTag);
        const subject = document.createElement("strong");
        subject.className = "mail-subject";
        subject.textContent = message.subject || "(제목 없음)";
        const snippet = document.createElement("p");
        snippet.className = "mail-snippet";
        snippet.textContent = message.snippet || "내용 미리보기가 없어요.";
        const time = document.createElement("time");
        if (message.issued) time.dateTime = message.issued;
        time.textContent = formatMailTime(message.issued) as string;
        const actions = document.createElement("div");
        actions.className = "mail-actions";
        const add = (label: string, run: () => void) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.title = label;
            button.addEventListener("click", (event) => { event.stopPropagation(); run(); });
            actions.appendChild(button);
        };
        add("읽음", () => void runGmailAct(account.index, message, "read"));
        add("보관", () => void runGmailAct(account.index, message, "archive"));
        add("삭제", () => void runGmailAct(account.index, message, "trash"));
        add("답장", () => {
            const url = new URL("https://mail.google.com/mail/");
            url.searchParams.set("view", "cm");
            url.searchParams.set("fs", "1");
            url.searchParams.set("tf", "1");
            if (message.fromEmail) url.searchParams.set("to", message.fromEmail);
            url.searchParams.set("su", message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`);
            openMailPlace(account, `https://mail.google.com/mail/u/${account.index}/${url.search}${account.email ? `${url.search ? "&" : "?"}authuser=${encodeURIComponent(account.email)}` : ""}`);
        });
        const openMessage = () => openMailPlace(account, gmailMessageUrl(account.index, account.email, message.link, message.thread));
        row.addEventListener("click", (event) => { if (!(event.target as Element).closest("button")) openMessage(); });
        row.addEventListener("keydown", (event) => {
            if ((event.key === "Enter" || event.key === " ") && !(event.target as Element).closest("button")) {
                event.preventDefault();
                openMessage();
            }
        });
        body.append(firstLine, subject, snippet);
        row.append(accountAvatar, body, time, actions);
        gmailList.appendChild(row);
    }
    const loggedOut = Boolean(view?.loggedOut);
    const showAccounts = accounts.length > 0 && !loggedOut;
    const showMail = rows.length > 0 && showAccounts;
    const gmailQuiet = $("gmailQuiet");
    if (mailPanel) {
        mailPanel.classList.toggle("is-empty", !showMail && !showAccounts && !error);
        mailPanel.classList.toggle("has-accounts", showAccounts);
    }
    gmailAccounts.hidden = !showAccounts;
    $("gmailAddAccount").hidden = !showAccounts;
    gmailList.hidden = !showMail;
    document.querySelector<HTMLElement>(".mail-account-toolbar")!.hidden = !showAccounts;
    document.querySelector<HTMLElement>(".mail-list-toolbar")!.hidden = !showAccounts;
    gmailEmpty.hidden = showAccounts || Boolean(error);
    gmailQuiet.hidden = !showAccounts || showMail || Boolean(error);
    if (showAccounts && !showMail) gmailQuiet.textContent = query ? "검색 결과가 없어요." : mailAccountFilter ? "선택한 계정에 읽지 않은 메일이 없어요." : "읽지 않은 메일이 없어요. 계정은 위에 그대로 있어요.";
    gmailStatus.hidden = !error;
    if (error) gmailStatus.textContent = error;
    else if (loggedOut) {
        gmailEmpty.hidden = false;
        gmailEmptyTitle.textContent = "Gmail에 로그인되어 있지 않아요";
        gmailEmptyNote.textContent = "브라우저에서 Gmail에 로그인한 뒤 오른쪽 위 새로고침을 눌러 주세요.";
    } else if (!showAccounts) {
        gmailEmpty.hidden = false;
        gmailEmptyTitle.textContent = "읽지 않은 메일이 없어요";
        gmailEmptyNote.textContent = "새 메일이 오면 여기에 나와요.";
    } else gmailStatus.textContent = "";
    const selected = accounts.find((item) => item.email.trim().toLowerCase() === mailAccountFilter);
    gmailAccount.textContent = showAccounts
        ? (selected ? `${selected.email} · ${Number(selected.unread) || 0}통` : `${accounts.length}개 계정 · ${unread}통`)
        : "";
    paintMailBadge(accounts, accounts.filter((item) => item.enabled === false).map((item) => item.index));
    paintSoundAccounts(accounts);
};

const refreshGmail = async (force: boolean) => {
    if (!gmailAccounts.childElementCount) {
        gmailStatus.hidden = false;
        gmailStatus.textContent = "확인 중…";
        gmailEmpty.hidden = true;
    }
    try {
        const result = await gmailSend({type: force ? "gmail-refresh" : "gmail-get"});
        renderGmail(result?.snapshot, result?.error || "");
    } catch (error) {
        gmailStatus.textContent = (error as Error)?.message || "메일을 확인하지 못했어요.";
    }
};

const readAccount = async (account: number) => {
    gmailStatus.hidden = false;
    gmailStatus.textContent = "모두 읽음으로 바꾸는 중…";
    try {
        const result = await gmailReadAccount(effects, account) as {ok?: boolean; error?: string; snapshot?: GmailSnapshot | null};
        if (!result?.ok) gmailStatus.textContent = result?.error || "메일을 바꾸지 못했어요.";
        renderGmail(result?.snapshot, result?.ok ? "" : (result?.error || ""));
    } catch (error) {
        gmailStatus.textContent = (error as Error)?.message || "메일을 바꾸지 못했어요.";
    }
};

const runGmailAct = async (account: number, message: GmailMessage, action: string) => {
    gmailStatus.hidden = false;
    gmailStatus.textContent = "Gmail에 반영하는 중…";
    try {
        const result = await gmailSend({type: "gmail-act", account, thread: message.thread, action});
        if (!result?.ok) gmailStatus.textContent = result?.error || "Gmail에 반영하지 못했어요.";
        renderGmail(result?.snapshot, result?.ok ? "" : (result?.error || ""));
    } catch (error) {
        gmailStatus.textContent = (error as Error)?.message || "Gmail에 반영하지 못했어요.";
    }
};

$("gmailRefresh").addEventListener("click", () => void refreshGmail(true));
$("gmailRecheck").addEventListener("click", () => void refreshGmail(true));
$("mailAllAccounts").addEventListener("click", () => {
    mailAccountFilter = "";
    renderGmail(gmailView);
});
$<HTMLInputElement>("mailSearch").addEventListener("input", () => renderGmail(gmailView));
$<HTMLSelectElement>("mailSort").addEventListener("change", () => renderGmail(gmailView));
$("mailClearSearch").addEventListener("click", () => {
    $<HTMLInputElement>("mailSearch").value = "";
    renderGmail(gmailView);
});
const gmailSound = $("gmailSound");
const mailSettings = $("mailSettings");
const gmailSettingsToggle = $<HTMLButtonElement>("gmailSettingsToggle");
const setMailSettingsOpen = (open: boolean) => {
    mailSettings.hidden = !open;
    gmailSound.hidden = !open;
    gmailSettingsToggle.setAttribute("aria-expanded", String(open));
};
gmailSettingsToggle.addEventListener("click", () => setMailSettingsOpen(Boolean(mailSettings.hidden)));
if (embed === "gmail") setMailSettingsOpen(true);
$("gmailCompose").addEventListener("click", () => {
    const account = renderedMailAccounts.find((item) => item.email.trim().toLowerCase() === mailAccountFilter) || renderedMailAccounts[0];
    if (account) openMailPlace(account, gmailComposeUrl(account.index, account.email));
    else void effects.tabsCreate({url: "https://mail.google.com/mail/"});
});
$("gmailOpen").addEventListener("click", () => {
    const account = renderedMailAccounts.find((item) => item.email.trim().toLowerCase() === mailAccountFilter) || renderedMailAccounts[0];
    if (account) openMailPlace(account, gmailInboxUrl(account.index, account.email));
    else void effects.tabsCreate({url: "https://mail.google.com/mail/"});
});
$("gmailAddAccount").addEventListener("click", () => {
    const continueUrl = encodeURIComponent("https://mail.google.com/mail/u/0/");
    void effects.tabsCreate({url: `https://accounts.google.com/AccountChooser?service=mail&continue=${continueUrl}`});
});

const soundState = {...defaultSound()};
const paintSoundAccounts = (accounts: GmailAccount[]) => {
    const colors = gmailSound.querySelector(".mail-account-colors");
    if (!colors) return;
    colors.replaceChildren();
    for (const item of accounts) {
        const email = (item.email || "").toLowerCase();
        if (!email) continue;
        const row = document.createElement("div");
        row.className = "be-row";
        const name = document.createElement("span");
        name.textContent = item.email;
        const alert = document.createElement("label");
        alert.className = "mail-alert";
        const alertText = document.createElement("span");
        alertText.textContent = "알림";
        const alertToggle = document.createElement("input");
        alertToggle.type = "checkbox";
        alertToggle.checked = item.enabled !== false;
        alertToggle.setAttribute("aria-label", `${item.email} 알림`);
        alertToggle.addEventListener("change", () => void saveGmailAccount(item.index, alertToggle.checked));
        alert.append(alertText, alertToggle);
        const picks = document.createElement("div");
        picks.className = "mail-colors";
        const current = accountColor(email, gmailColors) as string;
        for (const color of ACCOUNT_COLORS as string[]) {
            const button = document.createElement("button");
            button.type = "button";
            button.style.background = color;
            button.classList.toggle("on", color === current);
            button.title = "이 계정 색";
            button.setAttribute("aria-label", `${item.email} 색`);
            button.addEventListener("click", () => {
                gmailColors = {...gmailColors, [email]: color};
                void effects.storageSet({["gmail.accountColors"]: gmailColors});
                renderGmail(gmailView);
            });
            picks.append(button);
        }
        row.append(name, alert, picks);
        colors.append(row);
    }
};
{
    const title = document.createElement("h4");
    title.textContent = "새 메일 소리";
    const onRow = document.createElement("label");
    const onText = document.createElement("span");
    onText.textContent = "소리 켜기";
    const onToggle = document.createElement("input");
    onToggle.type = "checkbox";
    onToggle.checked = true;
    onToggle.setAttribute("role", "switch");
    onToggle.setAttribute("aria-label", "새 메일 소리");
    onRow.append(onText, onToggle);
    const nameRow = document.createElement("label");
    const nameText = document.createElement("span");
    nameText.textContent = "소리";
    const nameSelect = document.createElement("select");
    nameSelect.setAttribute("aria-label", "알림 소리");
    for (const name of SOUND_NAMES as string[]) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = (SOUND_LABELS as Record<string, string>)[name];
        nameSelect.append(option);
    }
    nameRow.append(nameText, nameSelect);
    const volumeRow = document.createElement("label");
    const volumeText = document.createElement("span");
    volumeText.textContent = "크기";
    const volume = document.createElement("input");
    volume.type = "range";
    volume.min = "0";
    volume.max = "100";
    volume.value = "40";
    volume.setAttribute("aria-label", "알림 소리 크기");
    volumeRow.append(volumeText, volume);
    const preview = document.createElement("button");
    preview.type = "button";
    preview.textContent = "미리 듣기";
    const colors = document.createElement("div");
    colors.className = "mail-account-colors";
    const saveSound = () => {
        soundState.on = onToggle.checked;
        soundState.name = nameSelect.value;
        soundState.volume = Number(volume.value) / 100;
        void effects.storageSet({[GMAIL_SOUND_KEY]: {...soundState}});
    };
    const playPreview = async () => {
        saveSound();
        const played = await sendExtension(effects, {type: "gmail-play-sound", name: soundState.name, volume: soundState.volume}).catch(() => null) as {ok?: boolean} | null;
        if (played?.ok) return;
        const audio = new Audio(effects.getURL(soundFile(soundState.name)));
        audio.volume = soundState.volume;
        await audio.play().catch(() => {});
    };
    onToggle.addEventListener("change", saveSound);
    nameSelect.addEventListener("change", saveSound);
    volume.addEventListener("change", saveSound);
    preview.addEventListener("click", () => void playPreview());
    const colorTitle = document.createElement("h4");
    colorTitle.textContent = "계정 알림과 색";
    gmailSound.append(title, onRow, nameRow, volumeRow, preview, colorTitle, colors);
    void effects.storageGet(GMAIL_SOUND_KEY).then((stored: Record<string, unknown>) => {
        const sound = normalizeSound(stored[GMAIL_SOUND_KEY]) as {on: boolean; name: string; volume: number};
        Object.assign(soundState, sound);
        onToggle.checked = sound.on;
        nameSelect.value = sound.name;
        volume.value = String(Math.round(sound.volume * 100));
    });
}
void effects.storageGet(["gmail.photos", "gmail.accountColors"]).then((stored: Record<string, unknown>) => {
    gmailPhotos = (stored["gmail.photos"] || {}) as Record<string, string>;
    gmailColors = (stored["gmail.accountColors"] || {}) as Record<string, string>;
    if (gmailView) renderGmail(gmailView);
});
$("gmailLatency").textContent = "Gmail 탭이 없어도 로그인된 계정을 모두 확인해요. 기본 8초마다 받은편지함 피드만 보고, 자리를 비우거나 화면이 잠기면 더 천천히 봐요. 알림을 끄면 확인을 멈춰요. 한 계정의 알림만 빼려면 설정 화면의 메일에서 그 계정 알림을 끄세요. 다른 계정을 더하려면 Gmail 오른쪽 위 프로필 사진에서 계정 추가로 로그인하세요. 그러면 여기 목록에 나타나요. 답장은 Gmail 창에서 보내야 보낸편지함과 같아요.";

const gmailInterval = $<HTMLInputElement>("gmailInterval");
const gmailNotify = $<HTMLInputElement>("gmailNotify");
const saveGmailWatch = async () => {
    const seconds = Math.min(60, Math.max(5, Number(gmailInterval.value) || 8));
    gmailInterval.value = String(seconds);
    const stored = await effects.storageGet("gmail.disabled");
    await sendExtension(effects, {
        type: "gmail-config",
        notify: gmailNotify.checked,
        intervalMs: seconds * 1000,
        disabled: Array.isArray(stored["gmail.disabled"]) ? stored["gmail.disabled"] : []
    });
};
const saveGmailAccount = async (index: number, enabled: boolean) => {
    const stored = await effects.storageGet("gmail.disabled");
    const disabled = new Set<number>(Array.isArray(stored["gmail.disabled"]) ? stored["gmail.disabled"] : []);
    if (enabled) disabled.delete(index);
    else disabled.add(index);
    await sendExtension(effects, {
        type: "gmail-config",
        notify: gmailNotify.checked,
        intervalMs: Number(gmailInterval.value) * 1000,
        disabled: [...disabled]
    });
    void refreshGmail(true);
};
gmailInterval.addEventListener("change", () => void saveGmailWatch());
gmailNotify.addEventListener("change", () => void saveGmailWatch());
effects.storageGet(ACCOUNT_ORDER_KEY).then((stored: Record<string, unknown>) => {
    mailOrder = Array.isArray(stored[ACCOUNT_ORDER_KEY]) ? stored[ACCOUNT_ORDER_KEY] as string[] : [];
    if (gmailView) renderGmail(gmailView);
});
const mailBadgeReadRevision = mailBadgeRevision;
effects.storageGet(["gmail.snapshot", "gmail.disabled", "gmail.unread", "core.mailUnreadTotal"]).then((stored: Record<string, unknown>) => {
    if (mailBadgeRevision !== mailBadgeReadRevision) return;
    const snapshot = stored["gmail.snapshot"] as GmailSnapshot | undefined;
    const unread = Number(stored["core.mailUnreadTotal"] ?? stored["gmail.unread"]);
    mailBadgeUnreadOverride = Number.isFinite(unread) && unread >= 0 ? Math.floor(unread) : null;
    paintMailBadge(snapshot?.accounts, stored["gmail.disabled"]);
});
effects.storageGet(["gmail.intervalMs", "gmail.notify"]).then((stored: Record<string, unknown>) => {
    if (typeof stored["gmail.intervalMs"] === "number") gmailInterval.value = String(Math.round(stored["gmail.intervalMs"] / 1000));
    gmailNotify.checked = stored["gmail.notify"] !== false;
});
effects.storageOnChanged((changes: Record<string, {newValue?: unknown}>, area: string) => {
    if (area !== "local") return;
    if (changes["core.modules"]) {
        if (current === "update") void paintModuleOptions();
        void paintCurrentModuleState();
    }
    if (changes["gmail.photos"]) gmailPhotos = (changes["gmail.photos"].newValue || {}) as Record<string, string>;
    if (changes["gmail.accountColors"]) gmailColors = (changes["gmail.accountColors"].newValue || {}) as Record<string, string>;
    if (changes[GMAIL_SOUND_KEY]) {
        const sound = normalizeSound(changes[GMAIL_SOUND_KEY].newValue) as {on: boolean; name: string; volume: number};
        const box = $("gmailSound");
        const toggle = box.querySelector<HTMLInputElement>("input[type=checkbox]");
        const select = box.querySelector<HTMLSelectElement>("select");
        const range = box.querySelector<HTMLInputElement>("input[type=range]");
        if (toggle) toggle.checked = sound.on;
        if (select) select.value = sound.name;
        if (range) range.value = String(Math.round(sound.volume * 100));
    }
    if (changes["gmail.accountOrder"]) {
        mailOrder = Array.isArray(changes["gmail.accountOrder"].newValue) ? changes["gmail.accountOrder"].newValue as string[] : [];
        if ((current === "gmail" || embed === "gmail") && gmailView && !gmailAccounts.classList.contains("reordering")) renderGmail(gmailView);
    }
    if (changes["core.mailUnreadTotal"] || changes["gmail.unread"]) {
        void effects.storageGet(["core.mailUnreadTotal", "gmail.unread"]).then((stored: Record<string, unknown>) => {
            const unread = Number(stored["core.mailUnreadTotal"] ?? stored["gmail.unread"]);
            mailBadgeUnreadOverride = Number.isFinite(unread) && unread >= 0 ? Math.floor(unread) : null;
            paintMailBadge(undefined, mailBadgeDisabled);
        });
    }
    if (changes["gmail.snapshot"] || changes["gmail.disabled"]) {
        const snapshot = changes["gmail.snapshot"]?.newValue as GmailSnapshot | undefined;
        const disabled = changes["gmail.disabled"] ? changes["gmail.disabled"].newValue : mailBadgeDisabled;
        paintMailBadge(snapshot?.accounts, disabled);
    }
    if ((changes["gmail.snapshot"] || changes["gmail.photos"] || changes["gmail.accountColors"]) && (current === "gmail" || embed === "gmail")) {
        renderGmail((changes["gmail.snapshot"]?.newValue as GmailSnapshot) || gmailView);
    }
    if (changes["fx.table"]) paintFxBadge((changes["fx.table"].newValue as FxTable | undefined)?.rates);
    if (changes["core.update:available"]) {
        const on = changes["core.update:available"].newValue === true;
        $("updateDot").hidden = !on;
        const notice = $("updateNotice");
        notice.hidden = !on;
        if (on && !notice.textContent) notice.textContent = "새 버전이 있어요. 아래에서 받을 수 있어요.";
        if (!on) notice.textContent = "";
    }
    if (changes[FX_ORDER_KEY] && !fxMore.classList.contains("reordering")) {
        fxCardOrder = Array.isArray(changes[FX_ORDER_KEY].newValue) ? changes[FX_ORDER_KEY].newValue as string[] : [];
        if (fxTable && (current === "fx" || embed === "fx")) renderFx();
    }
});

type FxTable = {base: string; date: string; rates: Record<string, number>; fetchedAt: number};
const downloadBadge = $("downloadBadge");
const DOWNLOAD_SEEN_KEY = "core.downloadsLastSeen";
let downloadBadgeRequest=0;
async function acknowledgeDownloads() {
    downloadBadgeRequest++;
    await chrome.storage.local.set({[DOWNLOAD_SEEN_KEY]: Date.now()});
    paintDownloadBadge(0);
}
const paintDownloadBadge = (count: number) => {
    const text = completedDownloadsBadge(count) as string;
    downloadBadge.textContent = text;
    downloadBadge.hidden = !text;
};
const refreshDownloadBadge = async () => {
    const request=++downloadBadgeRequest;
    try {
        const stored = await chrome.storage.local.get([DOWNLOAD_SEEN_KEY, VIDEO_HISTORY_KEY]);
        let seen = Number(stored[DOWNLOAD_SEEN_KEY]);
        if (!Number.isFinite(seen) || seen <= 0) {
            seen = Date.now();
            await chrome.storage.local.set({[DOWNLOAD_SEEN_KEY]: seen});
        }
        if (current === "download") { await acknowledgeDownloads(); return; }
        const completed = await chrome.downloads.search({state: "complete", endedAfter: new Date(seen).toISOString()});
        if(request===downloadBadgeRequest)paintDownloadBadge(completed.length + unseenVideos(stored[VIDEO_HISTORY_KEY], seen));
    } catch {
        if(request===downloadBadgeRequest)paintDownloadBadge(0);
    }
};
void refreshDownloadBadge();
chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state?.current === "complete" || delta.state?.previous === "complete") void refreshDownloadBadge();
});
chrome.downloads.onErased.addListener(() => void refreshDownloadBadge());

const FX_KEY = "fx.table";
const fxAmount = $<HTMLInputElement>("fxAmount");
const fxFrom = $<HTMLSelectElement>("fxFrom");
const fxTo = $<HTMLSelectElement>("fxTo");
const fxResult = $("fxResult");
const fxMore = $("fxMore");
const fxStatus = $("fxStatus");
let fxTable: FxTable | null = null;
let fxCardOrder: string[] = [];
let fxSelected: unknown = null;
let fxDragged = false;
let fxFormReady = false;
let savedForm = normalizeFxForm(null) as {amount: string; from: string; to: string};

const rememberFxForm = () => {
    savedForm = normalizeFxForm({amount: fxAmount.value, from: fxFrom.value, to: fxTo.value}) as {amount: string; from: string; to: string};
    if (!fxFormReady) return;
    void effects.storageSet({[FX_FORM_KEY]: savedForm});
};

const paintUnitIcons = () => {
    const paint = (id: string, code: string) => {
        const img = $<HTMLImageElement>(id);
        if (!img) return;
        const path = currencyIconPath(code) as string;
        if (!path) {
            img.hidden = true;
            img.removeAttribute("src");
            return;
        }
        img.hidden = false;
        img.src = effects.getURL(path);
    };
    paint("fxFromIcon", fxFrom.value);
    paint("fxToIcon", fxTo.value);
};

const paintFxBadge = (rates: Record<string, number> | undefined) => {
    const badge = $("fxBadge");
    if (!badge) return;
    const text = fxTabBadge(rates) as string;
    badge.textContent = text;
    badge.hidden = !text;
};

const fxSurface = () => window.matchMedia("(prefers-color-scheme: light)").matches ? "#ffffff" : "#2c2c2e";

const fillFxSelects = (codes: string[]) => {
    const have = new Set(codes);
    const ordered = [...(COMMON_CODES as string[]).filter((code) => have.has(code)), ...codes.filter((code) => !(COMMON_CODES as string[]).includes(code)).sort()];
    const form = normalizeFxForm({amount: savedForm.amount, from: savedForm.from, to: savedForm.to}, ordered) as {amount: string; from: string; to: string};
    for (const select of [fxFrom, fxTo]) {
        select.replaceChildren();
        for (const code of ordered) {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = currencyLabel(code);
            select.appendChild(option);
        }
    }
    fxAmount.value = form.amount;
    fxFrom.value = ordered.includes(form.from) ? form.from : ordered[0] || "";
    fxTo.value = ordered.includes(form.to) ? form.to : (ordered.find((code) => code !== fxFrom.value) || ordered[0] || "");
    savedForm = {amount: fxAmount.value, from: fxFrom.value, to: fxTo.value};
    paintUnitIcons();
};

const renderFx = () => {
    paintFxBadge(fxTable?.rates);
    fxMore.replaceChildren();
    if (!fxTable) {
        fxResult.textContent = "환율표를 아직 받지 못했어요.";
        return;
    }
    const amount = Number(fxAmount.value);
    const value = convertAmount(amount, fxFrom.value, fxTo.value, fxTable.rates);
    fxResult.textContent = value == null ? "이 통화는 표에 없어요." : `${formatMoney(amount, fxFrom.value)} ${fxFrom.value.toUpperCase()} = ${formatMoney(value, fxTo.value)} ${fxTo.value.toUpperCase()}`;
    const surface = fxSurface();
    for (const code of orderCurrencyCards(selectedCurrencyCards(fxSelected, availableCurrencyCodes(fxTable.rates)), fxCardOrder) as string[]) {
        const other = convertAmount(amount, fxFrom.value, code, fxTable.rates);
        if (other == null) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fx-chip";
        button.dataset.code = code;
        button.title = "누르면 이 통화로 비교 · 끌어서 순서 바꾸기";
        button.setAttribute("aria-pressed", String(code === fxTo.value));
        if (code === fxTo.value) button.classList.add("on");
        const flag = currencyColor(code) as string;
        button.style.setProperty("--fx-flag", flag);
        button.style.background = composite(flag, surface, CURRENCY_TINT) as string;
        const top = document.createElement("span");
        top.className = "fx-chip-top";
        const icon = document.createElement("img");
        icon.className = "fx-flag";
        icon.alt = "";
        const iconPath = currencyIconPath(code) as string;
        if (iconPath) icon.src = effects.getURL(iconPath);
        else icon.hidden = true;
        const names = document.createElement("span");
        names.className = "fx-chip-names";
        const name = document.createElement("small");
        name.textContent = currencyName(code) as string;
        const iso = document.createElement("em");
        iso.className = "fx-code";
        iso.textContent = currencyCode(code) as string;
        names.append(name, iso);
        top.append(icon, names);
        const money = document.createElement("b");
        money.textContent = formatMoney(other, code);
        button.append(top, money);
        bindPointerReorder({
            handle: button,
            item: button,
            list: fxMore,
            axis: "y",
            onClick: () => {
                if ([...fxTo.options].some((option) => option.value === code)) fxTo.value = code;
                rememberFxForm();
                renderFx();
            },
            onDrop: () => {
                fxDragged = true;
                setTimeout(() => { fxDragged = false; }, 0);
                fxCardOrder = [...fxMore.querySelectorAll<HTMLElement>("[data-code]")].map((el) => el.dataset.code || "").filter(Boolean);
                void effects.storageSet({[FX_ORDER_KEY]: fxCardOrder});
            }
        });
        fxMore.appendChild(button);
    }
    if (!fxMore.childElementCount) fxMore.textContent="표시할 통화를 추가해 주세요.";
    paintUnitIcons();
    fxStatus.textContent = fxTable.date ? `${fxTable.date} 시세 · 팝업이 열려 있는 동안 자주 다시 받아요` : "팝업이 열려 있는 동안 자주 다시 받아요";
};

const refreshFx = async () => {
    const stored = await effects.storageGet(FX_KEY);
    const cached = stored[FX_KEY] as FxTable | undefined;
    const showCached = (note = "") => {
        if (!cached?.rates) return false;
        fxTable = cached;
        fillFxSelects(Object.keys(cached.rates).sort());
        renderFx();
        if (note) fxStatus.textContent = note;
        return true;
    };
    if (cached?.rates && !shouldRefreshRates(cached.fetchedAt, Date.now(), FX_POPUP_REFRESH_MS)) {
        showCached();
        return;
    }
    if (!fxTable) fxStatus.textContent = "환율표를 받는 중…";
    try {
        const parsed = parseRatePayload(await loadJson(effects, FX_URL)) as FxTable | null;
        if (!parsed) throw new Error("표 형식");
        fxTable = parsed;
        await effects.storageSet({[FX_KEY]: parsed});
        fillFxSelects(Object.keys(parsed.rates).sort());
        renderFx();
        paintFxBadge(parsed.rates);
    } catch (error) {
        if (showCached("새 시세를 받지 못해 저장해 둔 표를 보여 줘요.")) return;
        fxResult.textContent = "환율표를 받지 못했어요.";
        fxStatus.textContent = (error as Error)?.message || "";
    }
};

const rightClick = $<HTMLButtonElement>("rightClick");
const paintRightClick = (on: boolean) => {
    rightClick.classList.toggle("on", on);
    rightClick.setAttribute("aria-pressed", on ? "true" : "false");
    rightClick.title = on
        ? "이 사이트에서 오른쪽 클릭을 되살리고 있어요. 누르면 꺼요."
        : "이 사이트에서 오른쪽 클릭, 복사, 글자 선택을 되살려요.";
};
const activePage = async () => {
    const [tab] = await effects.tabsQuery({active: true, currentWindow: true});
    return tab;
};
const syncRightClick = async () => {
    const tab = await activePage();
    const result = await sendExtension(effects, {type: "right-click-state", url: tab?.url || ""}) as {on?: boolean};
    paintRightClick(Boolean(result?.on));
};
rightClick.addEventListener("click", async () => {
    const tab = await activePage();
    if (!tab?.id || !tab.url) return;
    const state = await sendExtension(effects, {type: "right-click-state", url: tab.url}) as {on?: boolean; origin?: string};
    if (!state?.origin) {
        rightClick.title = "이 페이지에서는 오른쪽 클릭을 바꿀 수 없어요.";
        return;
    }
    const enable = !state.on;
    let persist = true;
    if (enable) {
        try {
            persist = await effects.permissionsRequest({origins: [`${state.origin}/*`]});
            if (!persist) rightClick.title = "이번 탭만 적용했어요. 다음 방문에도 쓰려면 사이트 권한을 허용해 주세요.";
        } catch {
            persist = false;
            rightClick.title = "이번 탭만 적용했어요.";
        }
    } else {
        try { await effects.permissionsRemove({origins: [`${state.origin}/*`]}); } catch { /* 이미 없는 권한 */ }
    }
    const result = await sendExtension(effects, {type: "right-click-apply", tabId: tab.id, url: tab.url, enabled: enable, persist}) as {ok?: boolean; on?: boolean; error?: string};
    if (!result?.ok) {
        rightClick.title = result?.error || "적용하지 못했어요.";
        return;
    }
    paintRightClick(Boolean(result.on));
});
void syncRightClick();

fxAmount.addEventListener("input", () => { rememberFxForm(); renderFx(); });
fxFrom.addEventListener("change", () => { rememberFxForm(); renderFx(); });
fxTo.addEventListener("change", () => { rememberFxForm(); renderFx(); });
$("fxSwap").addEventListener("click", () => {
    const next = fxFrom.value;
    fxFrom.value = fxTo.value;
    fxTo.value = next;
    rememberFxForm();
    renderFx();
});
window.setInterval(() => {
    if (document.visibilityState === "hidden") return;
    void refreshFx();
}, FX_POPUP_REFRESH_MS);
openQuoteStream({
    WebSocket: globalThis.WebSocket,
    onTable(table: FxTable & {source?: string}) {
        fxTable = mergeRateTables(fxTable, table) as FxTable;
        void effects.storageSet({[FX_KEY]: fxTable});
        fillFxSelects(availableCurrencyCodes(fxTable!.rates));
        renderFx();
        paintFxBadge(table.rates);
        if (table.source === "tradingview") fxStatus.textContent = "주요 통화는 트레이딩뷰 실시간 시세, 나머지는 일일 시세예요.";
    },
    onError() { void refreshFx(); }
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (fxTable) renderFx(); });
effects.storageGet([FX_KEY, FX_DAILY_KEY, FX_ORDER_KEY, FX_FORM_KEY, FX_SELECTED_KEY]).then((stored: Record<string, unknown>) => {
    const cached = stored[FX_KEY] as FxTable | undefined;
    fxSelected = stored[FX_SELECTED_KEY];
    fxCardOrder = Array.isArray(stored[FX_ORDER_KEY]) ? stored[FX_ORDER_KEY] as string[] : [];
    savedForm = normalizeFxForm(stored[FX_FORM_KEY]) as {amount: string; from: string; to: string};
    fxAmount.value = savedForm.amount;
    fxFormReady = true;
    paintFxBadge(cached?.rates);
    if (cached?.rates) {
        const full = mergeRateTables(stored[FX_DAILY_KEY] as FxTable | undefined, cached) as FxTable;
        fxTable = fxTable ? mergeRateTables(full, fxTable) as FxTable : full;
        fillFxSelects(Object.keys(fxTable.rates).sort());
        renderFx();
    }
});

setupCurrencyPicker(()=>availableCurrencyCodes(fxTable?.rates),()=>selectedCurrencyCards(fxSelected, availableCurrencyCodes(fxTable?.rates)),codes=>{
    fxSelected=codes;void effects.storageSet({[FX_SELECTED_KEY]:codes});renderFx();
});
setupMailSettings();

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-download-view]")) {
    button.addEventListener("click", async () => {
        if (button.dataset.downloadView === "/pop/sniffer.html") {
            const granted = await chrome.permissions.request({permissions: ["webRequest"], origins: ["http://*/*", "https://*/*"]}).catch(() => false);
            if (!granted) return;
            await chrome.storage.local.set({"chrono.siteAccess": true});
        }
        await chrome.storage.local.set({"core.chronoPopup": button.dataset.downloadView});
        await showTab("download", false);
    });
}
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes["core.chronoPopup"] && current === "download") void showTab("download", false);
    const next = changes["core.popupTab"]?.newValue;
    if (typeof next === "string" && next !== current && TAB_IDS.includes(next as TabId)) void showTab(next as TabId, false);
});

async function openVideoDownloader(url?: string) {
 const base=chrome.runtime.getURL('/video-downloader.html');
 const tabs=await chrome.tabs.query({});
 const existing=tabs.find(tab=>tab.url===base || tab.url?.startsWith(base+'?'));
 const stored=await chrome.storage.local.get(VIDEO_STATUS_KEY);
 const target=base+(url?'?url='+encodeURIComponent(url):'');
 if(existing?.id){
  await chrome.tabs.update(existing.id,{active:true,...(url && !videoInProgress(stored[VIDEO_STATUS_KEY])?{url:target}:{})});
  if(typeof existing.windowId==='number')await chrome.windows.update(existing.windowId,{focused:true});
 }else await chrome.tabs.create({url:target});
}
$("videoDownloader").addEventListener("click",()=>void openVideoDownloader());
$("videoStatusOpen").addEventListener("click",()=>void openVideoDownloader());

let renderedVideoHistory='';
async function refreshVideoActivity(){
 const stored=await chrome.storage.local.get([VIDEO_STATUS_KEY,VIDEO_HISTORY_KEY]);
 const state=stored[VIDEO_STATUS_KEY] as {type?:string;percent?:number}|undefined, history=videoHistory(stored[VIDEO_HISTORY_KEY]) as Array<{id:string;filename:string;completedAt:number}>;
 const busy=videoInProgress(state), panel=$("videoActivity");
 panel.hidden=!busy && !history.length;
 $("videoHistoryCount").textContent=history.length?`${history.length}개`:'';
 $("videoActivityStatus").textContent=busy?(state?.type==='progress'?`받는 중 ${Math.floor(state.percent || 0)}% · 영상·음성 병합까지 기다려 주세요.`:'영상 정보를 확인하고 있어요…'):'PC에 저장한 영상이에요. 경로를 복사해 파일 탐색기에 붙여 넣을 수 있어요.';
 $("videoStatusOpen").textContent=busy?'진행 상황 열기':'영상 받기 열기';
 const signature=JSON.stringify(history);
 if(signature===renderedVideoHistory)return;
 renderedVideoHistory=signature;
 const list=$("videoHistoryList");list.replaceChildren();
 for(const row of history){
  const item=document.createElement('li'), info=document.createElement('div'), name=document.createElement('strong'), date=document.createElement('span'), copy=document.createElement('button');
  name.textContent=row.filename.split(/[\\/]/).pop() || row.filename;name.title=row.filename;
  date.textContent=new Date(row.completedAt).toLocaleString('ko-KR');
  info.append(name,date);copy.textContent='경로 복사';copy.type='button';
  copy.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(row.filename);copy.textContent='복사했어요';}catch{copy.textContent='복사 실패';}
  });
  item.append(info,copy);list.append(item);
 }
}
void refreshVideoActivity();
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local')return;
 if(changes[VIDEO_STATUS_KEY] || changes[VIDEO_HISTORY_KEY])void refreshVideoActivity();
 if(changes[VIDEO_HISTORY_KEY] || changes[DOWNLOAD_SEEN_KEY] && current!=='download')void refreshDownloadBadge();
});

$("currentVideoDownloader").addEventListener("click",async()=>{
 const tabs=await chrome.tabs.query({url:["https://*/*","http://*/*"]});
 const [focused]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
 tabs.sort((a,b)=>(b.lastAccessed || 0)-(a.lastAccessed || 0));
 const tab=tabs.find(t=>t.id===focused?.id) || tabs[0];
 if(!tab?.url){await openVideoDownloader();return;}
 let url=tab.url;
 try {const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id!},func:()=>{
  const video=document.querySelector('video');const src=video?.currentSrc || video?.src;
  return src?.startsWith('https://') || src?.startsWith('http://')?src:null;
 }});if(typeof result?.result==='string')url=result.result;}catch{/* Supported page extractors can use the page URL directly. */}
 await openVideoDownloader(url);
});
