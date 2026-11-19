// 골든 테스트: 메일 인증번호 찾기의 Rust 길(native/core-wasm)이 예전 자바스크립트 정규식과 똑같은 답을 내는지 봐요.
import assert from "node:assert/strict";
import test from "node:test";
import {prepareCoreWasm, coreCallText} from "../../core-wasm.js";
import {extractMailOtpJs, extractMailOtp} from "../otp.js";

const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rand = rng(1120);
const pick = (list) => list[Math.floor(rand() * list.length)];
const pieces = ["인증번호", "인증 코드", "확인번호", "일회용 비밀번호", "보안코드", "Verification Code", "SECURITY  code", "confirmation\ncode", "Login code", "sign-in code", "Sign In Code", "signin code", "one-time password", "One Time Passcode", "passcode", "OTP", "otp", "xotp", "otp_", "验证码", "驗證碼", "認証コード",
  "123456", "482 913", "48\t2913", "1234", "12345678", "123456789", "AB1-C2D", "abc-123", "A1B2C3", "a1b2c3d4", "ABCDEF", "ſ12345", "K12345", "12345K", "1-2-3", "--", " ", "  ", "\t", "\n", " ", "　", "﻿", "\u0085", ":", ".", "번호는", "입니다", "코드", "x", "😀", "가", "_", "0", "인", "확인", "보"];
const text = (n) => Array.from({length: Math.floor(rand() * n)}, () => pick(pieces)).join(pick(["", " ", "", "\n"]));
const filler = "<td>주문 번호 20261120-778899 배송 안내 12345 ABCDEF Lorem ipsum sit amet</td>\n".repeat(400);

test("the Rust engine loads", async () => {
  assert.equal(await prepareCoreWasm(), true);
});

test("Rust answers match the JavaScript rules on random mail text", async () => {
  await prepareCoreWasm();
  let compared = 0, found = 0, fallbacks = 0;
  for (let n = 0; n < 20000; n++) {
    const subject = pick([text(8), "", "[알림] 로그인 안내"]);
    // 문맥 단어 주변만 훑는 최적화가 맞는지 보려고, 긴 채움 글 사이사이에 조각을 넣어요.
    const body = pick([text(30), "", text(6) + " ".repeat(Math.floor(rand() * 90)) + text(6), filler.slice(0, Math.floor(rand() * 3000)) + text(10) + filler.slice(0, Math.floor(rand() * 500)) + text(10)]);
    const expected = extractMailOtpJs(subject, body);
    const reply = coreCallText("gmail.extractOtp", [subject, body]);
    assert.ok(reply, "Rust 길이 준비돼 있어야 해요");
    if ("fallback" in reply) { fallbacks++; continue; }
    compared++;
    if (expected) found++;
    assert.equal(reply.value, expected, `달라요: ${JSON.stringify([subject, body]).slice(0, 400)}`);
  }
  assert.ok(compared > 19000 && found > 2000, `비교 ${compared}, 찾음 ${found}, 예전 길 ${fallbacks}`);
});

test("the public function matches on long, short and odd inputs", async () => {
  await prepareCoreWasm();
  const long = filler.repeat(10);
  const lone = String.fromCharCode(0xd800);
  for (const [subject, body] of [["안내", long + "인증번호는 482913 입니다."], ["안내", long], ["안내", "x".repeat(199_990) + "인증번호 123456"], ["안내", "😀".repeat(100_001)], ["안내", "인증번호 1234 " + lone + " 끝" + long], ["안내", "x".repeat(199_999) + "😀 OTP 1234"], ["안내", filler.slice(0, 1400) + "OTP 4321"], ["인증번호 1111 2222", long], ["Your OTP", long + " 9876"]]) {
    assert.equal(extractMailOtp(subject, body), extractMailOtpJs(subject, body), `${subject} / ${body.length}`);
  }
  for (const odd of [[null, undefined], [0, 5], [undefined, "OTP 1234"], ["", ""], [{}, []]]) {
    assert.equal(extractMailOtp(...odd), extractMailOtpJs(...odd), JSON.stringify(odd));
  }
});
