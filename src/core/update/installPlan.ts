// 디스크에 쓰기 전에 결정하는 순수 로직.
// 크롬은 압축을 푼 확장 폴더가 바뀌면 확장을 다시 불러온다. manifest.json을 먼저 쓰면
// 나머지 파일이 디스크에 남기 전에 페이지가 죽는다. 그래서 세 단계로 쓴다.
// 1) 업데이트 페이지와 그 페이지가 읽는 파일
// 2) 나머지 파일
// 3) manifest.json 하나만, 맨 마지막
import {compareVersions} from "@/core/semver";
import {coreCallBytes, coreCallText, coreWasmState} from "@/modules/core-wasm.js";
import {fileKey, type PendingDecision, type PendingUpdate, type ZipFile} from "@/core/update/types";

export type WriteProgress = {
    done: number;
    total: number;
    skipped: number;
};

const decoder = new TextDecoder();

const textOf = (file: ZipFile): string => decoder.decode(file.data);

export const bytesEqual = (left: Uint8Array | null | undefined, right: Uint8Array | null | undefined): boolean => {
    if (!left || !right || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) return false;
    }
    return true;
};

export const versionLine = (from: string, to: string): string => `${from} → ${to}`;

export const shouldAutoStartInstall = (options: {
    updateAvailable: boolean;
    pending: PendingDecision;
    directoryPermission: "granted" | "prompt" | "denied" | "missing";
}): boolean => options.updateAvailable && options.pending !== "resume" && options.directoryPermission === "granted";

export const pendingDecision = (
    pending: PendingUpdate | null | undefined,
    runningVersion: string
): PendingDecision => {
    if (!pending) return "none";
    if (!pending.version || !Array.isArray(pending.files) || pending.files.length === 0) return "clear";

    const compared = compareVersions(pending.version, runningVersion);
    if (compared === null || compared <= 0) return "clear";
    return "resume";
};

// items를 limit개씩 병렬 처리. 한 묶음 안에서 오류가 나면 그 묶음은 끝까지 기다리고 다음 묶음은 시작하지 않는다.
export const inBatches = async <T>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<void>
): Promise<void> => {
    if (limit < 1) throw new Error("batch limit");

    for (let index = 0; index < items.length; index += limit) {
        const slice = items.slice(index, index + limit);
        await Promise.all(slice.map((item, offset) => fn(item, index + offset)));
    }
};

const isExternal = (value: string): boolean =>
    value.startsWith("#") || value.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(value);

export const normalizeAssetPath = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || isExternal(trimmed)) return null;

    const noQuery = trimmed.split("?")[0]?.split("#")[0] ?? "";
    const out: string[] = [];

    for (const part of noQuery.replace(/\\/g, "/").split("/")) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
            if (!out.length) return null;
            out.pop();
            continue;
        }
        out.push(part);
    }

    return out.length ? out.join("/") : null;
};

export const resolveSpecifier = (fromFile: string, spec: string): string | null => {
    if (!spec.startsWith(".")) return null;

    const base = fromFile.split("/").slice(0, -1);
    const out: string[] = [];

    for (const part of [...base, ...spec.split("/")]) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
            if (!out.length) return null;
            out.pop();
            continue;
        }
        out.push(part);
    }

    return out.length ? out.join("/") : null;
};

const resolveHtmlUrl = (fromHtml: string, raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || isExternal(trimmed)) return null;
    if (trimmed.startsWith("/")) return normalizeAssetPath(trimmed);
    return resolveSpecifier(fromHtml, trimmed.startsWith(".") ? trimmed : `./${trimmed}`);
};

// 세 정규식이 잡는 글자(match[1]) 목록. Rust 판(native/core-wasm/src/refs.rs)이 같은 글자를 파일 바이트에서 바로 찾아요.
export type RefKind = "html" | "css" | "js";
const REF_PATTERNS: Record<RefKind, RegExp> = {
    html: /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi,
    js: /(?:import\s*(?:[^'"\n;]*?\sfrom\s*)?|export\s+[^'"\n;]*?\sfrom\s*|import\s*\(\s*)["']([^"']+)["']/g,
    css: /url\(\s*["']?([^"')]+)["']?\s*\)/gi
};

export const refCapturesJs = (kind: RefKind, text: string): string[] => {
    const pattern = new RegExp(REF_PATTERNS[kind].source, REF_PATTERNS[kind].flags);
    const out: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) out.push(match[1] ?? "");
    return out;
};

const resolveAll = (kind: RefKind, fromFile: string, captures: string[]): string[] => {
    const refs: string[] = [];
    for (const raw of captures) {
        const resolved = kind === "js" ? resolveSpecifier(fromFile, raw) : resolveHtmlUrl(fromFile, raw);
        if (resolved) refs.push(resolved);
    }
    return refs;
};

export const htmlAssetRefs = (fromHtml: string, html: string): string[] => resolveAll("html", fromHtml, refCapturesJs("html", html));

export const jsModuleRefs = (fromFile: string, source: string): string[] => resolveAll("js", fromFile, refCapturesJs("js", source));

export const cssUrlRefs = (fromFile: string, css: string): string[] => resolveAll("css", fromFile, refCapturesJs("css", css));

const kindOf = (key: string): RefKind | null =>
    key.endsWith(".html") ? "html" : key.endsWith(".css") ? "css" : key.endsWith(".js") || key.endsWith(".mjs") ? "js" : null;

// 큰 파일은 Rust 가 바이트에서 바로 잡아요(글자로 바꾸기 + 정규식보다 빨라요). 엔진이 이미 준비된 업데이트 화면에서만 써요.
// 결과가 같은지는 installPlan-rust.test.ts 가 비교해요. UTF-8 이 아닌 파일 등은 Rust 가 예전 길로 보내요.
const REFS_RUST_FROM = 2048;
const refsOf = (key: string, file: ZipFile): string[] => {
    const kind = kindOf(key);
    if (!kind) return [];
    if (file.data.length >= REFS_RUST_FROM && coreWasmState() === "wasm") {
        const fast = coreCallBytes("update.refs", kind, file.data);
        if (fast && "value" in fast) return resolveAll(kind, key, fast.value as string[]);
    }
    return resolveAll(kind, key, refCapturesJs(kind, textOf(file)));
};

// entryHtml에서 따라간 파일. zip에 실제로 있는 것만 포함한다.
export const collectReachable = (files: ZipFile[], entryHtml: string[]): Set<string> => {
    const byKey = new Map(files.map((file) => [fileKey(file), file]));
    const seen = new Set<string>();
    const queue = [...entryHtml];

    while (queue.length) {
        const key = queue.pop();
        if (!key || seen.has(key) || !byKey.has(key)) continue;
        seen.add(key);

        for (const ref of refsOf(key, byKey.get(key)!)) {
            if (byKey.has(ref)) queue.push(ref);
        }
    }

    return seen;
};

// HTML/JS/CSS가 가리키는데 zip에 없는 상대 경로.
export const missingReachable = (files: ZipFile[], entryHtml: string[]): string[] => {
    const byKey = new Map(files.map((file) => [fileKey(file), file]));
    const seen = new Set<string>();
    const missing: string[] = [];
    const queue = [...entryHtml];

    while (queue.length) {
        const key = queue.pop();
        if (!key || seen.has(key) || !byKey.has(key)) continue;
        seen.add(key);

        for (const ref of refsOf(key, byKey.get(key)!)) {
            if (byKey.has(ref)) queue.push(ref);
            else missing.push(ref);
        }
    }

    return missing;
};

export const collectPriorityKeys = (files: ZipFile[]): Set<string> =>
    collectReachable(files, ["update.html"]);

// 정렬은 Rust(native/core-wasm/src/extra.rs order_keys)가 먼저 해요. localeCompare 의 ICU 기본 규칙을 출력 가능한 ASCII 에
// 한해 그대로 옮겼고(문장부호 → 숫자 → 글자, 대소문자는 마지막에 소문자 먼저), 다른 글자가 든 이름은 예전 길로 가요.
// 결과가 같은지는 installPlan-rust.test.ts 가 비교해요. 업데이트 화면은 zip 풀기로 엔진을 이미 준비해 둬서 준비 비용이 없어요.
const ORDER_RUST_FROM = 64;
export const orderFiles = (files: ZipFile[], priority = collectPriorityKeys(files)): ZipFile[] => {
    const rank = (key: string): number => {
        if (key === "manifest.json") return 2;
        if (priority.has(key)) return 0;
        return 1;
    };
    if (files.length >= ORDER_RUST_FROM && coreWasmState() === "wasm") {
        const lines = files.map((file) => {
            const key = fileKey(file);
            return `${rank(key)}\t${key}`;
        });
        const fast = coreCallText("update.order", [lines.join("\n"), String(files.length)]);
        if (fast && "value" in fast) return (fast.value as number[]).map((index) => files[index]!);
    }
    return orderFilesJs(files, priority);
};

export const orderFilesJs = (files: ZipFile[], priority = collectPriorityKeys(files)): ZipFile[] => {
    const rank = (file: ZipFile): number => {
        const key = fileKey(file);
        if (key === "manifest.json") return 2;
        if (priority.has(key)) return 0;
        return 1;
    };

    return [...files].sort((left, right) => rank(left) - rank(right) || fileKey(left).localeCompare(fileKey(right)));
};

class StopWrite extends Error {
    constructor() {
        super("stop");
        this.name = "StopWrite";
    }
}

export const writeChangedFiles = async (options: {
    files: ZipFile[];
    readExisting: (path: string[]) => Promise<Uint8Array | null>;
    writeOne: (file: ZipFile) => Promise<void>;
    batchSize?: number;
    onProgress?: (progress: WriteProgress) => void;
    // 테스트에서 크롬이 그 파일을 쓰는 순간 리로드하는 것처럼, 쓰기 직전에 멈춘다.
    stopBefore?: (file: ZipFile) => boolean;
}): Promise<{ written: string[]; aborted: boolean; skipped: number }> => {
    const priorityKeys = collectPriorityKeys(options.files);
    const changed: ZipFile[] = [];

    for (const file of orderFiles(options.files, priorityKeys)) {
        const existing = await options.readExisting(file.path);
        if (!bytesEqual(existing, file.data)) changed.push(file);
    }

    const isManifest = (file: ZipFile) => fileKey(file) === "manifest.json";
    const priority = changed.filter((file) => priorityKeys.has(fileKey(file)) && !isManifest(file));
    const rest = changed.filter((file) => !priorityKeys.has(fileKey(file)) && !isManifest(file));
    const manifest = changed.filter(isManifest);
    const total = changed.length;
    const skipped = options.files.length - total;
    const written: string[] = [];
    let done = 0;
    let aborted = false;
    const batchSize = options.batchSize ?? 6;
    const report = () => options.onProgress?.({done, total, skipped});
    report();

    const runPhase = async (phase: ZipFile[]) => {
        if (aborted || phase.length === 0) return;

        try {
            await inBatches(phase, batchSize, async (file) => {
                if (options.stopBefore?.(file)) throw new StopWrite();
                await options.writeOne(file);
                written.push(fileKey(file));
                done += 1;
                report();
            });
        } catch (error) {
            if (error instanceof StopWrite) {
                aborted = true;
                return;
            }
            throw error;
        }
    };

    await runPhase(priority);
    await runPhase(rest);
    await runPhase(manifest);
    return {written, aborted, skipped};
};

// pending 저장이 첫 디스크 쓰기보다 먼저다. 전부 쓴 뒤에만 pending을 지운다.
// 중간에 확장이 다시 로드되면 pending이 남아 이어서 완료할 수 있다.
export const installSession = async (options: {
    files: ZipFile[];
    toVersion: string;
    savePending: (pending: PendingUpdate) => Promise<void>;
    clearPending: () => Promise<void>;
    readExisting: (path: string[]) => Promise<Uint8Array | null>;
    writeOne: (file: ZipFile) => Promise<void>;
    batchSize?: number;
    onProgress?: (progress: WriteProgress) => void;
    stopBefore?: (file: ZipFile) => boolean;
}): Promise<{ written: string[]; aborted: boolean; pendingCleared: boolean }> => {
    await options.savePending({version: options.toVersion, files: options.files});
    const result = await writeChangedFiles(options);
    if (result.aborted) return {...result, pendingCleared: false};

    await options.clearPending();
    return {...result, pendingCleared: true};
};
