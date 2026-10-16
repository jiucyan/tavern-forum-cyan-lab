export const HOMESTEAD_MOTION_DURATIONS = Object.freeze({ plant: 1400, water: 1600, harvest: 1300, gather: 1200, pack: 1300, cook: 3200, feed: 1500, fish: 1600 });

// The visual wait never owns saved data. Only a still-valid action can commit.
export function createHomesteadMotionController({
    setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now,
    reducedMotion = () => false, onChange = () => {},
} = {}) {
    let pending = null;
    function cancel() {
        if (!pending) return;
        const job = pending;
        pending = null;
        clearTimer(job.timer);
        onChange(null);
        job.resolve({ completed: false, reason: 'cancelled' });
    }
    function run({ action, itemId = '', valid = () => true, commit = () => {} }) {
        if (pending) return Promise.resolve({ completed: false, reason: 'busy' });
        if (!Object.hasOwn(HOMESTEAD_MOTION_DURATIONS, action)) return Promise.reject(new Error('未知的小窝动作'));
        if (!valid()) return Promise.resolve({ completed: false, reason: 'invalid' });
        return new Promise((resolve, reject) => {
            const state = { action, itemId, duration: reducedMotion() ? 120 : HOMESTEAD_MOTION_DURATIONS[action], startedAt: now() };
            const job = { state, resolve, reject, timer: null };
            pending = job;
            onChange(state);
            job.timer = setTimer(() => {
                if (pending !== job) return;
                try {
                    if (!valid()) { cancel(); return; }
                    const result = commit();
                    pending = null;
                    onChange(null);
                    resolve({ completed: true, result });
                } catch (error) {
                    pending = null;
                    onChange(null);
                    reject(error);
                }
            }, state.duration);
        });
    }
    return { run, cancel, get active() { return pending?.state || null; } };
}
