import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, EMPTY_FORUM_DATA } from '../src/constants.js';
import { normalizeForumDataShape } from '../src/forum.js';
import { buildCompanionPackingPlan, assertCompanionPackingReady, prepareCompanionJourney, advanceCompanionJourney, applyInventoryItemUse, getCompanionPackingRole, buildWorldModuleRequest, buildLinkedWorldInstruction, buildWorldModuleInjection, normalizeWorldState, applyWorldUpdates } from '../src/world.js';

const timing = { travelDurationPreset: 'custom', travelMinMinutes: 100, travelMaxMinutes: 100, travelMessageMinMinutes: 15, travelMessageMaxMinutes: 15 };
function setup() {
    const data = normalizeForumDataShape(structuredClone(EMPTY_FORUM_DATA));
    data.world.companion.life.autoSleep = false;
    data.world.inventory = [{ id: 'f', name: '口粮', quantity: 3, usable: true }, { id: 'g', name: '地图', description: '标有溪流', effect: '寻找小路', quantity: 1, usable: true }];
    data.world.companion.packedItemIds = ['f', 'g'];
    data.world.trips = [{ id: 't', destination: '树林', status: 'planned', notes: '终点的秘密', souvenir: '树叶书签' }];
    return data;
}

test('departure timing and consumption match the packing preview and survive serialization', () => {
    const data = setup(); const plan = buildCompanionPackingPlan(data, timing);
    assert.equal(plan.timing.durationMinutes, 85); assert.equal(plan.timing.messageCount, 5);
    prepareCompanionJourney(data, 't', timing, { now: 1000, random: () => .5, packingSignature: plan.signature });
    let trip = data.world.trips[0];
    assert.equal(trip.returnAt, 1000 + 85 * 60000);
    assert.equal(trip.baseDurationMinutes, 100);
    assert.equal(data.world.inventory[0].quantity, 2); assert.equal(data.world.inventory[1].quantity, 1);
    assert.deepEqual(trip.packingItems.map(x => x.consumed), [1, 0]);
    assert.match(trip.messages[0].content, /地图/);
    prepareCompanionJourney(data, 't', timing, { now: 2000 });
    assert.equal(data.world.inventory[0].quantity, 2);
    data.world = normalizeWorldState(JSON.parse(JSON.stringify(data.world)));
    trip = data.world.trips[0];
    assert.equal(trip.packingItems[1].description, '标有溪流');
    data.world.inventory[1].name = '改名后的地图';
    assert.equal(trip.packingItems[1].name, '地图');
    assert.equal(applyInventoryItemUse(data, 'g').applied, false);
    const result = advanceCompanionJourney(data, { now: trip.returnAt });
    assert.equal(result.returned, true); assert.equal(result.trip.notes, '终点的秘密');
    assert.equal(data.world.inventory.filter(x => x.name === '树叶书签').length, 1);
    advanceCompanionJourney(data, { now: trip.returnAt + 1 });
    assert.equal(data.world.inventory.filter(x => x.name === '树叶书签').length, 1);
    assert.equal(applyInventoryItemUse(data, 'g').applied, true);
});

test('food caps at 20%, duplicate selections and navigation tools do not stack', () => {
    const data = setup();
    data.world.inventory.push({ id: 'f2', name: '饼干', quantity: 1 }, { id: 'f3', name: '莓果', quantity: 1 }, { id: 'g2', name: '罗盘', quantity: 1 });
    data.world.companion.packedItemIds = ['f', 'f', 'f2', 'f3', 'g', 'g2'];
    const plan = buildCompanionPackingPlan(data, timing);
    assert.equal(plan.items.length, 5); assert.equal(plan.reduction, 25);
    prepareCompanionJourney(data, 't', timing);
    assert.equal(data.world.inventory[0].quantity, 2);
    assert.equal(data.world.inventory[3].quantity, 0);
});

test('short trips respect the 15-second minimum without food making them slower', () => {
    const plan = buildCompanionPackingPlan(setup(), { ...timing, travelMinMinutes: .25, travelMaxMinutes: .5 }, () => 0);
    assert.equal(plan.timing.durationMinutes, .25);
    assert.equal(plan.timing.durationMaximum, .43);
});

test('missing, unusable and changed items fail before consumption', () => {
    for (const change of [d => { d.world.inventory[1].quantity = 0; }, d => { d.world.inventory[1].usable = false; }, d => { d.world.inventory.pop(); }]) {
        const data = setup(); change(data);
        assert.throws(() => prepareCompanionJourney(data, 't', timing), /行囊物品/);
        assert.equal(data.world.inventory[0].quantity, 3); assert.equal(data.world.trips[0].schedulePreparedAt, 0);
    }
    const data = setup(); const plan = buildCompanionPackingPlan(data, timing);
    data.world.companion.packedItemIds = ['f'];
    assert.throws(() => assertCompanionPackingReady(buildCompanionPackingPlan(data, timing), plan.signature), /已改变/);
});

test('recall records an early return and skips undelivered letters without refunding food', () => {
    const data = setup(); prepareCompanionJourney(data, 't', timing, { now: 1000 });
    advanceCompanionJourney(data, { now: 2000, forceReturn: true });
    assert.equal(data.world.trips[0].recalled, true);
    assert.ok(data.world.trips[0].messages.every(x => x.skippedAt && !x.deliveredAt));
    assert.equal(data.world.inventory[0].quantity, 2);
    assert.match(data.world.companion.message, /提前/);
});

test('item themes reach standalone and linked prompts without exposing planned endings', () => {
    const data = setup(); const settings = structuredClone(DEFAULT_SETTINGS);
    Object.assign(settings.modules.travel, timing, { enabled: true, generationMode: 'linked', joinGeneration: true });
    const request = buildWorldModuleRequest({ moduleId: 'travel', settings, data });
    assert.match(request.user, /标有溪流/); assert.match(request.user, /路线札记/); assert.match(request.user, /85～85/);
    assert.match(buildLinkedWorldInstruction({ settings, data, onlyModuleId: 'travel' }), /寻找小路/);
    prepareCompanionJourney(data, 't', timing);
    const awayRequest = buildWorldModuleRequest({ moduleId: 'travel', settings, data });
    assert.doesNotMatch(awayRequest.user, /终点的秘密/);
    settings.modules.travel.injectIntoChat = true;
    const injected = buildWorldModuleInjection(data, settings, 'travel');
    assert.doesNotMatch(injected, /终点的秘密|树叶书签/);
    assert.equal(getCompanionPackingRole({ name: '鱼形护符' }).kind, 'charm');
    assert.equal(getCompanionPackingRole({ name: '草莓相机' }).kind, 'recording');
    assert.equal(getCompanionPackingRole({ name: '钥匙', effect: '效果：打开门' }).kind, 'tool');
    assert.equal(getCompanionPackingRole({ name: '补给饼干', effect: '指示地图路线' }).kind, 'food');
});

test('invalid linked packing does not leave a ghost journey', () => {
    const data = setup(); data.world.trips = []; data.world.inventory.pop();
    const settings = structuredClone(DEFAULT_SETTINGS); settings.modules.travel.enabled = true;
    assert.throws(() => applyWorldUpdates(data, { travel: [{ id: 'new', status: 'away' }] }, settings), /行囊/);
    assert.equal(data.world.trips.length, 0); assert.equal(data.world.inventory[0].quantity, 3);
});
