import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/player.js', import.meta.url), 'utf8'), ctx);
vm.runInNewContext(readFileSync(new URL('../lib/extras.js', import.meta.url), 'utf8'), ctx);
const P = ctx.BongPlayer, X = ctx.BongExtras;

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

test('배너 광고 요소만 고른다', () => {
  assert.equal(P.isDisplayAdElement({ tag: 'IFRAME', title: 'AD', id: 'x' }), true);
  assert.equal(P.isDisplayAdElement({ tag: 'iframe', title: '채팅', id: 'live_tgtLREC' }), true);
  assert.equal(P.isDisplayAdElement({ tag: 'IFRAME', title: '방송', id: 'player' }), false);
  assert.equal(P.isDisplayAdElement({ tag: 'IMG', src: 'https://nng-phinf.pstatic.net/a/Banner_1.png', cls: 'banner_image_x banner_link_y' }), true);
  assert.equal(P.isDisplayAdElement({ tag: 'IMG', src: 'https://example/thumb.png', cls: 'banner_image_x' }), false);
  assert.equal(P.isDisplayAdElement({ tag: 'VIDEO', src: 'blob:live' }), false);
  assert.equal(P.isDisplayAdElement(null), false);
});
