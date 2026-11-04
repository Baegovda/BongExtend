import {auto, disable, enable} from "darkreader";
// @ts-ignore settings are plain JS shared with the popup and service worker
import {DARK_SETTINGS_KEY, darkSiteEnabled, darkThemeForSite, normalizeDarkSettings} from "@/modules/dark/settings.js";

const MODULES_KEY = "core.modules";

const pageAlreadyDark = () => {
    if (!document.body) return false;
    const luminance = (value: string) => {
        const match = /rgba?\(([^)]+)\)/i.exec(value);
        if (!match) return null;
        const channels = match[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 4).map(Number);
        if (channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) return null;
        if (channels[3] !== undefined && channels[3] < 0.4) return null;
        const linear = channels.slice(0, 3).map((channel) => {
            const normalized = Math.min(255, Math.max(0, channel)) / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const nodes = [document.documentElement, document.body, ...document.querySelectorAll("main, [role='main'], body > div")].slice(0, 50);
    let darkArea = 0;
    let totalArea = 0;
    for (const node of nodes) {
        const style = getComputedStyle(node);
        const background = luminance(style.backgroundColor);
        const foreground = luminance(style.color);
        if (background === null) continue;
        const rect = node.getBoundingClientRect();
        const area = node === document.documentElement || node === document.body
            ? viewportArea
            : Math.min(viewportArea, Math.max(0, rect.width * rect.height));
        if (area < viewportArea * 0.12) continue;
        totalArea += area;
        if (background < 0.22 && foreground !== null && foreground > 0.48) darkArea += area;
    }
    return totalArea >= viewportArea * 0.2 && darkArea / totalArea >= 0.65;
};

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
            if (settings.detectDarkTheme) {
                if (document.readyState === "loading") {
                    await new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), {once: true}));
                    if (current !== generation) return;
                }
                if (pageAlreadyDark()) {
                    auto(false);
                    disable();
                    return;
                }
            }

            const siteTheme = darkThemeForSite(settings, hostname);
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
            if (settings.followSystem) auto(theme);
            else {
                auto(false);
                enable(theme);
            }
        };

        void apply();
        browser.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && (changes[DARK_SETTINGS_KEY] || changes[MODULES_KEY])) void apply();
        });
    }
});
