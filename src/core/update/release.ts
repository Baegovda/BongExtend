import {compareVersions} from "@/core/semver";
import {isTimeoutError, UPDATE_FETCH_TIMEOUT_MS, UPDATE_TIMEOUT_MESSAGE} from "@/core/update/timeout";

export const GITHUB_RELEASE_REPO = "Baegovda/BongExtend";
export const EXTENSION_NAME = "BongExtend";
export const RELEASES_LATEST = `https://api.github.com/repos/${GITHUB_RELEASE_REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${GITHUB_RELEASE_REPO}/releases`;

export type ReleaseZipAsset = {
    name?: string;
    browser_download_url?: string;
    size?: number;
};

export type LatestRelease = {
    upToDate: boolean;
    current: string;
    latest: string;
    htmlUrl: string;
    zipUrl: string;
    assetUrl: string | null;
    assetSize: number | null;
    message: string;
    releaseNotes: string;
};

export const describeUpdate = (currentVersion: string, latest: string | null | undefined): string => {
    if (!latest) return "최신 릴리스 버전을 읽지 못했어요.";

    const compared = compareVersions(latest, currentVersion);
    if (compared === null) return "최신 릴리스 버전을 읽지 못했어요.";
    if (compared <= 0) return `최신 버전이에요. (${currentVersion})`;
    return `${currentVersion} → ${latest} 업데이트 가능`;
};

export const canApplyVersion = (currentVersion: string, nextVersion: string): boolean =>
    compareVersions(nextVersion, currentVersion) === 1;

// 릴리스에 올리는 설치 파일은 크롬 zip뿐이다. *-firefox.zip 은 찾지 않는다.
export const pickReleaseZip = (
    assets: ReleaseZipAsset[] | null | undefined
): ReleaseZipAsset | null => {
    const list = Array.isArray(assets) ? assets : [];
    return list.find((asset) =>
        String(asset?.name ?? "").endsWith("-chrome.zip") && Boolean(asset?.browser_download_url)
    ) ?? null;
};

export const isBongExtendManifest = (text: string): boolean => {
    try {
        return JSON.parse(text)?.name === EXTENSION_NAME;
    } catch {
        return false;
    }
};

type FetchLike = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;

export const checkLatestRelease = async (
    currentVersion: string,
    deps: { fetchImpl?: FetchLike; url?: string } = {}
): Promise<LatestRelease> => {
    const fetchImpl = deps.fetchImpl ?? fetch;
    let response: Awaited<ReturnType<FetchLike>>;
    try {
        response = await fetchImpl(deps.url ?? RELEASES_LATEST, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "BongExtend",
                "X-GitHub-Api-Version": "2022-11-28"
            },
            signal: AbortSignal.timeout(UPDATE_FETCH_TIMEOUT_MS)
        });
    } catch (error) {
        if (isTimeoutError(error)) throw new Error(UPDATE_TIMEOUT_MESSAGE);
        throw error instanceof Error ? error : new Error("업데이트 정보를 가져오지 못했어요.");
    }

    if (!response.ok) {
        const error = new Error(`업데이트 정보를 가져오지 못했어요. (HTTP ${response.status})`);
        throw error;
    }

    const body = await response.json() as {
        tag_name?: string;
        html_url?: string;
        body?: string | null;
        assets?: ReleaseZipAsset[];
    };
    const latest = String(body?.tag_name || "").replace(/^v/i, "");
    const zip = pickReleaseZip(body?.assets);
    const htmlUrl = body?.html_url || RELEASES_PAGE;
    const assetUrl = zip?.browser_download_url || null;
    const compared = compareVersions(latest, currentVersion);

    return {
        upToDate: compared !== null && compared <= 0,
        current: currentVersion,
        latest,
        htmlUrl,
        zipUrl: assetUrl || htmlUrl,
        assetUrl,
        assetSize: typeof zip?.size === "number" && zip.size > 0 ? zip.size : null,
        message: describeUpdate(currentVersion, latest || null),
        releaseNotes: typeof body?.body === "string" ? body.body : ""
    };
};
