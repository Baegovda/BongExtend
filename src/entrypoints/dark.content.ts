import {auto, disable, enable, setFetchMethod} from "darkreader";
// @ts-ignore settings are plain JS shared with the dark-mode popup and service worker
import {DARK_SETTINGS_KEY, darkSiteEnabled, darkThemeForSite, normalizeDarkSettings} from "@/modules/dark/settings.js";
// @ts-ignore original Dark Reader fixes are plain JS
import {darkReaderFixesForSite, withTranslationColors} from "@/modules/dark/site-fixes.js";
import {darkStylesheetPermission} from "@/modules/dark/css-resource.js";
import {darkFrameHost} from "@/modules/dark/frame-host.js";

const MODULES_KEY = "core.modules";

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
        const hostname = darkFrameHost(location.href, window !== window.top,
            Array.from(location.ancestorOrigins || []), document.referrer);
        document.addEventListener("__darkreader__cleanUp", () => {
            document.documentElement?.removeAttribute("data-bong-dark-proxy");
        });

        setFetchMethod(async (resourceUrl: string) => {
            const url = new URL(resourceUrl, location.href);
            const pageUrl = /^https?:$/.test(location.protocol) ? location.href : hostname ? `https://${hostname}/` : location.href;
            if (darkStylesheetPermission(pageUrl, url.href)) {
                // CSS 전용 연결로 다른 모듈의 응답과 섞이지 않게 해요.
                const text = await new Promise<string>((resolve, reject) => {
                    const port = chrome.runtime.connect({name: "bongextend-dark-css"});
                    const finish = (error?: Error, text?: string) => {
                        clearTimeout(timer);
                        port.onDisconnect.removeListener(disconnected);
                        port.disconnect();
                        if (error) reject(error); else resolve(text!);
                    };
                    const disconnected = () => finish(new Error(chrome.runtime.lastError?.message || "CSS connection closed"));
                    const timer = setTimeout(() => finish(new Error("CSS request timed out")), 15000);
                    port.onDisconnect.addListener(disconnected);
                    port.onMessage.addListener(result => {
                        if (result?.ok && typeof result.text === "string") finish(undefined, result.text);
                        else finish(new Error("사이트 CSS를 가져오지 못했어요."));
                    });
                    port.postMessage({url: url.href});
                });
                return new Response(text, {headers: {"Content-Type": "text/css"}});
            }
            return fetch(url.href, {credentials: "omit"});
        });

        const apply = async () => {
            const current = ++generation;
            try {
                const stored = await browser.storage.local.get([DARK_SETTINGS_KEY, MODULES_KEY]);
                if (current !== generation) return;
                const settings = normalizeDarkSettings(stored[DARK_SETTINGS_KEY]);
                const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
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
                if (settings.followSystem) auto(theme, siteFixes);
                else {
                    auto(false);
                    enable(theme, siteFixes);
                }
            } catch (error) {
                console.error("BongExtend 다크 모드를 적용하지 못했어요.", error);
            }
        };

        scope[controllerKey] = {apply};
        void apply();
        browser.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && (changes[DARK_SETTINGS_KEY] || changes[MODULES_KEY])) void apply();
        });
    }
});
