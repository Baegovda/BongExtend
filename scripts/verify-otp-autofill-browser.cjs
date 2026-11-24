// 인증번호 자동 입력(fillFocusedOtp)을 실제 크롬에서 여러 모양의 입력 칸으로 확인해요. 계정·네트워크는 쓰지 않아요.
const {chromium}=require('playwright');const fs=require('node:fs'),assert=require('node:assert/strict');
const fn=fs.readFileSync('src/modules/gmail/otp-autofill.js','utf8').match(/export function fillFocusedOtp\(code\) \{[\s\S]*?\n\}\n/)[0].replace('export ','');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage();
  const run=async(html,focus)=>{await page.setContent(`<!doctype html><meta charset=utf-8><body>${html}<script>window.clicks=[];window.submits=0;document.addEventListener('click',e=>{if(e.target.closest('button'))clicks.push(e.target.closest('button').textContent.trim())},true);document.addEventListener('submit',e=>{e.preventDefault();submits++},true)</script>`);if(focus)await page.focus(focus);return page.evaluate(`Promise.resolve((${fn})('482913')).then(r=>({r,clicks,submits,values:[...document.querySelectorAll('input')].map(i=>i.value)}))`);};
  let out=await run('<form><label>인증번호 <input id=c autocomplete=one-time-code></label><button type=button>재전송</button><button>확인</button></form>','#c');
  assert.deepEqual(out.r,{filled:true,submitted:true});assert.equal(out.values[0],'482913');assert.deepEqual(out.clicks,['확인'],'presses 확인, not 재전송');
  out=await run('<div><input id=c placeholder="Verification code"><div><button>Cancel</button><button>Verify</button></div></div>','#c');
  assert.equal(out.values[0],'482913');assert.deepEqual(out.clicks,['Verify'],'no form: nearby Verify button');
  out=await run('<form>'+'<input maxlength=1 inputmode=numeric>'.repeat(6)+'<button>다음</button></form>','input');
  assert.deepEqual(out.values,['4','8','2','9','1','3'],'six single-digit boxes');assert.deepEqual(out.clicks,['다음']);
  out=await run('<form><input id=q name=q placeholder="검색"><button>검색</button></form>','#q');
  assert.deepEqual(out.r,{filled:false});assert.equal(out.values[0],'','a search box is left alone');
  out=await run('<form><input id=p type=password name=otp><button>확인</button></form>','#p');
  assert.deepEqual(out.r,{filled:false},'password fields are left alone');
  out=await run('<form><input id=c name=otp><button>확인</button></form>',null);
  assert.deepEqual(out.r,{filled:false},'nothing focused: nothing typed');assert.equal(out.values[0],'');
  out=await run('<form><input id=c name=code maxlength=4><button>확인</button></form>','#c');
  assert.deepEqual(out.r,{filled:false},'a box too short for the code is left alone');
  out=await run('<form><input id=c name=couponCode placeholder="쿠폰 코드"><button>적용</button></form>','#c');
  assert.deepEqual(out.r,{filled:false},'coupon/zip code boxes are left alone');
  console.log('PASS otp autofill: labelled box + 확인, nearby Verify, split digits, skips search/password/unfocused/too short');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
