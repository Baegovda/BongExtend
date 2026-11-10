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
 function navigation({isOpen,back}){
  const host=window.top;
  const coordinator=host.__beReaderNavigation||=(()=>{
   const clients=new Set();let armed=false;
   host.addEventListener('popstate',()=>{if(!armed)return;armed=false;const client=[...clients].find(client=>client.isOpen());if(client)client.back();});
   const api={clients,arm(){if(!armed){host.history.pushState({...host.history.state,beReaderNavigation:true},'',host.location.href);armed=true;}}};
   new host.MutationObserver(()=>{if([...clients].some(client=>client.isOpen()))api.arm();}).observe(host.document.documentElement,{subtree:true,attributes:true,attributeFilter:['hidden','class','style']});
   return api;
  })();
  const active=()=>isOpen()&&(!window.frameElement||window.frameElement.getClientRects().length>0);
  const client={isOpen:active,back};coordinator.clients.add(client);
  const documents=new Map();let suppress=false,timer;
  const addDocument=doc=>{
   if(!doc||documents.has(doc))return ()=>{};
   const pointer=event=>{
    if(event.button!==3||(!active()&&!suppress))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!suppress){suppress=true;back();clearTimeout(timer);timer=setTimeout(()=>suppress=false,500);}
   };
   for(const type of ['mousedown','mouseup','auxclick'])doc.addEventListener(type,pointer,true);
   const remove=()=>{for(const type of ['mousedown','mouseup','auxclick'])doc.removeEventListener(type,pointer,true);documents.delete(doc);};documents.set(doc,remove);return remove;
  };
  addDocument(document);if(host.document!==document)addDocument(host.document);
  return {addDocument,sync(){if(active())coordinator.arm();},stop(){for(const remove of [...documents.values()])remove();clearTimeout(timer);coordinator.clients.delete(client);}};
 }
 globalThis.BongExtendReaderZoom={bind,clamp,navigation};
})();
