// 새 메일 소리. 키가 없으면 부드러운 소리를 켠다. 예전 키는 건드리지 않는다.
// soft, pop 은 우리가 만든 wav. 나머지는 Checker Plus 소리 파일(파일 이름은 그대로, 화면 이름만 한국어).

export const GMAIL_SOUND_KEY = "gmail.sound";
export const CHECKER_PLUS_SOUNDS = [
    "bell", "bug", "cash", "chime", "ding", "electronicdrops", "fallingbeep", "ios", "kiss",
    "ohno", "ohshit", "pianohappy", "scary", "tech", "Typewriter Bell", "ultranova", "whoppii",
    "yeahaha", "youvegotmail"
];
export const SOUND_NAMES = ["soft", "pop", ...CHECKER_PLUS_SOUNDS];
export const SOUND_LABELS = {
    soft: "부드럽게",
    pop: "톡",
    bell: "종",
    bug: "벌레",
    cash: "동전",
    chime: "차임",
    ding: "딩",
    electronicdrops: "전자 물방울",
    fallingbeep: "떨어지는 삐",
    ios: "아이폰",
    kiss: "뽀뽀",
    ohno: "이런!",
    ohshit: "아이쿠",
    pianohappy: "신나는 피아노",
    scary: "무서운 소리",
    tech: "테크",
    "Typewriter Bell": "타자기 종",
    ultranova: "울트라노바",
    whoppii: "우피",
    yeahaha: "예아하",
    youvegotmail: "메일 왔어요"
};

const WAV_NAMES = new Set(["soft", "pop"]);

export const defaultSound = () => ({on: true, name: "soft", volume: 0.4});

export const normalizeSound = (raw) => {
    const volume = Number(raw?.volume);
    return {
        on: raw?.on !== false,
        name: SOUND_NAMES.includes(raw?.name) ? raw.name : "soft",
        volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.4
    };
};

export const soundFile = (name) => {
    const id = SOUND_NAMES.includes(name) ? name : "soft";
    return `/sounds/${id}.${WAV_NAMES.has(id) ? "wav" : "mp3"}`;
};
