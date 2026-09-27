import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorldState, applyInventoryItemUse, applyWorldUpdates } from '../src/world.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';
import { normalizeCompanionLife, advanceCompanionLife, getCompanionLifeView, recordCompanionCare, setCompanionLifeMode, tendCompanion, startCompanionGame, advanceCompanionGame, getCompanionGameFrame, buyCompanionItem, useCompanionToy, setCompanionDisplay } from '../src/companion-life.js';
import { arcadeInput } from '../src/companion-games.js';
import { decorateCompanionLife } from '../src/companion-life-ui.js';

const T = new Date(2026, 8, 26, 12).getTime(), M = 60000, H = 60 * M;
const pet = () => ({ name: '团子', species: '青蛙', status: 'home', satiety: 75, energy: 80, happiness: 70, bond: 8, life: normalizeCompanionLife({ autoSleep: false }, T) });
const data = () => ({ world: normalizeWorldState({ companion: pet(), inventory: [] }) });

test('migration preserves identity, achievements and care cooldown timestamps', () => {
    const companion = pet(); recordCompanionCare(companion, 'feed', { now: T, food: { id: 'berry', name: '莓果' } });
    const world = normalizeWorldState({ companion });
    assert.equal(world.companion, companion);
    assert.equal(recordCompanionCare(companion, 'feed', { now: T + M }), false);
    assert.equal(companion.life.actionAt.feed, T);
    assert.equal(companion.bond, 8); assert.equal(companion.species, '青蛙');
    assert.equal(companion.life.diary.length, 1);
});

test('elapsed needs remain equivalent across normalization and small clock steps', () => {
    const once = pet(), frequent = pet();
    advanceCompanionLife(once, T + 2 * H);
    for (let i = 1; i <= 120; i++) { advanceCompanionLife(frequent, T + i * M); normalizeWorldState({ companion: frequent }); }
    assert.deepEqual([once.satiety, once.energy, once.happiness, once.life.cleanliness], [frequent.satiety, frequent.energy, frequent.happiness, frequent.life.cleanliness]);
    assert.equal(once.satiety, 71); assert.equal(once.energy, 74);
});

test('offline decay is capped and cannot kill or raise a neglected pet', () => {
    const companion = pet(); companion.satiety = 11; companion.energy = 3;
    advanceCompanionLife(companion, T + 90 * 24 * H);
    assert.equal(companion.satiety, 10); assert.equal(companion.energy, 3);
    assert.equal(companion.life.growthMinutes, 480);
    const before = structuredClone(companion); assert.equal(advanceCompanionLife(companion, T), false); assert.deepEqual(companion, before);
});

test('pause freezes growth, daycare maintains needs, resume accrues no paused debt', () => {
    const companion = pet(); setCompanionLifeMode(companion, 'paused', T);
    advanceCompanionLife(companion, T + 8 * H); assert.equal(companion.life.growthMinutes, 0); assert.equal(companion.satiety, 75);
    setCompanionLifeMode(companion, 'daycare', T + 8 * H); advanceCompanionLife(companion, T + 16 * H);
    assert.equal(companion.life.growthMinutes, 480); assert.equal(companion.energy, 80);
    setCompanionLifeMode(companion, 'active', T + 16 * H); advanceCompanionLife(companion, T + 17 * H); assert.equal(companion.energy, 77);
});

test('night schedule crosses midnight; sleep restores gradually and wake overrides for two hours', () => {
    const companion = pet(), night = new Date(2026, 8, 26, 23).getTime();
    companion.life.autoSleep = true; companion.life.lastTickAt = night; companion.energy = 30;
    assert.equal(getCompanionLifeView(companion, night).sleeping, true);
    advanceCompanionLife(companion, night + H); assert.equal(companion.energy, 42);
    tendCompanion(companion, 'wake', night + H); assert.equal(getCompanionLifeView(companion, night + H).sleeping, false);
    assert.equal(getCompanionLifeView(companion, night + 3 * H).sleeping, true);
    const day = pet(); tendCompanion(day, 'rest', T); assert.equal(day.energy, 80);
    advanceCompanionLife(day, T + H); assert.equal(day.energy, 92); assert.equal(day.status, 'home');
});

test('cleaning and long-term preferences resist repeated immediate clicks', () => {
    const companion = pet(); companion.life.cleanliness = 20;
    tendCompanion(companion, 'clean', T); tendCompanion(companion, 'clean', T + 10);
    assert.equal(companion.life.cleanliness, 55);
    for (let i = 0; i < 3; i++) recordCompanionCare(companion, 'feed', { now: T + i * 10 * M, food: { id: 'berry', name: '莓果' } });
    assert.equal(getCompanionLifeView(companion, T).favoriteFood.name, '莓果');
    assert.equal(getCompanionLifeView(companion, T).personality, '安稳');
    assert.equal(companion.life.diary.filter(note => /喜欢上/.test(note.text)).length, 1);
});

test('growth requires care on distinct days and unlocks games without changing species', () => {
    const companion = pet(); companion.life.growthMinutes = 720;
    recordCompanionCare(companion, 'pet', { now: T }); assert.equal(companion.life.stage, 'baby');
    assert.throws(() => startCompanionGame(companion, 'memory', T), /解锁/);
    recordCompanionCare(companion, 'pet', { now: T + 24 * H }); assert.equal(companion.life.stage, 'young');
    companion.life.growthMinutes = 2880;
    recordCompanionCare(companion, 'pet', { now: T + 48 * H }); recordCompanionCare(companion, 'pet', { now: T + 72 * H });
    assert.equal(companion.life.stage, 'adult'); assert.equal(companion.species, '青蛙');
    assert.equal(companion.life.milestones.filter(key => key.startsWith('stage-')).length, 2);
});

test('active games retain simulation identity through normalization and settle exactly once', () => {
    const companion = pet(); const game = startCompanionGame(companion, 'catch', T, () => .2);
    for (let t = 10; t <= 32010 && companion.life.game; t += 10) {
        if (t % 500 === 0) arcadeInput(game, { type: 'press', direction: t % 1000 ? -1 : 1 });
        if (t % 1000 === 0) { normalizeWorldState({ companion }); assert.equal(companion.life.game, game); }
        advanceCompanionGame(companion, T + t);
    }
    assert.equal(companion.life.game, null); assert.ok(companion.life.coins >= 2);
    assert.equal(companion.life.gameRecords.catch.plays, 1);
    const coins = companion.life.coins; assert.equal(advanceCompanionGame(companion, T + 33000), null); assert.equal(companion.life.coins, coins);
    assert.equal(companion.life.lastGameResult.coins, coins);
});

test('memory rewards respect daily cap and save the personal best', () => {
    const companion = pet(); companion.life.stage = 'young'; companion.life.rewardDay = '2026-9-26'; companion.life.dailyCoins = 29;
    const game = startCompanionGame(companion, 'memory', T, () => .4);
    for (let t = 10; t <= 32010 && companion.life.game; t += 10) {
        if (game.phase === 'answer') arcadeInput(game, { type: 'press', direction: game.sequence[game.answer] - 1 });
        advanceCompanionGame(companion, T + t);
    }
    assert.equal(companion.life.coins, 1); assert.equal(companion.life.dailyCoins, 30);
    assert.ok(companion.life.gameRecords.memory.best >= 25); assert.equal(companion.life.lastGameResult.best, true);
});

test('offline games pause without progress or rewards; idle and cancelled games give no coins', () => {
    const companion = pet(); const game = startCompanionGame(companion, 'catch', T);
    assert.equal(advanceCompanionGame(companion, T + 20000).paused, true);
    assert.equal(game.elapsed, 0); assert.equal(companion.life.coins, 0);
    setCompanionLifeMode(companion, 'paused', T + 21000); assert.equal(companion.life.game, null);
    setCompanionLifeMode(companion, 'active', T + 22000);
    startCompanionGame(companion, 'catch', T + 22000);
    for (let t = 10; t <= 32010 && companion.life.game; t += 10) advanceCompanionGame(companion, T + 22000 + t);
    assert.equal(companion.life.game, null); assert.equal(companion.life.coins, 0); assert.equal(companion.life.gameRecords.catch.plays, 0);
});

test('shop deducts once, food enters inventory, toys work and owned furniture cannot be rebought', () => {
    const state = data(), companion = state.world.companion; companion.life.coins = 80;
    buyCompanionItem(state, 'snack', T); buyCompanionItem(state, 'snack', T); assert.equal(state.world.inventory[0].quantity, 2);
    buyCompanionItem(state, 'ball', T); buyCompanionItem(state, 'lamp', T); assert.equal(companion.life.coins, 18);
    assert.throws(() => buyCompanionItem(state, 'lamp', T), /已经/); assert.equal(companion.life.coins, 18);
    assert.equal(companion.life.furniture, 'lamp');
    for (let i = 0; i < 3; i++) useCompanionToy(companion, 'ball', T + i * 5 * M);
    assert.equal(getCompanionLifeView(companion, T).favoriteToy, 'ball');
    setCompanionLifeMode(companion, 'paused', T + H);
    const result = applyInventoryItemUse(state, state.world.inventory[0].id, 'companion'); assert.equal(result.applied, false); assert.equal(state.world.inventory[0].quantity, 2);
});

test('souvenir display never consumes inventory and disappears when delivered; names escaped', () => {
    const state = data(); state.world.inventory = [{ id: 's', name: '<img onerror=x>', source: '团子返程 · t', quantity: 1 }];
    setCompanionDisplay(state, 's'); assert.equal(state.world.inventory[0].quantity, 1);
    assert.match(decorateCompanionLife('<div class="tf-companion-page "><div class="tf-pet-stage"></div><section class="tf-card tf-packing">', state), /&lt;img/);
    state.world.inventory[0].quantity = 0;
    assert.doesNotMatch(decorateCompanionLife('<div class="tf-companion-page "><div class="tf-pet-stage">', state), /tf-pet-keepsake/);
    assert.throws(() => setCompanionDisplay(state, 's'), /已不在/);
});

test('paused companions reject linked travel without consuming packed food or changing state', () => {
    const state = data(), settings = structuredClone(DEFAULT_SETTINGS); settings.modules.travel.enabled = true;
    setCompanionLifeMode(state.world.companion, 'paused', T);
    applyWorldUpdates(state, { travel: [{ id: 'trip', status: 'away', destination: '树林' }], companion: { status: 'away' } }, settings);
    assert.equal(state.world.trips.length, 0); assert.equal(state.world.companion.status, 'home');
    assert.equal(state.world.companion.life.mode, 'paused');
    const before = structuredClone(state.world.companion.life);
    assert.equal(recordCompanionCare(state.world.companion, 'trip', { now: T + H }), false);
    assert.deepEqual(state.world.companion.life, before);
});

test('learned personality changes spontaneous behavior without model output', () => {
    const companion = pet(); companion.life.traits.affectionate = 4;
    const at = Math.ceil(T / (10 * M)) * 10 * M;
    assert.equal(getCompanionLifeView(companion, at).activity, 'cuddle');
    assert.match(getCompanionLifeView(companion, at).message, /靠过来/);
    companion.life.traits.curious = 5;
    assert.equal(getCompanionLifeView(companion, at).activity, 'look');
});
