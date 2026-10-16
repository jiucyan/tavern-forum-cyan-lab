import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkPosePlayer, getWorkFit, renderWorkPoseArt, sampleWorkPose } from '../src/companion-work-pose.js';

const geometry = {
    shoulder: { x: 44, y: 52 }, foot: { x: 33, y: 77 },
    table: { x: 76, y: 29 }, water: { x: 116, y: 90 }, unit: 1.2,
};
const sample = (action, progress, extra = {}) => sampleWorkPose({ action, progress, elapsed: progress * (action === 'cook' ? 3200 : 1600), geometry, ...extra });
const near = (actual, expected, message, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);

test('cooking keeps the companion grounded and returns it to a quiet original pose', () => {
    const before = sample('cook', 0), working = sample('cook', .5), finished = sample('cook', 1);
    for (const key of ['x', 'y', 'angle']) near(before.body[key], 0, 'preparation keeps the original standing pose');
    for (const key of ['sx', 'sy']) near(before.body[key], 1, 'preparation keeps the original body proportions');
    assert.equal(before.toolOpacity, 0);
    near(working.body.y, 0, 'working feet remain on the floor');
    near(working.body.x, 0, 'the cat watches without sliding');
    assert.equal(working.toolOpacity, 1);
    for (const key of ['x', 'y', 'angle']) near(finished.body[key], 0, 'completion restores the standing pose');
    for (const key of ['sx', 'sy']) near(finished.body[key], 1, 'completion restores the original body proportions');
    assert.equal(finished.toolOpacity, 0);
    assert.equal(finished.dish, 0);
    const phases = [...new Set(Array.from({ length: 101 }, (_, i) => sample('cook', i / 100).stage))];
    assert.deepEqual(phases, ['prepare', 'work', 'serve', 'settle']);
    for (const boundary of [.05, .125, .2, .84, .93, 1]) {
        const a = sample('cook', boundary - 1e-6), b = sample('cook', boundary + 1e-6);
        near(a.body.x, b.body.x, `no horizontal step at ${boundary}`, .001);
        near(a.body.y, b.body.y, `no vertical step at ${boundary}`, .001);
    }
    near(sample('cook', .72 - 1e-6).body.angle, sample('cook', .72 + 1e-6).body.angle, 'finishing work does not snap the body upright', .001);
});

test('cooking tools work inside the cookware for every recipe without moving the floor anchor', () => {
    for (const itemId of ['bento', 'vegetable-soup', 'mushroom-stew', 'grilled-fish', 'fish-rice']) {
        for (let progress = .28; progress < .69; progress += .01) {
            const pose = sample('cook', progress, { itemId });
            assert.ok(Math.abs(pose.tip.x - geometry.table.x) <= 6 * geometry.unit + 1e-8, `${itemId} tool leaves the cookware`);
            assert.ok(pose.tip.y < geometry.table.y && pose.tip.y >= geometry.table.y - 7 * geometry.unit);
            near(pose.body.y, 0, `${itemId} never lifts the companion off the floor`);
        }
    }
});

test('casting sends the float from the rod tip to the water, and a catch disappears before completion', () => {
    const start = sample('fishing', 0, { elapsed: 0 });
    assert.deepEqual(start.float, start.tip);
    const settled = sample('fishing', 1, { elapsed: 800, reduced: true });
    assert.deepEqual(settled.float, geometry.water);
    assert.equal(settled.stage, 'wait');
    assert.equal(sample('fishing', 1, { elapsed: 3000, phase: 'bite' }).stage, 'bite');
    const caught = sample('fish', .5, { itemId: 'river-fish' });
    assert.equal(caught.fish, 1);
    assert.ok(Math.abs(caught.body.angle) < 2, 'the pet observes without pulling the rod');
    assert.equal(sample('fish', .5).fish, 0, 'an empty hook never displays a fish');
    const finished = sample('fish', 1, { itemId: 'river-fish' });
    near(finished.body.x, 0, 'reel returns horizontally');
    near(finished.body.angle, 0, 'reel returns upright');
    assert.equal(finished.fish, 0);
    assert.equal(finished.toolOpacity, 0);
});

const species = ['frog', 'cat', 'rabbit', 'fox', 'penguin', 'robo-bird', 'octopus', 'goldfish', 'soot'];
const growthStages = ['baby', 'young', 'adult'];

test('each species keeps a distinct movement signature instead of sharing the same body animation', () => {
    for (const action of ['cook', 'fish']) {
        const signatures = species.map(kind => {
            const poses = [.08, .14, .32, .47, .63, .88].map(progress => sample(action, progress, { kind }));
            return JSON.stringify(poses.map(({ body }) => Object.values(body).map(value => Number(value.toFixed(4)))));
        });
        assert.equal(new Set(signatures).size, species.length, `${action} reuses a species body animation`);
    }
});

test('all pets retain their native support and never climb on artificial work equipment', () => {
    for (const kind of species) for (const growthStage of growthStages) {
        const aquatic = kind === 'goldfish' || kind === 'frog' && growthStage === 'baby';
        const fit = getWorkFit(kind, growthStage);
        assert.equal(fit.aquatic, aquatic, `${kind}/${growthStage} aquatic classification`);
        assert.equal(fit.behavior === 'water-watch', aquatic);
        for (let step = 0; step <= 100; step++) {
            const pose = sample('cook', step / 100, { kind, growthStage });
            assert.equal(pose.body.y, 0, `${kind}/${growthStage} leaves its ground/water support`);
        }
    }
    for (const action of ['cook', 'fishing', 'fish']) {
        const art = renderWorkPoseArt(action, 'vegetable-soup');
        assert.match(art, /data-player-operated="true"/);
        assert.doesNotMatch(art, /data-work-(arm|grip|stool|support-stand|helper-cog|joint|second)/, 'tools have no invented anatomy or mechanical scaffold');
    }

});

test('all species and growth stages finish an action without residual lift, rotation, squash or tools', () => {
    for (const kind of species) for (const growthStage of growthStages) for (const action of ['cook', 'fish']) {
        const label = `${kind}/${growthStage}/${action}`;
        for (const progress of [0, .11, .37, .5, .83, 1]) {
            const pose = sample(action, progress, { kind, growthStage, itemId: action === 'fish' ? 'river-fish' : 'vegetable-soup' });
            for (const value of Object.values(pose.body)) assert.ok(Number.isFinite(value), `${label} invalid body transform`);
            assert.ok(pose.body.sx > .75 && pose.body.sx < 1.25 && pose.body.sy > .75 && pose.body.sy < 1.25, `${label} distorts the silhouette`);
        }
        const last = sample(action, 1, { kind, growthStage, itemId: 'river-fish' });
        for (const key of ['x', 'y', 'angle']) near(last.body[key], 0, `${label} restores ${key}`);
        for (const key of ['sx', 'sy']) near(last.body[key], 1, `${label} restores ${key}`);
        assert.equal(last.toolOpacity, 0, `${label} puts away the tool`);
    }
});

// A small DOM/clock harness exercises ownership and cancellation without a browser.
// Browser tests separately verify scene anchoring, native silhouettes and viewport fit.
function harness(t, { kind = 'penguin', secondary = false } = {}) {
    let clock = 101600, nextFrame = 0, scale = 1;
    const frames = new Map(), observers = [], restorers = [];
    function replace(name, value) {
        const old = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        restorers.push(() => old ? Object.defineProperty(globalThis, name, old) : delete globalThis[name]);
    }
    t.mock.method(Date, 'now', () => clock);
    replace('requestAnimationFrame', fn => { frames.set(++nextFrame, fn); return nextFrame; });
    replace('cancelAnimationFrame', id => frames.delete(id));
    replace('document', { visibilityState: 'visible' });
    replace('getComputedStyle', () => ({ getPropertyValue: () => '#56789a' }));
    replace('ResizeObserver', class {
        constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
        observe() {}
        disconnect() { this.disconnected = true; }
    });
    const style = () => ({
        values: new Map(), visibility: '',
        setProperty(name, value) { this.values.set(name, value); },
        getPropertyValue(name) { return this.values.get(name) || ''; },
        removeProperty(name) { this.values.delete(name); if (name === 'transform-origin') delete this.transformOrigin; },
    });
    const rect = (left, top, width, height) => ({ left: left * scale, top: top * scale, width: width * scale, height: height * scale });
    const svg = { classList: [`is-kind-${kind}`, 'is-growth-adult'], getScreenCTM: () => ({ a: 80 / 64 * scale, b: 0, c: 0, d: 80 / 64 * scale, e: 180 * scale, f: 90 * scale }) };
    const avatar = { style: style(), querySelector: () => svg, getBoundingClientRect: () => rect(180, 90, 80, 80) };
    const art = { getBoundingClientRect: () => rect(180, 90, 80, 80) };
    const label = { firstChild: { nodeType: 3, textContent: '' } };
    const stage = { getBoundingClientRect: () => rect(0, 0, 320, 240), querySelector: () => label };
    const originalLimb = { style: { visibility: 'visible' } };
    const secondaryPart = { style: style(), matches: () => kind === 'rabbit' };
    const nodes = new Map();
    const control = {
        dataset: {}, isConnected: true, closest: () => stage,
        querySelectorAll: selector => selector.includes('[data-part="tail"]') ? secondary ? [secondaryPart] : [] : [originalLimb],
        querySelector(selector) {
            if (selector.startsWith(':scope >')) return avatar;
            if (selector === '.tf-pixel-pet') return svg;
            if (selector === '.tf-work-pose-art') return art;
            if (!nodes.has(selector)) nodes.set(selector, { attributes: new Map(), setAttribute(name, value) { this.attributes.set(name, value); } });
            return nodes.get(selector);
        },
    };
    const player = createWorkPosePlayer();
    t.after(() => { player.stop(); restorers.reverse().forEach(restore => restore()); });
    return {
        player, control, avatar, originalLimb, secondaryPart, nodes, observers, frames,
        setClock: value => { clock = value; },
        resize: value => { scale = value; observers.at(-1).callback(); },
        advance(ms) {
            clock += ms;
            const work = [...frames.values()]; frames.clear();
            work.forEach(fn => fn());
        },
        sync: options => player.sync({ control, action: 'cook', startedAt: 100000, duration: 3200, ...options }),
    };
}

test('rerender and resize preserve action time while cancellation restores the source limb and releases callbacks', t => {
    const h = harness(t);
    h.sync();
    assert.equal(h.control.dataset.workProgress, '0.5');
    assert.equal(h.originalLimb.style.visibility, 'visible', 'the original wing remains visible');
    const y = Number.parseFloat(h.avatar.style.values.get('--tf-work-y'));
    const staleFrame = [...h.frames.values()][0], oldObserver = h.observers[0];
    h.sync();
    assert.equal(h.control.dataset.workProgress, '0.5', 'a render must not restart the action');
    assert.equal(oldObserver.disconnected, true);
    assert.equal(h.frames.size, 1, 'there is only one live player loop');
    staleFrame();
    assert.equal(h.frames.size, 1, 'a cancelled callback cannot start a second loop');
    h.resize(1.5);
    near(Number.parseFloat(h.avatar.style.values.get('--tf-work-y')), y * 1.5, 'resize follows the new screen dimensions');
    assert.equal(h.control.dataset.workProgress, '0.5');
    h.advance(400);
    assert.equal(h.control.dataset.workProgress, '0.625');
    const staleResize = h.observers.at(-1).callback;
    h.player.stop();
    assert.equal(h.originalLimb.style.visibility, 'visible');
    assert.equal(h.avatar.style.values.size, 0);
    assert.equal(h.avatar.style.transformOrigin, undefined);
    assert.deepEqual(h.control.dataset, {});
    assert.equal(h.frames.size, 0);
    assert.equal(h.observers.at(-1).disconnected, true);
    staleResize(); staleFrame();
    assert.deepEqual(h.control.dataset, {}, 'stale work cannot resurrect a cancelled pose');
});

test('reduced motion renders a visible static midpoint even when the controller lasts only 120 ms', t => {
    const h = harness(t);
    h.sync({ action: 'fish', itemId: 'river-fish', duration: 120, reduced: true });
    assert.equal(h.control.dataset.workProgress, '0.5');
    assert.equal(h.nodes.get('[data-work-catch]').attributes.get('opacity'), '1');
    assert.equal(h.nodes.get('[data-work-tool]').attributes.get('opacity'), '1');
    assert.equal(h.avatar.style.values.get('--tf-work-angle'), '0deg');
    assert.equal(h.frames.size, 0, 'reduced motion cannot keep animating');
    const grip = h.control.dataset.workGrip;
    h.advance(5000);
    assert.equal(h.control.dataset.workGrip, grip);
    h.sync({ action: 'cook', duration: 120, reduced: true });
    assert.equal(h.control.dataset.workPhase, 'work');
    assert.equal(h.nodes.has('[data-work-stool]'), false, 'no artificial cooking platform is created');
    assert.equal(h.frames.size, 0);
});

test('detaching a control prevents its pending frame from continuing to mutate the page', t => {
    const h = harness(t);
    h.sync();
    const progress = h.control.dataset.workProgress;
    h.control.isConnected = false;
    h.advance(500);
    assert.equal(h.frames.size, 0);
    assert.equal(h.control.dataset.workProgress, progress);
    h.player.stop();
    assert.equal(h.originalLimb.style.visibility, 'visible');
});

test('cancelling species ear and tail gestures restores authored transforms instead of leaving a work pose behind', async t => {
    for (const kind of ['cat', 'rabbit', 'octopus']) await t.test(kind, t => {
        const h = harness(t, { kind, secondary: true });
        h.secondaryPart.style.setProperty('rotate', '3deg');
        h.sync();
        assert.notEqual(h.secondaryPart.style.getPropertyValue('rotate'), '3deg', 'species gesture moves the secondary body part');
        assert.equal(h.secondaryPart.style.getPropertyValue('transform-box'), 'fill-box');
        h.player.stop();
        assert.deepEqual([...h.secondaryPart.style.values], [['rotate', '3deg']], 'cancel restores the authored rotation and removes temporary origins');
        assert.equal(h.avatar.style.values.size, 0, 'species squash and translation are removed');
    });
});

test('stowing either a successful or empty reel removes the float together with the rod', t => {
    const h = harness(t);
    for (const itemId of ['river-fish', '']) {
        h.setClock(100000);
        h.sync({ action: 'fish', itemId, duration: 1600 });
        h.advance(1600);
        for (const selector of ['[data-work-tool]', '[data-work-line]', '[data-work-float]', '[data-work-catch]']) {
            assert.equal(h.nodes.get(selector).attributes.get('opacity'), '0', `${selector} remains after stowing ${itemId || 'an empty hook'}`);
        }
    }
});

test('player-operated tool geometry is independent of species and pet position', () => {
    for (const action of ['cook', 'fishing', 'fish']) {
        const baseline = sample(action, .45);
        for (const kind of species) for (const growthStage of growthStages) {
            const pose = sample(action, .45, { kind, growthStage, geometry: { ...geometry, foot: { x: 999, y: 999 }, shoulder: { x: -500, y: 20 } } });
            assert.deepEqual(pose.grip, baseline.grip, `${kind}/${growthStage}/${action} drags a scene tool with its body`);
            assert.deepEqual(pose.tip, baseline.tip);
        }
    }
});
