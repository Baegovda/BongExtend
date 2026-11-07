import {readFileSync} from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import {extractMailOtp, createMailOtpHandler} from "../otp.js";

test("extracts contextual codes including Korean four digits and spaced or alphanumeric codes", () => {
    assert.equal(extractMailOtp("인증 번호 안내", "인증번호는 0123입니다."), "0123");
    assert.equal(extractMailOtp("Your verification code: 654321"), "654321");
    assert.equal(extractMailOtp("Login code", "Login code: 123 456"), "123456");
    assert.equal(extractMailOtp("Confirmation code: A7B-3X9"), "A7B-3X9");
    assert.equal(extractMailOtp("验证码", "验证码：987654"), "987654");
    assert.equal(extractMailOtp("주문 123456 배송 안내", "고객센터 01012345678"), null);
    assert.equal(extractMailOtp("Verification code", "No code included"), null);
});

test("copies and notifies once per message, persists only deduplication IDs, newest code wins", async () => {
    const now = Date.now(); let seen = []; const copied = [], notices = [];
    const handler = createMailOtpHandler({now: () => now, load: async () => ({seen}), save: async value => {seen = value;},
        copy: async code => copied.push(code), notify: async (key, code) => notices.push({key, code})});
    const mail = (id, title, age = 0) => ({id, account: {id: 1}, title, issued: new Date(now - age), getLastMessageText: async () => ""});
    const mails = [mail("new", "인증번호 456789"), mail("old", "인증번호 123456", 1000), mail("normal", "주문번호 987654")];
    assert.deepEqual(await handler(mails), ["1:old", "1:new"]);
    assert.deepEqual(copied, ["123456", "456789"]);
    assert.equal(notices.length, 2);
    await handler(mails);
    assert.equal(copied.length, 2);
    assert.equal(JSON.stringify(seen).includes("123456"), false);
    await handler([mail("stale", "인증번호 111111", 11 * 60_000)]);
    assert.equal(copied.length, 2);
});

test("loads full message content and serializes concurrent polling without duplicate effects", async () => {
    let seen = []; let copies = 0; let fullReads = 0;
    const handler = createMailOtpHandler({load: async () => ({seen}), save: async value => {seen = value;}, copy: async () => {copies++;}, notify: async () => {}});
    const mails = [{id: "body", account: {id: 0}, title: "로그인", issued: new Date(), getThread: async () => {fullReads++; return {getLastMessageText: async () => "로그인 인증번호: 009988"};}}];
    await Promise.all([handler(mails), handler(mails)]);
    assert.equal(copies, 1); assert.equal(fullReads, 1);
});

test("clipboard failure still shows the number and is retried; disabled module does nothing", async () => {
    let copies = 0; let notices = 0;
    const mail = {id: "one", issued: new Date(), title: "인증번호 123456", getLastMessageText: async () => ""};
    const handler = createMailOtpHandler({load: async () => ({}), save: async () => {}, copy: async () => {copies++; throw Error();}, notify: async () => {notices++;}});
    await handler([mail]); await handler([mail]);
    assert.equal(notices, 2); assert.equal(copies, 2);
    const disabled = createMailOtpHandler({load: async () => ({enabled: false})});
    assert.deepEqual(await disabled([mail]), []);
});

test("startup establishes a baseline without copying old mail on a later poll", async () => {
    let seen = []; let copies = 0;
    const handler = createMailOtpHandler({load: async () => ({seen}), save: async value => {seen = value;}, copy: async () => {copies++;}, notify: async () => {}});
    const mails = [{id: "existing", issued: new Date(), title: "인증번호 123456", getLastMessageText: async () => ""}];
    await handler(mails, {baseline: true}); await handler(mails);
    assert.equal(copies, 0);
});

test("offscreen copies only the code with no logging and removes its temporary field", () => {
    const source = readFileSync(new URL("../../../../public/js/off_screen.js", import.meta.url), "utf8");
    let selected = "", removed = false, result;
    const sandbox = {navigator: {userAgent: "Chrome"}, addEventListener() {},
        console: {log() {throw Error("OTP must not be logged");}, error() {}, warn() {}},
        chrome: {runtime: {id: "test", onMessage: {addListener() {}}}},
        document: {body: {appendChild() {}}, createElement() {return {value: "", select() {selected = this.value;}, remove() {removed = true;}};}, execCommand(command) {assert.equal(command, "copy"); return true;}}};
    vm.runInNewContext(source, sandbox);
    sandbox.myOffscreenListener({target: "offscreen", type: "bongextend-copy-otp", data: {code: "001234"}}, {id: "test"}, value => {result = value;});
    assert.equal(selected, "001234"); assert.equal(removed, true); assert.equal(result.ok, true);
    selected = "";
    sandbox.myOffscreenListener({target: "offscreen", type: "bongextend-copy-otp", data: {code: "<script>"}}, {id: "test"}, value => {result = value;});
    assert.equal(selected, ""); assert.equal(result.ok, false);
});
