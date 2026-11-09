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
})();
