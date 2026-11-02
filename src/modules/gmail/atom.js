// Gmail Atom 피드(로그인 쿠키로 받는 읽지 않은 메일)를 읽는다.

export const decodeXml = (value) => String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => {
        const n = Number(code);
        return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export const stripTags = (value) => decodeXml(value).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const tagText = (block, name) => {
    const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
    return match ? match[1].trim() : "";
};

export const threadFromLink = (link, id) => {
    const hash = String(link || "").split("#")[1] || "";
    const piece = hash.split("/").filter(Boolean).pop() || "";
    if (piece && piece !== "inbox" && piece !== "all") return decodeURIComponent(piece);
    const numeric = String(id || "").match(/:(\d+)\s*$/);
    return numeric ? numeric[1] : "";
};

export const emailFromTitle = (title) => {
    const match = String(title || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : "";
};

export const parseAtom = (xml) => {
    const text = String(xml || "");
    if (!text.includes("<feed")) return null;
    const full = Number((text.match(/<fullcount>\s*(\d+)\s*<\/fullcount>/i) || [])[1] || 0);
    const feedTitle = stripTags(tagText(text.split("<entry>")[0] || text, "title"));
    const messages = [];
    const re = /<entry>([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = re.exec(text))) {
        const block = match[1];
        const link = (block.match(/<link\b[^>]*\bhref="([^"]+)"/i) || [])[1] || "";
        const id = stripTags(tagText(block, "id"));
        messages.push({
            id,
            thread: threadFromLink(link, id),
            subject: stripTags(tagText(block, "title")) || "(제목 없음)",
            snippet: stripTags(tagText(block, "summary")),
            fromName: stripTags(tagText(block, "name")),
            fromEmail: stripTags(tagText(block, "email")),
            issued: stripTags(tagText(block, "issued") || tagText(block, "modified")),
            link
        });
    }
    return {
        unread: Number.isFinite(full) ? full : messages.length,
        email: emailFromTitle(feedTitle),
        messages: messages.filter((item) => item.id)
    };
};
