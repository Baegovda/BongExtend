import {expect, test} from 'bun:test';
import {shouldLaunchUpdater, withInstallLock} from './autoInstall';

const ready = {enabled:true, available:true, version:'2.0.0', now:1_000_000, hasUpdater:false};
test('a detected release launches automatically, but disabled automatic updates do not', () => {
    expect(shouldLaunchUpdater(ready)).toBe(true);
    expect(shouldLaunchUpdater({...ready, enabled:false})).toBe(false);
    expect(shouldLaunchUpdater({...ready, available:false})).toBe(false);
});
test('an open updater, missing permission, completed install and rapid retries do not spawn duplicates', () => {
    expect(shouldLaunchUpdater({...ready,hasUpdater:true})).toBe(false);
    for(const phase of ['blocked','done'] as const) expect(shouldLaunchUpdater({...ready,state:{version:'2.0.0',phase,message:''}})).toBe(false);
    expect(shouldLaunchUpdater({...ready,attempt:{version:'2.0.0',at:999_999,count:1}})).toBe(false);
    expect(shouldLaunchUpdater({...ready,attempt:{version:'2.0.0',at:0,count:3}})).toBe(false);
});
test('a transient failure retries after five minutes; a newer release gets its own attempts', () => {
    expect(shouldLaunchUpdater({...ready,hasUpdater:true,state:{version:'2.0.0',phase:'error',message:''},attempt:{version:'2.0.0',at:0,count:1}})).toBe(true);
    expect(shouldLaunchUpdater({...ready,state:{version:'1.9.0',phase:'blocked',message:''},attempt:{version:'1.9.0',at:999_999,count:3}})).toBe(true);
    expect(shouldLaunchUpdater({...ready,hasUpdater:true,state:{version:'1.9.0',phase:'done',message:''}})).toBe(true);
});
test('a second installer cannot enter while another owns the write lock', async () => {
    let entered=0,busy=0;
    const locks={request:async (_name: string,_options: unknown,fn: (lock: unknown)=>Promise<void>)=>fn(null)};
    await withInstallLock(locks as unknown as LockManager,async()=>{entered++;},()=>{busy++;});
    expect(entered).toBe(0);expect(busy).toBe(1);
});

test('manual check installs with auto-check off and permits an explicit retry, without interrupting active writes',()=>{
 expect(shouldLaunchUpdater({...ready,manual:true,enabled:false})).toBe(true);
 expect(shouldLaunchUpdater({...ready,manual:true,state:{version:'2.0.0',phase:'blocked',message:''},attempt:{version:'2.0.0',at:999999,count:3}})).toBe(true);
 expect(shouldLaunchUpdater({...ready,manual:true,hasUpdater:true,state:{version:'2.0.0',phase:'working',message:''}})).toBe(false);
 expect(shouldLaunchUpdater({...ready,manual:true,state:{version:'2.0.0',phase:'done',message:''}})).toBe(false);
 expect(shouldLaunchUpdater({...ready,manual:true,available:false})).toBe(false);
});
