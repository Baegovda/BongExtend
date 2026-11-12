import assert from "node:assert/strict";
import test from "node:test";
import {checkDeeplKey, deeplHost, deeplTarget, translateWithDeepl} from "../lib/deepl.js";
import {normalizeSettings, resolveModel} from "../lib/settings.js";

const reply = (status, body) => async () => ({ok: status >= 200 && status < 300, status, json: async () => body});

test("free keys use api-free and pro keys use api", () => {
    assert.equal(deeplHost("abc:fx"), "https://api-free.deepl.com");
    assert.equal(deeplHost("abc"), "https://api.deepl.com");
    assert.equal(deeplTarget("zh-TW"), "ZH-HANT");
    assert.equal(deeplTarget("pt"), "PT-BR");
});

test("deepl provider is stored, normalized and cached under its own model name", () => {
    const s = normalizeSettings({provider: "deepl", deeplKey: " k:fx "});
    assert.equal(s.provider, "deepl");
    assert.equal(s.deeplKey, "k:fx");
    assert.equal(resolveModel(s), "deepl");
    assert.equal(normalizeSettings({provider: "x"}).provider, "gemini");
});

test("translateWithDeepl sends JSON with the auth header and returns texts in order", async () => {
    let seen;
    const fetchImpl = async (url, init) => { seen = {url, init}; return {ok: true, status: 200, json: async () => ({translations: [{text: "가"}, {text: "나"}]})}; };
    const out = await translateWithDeepl(["a", "b"], {deeplKey: "k:fx", targetLanguage: "ko"}, {fetchImpl});
    assert.deepEqual(out, {translations: ["가", "나"], model: "deepl"});
    assert.equal(seen.url, "https://api-free.deepl.com/v2/translate");
    assert.equal(seen.init.headers.Authorization, "DeepL-Auth-Key k:fx");
    assert.deepEqual(JSON.parse(seen.init.body), {text: ["a", "b"], target_lang: "KO", preserve_formatting: true});
});

test("translateWithDeepl splits 120 texts into batches of 50", async () => {
    const sizes = [];
    const fetchImpl = async (_u, init) => { const t = JSON.parse(init.body).text; sizes.push(t.length); return {ok: true, status: 200, json: async () => ({translations: t.map((x) => ({text: x + "!"}))})}; };
    const texts = Array.from({length: 120}, (_, i) => String(i));
    const out = await translateWithDeepl(texts, {deeplKey: "k", targetLanguage: "ko"}, {fetchImpl});
    assert.deepEqual(sizes, [50, 50, 20]);
    assert.equal(out.translations.length, 120);
});

test("deepl errors map to readable codes", async () => {
    const run = (status) => translateWithDeepl(["a"], {deeplKey: "k", targetLanguage: "ko"}, {fetchImpl: reply(status, {}), noRetry: true});
    await assert.rejects(run(403), {code: "INVALID_KEY"});
    await assert.rejects(run(456), {code: "QUOTA"});
    await assert.rejects(run(429), {code: "RATE_LIMIT"});
    await assert.rejects(run(500), {code: "UNAVAILABLE"});
    await assert.rejects(translateWithDeepl(["a"], {deeplKey: "", targetLanguage: "ko"}), {code: "NO_API_KEY"});
    await assert.rejects(translateWithDeepl(["a"], {deeplKey: "k", targetLanguage: "ko"}, {fetchImpl: reply(200, {translations: []})}), {code: "BAD_RESPONSE"});
});

test("key check reports monthly usage", async () => {
    const r = await checkDeeplKey("k:fx", {fetchImpl: reply(200, {character_count: 1500, character_limit: 500000})});
    assert.equal(r.code, "VALID");
    assert.match(r.message, /1,500 \/ 500,000/);
    assert.equal((await checkDeeplKey("k", {fetchImpl: reply(403, {})})).code, "INVALID_KEY");
});
