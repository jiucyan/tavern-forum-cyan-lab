import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCompanionLife, startCompanionGame } from '../src/companion-life.js';
import { CROPS, PET_ITEMS, RESOURCE_NODES, HOMESTEAD_LOCATIONS, normalizeHomestead, ensureHomesteadStarter, getPetItemCount, addPetItem, getCropView, changeHomesteadLocation, performHomesteadAction } from '../src/companion-homestead.js';

const T = new Date(2026, 9, 5, 12).getTime(), M = 60000;
const data = () => ({ world: { companion: { name: '团子', species: '青蛙', status: 'home', satiety: 40, energy: 70, happiness: 60, bond: 2,
    life: normalizeCompanionLife({ autoSleep: false }, T), homestead: normalizeHomestead() }, inventory: [], trips: [] } });
const starter = () => { const state = data(); ensureHomesteadStarter(state, T); return state; };
const plot = (state, id = 'plot-1') => state.world.companion.homestead.plots.find(entry => entry.id === id);
const act = (state, action, options = {}, now = T) => performHomesteadAction(state, action, options, now);
const row = (state, itemId) => state.world.inventory.find(entry => entry.petItemId === itemId);
const travel = (state, ids, now = T) => { for (const id of ids) changeHomesteadLocation(state, id, now); };

test('old and malformed saves get a fixed, pure homestead shape without awarding inventory', () => {
    const blank = normalizeHomestead();
    assert.equal(blank.location, 'home');
    assert.deepEqual(blank.visited, ['home']);
    assert.equal(blank.starterGranted, false);
    assert.equal(blank.plots.length, 6);
    assert.equal(Object.keys(blank.nodes).length, RESOURCE_NODES.length);
    const raw = { location: 'river', starterGranted: 'yes', visited: ['unknown', 'forest', 'forest'], plots: [
        { id: 'plot-1', cropId: 'not-a-crop', plantedAt: T },
        { id: 'plot-2', cropId: 'carrot', plantedAt: T, wateredAt: -1, readyAt: Infinity },
        { id: 'plot-3', cropId: 'turnip', plantedAt: T, wateredAt: T - 1000, readyAt: -3 },
        { id: 'plot-99', cropId: 'carrot', plantedAt: T },
    ], nodes: { 'berry-bush': -100, 'river-stones': Infinity, unknown: T } };
    const before = structuredClone(raw), normalized = normalizeHomestead(raw);
    assert.deepEqual(raw, before);
    assert.deepEqual(normalized.visited, ['home', 'forest', 'river']);
    assert.equal(normalized.starterGranted, false);
    assert.equal(normalized.plots[0].cropId, '');
    assert.equal(normalized.plots[1].wateredAt, 0);
    assert.equal(normalized.plots[2].wateredAt, T);
    assert.equal(normalized.plots[2].readyAt, T + 10 * M);
    assert.equal(Object.hasOwn(normalized.nodes, 'unknown'), false);
    assert.deepEqual(normalizeHomestead(normalized), normalized);
});

test('starter supplies arrive only on explicit first entry and survive save round trips', () => {
    const state = data();
    state.world.companion.homestead = normalizeHomestead(state.world.companion.homestead);
    assert.equal(state.world.inventory.length, 0);
    assert.equal(ensureHomesteadStarter(state, T).changed, true);
    for (const crop of CROPS) assert.equal(getPetItemCount(state, crop.seedId), 2);
    for (const id of ['shovel', 'watering-can', 'bento']) assert.equal(getPetItemCount(state, id), 1);
    const saved = JSON.parse(JSON.stringify(state));
    saved.world.companion.homestead = normalizeHomestead(saved.world.companion.homestead);
    assert.equal(ensureHomesteadStarter(saved, T + M).changed, false);
    assert.deepEqual(saved.world.inventory, state.world.inventory);
    assert.equal(new Set(saved.world.inventory.map(entry => entry.id)).size, 6);
});

test('seed, food, tool, and material classification never relies on ambiguous item names', () => {
    for (const crop of CROPS) {
        assert.equal(PET_ITEMS[crop.seedId].kind, 'seed');
        assert.equal(PET_ITEMS[crop.seedId].packRole, 'tool');
        assert.equal(PET_ITEMS[crop.produceId].kind, 'food');
        assert.equal(PET_ITEMS[crop.produceId].packRole, 'food');
    }
    const state = starter(), before = structuredClone(state);
    assert.throws(() => act(state, 'feed', { itemId: 'carrot-seed' }), /不能喂食/);
    assert.throws(() => act(state, 'feed', { itemId: 'constructor' }), /不能喂食/);
    assert.deepEqual(state, before);
    assert.equal(getPetItemCount(state, 'constructor'), 0);
});

test('adjacent paths connect the outdoor places and preserve the decorated room and selected habitat', () => {
    const state = starter(), companion = state.world.companion;
    companion.room = { custom: true, items: [{ id: 'my-sofa' }] };
    companion.habitat = 'space';
    assert.throws(() => changeHomesteadLocation(state, 'river', T), /相邻/);
    travel(state, ['yard', 'forest', 'river']);
    assert.deepEqual(companion.homestead.visited, HOMESTEAD_LOCATIONS.filter(entry => entry.id !== 'kitchen').map(entry => entry.id));
    assert.equal(changeHomesteadLocation(state, 'river', T).changed, false);
    travel(state, ['forest', 'yard', 'home']);
    assert.equal(companion.homestead.location, 'home');
    assert.equal(companion.habitat, 'space');
    assert.deepEqual(companion.room, { custom: true, items: [{ id: 'my-sofa' }] });
});

test('planting consumes one shared seed, repeated taps cannot plant twice, and watering starts the clock once', () => {
    const state = starter();
    assert.throws(() => act(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' }), /庭院/);
    travel(state, ['yard']);
    act(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' });
    assert.equal(getPetItemCount(state, 'carrot-seed'), 1);
    assert.equal(getPetItemCount(state, 'shovel'), 1);
    assert.equal(getCropView(plot(state), T + 100 * M).stage, 'dry');
    const before = structuredClone(state);
    assert.throws(() => act(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' }), /已经种下/);
    assert.deepEqual(state, before);
    act(state, 'water', { plotId: 'plot-1' }, T + M);
    assert.equal(plot(state).readyAt, T + 6 * M);
    assert.equal(getPetItemCount(state, 'watering-can'), 1);
    assert.equal(act(state, 'water', { plotId: 'plot-1' }, T + 2 * M).changed, false);
    assert.equal(plot(state).readyAt, T + 6 * M);
    assert.equal(getCropView(plot(state), T + M).stage, 'sprout');
    assert.equal(getCropView(plot(state), T + 3 * M).stage, 'growing');
});

test('persisted crop deadlines mature offline, survive long absence, and reward only one harvest', () => {
    const state = starter();
    travel(state, ['yard']);
    act(state, 'plant', { plotId: 'plot-1', cropId: 'strawberry' });
    act(state, 'water', { plotId: 'plot-1' });
    assert.throws(() => act(state, 'harvest', { plotId: 'plot-1' }, T + M), /再等等/);
    const saved = JSON.parse(JSON.stringify(state));
    saved.world.companion.homestead = normalizeHomestead(saved.world.companion.homestead);
    assert.equal(getCropView(plot(saved), T - M).progress, 0);
    assert.equal(getCropView(plot(saved), T + 15 * M).stage, 'ready');
    assert.equal(getCropView(plot(saved), T + 180 * 24 * 60 * M).stage, 'ready');
    act(saved, 'harvest', { plotId: 'plot-1' }, T + 180 * 24 * 60 * M);
    assert.equal(getPetItemCount(saved, 'strawberry'), 3);
    assert.equal(getCropView(plot(saved), T).stage, 'empty');
    assert.throws(() => act(saved, 'harvest', { plotId: 'plot-1' }, T + 180 * 24 * 60 * M), /没有可以收获/);
    assert.equal(getPetItemCount(saved, 'strawberry'), 3);
});

test('resource cooldowns survive reload and neither double taps nor clock rollback duplicate rewards', () => {
    const state = starter(), node = RESOURCE_NODES.find(entry => entry.id === 'berry-bush');
    assert.throws(() => act(state, 'gather', { nodeId: node.id }), /林间小径/);
    travel(state, ['yard', 'forest']);
    act(state, 'gather', { nodeId: node.id });
    assert.equal(getPetItemCount(state, 'berry'), 2);
    const saved = JSON.parse(JSON.stringify(state));
    saved.world.companion.homestead = normalizeHomestead(saved.world.companion.homestead);
    assert.throws(() => act(saved, 'gather', { nodeId: node.id }), /刚刚采集/);
    assert.throws(() => act(saved, 'gather', { nodeId: node.id }, T - 1000), /刚刚采集/);
    act(saved, 'gather', { nodeId: node.id }, T + node.cooldownMs);
    assert.equal(getPetItemCount(saved, 'berry'), 4);
    assert.equal(saved.world.inventory.filter(entry => entry.petItemId === 'berry').length, 1);
});

test('home recipes form a repeatable crop-to-seed and forage-to-bento loop without overspending', () => {
    const state = starter();
    travel(state, ['yard']);
    act(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' });
    act(state, 'water', { plotId: 'plot-1' });
    act(state, 'harvest', { plotId: 'plot-1' }, T + 5 * M);
    travel(state, ['forest'], T + 5 * M);
    act(state, 'gather', { nodeId: 'berry-bush' }, T + 5 * M);
    assert.throws(() => act(state, 'cook'), /小窝/);
    travel(state, ['yard', 'home'], T + 5 * M);
    act(state, 'exchange', { cropId: 'carrot' }, T + 5 * M);
    assert.equal(getPetItemCount(state, 'carrot-seed'), 3);
    assert.equal(getPetItemCount(state, 'carrot'), 2);
    act(state, 'cook', {}, T + 5 * M);
    assert.equal(getPetItemCount(state, 'berry'), 0);
    assert.equal(getPetItemCount(state, 'bento'), 2);
    act(state, 'cook', {}, T + 5 * M);
    assert.equal(getPetItemCount(state, 'carrot'), 0);
    assert.equal(getPetItemCount(state, 'bento'), 3);
    const before = structuredClone(state);
    assert.throws(() => act(state, 'cook', {}, T + 5 * M), /两份/);
    assert.throws(() => act(state, 'exchange', { cropId: 'carrot' }, T + 5 * M), /不足/);
    assert.deepEqual(state, before);
});

test('feeding uses shared inventory and existing care cooldowns without eating seeds or overfilling stats', () => {
    const state = starter();
    addPetItem(state, 'bento', 3, T);
    const id = row(state, 'bento').id;
    state.world.companion.packedItemIds = [id];
    act(state, 'feed', { itemId: 'bento' });
    assert.equal(state.world.companion.satiety, 64);
    assert.equal(state.world.companion.bond, 3);
    assert.equal(row(state, 'bento').quantity, 3);
    act(state, 'feed', { itemId: 'bento' });
    assert.equal(state.world.companion.bond, 3);
    act(state, 'feed', { itemId: 'bento' });
    assert.equal(state.world.companion.satiety, 100);
    assert.equal(row(state, 'bento').quantity, 1);
    assert.equal(state.world.companion.life.foodLikes[0].count, 1);
});

test('traveling tools and supplies remain locked but mere packing selections do not reserve them', () => {
    const state = starter();
    travel(state, ['yard']);
    const shovel = row(state, 'shovel'), seed = row(state, 'carrot-seed');
    state.world.companion.packedItemIds = [seed.id];
    state.world.trips.push({ status: 'away', packingItems: [{ id: shovel.id, consumed: 0 }] });
    assert.equal(getPetItemCount(state, 'shovel'), 0);
    const before = structuredClone(state);
    assert.throws(() => act(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' }), /正随旅伴旅行/);
    assert.deepEqual(state, before);
    state.world.trips[0].status = 'returned';
    act(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' });
    assert.equal(getPetItemCount(state, 'carrot-seed'), 1);
    state.world.trips.push({ status: 'away', packingItems: [{ id: seed.id, consumed: 0 }] });
    assert.throws(() => act(state, 'plant', { plotId: 'plot-2', cropId: 'carrot' }), /正随旅伴旅行/);
    assert.equal(row(state, 'carrot-seed').quantity, 1);
});

test('away, sleep, pause, daycare, and games block both movement and local actions without mutations', () => {
    for (const setup of [
        companion => { companion.status = 'away'; },
        companion => { companion.life.sleepUntil = T + M; },
        companion => { companion.life.mode = 'paused'; },
        companion => { companion.life.mode = 'daycare'; },
        companion => { startCompanionGame(companion, 'catch', T, () => .5); },
    ]) {
        const state = starter();
        setup(state.world.companion);
        const before = structuredClone(state);
        assert.throws(() => changeHomesteadLocation(state, 'yard', T));
        assert.throws(() => act(state, 'feed', { itemId: 'bento' }));
        assert.deepEqual(state, before);
    }
});

test('all successful gathering and cooking additions stack by catalogue ID without touching similar named foreign items', () => {
    const state = data();
    state.world.inventory.push({ id: 'story-berry', name: PET_ITEMS.berry.name, quantity: 9, consumed: false });
    addPetItem(state, 'berry', 2, T);
    const berryId = row(state, 'berry').id;
    addPetItem(state, 'berry', 2, T);
    assert.equal(getPetItemCount(state, 'berry'), 4);
    assert.equal(row(state, 'berry').id, berryId);
    assert.equal(state.world.inventory[0].quantity, 9);
    act(state, 'cook');
    act(state, 'cook');
    assert.equal(row(state, 'berry').consumed, true);
    addPetItem(state, 'berry', 1, T + M);
    assert.equal(row(state, 'berry').id, berryId);
    assert.equal(row(state, 'berry').consumed, false);
    assert.equal(getPetItemCount(state, 'berry'), 1);
});

test('full inventory failures are atomic for starter gifts, harvesting, and recipes', () => {
    const full = data();
    full.world.inventory = Array.from({ length: 300 }, (_, index) => ({ id: `story-${index}`, quantity: 1 }));
    const initial = structuredClone(full);
    assert.throws(() => ensureHomesteadStarter(full, T), /装满/);
    assert.deepEqual(full, initial);
    const state = starter();
    addPetItem(state, 'berry', 2, T);
    state.world.inventory = state.world.inventory.filter(entry => entry.petItemId !== 'bento');
    while (state.world.inventory.length < 300) state.world.inventory.push({ id: `story-${state.world.inventory.length}`, quantity: 1 });
    let before = structuredClone(state);
    assert.throws(() => act(state, 'cook'), /装满/);
    assert.deepEqual(state, before);
    travel(state, ['yard']);
    act(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' });
    act(state, 'water', { plotId: 'plot-1' });
    before = structuredClone(state);
    assert.throws(() => act(state, 'harvest', { plotId: 'plot-1' }, T + 5 * M), /装满/);
    assert.deepEqual(state, before);
});

test('catalogue rewards validate amounts and preserve unique IDs when an existing stack is full', () => {
    const state = data();
    addPetItem(state, 'berry', 9999, T);
    addPetItem(state, 'berry', 2, T);
    assert.equal(getPetItemCount(state, 'berry'), 10001);
    assert.notEqual(state.world.inventory[0].id, state.world.inventory[1].id);
    const before = structuredClone(state);
    for (const amount of [0, -1, 1.5, Infinity, 10000]) assert.throws(() => addPetItem(state, 'berry', amount, T), /数量/);
    assert.throws(() => addPetItem(state, '__proto__', 1, T), /没有找到/);
    assert.deepEqual(state, before);
});
