// @ts-ignore MIT-licensed upstream proxy, kept in sync by scripts/sync-darkreader-proxy.cjs
import {injectProxy} from "@/modules/dark/proxy.js";

export default defineContentScript({
    matches: ["https://mail.google.com/*"],
    registration: "runtime",
    world: "MAIN",
    runAt: "document_start",
    main() {
        const scope = globalThis as unknown as Record<string, unknown>;
        if (scope.__bongextendDarkProxy) return;
        scope.__bongextendDarkProxy = true;
        const start = (detail: string | null) => {
            try {
                const options = JSON.parse(detail || "null");
                if (typeof options?.enableStyleSheetsProxy !== "boolean" ||
                    typeof options?.enableCustomElementRegistryProxy !== "boolean") return;
                injectProxy(options.enableStyleSheetsProxy, options.enableCustomElementRegistryProxy);
            } catch { /* Ignore malformed page events; no extension privileges are exposed here. */ }
        };
        document.addEventListener("__bongextend_dark_proxy_start", event => start((event as CustomEvent<string>).detail));
        // Handles runtime injection after the isolated script has already enabled the theme.
        start(document.documentElement?.getAttribute("data-bong-dark-proxy") || null);
    }
});
