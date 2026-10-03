// Room movement is temporary presentation state. It does not consume care,
// write saves or call a model, and it uses translate independently of care FX.
const blockedActivities = new Set(['away', 'sleep', 'paused', 'daycare', 'tired']);
const speciesSpeed = Object.freeze({ frog: 22, rabbit: 28, cat: 22, fox: 24, penguin: 16, 'robo-bird': 20, octopus: 17, goldfish: 18, soot: 20 });
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function createCompanionRoamController({
    getRoot, getSnapshot, random = Math.random, now = () => performance.now(),
    onMotionChange = () => {}, requestFrame = globalThis.requestAnimationFrame,
    cancelFrame = globalThis.cancelAnimationFrame,
}) {
    let observed = null, boundRoot = null, boundDocument = null, boundWindow = null, motionQuery = null;
    let timer = null, frame = null, due = null, lastFrame = 0, destroyed = false, walking = false;
    let x = 0, y = 0, destination = null, direction = '', speed = 20, blockedUntil = 0;
    let focused = false, resizeObserver = null, resizeStage = null;
    const pointers = new Set();
    const unitRandom = () => clamp(Number(random()) || 0, 0, .999999);
    const settleDelay = () => 8000 + unitRandom() * 4000;
    const preferenceChanged = () => sync();
    const resized = () => sync();

    function read() {
        const root = getRoot(), snapshot = getSnapshot() || {};
        return { ...snapshot, root, stage: root?.querySelector('.tf-pet-stage') || null, pet: root?.querySelector('.tf-pet-sprite-control') || null };
    }
    function sameRoom(a, b) {
        return Boolean(a && b && a.identity === b.identity && a.species === b.species && a.habitat === b.habitat);
    }
    function eligible(state) {
        return Boolean(state.enabled && state.root?.isConnected && state.pet?.isConnected && state.stage?.isConnected
            && !blockedActivities.has(state.activity) && boundDocument?.visibilityState !== 'hidden'
            && !motionQuery?.matches && typeof requestFrame === 'function' && typeof cancelFrame === 'function');
    }
    function clearTimer() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    }
    function clearFrame() {
        if (frame !== null) cancelFrame?.(frame);
        frame = null;
    }
    function clearPet(pet) {
        pet?.removeAttribute('data-roam-active');
        pet?.removeAttribute('data-roam-state');
        pet?.removeAttribute('data-roam-direction');
        pet?.style?.removeProperty('--tf-roam-x');
        pet?.style?.removeProperty('--tf-roam-y');
    }
    function paint() {
        const pet = observed?.pet;
        if (!pet) return;
        pet.style.setProperty('--tf-roam-x', `${x.toFixed(3)}px`);
        pet.style.setProperty('--tf-roam-y', `${y.toFixed(3)}px`);
        pet.setAttribute('data-roam-active', 'true');
        pet.setAttribute('data-roam-state', walking ? 'walking' : 'resting');
        if (direction) pet.setAttribute('data-roam-direction', direction);
        else pet.removeAttribute('data-roam-direction');
    }
    function setWalking(value) {
        if (walking === value) return;
        walking = value;
        paint();
        onMotionChange(value);
    }
    function stop(reset = false) {
        const active = observed?.pet?.hasAttribute('data-roam-active');
        clearTimer(); clearFrame(); due = null; destination = null;
        setWalking(false);
        if (reset) {
            x = 0; y = 0; direction = '';
            clearPet(observed?.pet);
        } else if (active) paint();
    }
    function bounds() {
        const { stage, pet } = observed || {};
        if (!stage || !pet) return null;
        const width = stage.clientWidth, height = stage.clientHeight;
        const left = pet.offsetLeft, top = pet.offsetTop, petWidth = pet.offsetWidth, petHeight = pet.offsetHeight;
        if (![width, height, left, top, petWidth, petHeight].every(Number.isFinite) || width <= 0 || height <= 0 || petWidth <= 0 || petHeight <= 0) return null;
        const area = { minX: 8 - left, maxX: width - 8 - left - petWidth, minY: Math.max(-13, 8 - top), maxY: Math.min(13, height - 8 - top - petHeight) };
        return area.maxX - area.minX >= 4 && area.maxY >= area.minY ? area : null;
    }
    function constrain(area) {
        x = clamp(x, area.minX, area.maxX); y = clamp(y, area.minY, area.maxY);
        if (destination) {
            destination.x = clamp(destination.x, area.minX, area.maxX);
            destination.y = clamp(destination.y, area.minY, area.maxY);
        }
        paint();
    }
    function waitUntil(deadline) {
        clearTimer(); due = deadline;
        timer = setTimeout(() => {
            timer = null;
            if (destroyed) return;
            if (now() < due) { waitUntil(due); return; }
            sync();
            if (eligible(observed) && !pointers.size && !focused && !walking && due !== null && now() >= due) beginWalk();
        }, Math.max(0, deadline - now()));
    }
    function beginWalk() {
        // Let a complete idle gesture finish before the next walk starts.
        if (observed.pet.hasAttribute('data-idle-pose')) { waitUntil(now() + 500); return; }
        const area = bounds();
        if (!area) { stop(true); return; }
        constrain(area);
        const span = area.maxX - area.minX, distance = span * (.30 + unitRandom() * .45);
        const sign = unitRandom() < .5 ? -1 : 1;
        let targetX = clamp(x + sign * distance, area.minX, area.maxX);
        if (Math.abs(targetX - x) < Math.min(8, span * .10)) targetX = clamp(x - sign * distance, area.minX, area.maxX);
        destination = { x: targetX, y: area.minY + unitRandom() * (area.maxY - area.minY) };
        direction = targetX < x ? 'left' : 'right';
        speed = speciesSpeed[observed.species] || 20;
        due = null; clearTimer(); lastFrame = now();
        setWalking(true); frame = requestFrame(advance);
    }
    function advance() {
        frame = null;
        if (destroyed || !sync() || !walking) return;
        const area = bounds();
        if (!area) { stop(true); return; }
        constrain(area);
        const elapsed = clamp((now() - lastFrame) / 1000, 0, .1);
        lastFrame = now();
        const dx = destination.x - x, dy = destination.y - y, remaining = Math.hypot(dx, dy), step = speed * elapsed;
        if (remaining <= Math.max(step, .01)) {
            x = destination.x; y = destination.y; destination = null;
            // The idle scheduler needs up to five seconds to begin a gesture.
            // Always leave that opportunity, then let the gesture finish below.
            setWalking(false); paint(); waitUntil(now() + 5500 + unitRandom() * 2500);
            return;
        }
        x += dx / remaining * step; y += dy / remaining * step;
        paint(); frame = requestFrame(advance);
    }
    function pointerDown(event) {
        pointers.add(event.pointerId ?? 'pointer');
        blockedUntil = now() + settleDelay(); stop();
    }
    function pointerReleased(event) {
        if (!pointers.delete(event.pointerId ?? 'pointer')) return;
        blockedUntil = now() + settleDelay();
        // Capture runs before the touch handler's hit test and cleanup. Keep
        // the translated button still until that complete event has finished.
        if (!pointers.size && !focused) waitUntil(blockedUntil);
    }
    function keyboardInput() {
        blockedUntil = now() + settleDelay(); stop(); sync();
    }
    function focusIn(event) {
        const pet = observed?.pet;
        if (event.target !== pet && !pet?.contains?.(event.target)) return;
        focused = true; blockedUntil = now() + settleDelay(); stop();
    }
    function focusOut(event) {
        if (!focused) return;
        const pet = observed?.pet;
        if (event.relatedTarget === pet || pet?.contains?.(event.relatedTarget)) return;
        focused = false; blockedUntil = now() + settleDelay(); sync();
    }
    function bind(root) {
        if (root !== boundRoot) {
            for (const [type, listener] of [['pointerdown', pointerDown], ['pointerup', pointerReleased], ['pointercancel', pointerReleased], ['keydown', keyboardInput], ['focusin', focusIn], ['focusout', focusOut]]) {
                boundRoot?.removeEventListener(type, listener, true);
                root?.addEventListener(type, listener, true);
            }
            pointers.clear(); focused = false; boundRoot = root;
        }
        const document = root?.ownerDocument || null;
        if (document !== boundDocument) {
            boundDocument?.removeEventListener('visibilitychange', preferenceChanged);
            boundDocument?.removeEventListener('pointerup', pointerReleased, true);
            boundDocument?.removeEventListener('pointercancel', pointerReleased, true);
            boundWindow?.removeEventListener('resize', resized);
            if (motionQuery?.removeEventListener) motionQuery.removeEventListener('change', preferenceChanged);
            else motionQuery?.removeListener?.(preferenceChanged);
            resizeObserver?.disconnect(); resizeObserver = null; resizeStage = null;
            boundDocument = document; boundWindow = document?.defaultView || null;
            boundDocument?.addEventListener('visibilitychange', preferenceChanged);
            boundDocument?.addEventListener('pointerup', pointerReleased, true);
            boundDocument?.addEventListener('pointercancel', pointerReleased, true);
            boundWindow?.addEventListener('resize', resized);
            motionQuery = boundWindow?.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
            if (motionQuery?.addEventListener) motionQuery.addEventListener('change', preferenceChanged);
            else motionQuery?.addListener?.(preferenceChanged);
            if (boundWindow?.ResizeObserver) resizeObserver = new boundWindow.ResizeObserver(resized);
        }
        const stage = root?.querySelector('.tf-pet-stage') || null;
        if (resizeObserver && stage !== resizeStage) {
            resizeObserver.disconnect(); resizeStage = stage;
            if (stage) resizeObserver.observe(stage);
        }
    }
    function sync() {
        if (destroyed) return false;
        const current = read(); bind(current.root);
        const changed = !sameRoom(current, observed);
        if (changed) { stop(true); blockedUntil = 0; }
        if (observed?.pet !== current.pet) {
            clearPet(observed?.pet);
            focused = Boolean(current.pet && (boundDocument?.activeElement === current.pet || current.pet.contains?.(boundDocument?.activeElement)));
            // A new DOM node inherits the room coordinates without accumulating a render delay.
            if (walking) lastFrame = now();
        }
        observed = current;
        if (!eligible(current)) { stop(!pointers.size); return false; }
        const area = bounds();
        if (!area) { stop(true); return false; }
        constrain(area);
        if (pointers.size || focused) { stop(); return true; }
        if (blockedUntil > now()) {
            if (walking) stop();
            if (due !== blockedUntil || timer === null) waitUntil(blockedUntil);
            return true;
        }
        if (!walking && due === null) waitUntil(now() + 1500 + unitRandom() * 1000);
        return true;
    }
    function cancel({ reset = false } = {}) {
        if (destroyed) return;
        stop(reset); blockedUntil = now() + settleDelay();
        sync();
    }
    function destroy() {
        if (destroyed) return;
        destroyed = true; stop(true); bind(null); observed = null;
    }
    return { sync, cancel, destroy };
}
