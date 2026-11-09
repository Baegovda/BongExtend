// An allow-list plus a scriptless sandbox keeps sender HTML away from extension controls/API.
const TAGS = new Set('a b br div em i img p span strong u font strike s blockquote ul ol li table thead tbody tfoot tr td th h1 h2 h3 h4 h5 h6 pre code hr wbr sub sup figure figcaption center dl dt dd'.split(' '));
const DROP = new Set('script style iframe object embed link meta base form input button textarea select template svg math noscript video audio source'.split(' '));
const STYLES = new Set('color background-color background font font-family font-size font-weight font-style line-height text-align text-decoration text-indent white-space word-break overflow-wrap vertical-align display width min-width max-width height min-height max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-width border-style border-color border-top border-bottom border-left border-right border-radius border-collapse border-spacing table-layout list-style-type'.split(' '));
export function safeMailUrl(value, image = false) {
 const raw=String(value||'').trim();
 if(image && /^data:image\/(png|gif|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(raw) && raw.length<=500_000)return raw;
 try {const url=new URL(raw);return ['https:','http:',...(!image?['mailto:']:[])].includes(url.protocol)?url.href:null;}catch{return null;}
}
export function messageDocument(document, message, zoom=80) {
 const parsed=new document.defaultView.DOMParser().parseFromString(message.html,'text/html');
 const clean=document.implementation.createHTMLDocument('메일 본문');
 const copyStyle=(source,target)=>{
  for(let i=0;i<(source.style?.length||0);i++){const name=source.style.item(i),value=source.style.getPropertyValue(name);if(STYLES.has(name)&&value.length<1000&&!/url\s*\(|expression\s*\(|@|behavior|binding|\\/i.test(value))target.style.setProperty(name,value);}
 };
 const walk=(node)=>{
  if(node.nodeType===3)return clean.createTextNode(node.textContent||'');
  if(node.nodeType!==1)return null;
  const tag=node.localName.toLowerCase();if(DROP.has(tag))return null;
  const target=TAGS.has(tag)?clean.createElement(tag):clean.createDocumentFragment();
  if(target.nodeType===1){
   copyStyle(node,target);
   for(const name of ['title','alt'])if(node.hasAttribute(name))target.setAttribute(name,node.getAttribute(name).slice(0,1000));
   for(const name of ['width','height','colspan','rowspan'])if(/^\d{1,4}%?$/.test(node.getAttribute(name)||''))target.setAttribute(name,node.getAttribute(name));
   for(const name of ['color','bgcolor'])if(/^(#[\da-f]{3,8}|[a-z]{1,24})$/i.test(node.getAttribute(name)||''))target.setAttribute(name,node.getAttribute(name));
   if(tag==='font'&&/^[1-7]$/.test(node.getAttribute('size')||''))target.setAttribute('size',node.getAttribute('size'));
   if(tag==='a'){const href=safeMailUrl(node.getAttribute('href'));if(href){target.setAttribute('href',href);target.setAttribute('target','_blank');target.setAttribute('rel','noopener noreferrer');}}
   if(tag==='img'){const src=safeMailUrl(node.getAttribute('src'),true);if(src){target.setAttribute('src',src);target.setAttribute('referrerpolicy','no-referrer');target.setAttribute('loading','lazy');}else target.setAttribute('alt',node.getAttribute('alt')||'이미지');}
  }
  for(const child of node.childNodes){const value=walk(child);if(value)target.append(value);}return target;
 };
 const csp=clean.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; script-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";clean.head.append(csp);
 const style=clean.createElement('style');style.textContent=`html{background:#fff;color:#202124;font:15px/1.6 Arial,sans-serif;color-scheme:light}body{margin:0;padding:16px;zoom:${zoom===100?1:.8};overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{white-space:pre-wrap}a{color:#1a60c0}`;clean.head.append(style);
 if(message.plain){const pre=clean.createElement('pre');pre.textContent=message.html;clean.body.append(pre);}
 else {copyStyle(parsed.body,clean.body);for(const name of ['bgcolor','text']){const value=parsed.body.getAttribute(name);if(value&&/^(#[\da-f]{3,8}|[a-z]{1,24})$/i.test(value))clean.body.style.setProperty(name==='text'?'color':'background-color',value);}for(const child of parsed.body.childNodes){const value=walk(child);if(value)clean.body.append(value);}}
 return '<!doctype html>'+clean.documentElement.outerHTML;
}
