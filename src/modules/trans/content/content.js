(function pageTranslatorContent() {
  'use strict';

  const HOST_ID = 'page-translator-root';
  const STYLE_ID = 'page-translator-motion';
  const PENDING_CLASS = 'pt-page-translator-pending';
  const PENDING_LIVE_CLASS = 'pt-page-translator-pending-live';
  const FADE_CLASS = 'pt-page-translator-fade';
  const REVEAL_CLASS = 'pt-page-translator-reveal';
  const HOLD_CLASS = 'pt-page-translator-hold';
  const SWEEP_CLASS = 'pt-page-translator-sweep';
  const EDGE_CLASS = 'pt-sweep-edge';
  const PRISM_CLASS = 'pt-page-translator-prism';
  const MAX_LIVE_PENDING = 8;
  const WIPER_MS = 680;
  const SOFT_MS = 220;
  const PRISM_MS = 860;
  // 번역을 기다리는 글자만 살짝 흐려진다. 배경, 그라데이션, 막대는 쓰지 않는다.
  const MOTION_CSS = [
    `.pt-page-translator-dup { visibility: hidden !important; }`,
    `.pt-page-translator-nops::before, .pt-page-translator-nops::after { content: none !important; }`,
    `.${PENDING_CLASS} { animation: pt-pending-pulse 1.1s ease-in-out infinite; }`,
    '@keyframes pt-pending-pulse {',
    '0%, 100% { opacity: 1; }',
    '50% { opacity: 0.72; }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    `.${PENDING_CLASS} { animation: none; opacity: 1; }`,
    '}',
  ].join('');
  const MAX_ITEMS = 24;
  const MAX_CHARS = 4000;
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT',
    'OPTION', 'OPTGROUP', 'KBD', 'SAMP', 'TEMPLATE', 'SVG', 'MATH', 'CANVAS',
    'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'TITLE', 'META', 'LINK', 'VAR',
    'NOFRAMES', 'XMP', 'PLAINTEXT',
  ]);
  const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET',
    'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD', 'TH', 'UL',
  ]);

  function splitWhitespace(value) {
    const match = String(value ?? '').match(/^(\s*)([\s\S]*?)(\s*)$/);
    return { lead: match[1], core: match[2], trail: match[3] };
  }

  function hasHardBreak(value) {
    return /[\r\n\u2028\u2029]/.test(String(value ?? ''));
  }

  // 모델이 넣은 줄바꿈만 공백으로 바꾼다. 원문의 줄바꿈은 남겨 둔다.
  function flattenHardBreaks(value) {
    return String(value ?? '').replace(/[ \t]*[\r\n\u2028\u2029]+[ \t]*/g, ' ');
  }

  function lineClampOf(style) {
    if (!style) return 0;
    const raw = style.webkitLineClamp ?? style.lineClamp ?? style['-webkit-line-clamp'];
    if (raw == null || raw === 'none' || raw === '') return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function overflowClips(style) {
    if (!style) return false;
    return [style.overflow, style.overflowX, style.overflowY].some((value) => value === 'hidden' || value === 'clip');
  }

  function pixelLength(value) {
    const match = /^(\d+(?:\.\d+)?)px$/.exec(String(value || '').trim());
    return match ? Number(match[1]) : 0;
  }

  // single: 말줄임 한 줄. grow: 고정 높이·줄바꿈 금지로 번역이 잘리는 말풍선. clamp: 2줄 이상. flow: 문단.
  function textLineMode(style) {
    if (!style) return 'flow';
    const clamp = lineClampOf(style);
    if (clamp === 1) return 'single';
    if (clamp > 1) return 'clamp';
    const clips = overflowClips(style);
    const ellipsis = style.textOverflow === 'ellipsis';
    const whiteSpace = String(style.whiteSpace || '');
    const fixed = pixelLength(style.height) >= 16 || (pixelLength(style.maxHeight) >= 16 && pixelLength(style.maxHeight) <= 800);
    if (clips && !ellipsis && (fixed || whiteSpace === 'nowrap' || whiteSpace === 'pre')) return 'grow';
    if (whiteSpace === 'nowrap' || whiteSpace === 'pre') return 'single';
    if (ellipsis && clips) return 'single';
    return 'flow';
  }

  // 한 줄·말풍선은 줄바꿈을 없애 칸 안에서 흐르게 한다. 문단은 원문에 줄바꿈이 없을 때만 없앤다.
  function fitTranslation(sourceCore, translated, mode) {
    const text = String(translated ?? '');
    if (mode === 'single' || mode === 'grow' || !hasHardBreak(sourceCore)) return flattenHardBreaks(text);
    return text;
  }

  // 번역이 길어도 원래 칸 너비 안에서 말줄임이 되도록, 글자 상자보다 칸이 넓으면 칸을 쓴다.
  function slotRect(glyph, elementRect, mode) {
    if (!glyph) {
      if ((mode === 'single' || mode === 'clamp') && elementRect) return elementRect;
      return null;
    }
    if ((mode !== 'single' && mode !== 'clamp') || !elementRect) return glyph;
    const right = elementRect.left + elementRect.width;
    const width = Math.max(glyph.width, right - glyph.left);
    const height = mode === 'clamp' ? Math.max(glyph.height, elementRect.height) : glyph.height;
    return {
      left: glyph.left,
      top: glyph.top,
      width: Math.max(width, 1),
      height: Math.max(height, 1),
    };
  }

  function isTranslatable(core) {
    if (!core || core.length > 20000) return false;
    return /\p{L}/u.test(core);
  }

  function scriptCounts(text) {
    const count = (re) => (String(text || '').match(re) || []).length;
    return {
      hangul: count(/\p{Script=Hangul}/gu),
      han: count(/\p{Script=Han}/gu),
      kana: count(/\p{Script=Hiragana}/gu) + count(/\p{Script=Katakana}/gu),
      cyrillic: count(/\p{Script=Cyrillic}/gu),
      thai: count(/\p{Script=Thai}/gu),
    };
  }

  // 글자 체계가 목표 언어와 같으면 번역하지 않는다.
  // 영어·프랑스어처럼 로마자를 쓰는 언어는 서로 구분하지 않으므로 여기서 건너뛰지 않는다.
  function isAlreadyTargetLanguage(text, language) {
    const counts = scriptCounts(text);
    const letters = counts.hangul + counts.han + counts.kana + counts.cyrillic + counts.thai;
    if (!letters) return false;
    const code = String(language || 'ko').toLowerCase();
    const mostly = (n) => n / letters >= 0.8;
    if (code === 'ko') return mostly(counts.hangul) && counts.han + counts.kana === 0;
    if (code === 'ja') return counts.kana > 0 && mostly(counts.kana + counts.han) && counts.hangul === 0;
    if (code === 'zh' || code === 'zh-cn' || code === 'zh-tw') return mostly(counts.han) && counts.hangul + counts.kana === 0;
    if (code === 'ru') return mostly(counts.cyrillic);
    if (code === 'th') return mostly(counts.thai);
    return false;
  }

  function isSkipElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.id === HOST_ID || element.id === STYLE_ID) return true;
    if (classHas(element, SWEEP_CLASS) || classHas(element, 'pt-page-translator-probe')) return true;
    const tag = String(element.tagName || '').toUpperCase();
    if (SKIP_TAGS.has(tag)) return true;
    if (typeof element.getAttribute === 'function' && element.getAttribute('translate') === 'no') return true;
    return false;
  }

  // 입력 중인 칸의 글만 건너뛴다. contenteditable=false 로 박아 둔 보낸 메시지는 번역한다.
  function editableState(element) {
    if (!element || element.nodeType !== 1) return 'inherit';
    const value = element.contentEditable;
    if (value === 'false') return 'off';
    if (value === 'true' || value === 'plaintext-only') return 'on';
    if ((value == null || value === '') && element.isContentEditable) return 'on';
    return 'inherit';
  }

  function inLiveEditor(element) {
    let node = element;
    while (node && node.nodeType === 1) {
      const state = editableState(node);
      if (state === 'off') return false;
      if (state === 'on') return true;
      node = node.parentElement;
    }
    return false;
  }

  function shouldSkipText(node) {
    const parent = node && node.parentElement;
    if (!parent) return true;
    if (inLiveEditor(parent)) return true;
    let element = parent;
    while (element) {
      if (isSkipElement(element)) return true;
      element = element.parentElement;
    }
    return false;
  }

  // iframe 글자는 부모 문서에 없다. 그 창이 생겼는지만 보고, 번역은 그 창 문서에서 따로 켠다.
  function frameHostAdded(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = String(node.tagName || '').toUpperCase();
    if (tag === 'IFRAME' || tag === 'FRAME') return true;
    if (typeof node.querySelector !== 'function') return false;
    try {
      return Boolean(node.querySelector('iframe, frame'));
    } catch {
      return false;
    }
  }

  function defaultIsNearViewport(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return false;
    const rect = element.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return false;
    const height = globalThis.innerHeight || 800;
    const width = globalThis.innerWidth || 1200;
    const margin = Math.max(height * 1.5, 600);
    return rect.bottom >= -margin
      && rect.top <= height + margin
      && rect.right >= -margin
      && rect.left <= width + margin;
  }

  function connected(node) {
    if (typeof node.isConnected === 'boolean') return node.isConnected;
    return true;
  }

  function classHas(element, name) {
    if (!element) return false;
    if (element.classList && element.classList.contains(name)) return true;
    const className = element.className;
    return typeof className === 'string' && className.split(/\s+/).includes(name);
  }

  function clamp01(value) {
    const n = Number(value);
    if (!(n > 0)) return 0;
    if (n > 1) return 1;
    return n;
  }

  function easeInOut(value) {
    const t = clamp01(value);
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }

  // One vertical pass. `at` is the moment the line reaches the box center.
  // lineStart sits before the first box so progress is 0 at t = 0, and
  // lineEnd sits after the last box so progress is 1 at t = 1.
  function planWiperOrder(nodes, direction) {
    const dir = direction === 'up' ? 'up' : 'down';
    const boxes = [];
    for (const node of nodes || []) {
      const top = Number(node.top) || 0;
      const height = Math.max(Number(node.height) || 0, 1);
      boxes.push({ id: node.id, top, height, mid: top + height / 2 });
    }
    if (!boxes.length) {
      return {
        direction: dir,
        from: 0,
        to: 0,
        span: 1,
        anchorMin: 0,
        anchorMax: 1,
        lineStart: 0,
        lineEnd: 1,
        order: [],
      };
    }
    let anchorMin = boxes[0].top;
    let anchorMax = boxes[0].top + boxes[0].height;
    for (const box of boxes) {
      if (box.top < anchorMin) anchorMin = box.top;
      const bottom = box.top + box.height;
      if (bottom > anchorMax) anchorMax = bottom;
    }
    const span = Math.max(anchorMax - anchorMin, 1);
    const order = boxes.map((box) => {
      const band = Math.min(1, Math.max(box.height / span, 0.04));
      const at = dir === 'up' ? (anchorMax - box.mid) / span : (box.mid - anchorMin) / span;
      return { id: box.id, at: clamp01(at), band, top: box.top, height: box.height };
    });
    order.sort((a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)));
    let lead = 0.04;
    let tail = 0;
    for (const item of order) {
      lead = Math.max(lead, item.band / 2);
      tail = Math.max(tail, item.at + item.band / 2);
    }
    return {
      direction: dir,
      from: dir === 'up' ? anchorMax : anchorMin,
      to: dir === 'up' ? anchorMin : anchorMax,
      span,
      anchorMin,
      anchorMax,
      lineStart: -lead,
      lineEnd: Math.max(tail, lead),
      order,
    };
  }

  function crossProgress(line, at, band) {
    const width = Math.max(Number(band) || 0, 0.04);
    const start = Number(at) - width / 2;
    return clamp01((Number(line) - start) / width);
  }

  function wiperSpot(plan, top, height) {
    const safeHeight = Math.max(Number(height) || 0, 1);
    const mid = (Number(top) || 0) + safeHeight / 2;
    const span = plan && plan.span ? plan.span : 1;
    const at = plan && plan.direction === 'up'
      ? ((plan.anchorMax || 0) - mid) / span
      : (mid - ((plan && plan.anchorMin) || 0)) / span;
    return {
      at: clamp01(at),
      band: Math.min(1, Math.max(safeHeight / span, 0.04)),
    };
  }

  function lineSample(plan, elapsed, duration) {
    const t = clamp01(elapsed / (duration || 1));
    const eased = easeInOut(t);
    return {
      t,
      eased,
      line: plan.lineStart + (plan.lineEnd - plan.lineStart) * eased,
      y: plan.from + (plan.to - plan.from) * eased,
    };
  }

  function createSession(options) {
    const root = options.root;
    const walkRoot = options.walkRoot || root;
    const sendBatch = options.sendBatch;
    const onStatus = options.onStatus || function () {};
    const isNearViewport = options.isNearViewport || defaultIsNearViewport;
    const setTimer = options.setTimer || function (fn, ms) { return setTimeout(fn, ms); };
    const clearTimer = options.clearTimer || clearTimeout;
    const enableBanner = options.enableBanner !== false && typeof document !== 'undefined';
    let prioritizeCursor = Boolean(options.prioritizeCursor);
    let revealAnimation = options.revealAnimation !== false;
    let targetLanguage = typeof options.targetLanguage === 'string' && options.targetLanguage ? options.targetLanguage : 'ko';

    const queue = [];
    const records = new Map();
    const meta = new WeakMap();
    const pendingByElement = new Map();
    const queued = new Set();
    const done = new Set();
    const expectedWrite = new WeakMap();
    const visibility = new WeakMap();

    let started = false;
    let enabled = false;
    let showOriginal = false;
    let pointer = null;
    let rectEpoch = 0;
    let error = null;
    let model = null;
    let pausedForError = false;
    let pumping = false;
    let scheduled = false;
    let rerun = false;
    let idle = Promise.resolve();
    let bannerHost = null;
    let bannerMessage = null;
    let dismissedError = '';
    let scrollTimer = null;
    const rectCache = new WeakMap();
    const pendingCounts = new WeakMap();
    const decorated = new Set();
    const effectToken = new WeakMap();
    const livePending = new Set();
    const activeJobs = new Set();
    const lineLocks = new WeakMap();
    const ATTR_NAMES = ['placeholder', 'title', 'aria-label'];
    const watchOptions = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR_NAMES };
    const attrRecords = new Map();
    const attrInflight = new Map();
    const attrQueued = new Map();
    const attrWait = [];
    let attrTimer = null;
    const revealWait = [];
    let wiper = null;
    let soft = null;
    let sweepEpoch = 0;
    let revealFrame = 0;
    let scrollBound = false;
    let mutationLock = 0;
    let frameNotice = null;
    const watchedShadows = new WeakSet();

    const IntersectionObserverCtor = options.IntersectionObserver || globalThis.IntersectionObserver;
    const MutationObserverCtor = options.MutationObserver || globalThis.MutationObserver;
    let intersectionObserver = null;
    if (typeof IntersectionObserverCtor === 'function') {
      intersectionObserver = new IntersectionObserverCtor(onIntersect, {
        root: null,
        rootMargin: '150% 0px 150% 0px',
        threshold: 0,
      });
    }
    let mutationObserver = null;
    if (typeof MutationObserverCtor === 'function') {
      mutationObserver = new MutationObserverCtor(onMutations);
    }

    function getStatus() {
      return {
        started,
        enabled,
        showOriginal,
        done: records.size,
        pending: queue.length,
        pumping,
        error,
        model,
      };
    }

    function notify() {
      const status = getStatus();
      renderBanner(status);
      try {
        onStatus(status);
      } catch {
        // The badge update is optional.
      }
    }

    function ensureBanner() {
      if (!enableBanner || (bannerHost && bannerHost.isConnected !== false)) return;
      const host = document.createElement('div');
      host.id = HOST_ID;
      host.setAttribute('translate', 'no');
      host.style.position = 'fixed';
      host.style.zIndex = '2147483646';
      host.style.right = '16px';
      host.style.bottom = '16px';
      host.style.width = 'max-content';
      host.style.maxWidth = 'min(280px, calc(100vw - 24px))';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = [
        ':host { all: initial; }',
        '.toast { display: flex; gap: 8px; align-items: flex-start; box-sizing: border-box;',
        'font: 12px/1.4 system-ui, sans-serif; color: #7f1d1d; background: #fff;',
        'border: 1px solid #fecaca; border-radius: 10px; padding: 8px 10px;',
        'box-shadow: 0 4px 14px rgba(0,0,0,.12); max-width: 280px; }',
        '.msg { white-space: pre-wrap; }',
        'button { all: initial; font: 12px/1 system-ui, sans-serif; cursor: pointer;',
        'color: #7f1d1d; padding: 2px; }',
      ].join('');
      const box = document.createElement('div');
      box.className = 'toast';
      box.setAttribute('role', 'status');
      const message = document.createElement('div');
      message.className = 'msg';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '닫기';
      button.addEventListener('click', () => {
        dismissedError = message.textContent || dismissedError;
        host.hidden = true;
        host.style.display = 'none';
      });
      box.append(message, button);
      shadow.append(style, box);
      (document.documentElement || document.body).appendChild(host);
      bannerHost = host;
      bannerMessage = message;
    }

    function renderBanner(status) {
      if (!enableBanner) return;
      const text = status.error || '';
      if (!text || text === dismissedError) {
        if (bannerHost) { bannerHost.hidden = true; bannerHost.style.display = 'none'; }
        return;
      }
      ensureBanner();
      if (!bannerHost) return;
      bannerMessage.textContent = text;
      bannerHost.hidden = false;
      bannerHost.style.display = '';
    }

    function ensureMotionStyle() {
      if (typeof document === 'undefined' || !document.getElementById || !document.createElement) return;
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = MOTION_CSS;
      (document.documentElement || document.head || document.body).appendChild(style);
    }

    function canDecorate(element) {
      if (!element || !element.classList) return false;
      if (element.id === HOST_ID || element.id === STYLE_ID) return false;
      const tag = String(element.tagName || '').toUpperCase();
      return tag !== 'BODY' && tag !== 'HTML' && tag !== 'HEAD';
    }

    function motionReduced() {
      if (options.prefersReducedMotion === true) return true;
      if (options.prefersReducedMotion === false) return false;
      try {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return false;
      }
    }

    function tooLargeToPulse(element) {
      if (!element || typeof element.getBoundingClientRect !== 'function') return false;
      const rect = element.getBoundingClientRect();
      const width = Number(rect && rect.width) || 0;
      const height = Number(rect && rect.height) || 0;
      if (width <= 0 || height <= 0) return true;
      return width > 640 || height > 220;
    }

    function markPending(element) {
      if (!revealAnimation || !canDecorate(element) || !canHold(element) || tooLargeToPulse(element)) return;
      ensureMotionStyle();
      const count = pendingCounts.get(element) || 0;
      pendingCounts.set(element, count + 1);
      decorated.add(element);
      effectToken.set(element, {});
      element.classList.remove(FADE_CLASS);
      element.classList.remove(REVEAL_CLASS);
      element.classList.remove(PRISM_CLASS);
      clearCssVar(element, '--pt-ink');
      element.classList.add(PENDING_CLASS);
      if (livePending.size < MAX_LIVE_PENDING) {
        element.classList.add(PENDING_LIVE_CLASS);
        livePending.add(element);
      }
    }

    function promoteLivePending() {
      if (livePending.size >= MAX_LIVE_PENDING) return;
      for (const element of decorated) {
        if (livePending.size >= MAX_LIVE_PENDING) break;
        if (!pendingCounts.has(element) || livePending.has(element) || !element.classList) continue;
        element.classList.add(PENDING_LIVE_CLASS);
        livePending.add(element);
      }
    }

    function scheduleEffectClear(element) {
      const token = {};
      effectToken.set(element, token);
      setTimer(() => {
        if (effectToken.get(element) !== token || pendingCounts.has(element)) return;
        if (element.classList) {
          element.classList.remove(FADE_CLASS);
          element.classList.remove(REVEAL_CLASS);
        }
        decorated.delete(element);
      }, 700);
    }

    function clearPending(element, effect) {
      if (!element || !pendingCounts.has(element)) return;
      const next = pendingCounts.get(element) - 1;
      if (next > 0) {
        pendingCounts.set(element, next);
        return;
      }
      pendingCounts.delete(element);
      decorated.delete(element);
      if (!element.classList) return;
      element.classList.remove(PENDING_CLASS);
      element.classList.remove(PENDING_LIVE_CLASS);
      livePending.delete(element);
      promoteLivePending();
      if (effect !== 'fade' && effect !== 'reveal') return;
      element.classList.add(effect === 'fade' ? FADE_CLASS : REVEAL_CLASS);
      decorated.add(element);
      scheduleEffectClear(element);
    }

    function readDirection(element) {
      try {
        if (typeof getComputedStyle === 'function') {
          const computed = getComputedStyle(element);
          if (computed && computed.direction === 'rtl') return 'rtl';
        }
      } catch {
        // The sweep still runs left to right when direction cannot be read.
      }
      if (element && element.dir === 'rtl') return 'rtl';
      if (element && typeof element.getAttribute === 'function' && element.getAttribute('dir') === 'rtl') return 'rtl';
      return 'ltr';
    }

    function computedStyle(element) {
      try {
        return typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
      } catch {
        return null;
      }
    }

    function inlineStyleValue(style, name) {
      if (!style) return '';
      if (typeof style.getPropertyValue === 'function') return style.getPropertyValue(name) || '';
      if (style[name]) return String(style[name]);
      return '';
    }

    function setStyleProp(style, name, value) {
      if (!style) return;
      if (typeof style.setProperty === 'function') style.setProperty(name, value);
      else style[name] = value;
    }

    function removeStyleProp(style, name) {
      if (!style) return;
      if (typeof style.removeProperty === 'function') style.removeProperty(name);
      else delete style[name];
    }

    function isInlineBox(style, element) {
      const display = String((style && style.display) || '');
      if (display) return display === 'inline' || display === 'contents';
      const tag = String((element && element.tagName) || '').toUpperCase();
      return !BLOCK_TAGS.has(tag);
    }

    function flexLike(style) {
      const display = String((style && style.display) || '');
      return display === 'flex' || display === 'inline-flex' || display === 'grid' || display === 'inline-grid';
    }

    // 글자가 들어 있는 한 줄·말줄임 칸을 찾는다. 문단은 건드리지 않고, 플렉스 줄 전체도 잠그지 않는다.
    function findLineBox(start) {
      if (!start || start.nodeType !== 1) return null;
      let chosen = null;
      let node = start;
      for (let depth = 0; depth < 4 && node && node.nodeType === 1; depth += 1) {
        const tag = String(node.tagName || '').toUpperCase();
        if (tag === 'BODY' || tag === 'HTML') break;
        const style = computedStyle(node);
        const mode = textLineMode(style);
        const inline = isInlineBox(style, node);
        if (mode !== 'flow') {
          chosen = { element: node, mode, style };
          if (!inline) break;
        } else if (!inline) {
          break;
        }
        const parent = node.parentElement;
        if (!parent || parent.nodeType !== 1) break;
        if (flexLike(computedStyle(parent))) break;
        node = parent;
      }
      return chosen;
    }

    function lockKind(style, mode) {
      if (!style || mode === 'flow') return 'flow';
      const display = String(style.display || '');
      if (mode === 'clamp' || lineClampOf(style) > 0 || display.includes('webkit-box')) return 'clamp';
      if (mode === 'grow') return 'grow';
      if (mode === 'single') return 'single';
      return 'flow';
    }

    function paintLineLock(element, style, mode) {
      if (!element || !element.style) return;
      const kind = lockKind(style, mode);
      if (kind === 'flow') return;
      const owned = new Set(lineLocks.get(element) || []);
      const desired = [['min-width', '0']];
      const maxWidth = style && style.maxWidth;
      if (!maxWidth || maxWidth === 'none') desired.push(['max-width', '100%']);
      if (kind === 'grow') {
        desired.push(
          ['white-space', 'normal'],
          ['overflow-wrap', 'anywhere'],
          ['overflow-x', 'hidden'],
          ['overflow-y', 'hidden'],
          ['height', 'auto'],
          ['max-height', 'none'],
          ['text-overflow', 'clip'],
        );
      } else if (kind === 'single') {
        desired.push(['white-space', 'nowrap'], ['overflow', 'hidden'], ['text-overflow', 'ellipsis']);
        if (isInlineBox(style, element) && !inlineStyleValue(element.style, 'display')) {
          desired.push(['display', 'inline-block']);
        }
      }
      for (const [name, value] of desired) {
        if (!owned.has(name) && inlineStyleValue(element.style, name)) continue;
        setStyleProp(element.style, name, value);
        owned.add(name);
      }
      lineLocks.set(element, [...owned]);
    }

    function clearLineLock(element) {
      const owned = element && lineLocks.get(element);
      if (!owned) return;
      for (const name of owned) removeStyleProp(element.style, name);
      lineLocks.delete(element);
    }

    function boxStillTranslated(element) {
      if (!element) return false;
      const stack = [element];
      while (stack.length) {
        const current = stack.pop();
        for (const child of current.childNodes || []) {
          if (child.nodeType === 3) {
            const record = records.get(child);
            if (record && child.nodeValue === record.translated && record.translated !== record.original) return true;
          } else if (child.nodeType === 1) stack.push(child);
        }
      }
      return false;
    }

    function syncLineLock(node) {
      try {
        if (!node) return;
        const record = records.get(node);
        const showing = Boolean(record && node.nodeValue === record.translated && record.translated !== record.original);
        const box = findLineBox(node.parentElement);
        if (!box) return;
        if (showing) paintLineLock(box.element, box.style, box.mode);
        else if (!boxStillTranslated(box.element)) clearLineLock(box.element);
      } catch {
        // 칸을 맞추지 못해도 번역 글 자체는 남겨 둔다.
      }
    }

    // background-clip 과 -webkit-line-clamp 를 같은 요소에 쓰면 줄 제한이 풀린다.
    function prismBreaksClamp(element) {
      let node = element;
      for (let depth = 0; depth < 6 && node && node.nodeType === 1; depth += 1) {
        const style = computedStyle(node);
        const display = String((style && style.display) || '');
        if (display.includes('webkit-box') || lineClampOf(style) > 0) return true;
        const tag = String(node.tagName || '').toUpperCase();
        if (tag === 'BODY' || tag === 'HTML') break;
        node = node.parentElement;
      }
      return false;
    }

    function measureLine(job) {
      const line = findLineBox(job.element);
      const lineMode = line ? line.mode : 'flow';
      const lineElement = line ? line.element : null;
      const glyph = readRect(job.node);
      const elementRect = lineElement && typeof lineElement.getBoundingClientRect === 'function'
        ? normalizeRect(lineElement.getBoundingClientRect())
        : null;
      return {
        job,
        rect: slotRect(glyph, elementRect, lineMode),
        rtl: readDirection(job.element) === 'rtl',
        style: computedStyle(job.element),
        hold: canHold(job.element),
        lineMode,
        lineElement,
      };
    }

    function rectForJob(job) {
      const glyph = readRect(job.node);
      if (!job || job.lineMode === 'flow' || !job.lineElement || typeof job.lineElement.getBoundingClientRect !== 'function') {
        return glyph;
      }
      return slotRect(glyph, normalizeRect(job.lineElement.getBoundingClientRect()), job.lineMode);
    }

    function nowMs() {
      if (typeof options.now === 'function') return options.now();
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
      return Date.now();
    }

    function requestFrame(fn) {
      const raf = options.requestAnimationFrame || globalThis.requestAnimationFrame;
      if (typeof raf === 'function') return raf(fn);
      return setTimer(() => fn(nowMs()), 16);
    }

    function lockMutations(fn) {
      mutationLock += 1;
      try {
        return fn();
      } finally {
        mutationLock -= 1;
      }
    }

    function isOwnNode(node) {
      if (!node || node.nodeType !== 1) return false;
      if (node.id === HOST_ID || node.id === STYLE_ID) return true;
      return classHas(node, SWEEP_CLASS);
    }

    function canAnimate() {
      return Boolean(revealAnimation)
        && !motionReduced()
        && typeof document !== 'undefined'
        && typeof document.createElement === 'function';
    }

    function canHold(element) {
      if (!element || !element.classList || !element.childNodes) return false;
      for (const child of element.childNodes) {
        if (child.nodeType === 1) return false;
      }
      return true;
    }

    function normalizeRect(rect) {
      if (!rect) return null;
      const width = Number(rect.width) || 0;
      const height = Number(rect.height) || 0;
      if (width <= 0 && height <= 0) return null;
      return {
        left: Number(rect.left) || 0,
        top: Number(rect.top) || 0,
        width: Math.max(width, 1),
        height: Math.max(height, 1),
      };
    }

    // One layout read per text node. Glyph binary-search reflowed the page
    // between every write, which is what made cells flicker on a dense list.
    function readRect(node) {
      if (typeof options.measureRect === 'function') {
        const measured = normalizeRect(options.measureRect(node));
        if (measured) return measured;
      }
      try {
        if (typeof document !== 'undefined' && typeof document.createRange === 'function') {
          const range = document.createRange();
          const length = String(node && node.nodeValue || '').length;
          if (typeof range.selectNodeContents === 'function') range.selectNodeContents(node);
          else if (length && typeof range.setStart === 'function') {
            range.setStart(node, 0);
            range.setEnd(node, length);
          }
          const rect = typeof range.getBoundingClientRect === 'function'
            ? range.getBoundingClientRect()
            : null;
          const normalized = normalizeRect(rect);
          if (normalized) return normalized;
        }
      } catch {
        // Fall through to the parent box.
      }
      const element = node && node.parentElement;
      if (element && typeof element.getBoundingClientRect === 'function') {
        return normalizeRect(element.getBoundingClientRect());
      }
      return null;
    }

    function setCssVar(node, name, value) {
      if (!node || !node.style) return;
      if (typeof node.style.setProperty === 'function') node.style.setProperty(name, value);
      else node.style[name] = value;
    }

    function clearCssVar(node, name) {
      if (!node || !node.style) return;
      if (typeof node.style.removeProperty === 'function') node.style.removeProperty(name);
      else delete node.style[name];
    }

    // 배경색이 있는 칸에 글자 클립을 씌우면 배경이 사라진다.
    function backgroundIsClear(computed) {
      if (!computed) return true;
      const image = computed.backgroundImage;
      if (image && image !== 'none') return false;
      const color = String(computed.backgroundColor || '').replace(/\s+/g, '').toLowerCase();
      if (!color || color === 'transparent' || color === 'rgba(0,0,0,0)') return true;
      if (color.startsWith('rgba(')) {
        const parts = color.slice(5, -1).split(',');
        if (parts.length === 4) return Number(parts[3]) === 0;
      }
      return false;
    }

    function placeBox(node, rect) {
      if (!node || !node.style || !rect) return;
      node.style.position = 'fixed';
      node.style.left = `${rect.left}px`;
      node.style.top = `${rect.top}px`;
      node.style.width = `${Math.max(1, rect.width)}px`;
      node.style.height = `${Math.max(1, rect.height)}px`;
    }

    function copyTextStyle(node, computed, rtl, lineMode) {
      if (!node || !node.style || !computed) return;
      node.style.font = computed.font || '';
      node.style.letterSpacing = computed.letterSpacing || '';
      node.style.color = computed.color || '';
      node.style.lineHeight = computed.lineHeight || '';
      if (rtl) node.style.direction = 'rtl';
      if (lineMode === 'single') {
        node.style.whiteSpace = 'nowrap';
        node.style.textOverflow = 'ellipsis';
        node.style.overflow = 'hidden';
      } else if (lineMode === 'clamp') {
        node.style.whiteSpace = 'normal';
      }
    }

    function appendText(node, value) {
      const text = String(value ?? '');
      if (typeof document !== 'undefined' && typeof document.createTextNode === 'function') {
        node.appendChild(document.createTextNode(text));
      } else {
        node.textContent = text;
      }
    }

    function mountNode(node) {
      const parent = document.documentElement || document.body;
      if (parent && parent.appendChild) parent.appendChild(node);
    }

    function removeNode(node) {
      if (!node) return;
      if (node.parentNode && node.parentNode.removeChild) node.parentNode.removeChild(node);
      else if (typeof node.remove === 'function') node.remove();
    }

    function bindSweepScroll() {
      if (scrollBound || typeof document === 'undefined' || !document.addEventListener) return;
      scrollBound = true;
      document.addEventListener('scroll', repositionSweeps, true);
      if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', repositionSweeps);
    }

    function repositionSweeps() {
      if (!activeJobs.size) return;
      requestFrame(() => {
        const rows = [];
        for (const job of activeJobs) {
          if (!job.box || !connected(job.node)) continue;
          rows.push({ job, rect: rectForJob(job) });
        }
        for (const row of rows) {
          if (row.rect) placeBox(row.job.box, row.rect);
        }
      });
    }

    function setProgress(job, value) {
      const next = Math.round(clamp01(value) * 1000) / 1000;
      if (job.shown === next) return;
      job.shown = next;
      setCssVar(job.box, '--pt-p', String(next));
      if (!job.box || !job.box.style) return;
      job.box.style.willChange = next > 0 && next < 1 ? 'clip-path' : '';
    }

    function paintBox(row, spot) {
      const job = row.job;
      try {
        ensureMotionStyle();
        const box = document.createElement('div');
        box.className = row.rtl ? `${SWEEP_CLASS} pt-sweep-rtl` : SWEEP_CLASS;
        box.setAttribute('translate', 'no');
        placeBox(box, row.rect);
        copyTextStyle(box, row.style, row.rtl, row.lineMode);
        const prev = document.createElement('div');
        prev.className = 'pt-prev';
        const next = document.createElement('div');
        next.className = 'pt-next';
        copyTextStyle(prev, row.style, row.rtl, row.lineMode);
        copyTextStyle(next, row.style, row.rtl, row.lineMode);
        appendText(prev, job.original);
        appendText(next, job.translated);
        const edge = document.createElement('div');
        edge.className = EDGE_CLASS;
        box.appendChild(prev);
        box.appendChild(next);
        box.appendChild(edge);
        mountNode(box);
        if (row.hold) job.element.classList.add(HOLD_CLASS);
        clearPending(job.element, 'reveal');
        const painted = {
          node: job.node,
          element: job.element,
          target: job.target,
          original: job.original,
          translated: job.translated,
          box,
          lineMode: row.lineMode || 'flow',
          lineElement: row.lineElement || null,
          at: spot.at,
          band: spot.band,
          epoch: job.epoch,
          shown: null,
          settled: false,
        };
        activeJobs.add(painted);
        return painted;
      } catch {
        writeNode(job.node, job.target);
        clearPending(job.element, false);
        if (job.element && job.element.classList) job.element.classList.remove(HOLD_CLASS);
        return null;
      }
    }

    // 자식 태그가 있으면 색이 안으로 번지고, 배경이 있으면 배경이 잘린다.
    // 그래서 글자만 있는 투명한 요소에만 잠깐 프리즘을 입힌 뒤 클래스와 변수를 지운다.
    function armPrism(element) {
      if (!revealAnimation || motionReduced() || !element || !element.classList || !canHold(element)) return;
      if (prismBreaksClamp(element)) return;
      const computed = computedStyle(element);
      if (!backgroundIsClear(computed)) return;
      const ink = computed && computed.color;
      if (ink) setCssVar(element, '--pt-ink', ink);
      element.classList.remove(PRISM_CLASS);
      if (typeof element.offsetWidth === 'number') void element.offsetWidth;
      element.classList.add(PRISM_CLASS);
      decorated.add(element);
      const token = {};
      effectToken.set(element, token);
      setTimer(() => {
        if (effectToken.get(element) !== token) return;
        if (element.classList) element.classList.remove(PRISM_CLASS);
        clearCssVar(element, '--pt-ink');
        if (!pendingCounts.has(element)) decorated.delete(element);
      }, PRISM_MS);
    }

    function releaseJob(job, commit) {
      if (!job || job.settled) return;
      job.settled = true;
      activeJobs.delete(job);
      let wroteTranslation = false;
      if (commit && job.epoch === sweepEpoch && connected(job.node)) {
        const current = job.node.nodeValue;
        const known = current === job.original
          || current === job.translated
          || expectedWrite.get(job.node) === current;
        if (known) {
          writeNode(job.node, job.target);
          wroteTranslation = job.target === job.translated;
        }
      }
      if (job.element && job.element.classList) {
        job.element.classList.remove(HOLD_CLASS);
        job.element.classList.remove(REVEAL_CLASS);
        if (!pendingCounts.has(job.element)) decorated.delete(job.element);
      }
      removeNode(job.box);
      if (wroteTranslation) armPrism(job.element);
    }

    // nodeValue changes only after the clip finishes, in one write batch.
    // Doing it as the overlay is removed keeps the longer translation from
    // reflowing icon labels while the line is still moving.
    function finishPass(pass, commit) {
      if (!pass || pass.settled) return;
      pass.settled = true;
      if (pass.doneTimer != null) clearTimer(pass.doneTimer);
      lockMutations(() => {
        for (const job of pass.jobs || []) releaseJob(job, commit);
      });
    }

    function startClock(pass, duration, step) {
      pass.startedAt = nowMs();
      pass.raf = requestFrame(step);
      pass.doneTimer = setTimer(() => step(pass.startedAt + duration), duration);
    }

    function beginWiper(rows) {
      const jobs = [];
      for (const row of rows) {
        const painted = paintBox(row, { at: 0, band: 1 });
        if (painted) jobs.push(painted);
      }
      if (!jobs.length) return;
      const pass = {
        epoch: sweepEpoch,
        jobs,
        reverse: showOriginal,
        shown: 0,
        settled: false,
      };
      wiper = pass;
      for (const job of jobs) setProgress(job, pass.reverse ? 1 : 0);
      bindSweepScroll();
      const step = (time) => {
        if (pass.settled || pass.epoch !== sweepEpoch || wiper !== pass) return;
        const sample = lineSample({ lineStart: 0, lineEnd: 1, from: 0, to: 1 }, time - pass.startedAt, WIPER_MS);
        pass.shown = sample.eased;
        for (const job of pass.jobs) {
          if (!job.settled) setProgress(job, pass.reverse ? 1 - sample.eased : sample.eased);
        }
        if (sample.t < 1) pass.raf = requestFrame(step);
        else {
          if (wiper === pass) wiper = null;
          finishPass(pass, true);
        }
      };
      startClock(pass, WIPER_MS, step);
    }

    function beginSoft(rows) {
      const jobs = [];
      for (const row of rows) {
        const painted = paintBox(row, { at: 0, band: 1 });
        if (painted) jobs.push(painted);
      }
      if (!jobs.length) return;
      if (soft && !soft.settled && soft.epoch === sweepEpoch) {
        const shown = soft.reverse ? 1 - (soft.shown || 0) : (soft.shown || 0);
        for (const job of jobs) {
          setProgress(job, shown);
          soft.jobs.push(job);
        }
        return;
      }
      const pass = {
        epoch: sweepEpoch,
        jobs,
        reverse: showOriginal,
        shown: 0,
        settled: false,
      };
      soft = pass;
      for (const job of jobs) setProgress(job, pass.reverse ? 1 : 0);
      const step = (time) => {
        if (pass.settled || pass.epoch !== sweepEpoch || soft !== pass) return;
        const sample = lineSample({ lineStart: 0, lineEnd: 1, from: 0, to: 1 }, time - pass.startedAt, SOFT_MS);
        pass.shown = sample.eased;
        for (const job of pass.jobs) {
          if (!job.settled) setProgress(job, pass.reverse ? 1 - sample.eased : sample.eased);
        }
        if (sample.t < 1) pass.raf = requestFrame(step);
        else {
          if (soft === pass) soft = null;
          finishPass(pass, true);
        }
      };
      startClock(pass, SOFT_MS, step);
    }

    function adoptIntoWiper(rows) {
      const sample = lineSample({ lineStart: 0, lineEnd: 1, from: 0, to: 1 }, nowMs() - wiper.startedAt, WIPER_MS);
      wiper.shown = sample.eased;
      for (const row of rows) {
        const painted = paintBox(row, { at: 0, band: 1 });
        if (!painted) continue;
        setProgress(painted, wiper.reverse ? 1 - sample.eased : sample.eased);
        wiper.jobs.push(painted);
      }
    }

    function paintMeasured(measured) {
      const ready = [];
      for (const row of measured) {
        if (!row.rect || row.job.epoch !== sweepEpoch || !connected(row.job.node)) {
          if (row.job.epoch === sweepEpoch && connected(row.job.node)) {
            writeNode(row.job.node, row.job.target);
          }
          clearPending(row.job.element, false);
          continue;
        }
        ready.push(row);
      }
      if (!ready.length) return;
      if (wiper && !wiper.settled && wiper.epoch === sweepEpoch) adoptIntoWiper(ready);
      else beginWiper(ready);
    }

    function drainReveal() {
      const batch = revealWait.splice(0);
      if (!batch.length) return;
      const measured = [];
      for (const job of batch) measured.push(measureLine(job));
      lockMutations(() => paintMeasured(measured));
    }

    function scheduleReveal() {
      if (revealFrame) return;
      const run = () => {
        revealFrame = 0;
        drainReveal();
      };
      const raf = options.requestAnimationFrame || globalThis.requestAnimationFrame;
      if (typeof raf === 'function') {
        revealFrame = raf(run) || 1;
        return;
      }
      revealFrame = 1;
      run();
    }

    function queueReveal() {
      // 덮개·무지개 막대는 글자 뒤에 남는다. 번역이 오면 글만 바꾸고 표시는 바로 걷는다.
      return false;
    }

    function queueRevealUnused(job) {
      if (!canAnimate() || !canDecorate(job.element)) return false;
      if (job.target == null) job.target = showOriginal ? job.original : job.translated;
      job.epoch = sweepEpoch;
      revealWait.push(job);
      scheduleReveal();
      return true;
    }

    function cancelMotion() {
      sweepEpoch += 1;
      revealWait.length = 0;
      const frame = revealFrame;
      revealFrame = 0;
      const currentWiper = wiper;
      const currentSoft = soft;
      wiper = null;
      soft = null;
      finishPass(currentWiper, false);
      finishPass(currentSoft, false);
      if (frame && typeof options.cancelAnimationFrame === 'function') {
        try { options.cancelAnimationFrame(frame); } catch { /* already run */ }
      }
    }

    function clearBatchMarks(batch) {
      for (const item of batch) clearPending(item.node && item.node.parentElement, false);
    }

    function clearAllDecorations() {
      cancelMotion();
      livePending.clear();
      for (const element of decorated) {
        pendingCounts.delete(element);
        effectToken.delete(element);
        if (element.classList) {
          element.classList.remove(PENDING_CLASS);
          element.classList.remove(PENDING_LIVE_CLASS);
          element.classList.remove(FADE_CLASS);
          element.classList.remove(REVEAL_CLASS);
          element.classList.remove(HOLD_CLASS);
          element.classList.remove(PRISM_CLASS);
        }
        clearCssVar(element, '--pt-ink');
      }
      decorated.clear();
    }

    function invalidateRects() {
      rectEpoch += 1;
    }

    function anchorPoint(node) {
      const element = node && node.parentElement;
      if (!element || typeof element.getBoundingClientRect !== 'function') return null;
      const cached = rectCache.get(element);
      if (cached && cached.epoch === rectEpoch) return cached;
      const rect = element.getBoundingClientRect();
      const point = {
        epoch: rectEpoch,
        cx: rect.left + (rect.width || 0) / 2,
        cy: rect.top + (rect.height || 0) / 2,
      };
      rectCache.set(element, point);
      return point;
    }

    function sortQueue() {
      if (!prioritizeCursor || !pointer || queue.length < 2) return;
      const ranked = queue.map((item, index) => {
        const point = anchorPoint(item.node);
        let distance = Number.POSITIVE_INFINITY;
        if (point) {
          const dx = point.cx - pointer.x;
          const dy = point.cy - pointer.y;
          distance = dx * dx + dy * dy;
        }
        return { item, index, distance };
      });
      ranked.sort((a, b) => a.distance - b.distance || a.index - b.index);
      queue.splice(0, queue.length, ...ranked.map((row) => row.item));
    }

    function rowOf(element) {
      let node = element;
      for (let depth = 0; depth < 4 && node; depth += 1) {
        const tag = String(node.tagName || '').toUpperCase();
        if (tag === 'A' || tag === 'LI' || tag === 'BUTTON') return node;
        if (!node.parentElement) break;
        node = node.parentElement;
      }
      return element;
    }

    function coverSourceLayers(node, originalCore) {
      const start = node && node.parentElement;
      if (!start || !originalCore) return;
      const row = rowOf(start);
      const record = records.get(node);
      const translatedCore = record ? splitWhitespace(record.translated).core : '';
      const stack = [row];
      while (stack.length) {
        const current = stack.pop();
        if (!current || current.nodeType !== 1) continue;
        if (current !== start) {
          try {
            for (const pseudo of ['::before', '::after']) {
              const pseudoStyle = typeof getComputedStyle === 'function' ? getComputedStyle(current, pseudo) : null;
              const bare = String(pseudoStyle && pseudoStyle.content || '').replace(/^["']|["']$/g, '').trim();
              if (bare && bare !== 'none' && bare !== 'normal' && bare.includes(originalCore) && current.classList) {
                current.classList.add('pt-page-translator-nops');
              }
            }
          } catch { /* 가상 요소가 없으면 넘어간다. */ }
        }
        for (const child of [...(current.childNodes || [])]) {
          if (child.nodeType === 3 && child !== node && [originalCore, translatedCore].includes(splitWhitespace(String(child.nodeValue || '')).core)) {
            const parts = splitWhitespace(String(child.nodeValue || ''));
            const next = `${parts.lead}${translatedCore}${parts.trail}`;
            const parent = child.parentElement;
            const style = parent && computedStyle(parent);
            const pos = style && style.position;
            const ghost = pos === 'absolute' || pos === 'fixed' || (parent && parent.getAttribute && parent.getAttribute('aria-hidden') === 'true');
            if (ghost && parent && parent.classList) parent.classList.add('pt-page-translator-dup');
            else if (child.nodeValue !== next) {
              expectedWrite.set(child, next);
              child.nodeValue = next;
            }
          } else if (child.nodeType === 1) stack.push(child);
        }
      }
    }

    function writeNode(node, value) {
      expectedWrite.set(node, value);
      if (node.nodeValue !== value) node.nodeValue = value;
      syncLineLock(node);
      const record = records.get(node);
      if (record && value === record.translated && record.core) coverSourceLayers(node, record.core);
    }

    function nodeBusy(node) {
      for (const job of activeJobs) {
        if (job.node === node && !job.settled) return true;
      }
      return false;
    }

    function applyRecords() {
      const jobs = [];
      for (const [node, record] of records) {
        if (!connected(node) || nodeBusy(node)) continue;
        const target = showOriginal ? record.original : record.translated;
        if (node.nodeValue === target) continue;
        jobs.push({
          node,
          element: node.parentElement,
          original: record.original,
          translated: record.translated,
          target,
        });
      }
      if (!jobs.length) return;
      if (!canAnimate()) {
        lockMutations(() => {
          for (const job of jobs) writeNode(job.node, job.target);
        });
        return;
      }
      for (const job of jobs) {
        if (!queueReveal(job)) writeNode(job.node, job.target);
      }
    }

    function attrHas(map, element, name) {
      return Boolean(map.get(element)?.has(name));
    }

    function attrAdd(map, element, name) {
      let names = map.get(element);
      if (!names) {
        names = new Set();
        map.set(element, names);
      }
      names.add(name);
    }

    function attrDelete(map, element, name) {
      const names = map.get(element);
      if (!names) return;
      names.delete(name);
      if (!names.size) map.delete(element);
    }

    function knownAttr(element, name) {
      return attrRecords.get(element)?.get(name) || null;
    }

    function saveAttr(element, name, record) {
      let bag = attrRecords.get(element);
      if (!bag) {
        bag = new Map();
        attrRecords.set(element, bag);
      }
      bag.set(name, record);
    }

    function applyTitleRecords() {
      for (const [element, bag] of attrRecords) {
        if (!element || element.isConnected === false || typeof element.setAttribute !== 'function') continue;
        for (const [name, record] of bag) {
          element.setAttribute(name, enabled && !showOriginal ? record.translated : record.original);
        }
      }
    }

    function finishTitle(item, ok) {
      if (typeof item.resolve === 'function') item.resolve(ok);
    }

    function flushTitles() {
      attrTimer = null;
      const batch = attrWait.splice(0);
      const pending = [];
      for (const item of batch) {
        attrDelete(attrQueued, item.element, item.name);
        if (!started || !enabled || item.element.isConnected === false) {
          finishTitle(item, false);
          continue;
        }
        if (item.element.getAttribute(item.name) !== item.current) {
          finishTitle(item, false);
          continue;
        }
        attrAdd(attrInflight, item.element, item.name);
        pending.push(item);
      }
      if (!pending.length) return;
      sendBatch(pending.map((item) => item.core)).then((response) => {
        const translations = response?.ok && Array.isArray(response.translations) && response.translations.length === pending.length
          ? response.translations
          : null;
        pending.forEach((item, index) => {
          try {
            if (!translations) {
              finishTitle(item, false);
              return;
            }
            const translated = `${item.lead}${fitTranslation(item.core, translations[index], 'single')}${item.trail}`;
            saveAttr(item.element, item.name, { original: item.current, translated });
            if (enabled && !showOriginal && item.element.getAttribute(item.name) === item.current) {
              item.element.setAttribute(item.name, translated);
            }
            finishTitle(item, true);
          } finally {
            attrDelete(attrInflight, item.element, item.name);
          }
        });
      }, () => {
        for (const item of pending) {
          attrDelete(attrInflight, item.element, item.name);
          finishTitle(item, false);
        }
      });
    }

    function scheduleTitleFlush() {
      if (attrTimer != null) return;
      const delay = Number.isFinite(options.titleFlushMs) ? options.titleFlushMs : 50;
      attrTimer = setTimer(flushTitles, Math.max(0, delay));
    }

    function queueAttribute(element, name) {
      if (!started || !enabled || !element || !ATTR_NAMES.includes(name) || typeof element.getAttribute !== 'function') {
        return Promise.resolve(false);
      }
      if (attrHas(attrInflight, element, name) || attrHas(attrQueued, element, name)) return Promise.resolve(false);
      const current = element.getAttribute(name);
      const known = knownAttr(element, name);
      if (known && (current === known.original || current === known.translated)) {
        const next = showOriginal ? known.original : known.translated;
        if (current !== next) element.setAttribute(name, next);
        return Promise.resolve(true);
      }
      const parts = splitWhitespace(current || '');
      if (!isTranslatable(parts.core)) return Promise.resolve(false);
      if (isAlreadyTargetLanguage(parts.core, targetLanguage)) return Promise.resolve(true);
      return new Promise((resolve) => {
        attrAdd(attrQueued, element, name);
        attrWait.push({
          element,
          name,
          current,
          core: parts.core,
          lead: parts.lead,
          trail: parts.trail,
          resolve,
        });
        scheduleTitleFlush();
      });
    }

    function considerAttrs(element) {
      if (!element || element.nodeType !== 1 || element.id === HOST_ID || element.id === STYLE_ID) return;
      for (const name of ATTR_NAMES) {
        if (element.getAttribute && element.getAttribute(name)) queueAttribute(element, name);
      }
    }

    function translateTitle(element) {
      return queueAttribute(element, 'title');
    }

    function enqueue(node) {
      if (done.has(node) || queued.has(node) || !connected(node)) return;
      const info = meta.get(node);
      if (!info) return;
      queued.add(node);
      queue.push({ node, core: info.core, original: info.original });
      scheduleFlush();
    }

    function considerText(node) {
      if (!node || node.nodeType !== 3 || done.has(node) || queued.has(node)) return;
      if (shouldSkipText(node)) return;
      const original = String(node.nodeValue ?? '');
      const parts = splitWhitespace(original);
      if (!isTranslatable(parts.core)) return;
      const parent = node.parentElement;
      if (!parent || parent.nodeType !== 1 || isSkipElement(parent)) return;
      meta.set(node, { core: parts.core, original });
      let bucket = pendingByElement.get(parent);
      if (!bucket) {
        bucket = new Set();
        pendingByElement.set(parent, bucket);
        if (intersectionObserver) intersectionObserver.observe(parent);
      }
      bucket.add(node);
      // 예전 대화에서 화면 밖이었던 칸이 다시 보여도, 지금 보이면 바로 번역한다.
      if (visibility.get(parent) === true || isNearViewport(parent)) {
        visibility.set(parent, true);
        enqueue(node);
      } else if (intersectionObserver) {
        intersectionObserver.observe(parent);
      }
    }

    function textMatchesRecord(node) {
      const record = records.get(node);
      if (!record) return false;
      const value = node.nodeValue;
      return value === record.original || value === record.translated;
    }

    // 같은 글자 칸을 다음 대화가 다시 쓰면, 저장된 번역과 다르면 새로 번역한다.
    function syncTextNode(node) {
      if (!node || node.nodeType !== 3) return;
      if (expectedWrite.get(node) === node.nodeValue) return;
      if (shouldSkipText(node)) return;
      if (textMatchesRecord(node)) return;
      if (done.has(node) || queued.has(node) || records.has(node) || meta.has(node)) forgetNode(node);
      considerText(node);
    }

    function resyncElement(element) {
      if (!element || element.nodeType !== 1 || isSkipElement(element)) return;
      const stack = [element];
      let guard = 0;
      while (stack.length && guard < 5000) {
        const current = stack.pop();
        guard += 1;
        for (const child of [...(current.childNodes || [])]) {
          if (child.nodeType === 3) syncTextNode(child);
          else if (child.nodeType === 1 && !isSkipElement(child)) stack.push(child);
        }
      }
    }

    // 열린 그림자는 shadowRoot로, 닫힌 그림자는 확장 프로그램이 원래 볼 수 있는 길로 연다. 새 권한은 없다.
    function shadowOf(element) {
      if (!element || element.nodeType !== 1) return null;
      if (element.shadowRoot) return element.shadowRoot;
      try {
        const opener = globalThis.chrome && globalThis.chrome.dom && globalThis.chrome.dom.openOrClosedShadowRoot;
        if (typeof opener === 'function') return opener.call(globalThis.chrome.dom, element) || null;
      } catch {
        return null;
      }
      return null;
    }

    function watchShadow(rootNode) {
      if (!mutationObserver || !rootNode || rootNode.nodeType !== 11 || watchedShadows.has(rootNode)) return;
      watchedShadows.add(rootNode);
      try {
        mutationObserver.observe(rootNode, watchOptions);
      } catch {
        // 페이지가 닫아 둔 칸은 못 보면 그대로 둔다.
      }
    }

    function noteFrames(node) {
      if (!enabled || !frameHostAdded(node)) return;
      const runtime = globalThis.chrome && globalThis.chrome.runtime;
      if (!runtime || typeof runtime.sendMessage !== 'function') return;
      if (frameNotice != null) return;
      frameNotice = setTimer(() => {
        frameNotice = null;
        if (!enabled) return;
        try {
          const sent = runtime.sendMessage({ type: 'TRANSLATE_FRAMES' });
          if (sent && typeof sent.catch === 'function') sent.catch(() => {});
        } catch {
          // 이 창에서는 확장 프로그램에 말을 걸 수 없다.
        }
      }, 200);
    }

    function walk(node) {
      if (!node) return;
      if (node.nodeType === 1) {
        const shadow = shadowOf(node);
        if (shadow) {
          watchShadow(shadow);
          walk(shadow);
        }
      } else if (node.nodeType === 11) {
        watchShadow(node);
      }
      if (!node.childNodes) return;
      const children = [...node.childNodes];
      for (const child of children) {
        if (child.nodeType === 3) considerText(child);
        else if (child.nodeType === 1) {
          considerAttrs(child);
          if (isSkipElement(child)) continue;
          walk(child);
        } else if (child.nodeType === 11) {
          walk(child);
        }
      }
    }

    function forgetNode(node) {
      done.delete(node);
      queued.delete(node);
      meta.delete(node);
      records.delete(node);
      expectedWrite.delete(node);
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        if (queue[index].node === node) queue.splice(index, 1);
      }
      const parent = node.parentElement;
      const bucket = parent && pendingByElement.get(parent);
      if (bucket) bucket.delete(node);
    }

    function onIntersect(entries) {
      for (const entry of entries) {
        visibility.set(entry.target, Boolean(entry.isIntersecting));
        if (!entry.isIntersecting) continue;
        const bucket = pendingByElement.get(entry.target);
        if (!bucket) continue;
        for (const node of bucket) enqueue(node);
      }
    }

    function onCharacterData(node) {
      syncTextNode(node);
    }

    function onMutations(mutations) {
      // Deliveries are async, so a lock around our write is not enough on its
      // own. Overlay nodes are skipped by class; our nodeValue writes match expectedWrite.
      if (!started || mutationLock > 0) return;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const element = mutation.target;
          if (element && element.nodeType === 1 && ATTR_NAMES.includes(mutation.attributeName)) queueAttribute(element, mutation.attributeName);
          continue;
        }
        if (mutation.type === 'characterData') {
          if (isOwnNode(mutation.target && mutation.target.parentElement)) continue;
          onCharacterData(mutation.target);
          continue;
        }
        if (mutation.type !== 'childList' || isOwnNode(mutation.target)) continue;
        for (const node of mutation.addedNodes || []) {
          if (isOwnNode(node)) continue;
          if (node.nodeType === 3) considerText(node);
          else if (node.nodeType === 1) {
            noteFrames(node);
            considerAttrs(node);
            if (!isSkipElement(node)) walk(node);
          } else if (node.nodeType === 11) walk(node);
        }
        if (mutation.target && mutation.target.nodeType === 1 && !isSkipElement(mutation.target)) {
          const shadow = shadowOf(mutation.target);
          if (shadow && !watchedShadows.has(shadow)) {
            watchShadow(shadow);
            walk(shadow);
          }
          resyncElement(mutation.target);
        }
      }
    }

    function recheck() {
      for (const [element, bucket] of pendingByElement) {
        if (visibility.get(element) === false) continue;
        if (visibility.get(element) === true || isNearViewport(element)) {
          for (const node of bucket) enqueue(node);
        }
      }
    }

    function onScroll() {
      invalidateRects();
      if (scrollTimer != null) return;
      scrollTimer = setTimer(() => {
        scrollTimer = null;
        if (prioritizeCursor) sortQueue();
        recheck();
      }, 150);
    }

    function takeBatch() {
      if (prioritizeCursor) sortQueue();
      const batch = [];
      let chars = 0;
      while (queue.length) {
        const size = queue[0].core.length;
        if (batch.length >= MAX_ITEMS) break;
        if (batch.length > 0 && chars + size > MAX_CHARS) break;
        const item = queue.shift();
        batch.push(item);
        chars += size;
        if (size > MAX_CHARS) break;
      }
      return batch;
    }

    function fail(message) {
      pausedForError = true;
      error = message || '번역에 실패했어요.';
      notify();
    }

    function scheduleFlush() {
      if (!started || !enabled || pausedForError) return;
      if (pumping) {
        rerun = true;
        return;
      }
      if (scheduled) return;
      scheduled = true;
      idle = idle.then(() => flush()).catch(() => {});
    }

    async function flush() {
      scheduled = false;
      if (pumping || pausedForError || !started || !enabled) return;
      pumping = true;
      notify();
      try {
        while (queue.length && started && enabled && !pausedForError) {
          const batch = takeBatch();
          if (!batch.length) break;
          for (const item of batch) markPending(item.node && item.node.parentElement);
          let response;
          try {
            response = await sendBatch(batch.map((item) => item.core));
          } catch (sendError) {
            clearBatchMarks(batch);
            queue.unshift(...batch);
            fail(sendError?.message || '확장 프로그램과 연결이 끊겼어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
            break;
          }
          if (!response?.ok || !Array.isArray(response.translations) || response.translations.length !== batch.length) {
            clearBatchMarks(batch);
            queue.unshift(...batch);
            fail(response?.message || '번역 결과를 해석하지 못했어요.');
            break;
          }
          if (response.model) model = response.model;
          batch.forEach((item, index) => {
            queued.delete(item.node);
            const parent = item.node && item.node.parentElement;
            if (!connected(item.node)) {
              clearPending(parent, false);
              return;
            }
            const current = item.node.nodeValue;
            const pageChanged = current !== item.original && expectedWrite.get(item.node) !== current;
            if (pageChanged) {
              clearPending(parent, false);
              forgetNode(item.node);
              considerText(item.node);
              return;
            }
            const parts = splitWhitespace(item.original);
            const line = findLineBox(parent);
            const translated = `${parts.lead}${fitTranslation(parts.core, response.translations[index], line ? line.mode : 'flow')}${parts.trail}`;
            records.set(item.node, {
              original: item.original,
              translated,
              core: item.core,
            });
            done.add(item.node);
            const showTranslation = enabled && !showOriginal;
            if (!showTranslation) {
              clearPending(parent, false);
            } else if (motionReduced()) {
              writeNode(item.node, translated);
              clearPending(parent, 'fade');
            } else if (!queueReveal({
              node: item.node,
              element: parent,
              original: item.original,
              translated,
            })) {
              writeNode(item.node, translated);
              clearPending(parent, false);
            }
          });
          error = null;
          notify();
        }
      } finally {
        pumping = false;
        if ((rerun || queue.length) && started && enabled && !pausedForError) {
          rerun = false;
          scheduleFlush();
        } else {
          notify();
        }
      }
    }

    function start() {
      const first = !started;
      started = true;
      enabled = true;
      pausedForError = false;
      error = null;
      model = null;
      showOriginal = false;
      dismissedError = '';
      if (first && mutationObserver && root) {
        mutationObserver.observe(root, watchOptions);
        if (typeof options.onBindScroll === 'function') options.onBindScroll(onScroll);
      }
      if (walkRoot) walk(walkRoot);
      applyRecords();
      applyTitleRecords();
      scheduleFlush();
      notify();
    }

    function rescan() {
      if (!started || !enabled) return getStatus();
      if (walkRoot) {
        walk(walkRoot);
        noteFrames(walkRoot);
      }
      scheduleFlush();
      notify();
      return getStatus();
    }

    function setEnabled(value) {
      if (value) {
        if (!started) {
          start();
          return getStatus();
        }
        const wasOff = !enabled || showOriginal;
        enabled = true;
        showOriginal = false;
        pausedForError = false;
        error = null;
        dismissedError = '';
        if (wasOff) clearAllDecorations();
        applyRecords();
        applyTitleRecords();
        if (walkRoot) walk(walkRoot);
        if (prioritizeCursor) sortQueue();
        scheduleFlush();
        notify();
        return getStatus();
      }
      enabled = false;
      showOriginal = true;
      clearAllDecorations();
      applyRecords();
      applyTitleRecords();
      notify();
      return getStatus();
    }

    function setPrefs(prefs) {
      const next = prefs || {};
      prioritizeCursor = Boolean(next.prioritizeCursor);
      if (typeof next.targetLanguage === 'string' && next.targetLanguage) targetLanguage = next.targetLanguage;
      if (Object.prototype.hasOwnProperty.call(next, 'revealAnimation')) {
        const enabledMotion = next.revealAnimation !== false;
        if (revealAnimation && !enabledMotion) {
          clearAllDecorations();
          revealAnimation = false;
          applyRecords();
        } else {
          revealAnimation = enabledMotion;
        }
      }
      if (prioritizeCursor) sortQueue();
    }

    function notePointer(x, y) {
      pointer = { x: Number(x) || 0, y: Number(y) || 0 };
      if (prioritizeCursor && enabled) sortQueue();
    }

    function setShowOriginal(value) {
      if (!started) return getStatus();
      const next = Boolean(value);
      if (next === showOriginal) {
        notify();
        return getStatus();
      }
      showOriginal = next;
      clearAllDecorations();
      applyRecords();
      applyTitleRecords();
      notify();
      return getStatus();
    }

    function toggleOriginal() {
      return setShowOriginal(!showOriginal);
    }

    async function whenIdle() {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await idle;
        await Promise.resolve();
        if (!scheduled && !pumping && !rerun && (pausedForError || queue.length === 0)) {
          return getStatus();
        }
      }
      return getStatus();
    }

    return {
      start,
      setEnabled,
      setPrefs,
      notePointer,
      setShowOriginal,
      toggleOriginal,
      translateTitle,
      getStatus,
      recheck,
      rescan,
      whenIdle,
      emitMutations: onMutations,
    };
  }

  const ns = globalThis.__pageTranslator || (globalThis.__pageTranslator = {});
  ns.createSession = createSession;
  ns.splitWhitespace = splitWhitespace;
  ns.isTranslatable = isTranslatable;
  ns.isAlreadyTargetLanguage = isAlreadyTargetLanguage;
  ns.shouldSkipText = shouldSkipText;
  ns.frameHostAdded = frameHostAdded;
  ns.planWiperOrder = planWiperOrder;
  ns.crossProgress = crossProgress;
  ns.wiperSpot = wiperSpot;
  ns.easeInOut = easeInOut;
  ns.lineSample = lineSample;
  ns.WIPER_MS = WIPER_MS;
  ns.SOFT_MS = SOFT_MS;
  ns.PRISM_MS = PRISM_MS;
  ns.hasHardBreak = hasHardBreak;
  ns.flattenHardBreaks = flattenHardBreaks;
  ns.textLineMode = textLineMode;
  ns.fitTranslation = fitTranslation;
  ns.slotRect = slotRect;

  function install() {
    const session = createSession({
      root: document.documentElement,
      walkRoot: document.body || document.documentElement,
      sendBatch(texts) {
        return chrome.runtime.sendMessage({ type: 'TRANSLATE_BATCH', texts });
      },
      onStatus(status) {
        let top = true;
        try {
          top = window.top === window;
        } catch {
          top = false;
        }
        if (!top) return;
        chrome.runtime.sendMessage({ type: 'PROGRESS', status }).catch(() => {});
      },
      onBindScroll(handler) {
        document.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
      },
    });
    let pointerTimer = null;
    let latestPointer = null;
    document.addEventListener('mousemove', (event) => {
      latestPointer = { x: event.clientX, y: event.clientY };
      if (pointerTimer != null) return;
      pointerTimer = setTimeout(() => {
        pointerTimer = null;
        const point = latestPointer;
        latestPointer = null;
        if (point) session.notePointer(point.x, point.y);
      }, 150);
    }, { passive: true });
    document.addEventListener('mouseover', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('[title]') : null;
      if (target) session.translateTitle(target).catch(() => {});
    }, { passive: true });
    let topFrame = true;
    try {
      topFrame = window.top === window;
    } catch {
      topFrame = false;
    }
    if (topFrame) {
      window.addEventListener('pagehide', () => {
        chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' }).catch(() => {});
      });
    }
    ns.session = session;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const onRoute = () => {
        if (session.getStatus().enabled) session.rescan();
      };
      window.addEventListener('hashchange', onRoute);
      window.addEventListener('popstate', onRoute);
    }
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'START_TRANSLATE') {
        session.start();
        sendResponse(session.getStatus());
        return;
      }
      if (message.type === 'SET_ORIGINAL') {
        sendResponse(session.setShowOriginal(Boolean(message.showOriginal)));
        return;
      }
      if (message.type === 'TOGGLE_ORIGINAL') {
        sendResponse(session.toggleOriginal());
        return;
      }
      if (message.type === 'GET_STATUS') {
        sendResponse(session.getStatus());
        return;
      }
      if (message.type === 'SET_PREFS') {
        session.setPrefs(message.prefs || {});
      }
    });
    chrome.runtime.sendMessage({ type: 'GET_PREFS' }).then((prefs) => {
      if (prefs) session.setPrefs(prefs);
    }).catch(() => {});
  }

  if (ns.installed) return;
  if (globalThis.chrome?.runtime?.onMessage) {
    ns.installed = true;
    install();
  }
}());
