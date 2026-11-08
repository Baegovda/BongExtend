(()=>{
 const $=id=>document.getElementById(id),key='core.video:status';
 let autoStart=new URLSearchParams(location.search).get('autostart')==='1';
 $('videoUrl').value=new URLSearchParams(location.search).get('url') || '';
 $('installer').href=`https://github.com/Baegovda/BongExtend/releases/download/v${chrome.runtime.getManifest().version}/bongextend-video-helper-windows.zip`;
 const paint=s=>{
  if(!s)return;
  if(autoStart && ['started','progress'].includes(s.type)){autoStart=false;history.replaceState(null,'',location.pathname+'?url='+encodeURIComponent($('videoUrl').value));}
  if(autoStart && s.type==='ready'){autoStart=false;history.replaceState(null,'',location.pathname+'?url='+encodeURIComponent($('videoUrl').value));void send('download',{url:$('videoUrl').value,quality:$('quality').value});return;}
  const busy=['started','progress','connecting'].includes(s.type);$('start').disabled=busy;$('cancel').disabled=!['started','progress'].includes(s.type);
  $('progress').value=s.type==='done'?100:s.percent || 0;
  $('status').textContent=({ready:'연결됐어요. 영상 주소를 넣어 주세요.',connecting:'연결 확인 중…',started:'영상을 확인하고 내려받고 있어요…',progress:`다운로드 ${Math.floor(s.percent || 0)}% · 영상과 음성 병합까지 기다려 주세요.`,done:'다운로드와 병합을 마쳤어요.',missing:'보조 프로그램 연결이 필요해요. 아래 안내를 따라 설치해 주세요.',error:s.message || '다운로드하지 못했어요.'})[s.type] || '';
  $('setup').open=s.type==='missing';$('file').textContent=s.filename || '';
 };
 const send=(action,data={})=>chrome.runtime.sendMessage({type:'BONG_VIDEO',action,...data}).then(reply=>{if(reply?.ok===false && reply.message)paint({type:'error',message:reply.message});}).catch(()=>paint({type:'missing'}));
 $('videoForm').addEventListener('submit',e=>{e.preventDefault();void send('download',{url:$('videoUrl').value,quality:$('quality').value});});
 $('cancel').onclick=()=>void send('cancel');$('connect').onclick=()=>void send('ping');
 $('connection').onclick=async()=>{const blob=new Blob([JSON.stringify({extensionId:chrome.runtime.id})],{type:'application/json'}),url=URL.createObjectURL(blob);try{await chrome.downloads.download({url,filename:'bongextend-video-connection.json',saveAs:false});}finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}};
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[key])paint(changes[key].newValue);});
 chrome.storage.local.get(key).then(s=>{paint(s[key]);if(!['started','progress'].includes(s[key]?.type))void send('ping');});
})();
