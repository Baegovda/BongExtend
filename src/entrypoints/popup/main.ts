// BongExtend 팝업: 탭 하나에 모듈 화면 하나. 각 모듈 화면은 옛 확장 팝업을 그대로 iframe으로 띄운다.
import "@/modules/theme/theme.css";
import {sendMessage} from "@/http/messaging";
import {isNewerVersion} from "@/core/update/availability";
import {describeUpdateError, promiseWithTimeout, UPDATE_TIMEOUT_MESSAGE, UPDATE_UI_TIMEOUT_MS, UPDATE_UNKNOWN_MESSAGE} from "@/core/update/timeout";
// @ts-ignore 순수 JS
import {getModules, setModuleEnabled} from "@/modules/core-modules.js";
import {moveItem, normalizeTabOrder} from "@/core/popup/tabOrder";
import {exportAllSettings, importSettingsText} from "@/modules/settings-io";
// @ts-ignore 순수 JS
import {COMMON_CODES, CURRENCY_TINT, FX_URL, convertAmount, currencyColor, currencyLabel, currencyName, formatMoney, fxTabBadge, isCacheFresh, parseRatePayload} from "@/modules/fx/convert.js";
// @ts-ignore 순수 JS
import {composite} from "@/modules/theme/contrast.js";
// @ts-ignore 순수 JS
import {dedupeAccounts, mailTabBadge, preferInbox} from "@/modules/gmail/watch.js";
// @ts-ignore 순수 JS
import {ACCOUNT_COLORS, accountColor, accountInitial} from "@/modules/gmail/account-style.js";
// @ts-ignore 순수 JS
import {GMAIL_SOUND_KEY, SOUND_LABELS, SOUND_NAMES, defaultSound, normalizeSound, soundFile} from "@/modules/gmail/sound.js";
// @ts-ignore 순수 JS
import {createChromeEffects} from "@/platform/effects.js";
// @ts-ignore 순수 JS
import {gmailReadAccount, loadJson, openUrl, sendExtension} from "@/platform/popup-actions.js";

const effects = createChromeEffects();

type TabId = "chzzk" | "trans" | "dc" | "gmail" | "fx" | "update";

const FRAMES: Partial<Record<TabId, string>> = {
    chzzk: "/chzzk/popup.html",
    trans: "/trans/popup/popup.html",
    dc: "/dc.html"
};
const NAMES: Partial<Record<TabId, string>> = {chzzk: "치지직", trans: "번역", dc: "디시", gmail: "메일", fx: "환율"};
const TAB_KEY = "core.popupTab";
// 탭 순서. core.* 이라 전체 백업·복원에 포함되고, 디시 초기화(refresher:*)와는 무관.
const ORDER_KEY = "core.popupTabOrder";
const DEFAULT_ORDER: TabId[] = ["chzzk", "trans", "dc", "gmail", "fx"];
const TAB_IDS: TabId[] = [...DEFAULT_ORDER, "update"];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const moduleBar = $("moduleBar");
const moduleSwitch = $<HTMLInputElement>("moduleSwitch");
const moduleLabel = $("moduleLabel");
const moduleNote = $("moduleNote");
let current: TabId = "chzzk";
let pageBeforeSettings: TabId = "chzzk";

const embed = new URLSearchParams(location.search).get("embed");
const embedded = embed === "gmail" || embed === "fx" || embed === "update";

const showTab = async (tab: TabId, persist = true) => {
    if (tab === "update" && current !== "update") pageBeforeSettings = current;
    current = tab;
    document.querySelectorAll<HTMLButtonElement>("#tabGroup button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("settingsGear").classList.toggle("on", tab === "update");
    document.querySelectorAll<HTMLElement>("[data-frame]").forEach((el) => {
        const on = el.dataset.frame === tab;
        if (el instanceof HTMLIFrameElement) {
            const src = FRAMES[el.dataset.frame as TabId];
            if (on && src && !el.src) el.src = src;
            el.classList.toggle("active", on);
            if (el.dataset.frame === "chzzk") el.classList.add("chzzk-frame");
        } else {
            el.hidden = !on;
        }
    });
    if (tab === "gmail") void refreshGmail(false);
    if (tab === "fx") void refreshFx();
    if (tab === "update") {
        moduleBar.hidden = true;
    } else {
        moduleBar.hidden = false;
        const modules = await getModules();
        moduleSwitch.checked = modules[tab] !== false;
        moduleLabel.textContent = `${NAMES[tab] || "모듈"} 모듈 사용`;
        moduleNote.textContent = moduleSwitch.checked ? "" : "꺼져 있어요. 켜면 새로 열거나 새로고침한 페이지부터 적용돼요.";
    }
    if (persist) void effects.storageSet({[TAB_KEY]: tab});
};

// ===== 탭 끌어서 순서 바꾸기 (포인터 이벤트, 의존성 없음) =====
const tabsNav = document.querySelector<HTMLElement>(".tabs")!;
const tabGroup = document.querySelector<HTMLElement>("#tabGroup")!;
const tabButtons = () => [...tabGroup.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
const currentOrder = () => tabButtons().map((b) => b.dataset.tab as TabId);
const applyOrder = (order: TabId[]) => {
    for (const id of order) {
        const b = tabGroup.querySelector(`button[data-tab="${id}"]`);
        if (b) tabGroup.appendChild(b);
    }
};
const saveOrder = () => void effects.storageSet({[ORDER_KEY]: currentOrder()});

let suppressClick = false;
tabButtons().forEach((b) => {
    b.addEventListener("click", (e) => {
        if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; return; }
        void showTab(b.dataset.tab as TabId);
    });
    b.addEventListener("keydown", (e) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        const order = currentOrder();
        const from = order.indexOf(b.dataset.tab as TabId);
        applyOrder(moveItem(order, from, from + (e.key === "ArrowLeft" ? -1 : 1)));
        b.focus();
        saveOrder();
    });
    b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const startX = e.clientX;
        let dragging = false;
        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            if (!dragging) {
                if (Math.abs(dx) < 5) return;
                dragging = true;
                b.setPointerCapture(ev.pointerId);
                b.classList.add("dragging");
                tabsNav.classList.add("reordering");
            }
            // 위치가 바뀌면 끌던 탭이 손가락을 따라오도록 transform 기준점을 다시 잡는다.
            b.style.transform = "";
            const others = tabButtons().filter((x) => x !== b);
            const before = others.find((x) => { const r = x.getBoundingClientRect(); return ev.clientX < r.left + r.width / 2; });
            const prevLeft = b.getBoundingClientRect().left;
            const first = new Map(others.map((x) => [x, x.getBoundingClientRect().left]));
            if (before) { if (b.nextElementSibling !== before) tabGroup.insertBefore(b, before); }
            else if (tabGroup.lastElementChild !== b) tabGroup.appendChild(b);
            // 이웃 탭이 부드럽게 밀려나는 애니메이션 (FLIP)
            for (const [x, left] of first) {
                const d = left - x.getBoundingClientRect().left;
                if (d) x.animate([{transform: `translateX(${d}px)`}, {transform: "none"}], {duration: 150, easing: "ease-out"});
            }
            const shift = b.getBoundingClientRect().left - prevLeft;
            (b as any)._base = ((b as any)._base ?? startX) + shift;
            b.style.transform = `translateX(${ev.clientX - (b as any)._base}px)`;
        };
        const onUp = () => {
            b.removeEventListener("pointermove", onMove);
            b.removeEventListener("pointerup", onUp);
            b.removeEventListener("pointercancel", onUp);
            delete (b as any)._base;
            if (!dragging) return;
            b.classList.remove("dragging");
            tabsNav.classList.remove("reordering");
            b.style.transform = "";
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            saveOrder();
        };
        b.addEventListener("pointermove", onMove);
        b.addEventListener("pointerup", onUp);
        b.addEventListener("pointercancel", onUp);
    });
});
// 로고 더블클릭 = 기본 순서로 되돌리기
document.querySelector(".brand")?.addEventListener("dblclick", () => { applyOrder(DEFAULT_ORDER); saveOrder(); });

moduleSwitch.addEventListener("change", async () => {
    if (current === "update") return;
    await setModuleEnabled(current, moduleSwitch.checked);
    moduleNote.textContent = moduleSwitch.checked
        ? "켰어요. 열려 있는 페이지는 새로고침(F5)하면 적용돼요."
        : "껐어요. 열려 있는 페이지는 새로고침(F5)하면 꺼져요.";
});

// ===== 업데이트 (BongExtend 전체에서 업데이트 UI는 이 탭 하나뿐) =====
type UpdateStatus = {
    currentVersion?: string; latestVersion?: string; updateAvailable?: boolean;
    releaseUrl?: string; downloadUrl?: string; releaseNotes?: string; error?: string;
    lastCheckedAt?: number; autoCheck?: boolean;
};
const updateStatus = $("updateStatus");
const doUpdate = $<HTMLButtonElement>("doUpdate");
const downloadZip = $<HTMLButtonElement>("downloadZip");
const openRelease = $<HTMLButtonElement>("openRelease");
const checkBtn = $<HTMLButtonElement>("checkUpdate");
const autoCheck = $<HTMLInputElement>("autoCheck");
const lastChecked = $("lastChecked");
const notesBox = $("releaseNotesBox");
const notes = $("releaseNotes");
const updateHint = $("updateHint");
const firefoxUpdateNote = $("firefoxUpdateNote");
const firefoxBuild = Boolean(import.meta.env.FIREFOX);
if (firefoxBuild) firefoxUpdateNote.hidden = false;
let releaseUrl = "";
$("ver").textContent = effects.getManifest().version;

const setStatus = (text: string, kind = "") => { updateStatus.textContent = text; updateStatus.className = kind; };

const renderUpdate = (s: UpdateStatus | null | undefined) => {
    if (!s) return;
    const cur = effects.getManifest().version;
    releaseUrl = s.releaseUrl || "";
    const available = Boolean(s.updateAvailable && s.latestVersion && isNewerVersion(s.latestVersion, cur));
    $("updateDot").hidden = !available;
    if (s.error) setStatus(s.error, "error");
    else if (available) setStatus(`${cur} → ${s.latestVersion} 업데이트할 수 있어요`, "ok");
    else if (s.latestVersion) setStatus("최신 버전이에요.");
    if (typeof s.autoCheck === "boolean") autoCheck.checked = s.autoCheck;
    lastChecked.textContent = s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString("ko-KR") : "아직 확인하지 않음";
    doUpdate.hidden = firefoxBuild || !available || !s.downloadUrl;
    downloadZip.hidden = firefoxBuild || !available || !s.downloadUrl;
    openRelease.hidden = !available || !releaseUrl;
    updateHint.hidden = doUpdate.hidden;
    firefoxUpdateNote.hidden = !firefoxBuild;
    notesBox.hidden = !(available && s.releaseNotes);
    notes.textContent = available ? s.releaseNotes || "" : "";
};

const CHECKING = "확인 중…";

const check = async (force: boolean) => {
    if (force) { checkBtn.disabled = true; setStatus(CHECKING); }
    try {
        const status = await promiseWithTimeout(
            sendMessage("checkForUpdate", {force}) as Promise<UpdateStatus>,
            UPDATE_UI_TIMEOUT_MS,
            UPDATE_TIMEOUT_MESSAGE
        );
        renderUpdate(status);
        if (updateStatus.textContent === CHECKING || updateStatus.textContent === "확인 전") {
            setStatus(UPDATE_UNKNOWN_MESSAGE, "error");
        }
    } catch (error) {
        setStatus(describeUpdateError(error), "error");
    } finally {
        if (force) checkBtn.disabled = false;
    }
};

checkBtn.addEventListener("click", () => void check(true));
doUpdate.addEventListener("click", () => void openUrl(effects, effects.getURL("/update.html")));
downloadZip.addEventListener("click", async () => {
    try {
        const r = await sendMessage("applyUpdate", undefined) as {ok: boolean; error?: string};
        if (!r?.ok) setStatus(r?.error || "zip 파일을 받지 못했어요.", "error");
        else setStatus("zip 파일을 받기 시작했어요. 기존 폴더에 압축을 풀어 덮어쓴 뒤 확장 프로그램을 새로고침해 주세요.", "ok");
    } catch {
        setStatus("zip 파일을 받지 못했어요.", "error");
    }
});
openRelease.addEventListener("click", () => { if (releaseUrl) void openUrl(effects, releaseUrl); });
$("manage").addEventListener("click", () => void openUrl(effects, `chrome://extensions/?id=${effects.runtimeId()}`));
autoCheck.addEventListener("change", async () => {
    const want = autoCheck.checked;
    try {
        renderUpdate(await sendMessage("setUpdateAutoCheck", {enabled: want}) as UpdateStatus);
    } catch {
        autoCheck.checked = !want;
        setStatus("자동 확인 설정을 저장하지 못했어요.", "error");
    }
});
$("settingsGear").addEventListener("click", () => {
    void showTab(current === "update" ? pageBeforeSettings : "update");
});

void (async () => {
    try {
        const status = await promiseWithTimeout(
            sendMessage("getUpdateStatus", undefined) as Promise<UpdateStatus>,
            UPDATE_UI_TIMEOUT_MS,
            UPDATE_TIMEOUT_MESSAGE
        );
        renderUpdate(status);
        if (status?.autoCheck) await check(false);
    } catch (error) {
        setStatus(describeUpdateError(error), "error");
    }
})();

// ===== 설정 내보내기·가져오기 =====
const ioStatus = $("ioStatus");
const setIo = (text: string, kind = "") => { ioStatus.textContent = text; ioStatus.className = kind; };
const importFile = $<HTMLInputElement>("importFile");

$("exportAll").addEventListener("click", async () => {
    try {
        const data = await exportAllSettings();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `bongextend-settings-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setIo("설정 파일을 저장했어요. Gemini API 키가 들어 있으니 이 파일은 공유하지 마세요.", "ok");
    } catch (error) {
        setIo(`저장하지 못했어요: ${(error as Error)?.message || error}`, "error");
    }
});

const runImport = async (text: string) => {
    try {
        const result = await importSettingsText(text);
        setIo(`${result.join(", ")} 설정을 불러왔어요. 열려 있는 페이지는 새로고침(F5)해 주세요.`, "ok");
        document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((f) => { if (f.src) f.src = f.src; });
    } catch (error) {
        setIo((error as Error)?.message || "불러오지 못했어요.", "error");
    }
};

$("importAll").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (file) await runImport(await file.text());
});
$("importPaste").addEventListener("click", async () => {
    const text = prompt("불러올 설정(JSON)을 붙여넣어 주세요.");
    if (text) await runImport(text);
});

if (embedded) {
    document.documentElement.classList.add("embed");
    tabsNav.classList.remove("order-pending");
    queueMicrotask(() => { void showTab(embed as TabId, false); });
} else effects.storageGet([TAB_KEY, ORDER_KEY]).then((v: Record<string, unknown>) => {
    applyOrder(normalizeTabOrder(v[ORDER_KEY], DEFAULT_ORDER));
    tabsNav.classList.remove("order-pending");
    const saved = v[TAB_KEY] as TabId | undefined;
    void showTab(saved && TAB_IDS.includes(saved) ? saved : "chzzk");
});

type GmailMessage = {
    id: string; thread: string; subject: string; snippet: string;
    fromName: string; fromEmail: string; issued: string; link: string;
};
type GmailAccount = {index: number; email: string; unread: number; enabled?: boolean; messages: GmailMessage[]};
type GmailSnapshot = {checkedAt?: number; loggedOut?: boolean; unread?: number; accounts?: GmailAccount[]};

const paintMailBadge = (accounts: GmailAccount[] | undefined, disabled: unknown) => {
    const badge = $("mailBadge");
    if (!badge) return;
    const text = mailTabBadge(accounts, Array.isArray(disabled) ? disabled : []) as string;
    badge.textContent = text;
    badge.hidden = !text;
};

const gmailStatus = $("gmailStatus");
const gmailList = $("gmailList");
const gmailAccounts = $("gmailAccounts");
const gmailAccount = $("gmailAccount");
const gmailSend = (message: Record<string, unknown>) => sendExtension(effects, message) as Promise<{
    snapshot?: GmailSnapshot | null; error?: string; ok?: boolean;
}>;

let gmailView: GmailSnapshot | null = null;
let gmailPhotos: Record<string, string> = {};
let gmailColors: Record<string, string> = {};

const readMark = () => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("aria-hidden", "true");
    const mark = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mark.setAttribute("d", "M5 12.5 9.2 17 19 7");
    mark.setAttribute("fill", "none");
    mark.setAttribute("stroke", "currentColor");
    mark.setAttribute("stroke-width", "2.2");
    mark.setAttribute("stroke-linecap", "round");
    mark.setAttribute("stroke-linejoin", "round");
    icon.append(mark);
    return icon;
};

const renderGmail = (snapshot: GmailSnapshot | null | undefined, error = "") => {
    const view = preferInbox(snapshot, gmailView) as GmailSnapshot | null;
    if (view) gmailView = view;
    const accounts = dedupeAccounts(view?.accounts || []) as GmailAccount[];
    const unread = accounts.filter((item) => item.enabled !== false).reduce((sum, item) => sum + (Number(item.unread) || 0), 0);
    gmailAccounts.replaceChildren();
    gmailList.replaceChildren();
    for (const item of accounts) {
        const email = item.email || `계정 ${item.index + 1}`;
        const color = accountColor(email, gmailColors) as string;
        const section = document.createElement("section");
        section.className = "mail-section";
        section.style.setProperty("--account-accent", color);
        const head = document.createElement("div");
        head.className = "mail-head";
        const avatar = document.createElement("span");
        avatar.className = "mail-avatar";
        const photo = gmailPhotos[email.toLowerCase()];
        if (photo) {
            const img = document.createElement("img");
            img.alt = "";
            img.src = photo;
            avatar.append(img);
        } else avatar.textContent = accountInitial(email) as string;
        const who = document.createElement("div");
        who.className = "mail-who";
        const title = document.createElement("strong");
        title.textContent = email;
        const count = document.createElement("span");
        count.textContent = `읽지 않은 메일 ${item.unread}통`;
        who.append(title, count);
        const readAll = document.createElement("button");
        readAll.type = "button";
        readAll.className = "mail-read";
        readAll.title = "모두 읽음";
        readAll.setAttribute("aria-label", "모두 읽음");
        readAll.disabled = !(item.messages || []).length;
        readAll.append(readMark());
        readAll.addEventListener("click", () => void readAccount(item.index));
        head.append(avatar, who, readAll);
        const list = document.createElement("ul");
        list.className = "mail-list be-group";
        for (const message of item.messages || []) {
            const li = document.createElement("li");
            const from = document.createElement("strong");
            from.textContent = message.fromName || message.fromEmail || "보낸 사람 없음";
            const subject = document.createElement("div");
            subject.textContent = message.subject;
            const snippet = document.createElement("p");
            snippet.className = "mail-snippet";
            snippet.textContent = message.snippet;
            const actions = document.createElement("div");
            actions.className = "be-actions";
            const add = (label: string, run: () => void) => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = label;
                button.addEventListener("click", run);
                actions.appendChild(button);
            };
            add("읽음", () => void runGmailAct(item.index, message, "read"));
            add("보관", () => void runGmailAct(item.index, message, "archive"));
            add("삭제", () => void runGmailAct(item.index, message, "trash"));
            add("답장", () => {
                const url = new URL("https://mail.google.com/mail/");
                url.searchParams.set("view", "cm");
                url.searchParams.set("fs", "1");
                url.searchParams.set("tf", "1");
                if (message.fromEmail) url.searchParams.set("to", message.fromEmail);
                url.searchParams.set("su", message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`);
                void openUrl(effects, `https://mail.google.com/mail/u/${item.index}/${url.search}`);
            });
            add("열기", () => { if (message.link) void openUrl(effects, message.link); });
            li.append(from, subject, snippet, actions);
            list.append(li);
        }
        section.append(head, list);
        gmailAccounts.appendChild(section);
    }
    if (error) gmailStatus.textContent = error;
    else if (view?.loggedOut) gmailStatus.textContent = "Gmail에 로그인되어 있지 않아요.";
    else if (!accounts.length) gmailStatus.textContent = "읽지 않은 메일이 없어요.";
    else gmailStatus.textContent = `읽지 않은 메일 ${unread}통`;
    gmailAccount.textContent = accounts.length > 1 ? `계정 ${accounts.length}개` : (accounts[0]?.email || "Gmail 받은편지함");
    paintMailBadge(accounts, accounts.filter((item) => item.enabled === false).map((item) => item.index));
    paintSoundAccounts(accounts);
};

const refreshGmail = async (force: boolean) => {
    gmailStatus.textContent = "확인 중…";
    try {
        const result = await gmailSend({type: force ? "gmail-refresh" : "gmail-get"});
        renderGmail(result?.snapshot, result?.error || "");
    } catch (error) {
        gmailStatus.textContent = (error as Error)?.message || "메일을 확인하지 못했어요.";
    }
};

const readAccount = async (account: number) => {
    gmailStatus.textContent = "모두 읽음으로 바꾸는 중…";
    try {
        const result = await gmailReadAccount(effects, account) as {ok?: boolean; error?: string; snapshot?: GmailSnapshot | null};
        if (!result?.ok) gmailStatus.textContent = result?.error || "메일을 바꾸지 못했어요.";
        renderGmail(result?.snapshot, result?.ok ? "" : (result?.error || ""));
    } catch (error) {
        gmailStatus.textContent = (error as Error)?.message || "메일을 바꾸지 못했어요.";
    }
};

const runGmailAct = async (account: number, message: GmailMessage, action: string) => {
    gmailStatus.textContent = "Gmail에 반영하는 중…";
    try {
        const result = await gmailSend({type: "gmail-act", account, thread: message.thread, action});
        if (!result?.ok) gmailStatus.textContent = result?.error || "Gmail에 반영하지 못했어요.";
        renderGmail(result?.snapshot, result?.ok ? "" : (result?.error || ""));
    } catch (error) {
        gmailStatus.textContent = (error as Error)?.message || "Gmail에 반영하지 못했어요.";
    }
};

$("gmailRefresh").addEventListener("click", () => void refreshGmail(true));

const gmailSound = $("gmailSound");
const soundState = {...defaultSound()};
const paintSoundAccounts = (accounts: GmailAccount[]) => {
    const colors = gmailSound.querySelector(".mail-account-colors");
    if (!colors) return;
    colors.replaceChildren();
    for (const item of accounts) {
        const email = (item.email || "").toLowerCase();
        if (!email) continue;
        const row = document.createElement("div");
        row.className = "be-row";
        const name = document.createElement("span");
        name.textContent = item.email;
        const alert = document.createElement("label");
        alert.className = "mail-alert";
        const alertText = document.createElement("span");
        alertText.textContent = "알림";
        const alertToggle = document.createElement("input");
        alertToggle.type = "checkbox";
        alertToggle.checked = item.enabled !== false;
        alertToggle.setAttribute("aria-label", `${item.email} 알림`);
        alertToggle.addEventListener("change", () => void saveGmailAccount(item.index, alertToggle.checked));
        alert.append(alertText, alertToggle);
        const picks = document.createElement("div");
        picks.className = "mail-colors";
        const current = accountColor(email, gmailColors) as string;
        for (const color of ACCOUNT_COLORS as string[]) {
            const button = document.createElement("button");
            button.type = "button";
            button.style.background = color;
            button.classList.toggle("on", color === current);
            button.title = "이 계정 색";
            button.setAttribute("aria-label", `${item.email} 색`);
            button.addEventListener("click", () => {
                gmailColors = {...gmailColors, [email]: color};
                void effects.storageSet({["gmail.accountColors"]: gmailColors});
                renderGmail(gmailView);
            });
            picks.append(button);
        }
        row.append(name, alert, picks);
        colors.append(row);
    }
};
if (embed === "gmail") {
    gmailSound.hidden = false;
    const title = document.createElement("h4");
    title.textContent = "새 메일 소리";
    const onRow = document.createElement("label");
    const onText = document.createElement("span");
    onText.textContent = "소리 켜기";
    const onToggle = document.createElement("input");
    onToggle.type = "checkbox";
    onToggle.checked = true;
    onToggle.setAttribute("role", "switch");
    onToggle.setAttribute("aria-label", "새 메일 소리");
    onRow.append(onText, onToggle);
    const nameRow = document.createElement("label");
    const nameText = document.createElement("span");
    nameText.textContent = "소리";
    const nameSelect = document.createElement("select");
    nameSelect.setAttribute("aria-label", "알림 소리");
    for (const name of SOUND_NAMES as string[]) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = (SOUND_LABELS as Record<string, string>)[name];
        nameSelect.append(option);
    }
    nameRow.append(nameText, nameSelect);
    const volumeRow = document.createElement("label");
    const volumeText = document.createElement("span");
    volumeText.textContent = "크기";
    const volume = document.createElement("input");
    volume.type = "range";
    volume.min = "0";
    volume.max = "100";
    volume.value = "40";
    volume.setAttribute("aria-label", "알림 소리 크기");
    volumeRow.append(volumeText, volume);
    const preview = document.createElement("button");
    preview.type = "button";
    preview.textContent = "미리 듣기";
    const colors = document.createElement("div");
    colors.className = "mail-account-colors";
    const saveSound = () => {
        soundState.on = onToggle.checked;
        soundState.name = nameSelect.value;
        soundState.volume = Number(volume.value) / 100;
        void effects.storageSet({[GMAIL_SOUND_KEY]: {...soundState}});
    };
    const playPreview = async () => {
        saveSound();
        const played = await sendExtension(effects, {type: "gmail-play-sound", name: soundState.name, volume: soundState.volume}).catch(() => null) as {ok?: boolean} | null;
        if (played?.ok) return;
        const audio = new Audio(effects.getURL(soundFile(soundState.name)));
        audio.volume = soundState.volume;
        await audio.play().catch(() => {});
    };
    onToggle.addEventListener("change", saveSound);
    nameSelect.addEventListener("change", saveSound);
    volume.addEventListener("change", saveSound);
    preview.addEventListener("click", () => void playPreview());
    const colorTitle = document.createElement("h4");
    colorTitle.textContent = "계정 알림과 색";
    gmailSound.append(title, onRow, nameRow, volumeRow, preview, colorTitle, colors);
    void effects.storageGet(GMAIL_SOUND_KEY).then((stored: Record<string, unknown>) => {
        const sound = normalizeSound(stored[GMAIL_SOUND_KEY]) as {on: boolean; name: string; volume: number};
        Object.assign(soundState, sound);
        onToggle.checked = sound.on;
        nameSelect.value = sound.name;
        volume.value = String(Math.round(sound.volume * 100));
    });
}
void effects.storageGet(["gmail.photos", "gmail.accountColors"]).then((stored: Record<string, unknown>) => {
    gmailPhotos = (stored["gmail.photos"] || {}) as Record<string, string>;
    gmailColors = (stored["gmail.accountColors"] || {}) as Record<string, string>;
    if (gmailView) renderGmail(gmailView);
});
$("gmailLatency").textContent = "Gmail 탭이 없어도 로그인된 계정을 모두 확인해요. 기본 8초마다 받은편지함 피드만 보고, 자리를 비우거나 화면이 잠기면 더 천천히 봐요. 알림을 끄면 확인을 멈춰요. 한 계정의 알림만 빼려면 설정 화면의 메일에서 그 계정 알림을 끄세요. 다른 계정을 더하려면 Gmail 오른쪽 위 프로필 사진에서 계정 추가로 로그인하세요. 그러면 여기 목록에 나타나요. 답장은 Gmail 창에서 보내야 보낸편지함과 같아요.";

const gmailInterval = $<HTMLInputElement>("gmailInterval");
const gmailNotify = $<HTMLInputElement>("gmailNotify");
const saveGmailWatch = async () => {
    const seconds = Math.min(60, Math.max(5, Number(gmailInterval.value) || 8));
    gmailInterval.value = String(seconds);
    const stored = await effects.storageGet("gmail.disabled");
    await sendExtension(effects, {
        type: "gmail-config",
        notify: gmailNotify.checked,
        intervalMs: seconds * 1000,
        disabled: Array.isArray(stored["gmail.disabled"]) ? stored["gmail.disabled"] : []
    });
};
const saveGmailAccount = async (index: number, enabled: boolean) => {
    const stored = await effects.storageGet("gmail.disabled");
    const disabled = new Set<number>(Array.isArray(stored["gmail.disabled"]) ? stored["gmail.disabled"] : []);
    if (enabled) disabled.delete(index);
    else disabled.add(index);
    await sendExtension(effects, {
        type: "gmail-config",
        notify: gmailNotify.checked,
        intervalMs: Number(gmailInterval.value) * 1000,
        disabled: [...disabled]
    });
    void refreshGmail(true);
};
gmailInterval.addEventListener("change", () => void saveGmailWatch());
gmailNotify.addEventListener("change", () => void saveGmailWatch());
effects.storageGet(["gmail.snapshot", "gmail.disabled"]).then((stored: Record<string, unknown>) => {
    const snapshot = stored["gmail.snapshot"] as GmailSnapshot | undefined;
    paintMailBadge(snapshot?.accounts, stored["gmail.disabled"]);
});
effects.storageGet(["gmail.intervalMs", "gmail.notify"]).then((stored: Record<string, unknown>) => {
    if (typeof stored["gmail.intervalMs"] === "number") gmailInterval.value = String(Math.round(stored["gmail.intervalMs"] / 1000));
    gmailNotify.checked = stored["gmail.notify"] !== false;
});
effects.storageOnChanged((changes: Record<string, {newValue?: unknown}>, area: string) => {
    if (area !== "local") return;
    if (changes["gmail.photos"]) gmailPhotos = (changes["gmail.photos"].newValue || {}) as Record<string, string>;
    if (changes["gmail.accountColors"]) gmailColors = (changes["gmail.accountColors"].newValue || {}) as Record<string, string>;
    if (changes[GMAIL_SOUND_KEY] && embed === "gmail") {
        const sound = normalizeSound(changes[GMAIL_SOUND_KEY].newValue) as {on: boolean; name: string; volume: number};
        const box = $("gmailSound");
        const toggle = box.querySelector<HTMLInputElement>("input[type=checkbox]");
        const select = box.querySelector<HTMLSelectElement>("select");
        const range = box.querySelector<HTMLInputElement>("input[type=range]");
        if (toggle) toggle.checked = sound.on;
        if (select) select.value = sound.name;
        if (range) range.value = String(Math.round(sound.volume * 100));
    }
    if (changes["gmail.snapshot"] || changes["gmail.disabled"]) {
        effects.storageGet(["gmail.snapshot", "gmail.disabled"]).then((stored: Record<string, unknown>) => {
            const snapshot = (stored["gmail.snapshot"] || changes["gmail.snapshot"]?.newValue) as GmailSnapshot | undefined;
            paintMailBadge(snapshot?.accounts, stored["gmail.disabled"]);
        });
    }
    if ((changes["gmail.snapshot"] || changes["gmail.photos"] || changes["gmail.accountColors"]) && (current === "gmail" || embed === "gmail")) {
        renderGmail((changes["gmail.snapshot"]?.newValue as GmailSnapshot) || gmailView);
    }
    if (changes["fx.table"]) paintFxBadge((changes["fx.table"].newValue as FxTable | undefined)?.rates);
    if (changes["core.update:available"]) {
        $("updateDot").hidden = changes["core.update:available"].newValue !== true;
    }
});

type FxTable = {base: string; date: string; rates: Record<string, number>; fetchedAt: number};
const FX_KEY = "fx.table";
const fxAmount = $<HTMLInputElement>("fxAmount");
const fxFrom = $<HTMLSelectElement>("fxFrom");
const fxTo = $<HTMLSelectElement>("fxTo");
const fxResult = $("fxResult");
const fxMore = $("fxMore");
const fxStatus = $("fxStatus");
let fxTable: FxTable | null = null;

const paintFxBadge = (rates: Record<string, number> | undefined) => {
    const badge = $("fxBadge");
    if (!badge) return;
    const text = fxTabBadge(rates) as string;
    badge.textContent = text;
    badge.hidden = !text;
};

const fxSurface = () => window.matchMedia("(prefers-color-scheme: light)").matches ? "#ffffff" : "#2c2c2e";

const fillFxSelects = (codes: string[]) => {
    const have = new Set(codes);
    const ordered = [...(COMMON_CODES as string[]).filter((code) => have.has(code)), ...codes.filter((code) => !(COMMON_CODES as string[]).includes(code)).sort()];
    const selected = {from: fxFrom.value || "krw", to: fxTo.value || "usd"};
    for (const select of [fxFrom, fxTo]) {
        select.replaceChildren();
        for (const code of ordered) {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = currencyLabel(code);
            select.appendChild(option);
        }
    }
    fxFrom.value = ordered.includes(selected.from) ? selected.from : ordered[0] || "";
    fxTo.value = ordered.includes(selected.to) ? selected.to : (ordered.find((code) => code !== fxFrom.value) || ordered[0] || "");
};

const renderFx = () => {
    paintFxBadge(fxTable?.rates);
    fxMore.replaceChildren();
    if (!fxTable) {
        fxResult.textContent = "환율표를 아직 받지 못했어요.";
        return;
    }
    const amount = Number(fxAmount.value);
    const value = convertAmount(amount, fxFrom.value, fxTo.value, fxTable.rates);
    fxResult.textContent = value == null ? "이 통화는 표에 없어요." : `${formatMoney(amount, fxFrom.value)} ${fxFrom.value.toUpperCase()} = ${formatMoney(value, fxTo.value)} ${fxTo.value.toUpperCase()}`;
    const surface = fxSurface();
    for (const code of COMMON_CODES as string[]) {
        const other = convertAmount(amount, fxFrom.value, code, fxTable.rates);
        if (other == null) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fx-chip";
        if (code === fxTo.value) button.classList.add("on");
        const flag = currencyColor(code) as string;
        button.style.setProperty("--fx-flag", flag);
        button.style.background = composite(flag, surface, CURRENCY_TINT) as string;
        const name = document.createElement("small");
        name.textContent = currencyName(code) as string;
        const money = document.createElement("b");
        money.textContent = formatMoney(other, code);
        button.append(name, money);
        button.addEventListener("click", () => {
            if ([...fxTo.options].some((option) => option.value === code)) fxTo.value = code;
            renderFx();
        });
        fxMore.appendChild(button);
    }
    fxStatus.textContent = fxTable.date ? `${fxTable.date} 시세 · 실시간은 아니에요` : "하루 한 번 바뀌는 시세예요";
};

const refreshFx = async () => {
    const stored = await effects.storageGet(FX_KEY);
    const cached = stored[FX_KEY] as FxTable | undefined;
    if (cached?.rates && isCacheFresh(cached.fetchedAt)) {
        fxTable = cached;
        fillFxSelects(Object.keys(cached.rates).sort());
        renderFx();
        return;
    }
    fxStatus.textContent = "환율표를 받는 중…";
    try {
        const parsed = parseRatePayload(await loadJson(effects, FX_URL)) as FxTable | null;
        if (!parsed) throw new Error("표 형식");
        fxTable = parsed;
        await effects.storageSet({[FX_KEY]: parsed});
        fillFxSelects(Object.keys(parsed.rates).sort());
        renderFx();
        paintFxBadge(parsed.rates);
    } catch (error) {
        if (cached?.rates) {
            fxTable = cached;
            fillFxSelects(Object.keys(cached.rates).sort());
            renderFx();
            fxStatus.textContent = "새 시세를 받지 못해 저장해 둔 표를 보여 줘요.";
            return;
        }
        fxResult.textContent = "환율표를 받지 못했어요.";
        fxStatus.textContent = (error as Error)?.message || "";
    }
};

const rightClick = $<HTMLButtonElement>("rightClick");
const paintRightClick = (on: boolean) => {
    rightClick.classList.toggle("on", on);
    rightClick.setAttribute("aria-pressed", on ? "true" : "false");
    rightClick.title = on
        ? "이 사이트에서 오른쪽 클릭을 되살리고 있어요. 누르면 꺼요."
        : "이 사이트에서 오른쪽 클릭, 복사, 글자 선택을 되살려요.";
};
const activePage = async () => {
    const [tab] = await effects.tabsQuery({active: true, currentWindow: true});
    return tab;
};
const syncRightClick = async () => {
    const tab = await activePage();
    const result = await sendExtension(effects, {type: "right-click-state", url: tab?.url || ""}) as {on?: boolean};
    paintRightClick(Boolean(result?.on));
};
rightClick.addEventListener("click", async () => {
    const tab = await activePage();
    if (!tab?.id || !tab.url) return;
    const state = await sendExtension(effects, {type: "right-click-state", url: tab.url}) as {on?: boolean; origin?: string};
    if (!state?.origin) {
        rightClick.title = "이 페이지에서는 오른쪽 클릭을 바꿀 수 없어요.";
        return;
    }
    const enable = !state.on;
    let persist = true;
    if (enable) {
        try {
            persist = await effects.permissionsRequest({origins: [`${state.origin}/*`]});
            if (!persist) rightClick.title = "이번 탭만 적용했어요. 다음 방문에도 쓰려면 사이트 권한을 허용해 주세요.";
        } catch {
            persist = false;
            rightClick.title = "이번 탭만 적용했어요.";
        }
    } else {
        try { await effects.permissionsRemove({origins: [`${state.origin}/*`]}); } catch { /* 이미 없는 권한 */ }
    }
    const result = await sendExtension(effects, {type: "right-click-apply", tabId: tab.id, url: tab.url, enabled: enable, persist}) as {ok?: boolean; on?: boolean; error?: string};
    if (!result?.ok) {
        rightClick.title = result?.error || "적용하지 못했어요.";
        return;
    }
    paintRightClick(Boolean(result.on));
});
void syncRightClick();

fxAmount.addEventListener("input", renderFx);
fxFrom.addEventListener("change", renderFx);
fxTo.addEventListener("change", renderFx);
$("fxSwap").addEventListener("click", () => {
    const next = fxFrom.value;
    fxFrom.value = fxTo.value;
    fxTo.value = next;
    renderFx();
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (fxTable) renderFx(); });
effects.storageGet(FX_KEY).then((stored: Record<string, unknown>) => {
    const cached = stored[FX_KEY] as FxTable | undefined;
    paintFxBadge(cached?.rates);
});
