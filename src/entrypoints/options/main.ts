// @ts-ignore 순수 JS
import {createChromeEffects} from "@/platform/effects.js";
// @ts-ignore 순수 JS
import {sendExtension} from "@/platform/popup-actions.js";

const effects = createChromeEffects();

type Pane = {id: string; label: string; src?: string};

const PANES: Pane[] = [
    {id: "gmail", label: "메일", src: "/popup.html?embed=gmail"},
    {id: "fx", label: "환율", src: "/popup.html?embed=fx"},
    {id: "chzzk", label: "치지직", src: "/chzzk/popup.html"},
    {id: "trans", label: "번역", src: "/trans/options/options.html"},
    {id: "dc", label: "디시", src: "/dc-options.html"},
    {id: "right", label: "우클릭"},
    {id: "update", label: "설정", src: "/popup.html?embed=update"}
];

const nav = document.querySelector<HTMLElement>("#settingsNav")!;
const stage = document.querySelector<HTMLElement>("#settingsStage")!;
let current = "";

const rightPanel = () => {
    const section = document.createElement("section");
    section.className = "right-panel";
    const title = document.createElement("h1");
    title.textContent = "우클릭";
    const hint = document.createElement("p");
    hint.className = "be-hint";
    hint.textContent = "지금 보고 있는 사이트에서 막힌 오른쪽 클릭, 복사, 글자 선택을 되살려요. 팝업 오른쪽 끝의 마우스 그림과 같은 설정이에요.";
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
    section.append(title, hint, group, status);
    toggle.addEventListener("change", () => void applyRight(toggle.checked));
    return section;
};

const paintRight = async () => {
    const label = document.querySelector("#rightLabel");
    const toggle = document.querySelector<HTMLInputElement>("#rightToggle");
    const status = document.querySelector("#rightStatus");
    if (!label || !toggle || !status) return;
    const [tab] = await effects.tabsQuery({active: true, currentWindow: true});
    const state = await sendExtension(effects, {type: "right-click-state", url: tab?.url || ""}) as {on?: boolean; origin?: string};
    if (!state?.origin) {
        label.textContent = "이 페이지에서는 바꿀 수 없어요";
        toggle.disabled = true;
        status.textContent = "일반 웹사이트 탭을 연 다음 다시 열어 주세요.";
        return;
    }
    label.textContent = state.origin;
    toggle.disabled = false;
    toggle.checked = Boolean(state.on);
    status.textContent = state.on ? "이 사이트에서 오른쪽 클릭을 되살리고 있어요." : "꺼져 있어요.";
};

const applyRight = async (enable: boolean) => {
    const [tab] = await effects.tabsQuery({active: true, currentWindow: true});
    if (!tab?.id || !tab.url) return;
    const state = await sendExtension(effects, {type: "right-click-state", url: tab.url}) as {origin?: string};
    if (!state?.origin) return;
    let persist = true;
    if (enable) persist = await effects.permissionsRequest({origins: [`${state.origin}/*`]});
    else { try { await effects.permissionsRemove({origins: [`${state.origin}/*`]}); } catch { /* 없음 */ } }
    await sendExtension(effects, {type: "right-click-apply", tabId: tab.id, url: tab.url, enabled: enable, persist});
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
        void paintRight();
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
