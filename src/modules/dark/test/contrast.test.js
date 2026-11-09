import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseColor, composite, contrastRatio, readableColor} from '../contrast.js';
test('sRGB contrast and alpha compositing use actual surface',()=>{
 assert.equal(contrastRatio([0,0,0],[255,255,255]),21);
 assert.deepEqual(composite([100,100,100,.5],[20,20,20,1]),[60,60,60,1]);
 assert.equal(parseColor('transparent'),null);
 assert.equal(parseColor('rgb(1, 2, 3)')[3],1);
});
test('repair only low contrast neutral text, preserve readable and saturated colors',()=>{
 const bg=[24,26,27,1],color=readableColor([44,44,44,1],bg);
 assert.ok(contrastRatio(parseColor(color),bg)>=4.5);
 assert.equal(readableColor([240,240,240,1],bg),null);
 assert.equal(readableColor([180,30,20,1],bg),null);
});
test('neutral rgba repair retains alpha and must meet composited contrast',()=>{
 const bg=[24,26,27,1],fg=[80,80,80,.7],color=parseColor(readableColor(fg,bg));
 assert.equal(color[3],.7);assert.ok(contrastRatio(composite(color,bg),bg)>=4.5);
 assert.equal(readableColor([40,40,40,.1],bg),null);
});
