// @ts-ignore plain JS shared with the popup and tests
import {IMAGE_SETTINGS_KEY, featureForHost, handlePaste, normalizeImageSettings} from "@/modules/image/paste.js";

export default defineContentScript({
    matches: [
        "https://talk.naver.com/*",
        "https://partner.talk.naver.com/*",
        "https://lens.google.com/*",
        "https://www.google.com/*",
        "https://images.google.com/*"
    ],
    allFrames: true,
    runAt: "document_idle",
    main() {
        const feature = featureForHost(location.hostname) as string;
        if (!feature) return;
        let settings = normalizeImageSettings(null);
        let enabled = false;
        const load = async () => {
            try {
                const stored = await chrome.storage.local.get([IMAGE_SETTINGS_KEY, "core.modules"]);
                settings = normalizeImageSettings(stored[IMAGE_SETTINGS_KEY]);
                enabled = (stored["core.modules"] as Record<string, unknown> | undefined)?.image !== false;
            } catch { enabled = false; }
        };
        void load();
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && (changes[IMAGE_SETTINGS_KEY] || changes["core.modules"])) void load();
        });

        let toast: HTMLElement | null = null;
        const showToast = () => {
            toast?.remove();
            const note = document.createElement("div");
            note.textContent = "이미지를 붙여 넣었어요";
            note.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;padding:9px 16px;border-radius:12px;font:600 13px/1.2 system-ui,'Malgun Gothic',sans-serif;color:#fff;background:rgba(32,34,40,.82);backdrop-filter:blur(14px);box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none";
            (document.body || document.documentElement).appendChild(note);
            toast = note;
            setTimeout(() => { if (toast === note) { note.remove(); toast = null; } }, 1800);
        };

        const last = {at: 0, name: ""};
        document.addEventListener("paste", (event) => {
            if (!enabled) return;
            handlePaste(event, {settings, feature, doc: document, last, onAttached: showToast});
        });
    }
});
