// @ts-ignore plain JS provider
import {startNaverMail} from '@/modules/naver-mail/background.js';
import {darkStylesheetOrigins, fetchDarkStylesheet} from '@/modules/dark/css-resource.js';
// @ts-ignore bounded static image relay
import {darkImageOrigins,fetchDarkImage} from '@/modules/dark/image-resource.js';
// @ts-ignore pure JS
import {startVideoHost} from "@/modules/downloads/video.js";
// @ts-ignore pure JS
import {videoSaveTarget} from "@/modules/downloads/video-menu.js";
// @ts-ignore pure JS
import {startWideFullscreenBridge} from "@/modules/chzzk/wide-fullscreen.js";
import {onMessage, sendMessage, sendToContentTab} from "@/http/messaging";
import {migrateLocalStorageData} from "@/storage/migration";
import {databaseStorage, moduleSchemaStorage} from "@/storage/wxtStorage";
import {isDcContentScriptUrl} from "@/utils/dcinsideTab";
import {fetchRemoteIpIsp, isIpIspDatabase} from "@/utils/ipIsp";
import {
    applyExtensionUpdate,
    checkExtensionUpdate,
    getExtensionUpdateStatus,
    scheduleUpdateChecks,
    setUpdateAutoCheck
} from "@/core/updateCheck";
import {refreshUpdateStateAfterInstall} from "@/core/updateCheck";
// @ts-ignore shared plain-JavaScript badge module
import {paintToolbarBadge, checkerPlusUnreadCount} from "@/modules/toolbar-badge.js";

// @ts-ignore 번역 모듈은 순수 JS를 그대로 쓴다.
import {createTransMenus, startTransBackground} from "@/modules/trans/background.js";
// @ts-ignore 공통 모듈 스위치(순수 JS)
import {MODULES_KEY, getModules} from "@/modules/core-modules.js";
import {syncChzzkScripts} from "@/modules/chzzk-register";
import {CHRONO_SITE_ACCESS_KEY, syncChronoContentScripts} from "@/modules/chrono-register";
// @ts-ignore 페이지에 복사되는 순수 JS라 export 를 쓰지 않는다.
import "@/modules/chzzk/lib/ads.js";
// @ts-ignore 순수 JS
// @ts-ignore 순수 JS
import {startFxBackground} from "@/modules/fx/background.js";
// @ts-ignore plain JS usage collector
import {startUsageBackground} from "@/modules/usage/background.js";
// @ts-ignore plain JS image toolbar worker
import {startImageToolbarBackground} from "@/modules/image/toolbar-background.js";
// @ts-ignore 순수 JS
import {startRightClickBackground} from "@/modules/rightclick/background.js";
// @ts-ignore settings are plain JS shared with the dark-mode popup and content script
import {DARK_SCRIPT_FILE, DARK_SCRIPT_ID, DARK_PROXY_SCRIPT_ID, DARK_PROXY_SCRIPT_FILE, DARK_SETTINGS_KEY, darkSiteEnabled, darkSitePattern, normalizeDarkSettings} from "@/modules/dark/settings.js";
// @ts-ignore download helpers are plain JS shared with the manager page
import {DOWNLOAD_SETTINGS_KEY, cleanSuggestedFilename, makeDownloadFilename, normalizeDownloadSettings} from "@/modules/downloads/settings.js";

// @ts-ignore 순수 JS 인증번호 처리기
import {createMailOtpHandler} from "@/modules/gmail/otp.js";
// @ts-ignore pure JS
import {createOtpToast} from "@/modules/gmail/otp-toast.js";
// @ts-ignore memory-only OTP source tracking
import {createOtpPasteTracker} from "@/modules/gmail/otp-paste.js";
// @ts-ignore isolated trusted-paste bridge
import {startOtpPasteBridge} from "@/modules/gmail/otp-paste-bridge.js";
// @ts-ignore pure JS, memory-only auto read for AliExpress mail
import {createMailAutoRead} from "@/modules/gmail/auto-read.js";

export default defineBackground(() => {
    startNaverMail();
    startUsageBackground();
    startImageToolbarBackground();
    startVideoHost();
    startWideFullscreenBridge();
    const showOtpToast=createOtpToast();
    const otpPasteTracker=createOtpPasteTracker();
    const otpPasteBridge=startOtpPasteBridge(otpPasteTracker);
    const otpHandler = createMailOtpHandler({
        load: async () => {
            const stored = await chrome.storage.local.get(["core.mailOtpSeen", "core.mailOtpEnabled", MODULES_KEY]);
            return {seen: stored["core.mailOtpSeen"], enabled: stored["core.mailOtpEnabled"] !== false && (stored[MODULES_KEY] as Record<string, unknown> | undefined)?.gmail !== false};
        },
        save: (seen: unknown) => chrome.storage.local.set({"core.mailOtpSeen": seen}),
        copy: async (code: string, mail: unknown) => {
            const send = (globalThis as any).sendToOffscreenDoc;
            if (typeof send !== "function") throw new Error("clipboard unavailable");
            const result = await send("bongextend-copy-otp", {code});
            if (!result?.ok) throw new Error("clipboard copy failed");
            try {await otpPasteBridge.arm(mail,code);await otpPasteBridge.refresh();} catch { /* Clipboard copy succeeded; leave mail unread when monitoring is unavailable. */ }
            const shown=await showOtpToast(code);
            await chrome.storage.local.set({'core.mailOtpOverlayStatus':shown?'shown':'page-unavailable'});
        },
        notify: (key: string, code: string) => chrome.notifications.create(`bongextend-otp-${key}`, {
            type: "basic", iconUrl: chrome.runtime.getURL("icons/128.png"), title: code, message: ""
        })
    });
    (globalThis as any).BongExtendHandleOtpMails = otpHandler;

    // 알리익스프레스 메일: Checker Plus가 알림을 띄운 뒤에만 읽음 처리해요. 끄려면 core.mailAutoReadAli를 false로 해요.
    // 진단 기록: 보낸 주소의 도메인과 처리 결과만 최근 30개 남겨요. 메일 제목·내용·전체 주소는 저장하지 않아요.
    let autoReadLogQueue: Promise<unknown> = Promise.resolve();
    const logAutoRead = (entry: {domain: string; reason: string; count?: number; name?: string}) => {
        autoReadLogQueue = autoReadLogQueue.then(async () => {
            const stored = await chrome.storage.local.get("core.mailAutoReadLog");
            const list = Array.isArray(stored["core.mailAutoReadLog"]) ? stored["core.mailAutoReadLog"] as unknown[] : [];
            await chrome.storage.local.set({"core.mailAutoReadLog": [...list, {at: Date.now(), ...entry}].slice(-30)});
        }).catch(() => {});
    };
    const mailAutoRead = createMailAutoRead({
        log: logAutoRead,
        // Checker Plus 알림이 안 떴을 때 알리 메일에 대해 우리가 직접 띄우는 Windows 알림(제목만 보여줘요).
        notify: async (mail: {id?: string; title?: string; account?: {id?: unknown}}) => {
            await chrome.notifications.create(`bongextend-ali-${String(mail.account?.id)}-${String(mail.id)}`, {
                type: "basic", iconUrl: chrome.runtime.getURL("icons/128.png"), title: "알리익스프레스", message: String(mail.title || "새 메일이 왔어요"), priority: 1
            });
            return true;
        },
        isEnabled: async () => {
            const stored = await chrome.storage.local.get(["core.mailAutoReadAli", MODULES_KEY]);
            return stored["core.mailAutoReadAli"] !== false && (stored[MODULES_KEY] as Record<string, unknown> | undefined)?.gmail !== false;
        }
    });
    (globalThis as any).BongExtendNoteNotified = (mails: unknown[]) => mailAutoRead.noteShown(mails);
    (globalThis as any).BongExtendAutoReadMails = (mails: unknown[], options: unknown) => {
        if (Array.isArray(mails) && mails.length) logAutoRead({domain: "", reason: "checked", count: mails.length});
        return mailAutoRead.process(mails, options).catch(() => []);
    };

    // CheckPlus 이전 버전이 저장한 도구막대 덮어쓰기를 복구한다.
    const rootManifest = chrome.runtime.getManifest() as {
        action?: {default_popup?: string; default_title?: string; default_icon?: Record<string, string>};
        icons?: Record<string, string>;
    };
    try {
        chrome.action.setPopup({popup: rootManifest.action?.default_popup || "popup.html"});
        chrome.action.setTitle({title: rootManifest.action?.default_title || "BongExtend"});
        chrome.action.setBadgeText({text: ""});
        const iconPaths = rootManifest.action?.default_icon || rootManifest.icons;
        if (iconPaths) chrome.action.setIcon({path: iconPaths});
    } catch (error) {
        console.warn("BongExtend 도구막대를 복구하지 못했어요.", error);
    }

    // Checker Plus calls this after its unreadCount write has committed.
    // Mirror that one authoritative count to BongExtend storage and toolbar.
    (globalThis as typeof globalThis & {BongExtendOnUnreadCount?: (value: unknown) => void}).BongExtendOnUnreadCount = (value) => {
        const count = checkerPlusUnreadCount({value});
        if (count === null) return;
        void paintToolbarBadge(count).catch((error: unknown) => console.warn("메일 뱃지를 갱신하지 못했어요.", error));
    };

    // Chrono 엔진은 시작할 때마다 우클릭 메뉴(d_link 등)를 다시 만들어서, 이미 있으면 "duplicate id" 오류가 확장 오류 목록에 쌓여요.
    // 콜백 없이 부른 create 에서만 이 중복 오류를 조용히 확인하고 넘어가요(메뉴 자체는 이미 있어서 그대로 동작해요).
    try {
        const menus = chrome.contextMenus;
        const rawCreate = menus.create.bind(menus);
        (menus as unknown as {create: unknown}).create = (props: chrome.contextMenus.CreateProperties, callback?: () => void) => {
            if (typeof callback === "function") return rawCreate(props, callback);
            return rawCreate(props, () => { void chrome.runtime.lastError; });
        };
    } catch { /* 메뉴 API가 없으면 넘어가요 */ }

    // Checker Plus와 Chrono가 확장 툴바 API를 직접 바꾸지 못하게 한다.
    const importChrono = (globalThis as typeof globalThis & {importScripts?: (...urls: string[]) => void}).importScripts;
    if (typeof importChrono === "function") {
        try { importChrono.call(globalThis, "/js/chrono-action-bridge.js"); }
        catch (error) { console.error("다운로드 툴바 어댑터를 시작하지 못했어요.", error); }
        try { importChrono.call(globalThis, "/js/bongextend-profile.js", "/js/background.js"); }
        catch (error) { console.error("Checker Plus 메일 엔진을 시작하지 못했어요.", error); }
        try { importChrono.call(globalThis, "/chrono-worker.js"); }
        catch (error) { console.error("Chrono 다운로드 엔진을 시작하지 못했어요.", error); }
    }
    void paintToolbarBadge();

    // ===== 번역 모듈 처리기 =====
    startTransBackground();
    startFxBackground();
    startRightClickBackground();

    const syncChronoSites = async () => {
        const stored = await browser.storage.local.get(CHRONO_SITE_ACCESS_KEY);
        await syncChronoContentScripts(stored[CHRONO_SITE_ACCESS_KEY] === true);
        await (globalThis as any).BongExtendSyncDownloadAccess?.();
    };
    void syncChronoSites();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[CHRONO_SITE_ACCESS_KEY]) void syncChronoSites();
    });
    browser.permissions.onAdded.addListener(() => void syncChronoSites());
    browser.permissions.onRemoved.addListener(() => void syncChronoSites());
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.type !== "chrono-sync-sites") return;
        syncChronoSites().then(
            () => sendResponse({ok: true}),
            error => sendResponse({ok: false, error: error?.message || "사이트 연결을 등록하지 못했어요."})
        );
        return true;
    });

    // 다크 모드: 사용자가 권한을 허용한 사이트에만 런타임 콘텐츠 스크립트를 등록한다.
    let activeDarkStylesheets = 0, queuedDarkStylesheets = 0;
    chrome.runtime.onConnect.addListener(port => {
        if (port.name !== "bongextend-dark-css") return;
        const sender = port.sender;
        let received = false;
        const controller = new AbortController();
        port.onDisconnect.addListener(() => controller.abort());
        port.onMessage.addListener(message => {
            if (received) return; received = true;
            const respond = (value: unknown) => { try { port.postMessage(value); } catch { /* 문서가 닫힌 경우 */ } };
            void (async () => {
                let acquired = false, queued = false, timer: ReturnType<typeof setTimeout> | undefined;
                try {
                    // Chrome supplies the actual origin of blank/srcdoc frames; never trust a page message for it.
                    const senderUrl = sender?.url || "";
                    const page = new URL(/^(about|blob|data):/.test(senderUrl) ? sender?.origin || "" : senderUrl);
                    const url = new URL(message.url);
                    const origins = darkStylesheetOrigins(page.href, url.href);
                    if (sender?.id !== chrome.runtime.id || sender.tab?.id == null || !origins || queuedDarkStylesheets >= 24) throw new Error("unsupported resource");
                    const stored = await chrome.storage.local.get([DARK_SETTINGS_KEY, MODULES_KEY]);
                    if ((stored[MODULES_KEY] as {dark?: boolean} | undefined)?.dark === false || !darkSiteEnabled(normalizeDarkSettings(stored[DARK_SETTINGS_KEY]), page.hostname) || !await chrome.permissions.contains({origins})) throw new Error("missing permission");
                    if (controller.signal.aborted || queuedDarkStylesheets >= 24) throw new Error("busy");
                    queued = true; queuedDarkStylesheets++;
                    timer = setTimeout(() => controller.abort(), 12000);
                    while (activeDarkStylesheets >= 4 && !controller.signal.aborted) await new Promise(resolve => setTimeout(resolve, 50));
                    queued = false; queuedDarkStylesheets--;
                    if (controller.signal.aborted) throw new Error("cancelled");
                    acquired = true; activeDarkStylesheets++;
                    const latest = await chrome.storage.local.get([DARK_SETTINGS_KEY, MODULES_KEY]);
                    if ((latest[MODULES_KEY] as {dark?: boolean} | undefined)?.dark === false || !darkSiteEnabled(normalizeDarkSettings(latest[DARK_SETTINGS_KEY]), page.hostname) || !await chrome.permissions.contains({origins})) throw new Error("permission changed");
                    const text = await fetchDarkStylesheet(url.href, {signal: controller.signal});
                    if (controller.signal.aborted) return;
                    respond({ok: true, text});
                } catch { respond({ok: false}); }
                finally {if (timer) clearTimeout(timer); if (queued) queuedDarkStylesheets--; if (acquired) activeDarkStylesheets--;}
            })();
        });
    });
    let activeDarkImages=0;
    chrome.runtime.onConnect.addListener(port=>{
        if(port.name!=="bongextend-dark-image")return;
        let received=false;const controller=new AbortController();
        port.onDisconnect.addListener(()=>controller.abort());
        port.onMessage.addListener(message=>{
            if(received)return;received=true;
            const respond=(result:unknown)=>{try{port.postMessage(result);}catch{/* Closed document. */}};
            void(async()=>{
                let acquired=false,timer:ReturnType<typeof setTimeout>|undefined;
                try{
                    const sender=port.sender,senderUrl=sender?.url||"";
                    const page=new URL(/^(about|blob|data):/.test(senderUrl)?sender?.origin||"":senderUrl);
                    const url=new URL(message.url),origins=darkImageOrigins(page.href,url.href);
                    if(sender?.id!==chrome.runtime.id||!sender.tab?.id||!origins||activeDarkImages>=4)throw Error("unsupported image");
                    const stored=await chrome.storage.local.get([DARK_SETTINGS_KEY,MODULES_KEY]);
                    const modules=stored[MODULES_KEY] as {dark?:boolean}|undefined;
                    if(modules?.dark===false||!darkSiteEnabled(normalizeDarkSettings(stored[DARK_SETTINGS_KEY]),page.hostname)||!await chrome.permissions.contains({origins}))throw Error("not enabled");
                    if(controller.signal.aborted||activeDarkImages>=4)throw Error("busy");
                    activeDarkImages++;acquired=true;timer=setTimeout(()=>controller.abort(),3000);
                    const result=await fetchDarkImage(url.href,{signal:controller.signal});
                    if(!controller.signal.aborted)respond({ok:true,...result});
                }catch{respond({ok:false});}
                finally{if(timer)clearTimeout(timer);if(acquired)activeDarkImages--;}
            })();
        });
    });
    const syncDarkReaderScript = async () => {
        try {
            const stored = await browser.storage.local.get([DARK_SETTINGS_KEY, MODULES_KEY]);
            const settings = normalizeDarkSettings(stored[DARK_SETTINGS_KEY]);
            const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
            const matches: string[] = [];
            if (modules.dark !== false) {
                if (settings.enabledByDefault) {
                    const allOrigins = ["https://*/*", "http://*/*"];
                    if (await browser.permissions.contains({origins: allOrigins})) matches.push(...allOrigins);
                } else {
                    const hosts = new Set<string>(settings.enabledSites);
                    if (settings.siteListMode === "only") for (const host of settings.siteList) hosts.add(host);
                    for (const host of hosts) {
                        if (!darkSiteEnabled({...settings, enabledByDefault: false}, host)) continue;
                        for (const pattern of darkSitePattern(host)) {
                            if (await browser.permissions.contains({origins: [pattern]})) matches.push(pattern);
                        }
                    }
                }
            }
            const registered = await browser.scripting.getRegisteredContentScripts({ids: [DARK_SCRIPT_ID, DARK_PROXY_SCRIPT_ID]});
            if (registered.length) await browser.scripting.unregisterContentScripts({ids: registered.map(script => script.id)});
            if (matches.length) {
                await browser.scripting.registerContentScripts([{
                    id: DARK_PROXY_SCRIPT_ID,
                    matches: [...new Set(matches)],
                    js: [DARK_PROXY_SCRIPT_FILE],
                    world: "MAIN",
                    allFrames: true,
                    matchOriginAsFallback: true,
                    runAt: "document_start",
                    persistAcrossSessions: true
                }, {
                    id: DARK_SCRIPT_ID,
                    matches: [...new Set(matches)],
                    js: [DARK_SCRIPT_FILE],
                    allFrames: true,
                    matchOriginAsFallback: true,
                    runAt: "document_start",
                    persistAcrossSessions: true
                }]);
            }

            // 새로 등록한 콘텐츠 스크립트는 이미 열려 있는 탭에 자동으로 실행되지 않아요.
            // 현재 권한과 설정이 허용하는 탭에도 즉시 적용해요.
            if (modules.dark !== false) {
                const tabs = await browser.tabs.query({});
                for (const tab of tabs) {
                    if (typeof tab.id !== "number") continue;
                    let url: URL;
                    try { url = new URL(tab.url || ""); } catch { continue; }
                    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
                    if (!darkSiteEnabled(settings, url.hostname)) continue;
                    const originPattern = darkSitePattern(url.hostname).find((pattern: string) => pattern.startsWith(`${url.protocol}//`));
                    if (!originPattern || !await browser.permissions.contains({origins: [originPattern]})) continue;
                    try {
                        await browser.scripting.executeScript({
                            target: {tabId: tab.id, allFrames: true},
                            world: "MAIN",
                            files: [DARK_PROXY_SCRIPT_FILE]
                        });
                        await browser.scripting.executeScript({
                            target: {tabId: tab.id, allFrames: true},
                            files: [DARK_SCRIPT_FILE]
                        });
                    } catch (error) {
                        // 브라우저 내부 탭이나 권한 없는 하위 프레임은 건너뛰어요.
                        console.debug("열린 탭에 다크 모드를 바로 적용하지 못했어요.", error);
                    }
                }
            }
        } catch (error) {
            console.warn("다크 모드 자동 적용 설정을 갱신하지 못했어요.", error);
        }
    };
    void syncDarkReaderScript();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes[DARK_SETTINGS_KEY] || changes[MODULES_KEY])) void syncDarkReaderScript();
    });
    browser.permissions.onAdded.addListener(() => void syncDarkReaderScript());
    browser.permissions.onRemoved.addListener(() => void syncDarkReaderScript());

    // 다운로드 관리: Chrome 자체 다운로드 API를 사용하며 저장 경로는 다운로드 폴더 아래로 제한한다.
    const syncDownloadUi = async () => {
        try {
            const stored = await browser.storage.local.get([DOWNLOAD_SETTINGS_KEY, MODULES_KEY]);
            const settings = normalizeDownloadSettings(stored[DOWNLOAD_SETTINGS_KEY]);
            const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
            await browser.downloads.setUiOptions({enabled: modules.download === false || !settings.replaceChromeUi});
        } catch (error) {
            console.warn("Chrome 다운로드 표시 설정을 바꾸지 못했어요.", error);
        }
    };
    void syncDownloadUi();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes[DOWNLOAD_SETTINGS_KEY] || changes[MODULES_KEY])) void syncDownloadUi();
    });
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
        void (async () => {
            try {
                const nameHint = takeDownloadNameHint(item.url);
                const stored = await chrome.storage.local.get([DOWNLOAD_SETTINGS_KEY, MODULES_KEY]);
                const settings = normalizeDownloadSettings(stored[DOWNLOAD_SETTINGS_KEY]);
                const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
                if (modules.download === false || (!settings.filenameMask && !settings.folder && !settings.routeByType && !settings.rules.length)) {
                    if (nameHint) suggest({filename: nameHint, conflictAction: "uniquify"});
                    else if (modules.download !== false && (globalThis as any).BongExtendChronoAction?.suggestFilename) {
                        (globalThis as any).BongExtendChronoAction.suggestFilename(item, suggest);
                    } else suggest();
                    return;
                }
                suggest({filename: makeDownloadFilename(item, settings, new Date(), nameHint), conflictAction: "uniquify"});
            } catch {
                suggest();
            }
        })();
        return true;
    });
    chrome.downloads.onChanged.addListener((delta) => {
        if (delta.state?.current !== "complete" || delta.state.previous === "complete") return;
        void (async () => {
            const stored = await chrome.storage.local.get([DOWNLOAD_SETTINGS_KEY, MODULES_KEY]);
            const settings = normalizeDownloadSettings(stored[DOWNLOAD_SETTINGS_KEY]);
            const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
            if (modules.download === false || !settings.notifications) return;
            const item = await chrome.downloads.search({id: delta.id});
            const name = item[0]?.filename?.replace(/\\/g, "/").split("/").pop() || "파일";
            await chrome.notifications.create(`bongextend-download-${delta.id}`, {
                type: "basic",
                iconUrl: browser.runtime.getURL("/icons/128.png"),
                title: "다운로드 완료",
                message: name
            });
        })().catch((error) => console.warn("다운로드 알림을 표시하지 못했어요.", error));
    });
    const downloadNameHints = new Map<string, {name: string; createdAt: number}[]>();
    const takeDownloadNameHint = (url: string) => {
        const queue = downloadNameHints.get(url);
        if (!queue) return "";
        const now = Date.now();
        while (queue.length && now - queue[0].createdAt > 30_000) queue.shift();
        const hint = queue.shift()?.name || "";
        if (!queue.length) downloadNameHints.delete(url);
        return hint;
    };
    const removeDownloadNameHint = (url: string, name: string) => {
        const queue = downloadNameHints.get(url);
        if (!queue) return;
        const index = queue.findIndex((entry) => entry.name === name);
        if (index >= 0) queue.splice(index, 1);
        if (!queue.length) downloadNameHints.delete(url);
    };
    const startDownloadWithName = async (rawUrl: string, rawName: string) => {
        const url = new URL(rawUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("http 또는 https 주소만 받을 수 있어요.");
        const name = cleanSuggestedFilename(rawName);
        if (name) {
            const queue = downloadNameHints.get(url.href) || [];
            queue.push({name, createdAt: Date.now()});
            downloadNameHints.set(url.href, queue);
        }
        try {
            return await browser.downloads.download({url: url.href, conflictAction: "uniquify"});
        } catch (error) {
            if (name) removeDownloadNameHint(url.href, name);
            throw error;
        }
    };
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== "bongextend-download") return;
        let senderIsExtensionPage = false;
        try { senderIsExtensionPage = sender.id === browser.runtime.id && new URL(sender.url || "").protocol === "chrome-extension:"; }
        catch { senderIsExtensionPage = false; }
        if (!senderIsExtensionPage || typeof message.url !== "string") {
            sendResponse({ok: false, error: "확장 프로그램 화면에서만 시작할 수 있어요."});
            return;
        }
        startDownloadWithName(message.url, typeof message.filename === "string" ? message.filename : "").then(
            (id) => sendResponse({ok: true, id}),
            (error) => sendResponse({ok: false, error: error?.message || "다운로드를 시작하지 못했어요."})
        );
        return true;
    });

    // ===== 치지직 모듈 콘텐츠 스크립트 등록 =====
    // 모듈 스위치를 끄면 등록을 풀어서 치지직 페이지에 아예 붙지 않게 한다.
    type ChzzkAdApi = {
        CHZZK_AD_RULE_IDS: number[];
        chzzkAdRules: () => chrome.declarativeNetRequest.Rule[];
    };
    const chzzkAdApi = () => (globalThis as unknown as {BongAds?: ChzzkAdApi}).BongAds;
    const syncChzzkAdRules = async () => {
        const api = chzzkAdApi();
        const dnr = browser.declarativeNetRequest;
        if (!api || !dnr?.updateDynamicRules) return;
        try {
            const stored = await browser.storage.sync.get("chzzk.adBlock");
            const modules = await getModules();
            const on = stored["chzzk.adBlock"] !== false && modules.chzzk !== false;
            const update: chrome.declarativeNetRequest.UpdateRuleOptions = {removeRuleIds: api.CHZZK_AD_RULE_IDS};
            const rules = on ? api.chzzkAdRules() : [];
            // 빈 목록을 addRules 로 넣으면 크롬이 규칙 갱신을 거절할 수 있다.
            if (rules.length) update.addRules = rules;
            await dnr.updateDynamicRules(update);
        } catch (error) {
            console.error("치지직 광고 차단 규칙을 적용하지 못했어요.", error);
        }
    };
    void syncChzzkScripts(getModules);
    void syncChzzkAdRules();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[MODULES_KEY]) {
            void syncChzzkScripts(getModules);
            void syncChzzkAdRules();
        }
        if (area === "sync" && changes["chzzk.adBlock"]) void syncChzzkAdRules();
    });

    const RECAPTCHA_SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
    // 페이지에 postMessage 하지 않는다. 서비스 워커가 디시 탭의 메인 세상에서만 토큰을 받는다.
    // 문자열로 함수를 만들지 않는다. MV3 CSP가 막아서, 시작하자마자 호출하면
    // 서비스 워커 등록이 Status code 15로 실패하고 업데이트 확인이 끝나지 않는다.
    // executeScript는 이 함수 본문만 페이지로 넘긴다. 바깥 변수는 캡처하지 않는다.
    const recaptchaInPage = (siteKey: string, action: string): Promise<string> => {
        const page = window as Window & {
            grecaptcha?: {
                ready: (callback: () => void) => void;
                execute: (key: string, options: {action: string}) => Promise<string>;
            };
        };
        if (typeof action !== "string" || !action) return Promise.resolve("");
        return new Promise((resolve) => {
            const start = Date.now();
            const finish = (token: unknown) => {
                resolve(typeof token === "string" ? token : "");
            };
            const run = () => {
                const widget = page.grecaptcha;
                if (!widget) {
                    if (Date.now() - start > 2500) return finish("");
                    setTimeout(run, 50);
                    return;
                }
                try {
                    widget.ready(() => {
                        const current = page.grecaptcha;
                        if (!current) return finish("");
                        current.execute(siteKey, {action}).then(finish, () => finish(""));
                    });
                } catch {
                    finish("");
                }
            };
            run();
        });
    };

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== "refresherGrecaptcha") return;
        const tabId = sender.tab?.id;
        const action = typeof message.action === "string" ? message.action : "";
        if (tabId == null || !action || sender.id !== browser.runtime.id) {
            sendResponse({ok: false, token: ""});
            return;
        }
        const target: {tabId: number; frameIds?: number[]} = {tabId};
        if (typeof sender.frameId === "number") target.frameIds = [sender.frameId];
        browser.scripting.executeScript({
            target,
            world: "MAIN",
            func: recaptchaInPage,
            args: [RECAPTCHA_SITE_KEY, action]
        }).then(
            (results) => sendResponse({ok: true, token: results?.[0]?.result || ""}),
            () => sendResponse({ok: false, token: ""})
        );
        return true;
    });

    // ===== Broadcast: popup/content → background → 모든 탭 =====
    onMessage("broadcast", async ({data}) => {
        const {type, data: payload} = data;

        try {
            const tabs = await browser.tabs.query({});
            const targets = tabs.filter((tab) => tab.id && isDcContentScriptUrl(tab.url));
            const delivered = await Promise.all(targets.map(async (tab) => {
                try {
                    await sendToContentTab(type, payload, tab.id!);
                    return true;
                } catch {
                    return false;
                }
            }));

            return {success: true, sentTo: delivered.filter(Boolean).length};
        } catch (e) {
            return {success: false, error: e};
        }
    });

    // 콘텐츠 스크립트가 없는 탭이면 팝업이 여기로 물어본다. 마지막에 저장해 둔 목록을 돌려준다.
    onMessage("getSchema", async () => {
        return await moduleSchemaStorage.getValue();
    });

    // ===== Context Menus =====
    const contextMenuItems: Browser.contextMenus.CreateProperties[] = [
        {
            id: "blockSelected",
            title: "오른쪽 클릭한 유저 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "memoSelected",
            title: "오른쪽 클릭한 유저 메모",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "dcconSelected",
            title: "오른쪽 클릭한 디시콘 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "dcconAllSelected",
            title: "오른쪽 클릭한 디시콘 전체 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "searchSauceNao",
            title: "SauceNao 검색",
            contexts: ["image"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "bongDownloadLink",
            title: "BongExtend로 링크 다운로드",
            contexts: ["link"]
        },
        {
            id: "bongDownloadImage",
            title: "BongExtend로 이미지 다운로드",
            contexts: ["image"]
        },
        {
            id: "bongDownloadMedia",
            title: "동영상 저장하기",
            contexts: ["video"]
        },
        {
            id: "bongDownloadAudio",
            title: "BongExtend로 오디오 다운로드",
            contexts: ["audio"]
        }
    ];

    let contextMenuSetup: Promise<void> | null = null;

    const createContextMenus = (): Promise<void> => {
        if (contextMenuSetup) return contextMenuSetup;

        contextMenuSetup = (async () => {
            for (const item of contextMenuItems) {
                if (item.id) {
                    await browser.contextMenus.remove(item.id).catch(() => {});
                }

                await browser.contextMenus.create(item as chrome.contextMenus.CreateProperties);
            }

            // 다른 모듈의 메뉴를 지우지 않고 공통 번역 메뉴를 갱신한다.
            try {
                await browser.contextMenus.remove("toggle-translation").catch(() => {});
                createTransMenus();
            } catch (error) {
                console.warn("번역 메뉴를 만들지 못했어요.", error);
            }
        })();

        return contextMenuSetup;
    };

    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (!tab?.id) return;
        // 타입 안전 메시징: 활성 탭에 전달
        switch (info.menuItemId) {
            case "blockSelected":
                sendMessage("blockSelected", undefined, tab.id).catch(() => {});
                break;
            case "memoSelected":
                sendMessage("memoSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconSelected":
                sendMessage("dcconSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconAllSelected":
                sendMessage("dcconAllSelected", undefined, tab.id).catch(() => {});
                break;
            case "searchSauceNao":
                sendMessage("searchSauceNao", undefined, tab.id).catch(() => {});
                break;
            case "bongDownloadMedia": {
                void getModules().then(async (modules: Record<string,boolean>)=>{
                    if(modules.download===false)return;
                    const target=videoSaveTarget(info,tab);
                    if(!target)return;
                    if(target.mode==='direct')await startDownloadWithName(target.url,cleanSuggestedFilename(new URL(target.url).pathname.split('/').pop()||'video.mp4'));
                    else await chrome.tabs.create({url:chrome.runtime.getURL('video-downloader.html')+'?autostart=1&url='+encodeURIComponent(target.url)});
                }).catch(()=>{void chrome.notifications.create('bongextend-video-save-error',{type:'basic',iconUrl:chrome.runtime.getURL('icons/128.png'),title:'동영상 저장',message:'다운로드를 시작하지 못했어요. 주소와 파일 상태를 확인해 주세요.'}).catch(()=>{});});
                break;
            }
            case "bongDownloadLink":
            case "bongDownloadImage":
            case "bongDownloadAudio": {
                void getModules().then((modules: Record<string, boolean | undefined>) => {
                    if (modules.download === false) return;
                    const rawUrl = info.menuItemId === "bongDownloadLink" ? info.linkUrl : info.srcUrl;
                    if (!rawUrl) return;
                    try {
                        const url = new URL(rawUrl);
                        if (url.protocol !== "http:" && url.protocol !== "https:") return;
                        const fallbackName = url.pathname.split("/").pop() || tab.title || "";
                        const name = cleanSuggestedFilename(fallbackName);
                        const extension = url.pathname.split("/").pop()?.match(/\.[a-z0-9]{1,8}$/i)?.[0] || "";
                        const filename = name && !/\.[a-z0-9]{1,8}$/i.test(name) ? `${name}${extension}` : name;
                        void startDownloadWithName(url.href, filename);
                    } catch { /* 주소가 올바르지 않으면 건너뛴다 */ }
                });
                break;
            }
        }
    });

    void createContextMenus();

    void (async () => {
        try {
            await migrateLocalStorageData();
        } catch (error) {
            console.error("Storage migration error:", error);
        }
        scheduleUpdateChecks();
    })();

    onMessage("getUpdateStatus", () => getExtensionUpdateStatus());
    onMessage("checkForUpdate", ({data}) => checkExtensionUpdate(Boolean(data?.force), Boolean(data?.force)));
    onMessage("applyUpdate", () => applyExtensionUpdate());
    onMessage("setUpdateAutoCheck", ({data}) => setUpdateAutoCheck(data.enabled));

    // <a href="chrome://..."> 는 브라우저가 막는다. tabs.create 만 chrome://extensions 와 about:addons 를 연다.
    onMessage("openExtensionsPage", async () => {
        const url = import.meta.env.FIREFOX
            ? "about:addons"
            : `chrome://extensions/?id=${browser.runtime.id}`;

        try {
            await browser.tabs.create({url});
            return {ok: true};
        } catch (error) {
            console.error("확장 프로그램 관리 페이지를 열지 못했어요.", error);

            if (import.meta.env.FIREFOX) {
                return {ok: false, error: "확장 프로그램 관리 페이지를 열지 못했어요."};
            }

            try {
                await browser.tabs.create({url: "chrome://extensions"});
                return {ok: true};
            } catch (fallbackError) {
                console.error("확장 프로그램 관리 페이지를 열지 못했어요.", fallbackError);
                return {ok: false, error: "확장 프로그램 관리 페이지를 열지 못했어요."};
            }
        }
    });

    browser.runtime.onStartup.addListener(() => {
        void createContextMenus();
    });

    // 단축키는 번역 켜기/끄기(toggle-translation)만 둔다. 다른 단축키는 따로 요청받기 전에는 넣지 않는다.

    // dcrefresher.green1052.com/data 는 404다. 차단 목록을 받던 요청은 서비스 워커 오류만 남기므로 하지 않는다.
    // 이미 저장한 차단 목록은 storage에 그대로 둔다. 통신사 표만 Baegovda/BongExtend의 main에서 따로 확인한다.
    const IP_UPDATE_INTERVAL = 604800000;

    const refreshIpDatabase = async (): Promise<void> => {
        try {
            const remoteIp = await fetchRemoteIpIsp();
            if (remoteIp) {
                const current: unknown = await databaseStorage.ip.getValue();
                const currentGenerated = isIpIspDatabase(current) ? current.generated : "";
                if (remoteIp.generated > currentGenerated) {
                    await databaseStorage.ip.setValue(remoteIp);
                }
            }
            await databaseStorage.ipCheckedAt.setValue(Date.now());
        } catch {
            // 네트워크가 끊기면 다음 시작에 다시 시도한다. 콘솔에는 남기지 않는다.
        }
    };

    // ===== Lifecycle =====
    browser.runtime.onInstalled.addListener(async (details) => {
        if (details?.reason === "install" || details?.reason === "update") {
            void refreshUpdateStateAfterInstall(true);
        }
        await createContextMenus();
        if (import.meta.env.PROD) {
            await refreshIpDatabase();
        }
    });

    if (import.meta.env.PROD) {
        void (async () => {
            const checkedAt = await databaseStorage.ipCheckedAt.getValue();
            if (!checkedAt || Date.now() - checkedAt > IP_UPDATE_INTERVAL) {
                await refreshIpDatabase();
            }
        })();
    }
});
