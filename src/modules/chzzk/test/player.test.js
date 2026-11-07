import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/player.js', import.meta.url), 'utf8'), ctx);
vm.runInNewContext(readFileSync(new URL('../lib/extras.js', import.meta.url), 'utf8'), ctx);
const P = ctx.BongPlayer, X = ctx.BongExtras;

test('광고 차단 안내만 고르고 일반 확인창은 건드리지 않는다', () => {
  assert.equal(P.isAdBlockNoticeText('광고 차단 프로그램을 사용 중이신가요? 광고 차단 프로그램 사용 시 재생 환경에 영향을 미칠 수 있으니 사용 중인 확장 프로그램이 있다면 삭제 후 서비스를 이용해 주세요.'),true);
  assert.equal(P.isAdBlockNoticeText('구독을 취소하시겠어요? 확인'),false);
  assert.equal(P.isAdBlockNoticeText('확장 프로그램 권한을 확인하세요'),false);
});

test('isAdActive', () => {
  assert.equal(P.isAdActive({ adUiExists: true, adUiHidden: true, indicatorVisible: false }), false);
  assert.equal(P.isAdActive({ adUiExists: true, adUiHidden: false }), true);
  assert.equal(P.isAdActive({ adUiExists: false, indicatorVisible: true }), true);
  assert.equal(P.isAdActive({}), false);
  assert.equal(P.isAdActive(null), false);
});
test('isGuideText / isSkipText', () => {
  assert.equal(P.isGuideText('타임머신 기능으로 지난 방송을 볼 수 있어요'), true);
  assert.equal(P.isGuideText('치트키 사용법'), true);
  assert.equal(P.isGuideText('타임 머신'), true);
  assert.equal(P.isGuideText('실시간'), false);
  assert.equal(P.isSkipText('광고 건너뛰기'), true);
  assert.equal(P.isSkipText('Skip Ad'), true);
  assert.equal(P.isSkipText('Learn More'), false);
});
test('formatCount / changeDirection / eyeColor', () => {
  assert.equal(X.formatCount(1234), '1,234명');
  assert.equal(X.formatCount(NaN), '-');
  assert.equal(X.changeDirection(10, 12), 'up');
  assert.equal(X.changeDirection(12, 10), 'down');
  assert.equal(X.changeDirection(10, 10), null);
  assert.equal(X.changeDirection(undefined, 10), null);
  assert.equal(X.changeDirection(10, NaN), null);
  assert.equal(X.eyeColor('/live/abc'), '#ff4d4f');
  assert.equal(X.eyeColor('/video/123'), '#8a8f98');
});
test('adTextKind / isSafeSkipLabel / isAdDuration', () => {
  assert.equal(P.adTextKind('AD 1/1'), 'counter');
  assert.equal(P.adTextKind('ad 2 / 3'), 'counter');
  assert.equal(P.adTextKind('1 초 후 SKIP'), 'countdown');
  assert.equal(P.adTextKind('5초 후 skip'), 'countdown');
  assert.equal(P.adTextKind('SKIP'), 'skip');
  assert.equal(P.adTextKind('건너뛰기'), 'skip');
  assert.equal(P.adTextKind('광고 페이지 보기'), 'clickthrough');
  assert.equal(P.adTextKind('00:04 / 00:15'), null);
  assert.equal(P.adTextKind('실시간'), null);
  assert.equal(P.isSafeSkipLabel(' SKIP '), true);
  assert.equal(P.isSafeSkipLabel('1 초 후 SKIP'), false);
  assert.equal(P.isSafeSkipLabel('광고 페이지 보기'), false);
  assert.equal(P.isAdDuration(15), true);
  assert.equal(P.isAdDuration(Infinity), false);
  assert.equal(P.isAdDuration(600), false);
  assert.equal(P.isAdDuration(NaN), false);
  assert.equal(P.isAdActive({ textHits: 1 }), true);
});

test('isPurchaseGuideDialogText', () => {
  assert.equal(P.isPurchaseGuideDialogText('치트키를 구매하면\n타임머신 기능을 이용할 수 있어요! 치트키 구매 혜택 다시보기 무제한 치트키 구매하기'), true);
  assert.equal(P.isPurchaseGuideDialogText('방송을 신고하시겠어요? 취소 신고'), false);
  assert.equal(P.isPurchaseGuideDialogText('치트키 사용법'), false);
  assert.equal(P.isPurchaseGuideDialogText(null), false);
});

test('audio restore waits out an ad and stops after the user touches sound', () => {
  assert.equal(P.isAudioControlLabel('음소거'), true);
  assert.equal(P.isAudioControlLabel('volume slider'), true);
  assert.equal(P.isAudioControlLabel('재생'), false);
  assert.equal(P.audioRestoreAction({ userTouched: false, adActive: false }), 'restore');
  assert.equal(P.audioRestoreAction({ userTouched: false, adActive: true }), 'wait');
  assert.equal(P.audioRestoreAction({ userTouched: true, adActive: false }), 'stop');
  assert.equal(P.audioRestoreAction(null), 'stop');
});

test('복구 전 음소거와 볼륨 상태를 새 영상에 복원한다', () => {
  const audible = P.captureAudioState({ muted: false, volume: 0.42 });
  const replacement = { muted: true, volume: 1 };
  assert.deepEqual({ ...audible }, { muted: false, volume: 0.42 });
  assert.equal(P.restoreAudioState(replacement, audible), true);
  assert.deepEqual(replacement, { muted: false, volume: 0.42 });

  const muted = P.captureAudioState({ muted: true, volume: 0.7 });
  P.restoreAudioState(replacement, muted);
  assert.deepEqual(replacement, { muted: true, volume: 0.7 });
  assert.equal(P.audioStateMatches(replacement, muted), true);
  assert.equal(P.audioStateMatches(replacement, audible), false);
});

test('광고 전 소리를 기억하고, 광고 중 음소거는 덮어쓰지 않는다', () => {
  const before = { muted: false, volume: 0.4 };
  assert.deepEqual(P.noteLiveAudio(null, before, false), before);
  assert.deepEqual(P.noteLiveAudio(before, { muted: true, volume: 0 }, true), before);
  assert.equal(P.noteLiveAudio(before, null, false), before);
  assert.deepEqual(P.audioAfterAd(before, false), before);
  assert.equal(P.audioAfterAd(before, true), null);
  assert.equal(P.audioAfterAd(null, false), null);
  const userMuted = { muted: true, volume: 0.8 };
  assert.deepEqual(P.audioAfterAd(P.noteLiveAudio(null, userMuted, false), false), userMuted);
});

test('광고 화면은 가리고 본방송 영상과 채팅은 남긴다', () => {
  assert.equal(P.isAdChrome({ text: '광고 페이지 보기' }), true);
  assert.equal(P.isAdChrome({ text: '9초 후 SKIP' }), true);
  assert.equal(P.isAdChrome({ text: 'SKIP', className: 'btn_skip' }), true);
  assert.equal(P.isAdChrome({ text: '안녕하세요', inChat: true }), false);
  assert.equal(P.isAdChrome({ text: '실시간' }), false);
  const overlay = P.pickAdConcealNode([
    { id: 'label' },
    { id: 'overlay' },
    { id: 'player', isPlayer: true, hasLiveVideo: true }
  ]);
  assert.equal(overlay.id, 'overlay');
  const buttonOnly = P.pickAdConcealNode([
    { id: 'skip' },
    { id: 'stack', hasLiveVideo: true },
    { id: 'player', isPlayer: true }
  ]);
  assert.equal(buttonOnly.id, 'skip');
  assert.equal(P.pickAdConcealNode([
    { id: 'row', hasChat: true },
    { id: 'player', isPlayer: true }
  ]), null);
  assert.equal(P.pickAdConcealNode([{ id: 'player', isPlayer: true }]), null);
  // 타임머신 길이가 짧아도, 본영상이 들어 있는 칸은 가리지 않는다.
  const liveCore = P.pickAdConcealNode([
    { id: 'ad' },
    { id: 'core', hasContentVideo: true },
    { id: 'wrap' },
    { id: 'player', isPlayer: true }
  ]);
  assert.equal(liveCore.id, 'ad');
  assert.equal(P.isContentVideo({ isMain: true, duration: 32 }), true);
  assert.equal(P.isContentVideo({ id: 'preAdContentPlayer', duration: 15 }), true);
  assert.equal(P.isAdVideo({ id: 'preAdContentPlayer', duration: 15 }), false);
  assert.equal(P.isContentVideo({ className: 'webplayer-internal-video', inChat: true }), false);
  assert.equal(P.isAdVideo({ isMain: true, duration: Infinity }), false);
  assert.equal(P.isAdVideo({ isMain: true, duration: 15 }), false);
  assert.equal(P.isAdVideo({ isMain: true, duration: 32, inAdLayer: true }), false);
  assert.equal(P.isAdVideo({ isMain: false, duration: 30, inAdBox: true }), true);
  assert.equal(P.isAdVideo({ inChat: true, duration: 15 }), false);
  assert.equal(P.isAdVideo({ isMain: false, duration: NaN }), false);
  assert.equal(P.isBoostTarget({ isMain: true, live: true, duration: 32 }), false);
  assert.equal(P.isBoostTarget({ className: 'webplayer-internal-video', live: true, duration: 15 }), false);
  assert.equal(P.isBoostTarget({ inAdLayer: true, live: true, duration: 15 }), true);
  assert.equal(P.isBoostTarget({ live: true, duration: 15 }), false);
  assert.match(P.AD_CONCEAL_CSS, /video\.webplayer-internal-video/);
  assert.match(P.AD_CONCEAL_CSS, /preAdContentPlayer/);
  assert.match(P.AD_CONCEAL_CSS, /opacity:1/);
  assert.doesNotMatch(P.AD_CONCEAL_CSS, /opacity:0/);
  assert.doesNotMatch(P.AD_CONCEAL_SHADOW_CSS, /opacity:0/);
  assert.doesNotMatch(P.AD_CONCEAL_CSS, /display:\s*none/);
  assert.doesNotMatch(P.AD_CONCEAL_SHADOW_CSS, /display:\s*none/);
  assert.doesNotMatch(P.AD_CONCEAL_CSS, /aside-chatting/);
  assert.doesNotMatch(P.AD_CONCEAL_SHADOW_CSS, /\.webplayer-internal-core-ad-ui\{opacity:0/);
  const covered = P.planBlackRecovery({ wrapperPresent: true, mainHasFrames: true, adSlotPresent: true, preContentHasFrames: true });
  assert.equal(covered.collapseWrapper, true);
  assert.equal(covered.collapseAdSlot, false);
  const onlyInside = P.planBlackRecovery({ wrapperPresent: true, adSlotPresent: true, preContentHasFrames: true, stuck: true });
  assert.equal(onlyInside.collapseWrapper, false);
  assert.equal(onlyInside.collapseAdSlot, true);
  const stuck = P.planBlackRecovery({ wrapperPresent: true, stuck: true });
  assert.equal(stuck.collapseWrapper, true);
  assert.equal(P.planBlackRecovery({ wrapperPresent: true }).collapseWrapper, false);
});

test('라이브 본영상은 짧은 길이와 그림자 루트 안 광고 막 때문에 가려지지 않는다', () => {
  const nodes = [
    { id: 'player', className: 'pzp pzp-pc', isPlayer: true },
    { id: 'videoWrap', parent: 'player', className: 'pzp-pc__video' },
    { id: 'core', parent: 'videoWrap', className: 'webplayer-internal-core-shadow wpc-full' },
    { id: 'source', shadowHost: 'core', className: 'webplayer-internal-core-source-container' },
    { id: 'broadcast', parent: 'source', shadowHost: 'core', tag: 'VIDEO', className: 'webplayer-internal-video', duration: 32 },
    { id: 'dimHidden', shadowHost: 'core', className: 'webplayer-internal-core-dimmed wpc-pos-abs wpc-dis-hid' },
    { id: 'dimShown', shadowHost: 'core', className: 'webplayer-internal-core-dimmed wpc-pos-abs' },
    { id: 'adSheet', shadowHost: 'core', className: 'webplayer-internal-core-ad-ui wpc-full wpc-pos-abs' },
    { id: 'ima', parent: 'adSheet', shadowHost: 'core', dataRole: 'imaAdContainerEl' },
    { id: 'adVideo', parent: 'ima', shadowHost: 'core', tag: 'VIDEO', duration: 15 },
    { id: 'chat', parent: 'player', elementId: 'aside-chatting' },
    { id: 'chatSkip', parent: 'chat', className: 'btn_skip', text: 'SKIP' }
  ];
  const plan = P.resolveAdConceal(nodes);
  for (const id of ['player', 'videoWrap', 'core', 'source', 'broadcast', 'dimHidden', 'chat', 'chatSkip']) {
    assert.equal(plan.hideIds.includes(id), false, id);
  }
  for (const id of ['adSheet', 'ima', 'dimShown']) assert.equal(plan.hideIds.includes(id), true, id);
  assert.equal(plan.contentVideoIds.join(','), 'broadcast');
  assert.equal(plan.adVideoIds.join(','), 'adVideo');
  assert.equal(plan.adVideoIds.includes('broadcast'), false);

  const wrapped = P.resolveAdConceal([
    { id: 'player', isPlayer: true, className: 'pzp pzp-pc' },
    { id: 'sheet', parent: 'player', className: 'webplayer-internal-core-ad-ui' },
    { id: 'broadcast', parent: 'sheet', tag: 'VIDEO', className: 'webplayer-internal-video', duration: 20 },
    { id: 'adVideo', parent: 'sheet', tag: 'VIDEO', duration: 15 }
  ]);
  assert.equal(wrapped.hideIds.includes('sheet'), false);
  assert.equal(wrapped.hideIds.includes('broadcast'), false);
  assert.equal(wrapped.contentVideoIds.join(','), 'broadcast');
  assert.equal(wrapped.adVideoIds.join(','), 'adVideo');
});

test('배너 광고 요소만 고른다', () => {
  assert.equal(P.isDisplayAdElement({ tag: 'IFRAME', title: 'AD', id: 'x' }), true);
  assert.equal(P.isDisplayAdElement({ tag: 'iframe', title: '채팅', id: 'live_tgtLREC' }), true);
  assert.equal(P.isDisplayAdElement({ tag: 'IFRAME', title: '방송', id: 'player' }), false);
  assert.equal(P.isDisplayAdElement({ tag: 'IMG', src: 'https://nng-phinf.pstatic.net/a/Banner_1.png', cls: 'banner_image_x banner_link_y' }), true);
  assert.equal(P.isDisplayAdElement({ tag: 'IMG', src: 'https://example/thumb.png', cls: 'banner_image_x' }), false);
  assert.equal(P.isDisplayAdElement({ tag: 'VIDEO', src: 'blob:live' }), false);
  assert.equal(P.isDisplayAdElement(null), false);
});
