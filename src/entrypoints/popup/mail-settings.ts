// @ts-ignore shared sound catalog
import {CHECKER_PLUS_SOUNDS} from "@/modules/gmail/sound.js";
const MAIL_ORIGIN = new URL(chrome.runtime.getURL("/")).origin;
export function setupMailSettings() {
    const dialog = document.getElementById("mailSettingsDialog") as HTMLDialogElement;
    const form = document.getElementById("mailSettingsForm") as HTMLFormElement;
    const status = document.getElementById("mailSettingsStatus")!;
    const accounts = document.getElementById("mailSettingsAccounts")!;
    const button = document.getElementById("mailSettingsSave") as HTMLButtonElement;
    const request = async (command: string, params = {}) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const response = await Promise.race([chrome.runtime.sendMessage({command, params}), new Promise<never>((_, reject) => {timer = setTimeout(() => reject(Error("메일 모듈을 준비하고 있어요. 잠시 후 다시 시도해 주세요.")), 12000);})]);
            if (response?.error) throw Error(response.error.message || "설정을 저장하지 못했어요.");
            return response;
        } finally { if (timer) clearTimeout(timer); }
    };
    const soundSelect=form.elements.namedItem('notificationSound') as HTMLSelectElement;
    soundSelect.replaceChildren(...[{value:'',label:'소리 없음'},{value:'system-default',label:'시스템 기본 소리'},...CHECKER_PLUS_SOUNDS.map((name:string)=>({value:name+'.mp3',label:name}))].map(({value,label})=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;}));
    let preview:HTMLAudioElement|undefined;
    document.getElementById('mailSoundPreview')!.addEventListener('click',()=>{
        preview?.pause();if(!soundSelect.value || soundSelect.value==='system-default'){status.textContent='파일 알림음을 선택하면 미리 들을 수 있어요.';return;}
        preview=new Audio(chrome.runtime.getURL('sounds/'+soundSelect.value));preview.volume=Number((form.elements.namedItem('notificationSoundVolume') as HTMLInputElement).value)/100;
        void preview.play().catch(()=>{status.textContent='알림음을 재생하지 못했어요.';});
    });
    dialog.addEventListener('close',()=>preview?.pause());
    soundSelect.addEventListener('change',()=>preview?.pause());
    const otpState=document.getElementById('otpOverlayState')!;
    const otpButton=document.getElementById('otpOverlayPermission') as HTMLButtonElement;
    // 인증번호가 화면 가운데에 뜨려면 보고 있는 웹페이지에 표시할 권한이 필요해요. 지금 상태와 마지막 결과를 알려줘요.
    const paintOtpState=async()=>{
        let granted=false;
        try{granted=await chrome.permissions.contains({origins:['https://*/*','http://*/*']});}catch{/* 확인하지 못하면 필요한 것으로 봐요. */}
        const stored=await chrome.storage.local.get('core.mailOtpOverlayStatus').catch(()=>({} as Record<string,unknown>));
        const last=stored['core.mailOtpOverlayStatus'];
        otpButton.hidden=granted;
        const lines=[granted?'허용됐어요. 인증번호가 복사되면 지금 보고 있는 웹페이지 가운데에 크게 떠요.':'허용하면 인증번호가 복사될 때 웹페이지 가운데에 크게 떠요. 지금은 Windows 알림만 떠요.'];
        if(last==='page-unavailable')lines.push('마지막 인증번호는 화면에 표시하지 못했어요. 새 탭, 크롬 설정 화면, PDF 같은 페이지에서는 표시할 수 없어요.');
        otpState.textContent=lines.join(' ');
    };
    otpButton.addEventListener('click',async()=>{
        const granted=await chrome.permissions.request({origins:['https://*/*','http://*/*']});
        status.textContent=granted?'이제 인증번호가 웹페이지 가운데에 표시돼요.':'허용하지 않았어요. Windows 알림은 계속 사용할 수 있어요.';
        await paintOtpState();
    });
    chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes['core.mailOtpOverlayStatus'])void paintOtpState();});
    const open = async () => {
        if (!dialog.open) dialog.showModal();
        void paintOtpState();
        status.textContent = "설정을 불러오고 있어요…";
        button.disabled = true;
        try {
            const result = await request("BongExtendMailOptions");
            for (const [name, value] of Object.entries(result.values)) {
                const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
                if (!field) continue;
                if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = Boolean(value);
                else {
                    if(name==='notificationSound' && value && field instanceof HTMLSelectElement && ![...field.options].some(option=>option.value===String(value))){const option=document.createElement('option');option.value=String(value);option.textContent='저장된 사용자 알림음';field.append(option);}
                    field.value = String(value ?? "");
                }
            }
            accounts.replaceChildren();
            if (!result.accounts.length) accounts.textContent = "연결된 Gmail 계정이 없어요. Gmail에 로그인한 뒤 다시 확인해 주세요.";
            for (const account of result.accounts) {
                const row = document.createElement("div"); row.className = "mail-settings-account"; row.textContent = account.email; accounts.appendChild(row);
            }
            status.textContent = "변경한 뒤 설정 저장을 눌러주세요.";
            button.disabled = false;
        } catch (error) { status.textContent = (error as Error).message; }
    };
    const refresh = async () => {
        try { await request("BongExtendMailSessionChanged"); if (dialog.open) await open(); }
        catch (error) { status.textContent = (error as Error).message; }
    };
    document.getElementById("mailSettingsOpen")!.addEventListener("click", () => {void open();});
    document.getElementById("mailSettingsClose")!.addEventListener("click", () => dialog.close());
    document.getElementById("mailSessionRefresh")!.addEventListener("click", () => {void refresh();});
    document.getElementById("mailRefreshNow")!.addEventListener("click", () => {void refresh();});
    form.addEventListener("submit", async event => {
        event.preventDefault(); button.disabled = true;
        const values: Record<string, unknown> = {};
        for (const field of [...form.elements]) {
            if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement) || !field.name) continue;
            values[field.name] = field instanceof HTMLInputElement && field.type === "checkbox" ? field.checked : field.name === "notificationSoundVolume" ? Number(field.value) : field.value;
        }
        try {
            await request("BongExtendMailOptions", {values});
            status.textContent = "설정을 저장했어요.";
            const frame = document.getElementById("checkerPlusMailFrame") as HTMLIFrameElement;
            if (frame.contentWindow) frame.contentWindow.location.reload();
        } catch (error) { status.textContent = (error as Error).message; }
        finally { button.disabled = false; }
    });
    window.addEventListener("message", event => {
        const frame = document.getElementById("checkerPlusMailFrame") as HTMLIFrameElement;
        if (event.origin === MAIL_ORIGIN && event.source === frame.contentWindow && event.data?.type === "bongextend-mail-settings") void open();
    });
    if (new URLSearchParams(location.search).has("mailSettings")) void open();
}
