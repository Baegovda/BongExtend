import {auto, disable, enable, setFetchMethod} from "darkreader";
// @ts-ignore settings are plain JS shared with the dark-mode popup and service worker
import {DARK_SETTINGS_KEY, darkSiteEnabled, darkThemeForSite, normalizeDarkSettings} from "@/modules/dark/settings.js";
// @ts-ignore original Dark Reader fixes are plain JS
import {darkReaderFixesForSite, withTranslationColors} from "@/modules/dark/site-fixes.js";

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
        const hostname = location.hostname.toLowerCase();
        document.addEventListener("__darkreader__cleanUp", () => {
            document.documentElement?.removeAttribute("data-bong-dark-proxy");
        });

        setFetchMethod(async (resourceUrl: string) => {
            const url = new URL(resourceUrl, location.href);
            if ((hostname === "naver.com" || hostname.endsWith(".naver.com")) &&
                url.protocol === "https:" && (url.hostname === "pstatic.net" || url.hostname.endsWith(".pstatic.net")) &&
                url.pathname.toLowerCase().endsWith(".css")) {
                const result = await chrome.runtime.sendMessage({type: "dark-fetch-naver-css", url: url.href});
                if (result?.ok) return new Response(result.text, {headers: {"Content-Type": "text/css"}});
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
