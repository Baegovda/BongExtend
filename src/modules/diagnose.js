// 화면 진단 도구: 이상해 보이는 요소를 우클릭 → "BongExtend 화면 진단 정보 복사".
// 요소의 색·필터·투명도·배경·그림자와 바깥 상자 몇 단계만 읽어서 클립보드에 넣어요.
// 글자 내용, 입력값, 주소 전체는 담지 않아요. executeScript로 보내는 함수라 바깥 변수를 쓰지 않아요.

export function collectDiagnosis(targetElementId) {
  let el = null;
  try {
    if (targetElementId != null && chrome.contextMenus && chrome.contextMenus.getTargetElement) {
      el = chrome.contextMenus.getTargetElement(targetElementId);
    }
  } catch (error) { el = null; }
  el = el || document.activeElement || document.body;
  const name = (n) => String((n.className && n.className.baseVal) || n.className || "").slice(0, 70);
  const read = (n) => {
    const s = getComputedStyle(n), r = n.getBoundingClientRect();
    return {
      tag: n.tagName, cls: name(n), id: n.id ? String(n.id).slice(0, 40) : "",
      color: s.color, fill: s.fill, bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 110),
      filter: s.filter, op: s.opacity, blend: s.mixBlendMode, vis: s.visibility,
      border: [s.borderTopWidth, s.borderTopStyle, s.borderTopColor].join(" "),
      shadow: s.boxShadow.slice(0, 90), mask: (s.maskImage || s.webkitMaskImage || "").slice(0, 60),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
    };
  };
  const pseudo = (n) => ["::before", "::after"].map((p) => {
    const s = getComputedStyle(n, p);
    if (s.content === "none" || s.content === "normal") return null;
    return {p, filter: s.filter, bg: s.backgroundImage.slice(0, 110), bgColor: s.backgroundColor, op: s.opacity, w: s.width, h: s.height};
  }).filter(Boolean);
  const chain = [];
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 8; n = n.parentElement, i++) {
    const row = read(n);
    if (i < 3) row.pseudo = pseudo(n);
    chain.push(row);
  }
  const kids = [...el.children].slice(0, 6).map(read);
  const text = JSON.stringify({host: location.hostname, scheme: document.documentElement.getAttribute("data-darkreader-scheme") || "", chain, kids});
  let copied = false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    copied = document.execCommand("copy");
    area.remove();
  } catch (error) { copied = false; }
  const toast = document.createElement("div");
  toast.textContent = copied ? "BongExtend: 진단 정보를 복사했어요. 채팅창에 붙여넣기(Ctrl+V) 하세요." : "BongExtend: 복사에 실패했어요. 다시 시도해 주세요.";
  toast.style.cssText = "all:initial;position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:#1f2937;color:#fff;font:600 14px/1.4 'Segoe UI','Malgun Gothic',sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)";
  document.documentElement.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
  return {copied, length: text.length, text};
}
