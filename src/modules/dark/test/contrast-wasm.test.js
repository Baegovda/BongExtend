// 골든 테스트: Rust(WebAssembly) 글자색 대비 계산이 예전 자바스크립트 계산과 글자 하나까지 같은지 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readableColor, readableColorJs, readableColorWasm, repairTextColorJs, repairTextColorWasm, prepareContrastWasm} from '../contrast.js';
import {darkWasmState} from '../dark-wasm.js';

// 재현 가능한 무작위 수
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

test('the WebAssembly engine loads for contrast too', async () => {
  assert.equal(await prepareContrastWasm(), true);
  assert.equal(darkWasmState(), 'wasm');
});

test('readableColor: random colours give the same text', async () => {
  await prepareContrastWasm();
  const rand = rng(20261120);
  const pick = list => list[Math.floor(rand() * list.length)];
  let changed = 0;
  for (let n = 0; n < 60000; n++) {
    // 정수 색, 소수 색(겹친 반투명 면), 무채색에 가까운 색을 섞어요.
    const base = rand() * 255;
    const near = () => (rand() < .5 ? Math.round : v => v)(Math.min(255, Math.max(0, base + (rand() - .5) * pick([10, 60, 160, 400]))));
    const fg = [near(), near(), near(), pick([1, 1, 1, .5, .8, .3, rand()])];
    const bg = [rand() * 80, rand() * 80, rand() * 80, 1].map((v, i) => (i < 3 && rand() < .5 ? Math.round(v) : v));
    const target = pick([3, 4.5, 7, 10, 1.7]);
    const old = readableColorJs(fg, bg, target);
    const fast = readableColorWasm(fg, bg, target);
    assert.notEqual(fast, undefined, `#${n}: WebAssembly 길이 준비돼 있어야 해요`);
    assert.equal(fast, old, `#${n}: ${JSON.stringify({fg, bg, target})}`);
    assert.equal(readableColor(fg, bg, target), old);
    if (old) changed++;
  }
  assert.ok(changed > 5000, `바꾸는 경우도 충분히 시험해야 해요(${changed})`);
});

test('text repair: random layer stacks give the same text', async () => {
  await prepareContrastWasm();
  const rand = rng(77);
  let changed = 0;
  for (let n = 0; n < 30000; n++) {
    const count = Math.floor(rand() * 6);
    const layers = [];
    for (let i = 0; i < count; i++) {
      const dark = rand() * 70;
      layers.push({color: [dark + rand() * 20, dark + rand() * 20, dark + rand() * 25, [0, 1, .5, rand(), .04][i % 5]], opacity: [1, 1, .7, .95, rand() * .5 + .5][Math.floor(rand() * 5)]});
    }
    if (rand() < .8 && layers.length) layers[layers.length - 1].color[3] = 1;
    const g = rand() * 160;
    const fg = [g, g + rand() * 30, g + rand() * 50, [1, 1, .87, .6][Math.floor(rand() * 4)]].map(v => (rand() < .6 ? Math.round(v) : v));
    const old = repairTextColorJs(fg, layers, 4.5);
    const fast = repairTextColorWasm(fg, layers, 4.5);
    assert.notEqual(fast, undefined, `#${n}: WebAssembly 길이 준비돼 있어야 해요`);
    assert.equal(fast, old, `#${n}: ${JSON.stringify({fg, layers})}`);
    if (old) changed++;
  }
  assert.ok(changed > 3000, `바꾸는 경우도 충분히 시험해야 해요(${changed})`);
});

test('every integer grey on common dark backgrounds matches', async () => {
  await prepareContrastWasm();
  for (const bg of [[24, 26, 27, 1], [11, 13, 18, 1], [32, 33, 36, 1], [0, 0, 0, 1], [24.6, 26.2, 27.9, 1]]) {
    for (let v = 0; v < 256; v++) for (const d of [0, 7, 25, 71]) for (const target of [3, 4.5, 7]) {
      const fg = [v, Math.min(255, v + d), v, 1];
      assert.equal(readableColorWasm(fg, bg, target), readableColorJs(fg, bg, target), JSON.stringify({fg, bg, target}));
    }
  }
});

test('odd input falls back to the old path instead of guessing', async () => {
  await prepareContrastWasm();
  assert.equal(readableColorWasm([NaN, 0, 0, 1], [0, 0, 0, 1]), undefined);
  assert.equal(readableColorWasm(['5', 0, 0, 1], [0, 0, 0, 1]), undefined);
  assert.equal(readableColorWasm([5, 5, 5], [0, 0, 0, 1]), undefined);
  assert.equal(readableColorWasm(null, [0, 0, 0, 1]), undefined);
  assert.equal(repairTextColorWasm([5, 5, 5, 1], [{color: [0, 0, 0, 1], opacity: NaN}]), undefined);
  assert.equal(repairTextColorWasm([5, 5, 5, 1], Array.from({length: 25}, () => ({color: [0, 0, 0, 1], opacity: 1}))), undefined);
  // 이상한 값이어도 공개 함수는 예전 길로 답을 줘요.
  assert.equal(readableColor([NaN, 0, 0, 1], [0, 0, 0, 1]), readableColorJs([NaN, 0, 0, 1], [0, 0, 0, 1]));
  // 막다른 값: 이미 읽기 쉬움 / 채도가 높음
  assert.equal(readableColorWasm([255, 255, 255, 1], [0, 0, 0, 1]), null);
  assert.equal(readableColorWasm([200, 0, 0, 1], [0, 0, 0, 1], 21), null);
});
