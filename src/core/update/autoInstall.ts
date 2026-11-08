export const INSTALL_STATE_KEY = 'core.update:installState';
export const AUTO_ATTEMPT_KEY = 'core.update:autoAttempt';
export type InstallState = {version: string; phase: 'launching' | 'working' | 'blocked' | 'error' | 'done'; message: string};
export type AutoAttempt = {version: string; at: number; count: number};

export const shouldLaunchUpdater = (options: {
    enabled: boolean; available: boolean; version: string; now: number;
    state?: InstallState; attempt?: AutoAttempt; hasUpdater: boolean;
}): boolean => {
    if (!options.enabled || !options.available || !options.version) return false;
    const state = options.state;
    if (state?.version === options.version && (state.phase === 'blocked' || state.phase === 'done')) return false;
    if (options.hasUpdater && (!state || state.phase === 'working' || state.phase === 'launching')) return false;
    const attempt = options.attempt;
    if (attempt?.version === options.version && (attempt.count >= 3 || options.now - attempt.at < 5 * 60_000)) return false;
    return true;
};

// Both manual and automatic pages share one write lock, across tabs.
export const withInstallLock = async (locks: LockManager, install: () => Promise<void>, busy: () => void): Promise<void> => {
    await locks.request('bongextend-install-write', {ifAvailable: true}, async lock => {
        if (!lock) {busy(); return;}
        await install();
    });
};
