import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPANION_HABITATS, renderCompanionScene, resolveCompanionScene, resolveCompanionDisplayScene } from '../src/companion-scenes.js';

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

test('every automatic destination is a supported scene', () => {
    for (const id of ['kitchen', 'bathroom', 'bedroom', 'garden']) {
        assert.ok(COMPANION_HABITATS.some(scene => scene.id === id), `${id} must be a selectable habitat`);
    }
});

test('every selectable habitat renders a distinct complete scalable scene', () => {
    const markup = COMPANION_HABITATS.map(({ id }) => renderCompanionScene(id));
    assert.equal(new Set(markup).size, COMPANION_HABITATS.length, 'selectable habitats must not share a generic fallback');
    for (const [index, scene] of COMPANION_HABITATS.entries()) {
        const art = markup[index];
        assert.match(art, /^<svg\b/, `${scene.id}: scalable scene root`);
        assert.match(art, /<\/svg>$/, `${scene.id}: complete scene`);
        assert.match(art, /viewBox="0 0 320 240"/, `${scene.id}: same room coordinate system`);
        assert.match(art, new RegExp(`data-scene="${scene.id}"`), `${scene.id}: scene identity`);
        assert.match(art, /aria-hidden="true"/, `${scene.id}: decorative artwork does not duplicate accessibility controls`);
        assert.doesNotMatch(art, /<(?:image|foreignObject|script)\b|\son\w+=/, `${scene.id}: scene works offline as native, non-interactive art`);
    }
    assert.equal(renderCompanionScene('not-a-scene'), '', 'unsupported scene has no mislabeled artwork');
});

test('indoor scene metadata protects rooms from outdoor weather', () => {
    for (const id of ['bedroom', 'space', 'arcade', 'kitchen', 'bathroom', 'library']) {
        assert.match(renderCompanionScene(id), /data-indoor="true"/, `${id}: enclosed scene`);
    }
    for (const id of ['meadow', 'pond', 'forest', 'snowfield', 'city', 'garden', 'beach', 'fairground']) {
        assert.match(renderCompanionScene(id), /data-indoor="false"/, `${id}: outdoor scene`);
    }
});

test('all fourteen selectable scenes keep their actual identity, label and physical environment without mutating saves', () => {
    for (const scene of COMPANION_HABITATS) {
        const companion = pet({ habitat: scene.id, room: { enabled: false, items: [] }, homestead: { location: 'home', visited: ['home'] } });
        const before = structuredClone(companion);
        const view = resolveCompanionDisplayScene(companion);
        assert.equal(view.id, `habitat:${scene.id}`);
        assert.equal(view.habitat, scene.id);
        assert.equal(view.label, scene.name);
        assert.equal(view.location, 'home');
        assert.equal(view.indoor, scene.indoor === true);
        assert.equal(view.outdoors, !scene.indoor);
        assert.equal(view.homestead, false);
        assert.equal(view.customized, false);
        assert.equal(view.temporary, false);
        assert.equal(view.homeStations, false, 'catalogue scenes retain their own furnishings without extra room stations');
        assert.equal(view.aquaticLocation, scene.indoor ? 'home' : `habitat:${scene.id}`);
        assert.deepEqual(companion, before, scene.id);
    }
    const invalid = resolveCompanionDisplayScene(null);
    assert.equal(invalid.id, 'habitat:meadow');
    assert.equal(invalid.label, '风吹草地');
});

test('real homestead destinations and the decorated home have distinct descriptor identities', () => {
    const destinations = [['yard', 'garden', '庭院'], ['forest', 'forest', '林间小径'], ['river', 'pond', '河边'], ['kitchen', 'kitchen', '小厨房']];
    for (const [location, habitat, label] of destinations) {
        const companion = pet({ room: { enabled: true }, homestead: { location } });
        const view = resolveCompanionDisplayScene(companion);
        assert.equal(view.id, `homestead:${location}`);
        assert.equal(view.habitat, habitat);
        assert.equal(view.label, label);
        assert.equal(view.location, location);
        assert.equal(view.homestead, true);
        assert.equal(view.indoor, location === 'kitchen');
        assert.equal(view.customized, false);
        assert.equal(view.homeStations, false);
        assert.equal(view.aquaticLocation, location);
        assert.equal(companion.room.enabled, true, 'visiting another place preserves the home layout');
    }
    const home = resolveCompanionDisplayScene(pet({ room: { enabled: true }, homestead: { location: 'home' } }));
    assert.equal(home.id, 'custom-room');
    assert.equal(home.customized, true);
    assert.equal(home.homeStations, true);
    assert.equal(home.indoor, true);
    assert.equal(home.aquaticLocation, 'home');
});

test('temporary care owns the visible scene until completion and never changes the actual walking destination', () => {
    const companion = pet({ room: { enabled: true }, homestead: { location: 'river' } });
    const before = structuredClone(companion);
    for (const [state, habitat, reason] of [
        [{ action: 'feed' }, 'kitchen', 'feed'], [{ cleaning: true }, 'bathroom', 'clean'],
        [{ sleeping: true }, 'bedroom', 'sleep'], [{ game: true }, 'garden', 'play'], [{ action: 'dance' }, 'garden', 'play'],
    ]) {
        const view = resolveCompanionDisplayScene(companion, state);
        assert.equal(view.id, `habitat:${habitat}`);
        assert.equal(view.reason, reason);
        assert.equal(view.temporary, true);
        assert.equal(view.homestead, false);
        assert.equal(view.homeStations, false);
        assert.equal(view.location, 'river');
    }
    assert.equal(resolveCompanionDisplayScene(companion).id, 'homestead:river');
    assert.equal(resolveCompanionDisplayScene(companion, { foodMenu: true, action: 'feed' }).id, 'homestead:river');
    assert.deepEqual(companion, before);

    const room = pet({ room: { enabled: true }, homestead: { location: 'home' } });
    const resting = resolveCompanionDisplayScene(room, { roomCare: true, sleeping: true });
    assert.equal(resting.id, 'custom-room');
    assert.equal(resting.reason, 'room-care');
    assert.equal(resting.homeStations, false);
    assert.equal(resolveCompanionDisplayScene(room, { action: 'feed' }).id, 'habitat:kitchen');
    assert.equal(resolveCompanionDisplayScene(pet({ habitat: 'kitchen' }), { action: 'feed' }).temporary, false);
});

test('aquatic care preserves the actual scene while games, travel and inactive modes keep their existing priorities', () => {
    const companion = pet({ habitat: 'meadow', homestead: { location: 'river' } });
    for (const state of [{ action: 'feed' }, { cleaning: true }, { sleeping: true }, { roomCare: true }, { action: 'dance' }]) {
        const view = resolveCompanionDisplayScene(companion, { ...state, aquatic: true });
        assert.equal(view.id, 'homestead:river');
        assert.equal(view.reason, '');
        assert.equal(view.aquaticLocation, 'river');
        assert.equal(view.temporary, false);
    }
    assert.equal(resolveCompanionDisplayScene(companion, { aquatic: true, game: true }).id, 'habitat:garden');
    const away = resolveCompanionDisplayScene({ ...companion, status: 'away' }, { aquatic: true, cleaning: true, sleeping: true });
    assert.equal(away.id, 'habitat:meadow');
    assert.equal(away.reason, '');
    assert.equal(away.homestead, false);
    assert.equal(away.homeStations, false);
    for (const mode of ['paused', 'daycare']) {
        const view = resolveCompanionDisplayScene({ ...companion, life: { mode } }, { cleaning: true, game: true });
        assert.equal(view.id, 'homestead:river');
        assert.equal(view.reason, '');
    }
    const openMeadow = resolveCompanionDisplayScene(pet({ habitat: 'meadow' }), { aquatic: true, action: 'feed' });
    assert.equal(openMeadow.id, 'habitat:meadow');
    assert.equal(openMeadow.aquaticLocation, 'habitat:meadow');
    assert.equal(openMeadow.homeStations, false);
});
