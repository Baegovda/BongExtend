export const MAIL_ORIGIN = 'https://mail.naver.com';
export const CONFIG_KEY = 'core.naverMail';
export const STATE_KEY = 'naver.mail.state';
export const UNREAD_KEY = 'core.naverMailUnread';
export function naverId(value) {
  const id = String(value || '').trim().toLowerCase().replace(/@naver\.com$/, '');
  return /^[a-z0-9][a-z0-9_.-]{1,49}$/.test(id) ? id : '';
}
export const mailUrl = id => /^\d+$/.test(String(id)) ? `${MAIL_ORIGIN}/v2/read/0/${id}` : `${MAIL_ORIGIN}/v2/folders/0/all`;
export function parseList(data) {
  if (!Array.isArray(data?.mailData)) throw Error('네이버 메일에 로그인한 뒤 다시 연결해 주세요.');
  const messages = data.mailData.slice(0,30).filter(m => /^\d+$/.test(String(m.mailSN))).map(m => ({
    id:String(m.mailSN), subject:String(m.subject || '(제목 없음)').slice(0,1000),
    sender:String(m.fromName || m.senderName || m.from?.name || m.from?.address || m.fromAddress || (typeof m.from === 'string' ? m.from : '')).slice(0,300),
    snippet:String(m.preview || m.previewText || '').slice(0,1000),
    time:Number(m.receivedTime)*1000 || 0, link:mailUrl(m.mailSN)
  }));
  const count=Number(data.unreadCount ?? data.totalCount ?? data.totalMailCount ?? messages.length);
  return {messages, unread:Math.max(messages.length,Number.isFinite(count)?Math.floor(count):0)};
}
export async function fetchNaverInbox(id, fetchImpl = fetch) {
  if (!naverId(id)) throw Error('네이버 아이디를 확인해 주세요.');
  const response=await fetchImpl(`${MAIL_ORIGIN}/json/list`, {
    method:'POST', credentials:'include', cache:'no-store', redirect:'error', signal:AbortSignal.timeout(15000),
    body:new URLSearchParams({u:naverId(id),folderSN:'0',page:'1',viewMode:'time',previewMode:'1',sortField:'1',sortType:'0',isUnread:'true'})
  });
  if(response.status===429){const error=Error('네이버가 요청을 제한했어요. 잠시 뒤 다시 확인해요.');error.retryAfter=Math.max(60,Math.min(3600,Number(response.headers.get('retry-after'))||60))*1000;throw error;}
  if(!response.ok) throw Error('네이버 메일 연결을 확인해 주세요.');
  let data; try{data=await response.json();}catch{throw Error('네이버 메일에 로그인한 뒤 다시 연결해 주세요.');}
  return parseList(data);
}

// Only the explicitly opened message is requested. Bodies are never put in storage.
export function parseMessage(data, requestedId) {
  if(data?.Result==='FAIL'||data?.result==='FAIL'||data?.error)throw Error('네이버 메일에 로그인한 뒤 다시 시도해 주세요.');
  const item = data?.mailInfo || (Array.isArray(data?.mailData) ? data.mailData[0] : data?.mailData) || data?.message || data;
  if (!item || typeof item !== 'object') throw Error('메일 내용을 확인하지 못했어요. 네이버에서 열어 확인해 주세요.');
  const actual = item.mailSN ?? item.mailId;
  if (actual != null && String(actual) !== String(requestedId)) throw Error('다른 메일이 응답했어요. 목록에서 다시 선택해 주세요.');
  const bodyObject = data?.mailBody;
  const html = [item.body, item.content, item.html, item.mailBody, bodyObject?.body, bodyObject?.content, typeof bodyObject === 'string' ? bodyObject : null, data?.body]
    .find(value => typeof value === 'string');
  if (html == null) throw Error('메일 본문 형식을 확인하지 못했어요. 네이버에서 열어 확인해 주세요.');
  if (html.length > 2_000_000) throw Error('내용이 큰 메일이에요. 네이버에서 열어 확인해 주세요.');
  return {id:String(requestedId),html,plain:item.contentType === 'text/plain' || item.isHtml === false,
    subject:String(item.subject || '').slice(0,1000),sender:String(item.fromName || item.senderName || item.from?.name || '').slice(0,300),
    address:String(item.fromAddress || item.from?.address || '').slice(0,300)};
}
export async function fetchNaverMessage(account, messageId, {fetchImpl = fetch, signal} = {}) {
  if (!naverId(account) || !/^\d{1,30}$/.test(String(messageId))) throw Error('메일 주소를 확인해 주세요.');
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);
  const timer=setTimeout(()=>controller.abort(new DOMException('메일 응답 대기 시간 초과','TimeoutError')),15000);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  try {
  const response = await fetchImpl(`${MAIL_ORIGIN}/json/read`, {method:'POST',credentials:'include',cache:'no-store',redirect:'error',
    signal:controller.signal,
    body:new URLSearchParams({u:naverId(account),mailSN:String(messageId),folderSN:'0'})});
  if (response.status === 429) throw Error('네이버가 요청을 제한했어요. 잠시 뒤 다시 시도해 주세요.');
  if (!response.ok) throw Error('네이버 메일 연결을 확인한 뒤 다시 시도해 주세요.');
  const length = Number(response.headers.get('content-length'));
  if (length > 5_000_000) throw Error('내용이 큰 메일이에요. 네이버에서 열어 확인해 주세요.');
  let data;try {data = await response.json();} catch {if(controller.signal.aborted)throw controller.signal.reason;throw Error('네이버 메일에 로그인한 뒤 다시 시도해 주세요.');}
  return parseMessage(data,messageId);
  } catch(error) {
    if(controller.signal.aborted)throw controller.signal.reason;
    if(error instanceof TypeError)throw Error('네이버 메일과 연결하지 못했어요. 로그인 상태를 확인한 뒤 다시 시도해 주세요.');
    throw error;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
