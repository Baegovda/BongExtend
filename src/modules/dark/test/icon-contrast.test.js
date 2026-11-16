import test from 'node:test';
import assert from 'node:assert/strict';
import {repairIconPixels, LOGO_LIMITS} from '../icon-contrast.js';

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

test('a large black logo on a transparent background is lifted to a bright gray only with logo limits',()=>{
  const w=560,h=140,data=new Uint8ClampedArray(w*h*4);
  for(let y=40;y<100;y++)for(let x=60;x<500;x+=2)data.set([0,0,0,255],(y*w+x)*4);
  assert.equal(repairIconPixels(data,w,h,[24,26,27,1]),null);
  const result=repairIconPixels(data,w,h,[24,26,27,1],LOGO_LIMITS);assert.ok(result);
  const i=(50*w+60)*4;assert.ok(result[i]>=180,'logo glyph should be bright');assert.equal(result[i+3],255);
  assert.equal(result[3],0);
});
