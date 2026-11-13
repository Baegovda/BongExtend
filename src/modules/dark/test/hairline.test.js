import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseColor, composite, contrastRatio, hairlineColor, ringShadow} from '../contrast.js';
const bg = [24, 26, 27, 1];
const visible = value => contrastRatio(composite(parseColor(value), bg), bg);
test('faint brown border and black 8-15% bars become visible light neutrals', () => {
  for (const c of [[140, 130, 115, .08], [0, 0, 0, .08], [0, 0, 0, .15], [0, 0, 0, .1]]) {
    const out = hairlineColor(c, bg);
    assert.ok(out, String(c)); assert.ok(visible(out) >= 1.7);
    assert.equal(parseColor(out)[3] <= .3, true);
  }
});
test('already visible, strong, opaque or semantic lines are left alone', () => {
  assert.equal(hairlineColor([255, 255, 255, .22], bg), null);
  assert.equal(hairlineColor([90, 95, 100, 1], bg), null);
  assert.equal(hairlineColor([200, 30, 30, .1], bg), null);
  assert.equal(hairlineColor([3, 199, 90, .2], bg), null);
  assert.equal(hairlineColor([0, 0, 0, .6], bg), null);
  assert.equal(hairlineColor(null, bg), null);
});
test('box-shadow ring is repaired, other shadows and big rings are kept', () => {
  const ring = ringShadow('rgba(0, 0, 0, 0.1) 0px 0px 0px 1px', bg);
  assert.match(ring, /^rgba\(255, 255, 255, [\d.]+\) 0px 0px 0px 1px$/);
  const mixed = ringShadow('rgba(0, 0, 0, 0.1) 0px 0px 0px 1px, rgba(0, 0, 0, 0.2) 0px 4px 12px 0px', bg);
  assert.match(mixed, /0px 4px 12px 0px$/);
  assert.equal(ringShadow('rgba(0, 0, 0, 0.1) 0px 4px 12px 0px', bg), null);
  assert.equal(ringShadow('rgba(0, 0, 0, 0.1) 0px 0px 0px 8px', bg), null);
  assert.equal(ringShadow('none', bg), null);
});
