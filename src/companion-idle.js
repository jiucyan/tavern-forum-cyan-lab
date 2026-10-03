// Idle poses are short-lived presentation state: they never change care, saves or API usage.
export const COMPANION_IDLE_DURATION = 3600;

const poses = Object.freeze({
    frog: ['look', 'listen', 'stretch', 'doze', 'playful'],
    cat: ['look', 'listen', 'groom', 'stretch', 'doze', 'playful'],
    rabbit: ['look', 'listen', 'groom', 'stretch', 'doze', 'playful'],
    fox: ['look', 'listen', 'groom', 'stretch', 'doze', 'playful'],
    penguin: ['look', 'listen', 'groom', 'stretch', 'doze', 'playful'],
    'robo-bird': ['look', 'listen', 'stretch', 'doze', 'playful'],
    octopus: ['look', 'listen', 'stretch', 'doze', 'playful'],
    goldfish: ['look', 'listen', 'stretch', 'doze'],
    soot: ['look', 'listen', 'stretch', 'doze', 'playful'],
});
for (const list of Object.values(poses)) Object.freeze(list);

export function getCompanionIdlePoses(species) {
    return poses[species] || poses.frog;
}

/**
 * Call sync after rendering or changing UI availability. A repeated sync keeps
 * the existing deadline; replacing the pet element starts a fresh quiet pause.
 * cancel interrupts a pose and postpones the next one. play uses the same guards
 * as the scheduler, and is also useful for deterministic animation previews.
 */
export function createCompanionIdleController({ getRoot, getSnapshot, random = Math.random, now = Date.now }) {
    let timer = null, observed = null, activePet = null, lastPose = '', destroyed = false;
    let boundRoot = null, boundDocument = null, motionQuery = null;
    const unitRandom = () => Math.max(0, Math.min(.999999, Number(random()) || 0));
    const delay = initial => initial ? 3000 + unitRandom() * 2000 : 10000 + unitRandom() * 8000;
    const interrupted = () => cancel();
    const released = () => sync();
    const preferenceChanged = () => sync();

    function clearTimer() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    }
    function clearPose() {
        activePet?.removeAttribute('data-idle-pose');
        activePet = null;
    }
    function reset() { clearTimer(); clearPose(); }

    function bind(root) {
        if (root !== boundRoot) {
            boundRoot?.removeEventListener('pointerdown', interrupted, true);
            boundRoot?.removeEventListener('keydown', interrupted, true);
            boundRoot?.removeEventListener('pointerup', released);
            boundRoot?.removeEventListener('pointercancel', released);
            boundRoot = root;
            boundRoot?.addEventListener('pointerdown', interrupted, true);
            boundRoot?.addEventListener('keydown', interrupted, true);
            boundRoot?.addEventListener('pointerup', released);
            boundRoot?.addEventListener('pointercancel', released);
        }
        const nextDocument = root?.ownerDocument || null;
        if (nextDocument === boundDocument) return;
        boundDocument?.removeEventListener('visibilitychange', preferenceChanged);
        if (motionQuery?.removeEventListener) motionQuery.removeEventListener('change', preferenceChanged);
        else motionQuery?.removeListener?.(preferenceChanged);
        boundDocument = nextDocument;
        boundDocument?.addEventListener('visibilitychange', preferenceChanged);
        motionQuery = boundDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
        if (motionQuery?.addEventListener) motionQuery.addEventListener('change', preferenceChanged);
        else motionQuery?.addListener?.(preferenceChanged);
    }

    function read() {
        const root = getRoot();
        const snapshot = getSnapshot() || {};
        return { ...snapshot, root, pet: root?.querySelector('.tf-pet-sprite-control') || null };
    }
    function same(a, b) {
        return a && b && a.root === b.root && a.pet === b.pet && a.identity === b.identity && a.species === b.species;
    }
    function eligible(state) {
        return Boolean(state.enabled && state.root?.isConnected && state.pet?.isConnected
            && boundDocument?.visibilityState !== 'hidden' && !motionQuery?.matches
            && !['away', 'sleep', 'paused', 'daycare'].includes(state.activity));
    }
    function arm(milliseconds, callback) {
        clearTimer();
        const due = now() + milliseconds;
        const tick = () => {
            timer = null;
            if (destroyed) return;
            const remaining = due - now();
            if (remaining > 0) { timer = setTimeout(tick, remaining); return; }
            callback();
        };
        timer = setTimeout(tick, milliseconds);
    }
    function schedule(initial) {
        arm(delay(initial), () => {
            const current = read();
            if (!same(current, observed) || !eligible(current)) { sync(); return; }
            let choices = getCompanionIdlePoses(current.species).filter(pose => pose !== lastPose);
            if (current.activity === 'tired') choices = choices.filter(pose => ['look', 'listen', 'doze'].includes(pose));
            const favored = { dirty: 'groom', nap: 'doze', toy: 'playful', lonely: 'look' }[current.activity];
            if (choices.includes(favored)) choices = [...choices, favored];
            play(choices[Math.floor(unitRandom() * choices.length)]);
        });
    }

    function reconcile() {
        if (destroyed) return false;
        const current = read();
        bind(current.root);
        const changed = !same(current, observed);
        if (changed || !eligible(current)) reset();
        if (changed) lastPose = '';
        observed = current;
        return eligible(current);
    }

    function sync() {
        if (!reconcile()) return false;
        if (timer === null) schedule(true);
        return true;
    }

    function cancel() {
        if (destroyed) return;
        reset();
        const current = read();
        bind(current.root);
        if (!same(current, observed)) lastPose = '';
        observed = current;
        if (eligible(current)) schedule(false);
    }

    function play(pose) {
        if (!reconcile() || !getCompanionIdlePoses(observed.species).includes(pose)) return false;
        reset();
        activePet = observed.pet;
        activePet.setAttribute('data-idle-pose', pose);
        lastPose = pose;
        arm(COMPANION_IDLE_DURATION, () => {
            clearPose();
            const current = read();
            if (!same(current, observed) || !eligible(current)) { sync(); return; }
            schedule(false);
        });
        return true;
    }

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        reset();
        bind(null);
        observed = null;
    }

    return { sync, cancel, play, destroy };
}
