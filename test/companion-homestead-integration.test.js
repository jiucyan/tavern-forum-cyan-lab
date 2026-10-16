import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorldState, startHomesteadJourney, advanceCompanionJourney, getCompanionPackingRole, classifyInventoryItem, applyInventoryItemUse } from '../src/world.js';
import { normalizeCompanionLife } from '../src/companion-life.js';
import { ensureHomesteadStarter, changeHomesteadLocation, performHomesteadAction, getCropView, getPetItemCount, CROPS } from '../src/companion-homestead.js';

const T = new Date(2026, 9, 5, 12).getTime(), M = 60000;
const timing = { travelDurationPreset: 'custom', travelMinMinutes: 10, travelMaxMinutes: 10, travelMessageMinMinutes: 3, travelMessageMaxMinutes: 3 };
function data() {
    const state = { world: normalizeWorldState({ companion: { name: '团子', species: '青蛙', status: 'home', satiety: 75, energy: 80,
        life: normalizeCompanionLife({ autoSleep: false }, T) } }) };
    ensureHomesteadStarter(state, T);
    return state;
}
const row = (state, itemId) => state.world.inventory.find(entry => entry.petItemId === itemId);
const explore = state => { for (const location of ['yard', 'forest', 'river', 'forest', 'yard', 'home']) changeHomesteadLocation(state, location, T); };
const start = (state, destination = 'forest', options = {}) => startHomesteadJourney(state, destination, timing, { now: T, random: () => .5, ...options });

test('world save normalization retains homestead progression and stable inventory catalogue IDs', () => {
    const state = data();
    changeHomesteadLocation(state, 'yard', T);
    performHomesteadAction(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' }, T);
    performHomesteadAction(state, 'water', { plotId: 'plot-1' }, T);
    changeHomesteadLocation(state, 'forest', T);
    performHomesteadAction(state, 'gather', { nodeId: 'berry-bush' }, T);
    const expectedHome = structuredClone(state.world.companion.homestead), ids = state.world.inventory.map(entry => [entry.id, entry.petItemId, entry.quantity]);
    state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
    assert.deepEqual(state.world.companion.homestead, expectedHome);
    assert.deepEqual(state.world.inventory.map(entry => [entry.id, entry.petItemId, entry.quantity]), ids);
    assert.equal(ensureHomesteadStarter(state, T + M).changed, false);
    assert.equal(getCropView(state.world.companion.homestead.plots[0], T + 5 * M).stage, 'ready');
    assert.equal(normalizeWorldState({ inventory: [{ id: 'bad', petItemId: '__proto__' }] }).inventory[0].petItemId, '');
    assert.equal(normalizeWorldState({ inventory: [{ id: 'unknown', petItemId: 'new-secret-item' }] }).inventory[0].petItemId, '');
    assert.equal(normalizeWorldState({}).inventory.length, 0, 'loading old data must not award starter supplies');
});

test('local journeys require discovering the route and preparing at home without leaving ghost trips', () => {
    const state = data();
    assert.throws(() => start(state), /先陪它走到/);
    assert.equal(state.world.trips.length, 0);
    changeHomesteadLocation(state, 'yard', T);
    changeHomesteadLocation(state, 'forest', T);
    assert.throws(() => start(state), /先回小窝/);
    assert.equal(state.world.trips.length, 0);
    changeHomesteadLocation(state, 'yard', T);
    changeHomesteadLocation(state, 'home', T);
    state.world.companion.packedItemIds = ['missing-item'];
    assert.throws(() => start(state), /行囊物品/);
    assert.equal(state.world.trips.length, 0);
    assert.equal(state.world.companion.status, 'home');
    assert.equal(getPetItemCount(state, 'bento'), 1);
});

test('local departure consumes packed food exactly once and carries seeds and tools intact', () => {
    const state = data(); explore(state);
    const bento = row(state, 'bento'), shovel = row(state, 'shovel'), seed = row(state, 'carrot-seed');
    state.world.companion.packedItemIds = [bento.id, shovel.id, seed.id];
    const result = start(state);
    assert.equal(result.trip.homesteadDestination, 'forest');
    assert.equal(result.trip.status, 'away');
    assert.equal(result.trip.plannedDurationMinutes, 9);
    assert.equal(result.trip.returnAt, T + 9 * M);
    assert.equal(row(state, 'bento').quantity, 0);
    assert.equal(row(state, 'bento').consumed, true);
    assert.equal(row(state, 'shovel').quantity, 1);
    assert.equal(row(state, 'carrot-seed').quantity, 2);
    assert.deepEqual(result.trip.packingItems.map(entry => entry.consumed), [1, 0, 0]);
    assert.equal(getPetItemCount(state, 'shovel'), 0, 'carried tools are locked until return');
    assert.throws(() => start(state), /已经出发/);
    assert.equal(state.world.trips.length, 1);
    assert.equal(row(state, 'carrot-seed').quantity, 2);
});

test('timed local returns award the destination seeds once across reloads and leave crops growing offline', () => {
    for (const [destination, reward] of [['forest', 'strawberry-seed'], ['river', 'turnip-seed']]) {
        const state = data(); explore(state);
        changeHomesteadLocation(state, 'yard', T);
        performHomesteadAction(state, 'plant', { plotId: 'plot-1', cropId: 'carrot' }, T);
        performHomesteadAction(state, 'water', { plotId: 'plot-1' }, T);
        changeHomesteadLocation(state, 'home', T);
        const result = start(state, destination), returnAt = result.trip.returnAt;
        const seedId = row(state, reward).id;
        const interim = advanceCompanionJourney(state, { now: T + 4 * M });
        assert.equal(interim.returned, false);
        assert.ok(interim.delivered.length > 0);
        assert.equal(getPetItemCount(state, reward), 2);
        state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
        assert.equal(state.world.trips[0].homesteadDestination, destination);
        const returned = advanceCompanionJourney(state, { now: returnAt });
        assert.equal(returned.returned, true);
        assert.equal(state.world.companion.status, 'home');
        assert.equal(state.world.companion.homestead.location, 'home');
        assert.equal(getPetItemCount(state, reward), 4);
        assert.equal(row(state, reward).id, seedId);
        assert.equal(state.world.trips[0].homesteadRewardClaimedAt, returnAt);
        assert.equal(getCropView(state.world.companion.homestead.plots[0], returnAt).stage, 'ready');
        state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
        assert.equal(state.world.trips[0].homesteadRewardClaimedAt, returnAt);
        assert.equal(advanceCompanionJourney(state, { now: returnAt + M }).returned, false);
        assert.equal(getPetItemCount(state, reward), 4);
    }
});

test('recalling a local trip suppresses seed rewards and skips letters without refunding packed food', () => {
    const state = data(); explore(state);
    state.world.companion.packedItemIds = [row(state, 'bento').id];
    const result = start(state, 'river');
    const returned = advanceCompanionJourney(state, { now: T + 1000, forceReturn: true });
    assert.equal(returned.returned, true);
    assert.equal(returned.trip.recalled, true);
    assert.equal(returned.trip.homesteadRewardClaimedAt, 0);
    assert.ok(returned.trip.messages.every(entry => entry.skippedAt && !entry.deliveredAt));
    assert.equal(getPetItemCount(state, 'turnip-seed'), 2);
    assert.equal(getPetItemCount(state, 'bento'), 0);
    state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
    advanceCompanionJourney(state, { now: result.trip.returnAt + M });
    assert.equal(getPetItemCount(state, 'turnip-seed'), 2);
});

test('catalogue seeds and tools cannot be eaten or consumed by ordinary inventory actions', () => {
    for (const itemId of [...CROPS.map(crop => crop.seedId), 'shovel', 'watering-can']) {
        for (const requestedUse of ['auto', 'companion', 'story', 'medical']) {
            const state = data(), item = row(state, itemId), before = item.quantity;
            assert.equal(getCompanionPackingRole(item).kind, 'tool');
            assert.equal(classifyInventoryItem(item), 'story');
            const result = applyInventoryItemUse(state, item.id, requestedUse);
            assert.equal(result.applied, false, `${itemId} must reject ${requestedUse} ordinary consumption`);
            assert.equal(row(state, itemId).quantity, before);
            assert.equal(state.world.companion.satiety, 75);
        }
    }
});

test('paused, sleeping and low-energy pets cannot start local journeys or spend supplies', () => {
    for (const setup of [
        companion => { companion.life.mode = 'paused'; },
        companion => { companion.life.mode = 'daycare'; },
        companion => { companion.life.sleepUntil = T + M; },
        companion => { companion.energy = 14; },
        companion => { companion.satiety = 9; },
    ]) {
        const state = data(); explore(state);
        state.world.companion.packedItemIds = [row(state, 'bento').id];
        setup(state.world.companion);
        assert.throws(() => start(state));
        assert.equal(state.world.trips.length, 0);
        assert.equal(getPetItemCount(state, 'bento'), 1);
    }
});

test('a full inventory never strands a returning pet and pending seeds settle once after space is available', () => {
    const state = data(); explore(state);
    row(state, 'strawberry-seed').quantity = 9999;
    while (state.world.inventory.length < 300) state.world.inventory.push({ id: `filler-${state.world.inventory.length}`, name: '纪念物', quantity: 1 });
    const journey = start(state), now = journey.trip.returnAt;
    const returned = advanceCompanionJourney(state, { now });
    assert.equal(returned.returned, true);
    assert.equal(state.world.companion.status, 'home');
    assert.equal(returned.trip.homesteadRewardClaimedAt, 0);
    assert.match(state.world.companion.message, /种子已替你留好/);
    assert.equal(getPetItemCount(state, 'strawberry-seed'), 9999);
    assert.equal(advanceCompanionJourney(state, { now: now + 1 }).changed, false);
    state.world.inventory.pop();
    state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
    const settled = advanceCompanionJourney(state, { now: now + 2 });
    assert.equal(settled.changed, true);
    assert.equal(getPetItemCount(state, 'strawberry-seed'), 10001);
    assert.equal(settled.trip.homesteadRewardClaimedAt, now + 2);
    assert.equal(advanceCompanionJourney(state, { now: now + 3 }).changed, false);
    assert.equal(getPetItemCount(state, 'strawberry-seed'), 10001);
});
