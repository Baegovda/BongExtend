// Keep the unread-mail badge intact. Only the current tab's icon/title change.
export async function renderProgressFrames(iconUrl) {
  const response = await fetch(iconUrl);
  if (!response.ok) throw new Error('Toolbar icon unavailable');
  const bitmap = await createImageBitmap(await response.blob());
  try {
    return Array.from({ length: 12 }, (_, phase) => {
      const images = {};
      for (const size of [16, 32]) {
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const center = size / 2;
        ctx.drawImage(bitmap, size * .17, size * .17, size * .66, size * .66);
        ctx.lineWidth = size * .11;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#27435d';
        ctx.beginPath(); ctx.arc(center, center, size * .43, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#72e5ff';
        const start = phase * Math.PI / 6 - Math.PI / 2;
        ctx.beginPath(); ctx.arc(center, center, size * .43, start, start + Math.PI * 1.25); ctx.stroke();
        images[size] = ctx.getImageData(0, 0, size, size);
      }
      return images;
    });
  } finally {
    bitmap.close();
  }
}

export function createToolbarProgress({ action, iconPaths, title = 'BongExtend', loadFrames,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  const tabs = new Map();
  let enabled = true;
  let timer = null;
  let framesPromise = null;
  let phase = 0;
  let rendering = false;
  const busy = (tabId) => enabled && [...(tabs.get(tabId)?.values() || [])].some(frame => frame.busy);
  const ignoreFailure = (result) => Promise.resolve(result).catch(() => {});
  function restore(tabId) {
    ignoreFailure(action.setIcon({ tabId, path: iconPaths }));
    ignoreFailure(action.setTitle({ tabId, title }));
  }
  function schedule() {
    if (timer != null || ![...tabs.keys()].some(busy)) return;
    timer = setTimer(() => { timer = null; phase = (phase + 1) % 12; void paint(); }, 160);
  }
  async function paint() {
    if (rendering) return;
    rendering = true;
    try {
      framesPromise ||= loadFrames();
      const frames = await framesPromise;
      for (const tabId of tabs.keys()) {
        if (!busy(tabId)) continue;
        await ignoreFailure(action.setIcon({ tabId, imageData: frames[phase % frames.length] }));
      }
    } catch {
      // A canvas failure must not interrupt translation; the title still reports work.
    } finally {
      rendering = false;
      schedule();
    }
  }
  function reconcile(tabId, wasBusy) {
    if (busy(tabId)) {
      if (!wasBusy) {
        ignoreFailure(action.setTitle({ tabId, title: `${title} · 번역 중…` }));
        void paint();
      }
    } else if (wasBusy) restore(tabId);
    if (![...tabs.keys()].some(busy) && timer != null) { clearTimer(timer); timer = null; }
  }
  return {
    report(tabId, frameId, token, status) {
      if (!enabled || !Number.isInteger(tabId) || !status || typeof status !== 'object') return;
      const wasBusy = busy(tabId);
      if (!tabs.has(tabId)) tabs.set(tabId, new Map());
      tabs.get(tabId).set(frameId, { token, busy: Boolean(status.enabled && !status.showOriginal && !status.error && status.busy) });
      reconcile(tabId, wasBusy);
    },
    disconnect(tabId, frameId, token) {
      const frames = tabs.get(tabId);
      if (frames?.get(frameId)?.token !== token) return;
      const wasBusy = busy(tabId);
      frames.delete(frameId);
      reconcile(tabId, wasBusy);
      if (!frames.size) tabs.delete(tabId);
    },
    clear(tabId, removed = false) {
      const wasBusy = busy(tabId);
      tabs.delete(tabId);
      if (removed) {
        if (![...tabs.keys()].some(busy) && timer != null) { clearTimer(timer); timer = null; }
      } else reconcile(tabId, wasBusy);
    },
    setEnabled(value) {
      if (enabled === Boolean(value)) return;
      for (const tabId of [...tabs.keys()]) this.clear(tabId);
      enabled = Boolean(value);
    },
  };
}

export function bindToolbarProgress(api = chrome) {
  const manifest = api.runtime.getManifest();
  const progress = createToolbarProgress({
    action: api.action,
    iconPaths: manifest.action?.default_icon || manifest.icons,
    title: manifest.action?.default_title || 'BongExtend',
    loadFrames: () => renderProgressFrames(api.runtime.getURL('icons/128.png')),
  });
  const ports = new Map();
  api.runtime.onConnect.addListener(port => {
    if (port.name !== 'bongextend-translation-progress' || port.sender?.id !== api.runtime.id) return;
    const tabId = port.sender.tab?.id;
    if (!Number.isInteger(tabId)) return;
    const frameId = port.sender.frameId || 0;
    const key = `${tabId}:${frameId}`;
    ports.set(key, port);
    port.onMessage.addListener(status => {
      if (ports.get(key) === port) progress.report(tabId, frameId, port, status);
    });
    port.onDisconnect.addListener(() => {
      if (ports.get(key) === port) ports.delete(key);
      progress.disconnect(tabId, frameId, port);
    });
  });
  function clearTab(tabId, removed) {
    for (const key of ports.keys()) if (key.startsWith(`${tabId}:`)) ports.delete(key);
    progress.clear(tabId, removed);
  }
  api.tabs.onRemoved.addListener(tabId => clearTab(tabId, true));
  api.tabs.onUpdated.addListener((tabId, change) => { if (change.status === 'loading') clearTab(tabId, false); });
  api.storage.local.get('core.modules').then(stored => {
    if (stored['core.modules']?.trans === false) progress.setEnabled(false);
  }).catch(() => {});
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['core.modules']) progress.setEnabled(changes['core.modules'].newValue?.trans !== false);
  });
  return progress;
}
