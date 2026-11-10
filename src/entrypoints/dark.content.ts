import {auto, disable, enable, setFetchMethod} from "darkreader";
// @ts-ignore settings are plain JS shared with the dark-mode popup and service worker
import {DARK_SETTINGS_KEY, darkSiteEnabled, darkThemeForSite, normalizeDarkSettings} from "@/modules/dark/settings.js";
// @ts-ignore original Dark Reader fixes are plain JS
import {darkReaderFixesForSite, withTranslationColors} from "@/modules/dark/site-fixes.js";
import {darkStylesheetOrigins} from "@/modules/dark/css-resource.js";
import {darkFrameHost} from "@/modules/dark/frame-host.js";
import {createContrastController} from "@/modules/dark/contrast.js";
import {createPseudoContrastController} from "@/modules/dark/pseudo-contrast.js";
import {createIconContrastController} from "@/modules/dark/icon-contrast.js";
import {createPaintGuard} from "@/modules/dark/paint-guard.js";

const MODULES_KEY = "core.modules";

// Public small image only. The worker independently checks both origin grants
// and active dark settings; page credentials are never relayed.
async function fetchDarkImage(url: string, init: RequestInit): Promise<Response> {
    try { return await fetch(url, init); } catch (error) {
        if (init.signal?.aborted) throw error;
    }
    return new Promise((resolve, reject) => {
        if (init.signal?.aborted) {reject(new DOMException("Aborted", "AbortError")); return;}
        const port = chrome.runtime.connect({name: "bongextend-dark-image"});
        let settled = false;
        const finish = (error?: Error, response?: Response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer); init.signal?.removeEventListener("abort", aborted);
            port.onDisconnect.removeListener(disconnected); port.disconnect();
            if (error) reject(error); else resolve(response!);
        };
        const aborted = () => finish(new DOMException("Aborted", "AbortError"));
        const disconnected = () => finish(new Error(chrome.runtime.lastError?.message || "Image connection closed"));
        const timer = setTimeout(() => finish(new Error("Image request timed out")), 3000);
        init.signal?.addEventListener("abort", aborted, {once: true});
        port.onDisconnect.addListener(disconnected);
        port.onMessage.addListener(result => {
            try {
                if (result?.ok !== true || !/^image\/(png|webp|svg\+xml)$/.test(result.type) || typeof result.data !== "string" || result.data.length > 174764) throw new Error("Image response rejected");
                const bytes = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
                if (bytes.length > 131072) throw new Error("Image response too large");
                finish(undefined, new Response(bytes, {headers: {"Content-Type": result.type}}));
            } catch (error) {finish(error instanceof Error ? error : new Error("Invalid image response"));}
        });
        port.postMessage({url});
    });
}

export default defineContentScript({
    // WXT builds this file for runtime registration. This existing site keeps it out of broad required permissions.
    matches: ["https://mail.google.com/*"],
    registration: "runtime",
    runAt: "document_start",
    main() {
        const controllerKey = "__bongextendDarkReaderController";
        const scope = globalThis as unknown as Record<string, {apply?: () => Promise<void>} | undefined>;
        const existing = scope[controllerKey];
        if (existing?.apply) {
            void existing.apply();
            return;
        }
        let generation = 0;
        const icons = createIconContrastController(document, () => contrast.update(), {fetchImage: fetchDarkImage});
        const pseudo = createPseudoContrastController(document);
        const contrast = createContrastController(document, {inspectImage: icons.inspect, inspectPseudo: pseudo.inspect});
        const paint = createPaintGuard(document);
        let contrastEnabled = false;
        const syncContrast = () => {
            if (contrastEnabled && document.documentElement?.getAttribute("data-darkreader-scheme") === "dark") {paint.start(); icons.start(); pseudo.start(); contrast.start();}
            else {paint.stop(); icons.stop(); pseudo.stop(); contrast.stop();}
        };
        let observedRoot: HTMLElement | null = null;
        const onCleanup = () => {
            paint.stop();
            icons.stop(); pseudo.stop();
            contrast.stop();
            document.documentElement?.removeAttribute("data-bong-dark-proxy");
        };
        const schemeObserver = new MutationObserver(() => {
            if (watchScheme()) {
                document.removeEventListener("__darkreader__cleanUp", onCleanup);
                document.addEventListener("__darkreader__cleanUp", onCleanup);
                if (scope[controllerKey]?.apply) void scope[controllerKey]!.apply!();
            } else syncContrast();
        });
        const watchScheme = () => {
            if (document.documentElement === observedRoot) return false;
            observedRoot = document.documentElement;
            schemeObserver.disconnect();
            schemeObserver.observe(document, {childList: true});
            if (observedRoot) schemeObserver.observe(observedRoot, {attributes: true, attributeFilter: ["data-darkreader-scheme"]});
            return true;
        };
        schemeObserver.observe(document, {childList: true});
        watchScheme();
        const hostname = darkFrameHost(location.href, window !== window.top,
            Array.from(location.ancestorOrigins || []), document.referrer);
        document.addEventListener("__darkreader__cleanUp", onCleanup);

        setFetchMethod(async (resourceUrl: string) => {
            const url = new URL(resourceUrl, location.href);
            const pageUrl = /^https?:$/.test(location.protocol) ? location.href : hostname ? `https://${hostname}/` : location.href;
            try {return await fetch(url.href, {credentials: "omit"});}
            catch (error) {if (!darkStylesheetOrigins(pageUrl, url.href)) throw error;}
            {
                // CSS 전용 연결로 다른 모듈의 응답과 섞이지 않게 해요.
                const text = await new Promise<string>((resolve, reject) => {
                    const port = chrome.runtime.connect({name: "bongextend-dark-css"});
                    let settled = false;
                    const finish = (error?: Error, text?: string) => {
                        if (settled) return; settled = true;
                        clearTimeout(timer);
                        port.onDisconnect.removeListener(disconnected);
                        port.disconnect();
                        if (error) reject(error); else resolve(text!);
                    };
                    const disconnected = () => finish(new Error(chrome.runtime.lastError?.message || "CSS connection closed"));
                    const timer = setTimeout(() => finish(new Error("CSS request timed out")), 15000);
                    port.onDisconnect.addListener(disconnected);
                    port.onMessage.addListener(result => {
                        if (result?.ok && typeof result.text === "string" && result.text.length <= 5_242_880) finish(undefined, result.text);
                        else finish(new Error("사이트 CSS를 가져오지 못했어요."));
                    });
                    port.postMessage({url: url.href});
                });
                return new Response(text, {headers: {"Content-Type": "text/css"}});
            }
        });

        const apply = async () => {
            const current = ++generation;
            try {
                const stored = await browser.storage.local.get([DARK_SETTINGS_KEY, MODULES_KEY]);
                if (current !== generation) return;
                const settings = normalizeDarkSettings(stored[DARK_SETTINGS_KEY]);
                const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
                contrastEnabled = false;
                paint.stop();
                icons.stop(); pseudo.stop();
                contrast.stop();
                if (modules.dark === false || !darkSiteEnabled(settings, hostname)) {
                    auto(false);
                    disable();
                    return;
                }

                const siteTheme = darkThemeForSite(settings, hostname);
                const siteFixes = withTranslationColors(darkReaderFixesForSite(hostname));
                const theme = {
                    mode: siteTheme.mode,
                    brightness: siteTheme.brightness,
                    contrast: siteTheme.contrast,
                    sepia: siteTheme.sepia,
                    grayscale: siteTheme.grayscale,
                    useFont: Boolean(siteTheme.fontFamily),
                    fontFamily: siteTheme.fontFamily,
                    textStroke: siteTheme.textStroke,
                    darkSchemeBackgroundColor: siteTheme.darkSchemeBackgroundColor,
                    darkSchemeTextColor: siteTheme.darkSchemeTextColor,
                    styleSystemControls: true
                };
                disable();
                paint.prepare();
                // Initial document_start may run before the page creates its body.
                if (!document.body && document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady, {once: true});
                contrastEnabled = true;
                if (settings.followSystem) auto(theme, siteFixes);
                else {
                    auto(false);
                    enable(theme, siteFixes);
                }
                syncContrast();
            } catch (error) {
                contrastEnabled = false;
                paint.stop();
                icons.stop(); pseudo.stop();
                contrast.stop();
                console.error("BongExtend 다크 모드를 적용하지 못했어요.", error);
            }
        };

        const onReady = () => { void apply(); };
        scope[controllerKey] = {apply};
        void apply();
        browser.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && (changes[DARK_SETTINGS_KEY] || changes[MODULES_KEY])) void apply();
        });
    }
});
