// Local fixture renderer only: no user profile, live website, clipboard, or OS input.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),os=require('os');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-module-preview-'));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:580,height:730}});
  await page.route('**/*',route=>route.abort());
  await page.setContent(fs.readFileSync('public/recent-downloads.html','utf8').replace(/<script[^>]*>.*?<\/script>/gs,'').replace(/<link[^>]+>/g,''));
  await page.locator('header > img').evaluate((img,src)=>img.src=src,'data:image/png;base64,'+fs.readFileSync('.output/chrome-mv3/icons/32.png').toString('base64'));
  await page.addStyleTag({content:fs.readFileSync('src/modules/theme/theme.css','utf8')});await page.addStyleTag({content:fs.readFileSync('public/recent-downloads.css','utf8')});
  await page.evaluate(()=>{
   const now=Date.now(),icon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="5" y="3" width="30" height="34" rx="4" fill="#3989cb"/><path d="M11 10h18M11 17h18M11 24h18" stroke="white" stroke-width="3"/></svg>');
   window.chrome={runtime:{getURL:()=>icon},permissions:{},tabs:{},downloads:{search:async()=>[
    {id:1,filename:'C:/Downloads/BongExtend-1.2.37-chrome.zip',url:'https://github.com/download',state:'complete',exists:true,fileSize:4860000,startTime:new Date(now).toISOString()},
    {id:2,filename:'C:/Downloads/제품 사진.webp',url:'https://example.com/image.webp',state:'complete',exists:true,fileSize:160400,startTime:new Date(now-86400000).toISOString()},
    {id:3,filename:'C:/Downloads/설치 프로그램.exe',url:'https://example.com/setup.exe',state:'complete',exists:false,fileSize:45000000,startTime:new Date(now-172800000).toISOString()}],getFileIcon:async()=>icon,onChanged:{addListener(){}},onCreated:{addListener(){}},onErased:{addListener(){}}},storage:{local:{get:async()=>({})},onChanged:{addListener(){}}}};
  });
  await page.addScriptTag({content:fs.readFileSync('public/recent-downloads.js','utf8')});await page.waitForFunction(()=>document.querySelectorAll('.download-row').length===3);
  await page.screenshot({path:path.join(folder,'downloader-light.png')});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(folder,'downloader-dark.png')});
  await page.setViewportSize({width:1000,height:650});await page.setContent('<body style="margin:0;background:#e8eef6;font:20px system-ui"><div style="padding:48px">로컬 웹페이지 미리보기</div></body>');
  const {renderCopiedOtpToast}=await import('../src/modules/gmail/otp-toast.js');await page.evaluate(renderCopiedOtpToast,'001234');await page.waitForTimeout(350);await page.screenshot({path:path.join(folder,'otp-overlay.png')});
  console.log(folder);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
