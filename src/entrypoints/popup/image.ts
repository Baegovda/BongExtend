// 이미지 탭: 이미지 관련 기능 모음. 기능마다 켜고 끌 수 있어요.
// @ts-ignore plain JS shared with the content script
import {IMAGE_FEATURES, IMAGE_SETTINGS_KEY, normalizeImageSettings} from "@/modules/image/paste.js";

const LABELS: Record<string, string> = {talk: "네이버 톡톡", lens: "구글 렌즈"};

export function setupImage() {
    const status = document.getElementById("imageStatus")!;
    const inputs = new Map<string, HTMLInputElement>(
        (IMAGE_FEATURES as string[]).map((id) => [id, document.getElementById(`image-${id}`) as HTMLInputElement])
    );

    const paint = async () => {
        const stored = await chrome.storage.local.get(IMAGE_SETTINGS_KEY);
        const settings = normalizeImageSettings(stored[IMAGE_SETTINGS_KEY]) as Record<string, boolean>;
        for (const [id, input] of inputs) input.checked = settings[id] !== false;
    };

    for (const [id, input] of inputs) {
        input.addEventListener("change", async () => {
            const wanted = input.checked;
            input.disabled = true;
            try {
                const stored = await chrome.storage.local.get(IMAGE_SETTINGS_KEY);
                const next = {...normalizeImageSettings(stored[IMAGE_SETTINGS_KEY]), [id]: wanted};
                await chrome.storage.local.set({[IMAGE_SETTINGS_KEY]: next});
                status.textContent = `${LABELS[id]} 이미지 붙여넣기를 ${wanted ? "켰어요" : "껐어요"}. 열려 있는 페이지는 바로 따라와요.`;
            } catch {
                input.checked = !wanted;
                status.textContent = `${LABELS[id]} 설정을 저장하지 못했어요.`;
            } finally { input.disabled = false; }
        });
    }
    return {show: () => { status.textContent = ""; return paint(); }};
}
