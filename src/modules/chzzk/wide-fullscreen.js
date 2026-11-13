// Chrome's browser fullscreen (F11), with ownership so existing fullscreen is never undone.
export const WIDE_FULLSCREEN_KEY = 'core.chzzkWideFullscreen';
const MESSAGE = 'BONG_CHZZK_WIDE_FULLSCREEN';
const watchPage = value => /^https:\/\/chzzk\.naver\.com\/(live|video)\/[^/?#]+/.test(value || '');

export function startWideFullscreenBridge(chrome = globalThis.chrome, {sleep = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
  let pending = Promise.resolve();
  // 우리가 창 상태를 바꾸는 동안 생기는 크기 변경 이벤트는 사용자가 F11을 직접 끈 것으로 오해하지 않는다.
  let transitioning = 0;
  const pageDir = value => { try { return new URL(value).pathname; } catch { return ''; } };
  // Chrome이 직전 창 상태 전환 중이면 요청이 조용히 무시될 수 있어서, 실제로 전체화면이 됐는지 확인하며 최대 3번 시도한다.
  async function enterFullscreen(windowId) {
    transitioning++;
    try {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await chrome.windows.update(windowId, {state:'fullscreen'}); lastError = undefined; }
        catch (error) { lastError = error; await sleep(150); continue; }
        for (let wait = 0; wait < 8; wait++) {
          let state;
          try { state = (await chrome.windows.get(windowId)).state; } catch { return false; }
          if (state === 'fullscreen') return true;
          await sleep(100);
        }
      }
      if (lastError) throw lastError;
      return false;
    } finally { transitioning--; }
  }
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
      transitioning++;
      try {
        try { await chrome.windows.update(Number(windowId), update); }
        catch (error) {
          if (entry.previousState !== 'normal' || !Object.keys(entry.bounds).length) throw error;
          // A disconnected monitor or changed screen layout can invalidate saved bounds.
          // Still leave fullscreen, letting Chrome choose a visible restored position.
          await chrome.windows.update(Number(windowId), {state:'normal'});
        }
      } finally { transitioning--; }
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
    if (sameOwner(entry, sender)) {
      if (entry.manualExit) return {ok:true, status:'manual-exit'};
      if (window.state === 'fullscreen') {
        // 같은 문서에서 다른 방송으로 넘어간 경우: 전체화면은 그대로 두고 현재 주소만 기억해요.
        const path = pageDir(sender.url);
        if (entry.path !== path) { entry.path = path; await save(entries); }
        return {ok:true, status:'fullscreen'};
      }
      // 전체화면이 풀렸는데 사용자가 직접 끈 기록은 없으면(상태 기록이 어긋난 경우) 기록을 지우고 다시 들어가요.
      delete entries[windowId];
      await save(entries);
      return apply(wide, sender);
    }
    // 같은 탭이 새로고침되어 문서만 바뀐 경우에는 전체화면을 풀지 않고 소유권만 이어받는다.
    if (entry && entry.tabId === sender.tab.id && window.state === 'fullscreen' && !entry.manualExit) {
      entry.documentId = sender.documentId;
      entry.path = pageDir(sender.url);
      await save(entries);
      return {ok:true, status:'fullscreen'};
    }
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
    entries[windowId] = {tabId:tab.id, documentId:sender.documentId, previousState:window.state, bounds, path:pageDir(sender.url)};
    // Session storage survives service-worker suspension but never a browser restart.
    await save(entries);
    let entered = false;
    try { entered = await enterFullscreen(windowId); }
    catch (error) {delete entries[windowId]; await save(entries); throw error;}
    if (!entered) {delete entries[windowId]; await save(entries); return {ok:false, status:'unavailable'};}
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
    // 주소의 쿼리·해시만 바뀌거나 같은 페이지를 새로고침하는 경우에는 전체화면을 유지한다. 다른 페이지로 가면 푼다.
    if (!change.url) return;
    handle(async () => {
      const entries = await load(), entry = entries[tab.windowId];
      if (entry?.tabId !== tabId) return;
      const path = watchPage(change.url) ? pageDir(change.url) : '';
      if (entry.path && entry.path === path) return;
      await restore(entries, tab.windowId);
    });
  });
  chrome.tabs.onDetached.addListener((tabId, info) => handle(async () => {
    const entries = await load();
    if (entries[info.oldWindowId]?.tabId === tabId) await restore(entries, info.oldWindowId);
  }));
  chrome.windows.onBoundsChanged.addListener(window => handle(async () => {
    if (transitioning) return;
    const entries = await load(), entry = entries[window.id];
    if (!entry || transitioning || (await chrome.windows.get(window.id)).state === 'fullscreen') return;
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
