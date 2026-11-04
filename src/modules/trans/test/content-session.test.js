import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadContent(extras = {}) {
  const sandbox = { console, setTimeout, clearTimeout, ...extras };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../content/content.js', import.meta.url), 'utf8'), sandbox, {
    filename: 'content.js',
  });
  return sandbox.__pageTranslator;
}

function textNode(value) {
  return { nodeType: 3, nodeValue: value, parentElement: null, isConnected: true };
}

function element(tag, props = {}, children = []) {
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    id: props.id || '',
    isContentEditable: Boolean(props.editable) || props.contentEditable === 'true' || props.contentEditable === true,
    contentEditable: props.contentEditable != null ? String(props.contentEditable) : '',
    parentElement: null,
    childNodes: [],
    shadowRoot: null,
    isConnected: true,
    attrs: props.attrs || {},
    rect: props.rect || { top: 20, bottom: 40, left: 0, right: 120, width: 120, height: 20 },
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getBoundingClientRect() { return this.rect; },
    classList: {
      add(name) { node.classList._set.add(name); },
      remove(name) { node.classList._set.delete(name); },
      contains(name) { return node.classList._set.has(name); },
      _set: new Set(),
    },
    append(child) {
      const next = typeof child === 'string' ? textNode(child) : child;
      next.parentElement = node;
      node.childNodes.push(next);
      return next;
    },
  };
  for (const child of children) node.append(child);
  return node;
}

test('session translates visible text, skips hidden controls, and restores originals', async () => {
  const api = loadContent();
  const script = element('script', {}, ['var hidden = "包邮";']);
  const style = element('style', {}, ['body { content: "颜色"; }']);
  const code = element('code', {}, ['SKU-颜色']);
  const field = element('textarea', {}, ['尺码']);
  const input = element('input', {}, ['颜色']);
  const locked = element('div', { attrs: { translate: 'no' } }, ['不要翻译']);
  const editor = element('div', { editable: true }, ['编辑']);
  const visible = element('a', {}, ['  包邮\n']);
  const plainNumber = element('span', {}, [' 42 ']);
  const far = element('li', { rect: { top: 9000, bottom: 9040, left: 0, right: 100, width: 100, height: 40 } }, ['颜色分类']);
  const shadowText = element('span', {}, ['官方旗舰店']);
  const host = element('div');
  host.shadowRoot = { nodeType: 11, childNodes: [], parentElement: null };
  shadowText.parentElement = host.shadowRoot;
  host.shadowRoot.childNodes.push(shadowText);

  const root = element('div', {}, []);
  for (const child of [script, style, code, field, input, locked, editor, visible, plainNumber, far, host]) {
    root.append(child);
  }

  let observer;
  class FakeIO {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      observer = this;
    }
    observe(target) { this.observed.push(target); }
    unobserve() {}
    disconnect() {}
  }

  const sent = [];
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    IntersectionObserver: FakeIO,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    sendBatch: async (texts) => {
      sent.push(texts);
      if (texts.includes('颜色分类') && !sent.some((batch, index) => index < sent.length - 1 && batch.includes('颜色分类'))) {
        return { ok: false, message: 'Gemini API 속도 제한(429)이에요.' };
      }
      return {
        ok: true,
        translations: texts.map((text) => ({
          包邮: '무료배송',
          官方旗舰店: '공식 플래그십 스토어',
          颜色分类: '색상 분류',
        }[text] || text)),
      };
    },
  });

  session.start();
  await session.whenIdle();
  const batches = sent.map((batch) => [...batch]);
  assert.deepEqual(batches, [['包邮', '官方旗舰店']]);
  assert.equal(visible.childNodes[0].nodeValue, '  무료배송\n');
  assert.equal(shadowText.childNodes[0].nodeValue, '공식 플래그십 스토어');
  assert.equal(script.childNodes[0].nodeValue, 'var hidden = "包邮";');
  assert.equal(code.childNodes[0].nodeValue, 'SKU-颜色');
  assert.equal(far.childNodes[0].nodeValue, '颜色分类');

  session.setShowOriginal(true);
  assert.equal(visible.childNodes[0].nodeValue, '  包邮\n');
  session.setShowOriginal(false);
  assert.equal(visible.childNodes[0].nodeValue, '  무료배송\n');

  session.emitMutations([{
    type: 'characterData',
    target: visible.childNodes[0],
  }]);
  await session.whenIdle();
  assert.equal(sent.length, 1);

  const added = element('p', {}, ['新款']);
  root.append(added);
  session.emitMutations([{ type: 'childList', addedNodes: [added] }]);
  await session.whenIdle();
  assert.deepEqual([...sent[1]], ['新款']);
  assert.equal(added.childNodes[0].nodeValue, '新款');

  observer.callback([{ target: far, isIntersecting: true }]);
  await session.whenIdle();
  assert.equal(session.getStatus().error, 'Gemini API 속도 제한(429)이에요.');
  assert.equal(far.childNodes[0].nodeValue, '颜色分类');

  session.start();
  await session.whenIdle();
  assert.equal(far.childNodes[0].nodeValue, '색상 분류');
  assert.equal(session.getStatus().error, null);
});

function fakeDocument() {
  const hosts = [];
  return {
    hosts,
    documentElement: {
      appendChild(node) {
        hosts.push(node);
        node.isConnected = true;
      },
    },
    createElement() {
      const node = {
        id: '',
        hidden: false,
        style: {},
        textContent: '',
        isConnected: false,
        children: [],
        setAttribute() {},
        append(...kids) { this.children.push(...kids); },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(_type, fn) { this.onclick = fn; },
        attachShadow() {
          const shadow = { append(...kids) { shadow.children = kids; } };
          node.shadow = shadow;
          return shadow;
        },
      };
      return node;
    },
  };
}

test('the page shows an error toast only, not a success banner', async () => {
  const document = fakeDocument();
  const api = loadContent({ document });
  const root = element('div', {}, []);
  const visible = element('a', {}, ['包邮']);
  root.append(visible);
  const session = api.createSession({
    root,
    walkRoot: root,
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async () => ({ ok: false, message: '모델이 혼잡해요. API 키 문제가 아니에요.' }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(document.hosts.length, 1);
  const host = document.hosts[0];
  assert.equal(host.style.bottom, '16px');
  assert.equal(host.style.top, undefined);
  const message = host.shadow.children[1].children[0];
  assert.equal(message.textContent, '모델이 혼잡해요. API 키 문제가 아니에요.');
  assert.equal(JSON.stringify(host).includes('문장을 번역했어요'), false);

  host.shadow.children[1].children[1].onclick();
  assert.equal(host.hidden, true);
  // :host { all: initial } 이 [hidden]을 무시하므로 인라인 display로 확실히 숨긴다
  assert.equal(host.style.display, 'none');
  session.setShowOriginal(true);
  assert.equal(host.hidden, true);
  assert.equal(host.style.display, 'none');
  assert.equal(visible.classList.contains('pt-page-translator-pending'), false);
});

function quietSession(root, hooks = {}) {
  const api = loadContent();
  const sent = [];
  let release = () => {};
  let held = false;
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prioritizeCursor: hooks.prioritizeCursor,
    revealAnimation: hooks.revealAnimation,
    prefersReducedMotion: hooks.prefersReducedMotion,
    setTimer: hooks.setTimer,
    clearTimer: hooks.clearTimer,
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch(texts) {
      sent.push(texts);
      const result = {
        ok: true,
        translations: texts.map((text) => `T:${text}`),
        model: 'gemini-3.5-flash-lite',
      };
      if (hooks.hold && !held) {
        held = true;
        return new Promise((resolve) => {
          release = () => resolve(result);
        });
      }
      return result;
    },
  });
  return { session, sent, release: () => release() };
}

async function until(check) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (check()) return;
    await Promise.resolve();
  }
  assert.equal(check(), true);
}

test('pending text breathes gently and aurora gradients are reserved for the reveal', async () => {
  const source = readFileSync(new URL('../content/content.js', import.meta.url), 'utf8');
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /pt-page-translator-pending/);
  assert.match(source, /pt-pending-pulse/);
  assert.match(source, /WIPER_MS = 1380/);
  assert.match(source, /PRISM_MS = 1340/);
  assert.match(source, /50% \{ opacity: 0\.72;/);
  assert.match(source, /0%, 100% \{ opacity: 0\.94;/);
  const pendingRule = source.match(/`\.\$\{PENDING_CLASS\} \{[^`]+`/)?.[0] || '';
  assert.notEqual(pendingRule, '');
  assert.doesNotMatch(pendingRule, /linear-gradient|background-image|background-clip/);
  assert.match(source, /linear-gradient\(108deg, #46eaff/);
  assert.match(source, /pt-aurora-polish/);
  assert.doesNotMatch(source, /pt-prism-glow/);
  assert.doesNotMatch(source, /#2a6e7a|#9ad7e4|#5568b0/);

  const root = element('div');
  const visible = element('a', {}, ['包邮']);
  root.append(visible);
  const { session, sent, release } = quietSession(root, { hold: true });
  session.start();
  await until(() => sent.length === 1);
  assert.equal(visible.classList.contains('pt-page-translator-pending'), true);
  release();
  await session.whenIdle();
  assert.equal(visible.classList.contains('pt-page-translator-pending'), false);
  assert.equal(visible.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(visible.classList.contains('pt-page-translator-fade'), true);
  assert.equal(visible.childNodes[0].nodeValue, 'T:包邮');

  const reducedRoot = element('div');
  const reduced = element('a', {}, ['包邮']);
  reducedRoot.append(reduced);
  const reducedSession = quietSession(reducedRoot, { hold: true, prefersReducedMotion: true });
  reducedSession.session.start();
  await until(() => reducedSession.sent.length === 1);
  reducedSession.release();
  await reducedSession.session.whenIdle();
  assert.equal(reduced.classList.contains('pt-page-translator-fade'), true);
  assert.equal(reduced.classList.contains('pt-page-translator-pending'), false);
  assert.equal(reduced.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(reduced.classList.contains('pt-page-translator-prism'), false);
  assert.equal(reduced.childNodes[0].nodeValue, 'T:包邮');

  const plainRoot = element('div');
  const plain = element('a', {}, ['包邮']);
  plainRoot.append(plain);
  const plainSession = quietSession(plainRoot, { hold: true, revealAnimation: false });
  plainSession.session.start();
  await until(() => plainSession.sent.length === 1);
  assert.equal(plain.classList.contains('pt-page-translator-pending'), false);
  plainSession.release();
  await plainSession.session.whenIdle();
  assert.equal(plain.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(plain.classList.contains('pt-page-translator-fade'), false);
  assert.equal(plain.classList.contains('pt-page-translator-prism'), false);
  assert.equal(plain.childNodes[0].nodeValue, 'T:包邮');

  const failedRoot = element('div');
  const failed = element('span', {}, ['颜色']);
  failedRoot.append(failed);
  const failedSession = loadContent().createSession({
    root: failedRoot,
    walkRoot: failedRoot,
    enableBanner: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async () => ({ ok: false, message: '오류' }),
  });
  failedSession.start();
  await failedSession.whenIdle();
  assert.equal(failed.classList.contains('pt-page-translator-pending'), false);
  assert.equal(failed.classList.contains('pt-page-translator-fade'), false);
  assert.equal(failed.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(failed.childNodes[0].nodeValue, '颜色');
});

function revealDocument(created) {
  return {
    getElementById() { return { id: 'page-translator-motion' }; },
    createElement() {
      const node = {
        id: '',
        className: '',
        textContent: '',
        style: {},
        children: [],
        setAttribute() {},
        appendChild(child) { this.children.push(child); return child; },
        append(...kids) { this.children.push(...kids); },
      };
      created.push(node);
      return node;
    },
    createTextNode(value) { return { nodeType: 3, nodeValue: value }; },
    documentElement: { appendChild() {} },
  };
}

test('wiper order follows the line and finishes every box on one clock', () => {
  const api = loadContent();
  const nodes = [
    { id: 'low', top: 200, height: 20 },
    { id: 'high', top: 10, height: 20 },
    { id: 'mid', top: 80, height: 20 },
  ];
  const down = api.planWiperOrder(nodes, 'down');
  assert.deepEqual([...down.order.map((item) => item.id)], ['high', 'mid', 'low']);
  assert.equal(down.from < down.to, true);
  const up = api.planWiperOrder(nodes, 'up');
  assert.deepEqual([...up.order.map((item) => item.id)], ['low', 'mid', 'high']);
  assert.equal(up.from > up.to, true);

  const passed = (plan, line) => [...plan.order
    .filter((item) => api.crossProgress(line, item.at, item.band) >= 1)
    .map((item) => item.id)];
  assert.deepEqual(passed(down, down.lineStart), []);
  assert.deepEqual(passed(down, down.order[1].at), ['high']);
  assert.deepEqual(passed(down, down.lineEnd), ['high', 'mid', 'low']);
  for (const item of down.order) {
    assert.equal(api.crossProgress(down.lineStart, item.at, item.band), 0);
    assert.equal(api.crossProgress(down.lineEnd, item.at, item.band), 1);
  }
  const start = api.lineSample(down, 0, api.WIPER_MS);
  const end = api.lineSample(down, api.WIPER_MS, api.WIPER_MS);
  assert.equal(start.t, 0);
  assert.equal(end.t, 1);
  assert.equal(end.y, down.to);
});

test('each text box wipes horizontally without a page-wide scan line', async () => {
  const created = [];
  const timers = [];
  const frames = [];
  let clock = 0;
  const reads = [];
  const api = loadContent({
    document: revealDocument(created),
    getComputedStyle() {
      return {
        direction: 'rtl',
        font: '16px sans-serif',
        lineHeight: '20px',
        letterSpacing: 'normal',
        color: 'black',
        backgroundColor: 'rgb(18, 18, 18)',
      };
    },
  });
  const root = element('div');
  const nodes = [];
  for (let index = 0; index < 10; index += 1) {
    const node = element('span', {
      rect: { top: index * 30, bottom: index * 30 + 18, left: 4, right: 40, width: 36, height: 18 },
    }, [`글${index}`]);
    root.append(node);
    nodes.push(node);
  }
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    now: () => clock,
    requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    },
    measureRect(node) {
      reads.push(node.nodeValue);
      return node.parentElement.getBoundingClientRect();
    },
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map((text) => `더긴번역${text}`) }),
  });
  session.start();
  await session.whenIdle();
  for (const node of nodes) {
    assert.match(node.childNodes[0].nodeValue, /^더긴번역글/);
    assert.equal(node.classList.contains('pt-page-translator-pending'), false);
    assert.equal(node.classList.contains('pt-page-translator-hold'), false);
  }
  assert.equal(created.some((node) => String(node.className).includes('pt-page-translator-sweep')), false);

  session.toggleOriginal();
  assert.equal(nodes[0].childNodes[0].nodeValue, '글0');
  session.setEnabled(true);
  await session.whenIdle();
  assert.match(nodes[0].childNodes[0].nodeValue, /^더긴번역글/);
});

function styleBag(node) {
  const bag = {};
  node.style = {
    setProperty(name, value) { bag[name] = String(value); },
    removeProperty(name) { delete bag[name]; },
  };
  node.ink = bag;
  return node;
}

test('the sweep edge stays inside the sentence and the new text settles to its own color', async () => {
  const created = [];
  const timers = [];
  const frames = [];
  let clock = 0;
  const api = loadContent({
    document: revealDocument(created),
    getComputedStyle(node) {
      return {
        direction: node && node.dir === 'rtl' ? 'rtl' : 'ltr',
        font: '16px sans-serif',
        lineHeight: '22px',
        letterSpacing: 'normal',
        color: (node && node.inkColor) || 'rgb(17, 24, 39)',
        backgroundColor: (node && node.bg) || 'rgba(0, 0, 0, 0)',
        backgroundImage: (node && node.bgImage) || 'none',
      };
    },
  });
  const root = element('div');
  const link = styleBag(element('a', {}, ['Free shipping']));
  link.inkColor = 'rgb(29, 78, 216)';
  const plain = styleBag(element('span', {}, ['Welcome']));
  const painted = styleBag(element('span', {}, ['Buy now']));
  painted.bg = 'rgb(30, 30, 30)';
  const photo = styleBag(element('span', {}, ['Photo']));
  photo.bgImage = 'url(star.png)';
  const paragraph = element('p');
  paragraph.append('Hello');
  const bold = styleBag(element('b', {}, ['world']));
  paragraph.append(bold);
  const rtl = styleBag(element('span', {}, ['שלום']));
  rtl.dir = 'rtl';
  root.append(link);
  root.append(plain);
  root.append(painted);
  root.append(photo);
  root.append(paragraph);
  root.append(rtl);

  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    now: () => clock,
    requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    },
    measureRect(node) { return node.parentElement.getBoundingClientRect(); },
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => `번역:${text}`),
    }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(created.some((node) => String(node.className).includes('pt-page-translator-sweep')), false);
  assert.equal(link.childNodes[0].nodeValue, '번역:Free shipping');
  assert.equal(link.classList.contains('pt-page-translator-pending'), false);
  assert.equal(link.classList.contains('pt-page-translator-prism'), false);
  assert.equal(painted.classList.contains('pt-page-translator-prism'), false);
  assert.equal(bold.childNodes[0].nodeValue, '번역:world');
  session.setEnabled(false);
  assert.equal(link.childNodes[0].nodeValue, 'Free shipping');

  const quiet = [];
  const quietTimers = [];
  const reducedApi = loadContent({
    document: revealDocument(quiet),
    getComputedStyle() {
      return {
        direction: 'ltr',
        font: '16px sans-serif',
        color: 'black',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        backgroundImage: 'none',
      };
    },
  });
  const reducedRoot = element('div');
  const reduced = styleBag(element('span', {}, ['Welcome']));
  reducedRoot.append(reduced);
  const reducedSession = reducedApi.createSession({
    root: reducedRoot,
    walkRoot: reducedRoot,
    enableBanner: false,
    prefersReducedMotion: true,
    setTimer(fn, ms) { quietTimers.push({ fn, ms }); return quietTimers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map((text) => `번역:${text}`) }),
  });
  reducedSession.start();
  await reducedSession.whenIdle();
  assert.equal(reduced.childNodes[0].nodeValue, '번역:Welcome');
  assert.equal(reduced.classList.contains('pt-page-translator-prism'), false);
  assert.equal(reduced.classList.contains('pt-page-translator-fade'), true);
  assert.equal(reduced.classList.contains('pt-page-translator-pending'), false);
  assert.equal(quiet.some((node) => String(node.className).includes('pt-page-translator-sweep')), false);
  assert.equal(reduced.ink['--pt-ink'], undefined);

  const offCreated = [];
  const offApi = loadContent({ document: revealDocument(offCreated) });
  const offRoot = element('div');
  const off = styleBag(element('span', {}, ['Welcome']));
  offRoot.append(off);
  const offSession = offApi.createSession({
    root: offRoot,
    walkRoot: offRoot,
    enableBanner: false,
    revealAnimation: false,
    prefersReducedMotion: false,
    setTimer() { return 0; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map((text) => `번역:${text}`) }),
  });
  offSession.start();
  await offSession.whenIdle();
  assert.equal(off.childNodes[0].nodeValue, '번역:Welcome');
  assert.equal(off.classList.contains('pt-page-translator-prism'), false);
  assert.equal(off.classList.contains('pt-page-translator-pending'), false);
  assert.equal(off.ink['--pt-ink'], undefined);
  assert.equal(offCreated.some((node) => String(node.className).includes('pt-sweep-edge')), false);

  const settleCreated = [];
  const settleTimers = [];
  const settleFrames = [];
  let settleClock = 0;
  const settleApi = loadContent({
    document: revealDocument(settleCreated),
    getComputedStyle() {
      return {
        direction: 'ltr',
        font: '16px sans-serif',
        color: 'rgb(0, 0, 0)',
        backgroundColor: 'transparent',
        backgroundImage: 'none',
      };
    },
  });
  const settleRoot = element('div');
  const settle = styleBag(element('span', {}, ['Welcome']));
  settleRoot.append(settle);
  const settleSession = settleApi.createSession({
    root: settleRoot,
    walkRoot: settleRoot,
    enableBanner: false,
    prefersReducedMotion: false,
    now: () => settleClock,
    requestAnimationFrame(fn) {
      settleFrames.push(fn);
      return settleFrames.length;
    },
    measureRect(node) { return node.parentElement.getBoundingClientRect(); },
    setTimer(fn, ms) { settleTimers.push({ fn, ms }); return settleTimers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map((text) => `번역:${text}`) }),
  });
  settleSession.start();
  await settleSession.whenIdle();
  assert.equal(settle.classList.contains('pt-page-translator-prism'), false);
  assert.equal(settle.classList.contains('pt-page-translator-pending'), false);
  assert.equal(settle.childNodes[0].nodeValue, '번역:Welcome');
  assert.equal(settleCreated.some((node) => String(node.className).includes('pt-page-translator-sweep')), false);
});

test('a later chunk uses the same clip instead of popping into place', async () => {
  const created = [];
  const timers = [];
  let clock = 0;
  const api = loadContent({ document: revealDocument(created) });
  const root = element('div');
  const first = element('span', {
    rect: { top: 10, bottom: 28, left: 0, right: 40, width: 40, height: 18 },
  }, ['包邮']);
  root.append(first);
  let release = () => {};
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    now: () => clock,
    measureRect(node) { return node.parentElement.getBoundingClientRect(); },
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch(texts) {
      const result = { ok: true, translations: texts.map((text) => `번역${text}`) };
      if (texts.includes('包邮')) return result;
      return new Promise((resolve) => { release = () => resolve(result); });
    },
  });
  session.start();
  await session.whenIdle();
  assert.equal(first.childNodes[0].nodeValue, '번역包邮');
  const added = element('span', {
    rect: { top: 400, bottom: 418, left: 0, right: 40, width: 40, height: 18 },
  }, ['新款']);
  root.append(added);
  session.emitMutations([{ type: 'childList', addedNodes: [added] }]);
  await Promise.resolve();
  release();
  await session.whenIdle();
  assert.equal(added.childNodes[0].nodeValue, '번역新款');
  assert.equal(first.childNodes[0].nodeValue, '번역包邮');
  assert.equal(created.some((node) => String(node.className).includes('pt-page-translator-sweep')), false);
});

test('pending animation measures the text bounds once and does not follow the parent box', async () => {
  const created = [];
  const timers = [];
  let rangeReads = 0;
  const api = loadContent({
    document: {
      ...revealDocument(created),
      createRange() {
        return {
          selectNodeContents() {},
          getBoundingClientRect() {
            rangeReads += 1;
            return { left: 8, top: 44, width: 20, height: 16 };
          },
        };
      },
    },
  });
  const root = element('div', { rect: { top: 0, bottom: 80, left: 0, right: 400, width: 400, height: 80 } });
  const block = element('p', { rect: { top: 0, bottom: 80, left: 0, right: 400, width: 400, height: 80 } }, ['包邮AB']);
  root.append(block);
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map((text) => `번역${text}`) }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(block.childNodes[0].nodeValue, '번역包邮AB');
  assert.equal(block.classList.contains('pt-page-translator-pending'), false);
  assert.equal(created.some((node) => String(node.className).includes('pt-page-translator-sweep')), false);
  assert.equal(rangeReads, 1);
});

test('turning translation off restores originals and stops new batches', async () => {
  const root = element('div');
  const visible = element('a', {}, ['包邮']);
  root.append(visible);
  const { session, sent } = quietSession(root, {});
  session.start();
  await session.whenIdle();
  assert.equal(session.getStatus().enabled, true);
  assert.equal(visible.childNodes[0].nodeValue, 'T:包邮');
  session.setEnabled(false);
  assert.equal(session.getStatus().enabled, false);
  assert.equal(session.getStatus().showOriginal, true);
  assert.equal(visible.childNodes[0].nodeValue, '包邮');
  const added = element('p', {}, ['새문장']);
  root.append(added);
  session.emitMutations([{ type: 'childList', addedNodes: [added] }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sent.length, 1);
  assert.equal(added.childNodes[0].nodeValue, '새문장');
  session.setEnabled(true);
  await session.whenIdle();
  assert.equal(visible.childNodes[0].nodeValue, 'T:包邮');
  assert.equal(added.childNodes[0].nodeValue, 'T:새문장');
  assert.equal(session.getStatus().enabled, true);
});

test('cursor priority orders near-viewport text and leaves the in-flight batch alone', async () => {
  const root = element('div');
  const far = element('span', { rect: { top: 10, bottom: 30, left: 0, right: 40, width: 40, height: 20 } }, ['먼글']);
  const middle = element('span', { rect: { top: 10, bottom: 30, left: 200, right: 240, width: 40, height: 20 } }, ['중간글']);
  const near = element('span', { rect: { top: 10, bottom: 30, left: 400, right: 440, width: 40, height: 20 } }, ['가까운글']);
  const outside = element('li', { rect: { top: 9000, bottom: 9040, left: 400, right: 440, width: 40, height: 40 } }, ['화면밖']);
  root.append(far);
  root.append(middle);
  root.append(near);
  root.append(outside);
  const { session, sent, release } = quietSession(root, { prioritizeCursor: true, hold: true });
  session.notePointer(420, 20);
  session.start();
  await until(() => sent.length === 1);
  assert.deepEqual([...sent[0]], ['가까운글', '중간글', '먼글']);
  assert.equal(sent[0].includes('화면밖'), false);

  const addedNear = element('b', { rect: { top: 12, bottom: 28, left: 8, right: 30, width: 22, height: 16 } }, ['추가가까움']);
  const addedFar = element('b', { rect: { top: 12, bottom: 28, left: 800, right: 840, width: 40, height: 16 } }, ['추가멈']);
  root.append(addedNear);
  root.append(addedFar);
  session.emitMutations([{ type: 'childList', addedNodes: [addedNear, addedFar] }]);
  session.notePointer(12, 20);
  const inflight = [...sent[0]];
  release();
  await session.whenIdle();
  assert.deepEqual(inflight, ['가까운글', '중간글', '먼글']);
  assert.deepEqual([...sent[1]], ['추가가까움', '추가멈']);
  assert.equal(sent.some((batch) => batch.includes('화면밖')), false);
});

test('without cursor priority, pointer updates keep document order', async () => {
  const root = element('div');
  const far = element('span', { rect: { top: 10, bottom: 30, left: 0, right: 40, width: 40, height: 20 } }, ['먼글']);
  const near = element('span', { rect: { top: 10, bottom: 30, left: 400, right: 440, width: 40, height: 20 } }, ['가까운글']);
  root.append(far);
  root.append(near);
  const { session, sent } = quietSession(root, {});
  session.notePointer(420, 20);
  session.start();
  await session.whenIdle();
  assert.equal(session.getStatus().enabled, true);
  assert.deepEqual([...sent[0]], ['먼글', '가까운글']);
});

test('tooltips already in the target language are skipped and different ones share one request', async () => {
  const api = loadContent();
  assert.equal(api.isAlreadyTargetLanguage('무료 배송', 'ko'), true);
  assert.equal(api.isAlreadyTargetLanguage('免费配送', 'ko'), false);
  assert.equal(api.isAlreadyTargetLanguage('무료 配送', 'ko'), false);
  assert.equal(api.isAlreadyTargetLanguage('こんにちは', 'ja'), true);
  assert.equal(api.isAlreadyTargetLanguage('免费配送', 'zh-CN'), true);
  assert.equal(api.isAlreadyTargetLanguage('Hello', 'en'), false);
  const root = element('div');
  const calls = [];
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    titleFlushMs: 0,
    targetLanguage: 'ko',
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => {
      calls.push(texts);
      return { ok: true, translations: texts.map((text) => `번역:${text}`) };
    },
  });
  session.start();
  const korean = element('button', { attrs: { title: '무료 배송' } });
  const first = element('button', { attrs: { title: '购买商品' } });
  const second = element('button', { attrs: { title: '免费配送' } });
  assert.equal(await session.translateTitle(korean), true);
  assert.equal(korean.getAttribute('title'), '무료 배송');
  await Promise.all([session.translateTitle(first), session.translateTitle(second)]);
  assert.equal(calls.length, 1);
  assert.deepEqual([...calls[0]], ['购买商品', '免费配送']);
  assert.equal(first.getAttribute('title'), '번역:购买商品');
  assert.equal(second.getAttribute('title'), '번역:免费配送');
});

function trackStyle(node) {
  const bag = {};
  node.style = {
    setProperty(name, value) { bag[name] = String(value); },
    removeProperty(name) { delete bag[name]; },
    getPropertyValue(name) { return bag[name] || ''; },
  };
  node.locks = bag;
  return node;
}

function taobaoComputed(node) {
  return {
    direction: (node && node.dir) || 'ltr',
    font: '14px "PingFang SC", sans-serif',
    lineHeight: '22px',
    letterSpacing: 'normal',
    color: 'rgb(17, 25, 45)',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundImage: 'none',
    whiteSpace: 'normal',
    textOverflow: 'clip',
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
    display: 'block',
    maxWidth: 'none',
    webkitLineClamp: 'none',
    ...(node && node.lineStyle),
  };
}

test('single-line mode, hard breaks, and the sweep slot stay predictable', () => {
  const api = loadContent();
  assert.equal(api.textLineMode({ whiteSpace: 'nowrap' }), 'single');
  assert.equal(api.textLineMode({ whiteSpace: 'pre' }), 'single');
  assert.equal(api.textLineMode({ webkitLineClamp: '1', display: '-webkit-box' }), 'single');
  assert.equal(api.textLineMode({
    webkitLineClamp: '2',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }), 'clamp');
  assert.equal(api.textLineMode({ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'normal' }), 'single');
  assert.equal(api.textLineMode({ whiteSpace: 'normal' }), 'flow');
  assert.equal(api.textLineMode(null), 'flow');
  assert.equal(api.fitTranslation('旗舰店', '플래그십\n스토어', 'single'), '플래그십 스토어');
  assert.equal(api.fitTranslation('第一行\n第二行', '첫 줄\n둘째', 'flow'), '첫 줄\n둘째');
  assert.equal(api.fitTranslation('包邮说明', '무료배송\n안내', 'flow'), '무료배송 안내');
  assert.equal(api.fitTranslation('标题', '제목\n둘', 'clamp'), '제목 둘');
  assert.equal(api.fitTranslation('第一\n第二', '첫\n둘', 'clamp'), '첫\n둘');
  const glyph = { left: 0, top: 4, width: 40, height: 16 };
  assert.deepEqual(api.slotRect(glyph, { left: 0, top: 0, width: 160, height: 22 }, 'flow'), glyph);
  const single = api.slotRect(glyph, { left: 0, top: 0, width: 160, height: 22 }, 'single');
  assert.equal(single.width, 160);
  assert.equal(single.height, 16);
  assert.equal(api.slotRect(glyph, { left: 0, top: 0, width: 200, height: 44 }, 'clamp').height, 44);
});

test('taobao single-line cards keep nowrap and ellipsis after translation', async () => {
  const dictionary = {
    旗舰店: '플래그십\n스토어',
    券后: '쿠폰\n적용가',
    送料無料: '배송료\n무료',
    女装: '여성\n의류',
    Free: '무료\n배송',
    夏季新款连衣裙: '여름\n신상 원피스 아주 긴 이름',
    夏季新款: '여름\n신상',
    '第一行\n第二行': '첫 줄\n둘째 줄',
    包邮说明: '무료배송\n안내',
    颜色分类: '색상\n분류',
    购买商品: '상품\n구매',
  };
  const root = element('div');
  const shopHost = element('div');
  const shop = trackStyle(element('span', {}, ['旗舰店']));
  shop.lineStyle = {
    display: 'inline', whiteSpace: 'nowrap', overflow: 'hidden', overflowX: 'hidden',
    textOverflow: 'ellipsis', maxWidth: '140px',
  };
  shopHost.append(shop);
  const priceRow = trackStyle(element('div'));
  priceRow.lineStyle = { display: 'flex', whiteSpace: 'nowrap' };
  const price = trackStyle(element('span', {}, ['券后']));
  price.lineStyle = {
    display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', overflowX: 'hidden',
    textOverflow: 'ellipsis', maxWidth: 'none',
  };
  priceRow.append(price);
  const jp = trackStyle(element('span', {}, ['送料無料']));
  jp.lineStyle = {
    display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', overflowX: 'hidden',
    textOverflow: 'ellipsis', maxWidth: '96px',
  };
  const nav = trackStyle(element('nav'));
  nav.lineStyle = { display: 'flex', whiteSpace: 'nowrap' };
  const category = trackStyle(element('a', {}, ['女装']));
  category.lineStyle = { display: 'inline', whiteSpace: 'nowrap', maxWidth: 'none' };
  const english = trackStyle(element('a', {}, ['Free']));
  english.lineStyle = { display: 'inline', whiteSpace: 'nowrap', maxWidth: 'none' };
  nav.append(category);
  nav.append(english);
  const card = trackStyle(element('div'));
  card.lineStyle = { display: 'flex', whiteSpace: 'normal' };
  const title = trackStyle(element('div', {
    rect: { top: 0, bottom: 44, left: 0, right: 220, width: 220, height: 44 },
  }, ['夏季新款连衣裙']));
  title.lineStyle = {
    display: '-webkit-box', webkitLineClamp: '2', overflow: 'hidden', overflowY: 'hidden',
    whiteSpace: 'normal', textOverflow: 'ellipsis', maxWidth: 'none',
  };
  card.append(title);
  const heading = trackStyle(element('h3', {}, ['夏季新款']));
  heading.lineStyle = {
    display: 'block', whiteSpace: 'normal', overflow: 'hidden', overflowX: 'hidden',
    textOverflow: 'ellipsis', maxWidth: 'none',
  };
  const paragraph = trackStyle(element('p', {}, ['第一行\n第二行']));
  paragraph.lineStyle = { display: 'block', whiteSpace: 'normal' };
  const note = trackStyle(element('p', {}, ['包邮说明']));
  note.lineStyle = { display: 'block', whiteSpace: 'pre-wrap' };
  const cell = trackStyle(element('td', {}, ['颜色分类']));
  cell.lineStyle = {
    display: 'table-cell', whiteSpace: 'nowrap', overflow: 'hidden', overflowX: 'hidden',
    textOverflow: 'ellipsis', maxWidth: 'none',
  };
  for (const node of [shopHost, priceRow, jp, nav, card, heading, paragraph, note, cell]) root.append(node);

  const api = loadContent({ getComputedStyle: taobaoComputed });
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => dictionary[text] || `번역:${text}`),
    }),
  });
  session.start();
  await session.whenIdle();

  assert.equal(shop.childNodes[0].nodeValue, '플래그십 스토어');
  assert.equal(shop.locks['white-space'], 'nowrap');
  assert.equal(shop.locks.overflow, 'hidden');
  assert.equal(shop.locks['text-overflow'], 'ellipsis');
  assert.equal(shop.locks['min-width'], '0');
  assert.equal(shop.locks.display, 'inline-block');
  assert.equal(shop.locks['max-width'], undefined);

  assert.equal(price.childNodes[0].nodeValue, '쿠폰 적용가');
  assert.equal(price.locks['white-space'], 'nowrap');
  assert.equal(price.locks['min-width'], '0');
  assert.equal(price.locks['max-width'], '100%');
  assert.equal(price.locks.display, undefined);
  assert.equal(Object.keys(priceRow.locks).length, 0);

  assert.equal(jp.childNodes[0].nodeValue, '배송료 무료');
  assert.equal(jp.locks.display, undefined);
  assert.equal(jp.locks['max-width'], undefined);
  assert.equal(jp.locks['white-space'], 'nowrap');

  assert.equal(category.childNodes[0].nodeValue, '여성 의류');
  assert.equal(english.childNodes[0].nodeValue, '무료 배송');
  assert.equal(category.locks.display, 'inline-block');
  assert.equal(category.locks['white-space'], 'nowrap');
  assert.equal(english.locks['text-overflow'], 'ellipsis');
  assert.equal(Object.keys(nav.locks).length, 0);

  assert.equal(title.childNodes[0].nodeValue, '여름 신상 원피스 아주 긴 이름');
  assert.equal(title.locks['white-space'], undefined);
  assert.equal(title.locks.display, undefined);
  assert.equal(title.locks['min-width'], '0');
  assert.equal(title.locks['max-width'], '100%');
  assert.equal(Object.keys(card.locks).length, 0);
  assert.equal(title.classList.contains('pt-page-translator-prism'), false);

  assert.equal(heading.childNodes[0].nodeValue, '여름 신상');
  assert.equal(heading.locks['white-space'], 'nowrap');
  assert.equal(heading.locks['text-overflow'], 'ellipsis');

  assert.equal(paragraph.childNodes[0].nodeValue, '첫 줄\n둘째 줄');
  assert.equal(Object.keys(paragraph.locks).length, 0);
  assert.equal(note.childNodes[0].nodeValue, '무료배송 안내');
  assert.equal(Object.keys(note.locks).length, 0);

  assert.equal(cell.childNodes[0].nodeValue, '색상 분류');
  assert.equal(cell.locks['white-space'], 'nowrap');
  assert.equal(cell.locks.display, undefined);

  const tip = element('button', { attrs: { title: '购买商品' } });
  assert.equal(await session.translateTitle(tip), true);
  assert.equal(tip.getAttribute('title'), '상품 구매');

  session.setEnabled(false);
  assert.equal(shop.childNodes[0].nodeValue, '旗舰店');
  assert.equal(Object.keys(shop.locks).length, 0);
  assert.equal(title.childNodes[0].nodeValue, '夏季新款连衣裙');
  assert.equal(Object.keys(title.locks).length, 0);
  assert.equal(paragraph.childNodes[0].nodeValue, '第一行\n第二行');
  assert.equal(category.childNodes[0].nodeValue, '女装');
  assert.equal(Object.keys(category.locks).length, 0);

  session.setEnabled(true);
  await session.whenIdle();
  assert.equal(shop.childNodes[0].nodeValue, '플래그십 스토어');
  assert.equal(shop.locks['white-space'], 'nowrap');
  assert.equal(title.locks['white-space'], undefined);
  assert.equal(paragraph.childNodes[0].nodeValue, '첫 줄\n둘째 줄');
});

test('the prism sweep keeps single-line slots and does not open a clamped title', async () => {
  const created = [];
  const timers = [];
  const frames = [];
  let clock = 0;
  const api = loadContent({
    document: revealDocument(created),
    getComputedStyle: taobaoComputed,
  });
  const root = element('div');
  const shop = trackStyle(element('span', {
    rect: { top: 8, bottom: 30, left: 0, right: 160, width: 160, height: 22 },
  }, ['旗舰店']));
  shop.lineStyle = {
    display: 'inline', whiteSpace: 'nowrap', overflow: 'hidden', overflowX: 'hidden',
    textOverflow: 'ellipsis', maxWidth: '160px',
  };
  const title = trackStyle(element('div', {
    rect: { top: 40, bottom: 84, left: 0, right: 200, width: 200, height: 44 },
  }, ['夏季新款连衣裙']));
  title.lineStyle = {
    display: '-webkit-box', webkitLineClamp: '2', overflow: 'hidden', overflowY: 'hidden',
    whiteSpace: 'normal', maxWidth: 'none',
  };
  const rtl = trackStyle(element('span', {
    rect: { top: 90, bottom: 112, left: 0, right: 120, width: 120, height: 22 },
  }, ['שלום']));
  rtl.dir = 'rtl';
  rtl.lineStyle = {
    display: 'inline', whiteSpace: 'nowrap', overflow: 'hidden', overflowX: 'hidden',
    textOverflow: 'ellipsis', maxWidth: '120px', direction: 'rtl',
  };
  const paragraph = trackStyle(element('p', {
    rect: { top: 120, bottom: 200, left: 0, right: 400, width: 400, height: 80 },
  }, ['Hello']));
  paragraph.lineStyle = { display: 'block', whiteSpace: 'normal' };
  root.append(shop);
  root.append(title);
  root.append(rtl);
  root.append(paragraph);

  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    now: () => clock,
    requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    },
    measureRect() { return { left: 0, top: 4, width: 40, height: 16 }; },
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => ({
        旗舰店: '플래그십\n스토어',
        夏季新款连衣裙: '여름\n신상 원피스',
        שלום: '안녕\n하세요',
        Hello: '안녕\n하세요',
      }[text] || text)),
    }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(created.some((node) => String(node.className).includes('pt-page-translator-sweep')), false);
  assert.equal(shop.childNodes[0].nodeValue, '플래그십 스토어');
  assert.equal(shop.locks['white-space'], 'nowrap');
  assert.equal(shop.locks['min-width'], '0');
  assert.equal(shop.classList.contains('pt-page-translator-pending'), false);
  assert.equal(title.childNodes[0].nodeValue, '여름 신상 원피스');
  assert.equal(title.locks['white-space'], undefined);
  assert.equal(title.locks['min-width'], '0');
  assert.equal(rtl.childNodes[0].nodeValue, '안녕 하세요');
  assert.equal(rtl.locks['white-space'], 'nowrap');
  assert.equal(paragraph.childNodes[0].nodeValue, '안녕 하세요');
  assert.equal(paragraph.locks['white-space'], undefined);

  session.setEnabled(false);
  assert.equal(shop.childNodes[0].nodeValue, '旗舰店');
  assert.equal(Object.keys(shop.locks).length, 0);
  assert.equal(rtl.childNodes[0].nodeValue, 'שלום');
  assert.equal(Object.keys(rtl.locks).length, 0);
  assert.equal(title.childNodes[0].nodeValue, '夏季新款连衣裙');
  assert.equal(Object.keys(title.locks).length, 0);
  assert.equal(paragraph.childNodes[0].nodeValue, 'Hello');
  assert.equal(shop.classList.contains('pt-page-translator-prism'), false);
  assert.equal(rtl.classList.contains('pt-page-translator-prism'), false);
});

test('chat bubbles inside shadow roots, including ones that arrive later, are translated', async () => {
  const observed = [];
  const api = loadContent({
    chrome: {
      dom: {
        openOrClosedShadowRoot(node) {
          return node.closedShadow || null;
        },
      },
    },
  });
  const root = element('div');
  const host = element('div');
  const shadow = { nodeType: 11, childNodes: [], parentElement: null };
  host.shadowRoot = shadow;
  const closedHost = element('div');
  const closed = { nodeType: 11, childNodes: [], parentElement: null };
  closedHost.closedShadow = closed;
  const first = element('span', {}, ['官方旗舰店']);
  first.parentElement = closed;
  closed.childNodes.push(first);
  root.append(host);
  root.append(closedHost);

  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class {
      observe(target) { observed.push(target); }
      disconnect() {}
    },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => ({
        官方旗舰店: '공식 플래그십 스토어',
        在吗: '계세요?',
        你好: '안녕하세요',
      }[text] || text)),
    }),
  });
  session.start();
  await session.whenIdle();
  assert.ok(observed.includes(shadow));
  assert.ok(observed.includes(closed));
  assert.equal(first.childNodes[0].nodeValue, '공식 플래그십 스토어');

  const bubble = element('div', {}, ['在吗']);
  shadow.childNodes.push(bubble);
  session.emitMutations([{ type: 'childList', target: shadow, addedNodes: [bubble] }]);
  await session.whenIdle();
  assert.equal(bubble.childNodes[0].nodeValue, '계세요?');

  const lateHost = element('div');
  const lateShadow = { nodeType: 11, childNodes: [], parentElement: null };
  const lateText = element('span', {}, ['你好']);
  lateText.parentElement = lateShadow;
  lateShadow.childNodes.push(lateText);
  lateHost.shadowRoot = lateShadow;
  root.append(lateHost);
  session.emitMutations([{ type: 'childList', target: root, addedNodes: [lateHost] }]);
  await session.whenIdle();
  assert.equal(lateText.childNodes[0].nodeValue, '안녕하세요');
  assert.ok(observed.includes(lateShadow));
});

test('rescan translates chat text that showed up without a mutation', async () => {
  const api = loadContent();
  const root = element('div');
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => (text === '包邮' ? '무료배송' : text)),
    }),
  });
  session.start();
  await session.whenIdle();
  const bubble = element('p', {}, ['包邮']);
  root.append(bubble);
  assert.equal(bubble.childNodes[0].nodeValue, '包邮');
  session.rescan();
  await session.whenIdle();
  assert.equal(bubble.childNodes[0].nodeValue, '무료배송');

  session.setEnabled(false);
  const quiet = element('p', {}, ['颜色']);
  root.append(quiet);
  session.rescan();
  await session.whenIdle();
  assert.equal(quiet.childNodes[0].nodeValue, '颜色');
});

test('a chat frame added after translation starts asks for another pass', async () => {
  const messages = [];
  const timers = [];
  const source = readFileSync(new URL('../content/content.js', import.meta.url), 'utf8');
  assert.match(source, /hashchange/);
  assert.match(source, /popstate/);
  assert.match(source, /openOrClosedShadowRoot/);
  const api = loadContent({
    chrome: {
      runtime: {
        sendMessage(message) {
          messages.push(message);
          return Promise.resolve();
        },
      },
    },
  });
  assert.equal(api.frameHostAdded(element('iframe')), true);
  assert.equal(api.frameHostAdded(element('frame')), true);
  assert.equal(api.frameHostAdded(element('div')), false);
  const wrap = element('div');
  wrap.querySelector = (selector) => (String(selector).includes('iframe') ? element('iframe') : null);
  assert.equal(api.frameHostAdded(wrap), true);
  const plain = element('section');
  plain.querySelector = () => null;
  assert.equal(api.frameHostAdded(plain), false);
  assert.equal(api.frameHostAdded(textNode('你好')), false);

  const root = element('div');
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    setTimer(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map(() => '') }),
  });
  session.start();
  const frame = element('iframe');
  session.emitMutations([{ type: 'childList', addedNodes: [frame, wrap] }]);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 200);
  assert.equal(messages.length, 0);
  timers[0].fn();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'TRANSLATE_FRAMES');

  session.setEnabled(false);
  session.emitMutations([{ type: 'childList', addedNodes: [element('iframe')] }]);
  assert.equal(timers.length, 1);
  assert.equal(messages.length, 1);
});

test('a shadow root attached onto an existing chat host is picked up', async () => {
  const observed = [];
  const api = loadContent({
    chrome: {
      dom: {
        openOrClosedShadowRoot(node) {
          return node.closedShadow || null;
        },
      },
    },
  });
  const root = element('div');
  const host = element('div');
  root.append(host);
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class {
      observe(target) { observed.push(target); }
      disconnect() {}
    },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => (text === '明天发货' ? '내일 출고' : text)),
    }),
  });
  session.start();
  await session.whenIdle();
  const shadow = { nodeType: 11, childNodes: [], parentElement: null };
  const bubble = element('span', {}, ['明天发货']);
  bubble.parentElement = shadow;
  shadow.childNodes.push(bubble);
  host.closedShadow = shadow;
  session.emitMutations([{ type: 'childList', target: host, addedNodes: [] }]);
  await session.whenIdle();
  assert.ok(observed.includes(shadow));
  assert.equal(bubble.childNodes[0].nodeValue, '내일 출고');
});

test('hover title tooltips are translated once and restored with the page', async () => {
  const root = element('div');
  const api = loadContent();
  const calls = [];
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => {
      calls.push(texts);
      return { ok: true, translations: texts.map((text) => `번역:${text}`) };
    },
  });
  session.start();
  const button = element('button', { attrs: { title: '购买商品' } });
  assert.equal(await session.translateTitle(button), true);
  assert.equal(button.getAttribute('title'), '번역:购买商品');
  assert.equal(await session.translateTitle(button), true);
  assert.equal(calls.length, 1);
  session.setEnabled(false);
  assert.equal(button.getAttribute('title'), '购买商品');
  session.setEnabled(true);
  assert.equal(button.getAttribute('title'), '번역:购买商品');
});

test('placeholder, aria-label, short status, and a sent message added later are translated', async () => {
  const api = loadContent();
  const root = element('div');
  const input = element('input', { attrs: { placeholder: '搜索最近联系人', 'aria-label': '搜索联系人' } });
  const tip = element('span', { attrs: { title: '已读' } });
  root.append(input);
  root.append(tip);
  const dictionary = {
    搜索最近联系人: '최근 연락처 검색',
    搜索联系人: '연락처 검색',
    已读: '읽음',
    '东西质量好，老板人品也好': '물건 품질도 좋고 사장님 인품도 좋아요',
  };
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    titleFlushMs: 0,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => dictionary[text] || `번역:${text}`),
    }),
  });
  session.start();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await session.whenIdle();
  assert.equal(input.getAttribute('placeholder'), '최근 연락처 검색');
  assert.equal(input.getAttribute('aria-label'), '연락처 검색');
  assert.equal(tip.getAttribute('title'), '읽음');

  const editor = element('div', { editable: true, contentEditable: 'true' }, ['正在输入']);
  const sent = element('div', { contentEditable: 'false' }, ['东西质量好，老板人品也好']);
  editor.append(sent);
  const status = element('span', {}, ['已读']);
  root.append(editor);
  root.append(status);
  session.emitMutations([{ type: 'childList', addedNodes: [editor, status] }]);
  await session.whenIdle();
  assert.equal(editor.childNodes[0].nodeValue, '正在输入');
  assert.equal(sent.childNodes[0].nodeValue, '물건 품질도 좋고 사장님 인품도 좋아요');
  assert.equal(status.childNodes[0].nodeValue, '읽음');
});

test('a clipped chat bubble wraps the longer translation', async () => {
  const api = loadContent({ getComputedStyle: taobaoComputed });
  assert.equal(api.textLineMode({ whiteSpace: 'nowrap', overflow: 'hidden', height: '40px', textOverflow: 'clip' }), 'grow');
  assert.equal(api.textLineMode({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }), 'single');
  const root = element('div');
  const bubble = trackStyle(element('div', {}, ['东西质量好']));
  bubble.lineStyle = {
    display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', overflowY: 'hidden',
    height: '40px', textOverflow: 'clip', maxWidth: 'none',
  };
  root.append(bubble);
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async () => ({ ok: true, translations: ['물건 품질도 좋고 사장님 인품도 좋아요'] }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(bubble.childNodes[0].nodeValue, '물건 품질도 좋고 사장님 인품도 좋아요');
  assert.equal(bubble.locks['white-space'], 'normal');
  assert.equal(bubble.locks['overflow-x'], 'hidden');
  assert.equal(bubble.locks['overflow-wrap'], 'anywhere');
  assert.equal(bubble.locks.height, 'auto');
  assert.equal(bubble.locks['max-height'], 'none');
});

test('a sidebar ghost layer is hidden so only the translation shows', async () => {
  const api = loadContent({
    getComputedStyle(node, pseudo) {
      if (pseudo) return { content: node.pseudoContent || 'none' };
      return { position: node.position || 'static', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', height: '32px', maxWidth: 'none', textOverflow: 'clip' };
    },
  });
  const root = element('div');
  const row = element('a');
  const label = trackStyle(element('span', {}, ['计算机/文具']));
  const ghost = element('span', {}, ['计算机/文具']);
  ghost.position = 'absolute';
  const fly = element('i');
  fly.pseudoContent = '"计算机/文具"';
  row.append(label);
  row.append(ghost);
  row.append(fly);
  root.append(row);
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map(() => '컴퓨터/문구') }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(label.childNodes[0].nodeValue, '컴퓨터/문구');
  assert.equal(ghost.classList.contains('pt-page-translator-dup'), true);
  assert.equal(fly.classList.contains('pt-page-translator-nops'), true);
  assert.equal(label.locks['overflow-x'], 'hidden');
});

test('switching chats retranslates a reused text node and a replaced pane', async () => {
  const api = loadContent();
  const root = element('div');
  const pane = element('div');
  const hello = element('div', {}, ['您好']);
  pane.append(hello);
  root.append(pane);
  let saw = false;
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target) { this.target = target; }
      disconnect() {}
    },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({
      ok: true,
      translations: texts.map((text) => ({
        您好: '안녕하세요',
        '这边看下您已经支付订单了，会尽快给您安排下哈': '결제하신 주문을 확인했고, 곧 준비해 드릴게요',
      }[text] || `번역:${text}`)),
    }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(hello.childNodes[0].nodeValue, '안녕하세요');

  hello.childNodes[0].nodeValue = '这边看下您已经支付订单了，会尽快给您安排下哈';
  session.emitMutations([{ type: 'characterData', target: hello.childNodes[0] }]);
  await session.whenIdle();
  assert.equal(hello.childNodes[0].nodeValue, '결제하신 주문을 확인했고, 곧 준비해 드릴게요');

  pane.childNodes.length = 0;
  const again = element('div', {}, ['您好']);
  pane.append(again);
  session.emitMutations([{ type: 'childList', target: pane, addedNodes: [again], removedNodes: [hello] }]);
  await session.whenIdle();
  assert.equal(again.childNodes[0].nodeValue, '안녕하세요');

  const hidden = element('span', { rect: { top: 20, bottom: 40, left: 0, right: 80, width: 80, height: 20 } }, ['您好']);
  root.append(hidden);
  let observer;
  const watched = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    revealAnimation: false,
    IntersectionObserver: class {
      constructor(callback) { observer = callback; }
      observe() {}
      disconnect() {}
    },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => {
      saw = texts.includes('新对话');
      return { ok: true, translations: texts.map((text) => (text === '新对话' ? '새 대화' : text)) };
    },
  });
  watched.start();
  await watched.whenIdle();
  if (observer) observer([{ target: hidden, isIntersecting: false }]);
  hidden.childNodes[0].nodeValue = '新对话';
  watched.emitMutations([{ type: 'characterData', target: hidden.childNodes[0] }]);
  await watched.whenIdle();
  assert.equal(saw, true);
  assert.equal(hidden.childNodes[0].nodeValue, '새 대화');
});
