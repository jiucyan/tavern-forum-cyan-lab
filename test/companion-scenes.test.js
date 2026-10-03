import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPANION_HABITATS, renderCompanionScene, resolveCompanionScene } from '../src/companion-scenes.js';

const pet = (overrides = {}) => ({ habitat: 'beach', status: 'home', life: { mode: 'active' }, ...overrides });
const home = { habitat: 'beach', temporary: false, reason: '' };

test('a completed interaction restores the chosen habitat without changing saved data', () => {
    const companion = Object.freeze(pet({ life: Object.freeze({ mode: 'active' }) }));
    assert.deepEqual(resolveCompanionScene(companion), home);
    assert.deepEqual(resolveCompanionScene(companion, { action: 'feed' }), { habitat: 'kitchen', temporary: true, reason: 'feed' });
    assert.deepEqual(resolveCompanionScene(companion), home);
    assert.equal(companion.habitat, 'beach');
});

test('food selection leaves the chosen habitat visible even if a prior action is still active', () => {
    for (const state of [{ action: 'feed' }, { cleaning: true }, { game: true }, { sleeping: true }]) {
        assert.deepEqual(resolveCompanionScene(pet(), { ...state, foodMenu: true }), home);
    }
});

test('travel, pause and daycare never switch scenes for local interactions', () => {
    for (const companion of [pet({ status: 'away' }), pet({ life: { mode: 'paused' } }), pet({ life: { mode: 'daycare' } })]) {
        for (const state of [{ action: 'feed' }, { cleaning: true }, { feedbackKind: 'clean' }, { sleeping: true }, { game: true }, { action: 'dance' }]) {
            assert.deepEqual(resolveCompanionScene(companion, state), home);
        }
    }
});

test('washing stays in the bathroom through the active clean feedback and then returns', () => {
    const companion = pet();
    const bathroom = { habitat: 'bathroom', temporary: true, reason: 'clean' };
    assert.deepEqual(resolveCompanionScene(companion, { cleaning: true }), bathroom);
    assert.deepEqual(resolveCompanionScene(companion, { feedbackKind: 'clean' }), bathroom);
    assert.deepEqual(resolveCompanionScene(companion, { feedbackKind: '' }), home);
});

test('resolved sleep or resting status uses the bedroom; a rest action alone does not', () => {
    const bedroom = { habitat: 'bedroom', temporary: true, reason: 'sleep' };
    assert.deepEqual(resolveCompanionScene(pet(), { sleeping: true }), bedroom);
    assert.deepEqual(resolveCompanionScene(pet({ status: 'resting' })), bedroom);
    assert.deepEqual(resolveCompanionScene(pet(), { action: 'rest' }), home);
});

test('games, play and dance use the garden without following stale feeding state', () => {
    const garden = { habitat: 'garden', temporary: true, reason: 'play' };
    for (const state of [{ game: true, action: 'feed' }, { action: 'play' }, { action: 'dance' }]) {
        assert.deepEqual(resolveCompanionScene(pet(), state), garden);
    }
    assert.deepEqual(resolveCompanionScene(pet(), { action: 'pet' }), home);
});

test('scene resolution handles an already-selected interaction room and invalid saved habitats', () => {
    assert.deepEqual(resolveCompanionScene(pet({ habitat: 'kitchen' }), { action: 'feed' }), { habitat: 'kitchen', temporary: false, reason: 'feed' });
    assert.deepEqual(resolveCompanionScene(pet({ habitat: 'not-a-scene' })), { habitat: 'meadow', temporary: false, reason: '' });
    assert.deepEqual(resolveCompanionScene(null), { habitat: 'meadow', temporary: false, reason: '' });
});

test('every automatic destination is a supported scene; newer rooms have their own artwork', () => {
    for (const id of ['kitchen', 'bathroom', 'bedroom', 'garden']) {
        assert.ok(COMPANION_HABITATS.some(scene => scene.id === id), `${id} must be a selectable habitat`);
    }
    for (const id of ['kitchen', 'bathroom', 'garden']) {
        assert.match(renderCompanionScene(id), new RegExp(`data-scene="${id}"`));
    }
});
