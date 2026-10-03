import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANION_IDLE_DURATION, createCompanionIdleController, getCompanionIdlePoses } from '../src/companion-idle.js';

class Events {
    listeners = new Map();
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type) { for (const listener of this.listeners.get(type) || []) listener(); }
    count() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}
const makePet = () => ({
    isConnected: true,
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    get pose() { return this.attributes.get('data-idle-pose'); },
});

function setup(t, random = () => 0) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
    const motion = Object.assign(new Events(), { matches: false });
    const document = Object.assign(new Events(), {
        visibilityState: 'visible', defaultView: { matchMedia: () => motion },
    });
    const state = { enabled: true, identity: {}, species: 'cat', activity: 'idle' };
    const root = Object.assign(new Events(), {
        isConnected: true, ownerDocument: document, pet: makePet(), querySelector() { return this.pet; },
    });
    const controller = createCompanionIdleController({ getRoot: () => root, getSnapshot: () => state, random });
    t.after(() => controller.destroy());
    return { controller, state, root, document, motion, tick: ms => t.mock.timers.tick(ms) };
}

test('quiet intervals survive repeated renders and poses end before the next begins', t => {
    const { controller, root, tick } = setup(t);
    controller.sync();
    tick(2000);
    for (let i = 0; i < 30; i++) controller.sync();
    tick(999); assert.equal(root.pet.pose, undefined);
    tick(1); assert.equal(root.pet.pose, 'look');
    for (let i = 0; i < 30; i++) controller.sync();
    tick(COMPANION_IDLE_DURATION - 1); assert.equal(root.pet.pose, 'look');
    tick(1); assert.equal(root.pet.pose, undefined);
    tick(9999); assert.equal(root.pet.pose, undefined);
    tick(1); assert.equal(root.pet.pose, 'listen', 'the same pose does not repeat immediately');
});

test('pointer and keyboard input stop the current pose and postpone the next', t => {
    const { controller, root, tick } = setup(t);
    controller.sync(); tick(3000);
    assert.equal(root.pet.pose, 'look');
    root.emit('pointerdown'); assert.equal(root.pet.pose, undefined);
    tick(8000);
    root.emit('keydown');
    controller.sync();
    tick(9999); assert.equal(root.pet.pose, undefined);
    tick(1); assert.equal(root.pet.pose, 'listen');
});

test('a rerender removes the detached pose and gives the new pet time to settle', t => {
    const { controller, root, tick } = setup(t);
    controller.sync(); tick(3000);
    const previousPet = root.pet;
    previousPet.isConnected = false; root.pet = makePet();
    controller.sync();
    assert.equal(previousPet.pose, undefined);
    tick(2999); assert.equal(root.pet.pose, undefined);
    tick(1); assert.equal(root.pet.pose, 'look');
});

test('releasing a long touch resumes idle after its blocked deadline passed', t => {
    const { controller, root, state, tick } = setup(t);
    controller.sync(); tick(3000);
    root.emit('pointerdown'); state.enabled = false;
    tick(18000); assert.equal(root.pet.pose, undefined);
    state.enabled = true; root.emit('pointerup');
    tick(2999); assert.equal(root.pet.pose, undefined);
    tick(1); assert.equal(root.pet.pose, 'listen');
});

test('chat identity and species changes invalidate pending callbacks even without a render hook', t => {
    const { controller, root, state, tick } = setup(t);
    controller.sync();
    tick(2000); state.identity = {}; state.species = 'goldfish';
    tick(1000); assert.equal(root.pet.pose, undefined);
    tick(3000); assert.equal(root.pet.pose, 'look');
    assert.equal(controller.play('groom'), false);
    assert.equal(root.pet.pose, 'look');
    state.identity = {}; controller.sync();
    assert.equal(root.pet.pose, undefined);
});

test('menus, care and hidden documents stop idle until they become available again', t => {
    const { controller, root, state, document, tick } = setup(t);
    controller.sync(); tick(3000);
    state.enabled = false; controller.sync();
    assert.equal(root.pet.pose, undefined);
    assert.equal(controller.play('stretch'), false);
    tick(20000); assert.equal(root.pet.pose, undefined);
    state.enabled = true; controller.sync(); tick(3000);
    assert.equal(root.pet.pose, 'listen');
    document.visibilityState = 'hidden'; document.emit('visibilitychange');
    assert.equal(root.pet.pose, undefined);
    tick(20000); assert.equal(root.pet.pose, undefined);
    document.visibilityState = 'visible'; document.emit('visibilitychange');
    tick(2999); assert.equal(root.pet.pose, undefined);
    tick(1); assert.equal(root.pet.pose, 'look');
});

test('away, sleep, pause and daycare cannot play a preview or scheduled pose', t => {
    const { controller, root, state, tick } = setup(t);
    for (const activity of ['away', 'sleep', 'paused', 'daycare']) {
        state.activity = activity;
        assert.equal(controller.sync(), false);
        assert.equal(controller.play('look'), false);
        tick(20000); assert.equal(root.pet.pose, undefined);
    }
});

test('reduced motion clears an active pose and resumes after a quiet delay when switched off', t => {
    const { controller, root, motion, tick } = setup(t);
    assert.equal(controller.play('stretch'), true);
    motion.matches = true; motion.emit('change');
    assert.equal(root.pet.pose, undefined);
    assert.equal(controller.play('doze'), false);
    tick(20000); assert.equal(root.pet.pose, undefined);
    motion.matches = false; motion.emit('change');
    tick(2999); assert.equal(root.pet.pose, undefined);
    tick(1); assert.equal(root.pet.pose, 'look');
});

test('species-specific poses and tired behavior remain appropriate without changing saved state', t => {
    const { controller, root, state, tick } = setup(t, () => .999);
    assert.deepEqual(getCompanionIdlePoses('goldfish'), ['look', 'listen', 'stretch', 'doze']);
    assert.ok(getCompanionIdlePoses('cat').includes('groom'));
    state.activity = 'tired';
    const before = { ...state };
    controller.sync(); tick(5000);
    assert.equal(root.pet.pose, 'doze');
    tick(COMPANION_IDLE_DURATION); tick(18000);
    assert.equal(root.pet.pose, 'listen');
    assert.deepEqual(state, before);
});

test('destroy removes listeners and timers and cannot be restarted', t => {
    const { controller, root, document, motion, tick } = setup(t);
    controller.play('groom');
    assert.ok(root.count() > 0); assert.equal(document.count(), 1); assert.equal(motion.count(), 1);
    controller.destroy(); controller.destroy();
    assert.equal(root.pet.pose, undefined);
    assert.equal(root.count(), 0); assert.equal(document.count(), 0); assert.equal(motion.count(), 0);
    assert.equal(controller.sync(), false); assert.equal(controller.play('look'), false);
    controller.cancel(); tick(60000); assert.equal(root.pet.pose, undefined);
});
