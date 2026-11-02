// 빌드 결과의 자바스크립트에 eval 이나 Function 생성자가 있으면 실패한다.
// MV3 CSP는 unsafe-eval을 막는다. 서비스 워커가 시작하자마자 생성자를 호출하면
// 등록이 Status code 15로 죽는다.

export type UnsafeEvalKind = "eval()" | "new Function" | "Function()";

export type UnsafeEvalHit = {
    kind: UnsafeEvalKind;
    index: number;
    excerpt: string;
};

export type UnsafeEvalViolation = {
    path: string;
    kind: string;
    excerpt: string;
};

const RULES: Array<{kind: UnsafeEvalKind; source: string}> = [
    {kind: "eval()", source: String.raw`\beval\s*\(`},
    {kind: "new Function", source: String.raw`\bnew\s+Function\b`},
    // 번들러가 new를 지우고 Function(...)만 남긴다. Function.call 은 생성자 호출이 아니다.
    {kind: "Function()", source: String.raw`(?<![\w$.])Function\s*\(`}
];

const isScanned = (path: string): boolean => /\.(?:js|mjs|html|htm)$/i.test(path);

export const unsafeEvalHits = (source: string): UnsafeEvalHit[] => {
    const hits: UnsafeEvalHit[] = [];
    for (const rule of RULES) {
        const re = new RegExp(rule.source, "g");
        let match: RegExpExecArray | null;
        while ((match = re.exec(source))) {
            const index = match.index;
            if (rule.kind === "Function()" && /new\s+$/.test(source.slice(Math.max(0, index - 8), index))) continue;
            const excerpt = source.slice(Math.max(0, index - 40), index + match[0].length + 40).replace(/\s+/g, " ");
            hits.push({kind: rule.kind, index, excerpt});
        }
    }
    return hits;
};

export const findUnsafeEvalInFiles = (
    files: ReadonlyMap<string, string> | Readonly<Record<string, string>>
): UnsafeEvalViolation[] => {
    const entries = files instanceof Map ? [...files.entries()] : Object.entries(files);
    const violations: UnsafeEvalViolation[] = [];
    for (const [path, text] of entries) {
        if (!isScanned(path)) continue;
        for (const hit of unsafeEvalHits(text)) {
            violations.push({path, kind: hit.kind, excerpt: hit.excerpt});
        }
    }
    return violations;
};
