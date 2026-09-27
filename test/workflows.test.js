import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, EMPTY_FORUM_DATA } from '../src/constants.js';
import { normalizeForumDataShape, createNpc } from '../src/forum.js';
import { normalizeWorldState, applyWorldUpdates, advanceCompanionJourney, prepareCompanionJourney, getTaskProgress, hasTaskVerificationEvidence } from '../src/world.js';
import { buildForumBackup, readForumBackup, mergeForumBackup, remapBackupAssets } from '../src/backup.js';
import { selectWorldUpdates, parseThreadUpdates, recordRelationshipEvent, compactRoleMemory } from '../src/workflows.js';
import { buildForumGenerationRequest } from '../src/prompt.js';
import { generateForumTextResult } from '../src/api.js';

// These tests exercise travel regardless of the machine's wall-clock hour.
const data = () => { const state = normalizeForumDataShape(structuredClone(EMPTY_FORUM_DATA)); state.world.companion.life.autoSleep = false; return state; };
const settings = () => structuredClone(DEFAULT_SETTINGS);

test('normalizing while an action is pending keeps task and companion references alive', () => {
    const state = normalizeWorldState({ tasks: [{ id: 't', status: 'accepted' }] });
    const task = state.tasks[0], companion = state.companion;
    normalizeWorldState(state);
    task.status = 'completed'; companion.carrying = '地图';
    assert.equal(state.tasks[0], task);
    assert.equal(state.tasks[0].status, 'completed');
    assert.equal(state.companion.carrying, '地图');
});

test('only enabled and selected modules can reach persistence and message routing', () => {
    const config = settings(); config.modules.tasks.enabled = false;
    const updates = { tasks: [{ title: 'forbidden' }], health: [{}], socialActions: [{}] };
    assert.deepEqual(selectWorldUpdates(updates, config, ['tasks']), {});
});

test('linked journeys get a clock and packing is consumed exactly once', () => {
    const state = data(), config = settings(); config.modules.travel.enabled = true;
    state.world.inventory.push({ id: 'food', name: '口粮', quantity: 2, usable: true });
    state.world.companion.packedItemIds = ['food'];
    applyWorldUpdates(state, { travel: [{ id: 'trip', destination: '花园', status: 'away', messages: [{ content: '花开了', progress: .5 }], souvenir: '石头' }], companion: { status: 'away' } }, config);
    const trip = state.world.trips[0];
    assert.ok(trip.returnAt > Date.now()); assert.ok(trip.messages[0].scheduledAt > 0);
    assert.equal(state.world.inventory.find(x => x.id === 'food').quantity, 1);
    prepareCompanionJourney(state, trip.id, config.modules.travel);
    assert.equal(state.world.inventory.find(x => x.id === 'food').quantity, 1);
    assert.equal(advanceCompanionJourney(state, { now: trip.returnAt + 1 }).returned, true);
    assert.equal(advanceCompanionJourney(state, { now: trip.returnAt + 2 }).returned, false);
});

test('task steps need new evidence for every objective and respect negative statements', () => {
    const task = { objectiveTarget: '蓝色钥匙', steps: ['蓝色钥匙', '红色地图'], acceptedMessageIndex: 1 };
    const chat = [{ mes: '找到了红色地图' }, { mes: '拿到了蓝色钥匙' }, { mes: '还没找到红色地图' }];
    assert.equal(getTaskProgress(task, chat).completed, 1);
    chat.push({ mes: '终于找到了红色地图' });
    assert.equal(getTaskProgress(task, chat).eligible, true);
    assert.equal(hasTaskVerificationEvidence(task, { evidenceMessageIndex: 0, evidenceExcerpt: '找到了红色地图' }, chat), false);
    assert.equal(hasTaskVerificationEvidence(task, { evidenceMessageIndex: 3, evidenceExcerpt: '凭空编造的证据' }, chat), false);
    assert.equal(hasTaskVerificationEvidence(task, { evidenceMessageIndex: 3, evidenceExcerpt: '终于找到了红色地图' }, chat), true);
});

test('thread-only updates ignore unknown posts and blocked authors', () => {
    const state = data(); state.posts.push({ id: 'p', content: '讨论', comments: [] });
    state.npcs.push({ id: 'bad', handle: 'bad', blocked: true });
    const raw = JSON.stringify({ threadUpdates: [{ postId: 'missing', comments: [{ content: '不要保存' }] }, { postId: 'p', comments: [{ handle: 'bad', content: '不要保存' }, { handle: 'good', content: '继续讨论' }] }] });
    const updates = parseThreadUpdates(raw, state);
    assert.equal(updates.length, 1); assert.equal(updates[0].replies.length, 1);
    assert.equal(updates[0].replies[0].content, '继续讨论');
});

test('full backups include local media, omit API credentials and merge without erasing local edits', async () => {
    const state = data(), config = settings();
    state.posts.push({ id: 'p', handle: 'one', content: '旧正文', imageKey: 'local-img', comments: [{ id: 'c', content: '评论' }] });
    config.apiProfiles[0].text.apiKey = 'fake-test-secret';
    const backup = await buildForumBackup(state, config, { getItem: async () => 'data:image/png;base64,AAAA' });
    assert.equal(backup.assets['local-img'], 'data:image/png;base64,AAAA');
    assert.equal(JSON.stringify(backup).includes('fake-test-secret'), false);
    const loaded = remapBackupAssets(readForumBackup(backup));
    assert.notEqual(loaded.data.posts[0].imageKey, 'local-img');
    assert.ok(loaded.assets[loaded.data.posts[0].imageKey]);
    const current = data(); current.posts.push({ id: 'p', content: '本地修改', comments: [] });
    const merged = mergeForumBackup(current, loaded.data);
    assert.equal(merged.posts.length, 1); assert.equal(merged.posts[0].content, '本地修改');
    assert.equal(merged.posts[0].comments.length, 1);
    assert.throws(() => readForumBackup(JSON.parse('{"posts":[],"__proto__":{"polluted":true}}')));
});

test('private relationship events stay out of public generation and deduplication retains facts', () => {
    const npc = createNpc({ name: '角色', handle: 'role' });
    recordRelationshipEvent(npc, 'PRIVATE_EVENT_MARKER', 1, { privateEvent: true });
    recordRelationshipEvent(npc, '公开关注', 1);
    npc.memory.knownFacts = ['重要事实', '重要事实']; npc.memory.privateTalks = ['秘密', '秘密'];
    assert.equal(compactRoleMemory(npc), 2);
    assert.deepEqual(npc.memory.knownFacts, ['重要事实']);
    const request = buildForumGenerationRequest({ settings: settings(), sourceContext: { roleMemories: [npc] } });
    assert.equal(JSON.stringify(request).includes('PRIVATE_EVENT_MARKER'), false);
    assert.equal(JSON.stringify(request).includes('公开关注'), true);
});

test('cancelling native reception returns promptly and does not send another request', async () => {
    let calls = 0, finish;
    globalThis.SillyTavern = { getContext: () => ({ generateRaw: () => { calls++; return new Promise(resolve => { finish = resolve; }); } }) };
    const controller = new AbortController();
    const pending = generateForumTextResult({ provider: 'sillytavern' }, { system: 'test', user: 'test' }, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    finish('late response'); assert.equal(calls, 1);
});

test('stale saves cannot overwrite another chat or a freshly imported forum', async () => {
    const { getForumData, saveForumData } = await import('../src/store.js');
    const context = { chatId: 'A', characterId: 0, chatMetadata: {}, saveMetadata: async () => {} };
    globalThis.SillyTavern = { getContext: () => context };
    const original = getForumData();
    context.chatId = 'B'; context.chatMetadata = {};
    const destination = getForumData(); destination.topic = 'B topic';
    await assert.rejects(saveForumData(original, true), { name: 'AbortError' });
    assert.equal(getForumData().topic, 'B topic');
    await saveForumData(data(), true);
    await assert.rejects(saveForumData(destination, true), { name: 'AbortError' });
});

test('a second model refresh does not restart an active scheduled journey', () => {
    const state = data(), config = settings(); config.modules.travel.enabled = true;
    applyWorldUpdates(state, { travel: [{ id: 'trip-1', status: 'away', destination: '花园' }] }, config);
    const originalReturn = state.world.trips[0].returnAt;
    applyWorldUpdates(state, { travel: [{ id: 'trip-2', status: 'away', destination: '山顶' }], companion: { status: 'home' } }, config);
    assert.equal(state.world.trips.length, 1);
    assert.equal(state.world.companion.status, 'away');
    assert.equal(state.world.trips[0].returnAt, originalReturn);
});
