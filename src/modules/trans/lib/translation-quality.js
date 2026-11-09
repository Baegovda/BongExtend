// Deliberately limited to the confirmed Relay prose, not arbitrary Latin words.
// Never remove source substrings: quotes, addresses and brands must survive.
const RELAY_PROSE = [ /\bforwarded\s+from\b/i, /\bemail\s+trackers\s+removed\b/i, /\bmanage\s+this\s+mask\b/i ];
export function isIncompleteTranslation(source, result, language) {
  if (language !== 'ko' || typeof result !== 'string') return false;
  const prose = text => text.replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '');
  const input = prose(source), output = prose(result);
  // Match the forwarding notice or an isolated UI label, not a Korean explanation
  // which deliberately quotes an English button name or an example message.
  const isolatedLabel = /^(?:forwarded\s+from|email\s+trackers\s+removed|manage\s+this\s+mask)$/i.test(input.trim());
  const notice = /(?:^|\s[-–—]\s)forwarded\s+from\b[\s\S]*?\bby\s+Firefox\s+Relay\b/i.test(input.trim());
  if (!isolatedLabel && !notice) return false;
  return RELAY_PROSE.some(phrase => phrase.test(input) && phrase.test(output));
}

export function incompleteTranslationError() {
  const error = new Error('메일 미리보기의 영어 안내가 번역되지 않았어요. 잠시 후 다시 번역해 주세요.');
  error.code = 'INCOMPLETE_TRANSLATION';
  return error;
}
