// 채팅 입력칸 옆에 지금 보는 방송의 내 통나무 파워 개수를 보여줘요.
// 숫자를 누르면 BongExtend가 자동으로 누른 통나무 받기 기록을 볼 수 있어요.
// 개수는 치지직 사이트가 쓰는 것과 같은 주소(내 계정 정보)에서 읽기만 해요. 받기 자체는 content-log-power.js가 해요.
(() => {
  'use strict';
  if (window.top !== window || globalThis.__bongLogCount) return;
  globalThis.__bongLogCount = true;

  const API = 'https://api.chzzk.naver.com/service/v1/channels/';
  const CHAT = '#aside-chatting, [class*="live_chatting_container"]';
  const HISTORY = 'logPowerHistory', MAX_HISTORY = 200, REFRESH_MS = 60000, MERGE_MS = 90000;
  const CHECK_AFTER = [3000, 8000, 20000];
  let enabled = false, moduleEnabled = false, channel = null, amount = null, signedIn = true;
  let badge = null, panel = null, ensureTimer = 0, refreshTimer = 0, onlyHere = false, paused = false;
  const names = {};

  const channelOf = () => /^\/live\/([a-f\d]{32})(?:\/|$)/i.exec(location.pathname)?.[1]?.toLowerCase() || null;
  const fmt = (n) => typeof n === 'number' ? Math.floor(n).toLocaleString('ko-KR') : '?';
  const alive = () => !globalThis.BongAlive || BongAlive();

  // 로그인하지 않았으면 치지직이 0개를 돌려줘서, 로그인 여부를 따로 한 번 확인해요.
  let loginCheck = null;
  function loggedIn() {
    loginCheck ||= fetch('https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus', { credentials: 'include' })
      .then((res) => res.json()).then((data) => data?.content?.loggedIn !== false).catch(() => true);
    return loginCheck;
  }

  async function fetchAmount(id) {
    if (!(await loggedIn())) return { ok: false, signedIn: false };
    try {
      const res = await fetch(API + id + '/log-power', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) return { ok: false, signedIn: false };
      if (!res.ok) return { ok: false, signedIn: true };
      const data = await res.json();
      const value = data?.content?.amount;
      if (typeof value !== 'number') return { ok: false, signedIn: data?.code !== 401 };
      return { ok: true, amount: value };
    } catch { return { ok: false, signedIn: true }; }
  }

  async function channelName(id) {
    if (names[id]) return names[id];
    try {
      const res = await fetch(API + id);
      const name = (await res.json())?.content?.channelName;
      if (name) names[id] = name;
      return name || '';
    } catch { return ''; }
  }

  // ---------- 기록 ----------
  async function readHistory() {
    try { const v = (await BCStore.local.get({ [HISTORY]: [] }))[HISTORY]; return Array.isArray(v) ? v : []; } catch { return []; }
  }
  async function writeHistory(list) {
    try { await BCStore.local.set({ [HISTORY]: list.slice(0, MAX_HISTORY) }); } catch { /* 저장을 못 해도 받기에는 영향이 없어요. */ }
  }
  async function updateEntry(at, patch) {
    const list = await readHistory();
    const entry = list.find((e) => e.at === at);
    if (!entry) return;
    Object.assign(entry, patch);
    await writeHistory(list);
  }

  // content-log-power.js가 받기 버튼을 누를 때마다 불러요.
  globalThis.__bongLogPowerClicked = async ({ channel: id, text } = {}) => {
    if (!id || !alive()) return;
    const reward = Number((/(\d[\d,]*)\s*받기/.exec(text || '')?.[1] || '').replace(/,/g, '')) || null;
    const before = id === channel ? amount : null;
    const now = Date.now();
    let list = await readHistory();
    // 같은 보상을 다시 누른 것(재시도)은 새 줄 대신 기존 줄에 합쳐요.
    let entry = list.find((e) => e.channel === id && e.status !== 'ok' && now - e.at < MERGE_MS);
    if (entry) entry.tries = (entry.tries || 1) + 1;
    else {
      entry = { at: now, channel: id, name: names[id] || '', reward, before, after: null, gained: null, status: 'pending', tries: 1 };
      list.unshift(entry);
    }
    await writeHistory(list);
    const at = entry.at, base = entry.before;
    if (!entry.name) channelName(id).then((name) => name && updateEntry(at, { name }));
    for (let i = 0; i < CHECK_AFTER.length; i++) {
      await new Promise((r) => setTimeout(r, CHECK_AFTER[i] - (CHECK_AFTER[i - 1] || 0)));
      if (!alive()) return;
      const result = await fetchAmount(id);
      if (!result.ok) continue;
      if (id === channel) { amount = result.amount; render(); }
      if (typeof base === 'number' && result.amount > base) {
        await updateEntry(at, { after: result.amount, gained: result.amount - base, status: 'ok' });
        return;
      }
      if (typeof base !== 'number' && i === CHECK_AFTER.length - 1) {
        await updateEntry(at, { after: result.amount, status: 'ok' });
        return;
      }
    }
    await updateEntry(at, { status: 'unknown' });
  };

  // ---------- 화면 ----------
  function injectStyle() {
    if (document.getElementById('bongextend-logcount-style')) return;
    const style = document.createElement('style');
    style.id = 'bongextend-logcount-style';
    style.textContent = `
.bongextend-logcount{display:inline-flex;align-items:center;gap:3px;height:28px;margin:0 2px;padding:0 7px;border:0;border-radius:6px;background:transparent;color:inherit;font:600 12px/1 inherit;cursor:pointer;white-space:nowrap;flex:none}
.bongextend-logcount:hover{background:rgba(128,128,128,.18)}
.bongextend-logcount .ico{font-size:13px}
.bongextend-logpanel{position:fixed;z-index:2147483000;width:340px;max-height:420px;display:flex;flex-direction:column;border-radius:10px;background:#fff;color:#222;box-shadow:0 8px 28px rgba(0,0,0,.35);font:13px/1.4 -apple-system,"Malgun Gothic",sans-serif;overflow:hidden}
html.theme_dark .bongextend-logpanel{background:#232428;color:#e8e8ea}
.bongextend-logpanel header{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;font-weight:700;font-size:14px}
.bongextend-logpanel header button{margin-left:auto;border:0;background:none;color:inherit;font-size:18px;line-height:1;cursor:pointer;opacity:.7}
.bongextend-logpanel .now{padding:0 14px 8px;opacity:.85}
.bongextend-logpanel .bar{display:flex;align-items:center;gap:8px;padding:0 14px 8px;font-size:12px}
.bongextend-logpanel .bar label{display:flex;align-items:center;gap:4px;cursor:pointer}
.bongextend-logpanel .bar button{margin-left:auto;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:none;color:inherit;font-size:12px;padding:2px 8px;cursor:pointer}
.bongextend-logpanel ol{list-style:none;margin:0;padding:0 6px 8px;overflow:auto}
.bongextend-logpanel li{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;padding:7px 8px;border-top:1px solid rgba(128,128,128,.18)}
.bongextend-logpanel li .t{opacity:.65;font-size:12px}
.bongextend-logpanel li .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bongextend-logpanel li .g{font-weight:700;text-align:right}
.bongextend-logpanel li .g.ok{color:#16a34a}
html.theme_dark .bongextend-logpanel li .g.ok{color:#4ade80}
.bongextend-logpanel li .g.wait,.bongextend-logpanel li .g.unknown{opacity:.7;font-weight:500}
.bongextend-logpanel li .d{grid-column:2/4;opacity:.6;font-size:12px}
.bongextend-logpanel .empty{padding:18px 14px 22px;opacity:.7;text-align:center}`;
    (document.head || document.documentElement).appendChild(style);
  }

  function findSpot() {
    for (const chat of document.querySelectorAll(CHAT)) {
      const donation = [...chat.querySelectorAll('button')].filter((b) => /donation_button/.test(b.className || '')).pop();
      if (donation?.parentNode) return { parent: donation.parentNode, before: donation.nextSibling };
      const tools = chat.querySelector('[class*="live_chatting_input_tools"]');
      if (tools) return { parent: tools, before: null };
    }
    return null;
  }

  function removeUi() {
    badge?.remove(); badge = null;
    closePanel();
  }

  function render() {
    if (!badge) return;
    badge.querySelector('.num').textContent = fmt(amount);
    badge.title = `이 방송에서 내 통나무 파워 ${fmt(amount)}개 · 누르면 자동 받기 기록을 볼 수 있어요`;
    if (panel) renderPanel();
  }

  function ensure() {
    if (!alive()) { stopAll(); return; }
    if (!enabled || !moduleEnabled || paused) { removeUi(); return; }
    const id = channelOf();
    if (id !== channel) {
      channel = id; amount = null; signedIn = true;
      if (badge) render();
      if (id) void refresh();
    }
    if (!id || !signedIn) { removeUi(); return; }
    // 확장이 업데이트되면 예전 스크립트는 멈춘 채 자기 표시를 못 지워요. 내 것이 아닌 표시·기록 창은 치워서 하나만 남겨요.
    for (const old of document.querySelectorAll('.bongextend-logcount, .bongextend-logpanel')) if (old !== badge && old !== panel) old.remove();
    if (badge?.isConnected) return;
    const spot = findSpot();
    if (!spot) return;
    injectStyle();
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'bongextend-logcount';
    badge.innerHTML = '<span class="ico" aria-hidden="true">🪵</span><span class="num">?</span>';
    badge.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); panel ? closePanel() : openPanel(); });
    spot.parent.insertBefore(badge, spot.before);
    render();
  }

  async function refresh() {
    const id = channel;
    if (!id) return;
    const result = await fetchAmount(id);
    if (id !== channel) return;
    if (result.ok) { amount = result.amount; signedIn = true; render(); }
    else if (result.signedIn === false) { signedIn = false; removeUi(); }
  }

  // ---------- 기록 창 ----------
  const time = (at) => {
    const d = new Date(at), p = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  function position() {
    if (!panel || !badge) return;
    const r = badge.getBoundingClientRect();
    const w = panel.offsetWidth || 340, h = panel.offsetHeight || 200;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
    const top = r.top - h - 8 >= 8 ? r.top - h - 8 : Math.min(window.innerHeight - h - 8, r.bottom + 8);
    panel.style.left = left + 'px';
    panel.style.top = Math.max(8, top) + 'px';
  }

  async function renderPanel() {
    if (!panel) return;
    const list = (await readHistory()).filter((e) => !onlyHere || e.channel === channel);
    if (!panel) return;
    panel.querySelector('.now').textContent = channel ? `지금 방송의 내 통나무: ${fmt(amount)}개` : '';
    const ol = panel.querySelector('ol'), empty = panel.querySelector('.empty');
    ol.textContent = '';
    empty.hidden = list.length > 0;
    for (const e of list.slice(0, 100)) {
      const li = document.createElement('li');
      const t = document.createElement('span'); t.className = 't'; t.textContent = time(e.at);
      const n = document.createElement('span'); n.className = 'n'; n.textContent = e.name || e.channel.slice(0, 8);
      const g = document.createElement('span');
      if (e.status === 'ok') { g.className = 'g ok'; g.textContent = typeof e.gained === 'number' ? `+${fmt(e.gained)}` : (e.reward ? `+${fmt(e.reward)}` : '받음'); }
      else if (e.status === 'pending') { g.className = 'g wait'; g.textContent = '확인 중'; }
      else { g.className = 'g unknown'; g.textContent = '확인 안 됨'; }
      li.append(t, n, g);
      const detail = [];
      if (typeof e.before === 'number' && typeof e.after === 'number') detail.push(`${fmt(e.before)} → ${fmt(e.after)}`);
      else if (typeof e.after === 'number') detail.push(`받은 뒤 ${fmt(e.after)}개`);
      if (e.reward && e.status !== 'ok') detail.push(`보상 ${fmt(e.reward)}개`);
      if (e.tries > 1) detail.push(`${e.tries}번 눌렀어요`);
      if (e.status === 'unknown') detail.push('개수가 늘어난 걸 확인하지 못했어요');
      if (detail.length) { const d = document.createElement('span'); d.className = 'd'; d.textContent = detail.join(' · '); li.append(d); }
      ol.append(li);
    }
    position();
  }

  function onOutside(event) {
    if (panel && !panel.contains(event.target) && !badge?.contains(event.target)) closePanel();
  }
  function onKey(event) { if (event.key === 'Escape') closePanel(); }

  function openPanel() {
    injectStyle();
    panel = document.createElement('div');
    panel.className = 'bongextend-logpanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '통나무 자동 받기 기록');
    panel.innerHTML = '<header><span>🪵 통나무 자동 받기 기록</span><button type="button" class="x" aria-label="닫기">×</button></header>'
      + '<div class="now"></div>'
      + '<div class="bar"><label><input type="checkbox" class="here"> 이 방송만</label><button type="button" class="clear">기록 지우기</button></div>'
      + '<ol></ol><div class="empty">아직 자동으로 받은 기록이 없어요.<br>방송을 1시간 보면 받기 버튼이 뜨고, 그때 자동으로 눌러요.</div>';
    panel.querySelector('.x').addEventListener('click', closePanel);
    const here = panel.querySelector('.here');
    here.checked = onlyHere;
    here.addEventListener('change', () => { onlyHere = here.checked; void renderPanel(); });
    panel.querySelector('.clear').addEventListener('click', async () => {
      if (!confirm('통나무 자동 받기 기록을 모두 지울까요?')) return;
      await writeHistory([]);
      void renderPanel();
    });
    document.body.appendChild(panel);
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', position);
    void refresh();
    void renderPanel();
  }

  function closePanel() {
    if (!panel) return;
    panel.remove(); panel = null;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', position);
  }

  function stopAll() {
    clearInterval(ensureTimer); ensureTimer = 0;
    clearInterval(refreshTimer); refreshTimer = 0;
    removeUi();
  }

  function start() {
    stopAll();
    if (!enabled || !moduleEnabled || paused) return;
    channel = null;
    ensureTimer = setInterval(ensure, 1500); // 채팅창이 다시 그려지거나 다른 방송으로 옮겨도 다시 붙여요.
    refreshTimer = setInterval(() => { if (document.visibilityState !== 'hidden') void refresh(); }, REFRESH_MS);
    ensure();
  }

  Promise.all([
    BCStore.sync.get({ logPowerCount: true }),
    chrome.storage.local.get({ 'core.modules': {} })
  ]).then(([settings, local]) => {
    enabled = settings.logPowerCount !== false;
    moduleEnabled = local['core.modules']?.chzzk !== false;
    start();
    BCStore.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.logPowerCount) { enabled = changes.logPowerCount.newValue !== false; start(); }
      if (area === 'local' && changes[HISTORY] && panel) void renderPanel();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes['core.modules']) return;
      moduleEnabled = changes['core.modules'].newValue?.chzzk !== false;
      start();
    });
  }).catch(() => stopAll());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && badge) void refresh(); });
  window.addEventListener('pagehide', () => { paused = true; stopAll(); });
  window.addEventListener('pageshow', () => { paused = false; start(); });
})();
