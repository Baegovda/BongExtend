// Shared Gmail/Naver body-only zoom. Normal wheel remains scrolling.
(() => {
 const clamp=value=>Math.max(50,Math.min(200,Math.round((Number(value)||80)/10)*10));
 function bind(target,{get,set,accept=()=>true}){
  const wheel=event=>{
   if(!(event.ctrlKey||event.metaKey)||!event.deltaY||!accept(event))return;
   event.preventDefault();event.stopPropagation();
   set(clamp(get()+(event.deltaY<0?10:-10)));
  };
  target.addEventListener('wheel',wheel,{passive:false});
  return ()=>target.removeEventListener('wheel',wheel);
 }
 globalThis.BongExtendReaderZoom={bind,clamp};
})();
