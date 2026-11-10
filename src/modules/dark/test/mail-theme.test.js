import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMailThemeController,mapMailGradient} from '../mail-theme.js';
const wait = () => new Promise(r=>setTimeout(r,80));
const mappers = {background:()=> 'rgb(24, 26, 27)',foreground:()=> 'rgb(232, 230, 227)',border:()=> 'rgb(85, 90, 95)'};
test('gradient only transforms color stops and never URL images',()=>{
 assert.equal(mapMailGradient('url("photo.png"), linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))',mappers.background,{}),null);
 assert.equal(mapMailGradient('linear-gradient(90deg, rgb(255, 255, 255), rgba(40, 40, 40, .5))',mappers.background,{}),'linear-gradient(90deg, rgb(24, 26, 27), rgb(24, 26, 27))');
});
test('subtree mapper scopes, restores legacy color/style, reacts to new DOM and settles',async()=>{
 const win=new Window();
 try{
  win.document.body.innerHTML='<style>*{filter:none;mix-blend-mode:normal;visibility:visible}</style><p id="outside" style="color:rgb(1,2,3)">Outside</p><div id="mail" bgcolor="#ffffff"><font id="text" color="#222222" style="color:rgb(20,20,20)!important">Text</font><div hidden><b id="secret" style="color:rgb(12,12,12)">Hidden</b></div><div contenteditable="true"><i id="edit">Draft</i></div><img src="data:image/png;base64,x" style="filter:none"></div>';
  const root=win.document.querySelector('#mail'),text=root.querySelector('#text'),original=text.getAttribute('style'),controller=createMailThemeController(root,mappers);
  controller.update(true,{});await wait();
  assert.equal(text.style.color,'rgb(232, 230, 227)');assert.equal(root.getAttribute('bgcolor'),'#ffffff');assert.equal(text.getAttribute('color'),'#222222');
  assert.equal(win.document.querySelector('#outside').style.color,'rgb(1, 2, 3)');assert.equal(root.querySelector('#secret').style.color,'rgb(12, 12, 12)');assert.equal(root.querySelector('#edit').getAttribute('style'),null);
  const p=win.document.createElement('p');p.textContent='Translation arrived';p.style.color='rgb(10,10,10)';root.append(p);await wait();assert.equal(p.style.color,'rgb(232, 230, 227)');
  const passes=controller.stats.passes;await wait();assert.equal(controller.stats.passes,passes);
  p.style.setProperty('color','rgb(8,9,10)','important');controller.stop();assert.equal(p.style.color,'rgb(8, 9, 10)');assert.equal(text.style.color,'rgb(20, 20, 20)');
  assert.equal(text.style.getPropertyPriority('color'),'important');assert.equal(root.getAttribute('bgcolor'),'#ffffff');
 }finally{await win.happyDOM.abort()}
});
