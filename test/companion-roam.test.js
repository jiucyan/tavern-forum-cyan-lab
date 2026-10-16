import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanionRoamController } from '../src/companion-roam.js';
import { createCompanionIdleController } from '../src/companion-idle.js';
import { ROOM_FLOOR_Y, normalizeCompanionRoom, getRoomInteraction, getRoomItemFootprint } from '../src/companion-room.js';
import { roomPathObstacles, roomSegmentClear } from '../src/companion-room-path.js';

class Events {
    listeners = new Map();
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type, event = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener(event); }
    count() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}
function pet() {
    const attributes = new Map(), styles = new Map();
    return {
        isConnected: true, offsetLeft: 130, offsetTop: 45, offsetWidth: 160, offsetHeight: 160,
        style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key), getPropertyValue: key => styles.get(key) || '' },
        setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key),
        hasAttribute: key => attributes.has(key), getAttribute: key => attributes.get(key) ?? null,
        contains(node) { return node === this; },
        closest() { return this; },
        querySelector(selector) { return selector === '.tf-pet-character-shadow' ? { offsetLeft: 35, offsetTop: 132, offsetWidth: 90, offsetHeight: 8 } : null; },
    };
}
function setup(t, random = () => .75, { onMotionChange, onFurnitureInteraction, withoutFrames = false } = {}) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
    const motion = Object.assign(new Events(), { matches: false }), window = new Events();
    window.matchMedia = () => motion;
    const document = Object.assign(new Events(), { visibilityState: 'visible', defaultView: window, activeElement: null });
    const stage = Object.assign(pet(), { clientWidth: 420, clientHeight: 230,
        closest() { return null; },
        contains(node) { return node === this || node === root.pet || node?.stage === this; },
        getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; },
    });
    const state = { enabled: true, identity: { untouched: 'saved' }, species: 'cat', habitat: 'meadow', activity: 'idle' };
    const root = Object.assign(new Events(), {
        isConnected: true, ownerDocument: document, pet: pet(), stage,
        querySelector(selector) { return selector === '.tf-pet-stage' ? this.stage : selector === '.tf-pet-sprite-control' ? this.pet : null; },
    });
    root.pet.blur = () => { document.activeElement = null; root.emit('focusout', { target: root.pet, relatedTarget: null }); };
    const frames = new Map(), motions = [];
    let nextFrame = 1;
    const controller = createCompanionRoamController({
        getRoot: () => root, getSnapshot: () => state, random, now: Date.now,
        onMotionChange: moving => { motions.push(moving); onMotionChange?.(moving); },
        onFurnitureInteraction,
        requestFrame: withoutFrames ? undefined : callback => { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelFrame: withoutFrames ? undefined : id => frames.delete(id),
    });
    const tick = ms => t.mock.timers.tick(ms);
    const advance = ms => {
        tick(ms);
        const pending = [...frames.values()]; frames.clear();
        for (const callback of pending) callback(Date.now());
    };
    const position = () => [parseFloat(root.pet.style.getPropertyValue('--tf-roam-x') || '0'), parseFloat(root.pet.style.getPropertyValue('--tf-roam-y') || '0')];
    t.after(() => controller.destroy());
    return { controller, state, root, stage, document, window, motion, frames, motions, tick, advance, position };
}

test('quiet start survives repeated renders and walking alternates with full rest periods', t => {
    const { controller, root, tick, advance, motions } = setup(t);
    assert.equal(controller.sync(), true);
    tick(2000); for (let i = 0; i < 30; i++) controller.sync();
    tick(249); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    tick(1); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
    assert.equal(root.pet.getAttribute('data-roam-direction'), 'right');
    for (let i = 0; i < 120 && root.pet.getAttribute('data-roam-state') === 'walking'; i++) advance(100);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    assert.deepEqual(motions, [true, false]);
    tick(7374); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    tick(1); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
});

test('the gentle start covers the same distance at 30, 60 and 120 frames per second', async t => {
    const results = [];
    for (const fps of [30, 60, 120]) {
        await t.test(`${fps} fps`, child => {
            const { controller, tick, advance, position } = setup(child);
            controller.sync(); tick(2250);
            for (let i = 0; i < fps / 2; i++) advance(500 / (fps / 2));
            results.push(position());
        });
    }
    for (const result of results) {
        assert.ok(Math.hypot(...result) > 9 && Math.hypot(...result) < 10, 'the first half second includes a gentle start below cruise speed');
        assert.ok(Math.abs(result[0] - results[0][0]) < .01);
        assert.ok(Math.abs(result[1] - results[0][1]) < .01);
    }
});

test('movement stays inside the stage and resize clamps the current and destination positions', t => {
    const { controller, root, stage, window, tick, advance, position } = setup(t, () => .999);
    controller.sync(); tick(2500);
    for (let i = 0; i < 150; i++) {
        advance(100);
        const [x, y] = position();
        assert.ok(root.pet.offsetLeft + x >= 8 && root.pet.offsetLeft + x + root.pet.offsetWidth <= stage.clientWidth - 8);
        assert.ok(root.pet.offsetTop + y >= 8 && root.pet.offsetTop + y + root.pet.offsetHeight <= stage.clientHeight - 8);
        assert.ok(y >= -13 && y <= 13);
    }
    stage.clientWidth = 300; root.pet.offsetLeft = 70; window.emit('resize');
    assert.ok(position()[0] <= 62);
    for (let i = 0; i < 30; i++) advance(100);
    assert.ok(position()[0] <= 62);
    stage.clientWidth = 150; root.pet.offsetLeft = -5; window.emit('resize');
    assert.equal(root.pet.hasAttribute('data-roam-active'), false);
    assert.equal(root.pet.getAttribute('data-roam-direction'), null);
    stage.clientWidth = 420; root.pet.offsetLeft = 130; window.emit('resize');
    tick(2498); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    tick(2); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
});

test('pointer capture freezes the hit target through a long touch and release outside the root', t => {
    const { controller, root, state, document, tick, advance, position } = setup(t, () => 0);
    controller.sync(); tick(1500); advance(100);
    assert.equal(root.pet.getAttribute('data-roam-direction'), 'left');
    const frozen = position();
    root.emit('pointerdown', { pointerId: 7 }); state.enabled = false; controller.sync();
    tick(60000); advance(100); assert.deepEqual(position(), frozen);
    document.emit('pointerup', { pointerId: 7 });
    assert.deepEqual(position(), frozen, 'capture release must not recenter before the bubble-phase hit test');
    assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    state.enabled = true; controller.sync();
    tick(7999); assert.deepEqual(position(), frozen);
    tick(1); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
    root.emit('pointerdown', { pointerId: 2 }); root.emit('pointerdown', { pointerId: 3 });
    document.emit('pointercancel', { pointerId: 2 }); tick(12000);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'resting', 'another finger still holds the pet');
    document.emit('pointercancel', { pointerId: 3 }); tick(8000);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
});

test('keyboard focus holds the pet until blur and keyboard input postpones motion', t => {
    const { controller, root, tick, advance, position } = setup(t, () => 0);
    controller.sync(); tick(1500); advance(100);
    root.emit('focusin', { target: root.pet }); const frozen = position();
    tick(20000); controller.sync(); assert.deepEqual(position(), frozen);
    root.emit('keydown'); tick(20000); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    root.emit('focusout', { target: root.pet, relatedTarget: null });
    tick(7999); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    tick(1); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
    root.emit('keydown'); tick(7999); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    tick(1); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
});

test('rerender in the same room keeps position, direction and the remaining quiet deadline', t => {
    const { controller, root, tick, advance, position } = setup(t);
    controller.sync(); tick(2250); advance(100);
    const previous = root.pet, before = position();
    previous.isConnected = false; root.pet = pet(); controller.sync();
    assert.deepEqual(position(), before);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
    assert.equal(previous.hasAttribute('data-roam-active'), false);
    assert.equal(previous.style.getPropertyValue('--tf-roam-x'), '');
    advance(100); assert.ok(position()[0] > before[0]);
    root.emit('keydown'); tick(7000);
    root.pet.isConnected = false; root.pet = pet(); controller.sync();
    tick(3999); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    tick(1); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
});

test('chat, species and habitat changes restart at the center without mutating saved state', t => {
    const { controller, root, state, tick, advance, position } = setup(t, () => 0);
    controller.sync(); tick(1500); advance(100);
    for (const change of [() => { state.identity = { untouched: 'next chat' }; }, () => { state.species = 'rabbit'; }, () => { state.habitat = 'bedroom'; }]) {
        assert.notEqual(position()[0], 0);
        change(); const before = structuredClone(state); controller.sync();
        assert.deepEqual(position(), [0, 0]);
        assert.equal(root.pet.getAttribute('data-roam-direction'), null);
        tick(1499); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
        assert.deepEqual(state, before);
        tick(1); advance(100); assert.deepEqual(state, before);
    }
});

test('away, sleep, tired, paused, daycare and unavailable UI stop and clear movement', t => {
    const { controller, root, state, tick, advance, position } = setup(t, () => 0);
    for (const activity of ['away', 'sleep', 'tired', 'paused', 'daycare']) {
        state.activity = 'idle'; controller.sync(); tick(1500); advance(100);
        state.activity = activity; assert.equal(controller.sync(), false);
        assert.deepEqual(position(), [0, 0]); assert.equal(root.pet.hasAttribute('data-roam-active'), false);
        tick(20000); assert.equal(root.pet.hasAttribute('data-roam-active'), false);
    }
    state.activity = 'idle'; state.enabled = false; assert.equal(controller.sync(), false);
    root.emit('pointerdown'); root.emit('pointercancel');
    assert.equal(root.pet.hasAttribute('data-roam-active'), false);
});

test('hidden documents never catch up and reduced motion is honored immediately', t => {
    const { controller, root, document, motion, tick, advance, position } = setup(t, () => 0);
    controller.sync(); tick(1500); advance(100);
    document.visibilityState = 'hidden'; document.emit('visibilitychange'); tick(60000);
    assert.equal(root.pet.hasAttribute('data-roam-active'), false);
    document.visibilityState = 'visible'; document.emit('visibilitychange');
    tick(1499); assert.deepEqual(position(), [0, 0]);
    tick(1); advance(10); assert.ok(Math.abs(position()[0]) <= .221, 'only the new visible frame advances');
    motion.matches = true; motion.emit('change'); assert.equal(root.pet.hasAttribute('data-roam-active'), false);
    tick(60000); assert.equal(root.pet.hasAttribute('data-roam-active'), false);
    motion.matches = false; motion.emit('change'); tick(1500);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
});

test('an existing idle gesture finishes before walking and motion callbacks allow idle scheduling', t => {
    const { controller, root, tick, advance, motions } = setup(t, () => 0);
    controller.sync(); root.pet.setAttribute('data-idle-pose', 'look'); tick(1500);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'resting'); assert.deepEqual(motions, []);
    tick(3500); assert.equal(root.pet.getAttribute('data-idle-pose'), 'look');
    root.pet.removeAttribute('data-idle-pose'); tick(500);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'walking'); assert.deepEqual(motions, [true]);
    for (let i = 0; i < 120 && root.pet.getAttribute('data-roam-state') === 'walking'; i++) advance(100);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'resting'); assert.deepEqual(motions, [true, false]);
});

test('even the shortest rest gives the slowest natural idle scheduler a complete gesture each cycle', t => {
    let idle;
    const { controller, root, state, advance } = setup(t, () => 0, {
        onMotionChange: moving => { if (moving) idle.cancel(); else idle.sync(); },
    });
    idle = createCompanionIdleController({
        getRoot: () => root,
        getSnapshot: () => ({ ...state, enabled: state.enabled && root.pet.getAttribute('data-roam-state') !== 'walking' }),
        random: () => .999999, now: Date.now,
    });
    t.after(() => idle.destroy());
    controller.sync(); idle.sync();
    let previousWalking = false, previousPose = false, walks = 0, poses = 0, posedSinceWalk = false;
    for (let i = 0; i < 600; i++) {
        advance(100);
        const walking = root.pet.getAttribute('data-roam-state') === 'walking', posing = root.pet.hasAttribute('data-idle-pose');
        assert.equal(walking && posing, false, 'a natural gesture must finish before the next walk');
        if (posing && !previousPose) { poses++; posedSinceWalk = true; }
        if (walking && !previousWalking) {
            if (walks > 0) assert.equal(posedSinceWalk, true, 'walking must not repeatedly starve the pending idle gesture');
            walks++; posedSinceWalk = false;
        }
        previousWalking = walking; previousPose = posing;
    }
    assert.ok(walks >= 3 && poses >= 3, 'both controllers repeat their natural cycle');
});

test('cancel preserves position by default, reset returns to center, and destroy removes all work', t => {
    const { controller, root, document, window, motion, frames, tick, advance, position } = setup(t, () => 0);
    controller.sync(); tick(1500); advance(100); const previous = position();
    controller.cancel(); assert.deepEqual(position(), previous); assert.equal(frames.size, 0);
    controller.cancel({ reset: true }); assert.deepEqual(position(), [0, 0]);
    assert.equal(root.pet.getAttribute('data-roam-direction'), null);
    assert.ok(root.count() > 0 && document.count() > 0 && window.count() > 0 && motion.count() > 0);
    controller.destroy(); controller.destroy(); controller.cancel(); tick(60000);
    assert.equal(controller.sync(), false); assert.equal(frames.size, 0);
    assert.equal(root.count(), 0); assert.equal(document.count(), 0); assert.equal(window.count(), 0); assert.equal(motion.count(), 0);
    assert.equal(root.pet.hasAttribute('data-roam-active'), false);
    assert.equal(root.pet.style.getPropertyValue('--tf-roam-x'), '');
});
function roomGesture(f, point, options = {}) {
    const event = { target: f.stage, pointerId: 1, isPrimary: true, button: 0, clientX: point[0], clientY: point[1], ...options };
    f.document.emit('pointerdown', event); f.root.emit('pointerdown', event);
    return {
        up(overrides = {}) { const release = { ...event, ...overrides }; f.document.emit('pointerup', release); f.root.emit('pointerup', release); },
        cancel() { f.document.emit('pointercancel', event); f.root.emit('pointercancel', event); },
        move(x, y) { f.document.emit('pointermove', { ...event, clientX: x, clientY: y }); },
    };
}

function finishMove(f) {
    for (let i = 0; i < 100 && f.root.pet.getAttribute('data-roam-state') === 'walking'; i++) f.advance(100);
    assert.equal(f.root.pet.getAttribute('data-roam-state'), 'resting');
}

test('a floor tap immediately walks to the shadow anchor and arrival permits shallow roaming there', t => {
    const f = setup(t, () => 0), saved = structuredClone(f.state);
    f.controller.sync();
    assert.equal(f.stage.getAttribute('data-roam-interactive'), 'true');
    const gesture = roomGesture(f, [310, 155]);
    f.document.emit('pointerup', { target: f.stage, pointerId: 1, clientX: 310, clientY: 155 });
    assert.deepEqual(f.position(), [0, 0], 'capture release leaves all touch hit tests frozen');
    gesture.up();
    assert.equal(f.root.pet.getAttribute('data-roam-mode'), 'manual');
    assert.equal(f.root.pet.getAttribute('data-roam-state'), 'walking');
    assert.equal(f.stage.getAttribute('data-roam-target'), 'true');
    assert.equal(f.stage.style.getPropertyValue('--tf-roam-target-x'), '310.000px');
    assert.equal(f.stage.style.getPropertyValue('--tf-roam-target-y'), '155.000px');
    f.advance(100); assert.ok(f.position()[0] > 0 && f.position()[0] < 5, 'manual movement advances at 44 px/s');
    finishMove(f);
    assert.deepEqual(f.position(), [100, -26], 'foot position reaches the command beyond the old 13px limit');
    assert.equal(f.stage.hasAttribute('data-roam-target'), false);
    f.tick(5499); assert.deepEqual(f.position(), [100, -26], 'arrival leaves a full quiet interval');
    f.tick(1); finishMove(f);
    assert.ok(f.position()[1] >= -37 && f.position()[1] <= -13, 'autonomous motion stays near the chosen vertical level');
    assert.deepEqual(f.state, saved, 'commands and autonomous movement do not mutate saved state');
});

test('custom-room wall taps and resizing keep the resident feet on the floor', t => {
    const f = setup(t, () => 0);
    f.state.habitat = 'custom-room';
    f.controller.sync();
    const saved = structuredClone(f.state);
    assert.equal(f.controller.moveTo({ clientX: 210, clientY: 15 }), true);
    const targetY = Number.parseFloat(f.stage.style.getPropertyValue('--tf-roam-target-y'));
    assert.ok(targetY >= f.stage.clientHeight * ROOM_FLOOR_Y / 240 + 4, 'a wall tap resolves to the floor instead of climbing the wall');
    for (let frame = 0; frame < 100; frame++) {
        f.advance(100);
        const shadow = f.root.pet.querySelector('.tf-pet-character-shadow');
        const footY = f.root.pet.offsetTop + shadow.offsetTop + shadow.offsetHeight / 2 + f.position()[1];
        assert.ok(footY >= f.stage.clientHeight * ROOM_FLOOR_Y / 240 + 4, 'manual and idle movement remain on the floor');
    }
    f.stage.clientHeight = 260;
    f.window.emit('resize');
    const shadow = f.root.pet.querySelector('.tf-pet-character-shadow');
    assert.ok(f.root.pet.offsetTop + shadow.offsetTop + shadow.offsetHeight / 2 + f.position()[1] >= 260 * ROOM_FLOOR_Y / 240 + 4);
    assert.deepEqual(f.state, saved, 'floor constraints do not alter the saved companion');
});

test('consecutive taps retarget immediately and use the complete safe button footprint', t => {
    const f = setup(t, () => 0); f.controller.sync();
    roomGesture(f, [400, 5]).up(); f.advance(100);
    assert.equal(f.root.pet.getAttribute('data-roam-direction'), 'right');
    assert.equal(f.stage.style.getPropertyValue('--tf-roam-target-x'), '332.000px');
    assert.equal(f.stage.style.getPropertyValue('--tf-roam-target-y'), '144.000px');
    const before = f.position();
    roomGesture(f, [5, 225]).up();
    assert.deepEqual(f.position(), before, 'retargeting does not teleport');
    assert.equal(f.root.pet.getAttribute('data-roam-direction'), 'left');
    assert.equal(f.stage.style.getPropertyValue('--tf-roam-target-x'), '88.000px');
    assert.equal(f.stage.style.getPropertyValue('--tf-roam-target-y'), '198.000px');
    finishMove(f); assert.deepEqual(f.position(), [-122, 17]);
    assert.equal(f.root.pet.offsetLeft + f.position()[0], 8);
    assert.equal(f.root.pet.offsetTop + f.position()[1] + f.root.pet.offsetHeight, f.stage.clientHeight - 8);
});

test('scaled stage coordinates and focused-pet blur produce a real floor destination', t => {
    const f = setup(t); f.controller.sync();
    f.stage.getBoundingClientRect = () => ({ left: 40, top: 30, right: 880, bottom: 490, width: 840, height: 460 });
    f.document.activeElement = f.root.pet; f.root.emit('focusin', { target: f.root.pet });
    roomGesture(f, [660, 340]).up();
    assert.equal(f.document.activeElement, null, 'floor instructions naturally release pet keyboard focus');
    finishMove(f); assert.deepEqual(f.position(), [100, -26]);
});

test('scrolling, cancellation, long holds, multi-pointer and interactive targets never command movement', t => {
    const f = setup(t); f.controller.sync();
    const rejected = [
        () => { const g = roomGesture(f, [310, 155]); g.move(316, 155); g.move(310, 155); g.up(); },
        () => { const g = roomGesture(f, [310, 155]); g.move(318, 155); g.up(); },
        () => roomGesture(f, [310, 155]).cancel(),
        () => { const g = roomGesture(f, [310, 155]); f.tick(651); g.up(); },
        () => { const g = roomGesture(f, [310, 155]); f.document.emit('pointerdown', { pointerId: 2, target: {} }); g.up(); },
        () => { const g = roomGesture(f, [310, 155]); f.root.emit('pointerdown', { pointerId: 2 }); g.up(); f.document.emit('pointercancel', { pointerId: 2 }); },
        () => roomGesture(f, [310, 155], { button: 2 }).up(),
        () => roomGesture(f, [310, 155], { isPrimary: false }).up(),
        () => roomGesture(f, [210, 155], { target: f.root.pet }).up(),
        () => roomGesture(f, [310, 155], { target: { stage: f.stage, closest: () => ({}) } }).up(),
        () => roomGesture(f, [310, 155]).up({ clientX: 500 }),
    ];
    for (const reject of rejected) {
        reject();
        assert.notEqual(f.root.pet.getAttribute('data-roam-state'), 'walking');
        assert.equal(f.stage.hasAttribute('data-roam-target'), false);
        assert.deepEqual(f.position(), [0, 0]);
    }
    roomGesture(f, [310, 155]).up(); assert.equal(f.root.pet.getAttribute('data-roam-state'), 'walking', 'a valid tap still works after rejected gestures');
});

test('manual destinations follow rerenders and resize but are discarded when room or activity changes', t => {
    const f = setup(t); f.controller.sync(); roomGesture(f, [400, 5]).up(); f.advance(100);
    const previous = f.root.pet, before = f.position(); previous.isConnected = false; f.root.pet = pet(); f.controller.sync();
    assert.deepEqual(f.position(), before); assert.equal(f.root.pet.getAttribute('data-roam-mode'), 'manual');
    f.stage.clientWidth = 300; f.root.pet.offsetLeft = 70; f.window.emit('resize'); finishMove(f);
    assert.deepEqual(f.position(), [62, -37]);
    for (const activity of ['away', 'sleep', 'tired', 'paused', 'daycare']) {
        f.state.activity = 'idle'; f.controller.sync(); roomGesture(f, [5, 225]).up();
        f.state.activity = activity; f.controller.sync();
        assert.equal(f.stage.hasAttribute('data-roam-target'), false); assert.equal(f.stage.hasAttribute('data-roam-interactive'), false);
        assert.equal(f.controller.moveTo({ clientX: 310, clientY: 155 }), false); assert.deepEqual(f.position(), [0, 0]);
    }
    f.state.activity = 'idle'; f.controller.sync(); const g = roomGesture(f, [5, 225]);
    f.state.identity = {}; f.controller.sync(); g.up();
    assert.notEqual(f.root.pet.getAttribute('data-roam-state'), 'walking', 'a gesture from another chat is discarded');
    roomGesture(f, [5, 225]).up(); f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange');
    assert.equal(f.stage.hasAttribute('data-roam-target'), false); assert.deepEqual(f.position(), [0, 0]);
    f.controller.destroy(); assert.equal(f.stage.hasAttribute('data-roam-interactive'), false);
});

test('reduced motion and missing animation frames allow explicit static placement without autonomous work', async t => {
    for (const withoutFrames of [false, true]) await t.test(withoutFrames ? 'no animation runtime' : 'reduced motion', child => {
        const f = setup(child, () => 0, { withoutFrames });
        if (!withoutFrames) f.motion.matches = true;
        f.controller.sync(); roomGesture(f, [310, 155]).up();
        assert.deepEqual(f.position(), [100, -26]); assert.equal(f.root.pet.getAttribute('data-roam-mode'), 'manual');
        assert.equal(f.root.pet.getAttribute('data-roam-state'), 'resting'); assert.equal(f.stage.hasAttribute('data-roam-target'), false);
        f.tick(60000); f.controller.sync(); assert.deepEqual(f.position(), [100, -26]); assert.equal(f.frames.size, 0);
        f.state.enabled = false; f.controller.sync(); assert.deepEqual(f.position(), [0, 0]);
    });
});

function customRoom(f, items = []) {
    f.stage.clientWidth = 320; f.stage.clientHeight = 240;
    Object.assign(f.root.pet, { offsetLeft: 116, offsetTop: 144, offsetWidth: 88, offsetHeight: 86 });
    f.root.pet.querySelector = selector => selector === '.tf-pet-character-shadow'
        ? { offsetLeft: 16, offsetTop: 68, offsetWidth: 56, offsetHeight: 6 } : null;
    f.state.habitat = 'custom-room'; f.state.owner = {};
    f.state.room = normalizeCompanionRoom({ enabled: true, items });
}
function roomFoot(f) {
    const shadow = f.root.pet.querySelector('.tf-pet-character-shadow'), [x, y] = f.position();
    return { x: (f.root.pet.offsetLeft + shadow.offsetLeft + shadow.offsetWidth / 2 + x) * 320 / f.stage.clientWidth,
        y: (f.root.pet.offsetTop + shadow.offsetTop + shadow.offsetHeight / 2 + y) * 240 / f.stage.clientHeight };
}

test('custom-room commands route continuously around furniture and respect rotated contact footprints', t => {
    const f = setup(t);
    customRoom(f, [{ id: 'desk', type: 'table', x: 190, y: 180, rotation: 1 }]);
    f.controller.sync(); const saved = structuredClone(f.state), obstacles = roomPathObstacles(f.state.room.items.map(getRoomItemFootprint).filter(Boolean), 4);
    assert.equal(f.controller.moveTo({ clientX: 260, clientY: 155 }), true);
    let previous = roomFoot(f), bent = false;
    for (let index = 0; index < 120 && f.root.pet.getAttribute('data-roam-state') === 'walking'; index++) {
        f.advance(100); const point = roomFoot(f);
        assert.ok(roomSegmentClear(previous, point, obstacles), 'a visible animation frame may not cross furniture');
        if (point.y > 210 && point.x > 190) bent = true;
        previous = point;
    }
    assert.equal(f.root.pet.getAttribute('data-roam-state'), 'resting');
    assert.ok(bent, 'the pet goes around the rotated table before turning toward its destination');
    assert.ok(Math.hypot(roomFoot(f).x - 260, roomFoot(f).y - 155) < .01);
    assert.deepEqual(f.state, saved, 'routing changes neither furniture nor care data');
});

test('furniture arrival happens once at its anchor, holds a pose, then returns to walkable floor', t => {
    const events = [], arrivals = [], f = setup(t, () => .75, { onFurnitureInteraction: event => events.push(event) });
    customRoom(f, [{ id: 'seat', type: 'sofa', x: 92, y: 160, rotation: 0 }]);
    f.controller.sync(); const saved = structuredClone(f.state), spec = getRoomInteraction(f.state.room.items[0]);
    assert.equal(f.controller.interactWith('seat', { onArrive: result => arrivals.push(result) }), true);
    finishMove(f);
    assert.equal(arrivals.length, 1); assert.deepEqual(arrivals[0], { itemId: 'seat', kind: 'sit' });
    assert.equal(f.root.pet.getAttribute('data-room-pose'), 'sit');
    assert.equal(f.root.pet.getAttribute('data-room-item-id'), 'seat');
    assert.ok(Math.hypot(roomFoot(f).x - spec.anchor.x, roomFoot(f).y - spec.anchor.y) < .01);
    const previous = roomFoot(f); f.tick(5000); assert.deepEqual(roomFoot(f), previous, 'the pet remains seated during its quiet interval');
    f.tick(1000); finishMove(f);
    assert.equal(f.root.pet.hasAttribute('data-room-interacting'), false);
    assert.equal(arrivals.length, 1); assert.equal(events.filter(event => event.phase === 'finished').length, 1);
    assert.ok(roomFoot(f).y >= ROOM_FLOOR_Y);
    assert.deepEqual(f.state, saved);
});

test('room layout, owner and care changes cancel pending furniture callbacks; life ticks and rerenders preserve them', t => {
    const f = setup(t), arrivals = [];
    customRoom(f, [{ id: 'seat', type: 'sofa', x: 92, y: 160, rotation: 0 }]);
    f.controller.sync();
    assert.equal(f.controller.interactWith('seat', { onArrive: value => arrivals.push(value) }), true);
    f.advance(100);
    f.state.lifeTick = 1; f.controller.sync();
    const previous = f.root.pet; previous.isConnected = false;
    f.root.pet = { ...previous, isConnected: true }; f.controller.sync();
    finishMove(f); assert.equal(arrivals.length, 1, 'same companion and layout retain the command across a harmless rerender');
    for (const change of [
        () => { f.state.room.items[0].rotation = 1; },
        () => { f.state.owner = {}; },
        () => { f.state.identity = {}; },
        () => { f.state.activity = 'sleep'; },
        () => { f.state.enabled = false; },
        () => { f.root.emit('pointerdown', { pointerId: 9, target: f.root.pet }); f.document.emit('pointerup', { pointerId: 9, target: f.root.pet }); },
    ]) {
        f.state.activity = 'idle'; f.state.enabled = true; f.state.room.items[0].rotation = 0;
        f.controller.cancel({ reset: true }); f.controller.sync();
        const count = arrivals.length;
        assert.equal(f.controller.interactWith('seat', { onArrive: value => arrivals.push(value) }), true);
        f.advance(100); change(); f.controller.sync();
        for (let index = 0; index < 120; index++) f.advance(100);
        assert.equal(arrivals.length, count, 'an invalidated command cannot deliver late care');
    }
});

test('explicit furniture holds preserve bed/feed anchors through rerender and resize and refuse floor commands', t => {
    const f = setup(t), events = [];
    customRoom(f, [{ id: 'bed', type: 'bed', x: 92, y: 160, rotation: 0 }]);
    f.state.activity = 'room-care'; f.state.furnitureHold = { itemId: 'bed', kind: 'rest' };
    f.controller.sync();
    const before = roomFoot(f);
    assert.equal(f.root.pet.getAttribute('data-room-pose'), 'rest');
    assert.equal(f.controller.moveTo({ clientX: 280, clientY: 200 }), false);
    assert.equal(f.controller.interactWith('bed', { onArrive: value => events.push(value) }), false);
    f.tick(60000);
    for (let index = 0; index < 20; index++) {
        f.state.furnitureHold = { itemId: 'bed', kind: 'rest' }; f.controller.sync();
        assert.deepEqual(roomFoot(f), before, 'a freshly constructed snapshot hold must not move or replay arrival');
    }
    assert.equal(f.frames.size, 0);
    f.stage.clientWidth = 390; f.stage.clientHeight = 292.5; f.window.emit('resize');
    assert.ok(Math.hypot(roomFoot(f).x - before.x, roomFoot(f).y - before.y) < .01, 'a resized room keeps scene-relative furniture placement');
    f.state.enabled = false; f.controller.sync();
    assert.equal(f.root.pet.hasAttribute('data-room-pose'), false); assert.deepEqual(events, []);
});

test('an overcrowded room rejects furniture commands and never teleports through a cabinet wall', t => {
    const events = [], f = setup(t, () => .75, { onFurnitureInteraction: value => events.push(value) });
    customRoom(f, [{ id: 'ball', type: 'toy', x: 265, y: 160, rotation: 0 },
        ...[120, 154, 188, 220].map((y, index) => ({ id: `wall-${index}`, type: 'bookshelf', x: 215, y, rotation: 1 }))]);
    f.controller.sync(); const before = f.position();
    assert.equal(f.controller.interactWith('ball'), false);
    assert.equal(events.at(-1)?.phase, 'rejected');
    assert.deepEqual(f.position(), before); assert.equal(f.frames.size, 0);
});

test('automatic room use chooses only harmless furniture and never applies a care callback', t => {
    const events = [], f = setup(t, () => 0, { onFurnitureInteraction: value => events.push(value) });
    customRoom(f, [{ id: 'seat', type: 'sofa', x: 92, y: 160, rotation: 0 },
        { id: 'bowl', type: 'food-bowl', x: 267, y: 145, rotation: 0 }, { id: 'bed', type: 'bed', x: 265, y: 192, rotation: 0 }]);
    f.controller.sync(); const saved = structuredClone(f.state);
    f.tick(1500); finishMove(f);
    assert.equal(events.at(-1)?.itemId, 'seat'); assert.equal(events.at(-1)?.automatic, true);
    assert.equal(f.root.pet.getAttribute('data-room-pose'), 'sit');
    assert.deepEqual(f.state, saved, 'spontaneous relaxation never eats or starts real sleeping');
});

test('reduced-motion furniture commands place a static pose and resize preserves its scene anchor', t => {
    const f = setup(t), arrivals = [];
    customRoom(f, [{ id: 'seat', type: 'sofa', x: 92, y: 160, rotation: 0 }]);
    f.motion.matches = true; f.controller.sync();
    assert.equal(f.controller.interactWith('seat', { onArrive: value => arrivals.push(value) }), true);
    assert.equal(arrivals.length, 1); assert.equal(f.frames.size, 0);
    assert.equal(f.root.pet.getAttribute('data-room-pose'), 'sit');
    const anchor = roomFoot(f);
    f.stage.clientWidth = 390; f.stage.clientHeight = 292.5; f.window.emit('resize');
    assert.ok(Math.hypot(roomFoot(f).x - anchor.x, roomFoot(f).y - anchor.y) < .01);
    assert.equal(f.root.pet.getAttribute('data-room-pose'), 'sit');
    f.tick(3000); f.controller.sync(); assert.equal(arrivals.length, 1); assert.equal(f.frames.size, 0);
    f.state.enabled = false; f.controller.sync(); f.tick(30000);
    assert.equal(f.root.pet.hasAttribute('data-room-pose'), false); assert.equal(arrivals.length, 1);
});

test('held furniture rejects stale layouts and allows a fresh hold after the previous care ends', t => {
    const f = setup(t);
    customRoom(f, [{ id: 'bed', type: 'bed', x: 92, y: 160, rotation: 0 }]);
    f.state.activity = 'room-care'; f.state.furnitureHold = { itemId: 'bed', kind: 'rest' };
    f.controller.sync();
    f.state.room.items[0].rotation = 1; f.state.furnitureHold = { itemId: 'bed', kind: 'rest' }; f.controller.sync();
    assert.equal(f.root.pet.hasAttribute('data-room-pose'), false, 'a draft/layout change cannot keep an old bed interaction');
    f.state.furnitureHold = null; f.controller.sync();
    f.state.room.items[0].rotation = 0; f.state.furnitureHold = { itemId: 'bed', kind: 'rest' };
    f.controller.sync();
    assert.equal(f.root.pet.getAttribute('data-room-pose'), 'rest', 'a newly authorized care operation can use the edited room');
});

test('arrival may begin real room care without clearing the new hold or repeating its callback', t => {
    const f = setup(t), arrivals = [];
    customRoom(f, [{ id: 'bed', type: 'bed', x: 92, y: 160, rotation: 0 }]);
    f.controller.sync();
    assert.equal(f.controller.interactWith('bed', { onArrive: result => {
        arrivals.push(result); f.state.furnitureHold = { itemId: 'bed', kind: 'rest' }; f.state.activity = 'room-care';
        f.controller.cancel({ reset: true });
    } }), true);
    finishMove(f);
    assert.equal(arrivals.length, 1); assert.equal(f.root.pet.getAttribute('data-room-pose'), 'rest');
    const anchor = roomFoot(f);
    f.tick(60000); f.controller.sync(); assert.deepEqual(roomFoot(f), anchor); assert.equal(arrivals.length, 1);
    f.state.furnitureHold = null; f.state.activity = 'idle'; f.controller.cancel({ reset: true });
    assert.equal(f.root.pet.hasAttribute('data-room-pose'), false);
});

test('care resets choose an unoccupied floor spawn instead of trapping the pet inside furniture', t => {
    const f = setup(t);
    customRoom(f, [{ id: 'desk', type: 'table', x: 160, y: 200, rotation: 0 }]);
    f.controller.sync(); const initial = f.position();
    assert.notDeepEqual(initial, [0, 0], 'initial placement resolves an occupied default floor position');
    f.controller.cancel({ reset: true }); assert.deepEqual(f.position(), initial, 'care reset reuses a safe nearby initial position');
    assert.equal(f.controller.moveTo({ clientX: 260, clientY: 155 }), true);
    finishMove(f); assert.ok(Math.hypot(roomFoot(f).x - 260, roomFoot(f).y - 155) < .01);
});

test('cancelling or retargeting a furniture command reports one cancellation after its callback is discarded', t => {
    const events = [], arrivals = [], f = setup(t, () => .75, { onFurnitureInteraction: event => events.push(event) });
    customRoom(f, [{ id: 'seat', type: 'sofa', x: 92, y: 160, rotation: 0 }]);
    f.controller.sync();
    assert.equal(f.controller.interactWith('seat', { onArrive: value => arrivals.push(value) }), true);
    f.advance(100); f.controller.cancel(); f.controller.cancel();
    assert.equal(events.filter(event => event.phase === 'cancelled').length, 1);
    assert.deepEqual(events[0], { itemId: 'seat', kind: 'sit', phase: 'cancelled', automatic: false });
    for (let index = 0; index < 100; index++) f.advance(100);
    assert.deepEqual(arrivals, []);
    assert.equal(f.controller.interactWith('seat', { onArrive: value => arrivals.push(value) }), true);
    f.advance(100); assert.equal(f.controller.moveTo({ clientX: 260, clientY: 155 }), true);
    assert.equal(events.filter(event => event.phase === 'cancelled').length, 2);
    finishMove(f); assert.deepEqual(arrivals, []);
});

test('scene point walking reaches its destination and applies the arrival callback exactly once', t => {
    const f = setup(t), arrivals = [];
    f.state.sceneKey = 'homestead:forest';
    f.controller.sync();
    assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push(roomFoot(f)) }), true);
    f.advance(100);
    assert.equal(arrivals.length, 0, 'gathering cannot settle at the beginning of a walk');
    const previous = f.root.pet; previous.isConnected = false; f.root.pet = pet();
    f.state.lifeTick = 1; f.controller.sync();
    finishMove(f);
    assert.equal(arrivals.length, 1, 'harmless life ticks and scene rerenders preserve the arrival');
    assert.ok(Math.hypot(arrivals[0].x - 230, arrivals[0].y - 175) < .01);
    for (let index = 0; index < 200; index++) f.advance(100);
    assert.equal(arrivals.length, 1, 'autonomous walking never repeats the completed command');
});

test('cancelling, changing scene key, and disabling the world discard pending point arrivals', t => {
    const f = setup(t), arrivals = [];
    f.state.sceneKey = 'homestead:forest'; f.controller.sync();
    for (const invalidate of [
        () => f.controller.cancel(),
        () => { f.state.sceneKey = `${f.state.sceneKey}:next`; f.controller.sync(); },
        () => { f.state.enabled = false; f.controller.sync(); },
        () => { f.state.activity = 'away'; f.controller.sync(); },
    ]) {
        f.state.enabled = true; f.state.activity = 'idle'; f.controller.cancel({ reset: true });
        assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push('stale') }), true);
        f.advance(100); invalidate();
        for (let index = 0; index < 150; index++) f.advance(100);
        assert.deepEqual(arrivals, [], 'cancelled farming and exit commands cannot apply later');
    }
    f.state.enabled = false; f.state.activity = 'idle'; f.controller.sync();
    assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push('disabled') }), false);
    f.state.enabled = true; f.controller.sync(); finishMove(f);
    assert.deepEqual(arrivals, []);
});

test('retargeting point commands or issuing a floor move cancels the previous pending action', t => {
    const f = setup(t), arrivals = [];
    f.controller.sync();
    assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push('first') }), true);
    f.advance(100);
    assert.equal(f.controller.walkToPoint({ x: 100, y: 175 }, { onArrive: () => arrivals.push('second') }), true);
    finishMove(f); assert.deepEqual(arrivals, ['second']);
    assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push('third') }), true);
    f.advance(100);
    assert.equal(f.controller.moveTo({ clientX: 160, clientY: 170 }), true);
    finishMove(f); assert.deepEqual(arrivals, ['second']);
});

test('homestead floor boundaries clamp point targets and autonomous motion to walkable ground', t => {
    const f = setup(t, () => 0), arrivals = [];
    customRoom(f);
    f.state.habitat = 'garden'; f.state.sceneKey = 'homestead:yard'; f.state.floorY = 145;
    f.controller.sync();
    assert.equal(f.controller.walkToPoint({ x: 230, y: 50 }, { onArrive: () => arrivals.push(roomFoot(f)) }), true);
    finishMove(f);
    assert.equal(arrivals.length, 1);
    assert.ok(Math.abs(arrivals[0].y - 145) < .01, 'a target above the floor resolves to its walkable edge');
    for (let index = 0; index < 300; index++) {
        f.advance(100);
        assert.ok(roomFoot(f).y >= 145 - .01, 'idle roaming also respects the scene floor');
    }
});

test('reduced motion and missing animation runtime complete explicit point actions once', async t => {
    for (const withoutFrames of [false, true]) await t.test(withoutFrames ? 'no frames' : 'reduced motion', child => {
        const f = setup(child, () => .75, { withoutFrames }), arrivals = [];
        if (!withoutFrames) f.motion.matches = true;
        f.controller.sync();
        assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push(roomFoot(f)) }), true);
        assert.equal(arrivals.length, 1);
        assert.ok(Math.hypot(arrivals[0].x - 230, arrivals[0].y - 175) < .01);
        for (let index = 0; index < 60; index++) f.advance(1000);
        assert.equal(arrivals.length, 1);
        assert.equal(f.frames.size, 0);
    });
});

test('an arrival can change scene and begin another command without replaying either action', t => {
    const f = setup(t), arrivals = [];
    f.state.sceneKey = 'homestead:yard'; f.controller.sync();
    assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => {
        arrivals.push('yard');
        f.state.sceneKey = 'homestead:forest'; f.controller.sync();
        f.controller.walkToPoint({ x: 100, y: 175 }, { onArrive: () => arrivals.push('forest') });
    } }), true);
    finishMove(f);
    assert.deepEqual(arrivals, ['yard', 'forest']);
    for (let index = 0; index < 200; index++) f.advance(100);
    assert.deepEqual(arrivals, ['yard', 'forest']);
});

test('homestead panels pause roaming at the current feet position through repeated rerenders', t => {
    const f = setup(t, () => 0);
    customRoom(f);
    f.state.habitat = 'garden'; f.state.sceneKey = 'homestead:yard'; f.state.floorY = 86;
    f.controller.sync();
    f.controller.walkToPoint({ x: 250, y: 170 }); finishMove(f);
    const before = roomFoot(f);
    assert.ok(Math.hypot(before.x - 250, before.y - 170) < .01);
    f.state.locked = true; f.controller.sync();
    assert.equal(f.stage.hasAttribute('data-roam-interactive'), false);
    for (let index = 0; index < 5; index++) {
        const previous = f.root.pet;
        previous.isConnected = false;
        f.root.pet = pet();
        Object.assign(f.root.pet, { offsetLeft: 116, offsetTop: 144, offsetWidth: 88, offsetHeight: 86 });
        f.root.pet.querySelector = previous.querySelector;
        f.controller.sync(); f.advance(30000);
        assert.deepEqual(roomFoot(f), before, 'opening or repainting the seed menu cannot recenter the pet');
        assert.equal(f.root.pet.getAttribute('data-roam-state'), 'resting');
        assert.equal(f.frames.size, 0, 'panels do not leave an autonomous walk scheduled');
    }
    f.state.locked = false; f.controller.sync();
    assert.deepEqual(roomFoot(f), before); assert.equal(f.stage.hasAttribute('data-roam-interactive'), true);
    f.tick(1500); assert.equal(f.root.pet.getAttribute('data-roam-state'), 'walking', 'roaming resumes after the normal quiet delay');
});

function resizeHomestead(f, narrow) {
    f.stage.clientWidth = narrow ? 200 : 320;
    f.stage.clientHeight = narrow ? 150 : 240;
    f.root.pet.offsetLeft = narrow ? 56 : 116;
    f.root.pet.offsetTop = narrow ? 84 : 144;
    f.window.emit('resize');
}

test('locked homestead work restores its scene anchor after a narrow layout clamps the touch target', async t => {
    for (const simultaneousLock of [false, true]) await t.test(simultaneousLock ? 'resize on first locked render' : 'resize during a locked action', child => {
        const f = setup(child), arrivals = [];
        customRoom(f); f.state.habitat = 'garden'; f.state.sceneKey = 'homestead:kitchen'; f.state.floorY = 86;
        f.controller.sync();
        f.controller.walkToPoint({ x: 265, y: 175 }, { onArrive: () => arrivals.push('ready') }); finishMove(f);
        const anchor = roomFoot(f);
        f.state.locked = true;
        if (!simultaneousLock) f.controller.sync();
        resizeHomestead(f, true);
        assert.ok(roomFoot(f).x < anchor.x - 10, 'the test actually forces temporary clamping');
        const shadow = f.root.pet.querySelector;
        f.root.pet.isConnected = false; f.root.pet = pet();
        Object.assign(f.root.pet, { offsetLeft: 56, offsetTop: 84, offsetWidth: 88, offsetHeight: 86, querySelector: shadow });
        for (let index = 0; index < 5; index++) f.controller.sync();
        resizeHomestead(f, false);
        assert.ok(Math.hypot(roomFoot(f).x - anchor.x, roomFoot(f).y - anchor.y) < .01, 'repaint and temporary clamping cannot overwrite the intended scene anchor');
        assert.equal(f.frames.size, 0); assert.deepEqual(arrivals, ['ready']);
        f.state.locked = false; f.controller.sync();
        assert.ok(Math.hypot(roomFoot(f).x - anchor.x, roomFoot(f).y - anchor.y) < .01, 'unlocking keeps the restored position');
    });
});

test('cancelling, changing identity, or unlocking discards a previous locked homestead anchor', async t => {
    for (const reason of ['cancel', 'identity', 'scene', 'unlock']) await t.test(reason, child => {
        const f = setup(child);
        customRoom(f); f.state.habitat = 'garden'; f.state.sceneKey = 'homestead:kitchen'; f.state.floorY = 86;
        f.controller.sync(); f.controller.walkToPoint({ x: 265, y: 175 }); finishMove(f);
        f.state.locked = true; f.controller.sync(); resizeHomestead(f, true);
        if (reason === 'cancel') f.controller.cancel();
        else if (reason === 'identity') { f.state.identity = {}; f.controller.sync(); }
        else if (reason === 'scene') { f.state.sceneKey = 'homestead:river'; f.controller.sync(); }
        else {
            f.state.locked = false; f.controller.sync();
            assert.equal(f.controller.walkToPoint({ x: 200, y: 175 }), true); finishMove(f);
            f.state.locked = true; f.controller.sync();
        }
        const fresh = roomFoot(f);
        assert.ok(Math.abs(fresh.x - 265) > 10);
        resizeHomestead(f, false);
        assert.ok(Math.hypot(roomFoot(f).x - fresh.x, roomFoot(f).y - fresh.y) < .01, 'later resize must use the new action/context, never the old cooking position');
        assert.equal(f.frames.size, 0);
    });
});

test('locked homestead actions reject floor, point, furniture and pointer commands', t => {
    const f = setup(t), arrivals = [];
    customRoom(f, [{ id: 'seat', type: 'sofa', x: 92, y: 160, rotation: 0 }]);
    f.controller.sync(); f.controller.walkToPoint({ x: 245, y: 190 }); finishMove(f);
    const before = roomFoot(f);
    f.state.locked = true; f.controller.sync();
    assert.equal(f.controller.moveTo({ clientX: 260, clientY: 170 }), false);
    assert.equal(f.controller.walkToPoint({ x: 210, y: 190 }, { onArrive: () => arrivals.push('point') }), false);
    assert.equal(f.controller.interactWith('seat', { onArrive: () => arrivals.push('seat') }), false);
    roomGesture(f, [260, 170]).up(); f.advance(30000);
    assert.deepEqual(roomFoot(f), before); assert.deepEqual(arrivals, []); assert.equal(f.frames.size, 0);
    assert.equal(f.stage.hasAttribute('data-roam-target'), false);
    f.state.locked = false; f.controller.sync();
    assert.equal(f.controller.walkToPoint({ x: 210, y: 190 }, { onArrive: () => arrivals.push('fresh') }), true);
    finishMove(f); assert.deepEqual(arrivals, ['fresh']);
});

test('locking while approaching a target cancels its pending arrival without teleporting', t => {
    const f = setup(t), arrivals = [];
    f.state.sceneKey = 'homestead:forest'; f.controller.sync();
    f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push('stale') });
    f.advance(100); const before = f.position();
    assert.notDeepEqual(before, [0, 0]);
    f.state.locked = true; f.controller.sync();
    assert.deepEqual(f.position(), before); assert.equal(f.frames.size, 0);
    f.advance(60000); f.state.locked = false; f.controller.sync();
    for (let index = 0; index < 300; index++) f.advance(100);
    assert.deepEqual(arrivals, [], 'unlocking may resume idle walking, never the cancelled harvest or exit');
});

test('reduced-motion panel locks keep manual placement and unlock without recentering', t => {
    const f = setup(t), arrivals = [];
    f.motion.matches = true; f.controller.sync();
    f.controller.walkToPoint({ x: 230, y: 175 }, { onArrive: () => arrivals.push('arrived') });
    const before = f.position(); assert.notDeepEqual(before, [0, 0]);
    f.state.locked = true; f.controller.sync(); f.advance(30000);
    f.root.pet.isConnected = false; f.root.pet = pet(); f.controller.sync();
    assert.deepEqual(f.position(), before);
    f.state.locked = false; f.controller.sync(); f.advance(30000);
    assert.deepEqual(f.position(), before); assert.deepEqual(arrivals, ['arrived']); assert.equal(f.frames.size, 0);
});

test('point cancellation reports once and releases awaited work when a pointer stops the approach', async t => {
    for (const reason of ['cancel', 'pointer', 'lock', 'sleep', 'chat', 'destroy']) await t.test(reason, async child => {
        const f = setup(child), events = [];
        f.controller.sync();
        let resolveWait;
        const waiting = new Promise(resolve => { resolveWait = resolve; });
        assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, {
            onArrive: () => { events.push('arrived'); resolveWait('arrived'); },
            onCancel: () => { events.push('cancelled'); resolveWait('cancelled'); },
        }), true);
        f.advance(100);
        if (reason === 'pointer') {
            f.root.emit('pointerdown', { pointerId: 7, target: f.root.pet });
            f.document.emit('pointerup', { pointerId: 7, target: f.root.pet });
        } else if (reason === 'lock') { f.state.locked = true; f.controller.sync(); }
        else if (reason === 'sleep') { f.state.activity = 'sleep'; f.controller.sync(); }
        else if (reason === 'chat') { f.state.identity = {}; f.controller.sync(); }
        else if (reason === 'destroy') f.controller.destroy();
        else f.controller.cancel();
        assert.deepEqual(events, ['cancelled'], 'interrupted walking must release the waiting action immediately');
        assert.equal(await waiting, 'cancelled');
        f.controller.cancel(); f.controller.sync();
        for (let index = 0; index < 300; index++) f.advance(100);
        assert.deepEqual(events, ['cancelled'], 'cleanup and later movement cannot repeat cancellation or deliver stale arrival');
    });
});

test('successful point arrivals never deliver cancellation, including static placement', async t => {
    for (const reduced of [false, true]) await t.test(reduced ? 'reduced motion' : 'animated walk', child => {
        const f = setup(child), events = [];
        f.motion.matches = reduced; f.controller.sync();
        assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }, {
            onArrive: () => events.push('arrived'), onCancel: () => events.push('cancelled'),
        }), true);
        finishMove(f); assert.deepEqual(events, ['arrived']);
        f.controller.cancel(); f.controller.destroy();
        assert.deepEqual(events, ['arrived']);
    });
});

test('retargeting cancels only the old waiter and cancellation cleanup may safely repeat', t => {
    const f = setup(t), events = [];
    f.controller.sync();
    f.controller.walkToPoint({ x: 230, y: 175 }, {
        onArrive: () => events.push('old-arrival'),
        onCancel: () => { events.push('old-cancel'); f.controller.cancel(); },
    });
    f.advance(100);
    assert.equal(f.controller.walkToPoint({ x: 100, y: 175 }, {
        onArrive: () => events.push('new-arrival'), onCancel: () => events.push('new-cancel'),
    }), true);
    finishMove(f); assert.deepEqual(events, ['old-cancel', 'new-arrival']);
    f.controller.cancel(); assert.deepEqual(events, ['old-cancel', 'new-arrival']);
});

test('a manual reversal pauses the gait before a gentle restart and clears its phase at rest', t => {
    const f = setup(t);
    f.controller.sync();
    assert.equal(f.controller.walkToPoint({ x: 230, y: 175 }), true);
    f.advance(50);
    assert.equal(f.root.pet.getAttribute('data-roam-phase'), 'start');
    f.advance(200);
    assert.equal(f.root.pet.getAttribute('data-roam-phase'), 'cruise');
    const beforeTurn = f.position();
    assert.equal(f.controller.walkToPoint({ x: 100, y: 175 }), true);
    f.advance(100);
    assert.equal(f.root.pet.getAttribute('data-roam-phase'), 'turn');
    assert.deepEqual(f.position(), beforeTurn, 'a reversal plants its feet while the body turns');
    f.advance(50);
    assert.equal(f.root.pet.getAttribute('data-roam-phase'), 'start');
    assert.ok(f.position()[0] < beforeTurn[0], 'the new route restarts toward the second target');
    let slowedBeforeArrival = false;
    for (let index = 0; index < 300 && f.root.pet.getAttribute('data-roam-state') === 'walking'; index++) {
        f.advance(50);
        slowedBeforeArrival ||= f.root.pet.getAttribute('data-roam-phase') === 'arrive';
    }
    assert.ok(slowedBeforeArrival, 'approaching the goal slows the route before it stops');
    assert.equal(f.root.pet.getAttribute('data-roam-state'), 'resting');
    assert.equal(f.root.pet.getAttribute('data-roam-phase'), null);
});
