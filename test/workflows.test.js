import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, EMPTY_FORUM_DATA } from '../src/constants.js';
import { normalizeForumDataShape, createNpc, ensureNpcConversation, ensureTaskIssuerConversation, ensureRoleConversation, resolveNpcIdentity } from '../src/forum.js';
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

test('thread-only updates normalize blocked handles and still reject the blocked display name', () => {
    const state = data(); state.posts.push({ id: 'p', content: '讨论', comments: [] });
    state.npcs.push(createNpc({ name: '被拉黑用户', handle: '@BaD' }));
    state.npcs[0].blocked = true;
    const updates = parseThreadUpdates({ threadUpdates: [{ postId: 'p', comments: [
        ...['BAD', '@bad', ' @BaD '].map(handle => ({ handle, author: '新显示名', content: '不应保存' })),
        { handle: 'newhandle', author: ' 被拉黑用户 ', content: '不应保存' },
        { handle: 'good', author: '其他用户', content: '继续讨论' },
    ] }] }, state);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].replies.map(reply => reply.content), ['继续讨论']);
});

test('blocked renamed anonymous identities cannot reappear through an old alias in thread updates', () => {
    const state = data();
    const { npc } = ensureTaskIssuerConversation(state, { id: 'renamed-mask', anonymous: true, title: '委托' });
    const alias = { ...structuredClone(npc), id: 'old-mask-copy', anonymousTaskId: '', blocked: false };
    state.npcs.unshift(alias);
    npc.name = '新昵称'; npc.handle = 'new_mask'; npc.blocked = true;
    state.posts.push({ id: 'discussion', content: '讨论', comments: [] });
    const updates = parseThreadUpdates({ threadUpdates: [{ postId: 'discussion', comments: [
        { handle: alias.handle, author: alias.name, content: '不应保存' },
        { handle: 'other', author: '路人', content: '正常回帖' },
    ] }] }, state);
    assert.deepEqual(updates[0].replies.map(reply => reply.content), ['正常回帖']);
});

test('anonymous task delivery reuses its contact and conversation across saves without resetting restrictions', () => {
    let state = data();
    state.world.tasks.push({ id: 'anonymous-task', title: '送信', anonymous: true });
    let task = state.world.tasks[0];
    const first = ensureTaskIssuerConversation(state, task);
    first.npc.blocked = true;
    first.npc.socialState = 'blocked';
    first.npc.dmAccess = 'denied';
    first.conversation.messages.push({ id: 'existing-message', role: 'user', content: '已有私信' });
    state = normalizeForumDataShape(JSON.parse(JSON.stringify(state)));
    task = state.world.tasks[0];
    const second = ensureTaskIssuerConversation(state, task);
    assert.equal(second.npc.id, first.npc.id);
    assert.equal(second.conversation.id, first.conversation.id);
    assert.equal(second.npc.blocked, true);
    assert.equal(second.npc.dmAccess, 'denied');
    assert.equal(second.conversation.messages[0].content, '已有私信');
    assert.equal(state.npcs.length, 1);
    assert.equal(state.conversations.length, 1);
});

test('legacy duplicate anonymous contacts preserve all chats and migrate the blocked identity only once', () => {
    const state = data();
    const task = { id: 'anonymous-task', title: '送信', anonymous: true };
    const first = ensureTaskIssuerConversation(state, task);
    delete first.npc.anonymousTaskId;
    first.npc.blocked = true;
    const duplicate = { ...structuredClone(first.npc), id: 'legacy-duplicate', blocked: false };
    state.npcs.push(duplicate);
    const duplicateConversation = ensureNpcConversation(state, duplicate);
    first.conversation.messages.push({ id: 'old-message', content: '旧会话记录' });
    duplicateConversation.messages.push({ id: 'new-message', content: '重复会话记录' });
    task.issuerNpcId = duplicate.id;
    const beforeMessages = state.conversations.map(conversation => structuredClone(conversation.messages));
    const repaired = ensureTaskIssuerConversation(state, task);
    assert.equal(repaired.npc.id, first.npc.id);
    assert.equal(task.issuerNpcId, first.npc.id);
    assert.equal(state.npcs.length, 2);
    assert.equal(state.conversations.length, 2);
    assert.deepEqual(state.conversations.map(conversation => conversation.messages), beforeMessages);
    repaired.npc.blocked = false;
    assert.equal(ensureTaskIssuerConversation(state, task).npc, repaired.npc);
    assert.equal(repaired.npc.blocked, false);
});

test('legacy anonymous copies share canonical relationship permissions while retaining separate chat histories', () => {
    const state = data();
    const task = { id: 'anonymous-task', title: '送信', anonymous: true };
    state.world.tasks.push(task);
    const first = ensureTaskIssuerConversation(state, task);
    delete first.npc.anonymousTaskId;
    first.npc.blocked = true;
    const duplicate = { ...structuredClone(first.npc), id: 'legacy-duplicate', blocked: false };
    state.npcs.push(duplicate);
    const oldConversation = ensureNpcConversation(state, duplicate);
    oldConversation.messages.push({ id: 'old-copy-message', content: '旧副本私信' });
    first.conversation.messages.push({ id: 'original-message', content: '原联系人私信' });
    task.issuerNpcId = duplicate.id;
    const canonical = ensureTaskIssuerConversation(state, task).npc;
    const beforeChats = structuredClone(state.conversations);
    assert.equal(resolveNpcIdentity(state, duplicate), canonical);
    assert.equal(resolveNpcIdentity(state, oldConversation.targetId).blocked, true);

    // Actions from the old copy update the same account, including unblocking.
    resolveNpcIdentity(state, duplicate.id).blocked = false;
    resolveNpcIdentity(state, duplicate).muted = true;
    resolveNpcIdentity(state, duplicate).followedByUser = true;
    assert.equal(resolveNpcIdentity(state, canonical.id).blocked, false);
    assert.equal(resolveNpcIdentity(state, oldConversation.targetId).blocked, false);
    assert.equal(canonical.muted, true);
    assert.equal(canonical.followedByUser, true);
    assert.equal(ensureNpcConversation(state, duplicate), first.conversation);
    assert.deepEqual(state.conversations, beforeChats);
    assert.equal(ensureRoleConversation(state, duplicate, canonical), null);
    assert.equal(state.npcs.length, 2);
    assert.equal(state.conversations.length, 2);

    canonical.handle = 'renamed-anonymous-contact';
    assert.equal(resolveNpcIdentity(state, duplicate), canonical);
    const loaded = normalizeForumDataShape(JSON.parse(JSON.stringify(state)));
    assert.equal(resolveNpcIdentity(loaded, duplicate.id).id, canonical.id);
    assert.equal(resolveNpcIdentity(loaded, duplicate.id).blocked, false);
    assert.equal(loaded.conversations.find(item => item.id === oldConversation.id).messages[0].content, '旧副本私信');
});

test('identity resolution leaves ordinary same-handle roles and unmigrated contacts independent', () => {
    const state = data();
    const task = { id: 'anonymous-task', title: '送信', anonymous: true };
    const canonical = ensureTaskIssuerConversation(state, task).npc;
    const ordinary = createNpc({ name: '其他角色', handle: canonical.handle });
    const unmigrated = createNpc({ name: '旧临时角色', handle: 'unrelated-contact' });
    Object.assign(unmigrated, { taskContact: true, temporaryContact: true });
    state.npcs.push(ordinary, unmigrated);
    assert.equal(resolveNpcIdentity(state, ordinary.id), ordinary);
    assert.equal(resolveNpcIdentity(state, unmigrated.id), unmigrated);
    assert.equal(resolveNpcIdentity(state, 'missing'), null);
});

test('anonymous task masks a real issuer reference and recovers its existing anonymous handle if the reference is missing', () => {
    const state = data();
    const realIssuer = createNpc({ name: '真实委托人', handle: 'real-issuer' });
    state.npcs.push(realIssuer);
    const task = { id: 'anonymous-task', title: '送信', anonymous: true, issuerNpcId: realIssuer.id, issuerHandle: realIssuer.handle };
    const first = ensureTaskIssuerConversation(state, task);
    assert.notEqual(first.npc.id, realIssuer.id);
    assert.match(first.npc.handle, /^masked_/);
    delete first.npc.anonymousTaskId;
    task.issuerNpcId = 'missing';
    const second = ensureTaskIssuerConversation(state, task);
    assert.equal(second.npc, first.npc);
    assert.equal(second.conversation, first.conversation);
    assert.equal(state.npcs.length, 2);
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
