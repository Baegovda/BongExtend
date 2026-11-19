// 골든 테스트: Rust(WebAssembly) 픽셀 보정이 예전 자바스크립트 repairIconPixels 와 바이트 단위로 같은지 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import {repairIconPixels, ICON_LIMITS, LOGO_LIMITS} from '../icon-contrast.js';
import {prepareIconPixels, repairIconPixelsWasm, iconPixelsEngine} from '../icon-pixels.js';

// 재현 가능한 무작위 수
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const same = (label, data, w, h, bg, limits) => {
  const before = new Uint8ClampedArray(data);
  const old = repairIconPixels(data, w, h, bg, limits);
  const fast = repairIconPixelsWasm(data, w, h, bg, limits);
  assert.notEqual(fast, undefined, `${label}: WebAssembly 길이 준비돼 있어야 해요`);
  assert.deepEqual(data, before, `${label}: 원본은 그대로여야 해요`);
  if (old === null) assert.equal(fast, null, `${label}: 예전 길은 바꾸지 않았는데 새 길은 바꿨어요`);
  else assert.ok(fast && Buffer.from(fast.buffer, fast.byteOffset, fast.byteLength).equals(Buffer.from(old.buffer, old.byteOffset, old.byteLength)), `${label}: 결과 바이트가 달라요`);
  return old !== null;
};

test('the WebAssembly engine loads', async () => {
  assert.equal(await prepareIconPixels(), true);
  assert.equal(iconPixelsEngine(), 'wasm');
});

test('random icons and logos give byte-identical results', async () => {
  await prepareIconPixels();
  const rand = rng(20261120);
  const backs = [[24, 26, 27, 1], [11, 13, 18, 1], [32, 33, 36, 1], [24.6, 26.2, 27.9, 1], [45, 45, 48, 1], [0, 0, 0, 1], [60, 70, 80, 1]];
  let changed = 0;
  for (let n = 0; n < 600; n++) {
    const logo = n % 3 === 0;
    const limits = logo ? LOGO_LIMITS : ICON_LIMITS;
    const w = 4 + Math.floor(rand() * (logo ? 600 : 120)), h = 4 + Math.floor(rand() * (logo ? 160 : 80));
    const data = new Uint8ClampedArray(w * h * 4);
    const glyph = Math.floor(rand() * 140), tint = Math.floor(rand() * 30);
    for (let p = 0; p < w * h; p++) {
      const r = rand();
      if (r < 0.55) continue; // 투명
      const g = Math.min(255, glyph + Math.floor(rand() * 40));
      if (r < 0.9) data.set([g, Math.min(255, g + tint % 12), Math.min(255, g + Math.floor(rand() * 20)), Math.floor(rand() * 256)], p * 4);
      else data.set([Math.floor(rand() * 256), Math.floor(rand() * 256), Math.floor(rand() * 256), 255], p * 4); // 색 있는 픽셀
    }
    if (same(`#${n} ${w}x${h}`, data, w, h, backs[n % backs.length], limits)) changed++;
  }
  assert.ok(changed > 100, `바꾸는 경우도 충분히 시험해야 해요(${changed})`);
});

test('every neutral glyph colour matches on the default dark background', async () => {
  await prepareIconPixels();
  // 무채색에 가까운(최대-최소 ≤ 25) 모든 색을 절반은 투명한 그림에 담아 나눠서 비교해요.
  const colors = [];
  for (let r = 0; r < 256; r++) for (let g = Math.max(0, r - 25); g <= Math.min(255, r + 25); g++) for (let b = Math.max(0, r - 25); b <= Math.min(255, r + 25); b++) {
    if (Math.max(r, g, b) - Math.min(r, g, b) <= 25) colors.push([r, g, b]);
  }
  const w = 500, h = 400, per = (w * h) / 2;
  for (let start = 0; start < colors.length; start += per) {
    const data = new Uint8ClampedArray(w * h * 4);
    const chunk = colors.slice(start, start + per);
    chunk.forEach((c, i) => data.set([c[0], c[1], c[2], 255], i * 8));
    // 마지막 조각도 조건(투명 20% 이상 등)을 맞추게 어두운 회색을 몇 개 채워요.
    for (let i = chunk.length; i < Math.max(chunk.length, 64); i++) data.set([40, 40, 40, 255], i * 8);
    same(`colours from ${start}`, data, w, h, [24, 26, 27, 1], {...LOGO_LIMITS, target: 4.5});
  }
});
