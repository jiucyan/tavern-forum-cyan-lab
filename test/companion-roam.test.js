import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanionRoamController } from '../src/companion-roam.js';
import { createCompanionIdleController } from '../src/companion-idle.js';

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
function setup(t, random = () => .75, { onMotionChange, withoutFrames = false } = {}) {
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
    for (let i = 0; i < 70; i++) advance(100);
    assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    assert.deepEqual(motions, [true, false]);
    tick(4000); assert.equal(root.pet.getAttribute('data-roam-state'), 'resting');
    tick(2000); assert.equal(root.pet.getAttribute('data-roam-state'), 'walking');
});

test('movement has the same speed at 30, 60 and 120 frames per second', async t => {
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
        assert.ok(Math.abs(Math.hypot(...result) - 11) < .01, 'cat travels 22 px per second');
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
    for (let i = 0; i < 40; i++) advance(100);
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
