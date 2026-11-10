// BongExtend's reader presentation; the original mail actions keep their handlers and state.
(() => {
  const labels = {back:'메일함', archive:'보관', delete:'삭제', markAsRead:'읽음', markAsUnread:'안 읽음',prevMail:'이전 메일',nextMail:'다음 메일',openEmailInBrowser:'Gmail에서 열기',openEmailOptions:'더보기',
    'reply-button':'답장', 'reply-all-button':'전체 답장', forward:'전달', send:'보내기'};
  function enhance() {
    const section = document.getElementById('openEmailSection');
    if (!section) return;
    navigation?.sync();
    for(const [frame,state] of bodyFrameDocs)if(!section.contains(frame)){state.remove?.();bodyFrameDocs.delete(frame);}
    for(const frame of section.querySelectorAll('iframe')){
      if(!watchedFrames.has(frame)){watchedFrames.add(frame);frame.addEventListener('load',enhance);}
      let doc;try{doc=frame.contentDocument;}catch{continue;}
      if(doc&&bodyFrameDocs.get(frame)?.doc!==doc){bodyFrameDocs.get(frame)?.remove?.();bodyFrameDocs.set(frame,{doc,remove:navigation?.addDocument(doc)});}
    }
    const title = section.querySelector('#openEmailHeader'), scroller = section.querySelector('#openEmail');
    if (title && scroller && title.parentElement === scroller) scroller.before(title);
    for (const [id, text] of Object.entries(labels)) {
      const button = section.querySelector('#' + id);
      if (!button || button.dataset.beLabel) continue;
      button.dataset.beLabel = 'true'; button.removeAttribute('msg');
      button.textContent = text; button.setAttribute('aria-label', text); button.title = text;
    }
    for (const button of section.querySelectorAll('.site-header j-button')) {
      if (button.hasAttribute('icon') && button.textContent) button.textContent='';
    }
    const tools=section.querySelector('.utility-items');
    if(tools&&!tools.querySelector('.be-body-zoom')){
      const zoom=document.createElement('button');zoom.className='be-body-zoom';zoom.type='button';
      const get=()=>Number(section.dataset.bodyZoom)||80;
      const update=()=>{zoom.textContent=get()+'%';zoom.title='Ctrl+휠로 본문 확대·축소 (50~200%) · 클릭하면 80% / 100%';zoom.setAttribute('aria-label',zoom.title);zoom.setAttribute('aria-pressed',String(get()===100));};
      const set=value=>{section.dataset.bodyZoom=String(value);section.style.setProperty('--be-mail-body-zoom',String(value/100));update();};
      zoom.addEventListener('click',()=>set(get()===100?80:100));
      globalThis.BongExtendReaderZoom?.bind(section,{get,set,accept:event=>section.classList.contains('active')&&Boolean(event.target.closest?.('.messageBody'))});
      update();tools.append(zoom);
    }
    const nav = section.querySelector('.primary-nav');
    if (nav && !nav.dataset.beLabel) {nav.dataset.beLabel='true'; nav.textContent='메일 읽기';}
    const menu = section.querySelector('#open-email-options-dropdown');
    if (menu && !menu.dataset.beTools) {
      menu.dataset.beTools='true';
      for (const [target, icon, text] of [['addToTasks','add-task','Google 할 일에 추가'],['print','print','인쇄']]) {
        const item = document.createElement('j-icon-item'), glyph = document.createElement('j-icon'), label = document.createElement('span');
        glyph.setAttribute('icon', icon); label.textContent=text; item.append(glyph,label);
        item.addEventListener('click', () => {menu.hidePopover?.(); section.querySelector('#'+target)?.click();});
        menu.append(item);
      }
    }
  }
  globalThis.BongExtendMailView = {
    selection() {
      if (!document.querySelector('#openEmailSection.active')) return '';
      return typeof replyingToMail !== 'undefined' ? String(replyingToMail?.id || '') : '';
    }
  };
  const section = document.getElementById('openEmailSection');
  const bodyFrameDocs=new Map(),watchedFrames=new WeakSet();
  const navigation=globalThis.BongExtendReaderZoom?.navigation({isOpen:()=>Boolean(section?.classList.contains('active')),back:()=>section?.querySelector('#back')?.click()});
  window.addEventListener('pagehide',()=>navigation?.stop(),{once:true});
  if (section) new MutationObserver(enhance).observe(section, {childList:true, subtree:true,attributes:true,attributeFilter:['class']});
  enhance();
  // Presentation only: native account objects, indexes and mouseup actions stay intact.
  const inbox=document.getElementById('inbox');
  if(!inbox)return;
  const set=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
  let sequence=0,scheduled=false;
  const keyboardControls=new WeakSet();
  const accountRows=()=>Array.from(inbox.children).filter(row=>row.matches('.account,.be-naver-account')&&!row.hidden);
  const accountKey=row=>row?.classList.contains('be-naver-account')?row.dataset.accountKey||'':`gmail:${String(row?.getAttribute('email')||row?._account?.email||'').trim().toLowerCase()}`;
  let drag;
  const dragStatus=document.createElement('span');dragStatus.className='be-drag-status';dragStatus.setAttribute('role','status');inbox.before(dragStatus);
  function clearTarget(){for(const row of inbox.querySelectorAll('.be-drop-before,.be-drop-after'))row.classList.remove('be-drop-before','be-drop-after');}
  function finishDrag(commit=false){
    if(!drag)return;const state=drag;drag=undefined;cancelAnimationFrame(state.frame);clearTarget();
    state.row.classList.remove('be-account-dragging');document.documentElement.classList.remove('be-account-drag-active');
    if(state.grip.hasPointerCapture?.(state.id))state.grip.releasePointerCapture(state.id);
    if(commit&&state.active&&state.target?.isConnected&&state.row.isConnected){
      const sourceKey=accountKey(state.row),targetKey=accountKey(state.target);
      if(sourceKey&&sourceKey!=='gmail:'&&targetKey&&targetKey!=='gmail:'&&sourceKey!==targetKey){
        const event=new CustomEvent('bongextend-mail-account-move',{cancelable:true,detail:{sourceKey,targetKey,placement:state.placement}});
        document.dispatchEvent(event);dragStatus.textContent=event.defaultPrevented?'계정 순서를 변경했어요.':'계정 순서를 변경하지 못했어요. 위아래 버튼을 사용해 주세요.';
      }
    }else if(state.active)dragStatus.textContent='계정 이동을 취소했어요.';
    if(state.grip.isConnected)state.grip.focus({preventScroll:true});
  }
  function updateDrag(){
    if(!drag?.active)return;
    if(!drag.row.isConnected||!drag.grip.isConnected){finishDrag();return;}
    clearTarget();drag.target=undefined;
    const bounds=inbox.getBoundingClientRect();
    if(drag.x>=bounds.left&&drag.x<=bounds.right&&drag.y>=bounds.top&&drag.y<=bounds.bottom){
      const headers=accountRows().filter(row=>row!==drag.row).map(row=>({row,rect:row.querySelector('.accountHeader,.be-naver-header')?.getBoundingClientRect()})).filter(item=>item.rect?.height);
      let closest,dist=Infinity;
      for(const item of headers){const next=Math.abs(drag.y-(item.rect.top+item.rect.height/2));if(next<dist){closest=item;dist=next;}}
      const own=drag.row.querySelector('.accountHeader,.be-naver-header')?.getBoundingClientRect();
      if(closest&&!(own&&drag.y>=own.top&&drag.y<=own.bottom)){drag.target=closest.row;drag.placement=drag.y<closest.rect.top+closest.rect.height/2?'before':'after';drag.target.classList.add('be-drop-'+drag.placement);}
      const edge=32,speed=drag.y<bounds.top+edge?-10:drag.y>bounds.bottom-edge?10:0;
      if(speed)inbox.scrollTop+=speed;
    }
    drag.frame=requestAnimationFrame(updateDrag);
  }
  function installGrip(row,header,email){
    if(header.querySelector('.be-account-grip'))return;
    const grip=document.createElement('button');grip.type='button';grip.className='be-account-grip';grip.textContent='⠿';
    grip.title='드래그하여 계정 순서 변경 · 키보드는 위/아래 방향키';grip.setAttribute('aria-label',`${email} 계정 순서 이동`);
    for(const type of ['click','mouseup','dragstart'])grip.addEventListener(type,event=>{event.preventDefault();event.stopPropagation();});
    grip.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();finishDrag();}else if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();row.querySelectorAll('.be-account-order button')[event.key==='ArrowUp'?0:1]?.click();grip.focus({preventScroll:true});}});
    grip.addEventListener('pointerdown',event=>{
      if(event.button!==0||!event.isPrimary||drag)return;event.preventDefault();event.stopPropagation();
      drag={row,grip,id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false};grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();drag.x=event.clientX;drag.y=event.clientY;
      if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=5){drag.active=true;row.classList.add('be-account-dragging');document.documentElement.classList.add('be-account-drag-active');dragStatus.textContent='계정을 놓을 위치로 이동해 주세요. Esc로 취소해요.';updateDrag();}
    });
    grip.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId){event.preventDefault();event.stopPropagation();drag.x=event.clientX;drag.y=event.clientY;if(drag.active){cancelAnimationFrame(drag.frame);updateDrag();}finishDrag(true);}});
    for(const type of ['pointercancel','lostpointercapture'])grip.addEventListener(type,event=>{if(drag?.id===event.pointerId)finishDrag();});
    header.prepend(grip);
  }
  document.addEventListener('keydown',event=>{if(drag&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finishDrag();}},true);
  window.addEventListener('blur',()=>finishDrag());
  window.addEventListener('pagehide',()=>finishDrag());
  function enhanceInbox(){
    scheduled=false;
    for(const row of inbox.querySelectorAll(':scope > .account,:scope > .be-naver-account')){
      const naver=row.classList.contains('be-naver-account');
      const header=row.querySelector(naver?'.be-naver-header':'.accountHeader');if(!header)continue;
      const email=row.getAttribute('email')||row.querySelector(naver?'.be-naver-title strong':'.accountTitle')?.textContent?.trim()||'메일 계정';
      installGrip(row,header,email);
      for(const [selector,label] of [['.compose','새 메일 작성'],['.search','이 계정에서 메일 검색'],['.accountOptionsMenuButton','계정 더보기'],['.markAllAsReadButton','이 계정의 모든 메일을 읽음으로 표시'],['.accountTitleArea','Gmail에서 전체 메일 열기']]){
        const control=header.querySelector(selector);if(!control)continue;set(control,'title',`${label} · ${email}`);set(control,'aria-label',`${label} · ${email}`);
      }
      const count=header.querySelector('.unreadCount,.be-naver-unread');
      const open=header.querySelector('.accountTitleArea');
      if(open&&!keyboardControls.has(open)){keyboardControls.add(open);set(open,'role','button');set(open,'tabindex','0');open.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();event.stopPropagation();open.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));});}
      if(count){set(count,'aria-label',`읽지 않은 메일 ${count.textContent.trim()}통`);set(count,'title','읽지 않은 메일 수');}
      if(naver)for(const control of header.querySelectorAll(':scope > button')){const name=control.textContent.trim();if(name!=='작성'&&name!=='메일함')continue;set(control,'aria-label',`${name==='작성'?'새 메일 작성':'네이버에서 전체 메일 열기'} · ${email}`);set(control,'title',control.getAttribute('aria-label'));}
      const content=row.querySelector(naver?'.be-naver-list':'.mails');
      if(!content)continue;
      if(!content.id)content.id=`be-mail-group-${++sequence}`;
      let fold=header.querySelector('.be-account-fold');
      if(!fold){fold=document.createElement('button');fold.type='button';fold.className='be-account-fold';
        fold.addEventListener('click',event=>{event.stopPropagation();row.dataset.beFolded=row.dataset.beFolded==='true'?'false':'true';enhanceInbox();});
        for(const type of ['keydown','mouseup'])fold.addEventListener(type,event=>event.stopPropagation());header.append(fold);
      }
      const collapsed=row.dataset.beFolded==='true',text=collapsed?'펼치기':'접기';
      if(fold.textContent!==text)fold.textContent=text;
      set(fold,'aria-expanded',String(!collapsed));set(fold,'aria-controls',content.id);set(fold,'aria-label',`${email} 메일 목록 ${text}`);
      if(!naver){
        let note=row.querySelector('.be-inbox-next');
        if(!note){note=document.createElement('p');note.className='be-inbox-next';row.append(note);}
        const error=row.querySelector('.accountErrorWrapper');
        const failed=error&&!error.hidden&&Boolean(error.textContent.trim());
        const message=failed?'연결을 확인해 주세요. Gmail 로그인 상태를 확인한 뒤 상단 새로고침을 눌러 주세요.':!row.classList.contains('hasMail')&&!content.querySelector('.mail')?'새 메일이 없어요. 계정 이름을 누르면 Gmail에서 전체 메일을 볼 수 있어요.':'';
        if(note.textContent!==message)note.textContent=message;
        const hide=!message||collapsed;if(note.hidden!==hide)note.hidden=hide;
      }
    }
  }
  const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(enhanceInbox);}});
  observer.observe(inbox,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
  enhanceInbox();
})();
