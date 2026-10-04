import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { normalizeWorldState, applyInventoryItemUse, applyWorldUpdates } from '../src/world.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';
import { normalizeCompanionLife, advanceCompanionLife, getCompanionLifeView, getCompanionTogetherDays, claimCompanionGreeting, recordCompanionCare, setCompanionLifeMode, tendCompanion, startCompanionGame, advanceCompanionGame, getCompanionGameFrame, buyCompanionItem, useCompanionToy, setCompanionDisplay } from '../src/companion-life.js';
import { arcadeInput } from '../src/companion-games.js';
import { decorateCompanionLife } from '../src/companion-life-ui.js';

const T = new Date(2026, 8, 26, 12).getTime(), M = 60000, H = 60 * M;
const pet = () => ({ name: '团子', species: '青蛙', status: 'home', satiety: 75, energy: 80, happiness: 70, bond: 8, life: normalizeCompanionLife({ autoSleep: false }, T) });
const data = () => ({ world: normalizeWorldState({ companion: pet(), inventory: [] }) });

test('a selected room bed survives normalization and explicit wake or ordinary rest releases it', () => {
    const companion = pet();
    companion.life.roomBedId = 'bed-saved-1';
    companion.life.sleepUntil = T + H;
    assert.equal(normalizeCompanionLife(companion.life, T).roomBedId, 'bed-saved-1');
    assert.equal(normalizeCompanionLife({ roomBedId: '<script>' }, T).roomBedId, '');
    assert.equal(normalizeCompanionLife({ roomBedId: 123 }, T).roomBedId, '');
    tendCompanion(companion, 'wake', T);
    assert.equal(companion.life.roomBedId, '');
    companion.life.roomBedId = 'bed-saved-1';
    tendCompanion(companion, 'rest', T);
    assert.equal(companion.life.roomBedId, '');
});

test('together days count local calendar boundaries, including a short first day and clock rollback', () => {
    const companion = pet(), beforeMidnight = new Date(2026, 8, 26, 23, 59, 59).getTime();
    companion.life.startedAt = beforeMidnight;
    assert.equal(getCompanionTogetherDays(companion, beforeMidnight), 1);
    assert.equal(getCompanionTogetherDays(companion, beforeMidnight + 1000), 2);
    assert.equal(getCompanionTogetherDays(companion, T), 1);
    assert.equal(getCompanionTogetherDays({ name: '旧伙伴' }, T), 1);
});

test('together days remain calendar-based across both daylight-saving transitions', () => {
    const moduleUrl = new URL('../src/companion-life.js', import.meta.url).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
        import { getCompanionTogetherDays } from ${JSON.stringify(moduleUrl)};
        const spring = { life: { startedAt: new Date(2026, 2, 7, 12).getTime() } };
        const autumn = { life: { startedAt: new Date(2026, 10, 1, 0, 30).getTime() } };
        console.log(JSON.stringify([
            getCompanionTogetherDays(spring, new Date(2026, 2, 9, 12).getTime()),
            getCompanionTogetherDays(autumn, new Date(2026, 10, 1, 23, 30).getTime())
        ]));
    `], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [3, 1]);
});

test('daily reunion persists across saves and rollback, without adding rewards or daily diary noise', () => {
    const companion = pet(), before = [companion.bond, companion.energy, companion.satiety, companion.life.coins, structuredClone(companion.life.traits)];
    const greeting = claimCompanionGreeting(companion, T);
    assert.equal(greeting.kind, 'greet'); assert.equal(greeting.days, 1);
    assert.ok(greeting.message.includes(companion.name)); assert.match(greeting.message, /开心/);
    assert.doesNotMatch(greeting.message, /第\s*\d+\s*天/);
    assert.equal(companion.life.greetingDay, '2026-9-26');
    assert.equal(claimCompanionGreeting(companion, T + M), null);
    normalizeWorldState({ companion });
    assert.equal(claimCompanionGreeting(companion, T + H), null);
    assert.equal(claimCompanionGreeting(companion, T + 2 * 24 * H).days, 3);
    assert.equal(claimCompanionGreeting(companion, T + 24 * H), null);
    normalizeWorldState({ companion });
    assert.equal(claimCompanionGreeting(companion, T + 2 * 24 * H), null);
    assert.equal(claimCompanionGreeting(companion, T + 3 * 24 * H).days, 4);
    assert.deepEqual([companion.bond, companion.energy, companion.satiety, companion.life.coins, companion.life.traits], before);
    assert.deepEqual(companion.life.milestones, ['first-greeting']);
    assert.equal(companion.life.diary.length, 1);
});

test('unavailable companions do not consume the greeting; waking or returning still permits it that day', () => {
    for (const reason of ['paused', 'daycare', 'away', 'sleep', 'game']) {
        const companion = pet();
        if (['paused', 'daycare'].includes(reason)) companion.life.mode = reason;
        else if (reason === 'away') companion.status = 'away';
        else if (reason === 'sleep') companion.life.sleepUntil = T + H;
        else startCompanionGame(companion, 'catch', T, () => .2);
        const before = structuredClone(companion);
        assert.equal(claimCompanionGreeting(companion, T), null, reason);
        assert.deepEqual(companion, before, reason);
        companion.life.mode = 'active'; companion.status = 'home'; companion.life.sleepUntil = 0; companion.life.game = null;
        assert.equal(claimCompanionGreeting(companion, T + M).kind, 'greet', reason);
    }
    const night = pet(), at = new Date(2026, 8, 26, 23).getTime(); night.life.autoSleep = true;
    assert.equal(claimCompanionGreeting(night, at), null);
    assert.equal(night.life.greetingDay, '');
    tendCompanion(night, 'wake', at);
    assert.equal(claimCompanionGreeting(night, at).kind, 'greet');
});

test('ritual migration accepts valid stored dates and rejects malformed calendar dates', () => {
    const legacy = normalizeCompanionLife({}, T);
    assert.equal(legacy.greetingDay, ''); assert.equal(legacy.bedtimeDay, '');
    const persisted = normalizeCompanionLife({ greetingDay: '2026-09-26', bedtimeDay: '2026-9-27' }, T);
    assert.equal(persisted.greetingDay, '2026-9-26'); assert.equal(persisted.bedtimeDay, '2026-9-27');
    for (const invalid of ['2026-2-30', '2026-13-1', '2026-0-2', '2026-9-0', 'not-a-day', null, {}, '']) {
        const life = normalizeCompanionLife({ greetingDay: invalid, bedtimeDay: invalid }, T);
        assert.equal(life.greetingDay, ''); assert.equal(life.bedtimeDay, '');
    }
});

test('bedtime records one keepsake, keeps care cooldowns and one-hour sleep, and preserves its date after rollback', () => {
    const companion = pet();
    assert.equal(tendCompanion(companion, 'rest', T), undefined);
    assert.equal(companion.life.bedtimeDay, '2026-9-26'); assert.equal(companion.life.sleepUntil, T + H);
    assert.equal(companion.energy, 80); assert.equal(companion.life.traits.calm, 1);
    tendCompanion(companion, 'rest', T + 1);
    assert.equal(companion.life.traits.calm, 1); assert.equal(companion.life.coins, 0); assert.equal(companion.bond, 8);
    normalizeWorldState({ companion }); assert.equal(companion.life.bedtimeDay, '2026-9-26');
    advanceCompanionLife(companion, T + H + 1);
    assert.equal(companion.energy, 92); assert.equal(companion.status, 'home');
    tendCompanion(companion, 'rest', T + 2 * 24 * H);
    assert.equal(companion.life.bedtimeDay, '2026-9-28');
    tendCompanion(companion, 'rest', T + 24 * H);
    assert.equal(companion.life.bedtimeDay, '2026-9-28');
    assert.equal(companion.life.milestones.filter(key => key === 'first-bedtime').length, 1);
    assert.equal(companion.life.diary.filter(note => /第一次道过晚安/.test(note.text)).length, 1);
});

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

test('growth saves both appearances once, preserves identity and persists an acknowledged celebration', () => {
    const companion = pet(); companion.species = '黑猫'; companion.bodyColor = '#334455'; companion.accessory = 'crown';
    companion.life.growthMinutes = 719; companion.life.careDays = ['2026-9-25', '2026-9-26'];
    advanceCompanionLife(companion, T + M);
    assert.equal(companion.life.stage, 'young');
    assert.deepEqual(companion.life.growthAlbum.map(photo => photo.stage), ['baby', 'young']);
    assert.equal(companion.life.growthNotice.from, 'baby'); assert.equal(companion.life.growthNotice.to, 'young');
    const photos = structuredClone(companion.life.growthAlbum);
    companion.species = '狐狸'; companion.bodyColor = '#dd8844'; companion.life.growthNotice = null;
    normalizeWorldState({ companion }); advanceCompanionLife(companion, T + 2 * M);
    assert.deepEqual(companion.life.growthAlbum, photos); assert.equal(companion.life.growthNotice, null);
    companion.life.growthMinutes = 2880; companion.life.careDays = ['1', '2', '3', '4'];
    advanceCompanionLife(companion, T + 3 * M);
    assert.equal(companion.life.growthAlbum.length, 3); assert.equal(companion.life.growthAlbum[2].species, '狐狸');
    assert.equal(companion.life.growthAlbum[0].bodyColor, '#334455');
    assert.equal(companion.life.growthNotice.from, 'young'); assert.equal(companion.life.growthNotice.to, 'adult');
    assert.equal(companion.life.milestones.filter(key => key.startsWith('stage-')).length, 2);
});

test('legacy adults gain no fabricated childhood photos or surprise growth; malformed albums are bounded', () => {
    const companion = pet(); companion.life.stage = 'adult';
    normalizeWorldState({ companion }); assert.deepEqual(companion.life.growthAlbum, []); assert.equal(companion.life.growthNotice, null);
    advanceCompanionLife(companion, T + M); assert.deepEqual(companion.life.growthAlbum.map(photo => photo.stage), ['adult']);
    const normalized = normalizeCompanionLife({ stage: 'baby', growthAlbum: [null, { stage: 'fake', species: '猫' }, ...Array(20).fill({ stage: 'baby', species: '<script>', bodyColor: 'red;position:fixed' })], growthNotice: { id: 'bad', from: 'baby', to: 'adult' } }, T);
    assert.equal(normalized.growthAlbum.length, 1); assert.equal(normalized.growthAlbum[0].bodyColor, ''); assert.equal(normalized.growthNotice, null);
});
