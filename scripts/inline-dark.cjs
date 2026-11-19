// 브라우저 확인 스크립트용: 다크 모드 모듈을 페이지에 그대로 끼워 넣을 수 있는 한 덩어리 글로 만들어요.
// import 줄과 export 글자를 빼요. contrast.js 는 Rust(WebAssembly) 엔진 파일들을 앞에 붙여야 돌아가요.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const plain = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^import[^\n]*\n/gm, '').replace(/export /g, '');

/** WebAssembly 엔진 + contrast.js + icon-pixels.js (이 순서로 붙여요). */
const contrastSource = () => ['src/modules/dark/icon-pixels-wasm.js', 'src/modules/dark/dark-wasm.js', 'src/modules/dark/contrast.js', 'src/modules/dark/icon-pixels.js'].map(plain).join('\n');

module.exports = {plain, contrastSource};
