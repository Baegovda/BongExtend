// 이미지 탭: 이미지 관련 기능 모음. 기능마다 켜고 끌 수 있어요.
// @ts-ignore plain JS shared with the content scripts
import {IMAGE_FEATURES, IMAGE_SETTINGS_KEY, normalizeImageSettings} from "@/modules/image/paste.js";
// @ts-ignore plain JS shared with the content script and worker
import {DEFAULT_ENGINES, formatCustomEngines, normalizeToolbarSettings, parseCustomEngines} from "@/modules/image/toolbar.js";

const LABELS: Record<string, string> = {talk: "네이버 톡톡", lens: "구글 렌즈"};
const ALL_HTTPS = ["https://*/*"];

export function setupImage() {
    const status = document.getElementById("imageStatus")!;
    const inputs = new Map<string, HTMLInputElement>(
        (IMAGE_FEATURES as string[]).map((id) => [id, document.getElementById(`image-${id}`) as HTMLInputElement])
    );
    const toolbarToggle = document.getElementById("image-toolbar") as HTMLInputElement;
    const toolbarState = document.getElementById("imageToolbarState")!;
    const permissionButton = document.getElementById("imageToolbarPermission") as HTMLButtonElement;
    const engineBox = document.getElementById("imageEngines")!;
    const customBox = document.getElementById("imageCustomEngines") as HTMLTextAreaElement;
    const engineSave = document.getElementById("imageEnginesSave") as HTMLButtonElement;

    // 다른 설정(숨긴 사이트 등)을 잃지 않게 저장된 값을 그대로 두고 필요한 칸만 바꿔요.
    const rawSettings = async () => ((await chrome.storage.local.get(IMAGE_SETTINGS_KEY))[IMAGE_SETTINGS_KEY] || {}) as Record<string, unknown>;
    const patchSettings = async (patch: Record<string, unknown>) => chrome.storage.local.set({[IMAGE_SETTINGS_KEY]: {...(await rawSettings()), ...patch}});

    const paintToolbarState = async () => {
        let granted = false;
        try { granted = await chrome.permissions.contains({origins: ALL_HTTPS}); } catch { /* 확인하지 못하면 필요한 것으로 봐요. */ }
        const settings = normalizeToolbarSettings(await rawSettings());
        permissionButton.hidden = granted;
        const parts: string[] = [];
        if (!granted) parts.push("모든 웹사이트에서 쓰려면 허용이 필요해요. 허용하기 전에는 사진 위에 나타나지 않아요.");
        else if (settings.toolbar) parts.push("사용 중이에요. 이미 열려 있는 페이지는 새로고침하면 나타나요.");
        else parts.push("꺼져 있어요.");
        toolbarState.textContent = parts.join(" ");
    };

    const paintEngines = async () => {
        const settings = normalizeToolbarSettings(await rawSettings());
        engineBox.replaceChildren();
        for (const engine of DEFAULT_ENGINES as Array<{id: string; name: string}>) {
            const row = document.createElement("label");
            row.className = "be-row";
            const text = document.createElement("span");
            text.textContent = engine.name;
            const input = document.createElement("input");
            input.type = "checkbox"; input.setAttribute("role", "switch"); input.dataset.engine = engine.id;
            input.checked = !settings.disabledEngines.includes(engine.id);
            input.addEventListener("change", async () => {
                const current = normalizeToolbarSettings(await rawSettings());
                const off = new Set<string>(current.disabledEngines);
                if (input.checked) off.delete(engine.id); else off.add(engine.id);
                await patchSettings({disabledEngines: [...off]});
                status.textContent = `${engine.name}을(를) ${input.checked ? "메뉴에 넣었어요" : "메뉴에서 뺐어요"}.`;
            });
            row.append(text, input);
            engineBox.append(row);
        }
        customBox.value = formatCustomEngines(settings.custom);
    };

    const paint = async () => {
        const raw = await rawSettings();
        const settings = normalizeImageSettings(raw) as Record<string, boolean>;
        for (const [id, input] of inputs) input.checked = settings[id] !== false;
        toolbarToggle.checked = normalizeToolbarSettings(raw).toolbar;
        await paintToolbarState();
        await paintEngines();
    };

    for (const [id, input] of inputs) {
        input.addEventListener("change", async () => {
            const wanted = input.checked;
            input.disabled = true;
            try {
                await patchSettings({[id]: wanted});
                status.textContent = `${LABELS[id]} 이미지 붙여넣기를 ${wanted ? "켰어요" : "껐어요"}. 열려 있는 페이지는 바로 따라와요.`;
            } catch {
                input.checked = !wanted;
                status.textContent = `${LABELS[id]} 설정을 저장하지 못했어요.`;
            } finally { input.disabled = false; }
        });
    }

    toolbarToggle.addEventListener("change", async () => {
        const wanted = toolbarToggle.checked;
        toolbarToggle.disabled = true;
        try {
            await patchSettings({toolbar: wanted});
            status.textContent = `이미지 도구 막대를 ${wanted ? "켰어요" : "껐어요"}.`;
        } catch {
            toolbarToggle.checked = !wanted;
            status.textContent = "이미지 도구 막대 설정을 저장하지 못했어요.";
        } finally { toolbarToggle.disabled = false; await paintToolbarState(); }
    });

    permissionButton.addEventListener("click", async () => {
        try {
            const granted = await chrome.permissions.request({origins: ALL_HTTPS});
            status.textContent = granted ? "허용했어요. 열려 있는 페이지는 새로고침하면 사진 위에 도구 막대가 나와요." : "허용하지 않았어요. 허용해야 모든 웹사이트에서 쓸 수 있어요.";
        } catch { status.textContent = "권한을 요청하지 못했어요."; }
        await paintToolbarState();
    });

    engineSave.addEventListener("click", async () => {
        const rows = parseCustomEngines(customBox.value);
        const lines = customBox.value.split(/\r?\n/).filter((line) => line.trim()).length;
        await patchSettings({custom: rows});
        customBox.value = formatCustomEngines(rows);
        status.textContent = rows.length === lines ? `검색 엔진 ${rows.length}개를 저장했어요.` : `올바른 ${rows.length}개만 저장했어요. 한 줄은 "이름|https://주소...{url}" 모양이어야 해요.`;
    });

    chrome.permissions.onAdded?.addListener(() => void paintToolbarState());
    chrome.permissions.onRemoved?.addListener(() => void paintToolbarState());
    return {show: () => { status.textContent = ""; return paint(); }};
}
