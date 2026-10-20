import { ROOM_FLOOR_Y, getRoomItemFootprint, getRoomItemDepth, getRoomInteraction } from './companion-room.js';
import { planRoomPath, nearestRoomPoint } from './companion-room-path.js';
import { isAquaticPoint } from './companion-aquatic.js';

// Room movement is temporary presentation state. It does not consume care,
// write saves or call a model, and it uses translate independently of care FX.
const blockedActivities = new Set(['away', 'sleep', 'paused', 'daycare', 'tired']);
const speciesSpeed = Object.freeze({ frog: 22, rabbit: 28, cat: 22, fox: 24, penguin: 16, 'robo-bird': 20, octopus: 17, goldfish: 18, soot: 20 });
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function createCompanionRoamController({
    getRoot, getSnapshot, random = Math.random, now = () => performance.now(),
    onMotionChange = () => {}, onFurnitureInteraction = () => {}, requestFrame = globalThis.requestAnimationFrame,
    cancelFrame = globalThis.cancelAnimationFrame,
}) {
    let observed = null, boundRoot = null, boundDocument = null, boundWindow = null, motionQuery = null;
    let timer = null, frame = null, due = null, lastFrame = 0, destroyed = false, walking = false;
    let x = 0, y = 0, wanderY = 0, destination = null, direction = '', speed = 20, blockedUntil = 0, mode = '';
    let focused = false, resizeObserver = null, resizeStage = null, tap = null;
    let route = [], interaction = null, interactionTimer = null, furnitureHeld = null, holdStamp = null, geometry = '', needsSpawn = false;
    let routeGoal = null, routeOptions = null;
    let lastPaintedPoint = null, lockedAnchor = null;
    let pointArrival = null;
    let pointCancel = null, routeStarted = 0, turnUntil = 0;
    const pointers = new Set();
    const unitRandom = () => clamp(Number(random()) || 0, 0, .999999);
    const settleDelay = () => 8000 + unitRandom() * 4000;
    const preferenceChanged = () => sync();
    const resized = () => sync();

    function read() {
        const root = getRoot(), snapshot = getSnapshot() || {};
        const roomKey = snapshot.habitat === 'custom-room' ? JSON.stringify(snapshot.room || null) : '';
        return { ...snapshot, roomKey, root, stage: root?.querySelector('.tf-pet-stage') || null, pet: root?.querySelector('.tf-pet-sprite-control') || null };
    }
    function sameRoom(a, b) {
        return Boolean(a && b && a.identity === b.identity && a.owner === b.owner && a.species === b.species && a.growthStage === b.growthStage && Boolean(a.aquatic) === Boolean(b.aquatic) && a.habitat === b.habitat && a.roomKey === b.roomKey && a.sceneKey === b.sceneKey);
    }
    function available(state) {
        return Boolean(state.enabled && state.root?.isConnected && state.pet?.isConnected && state.stage?.isConnected
            && !blockedActivities.has(state.activity) && boundDocument?.visibilityState !== 'hidden');
    }
    function canAnimate() {
        return !motionQuery?.matches && typeof requestFrame === 'function' && typeof cancelFrame === 'function';
    }
    function eligible(state) {
        return available(state) && canAnimate();
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
        pet?.removeAttribute('data-roam-mode');
        pet?.removeAttribute('data-roam-phase');
        pet?.removeAttribute('data-room-interacting');
        pet?.removeAttribute('data-room-item-id');
        pet?.removeAttribute('data-room-pose');
        pet?.style?.removeProperty('--tf-roam-x');
        pet?.style?.removeProperty('--tf-roam-y');
    }
    function clearTarget(stage = observed?.stage) {
        stage?.removeAttribute('data-roam-target');
        stage?.style?.removeProperty('--tf-roam-target-x');
        stage?.style?.removeProperty('--tf-roam-target-y');
    }
    function clearStage(stage) {
        stage?.removeAttribute('data-roam-interactive');
        stage?.style?.removeProperty('--tf-room-pet-depth');
        for (const hit of stage?.querySelectorAll?.('.tf-room-live-hit') || []) hit.removeAttribute('data-active');
        clearTarget(stage);
    }
    function foot() {
        const pet = observed?.pet, shadow = pet?.querySelector?.('.tf-pet-character-shadow');
        if (observed?.aquatic) return { x: pet.offsetWidth / 2, y: pet.offsetHeight / 2 };
        return shadow ? { x: shadow.offsetLeft + shadow.offsetWidth / 2, y: shadow.offsetTop + shadow.offsetHeight / 2 }
            : { x: pet.offsetWidth / 2, y: pet.offsetHeight * .88 - 4 };
    }
    function paintTarget() {
        if (mode !== 'manual' || !destination) { clearTarget(); return; }
        const { stage, pet } = observed, anchor = foot();
        stage.setAttribute('data-roam-target', 'true');
        stage.style.setProperty('--tf-roam-target-x', `${(pet.offsetLeft + anchor.x + destination.x).toFixed(3)}px`);
        stage.style.setProperty('--tf-roam-target-y', `${(pet.offsetTop + anchor.y + destination.y).toFixed(3)}px`);
    }
    function paint() {
        const pet = observed?.pet;
        if (!pet) return;
        const point = scenePoint({ x, y });
        if (Number.isFinite(point.x) && Number.isFinite(point.y)) lastPaintedPoint = point;
        pet.style.setProperty('--tf-roam-x', `${x.toFixed(3)}px`);
        pet.style.setProperty('--tf-roam-y', `${y.toFixed(3)}px`);
        pet.setAttribute('data-roam-active', 'true');
        pet.setAttribute('data-roam-state', walking ? 'walking' : 'resting');
        if (!walking) pet.removeAttribute('data-roam-phase');
        if (mode === 'manual' || mode === 'furniture') pet.setAttribute('data-roam-mode', mode);
        else pet.removeAttribute('data-roam-mode');
        if (direction) pet.setAttribute('data-roam-direction', direction);
        else pet.removeAttribute('data-roam-direction');
        const furniture = furnitureHeld || interaction;
        if (furniture) {
            pet.setAttribute('data-room-interacting', 'true');
            pet.setAttribute('data-room-item-id', furniture.itemId);
            if (furnitureHeld || interaction.phase === 'using') pet.setAttribute('data-room-pose', furniture.kind);
            else pet.removeAttribute('data-room-pose');
        } else {
            pet.removeAttribute('data-room-interacting'); pet.removeAttribute('data-room-item-id'); pet.removeAttribute('data-room-pose');
        }
        if (observed.habitat === 'custom-room') {
            let depth = scenePoint({ x, y }).y;
            const active = furnitureHeld || (interaction?.phase === 'using' ? interaction : null);
            if (active) depth = Math.max(depth, getRoomItemDepth(observed.room?.items?.find(item => item.id === active.itemId)) + 2);
            observed.stage.style.setProperty('--tf-room-pet-depth', depth.toFixed(3));
            for (const hit of observed.stage.querySelectorAll?.('.tf-room-live-hit') || []) {
                if (active && hit.getAttribute('data-room-item-id') === active.itemId) hit.setAttribute('data-active', 'true');
                else hit.removeAttribute('data-active');
            }
        }
        else observed.stage.style.removeProperty('--tf-room-pet-depth');
    }
    function setWalking(value) {
        if (walking === value) return;
        walking = value;
        paint();
        onMotionChange(value);
    }
    function stop(reset = false) {
        const cancelledPoint = pointCancel;
        pointArrival = null;
        pointCancel = null;
        const active = observed?.pet?.hasAttribute('data-roam-active');
        const cancelled = interaction;
        if (mode === 'manual' && !reset) wanderY = y;
        clearTimer(); clearFrame(); due = null; destination = null; route = []; routeGoal = null; routeOptions = null; clearTarget();
        clearTimeout(interactionTimer); interactionTimer = null;
        if (interaction) interaction.onArrive = null;
        interaction = null;
        setWalking(false);
        if (reset) {
            x = 0; y = 0; wanderY = 0; direction = ''; mode = ''; furnitureHeld = null; needsSpawn = true;
            lastPaintedPoint = null; lockedAnchor = null;
            clearPet(observed?.pet);
        } else if (active) paint();
        if (cancelled) onFurnitureInteraction({ itemId: cancelled.itemId, kind: cancelled.kind, phase: 'cancelled', automatic: cancelled.automatic });
        cancelledPoint?.();
    }
    function bounds({ allowFurniture = false } = {}) {
        const { stage, pet } = observed || {};
        if (!stage || !pet) return null;
        const width = stage.clientWidth, height = stage.clientHeight;
        const left = pet.offsetLeft, top = pet.offsetTop, petWidth = pet.offsetWidth, petHeight = pet.offsetHeight;
        if (![width, height, left, top, petWidth, petHeight].every(Number.isFinite) || width <= 0 || height <= 0 || petWidth <= 0 || petHeight <= 0) return null;
        if (observed.aquatic) {
            const [minX, maxX, minY, maxY] = observed.aquatic.bounds;
            const min = offsetPoint({ x: minX, y: minY }), max = offsetPoint({ x: maxX, y: maxY });
            // Habitat coordinates constrain the animal centre. Intersect them
            // with its measured drawing/touch footprint when the canvas grows.
            const hitX = Math.max(0, 44 - petWidth) / 2, hitY = Math.max(0, 44 - petHeight) / 2;
            // offset* layout measurements round subpixels; retain one screen
            // pixel so fractional responsive sizes cannot cross the clip edge.
            const edge = 1;
            const area = { minX: Math.max(min.x, hitX + edge - left), maxX: Math.min(max.x, width - edge - left - petWidth - hitX),
                minY: Math.max(min.y, hitY + edge - top), maxY: Math.min(max.y, height - edge - top - petHeight - hitY) };
            return area.maxX >= area.minX && area.maxY >= area.minY ? area : null;
        }
        const area = { minX: 8 - left, maxX: width - 8 - left - petWidth, minY: 8 - top, maxY: height - 8 - top - petHeight };
        // The resident's feet stay on the floor of the 320 × 240 custom room.
        // Keep the complete touch target in bounds while allowing the body above the skirting.
        if (observed.habitat === 'custom-room' && !allowFurniture) area.minY = Math.max(area.minY, height * (ROOM_FLOOR_Y / 240) + 4 - top - foot().y);
        if (Number.isFinite(observed.floorY)) area.minY = Math.max(area.minY, height * (observed.floorY / 240) - top - foot().y);
        return area.maxX >= area.minX && area.maxY >= area.minY ? area : null;
    }
    function constrain(area) {
        x = clamp(x, area.minX, area.maxX); y = clamp(y, area.minY, area.maxY);
        if (destination) {
            destination.x = clamp(destination.x, area.minX, area.maxX);
            destination.y = clamp(destination.y, area.minY, area.maxY);
        }
        for (const point of route) { point.x = clamp(point.x, area.minX, area.maxX); point.y = clamp(point.y, area.minY, area.maxY); }
        paint(); paintTarget();
    }
    function scenePoint(point) {
        const { stage, pet } = observed, anchor = foot();
        return { x: (pet.offsetLeft + anchor.x + point.x) * 320 / stage.clientWidth, y: (pet.offsetTop + anchor.y + point.y) * 240 / stage.clientHeight };
    }
    function offsetPoint(point) {
        const { stage, pet } = observed, anchor = foot();
        return { x: point.x * stage.clientWidth / 320 - pet.offsetLeft - anchor.x, y: point.y * stage.clientHeight / 240 - pet.offsetTop - anchor.y };
    }
    function sceneBounds(area) {
        const min = scenePoint({ x: area.minX, y: area.minY }), max = scenePoint({ x: area.maxX, y: area.maxY });
        return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
    }
    function footprints(ignoreItem = '') {
        return (observed.room?.items || []).filter(item => item.id !== ignoreItem).map(getRoomItemFootprint).filter(Boolean);
    }
    function planTo(target, area, { ignoreItem = '', exact = false } = {}) {
        if (observed.aquatic || observed.habitat !== 'custom-room') return [target];
        const path = planRoomPath(scenePoint({ x, y }), scenePoint(target), sceneBounds(area), footprints(ignoreItem), { clearance: 4, exact });
        return path?.points.map(offsetPoint) || null;
    }
    function beginRoute(target, { area = bounds(), ignoreItem = '', exact = false, fast = false } = {}) {
        if (!area) return false;
        const points = planTo(target, area, { ignoreItem, exact });
        if (!points?.length) return false;
        route = points; destination = route.at(-1);
        routeGoal = scenePoint(destination); routeOptions = { ignoreItem, exact, fast, allowFurniture: Boolean(interaction && interaction.phase !== 'approach') };
        speed = (speciesSpeed[observed.species] || 20) * (fast ? 2 : 1);
        const nextDirection = route[0].x === x ? direction : route[0].x < x ? 'left' : 'right';
        turnUntil = direction && nextDirection !== direction ? now() + 120 : 0;
        direction = nextDirection;
        routeStarted = now() + (turnUntil ? 120 : 0);
        due = null; clearTimer(); clearFrame(); lastFrame = now();
        if (!canAnimate()) { x = destination.x; y = destination.y; route = []; destination = null; paint(); reached(); }
        else { setWalking(true); paintTarget(); frame = requestFrame(advance); }
        return true;
    }
    function rejectFurniture(itemId, kind = '', automatic = false) {
        if (!walking && !interaction) { mode = ''; paint(); }
        if (!automatic) onFurnitureInteraction({ itemId, kind, phase: 'rejected', automatic: false });
        return false;
    }
    function interactWith(itemId, { onArrive, automatic = false } = {}) {
        if (destroyed || pointers.size) return false;
        sync();
        if (!available(observed) || observed.aquatic || observed.locked || furnitureHeld || observed.furnitureHold || observed.habitat !== 'custom-room') return false;
        const item = observed.room?.items?.find(value => value.id === itemId), spec = getRoomInteraction(item);
        if (!spec) return rejectFurniture(itemId, '', automatic);
        stop();
        const area = bounds();
        const target = offsetPoint(spec.approach);
        if (!area) return rejectFurniture(itemId, spec.kind, automatic);
        interaction = { ...spec, phase: 'approach', automatic, onArrive: typeof onArrive === 'function' ? onArrive : null };
        mode = 'furniture'; blockedUntil = 0;
        if (!beginRoute(target, { area, fast: !automatic })) { stop(); return rejectFurniture(itemId, spec.kind, automatic); }
        if (interaction?.phase === 'approach' && destination) interaction.approach = scenePoint(destination);
        paint();
        return true;
    }
    function reached() {
        if (!interaction) {
            const callback = pointArrival;
            const cancelled = pointCancel;
            pointArrival = null;
            pointCancel = null;
            if (mode === 'manual') wanderY = y;
            clearTarget(); setWalking(false); paint(); waitUntil(now() + 5500 + unitRandom() * 2500);
            if (available(read()) && sameRoom(read(), observed)) callback?.();
            else cancelled?.();
            return;
        }
        const current = interaction;
        if (current.phase === 'approach') {
            current.phase = 'anchor';
            const area = bounds({ allowFurniture: true }), target = offsetPoint(current.anchor);
            target.x = clamp(target.x, area.minX, area.maxX); target.y = clamp(target.y, area.minY, area.maxY);
            if (beginRoute(target, { area, ignoreItem: current.itemId, exact: true, fast: !current.automatic })) return;
            stop(); rejectFurniture(current.itemId, current.kind, current.automatic); sync(); return;
        }
        if (current.phase === 'return') {
            interaction = null; mode = ''; wanderY = y;
            setWalking(false); paint();
            onFurnitureInteraction({ itemId: current.itemId, kind: current.kind, phase: 'finished', automatic: current.automatic });
            waitUntil(now() + 5500 + unitRandom() * 2500); return;
        }
        current.phase = 'using'; setWalking(false); paint();
        onFurnitureInteraction({ itemId: current.itemId, kind: current.kind, phase: 'arrived', automatic: current.automatic });
        const callback = current.onArrive; current.onArrive = null;
        if (callback && available(read()) && sameRoom(read(), observed)) callback({ itemId: current.itemId, kind: current.kind });
        if (interaction !== current || !available(read()) || read().furnitureHold) return;
        interactionTimer = setTimeout(() => {
            interactionTimer = null;
            if (interaction !== current || !sync() || !available(observed)) return;
            current.phase = 'return';
            if (!beginRoute(offsetPoint(current.approach), { area: bounds({ allowFurniture: true }), ignoreItem: current.itemId, exact: true })) {
                stop(); sync();
            }
        }, 4500 + unitRandom() * 2000);
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
        if (!observed.aquatic && observed.habitat === 'custom-room' && observed.room?.items?.length && unitRandom() < .22) {
            const choices = observed.room.items.filter(item => ['sofa', 'cushion', 'window', 'toy'].includes(item.type));
            if (choices.length && interactWith(choices[Math.floor(unitRandom() * choices.length)].id, { automatic: true })) return;
        }
        const span = area.maxX - area.minX, distance = span * (.30 + unitRandom() * .45);
        const sign = unitRandom() < .5 ? -1 : 1;
        let targetX = clamp(x + sign * distance, area.minX, area.maxX);
        if (Math.abs(targetX - x) < Math.min(8, span * .10)) targetX = clamp(x - sign * distance, area.minX, area.maxX);
        const minY = clamp(wanderY - 13, area.minY, area.maxY), maxY = clamp(wanderY + 13, area.minY, area.maxY);
        const target = { x: targetX, y: minY + unitRandom() * (maxY - minY) };
        if (targetX !== x) direction = targetX < x ? 'left' : 'right';
        mode = '';
        if (!beginRoute(target, { area })) waitUntil(now() + 5500 + unitRandom() * 2500);
    }
    function advance() {
        frame = null;
        if (destroyed || !sync() || !walking) return;
        const area = bounds({ allowFurniture: Boolean(interaction && interaction.phase !== 'approach') });
        if (!area) { stop(true); return; }
        constrain(area);
        const elapsed = clamp((now() - lastFrame) / 1000, 0, .1);
        lastFrame = now();
        const next = route[0] || destination;
        if (!next) { stop(); sync(); return; }
        const dx = next.x - x, dy = next.y - y, remaining = Math.hypot(dx, dy);
        if (turnUntil > now()) {
            observed.pet.setAttribute('data-roam-phase', 'turn');
            frame = requestFrame(advance); return;
        }
        const acceleration = clamp((now() - routeStarted) / 180, .22, 1);
        const deceleration = clamp(remaining / 13, .24, 1);
        observed.pet.setAttribute('data-roam-phase', acceleration < 1 ? 'start' : deceleration < 1 ? 'arrive' : 'cruise');
        // Integrate the starting ramp instead of sampling its end-of-frame
        // speed. The same elapsed time must move equally far at every FPS.
        const rampTime = seconds => seconds <= 0 ? 0 : seconds < .0396 ? seconds * .22
            : seconds < .18 ? seconds * seconds / .36 + .004356 : seconds - .085644;
        const routeAge = (now() - routeStarted) / 1000;
        let travel = speed * (rampTime(routeAge) - rampTime(routeAge - elapsed));
        let distance = remaining;
        if (distance > 13) {
            const cruise = Math.min(travel, distance - 13);
            distance -= cruise; travel -= cruise;
        }
        if (distance > 3.12 && travel > 0) {
            const easing = Math.min(travel, 13 * Math.log(distance / 3.12));
            distance *= Math.exp(-easing / 13); travel -= easing;
        }
        const step = remaining - Math.max(0, distance - travel * .24);
        if (remaining <= Math.max(step, .01)) {
            x = next.x; y = next.y; route.shift();
            if (route.length) {
                if (route[0].x !== x) direction = route[0].x < x ? 'left' : 'right';
                paint(); frame = requestFrame(advance); return;
            }
            destination = null; routeGoal = null; routeOptions = null; reached();
            return;
        }
        x += dx / remaining * step; y += dy / remaining * step;
        paint(); frame = requestFrame(advance);
    }
    function emptyRoomPoint(state, event) {
        const target = event.target;
        if (state?.locked || !state?.stage?.contains?.(target) || target?.closest?.('button, a, input, textarea, select, summary, label, [data-action], [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"]), [draggable="true"]')) return false;
        const rect = state.stage.getBoundingClientRect?.();
        return Boolean(rect && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
            && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
    }
    function outsidePointerDown(event) {
        if (tap && event.pointerId !== tap.id) tap = null;
    }
    function pointerDown(event) {
        const current = read();
        const candidate = !pointers.size && event.isPrimary !== false && (event.button ?? 0) === 0
            && available(current) && sameRoom(current, observed) && current.stage === observed.stage && emptyRoomPoint(current, event);
        pointers.add(event.pointerId ?? 'pointer');
        blockedUntil = now() + settleDelay(); stop();
        tap = candidate ? { id: event.pointerId ?? 'pointer', room: current, at: now(), x: event.clientX, y: event.clientY, distance: 0 } : null;
    }
    function pointerMove(event) {
        if (!tap || (event.pointerId ?? 'pointer') !== tap.id) return;
        tap.distance += Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
        tap.x = event.clientX; tap.y = event.clientY;
        if (!Number.isFinite(tap.distance) || tap.distance >= 8) tap = null;
    }
    function pointerCancelled(event) {
        tap = null;
        pointerReleased(event);
    }
    function pointerReleased(event) {
        if (!pointers.delete(event.pointerId ?? 'pointer')) return;
        blockedUntil = now() + settleDelay();
        // Capture runs before the touch handler's hit test and cleanup. Keep
        // the translated button still until that complete event has finished.
        if (!pointers.size && !focused) waitUntil(blockedUntil);
        if (tap && !emptyRoomPoint(tap.room, event)) tap = null;
    }
    function roomPointerUp(event) {
        const candidate = tap;
        tap = null;
        if (!candidate || (event.pointerId ?? 'pointer') !== candidate.id || pointers.size || event.isPrimary === false
            || (event.button ?? 0) !== 0 || now() - candidate.at > 650
            || candidate.distance + Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) >= 8) return;
        const current = read();
        if (!sameRoom(candidate.room, current) || candidate.room.stage !== current.stage || !available(current) || !emptyRoomPoint(current, event)) return;
        moveTo({ clientX: event.clientX, clientY: event.clientY });
    }
    function walkToPoint(point, { onArrive, onCancel } = {}) {
        if (destroyed || pointers.size || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return false;
        sync();
        if (!available(observed) || observed.locked || furnitureHeld || observed.furnitureHold) return false;
        if (observed.aquatic && !isAquaticPoint(point, observed.aquatic)) return false;
        if (focused) { observed.pet.blur?.(); focused = false; }
        stop();
        const area = bounds();
        if (!area) return false;
        const requested = offsetPoint(point);
        const target = { x: clamp(requested.x, area.minX, area.maxX), y: clamp(requested.y, area.minY, area.maxY) };
        pointArrival = typeof onArrive === 'function' ? onArrive : null;
        pointCancel = typeof onCancel === 'function' ? onCancel : null;
        mode = 'manual'; blockedUntil = 0;
        if (!beginRoute(target, { area, fast: true })) { pointArrival = null; pointCancel = null; return false; }
        return true;
    }
    function moveTo({ clientX, clientY }) {
        if (destroyed || pointers.size || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        sync();
        if (!available(observed) || observed.locked || furnitureHeld || observed.furnitureHold) return false;
        const area = bounds(), rect = observed.stage.getBoundingClientRect?.();
        if (!area || !rect?.width || !rect?.height) return false;
        if (observed.aquatic && !isAquaticPoint({ x: (clientX - rect.left) * 320 / rect.width, y: (clientY - rect.top) * 240 / rect.height }, observed.aquatic)) return false;
        // Empty floor clicks deliberately release keyboard focus on the pet.
        if (focused) {
            observed.pet.blur?.();
            focused = Boolean(boundDocument?.activeElement === observed.pet || observed.pet.contains?.(boundDocument?.activeElement));
            if (focused) return false;
        }
        stop();
        const anchor = foot();
        const target = {
            x: clamp((clientX - rect.left) * observed.stage.clientWidth / rect.width - observed.pet.offsetLeft - anchor.x, area.minX, area.maxX),
            y: clamp((clientY - rect.top) * observed.stage.clientHeight / rect.height - observed.pet.offsetTop - anchor.y, area.minY, area.maxY),
        };
        mode = 'manual'; blockedUntil = 0; lastFrame = now();
        return beginRoute(target, { area, fast: true });
    }
    function keyboardInput() {
        tap = null;
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
            for (const [type, listener] of [['pointerdown', pointerDown], ['pointerup', pointerReleased], ['pointercancel', pointerCancelled], ['keydown', keyboardInput], ['focusin', focusIn], ['focusout', focusOut]]) {
                boundRoot?.removeEventListener(type, listener, true);
                root?.addEventListener(type, listener, true);
            }
            boundRoot?.removeEventListener('pointerup', roomPointerUp);
            root?.addEventListener('pointerup', roomPointerUp);
            pointers.clear(); focused = false; tap = null; boundRoot = root;
        }
        const document = root?.ownerDocument || null;
        if (document !== boundDocument) {
            boundDocument?.removeEventListener('visibilitychange', preferenceChanged);
            boundDocument?.removeEventListener('pointerup', pointerReleased, true);
            boundDocument?.removeEventListener('pointercancel', pointerCancelled, true);
            boundDocument?.removeEventListener('pointermove', pointerMove, true);
            boundDocument?.removeEventListener('pointerdown', outsidePointerDown, true);
            boundWindow?.removeEventListener('resize', resized);
            if (motionQuery?.removeEventListener) motionQuery.removeEventListener('change', preferenceChanged);
            else motionQuery?.removeListener?.(preferenceChanged);
            resizeObserver?.disconnect(); resizeObserver = null; resizeStage = null;
            boundDocument = document; boundWindow = document?.defaultView || null;
            boundDocument?.addEventListener('visibilitychange', preferenceChanged);
            boundDocument?.addEventListener('pointerup', pointerReleased, true);
            boundDocument?.addEventListener('pointercancel', pointerCancelled, true);
            boundDocument?.addEventListener('pointermove', pointerMove, true);
            boundDocument?.addEventListener('pointerdown', outsidePointerDown, true);
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
        if (changed) { tap = null; stop(true); blockedUntil = 0; geometry = ''; }
        if (observed?.stage !== current.stage) { clearStage(observed?.stage); tap = null; }
        if (observed?.pet !== current.pet) {
            clearPet(observed?.pet);
            focused = Boolean(current.pet && (boundDocument?.activeElement === current.pet || current.pet.contains?.(boundDocument?.activeElement)));
            // A new DOM node inherits the room coordinates without accumulating a render delay.
            if (walking) lastFrame = now();
        }
        observed = current;
        if (!available(current)) { tap = null; clearStage(current.stage); stop(!pointers.size); return false; }
        if (current.locked) {
            // Keep the last rendered scene position, before resized DOM geometry
            // can reinterpret old pixel offsets. A temporary clamp must not replace it.
            lockedAnchor ||= lastPaintedPoint;
            tap = null; stop(); current.stage.removeAttribute('data-roam-interactive');
            const area = bounds();
            if (area) {
                if (lockedAnchor) ({ x, y } = offsetPoint(lockedAnchor));
                constrain(area);
                lockedAnchor ||= lastPaintedPoint;
            }
            return true;
        }
        lockedAnchor = null;
        if (!current.furnitureHold) { furnitureHeld = null; holdStamp = null; }
        else {
            const holdKey = `${current.furnitureHold.itemId}:${current.furnitureHold.kind}`;
            if (!holdStamp || holdStamp.key !== holdKey) holdStamp = { key: holdKey, roomKey: current.roomKey, owner: current.owner, identity: current.identity };
            const item = current.room?.items?.find(value => value.id === current.furnitureHold.itemId), spec = getRoomInteraction(item);
            if (!spec || spec.kind !== current.furnitureHold.kind || current.habitat !== 'custom-room'
                || holdStamp.roomKey !== current.roomKey || holdStamp.owner !== current.owner || holdStamp.identity !== current.identity) {
                furnitureHeld = null; clearStage(current.stage); stop(true); return false;
            }
            stop(); furnitureHeld = spec; mode = 'furniture';
            const holdingArea = bounds({ allowFurniture: true });
            if (!holdingArea) { stop(true); return false; }
            const point = offsetPoint(spec.anchor);
            x = clamp(point.x, holdingArea.minX, holdingArea.maxX); y = clamp(point.y, holdingArea.minY, holdingArea.maxY);
            direction = spec.facing || direction;
            current.stage.removeAttribute('data-roam-interactive'); paint(); return true;
        }
        const area = bounds({ allowFurniture: Boolean(interaction && interaction.phase !== 'approach') });
        if (!area) { tap = null; clearStage(current.stage); stop(true); return false; }
        if ((changed || needsSpawn) && current.aquatic) {
            ({ x, y } = offsetPoint({ x: current.aquatic.spawn[0], y: current.aquatic.spawn[1] })); wanderY = y;
        } else if ((changed || needsSpawn) && current.habitat === 'custom-room') {
            const spawn = nearestRoomPoint(scenePoint({ x, y }), sceneBounds(area), footprints(), 4);
            if (!spawn) { clearStage(current.stage); stop(true); return false; }
            ({ x, y } = offsetPoint(spawn)); wanderY = y;
        }
        needsSpawn = false;
        current.stage.setAttribute('data-roam-interactive', 'true');
        if (!canAnimate()) {
            if (interaction?.phase === 'using') {
                const point = offsetPoint(interaction.anchor);
                x = point.x; y = point.y; constrain(area);
            }
            else if (mode === 'manual' && !walking) { stop(); constrain(area); }
            else if (current.aquatic) { stop(); constrain(area); }
            else stop(true);
            return true;
        }
        constrain(area);
        const currentGeometry = [current.stage.clientWidth, current.stage.clientHeight, current.pet.offsetLeft, current.pet.offsetTop,
            current.pet.offsetWidth, current.pet.offsetHeight, foot().x, foot().y].join(':');
        if (geometry && currentGeometry !== geometry && interaction?.phase === 'using') {
            const point = offsetPoint(interaction.anchor);
            x = clamp(point.x, area.minX, area.maxX); y = clamp(point.y, area.minY, area.maxY); paint();
        }
        if (geometry && currentGeometry !== geometry && walking && routeGoal && current.habitat === 'custom-room') {
            const next = planTo(offsetPoint(routeGoal), area, routeOptions || {});
            if (!next?.length) { stop(); sync(); return false; }
            route = next; destination = route.at(-1); lastFrame = now(); paintTarget();
        }
        geometry = currentGeometry;
        if (pointers.size || focused) { stop(); return true; }
        if (blockedUntil > now()) {
            if (walking) stop();
            if (due !== blockedUntil || timer === null) waitUntil(blockedUntil);
            return true;
        }
        if (!walking && !interaction && due === null) waitUntil(now() + 1500 + unitRandom() * 1000);
        return true;
    }
    function cancel({ reset = false } = {}) {
        if (destroyed) return;
        tap = null;
        stop(reset); lastPaintedPoint = null; lockedAnchor = null; blockedUntil = now() + settleDelay();
        sync();
    }
    function destroy() {
        if (destroyed) return;
        destroyed = true; tap = null; stop(true); clearStage(observed?.stage); bind(null); observed = null;
    }
    return { sync, cancel, destroy, moveTo, interactWith, walkToPoint };
}
