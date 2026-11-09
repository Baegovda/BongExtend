// @ts-ignore 순수 JS
import {createChromeEffects} from "@/platform/effects.js";
// @ts-ignore 순수 JS
import {sendExtension} from "@/platform/popup-actions.js";

const effects = createChromeEffects();

type Pane = {id: string; label: string; src?: string};

const PANES: Pane[] = [
    {id: "gmail", label: "메일", src: "/popup.html?embed=gmail"},
    {id: "download", label: "다운로더", src: "/popup.html?embed=download"},
    {id: "fx", label: "환율", src: "/popup.html?embed=fx"},
    {id: "chzzk", label: "치지직", src: "/chzzk/popup.html"},
    {id: "trans", label: "번역", src: "/trans/options/options.html"},
    {id: "dc", label: "디시", src: "/dc-options.html"},
    {id: "right", label: "우클릭"},
    {id: "dark", label: "다크 모드", src: "/popup.html?embed=dark"},
    {id: "update", label: "설정", src: "/popup.html?embed=update"}
];

const nav = document.querySelector<HTMLElement>("#settingsNav")!;
const stage = document.querySelector<HTMLElement>("#settingsStage")!;
let current = "";
let rightTarget: {id: number; origin: string} | null = null;
let rightPaint = 0;

const rightPanel = () => {
    const section = document.createElement("section");
    section.className = "right-panel";
    const title = document.createElement("h1");
    title.textContent = "우클릭";
    const hint = document.createElement("p");
    hint.className = "be-hint";
    hint.textContent = "적용할 웹사이트 탭을 골라 주세요. 막힌 오른쪽 클릭, 복사, 글자 선택을 되살려요.";
    const picker = document.createElement("label");
    picker.className = "right-picker";
    picker.textContent = "열린 웹사이트";
    const select = document.createElement("select");
    select.id = "rightTabSelect";
    select.addEventListener("change", () => void paintRight());
    picker.append(select);
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.textContent = "탭 목록 새로고침";
    refresh.addEventListener("click", () => void loadRightTabs());
    const group = document.createElement("div");
    group.className = "be-group";
    const row = document.createElement("div");
    row.className = "be-row";
    const label = document.createElement("span");
    label.id = "rightLabel";
    label.textContent = "이 사이트";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.id = "rightToggle";
    toggle.setAttribute("aria-label", "이 사이트에서 오른쪽 클릭 되살리기");
    row.append(label, toggle);
    group.append(row);
    const status = document.createElement("p");
    status.className = "be-hint";
    status.id = "rightStatus";
    section.append(title, hint, picker, refresh, group, status);
    toggle.addEventListener("change", () => void applyRight(toggle.checked));
    return section;
};

const loadRightTabs = async () => {
    const select = document.querySelector<HTMLSelectElement>("#rightTabSelect");
    if (!select) return;
    const previous = select.value;
    const tabs = (await effects.tabsQuery({})).filter((tab: chrome.tabs.Tab) => tab.id != null && /^https?:\/\//.test(tab.url || ""));
    tabs.sort((a: chrome.tabs.Tab, b: chrome.tabs.Tab) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    select.replaceChildren(...tabs.map((tab: chrome.tabs.Tab) => {
        const option = document.createElement("option");
        option.value = String(tab.id);
        option.textContent = `${new URL(tab.url!).host} · ${tab.title || "웹사이트"}`;
        return option;
    }));
    if (tabs.some((tab: chrome.tabs.Tab) => String(tab.id) === previous)) select.value = previous;
    await paintRight();
};

const paintRight = async () => {
    const sequence = ++rightPaint;
    const label = document.querySelector("#rightLabel");
    const toggle = document.querySelector<HTMLInputElement>("#rightToggle");
    const status = document.querySelector("#rightStatus");
    if (!label || !toggle || !status) return;
    const id = Number(document.querySelector<HTMLSelectElement>("#rightTabSelect")?.value);
    const tab = (await effects.tabsQuery({})).find((item: chrome.tabs.Tab) => item.id === id);
    const state = await sendExtension(effects, {type: "right-click-state", url: tab?.url || ""}) as {on?: boolean; origin?: string};
    if (sequence !== rightPaint || !toggle.isConnected) return;
    if (!state?.origin) {
        rightTarget = null;
        label.textContent = "이 페이지에서는 바꿀 수 없어요";
        toggle.disabled = true;
        status.textContent = "웹사이트 탭을 연 뒤 ‘탭 목록 새로고침’을 눌러 주세요.";
        return;
    }
    rightTarget = {id: tab!.id!, origin: state.origin};
    label.textContent = state.origin;
    toggle.disabled = false;
    toggle.checked = Boolean(state.on);
    status.textContent = state.on ? "이 사이트에서 오른쪽 클릭을 되살리고 있어요." : "꺼져 있어요.";
};

const applyRight = async (enable: boolean) => {
    const target = rightTarget;
    if (!target) return;
    const toggle = document.querySelector<HTMLInputElement>("#rightToggle");
    const tab = (await effects.tabsQuery({})).find((item: chrome.tabs.Tab) => item.id === target.id);
    if (!tab?.id || !tab.url) return;
    const state = await sendExtension(effects, {type: "right-click-state", url: tab.url}) as {origin?: string};
    if (!state?.origin || state.origin !== target.origin) {
        await loadRightTabs();
        const status = document.querySelector("#rightStatus");
        if (status) status.textContent = "탭 주소가 바뀌었어요. 적용할 사이트를 다시 확인해 주세요.";
        return;
    }
    if (toggle) toggle.disabled = true;
    try {
    let persist = true;
    if (enable) persist = await effects.permissionsRequest({origins: [`${state.origin}/*`]});
    else { try { await effects.permissionsRemove({origins: [`${state.origin}/*`]}); } catch { /* 없음 */ } }
    await sendExtension(effects, {type: "right-click-apply", tabId: tab.id, url: tab.url, enabled: enable, persist});
    } catch {
        const status = document.querySelector("#rightStatus");
        if (status) status.textContent = "설정을 바꾸지 못했어요. 탭을 확인하고 다시 시도해 주세요.";
        if (toggle) { toggle.checked = !enable; toggle.disabled = false; }
        return;
    }
    await paintRight();
};

const show = (id: string) => {
    current = id;
    const pane = PANES.find((item) => item.id === id) || PANES[0];
    nav.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.pane === pane.id));
    stage.replaceChildren();
    if (pane.src) {
        const frame = document.createElement("iframe");
        frame.title = pane.label;
        frame.src = pane.src;
        stage.append(frame);
    } else {
        stage.append(rightPanel());
        void loadRightTabs();
    }
    history.replaceState(null, "", `#${pane.id}`);
};

for (const pane of PANES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.pane = pane.id;
    button.textContent = pane.label;
    button.addEventListener("click", () => show(pane.id));
    nav.append(button);
}

const initial = location.hash.replace("#", "");
show(PANES.some((pane) => pane.id === initial) ? initial : "gmail");
