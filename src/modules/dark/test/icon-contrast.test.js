import test from 'node:test';
import assert from 'node:assert/strict';
import {repairIconPixels} from '../icon-contrast.js';

test('transparent control bitmap brightens neutral glyphs while preserving brand pixels and antialias alpha',()=>{
  const data=new Uint8ClampedArray(20*20*4);
  for(let n=0;n<25;n++)data.set([66,66,66,120+n],n*4);
  for(let n=25;n<50;n++)data.set([20,180,230,255],n*4);
  const result=repairIconPixels(data,20,20,[24,26,27,1]);assert.ok(result);
  for(let n=0;n<25;n++){assert.ok(result[n*4]>120);assert.equal(result[n*4+3],data[n*4+3]);}
  assert.deepEqual(result.slice(25*4),data.slice(25*4));
  assert.equal(data[0],66);
});
test('opaque photos, large bitmaps and already readable glyphs remain unchanged',()=>{
  const photo=new Uint8ClampedArray(20*20*4).fill(255);
  assert.equal(repairIconPixels(photo,20,20,[24,26,27,1]),null);
  const good=new Uint8ClampedArray(20*20*4);
  for(let n=0;n<25;n++)good.set([230,230,230,255],n*4);
  assert.equal(repairIconPixels(good,20,20,[24,26,27,1]),null);
  assert.equal(repairIconPixels(good,1024,1024,[24,26,27,1]),null);
});
