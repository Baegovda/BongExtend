// 새 메일 소리. 키가 없으면 부드러운 소리를 켠다. 예전 키는 건드리지 않는다.

export const GMAIL_SOUND_KEY = "gmail.sound";
export const SOUND_NAMES = ["soft", "chime", "pop"];
export const SOUND_LABELS = {soft: "부드럽게", chime: "차임", pop: "톡"};

export const defaultSound = () => ({on: true, name: "soft", volume: 0.4});

export const normalizeSound = (raw) => {
    const volume = Number(raw?.volume);
    return {
        on: raw?.on !== false,
        name: SOUND_NAMES.includes(raw?.name) ? raw.name : "soft",
        volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.4
    };
};

export const soundFile = (name) => `/sounds/${SOUND_NAMES.includes(name) ? name : "soft"}.wav`;
