import {auto, disable, enable} from "darkreader";
// @ts-ignore settings are plain JS shared with the dark-mode popup and service worker
import {DARK_SETTINGS_KEY, darkSiteEnabled, darkThemeForSite, normalizeDarkSettings} from "@/modules/dark/settings.js";
// @ts-ignore original Dark Reader fixes are plain JS
import {darkReaderFixesForSite} from "@/modules/dark/site-fixes.js";

const MODULES_KEY = "core.modules";

export default defineContentScript({
    // WXT builds this file for runtime registration. This existing site keeps it out of broad required permissions.
    matches: ["https://mail.google.com/*"],
    registration: "runtime",
    runAt: "document_start",
    main() {
        let generation = 0;
        const hostname = location.hostname.toLowerCase();

        const apply = async () => {
            const current = ++generation;
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
            const siteFixes = darkReaderFixesForSite(hostname);
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
            if (settings.followSystem) auto(theme, siteFixes);
            else {
                auto(false);
                enable(theme, siteFixes);
            }
        };

        void apply();
        browser.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && (changes[DARK_SETTINGS_KEY] || changes[MODULES_KEY])) void apply();
        });
    }
});
