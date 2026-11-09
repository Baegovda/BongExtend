const SIZE_KEY = 'core.popupWindowSize';
const POPUP_SIZE_KEY = 'core.popupSize';
export function setupWindowControls(selection: () => string) {
    const button = document.getElementById('openResizableWindow') as HTMLButtonElement;
    const handle = document.getElementById('windowResizeHandle') as HTMLButtonElement;
    const root = document.documentElement;
    if (new URLSearchParams(location.search).get('window') === '1') root.classList.add('is-window');
    let own: chrome.windows.Window | undefined, saveTimer = 0;
    const limits = (width: number, height: number) => ({
        width: Math.round(Math.min(Math.max(520, width), screen.availWidth || 1920)),
        height: Math.round(Math.min(Math.max(460, height), screen.availHeight || 1080))
    });
    async function openWindow(width?: number, height?: number) {
        button.disabled = true;
        try {
            const saved = (await chrome.storage.local.get(SIZE_KEY))[SIZE_KEY] as {width?:number; height?:number} | undefined;
            const url = new URL(chrome.runtime.getURL('popup.html'));
            url.searchParams.set('window', '1');
            const mail = selection();
            if (/^[a-zA-Z0-9_-]{1,128}$/.test(mail)) url.searchParams.set('mail', mail);
            await chrome.windows.create({url:url.href, type:'popup', ...limits(width || Number(saved?.width)||1000, height || Number(saved?.height)||800)});
            if (!await chrome.tabs.getCurrent()) window.close();
        } catch {button.title = '창을 열지 못했어요. 다시 눌러 주세요.';}
        finally {button.disabled = false;}
    }
    button.addEventListener('click', () => {void openWindow();});
    handle.hidden = false;
    void chrome.windows.getCurrent().then(window => {
        if (window.type !== 'popup') {
            void chrome.storage.local.get(POPUP_SIZE_KEY).then(stored=>{const size=stored[POPUP_SIZE_KEY] as {width?:number;height?:number}|undefined;if(size)resizePopup(Number(size.width)||780,Number(size.height)||590);});
            return;
        }
        own = window; root.classList.add('is-window'); button.hidden = true; handle.hidden = false;
        windowResizeListener();
    });
    let popupSaveTimer=0;
    function resizePopup(width:number,height:number) {
        // Chrome action popups stay attached and cannot exceed 800×600.
        const size={width:Math.round(Math.max(520,Math.min(800,width))),height:Math.round(Math.max(460,Math.min(600,height)))};
        for(const element of [root,document.body]){element.style.width=size.width+'px';element.style.height=size.height+'px';}
        clearTimeout(popupSaveTimer);popupSaveTimer=window.setTimeout(()=>{void chrome.storage.local.set({[POPUP_SIZE_KEY]:size});},200);
    }
    function windowResizeListener() {
        window.addEventListener('resize', () => {
            clearTimeout(saveTimer);
            saveTimer = window.setTimeout(async () => {
                const current = await chrome.windows.get(own!.id!);
                if (current.state === 'normal') await chrome.storage.local.set({[SIZE_KEY]:{width:current.width,height:current.height}});
            }, 250);
        });
    }
    let desired: {width:number; height:number} | null = null, applying = false;
    async function resize(width: number, height: number) {
        desired = limits(width, height);
        if (applying) return;
        applying = true;
        try {
            while (desired) {
                const next = desired; desired = null;
                await chrome.windows.update(own!.id!, next);
            }
        } catch {handle.title = '창 테두리를 끌어서 크기를 조절할 수도 있어요.';}
        finally {applying = false;}
    }
    handle.addEventListener('pointerdown', async event => {
        if (event.button !== 0) return;
        if (!own) {
            event.preventDefault(); handle.setPointerCapture(event.pointerId);
            const x=event.screenX,y=event.screenY,width=document.body.clientWidth,height=document.body.clientHeight;
            root.classList.add('resizing');
            const move=(e:PointerEvent)=>resizePopup(width+e.screenX-x,height+e.screenY-y);
            const end=()=>{root.classList.remove('resizing');handle.removeEventListener('pointermove',move);handle.removeEventListener('lostpointercapture',end);};
            handle.addEventListener('pointermove',move);handle.addEventListener('lostpointercapture',end);
            return;
        }
        event.preventDefault(); handle.setPointerCapture(event.pointerId);
        const x = event.screenX, y = event.screenY;
        const initial = await chrome.windows.get(own.id!);
        if (initial.state !== 'normal' || !handle.hasPointerCapture(event.pointerId)) return;
        root.classList.add('resizing');
        const move = (e: PointerEvent) => {void resize(initial.width! + e.screenX-x, initial.height! + e.screenY-y);};
        const end = () => {
            root.classList.remove('resizing');
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('lostpointercapture', end);
        };
        handle.addEventListener('pointermove', move); handle.addEventListener('lostpointercapture', end);
    });
    handle.addEventListener('keydown', async event => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        if (!own) {
            event.preventDefault();
            resizePopup(document.body.clientWidth + (event.key==='ArrowRight'?40:event.key==='ArrowLeft'?-40:0), document.body.clientHeight + (event.key==='ArrowDown'?40:event.key==='ArrowUp'?-40:0));
            return;
        }
        event.preventDefault(); const current = await chrome.windows.get(own.id!);
        if (current.state !== 'normal') return;
        await resize(current.width! + (event.key==='ArrowRight'?40:event.key==='ArrowLeft'?-40:0),
            current.height! + (event.key==='ArrowDown'?40:event.key==='ArrowUp'?-40:0));
    });
}
