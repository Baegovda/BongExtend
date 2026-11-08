import test from 'node:test';import assert from 'node:assert/strict';
import {videoSaveTarget} from '../video-menu.js';
test('video menu downloads direct media, and passes blob/manifest videos to the page extractor',()=>{
 assert.deepEqual(videoSaveTarget({srcUrl:'https://cdn.example/video.mp4?token=a'}),{mode:'direct',url:'https://cdn.example/video.mp4?token=a'});
 assert.deepEqual(videoSaveTarget({srcUrl:'blob:https://example.com/123',pageUrl:'https://example.com/watch/1'}),{mode:'native',url:'https://example.com/watch/1'});
 assert.deepEqual(videoSaveTarget({srcUrl:'https://cdn.example/live.m3u8',pageUrl:'https://example.com/watch/1'}),{mode:'native',url:'https://example.com/watch/1'});
 assert.equal(videoSaveTarget({srcUrl:'javascript:alert(1)',pageUrl:'chrome://settings/'}),null);
});
