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
import {COMMON_CODES, FX_URL, convertAmount, currencyLabel, formatMoney, isCacheFresh, parseRatePayload} from "@/modules/fx/convert.js";

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
const DEFAULT_ORDER: TabId[] = ["chzzk", "trans", "dc", "gmail", "fx", "update"];
const TAB_IDS: TabId[] = [...DEFAULT_ORDER];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const moduleBar = $("moduleBar");
const moduleSwitch = $<HTMLInputElement>("moduleSwitch");
const moduleLabel = $("moduleLabel");
const moduleNote = $("moduleNote");
let current: TabId = "chzzk";

const showTab = async (tab: TabId) => {
    current = tab;
    document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
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
    void chrome.storage.local.set({[TAB_KEY]: tab});
};

// ===== 탭 끌어서 순서 바꾸기 (포인터 이벤트, 의존성 없음) =====
const tabsNav = document.querySelector<HTMLElement>(".tabs")!;
const tabButtons = () => [...tabsNav.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
const currentOrder = () => tabButtons().map((b) => b.dataset.tab as TabId);
const applyOrder = (order: TabId[]) => {
    for (const id of order) {
        const b = tabsNav.querySelector(`button[data-tab="${id}"]`);
        if (b) tabsNav.appendChild(b);
    }
};
const saveOrder = () => void chrome.storage.local.set({[ORDER_KEY]: currentOrder()});

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
            if (before) { if (b.nextElementSibling !== before) tabsNav.insertBefore(b, before); }
            else if (tabsNav.lastElementChild !== b) tabsNav.appendChild(b);
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
$("ver").textContent = chrome.runtime.getManifest().version;

const setStatus = (text: string, kind = "") => { updateStatus.textContent = text; updateStatus.className = kind; };

const renderUpdate = (s: UpdateStatus | null | undefined) => {
    if (!s) return;
    const cur = chrome.runtime.getManifest().version;
    releaseUrl = s.releaseUrl || "";
    const available = Boolean(s.updateAvailable && s.latestVersion && isNewerVersion(s.latestVersion, cur));
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
doUpdate.addEventListener("click", () => void chrome.tabs.create({url: chrome.runtime.getURL("/update.html")}));
downloadZip.addEventListener("click", async () => {
    try {
        const r = await sendMessage("applyUpdate", undefined) as {ok: boolean; error?: string};
        if (!r?.ok) setStatus(r?.error || "zip 파일을 받지 못했어요.", "error");
        else setStatus("zip 파일을 받기 시작했어요. 기존 폴더에 압축을 풀어 덮어쓴 뒤 확장 프로그램을 새로고침해 주세요.", "ok");
    } catch {
        setStatus("zip 파일을 받지 못했어요.", "error");
    }
});
openRelease.addEventListener("click", () => { if (releaseUrl) void chrome.tabs.create({url: releaseUrl}); });
$("manage").addEventListener("click", () => void chrome.tabs.create({url: `chrome://extensions/?id=${chrome.runtime.id}`}));
autoCheck.addEventListener("change", async () => {
    const want = autoCheck.checked;
    try {
        renderUpdate(await sendMessage("setUpdateAutoCheck", {enabled: want}) as UpdateStatus);
    } catch {
        autoCheck.checked = !want;
        setStatus("자동 확인 설정을 저장하지 못했어요.", "error");
    }
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

chrome.storage.local.get([TAB_KEY, ORDER_KEY]).then((v) => {
    applyOrder(normalizeTabOrder(v[ORDER_KEY], DEFAULT_ORDER));
    tabsNav.classList.remove("order-pending");
    const saved = v[TAB_KEY] as TabId | undefined;
    void showTab(saved && TAB_IDS.includes(saved) ? saved : "chzzk");
});

type GmailMessage = {
    id: string; thread: string; subject: string; snippet: string;
    fromName: string; fromEmail: string; issued: string; link: string;
};
type GmailAccount = {index: number; email: string; unread: number; messages: GmailMessage[]};
type GmailSnapshot = {checkedAt?: number; loggedOut?: boolean; unread?: number; accounts?: GmailAccount[]};

const gmailStatus = $("gmailStatus");
const gmailList = $("gmailList");
const gmailAccounts = $("gmailAccounts");
const gmailAccount = $("gmailAccount");
let gmailShown = 0;

const gmailSend = (message: Record<string, unknown>) => chrome.runtime.sendMessage(message) as Promise<{
    snapshot?: GmailSnapshot | null; error?: string; ok?: boolean;
}>;

const renderGmail = (snapshot: GmailSnapshot | null | undefined, error = "") => {
    const accounts = snapshot?.accounts || [];
    if (!accounts.length) gmailShown = 0;
    else if (!accounts.some((account) => account.index === gmailShown)) gmailShown = accounts[0].index;
    const account = accounts.find((item) => item.index === gmailShown) || accounts[0];
    gmailAccounts.replaceChildren();
    for (const item of accounts) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.email || `계정 ${item.index + 1}`;
        if (item.index === account?.index) button.className = "primary";
        button.addEventListener("click", () => { gmailShown = item.index; renderGmail(snapshot, error); });
        gmailAccounts.appendChild(button);
    }
    if (error) gmailStatus.textContent = error;
    else if (snapshot?.loggedOut) gmailStatus.textContent = "Gmail에 로그인되어 있지 않아요.";
    else if (!account) gmailStatus.textContent = "읽지 않은 메일이 없어요.";
    else gmailStatus.textContent = account.email
        ? `${account.email} · 읽지 않은 메일 ${account.unread}통`
        : `읽지 않은 메일 ${account.unread}통`;
    gmailAccount.textContent = account?.email || "Gmail 받은편지함";
    gmailList.replaceChildren();
    for (const message of account?.messages || []) {
        const li = document.createElement("li");
        const who = document.createElement("strong");
        who.textContent = message.fromName || message.fromEmail || "보낸 사람 없음";
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
        add("읽음", () => void gmailAct(account.index, message, "read"));
        add("보관", () => void gmailAct(account.index, message, "archive"));
        add("삭제", () => void gmailAct(account.index, message, "trash"));
        add("답장", () => {
            const url = new URL("https://mail.google.com/mail/");
            url.searchParams.set("view", "cm");
            url.searchParams.set("fs", "1");
            url.searchParams.set("tf", "1");
            if (message.fromEmail) url.searchParams.set("to", message.fromEmail);
            url.searchParams.set("su", message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`);
            void chrome.tabs.create({url: `https://mail.google.com/mail/u/${account.index}/${url.search}`});
        });
        add("열기", () => { if (message.link) void chrome.tabs.create({url: message.link}); });
        li.append(who, subject, snippet, actions);
        gmailList.appendChild(li);
    }
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

const gmailAct = async (account: number, message: GmailMessage, action: string) => {
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
$("gmailLatency").textContent = "새 메일은 Gmail 탭이 열려 있으면 제목이 바뀌는 즉시, 그리고 10초마다 확인해요. 탭이 없으면 크롬 알람 한계인 1분마다 확인하고, 브라우저로 돌아오면 바로 다시 봐요. 답장은 Gmail 창에서 보내야 보낸편지함과 같아요.";
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes["gmail.snapshot"] && current === "gmail") {
        renderGmail(changes["gmail.snapshot"].newValue as GmailSnapshot);
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

const fillFxSelects = (codes: string[]) => {
    const selected = {from: fxFrom.value || "krw", to: fxTo.value || "usd"};
    for (const select of [fxFrom, fxTo]) {
        select.replaceChildren();
        for (const code of codes) {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = currencyLabel(code);
            select.appendChild(option);
        }
    }
    fxFrom.value = codes.includes(selected.from) ? selected.from : codes[0] || "";
    fxTo.value = codes.includes(selected.to) ? selected.to : (codes[1] || codes[0] || "");
};

const renderFx = () => {
    if (!fxTable) {
        fxResult.textContent = "환율표를 아직 받지 못했어요.";
        return;
    }
    const amount = Number(fxAmount.value);
    const value = convertAmount(amount, fxFrom.value, fxTo.value, fxTable.rates);
    fxResult.textContent = value == null ? "이 통화는 표에 없어요." : `${formatMoney(amount, fxFrom.value)} ${fxFrom.value.toUpperCase()} = ${formatMoney(value, fxTo.value)} ${fxTo.value.toUpperCase()}`;
    fxMore.replaceChildren();
    for (const code of COMMON_CODES) {
        if (code === fxFrom.value) continue;
        const other = convertAmount(amount, fxFrom.value, code, fxTable.rates);
        if (other == null) continue;
        const li = document.createElement("li");
        li.textContent = `${currencyLabel(code)} ${formatMoney(other, code)}`;
        fxMore.appendChild(li);
    }
    fxStatus.textContent = fxTable.date
        ? `${fxTable.date} 시세예요. 하루 한 번 바뀌고, 12시간 동안 저장해요. 실시간 시세는 아니에요.`
        : "하루 한 번 바뀌는 시세예요. 실시간은 아니에요.";
};

const refreshFx = async () => {
    const stored = await chrome.storage.local.get(FX_KEY);
    const cached = stored[FX_KEY] as FxTable | undefined;
    if (cached?.rates && isCacheFresh(cached.fetchedAt)) {
        fxTable = cached;
        fillFxSelects(Object.keys(cached.rates).sort());
        renderFx();
        return;
    }
    fxStatus.textContent = "환율표를 받는 중…";
    try {
        const response = await fetch(FX_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = parseRatePayload(await response.json()) as FxTable | null;
        if (!parsed) throw new Error("표 형식");
        fxTable = parsed;
        await chrome.storage.local.set({[FX_KEY]: parsed});
        fillFxSelects(Object.keys(parsed.rates).sort());
        renderFx();
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

fxAmount.addEventListener("input", renderFx);
fxFrom.addEventListener("change", renderFx);
fxTo.addEventListener("change", renderFx);
$("fxSwap").addEventListener("click", () => {
    const next = fxFrom.value;
    fxFrom.value = fxTo.value;
    fxTo.value = next;
    renderFx();
});
