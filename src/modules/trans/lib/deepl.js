import { GeminiError } from './errors.js';

// DeepL API 번역. 무료 키(…:fx)는 api-free, 유료 키는 api 주소를 써요.
export const DEEPL_MODEL = 'deepl';
const BATCH = 50;

const TARGETS = {
  ko: 'KO', en: 'EN-US', ja: 'JA', 'zh-CN': 'ZH-HANS', 'zh-TW': 'ZH-HANT', es: 'ES', fr: 'FR',
  de: 'DE', vi: 'VI', th: 'TH', id: 'ID', ru: 'RU', pt: 'PT-BR',
};

export const DEEPL_MESSAGES = {
  NO_API_KEY: 'DeepL API 키가 없어요. 번역 설정에서 키를 넣어 주세요.',
  INVALID_KEY: 'DeepL API 키가 거부됐어요. 키를 다시 확인해 주세요.',
  QUOTA: 'DeepL 이번 달 글자 한도를 다 썼어요. DeepL 계정에서 사용량을 확인해 주세요.',
  RATE_LIMIT: 'DeepL 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  UNAVAILABLE: 'DeepL 서버 오류예요. 키 문제가 아니에요. 잠시 후 다시 시도해 주세요.',
  NETWORK: 'DeepL에 연결하지 못했어요. 네트워크를 확인하고, 설정에서 DeepL 접근 권한을 허용했는지 확인해 주세요.',
  BAD_RESPONSE: 'DeepL 번역 결과 형식이 올바르지 않아요. 다시 시도해 주세요.',
};

export function deeplHost(key) {
  return /:fx$/i.test(String(key || '').trim()) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

export function deeplTarget(code) {
  return TARGETS[code] || 'KO';
}

function classify(status) {
  if (status === 403 || status === 401) return new GeminiError('INVALID_KEY', DEEPL_MESSAGES.INVALID_KEY, { status });
  if (status === 456) return new GeminiError('QUOTA', DEEPL_MESSAGES.QUOTA, { status });
  if (status === 429 || status === 529) return new GeminiError('RATE_LIMIT', DEEPL_MESSAGES.RATE_LIMIT, { status });
  return new GeminiError('UNAVAILABLE', DEEPL_MESSAGES.UNAVAILABLE, { status });
}

async function request(url, init, deps) {
  const fetchImpl = deps.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 20000);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    throw new GeminiError('NETWORK', DEEPL_MESSAGES.NETWORK);
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateWithDeepl(texts, settings, deps = {}) {
  const key = String(settings?.deeplKey || '').trim();
  if (!key) throw new GeminiError('NO_API_KEY', DEEPL_MESSAGES.NO_API_KEY);
  if (!texts.length) return { translations: [], model: DEEPL_MODEL };
  const url = `${deeplHost(key)}/v2/translate`;
  const out = [];
  for (let start = 0; start < texts.length; start += BATCH) {
    const part = texts.slice(start, start + BATCH);
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `DeepL-Auth-Key ${key}` },
      body: JSON.stringify({ text: part, target_lang: deeplTarget(settings.targetLanguage), preserve_formatting: true }),
    };
    let response = await request(url, init, deps);
    if (response.status === 429 && !deps.noRetry) {
      await new Promise((resolve) => setTimeout(resolve, deps.retryMs ?? 1500));
      response = await request(url, init, deps);
    }
    if (!response.ok) throw classify(response.status);
    let body;
    try { body = await response.json(); } catch { throw new GeminiError('BAD_RESPONSE', DEEPL_MESSAGES.BAD_RESPONSE); }
    const list = body?.translations;
    if (!Array.isArray(list) || list.length !== part.length || list.some((item) => typeof item?.text !== 'string')) {
      throw new GeminiError('BAD_RESPONSE', DEEPL_MESSAGES.BAD_RESPONSE);
    }
    for (const item of list) out.push(item.text);
  }
  return { translations: out, model: DEEPL_MODEL };
}

// 키 확인: 이번 달 사용량을 같이 보여줘요.
export async function checkDeeplKey(apiKey, deps = {}) {
  const key = String(apiKey || '').trim();
  if (!key) return { code: 'NO_API_KEY', message: DEEPL_MESSAGES.NO_API_KEY, models: [], presetAvailability: {}, probe: null };
  let response;
  try {
    response = await request(`${deeplHost(key)}/v2/usage`, { headers: { Authorization: `DeepL-Auth-Key ${key}` } }, deps);
  } catch (error) {
    return { code: error.code || 'NETWORK', message: error.message, models: [], presetAvailability: {}, probe: null };
  }
  if (!response.ok) {
    const error = classify(response.status);
    return { code: error.code, message: error.message, models: [], presetAvailability: {}, probe: null };
  }
  let used = null;
  let limit = null;
  try {
    const body = await response.json();
    used = Number(body?.character_count);
    limit = Number(body?.character_limit);
  } catch { /* 사용량 표시만 빠져요 */ }
  const usage = Number.isFinite(used) && Number.isFinite(limit) && limit > 0
    ? ` 이번 달 ${used.toLocaleString('ko-KR')} / ${limit.toLocaleString('ko-KR')}자 사용했어요.`
    : '';
  return { code: 'VALID', message: `DeepL 키가 정상이에요.${usage}`, models: [], presetAvailability: {}, probe: null };
}
