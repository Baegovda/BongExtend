// .output 정리: 현재 빌드(chrome-mv3, firefox-*)와 현재 버전의 압축 파일만 남기고 나머지(옛 버전 zip, 로그, 임시 폴더)는 지워요.
// 빌드·압축 전에 자동으로 실행돼서 .output 이 계속 쌓이지 않아요.
import {existsSync, readdirSync, readFileSync, rmSync} from "node:fs";
import {join} from "node:path";

const root = ".output";
if (!existsSync(root)) process.exit(0);
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
let removed = 0;
for (const name of readdirSync(root)) {
    const keep = name.startsWith("chrome-mv3") || name.startsWith("firefox-")
        || (name.endsWith(".zip") && name.includes(`-${version}-`));
    if (keep) continue;
    try { rmSync(join(root, name), {recursive: true, force: true}); removed += 1; } catch { /* 열려 있으면 다음에 지워요 */ }
}
if (removed) console.log(`.output 정리: 옛 파일 ${removed}개 삭제 (현재 ${version} 빌드는 유지)`);
