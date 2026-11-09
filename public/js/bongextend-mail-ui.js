// BongExtend's reader presentation; the original mail actions keep their handlers and state.
(() => {
  const labels = {back:'메일함', archive:'보관', delete:'삭제', markAsRead:'읽음', markAsUnread:'안 읽음',prevMail:'이전 메일',nextMail:'다음 메일',openEmailInBrowser:'Gmail에서 열기',openEmailOptions:'더보기',
    'reply-button':'답장', 'reply-all-button':'전체 답장', forward:'전달', send:'보내기'};
  function enhance() {
    const section = document.getElementById('openEmailSection');
    if (!section) return;
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
      const update=()=>{const full=section.dataset.bodyZoom==='100';zoom.textContent=full?'100%':'80%';zoom.title='메일 본문 배율 전환 (80% / 100%)';zoom.setAttribute('aria-label',zoom.title);zoom.setAttribute('aria-pressed',String(full));};
      zoom.addEventListener('click',()=>{section.dataset.bodyZoom=section.dataset.bodyZoom==='100'?'80':'100';update();});update();tools.append(zoom);
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
  if (section) new MutationObserver(enhance).observe(section, {childList:true, subtree:true});
  enhance();
  // Presentation only: native account objects, indexes and mouseup actions stay intact.
  const inbox=document.getElementById('inbox');
  if(!inbox)return;
  const set=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
  let sequence=0,scheduled=false;
  const keyboardControls=new WeakSet();
  function enhanceInbox(){
    scheduled=false;
    for(const row of inbox.querySelectorAll(':scope > .account,:scope > .be-naver-account')){
      const naver=row.classList.contains('be-naver-account');
      const header=row.querySelector(naver?'.be-naver-header':'.accountHeader');if(!header)continue;
      const email=row.getAttribute('email')||row.querySelector(naver?'.be-naver-title strong':'.accountTitle')?.textContent?.trim()||'메일 계정';
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
