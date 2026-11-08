(()=>{
 const token=new URLSearchParams(location.search).get('token');
 document.getElementById('close').onclick=()=>window.close();
 chrome.runtime.sendMessage({type:'BONG_OTP_TOAST_READ',token}).then(result=>{
  if(!result?.code){window.close();return;}
  document.getElementById('code').textContent=result.code;
  document.getElementById('message').textContent='클립보드에 복사되었습니다';
 }).catch(()=>window.close());
 setTimeout(()=>window.close(),8000);
})();
