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
