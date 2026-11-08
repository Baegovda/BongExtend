// Chrome's browser fullscreen (F11), with ownership so existing fullscreen is never undone.
export const WIDE_FULLSCREEN_KEY = 'core.chzzkWideFullscreen';
const MESSAGE = 'BONG_CHZZK_WIDE_FULLSCREEN';
const watchPage = value => /^https:\/\/chzzk\.naver\.com\/(live|video)\/[^/?#]+/.test(value || '');

export function startWideFullscreenBridge(chrome = globalThis.chrome) {
  let pending = Promise.resolve();
  const enqueue = task => {
    const result = pending.then(task);
    pending = result.catch(() => {});
    return result;
  };
  const load = async () => (await chrome.storage.session.get(WIDE_FULLSCREEN_KEY))[WIDE_FULLSCREEN_KEY] || {};
  const save = entries => chrome.storage.session.set({[WIDE_FULLSCREEN_KEY]: entries});
  const sameOwner = (entry, sender) => entry?.tabId === sender.tab.id &&
    (!entry.documentId || entry.documentId === sender.documentId);

  async function restore(entries, windowId) {
    const entry = entries[windowId];
    if (!entry) return;
    let window;
    try { window = await chrome.windows.get(Number(windowId)); } catch { /* Already closed. */ }
    // A user changing the window state takes precedence over our saved state.
    if (window?.state === 'fullscreen' && !entry.manualExit) {
      const update = {state: entry.previousState};
      if (entry.previousState === 'normal') Object.assign(update, entry.bounds);
      try { await chrome.windows.update(Number(windowId), update); }
      catch (error) {
        if (entry.previousState !== 'normal' || !Object.keys(entry.bounds).length) throw error;
        // A disconnected monitor or changed screen layout can invalidate saved bounds.
        // Still leave fullscreen, letting Chrome choose a visible restored position.
        await chrome.windows.update(Number(windowId), {state:'normal'});
      }
    }
    delete entries[windowId];
    await save(entries);
  }

  async function apply(wide, sender) {
    const entries = await load(), windowId = sender.tab.windowId;
    const entry = entries[windowId];
    if (!wide) {
      if (sameOwner(entry, sender)) await restore(entries, windowId);
      return {ok: true};
    }
    const [stored, prefs, tab, window] = await Promise.all([
      chrome.storage.local.get('core.modules'), chrome.storage.sync.get('chzzk.wideFullscreen'),
      chrome.tabs.get(sender.tab.id), chrome.windows.get(windowId)
    ]);
    if (stored['core.modules']?.chzzk === false || prefs['chzzk.wideFullscreen'] === false) return {ok:false, status:'disabled'};
    if (!tab.active || tab.windowId !== windowId || !window.focused || !watchPage(tab.url) ||
        new URL(tab.url).pathname !== new URL(sender.url).pathname) return {ok:false, status:'inactive'};
    if (sameOwner(entry, sender)) return {ok:true, status:entry.manualExit ? 'manual-exit' : 'fullscreen'};
    if (entry) {
      await restore(entries, windowId);
      // Another Chzzk tab may have owned fullscreen; recapture its restored state.
      return apply(wide, sender);
    }
    if (window.state === 'fullscreen') return {ok:true, status:'already-fullscreen'};
    if (!['normal', 'maximized'].includes(window.state)) return {ok:false, status:'unavailable'};
    const bounds = {};
    if (window.state === 'normal') for (const key of ['left', 'top', 'width', 'height']) {
      if (Number.isInteger(window[key])) bounds[key] = window[key];
    }
    entries[windowId] = {tabId:tab.id, documentId:sender.documentId, previousState:window.state, bounds};
    // Session storage survives service-worker suspension but never a browser restart.
    await save(entries);
    try { await chrome.windows.update(windowId, {state:'fullscreen'}); }
    catch (error) {delete entries[windowId]; await save(entries); throw error;}
    return {ok:true, status:'fullscreen'};
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== MESSAGE || typeof message.wide !== 'boolean' || sender.id !== chrome.runtime.id ||
        !Number.isInteger(sender.tab?.id) || sender.frameId !== 0 || !watchPage(sender.url)) return;
    void enqueue(() => apply(message.wide, sender)).then(reply, error => {
      console.warn('치지직 Chrome 전체화면 전환을 완료하지 못했어요.', error);
      reply({ok:false, status:'unavailable', error:String(error?.message || error)});
    });
    return true;
  });

  const handle = task => {void enqueue(task).catch(error => console.warn('치지직 전체화면 상태를 복구하지 못했어요.', error));};
  chrome.tabs.onActivated.addListener(({tabId, windowId}) => handle(async () => {
    const entries = await load();
    if (entries[windowId]?.tabId !== tabId) await restore(entries, windowId);
    // Tab activation doesn't always produce a window focus/visibility event (e.g. after closing a tab).
    void chrome.tabs.sendMessage(tabId, {type:'BONG_CHZZK_WIDE_REFRESH'}).catch(() => {});
  }));
  chrome.tabs.onRemoved.addListener((tabId, info) => handle(async () => {
    const entries = await load();
    if (entries[info.windowId]?.tabId !== tabId) return;
    if (info.isWindowClosing) {delete entries[info.windowId]; await save(entries);}
    else await restore(entries, info.windowId);
  }));
  chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.status !== 'loading' && !change.url) return;
    handle(async () => {
      const entries = await load();
      if (entries[tab.windowId]?.tabId === tabId) await restore(entries, tab.windowId);
    });
  });
  chrome.tabs.onDetached.addListener((tabId, info) => handle(async () => {
    const entries = await load();
    if (entries[info.oldWindowId]?.tabId === tabId) await restore(entries, info.oldWindowId);
  }));
  chrome.windows.onBoundsChanged.addListener(window => handle(async () => {
    const entries = await load(), entry = entries[window.id];
    if (!entry || (await chrome.windows.get(window.id)).state === 'fullscreen') return;
    entry.manualExit = true;
    await save(entries);
  }));
  chrome.windows.onRemoved.addListener(windowId => handle(async () => {
    const entries = await load();
    if (entries[windowId]) {delete entries[windowId]; await save(entries);}
  }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!(area === 'local' && changes['core.modules']?.newValue?.chzzk === false) &&
        !(area === 'sync' && changes['chzzk.wideFullscreen']?.newValue === false)) return;
    handle(async () => {
      const entries = await load();
      for (const id of Object.keys(entries)) await restore(entries, id);
    });
  });
}
