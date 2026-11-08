import test from 'node:test';
import assert from 'node:assert/strict';
import {addVideoHistory, unseenVideos, videoHistory} from '../video-history.js';

const row=(id,time=200)=>({id,filename:`C:\\Downloads\\${id}.mkv`,completedAt:time});
test('video completion history is bounded, deduplicated, and excludes malformed entries',()=>{
 const entries=Array.from({length:40},(_,i)=>row(String(i)));
 assert.equal(addVideoHistory(entries,row('new')).length,30);
 assert.deepEqual(addVideoHistory([row('a',100)],row('a',200)),[row('a',200)]);
 assert.deepEqual(videoHistory([null,{},row('a'),row('a'),{...row('bad'),completedAt:NaN}]),[row('a')]);
});
test('only videos completed since the downloader was last seen contribute to its badge',()=>{
 assert.equal(unseenVideos([row('old',99),row('equal',100),row('new',101)],100),1);
 assert.equal(unseenVideos(undefined,100),0);
});
