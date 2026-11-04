// 새 메일 소리. 키가 없으면 부드러운 소리를 켠다. 예전 키는 건드리지 않는다.
// soft, pop 은 우리가 만든 wav. 나머지는 Checker Plus 소리 파일을 이름 그대로 둔다.

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
    bell: "bell",
    bug: "bug",
    cash: "cash",
    chime: "chime",
    ding: "ding",
    electronicdrops: "electronicdrops",
    fallingbeep: "fallingbeep",
    ios: "ios",
    kiss: "kiss",
    ohno: "ohno",
    ohshit: "ohshit",
    pianohappy: "pianohappy",
    scary: "scary",
    tech: "tech",
    "Typewriter Bell": "Typewriter Bell",
    ultranova: "ultranova",
    whoppii: "whoppii",
    yeahaha: "yeahaha",
    youvegotmail: "youvegotmail"
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
