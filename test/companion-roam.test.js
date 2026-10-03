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
    };
}
function setup(t, random = () => .75, { onMotionChange } = {}) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
    const motion = Object.assign(new Events(), { matches: false }), window = new Events();
    window.matchMedia = () => motion;
    const document = Object.assign(new Events(), { visibilityState: 'visible', defaultView: window, activeElement: null });
    const stage = { isConnected: true, clientWidth: 420, clientHeight: 230 };
    const state = { enabled: true, identity: { untouched: 'saved' }, species: 'cat', habitat: 'meadow', activity: 'idle' };
    const root = Object.assign(new Events(), {
        isConnected: true, ownerDocument: document, pet: pet(), stage,
        querySelector(selector) { return selector === '.tf-pet-stage' ? this.stage : selector === '.tf-pet-sprite-control' ? this.pet : null; },
    });
    const frames = new Map(), motions = [];
    let nextFrame = 1;
    const controller = createCompanionRoamController({
        getRoot: () => root, getSnapshot: () => state, random, now: Date.now,
        onMotionChange: moving => { motions.push(moving); onMotionChange?.(moving); },
        requestFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelFrame: id => frames.delete(id),
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
