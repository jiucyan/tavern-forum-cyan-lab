import test from 'node:test';
import assert from 'node:assert/strict';
import { createHomesteadMotionController, HOMESTEAD_MOTION_DURATIONS } from '../src/companion-homestead-motion.js';

function setup({ reducedMotion = false } = {}) {
    let clock = 100000, nextId = 1;
    const timers = new Map(), callbacks = [], changes = [];
    const controller = createHomesteadMotionController({
        now: () => clock,
        reducedMotion: () => reducedMotion,
        onChange: state => changes.push(state),
        setTimer(callback, delay) {
            const id = nextId++;
            timers.set(id, { callback, at: clock + delay }); callbacks.push(callback);
            return id;
        },
        clearTimer: id => timers.delete(id),
    });
    function tick(ms) {
        clock += ms;
        for (const [id, timer] of [...timers]) {
            if (timer.at > clock) continue;
            timers.delete(id); timer.callback();
        }
    }
    return { controller, timers, callbacks, changes, tick };
}

test('each homestead action waits for its complete gesture before committing exactly once', async t => {
    const expected = { plant: 1400, water: 1600, harvest: 1300, gather: 1200, pack: 1300, cook: 3200, feed: 1500, fish: 1600 };
    assert.deepEqual(HOMESTEAD_MOTION_DURATIONS, expected);
    for (const [action, duration] of Object.entries(expected)) await t.test(action, async () => {
        const f = setup(), commits = [];
        const pending = f.controller.run({ action, itemId: 'carrot', commit: () => { commits.push(action); return { message: 'done' }; } });
        assert.deepEqual(f.controller.active, { action, itemId: 'carrot', duration, startedAt: 100000 });
        assert.deepEqual(commits, [], 'starting an animation may not spend inventory');
        f.tick(duration - 1); assert.deepEqual(commits, []);
        f.tick(1); assert.deepEqual(commits, [action], 'the commit occurs synchronously at completion');
        assert.deepEqual(await pending, { completed: true, result: { message: 'done' } });
        assert.equal(f.controller.active, null); assert.equal(f.changes.length, 2); assert.equal(f.changes.at(-1), null);
        f.callbacks[0](); f.tick(60000);
        assert.deepEqual(commits, [action], 'late timer callbacks cannot spend a second item');
        assert.equal(f.timers.size, 0);
    });
});

test('rapid repeated actions are rejected without replacing or shortening the pending gesture', async () => {
    const f = setup(), commits = [];
    const first = f.controller.run({ action: 'water', commit: () => commits.push('water') });
    f.tick(400);
    const repeated = await f.controller.run({ action: 'harvest', commit: () => commits.push('harvest') });
    assert.deepEqual(repeated, { completed: false, reason: 'busy' });
    assert.equal(f.controller.active.action, 'water'); assert.equal(f.changes.length, 1); assert.equal(f.timers.size, 1);
    f.tick(1199); assert.deepEqual(commits, []);
    f.tick(1); assert.equal((await first).completed, true); assert.deepEqual(commits, ['water']);
});

test('cancellation resolves the operation without committing and stale callbacks cannot revive it', async () => {
    const f = setup(), commits = [];
    const first = f.controller.run({ action: 'plant', commit: () => commits.push('cancelled plant') });
    const stale = f.callbacks[0];
    f.tick(700); f.controller.cancel(); f.controller.cancel();
    assert.deepEqual(await first, { completed: false, reason: 'cancelled' });
    assert.equal(f.controller.active, null); assert.equal(f.timers.size, 0); assert.deepEqual(commits, []);
    assert.equal(f.changes.length, 2, 'repeated cleanup emits a single stop');
    const next = f.controller.run({ action: 'gather', commit: () => commits.push('fresh gather') });
    stale(); assert.equal(f.controller.active.action, 'gather'); assert.deepEqual(commits, []);
    f.tick(1200); assert.equal((await next).completed, true);
    stale(); assert.deepEqual(commits, ['fresh gather']);
});

test('invalid initial or changed chat context never reaches a saved-data commit', async () => {
    const f = setup(), commits = [];
    let currentChat = 'first';
    const initial = await f.controller.run({ action: 'feed', valid: () => false, commit: () => commits.push('invalid') });
    assert.deepEqual(initial, { completed: false, reason: 'invalid' });
    assert.equal(f.changes.length, 0); assert.equal(f.timers.size, 0);
    const pending = f.controller.run({ action: 'cook', valid: () => currentChat === 'first', commit: () => commits.push('stale') });
    f.tick(500); currentChat = 'second'; f.tick(HOMESTEAD_MOTION_DURATIONS.cook - 500);
    assert.equal((await pending).completed, false); assert.deepEqual(commits, []);
    assert.equal(f.controller.active, null); assert.equal(f.changes.at(-1), null); assert.equal(f.timers.size, 0);
});

test('failed commits clear the gesture and allow the next valid action', async () => {
    const f = setup(), failure = new Error('没有种子');
    const pending = f.controller.run({ action: 'plant', commit: () => { throw failure; } });
    const rejected = assert.rejects(pending, error => error === failure);
    f.tick(1400); await rejected;
    assert.equal(f.controller.active, null); assert.equal(f.changes.at(-1), null); assert.equal(f.timers.size, 0);
    const next = f.controller.run({ action: 'pack', commit: () => 'packed' });
    f.tick(1300); assert.deepEqual(await next, { completed: true, result: 'packed' });
});

test('a context check that throws at completion releases the action lock without committing', async () => {
    const f = setup(), failure = new Error('聊天上下文已卸载'), commits = [];
    let unloaded = false;
    const pending = f.controller.run({ action: 'gather', valid: () => {
        if (unloaded) throw failure;
        return true;
    }, commit: () => commits.push('gather') });
    const rejected = assert.rejects(pending, error => error === failure);
    unloaded = true; f.tick(1200); await rejected;
    assert.deepEqual(commits, []); assert.equal(f.controller.active, null);
    assert.equal(f.changes.at(-1), null); assert.equal(f.timers.size, 0);
    const next = f.controller.run({ action: 'feed', commit: () => commits.push('feed') });
    f.tick(1500); assert.equal((await next).completed, true); assert.deepEqual(commits, ['feed']);
});

test('reduced-motion preferences use a brief static feedback interval without early commits', async () => {
    const f = setup({ reducedMotion: true }), commits = [];
    const pending = f.controller.run({ action: 'water', commit: () => commits.push('water') });
    assert.equal(f.controller.active.duration, 120);
    f.tick(119); assert.deepEqual(commits, []);
    f.tick(1); assert.equal((await pending).completed, true); assert.deepEqual(commits, ['water']);
    assert.equal(f.controller.active, null);
});

test('unsupported gesture names fail without creating a busy lock', async () => {
    const f = setup();
    await assert.rejects(f.controller.run({ action: 'unknown' }), /未知的小窝动作/);
    assert.equal(f.controller.active, null); assert.equal(f.changes.length, 0); assert.equal(f.timers.size, 0);
});
