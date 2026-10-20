import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpc, normalizeForumDataShape, linkNpcAuthors } from '../src/forum.js';
import { refreshMemorySummary, recordRelationshipEvent, applyRelationshipTransition, compactRoleMemory, formatMemoryContinuity, getReadableRoleMemory } from '../src/memory.js';
import { buildDirectMessageRequest, buildForumGenerationRequest, buildRoleDirectMessageRequest, buildThreadReplyRequest } from '../src/prompt.js';
import { applyWorldUpdates, normalizeWorldUpdates } from '../src/world.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';

test('local summaries refresh every eight new records without deleting pinned or unresolved memories', () => {
    const npc = createNpc({ name: '甲', handle: 'a' });
    Object.assign(npc.memory, { importantMemories: ['长期承诺'], unresolvedEvents: ['等待归还地图'], privateImportantMemories: ['SECRET_PIN'] });
    refreshMemorySummary(npc, { force: true });
    const before = npc.memory.publicSummary;
    const data = normalizeForumDataShape({ npcs: [npc] });
    for (let index = 0; index < 7; index++) linkNpcAuthors(data, [{ isAi: true, npcId: npc.id, handle: 'a', content: `经历${index}`, comments: [] }]);
    assert.equal(npc.memory.publicSummary, before);
    linkNpcAuthors(data, [{ isAi: true, npcId: npc.id, handle: 'a', content: '第八条经历', comments: [] }]);
    assert.match(npc.memory.publicSummary, /第八条经历/);
    assert.equal(npc.memory.publicHistory.length, 8);
    for (let index = 0; index < 100; index++) linkNpcAuthors(data, [{ isAi: true, npcId: npc.id, handle: 'a', content: `后来${index}`, comments: [] }]);
    assert.match(npc.memory.publicSummary, /长期承诺/); assert.match(npc.memory.publicSummary, /等待归还地图/);
    assert.doesNotMatch(npc.memory.publicSummary, /SECRET_PIN/);
    const migrated = normalizeForumDataShape(JSON.parse(JSON.stringify(data))).npcs[0];
    assert.deepEqual(migrated.memory.privateImportantMemories, ['SECRET_PIN']);
    assert.deepEqual(migrated.memory.unresolvedEvents, ['等待归还地图']);
});

test('quarrel and reconciliation remain scoped to their peer and duplicate events do not farm relationship points', () => {
    const npc = createNpc({ handle: 'a' });
    assert.equal(applyRelationshipTransition(npc, 'b', 'quarrel', '码头计划有分歧'), true);
    assert.equal(npc.socialState, 'normal'); assert.equal(npc.memory.relationshipScore, 0);
    assert.equal(applyRelationshipTransition(npc, 'b', 'quarrel', '相同争执'), false);
    assert.equal(applyRelationshipTransition(npc, 'c', 'reconcile', '没有旧争执'), false);
    assert.equal(applyRelationshipTransition(npc, 'b', 'reconcile', '双方同意一起调查'), true);
    assert.equal(npc.memory.peerRelationships[0].state, 'reconciled');
    applyRelationshipTransition(npc, 'me', 'quarrel', '用户没有赴约', { userTarget: true });
    assert.equal(npc.socialState, 'quarrel'); assert.equal(npc.memory.relationshipScore, -2);
    applyRelationshipTransition(npc, 'me', 'reconcile', '已经解释原因', { userTarget: true });
    assert.equal(npc.socialState, 'normal'); assert.equal(npc.memory.relationshipScore, 0);
});

test('user and role private requests read the speaking role memories while public and third-party requests exclude secrets', () => {
    const a = createNpc({ name: '甲', handle: 'a' }), b = createNpc({ name: '乙', handle: 'b' });
    a.memory.privateTalks = ['SECRET_TALK']; a.memory.privateUnresolvedEvents = ['SECRET_PENDING'];
    a.memory.importantMemories = ['PUBLIC_PIN'];
    refreshMemorySummary(a, { force: true });
    const dm = buildDirectMessageRequest({ conversation: { type: 'npc', name: '甲', handle: 'a' }, npc: a });
    assert.match(JSON.stringify(dm), /SECRET_PENDING/); assert.match(JSON.stringify(dm), /SECRET_TALK/);
    const charDm = buildDirectMessageRequest({ conversation: { type: 'char', name: '甲', handle: 'a' }, sourceContext: { roleMemories: [a] } });
    assert.match(JSON.stringify(charDm), /SECRET_PENDING/);
    const unrelated = buildDirectMessageRequest({ conversation: { type: 'char', name: '丙', handle: 'c' }, sourceContext: { roleMemories: [a] } });
    assert.doesNotMatch(JSON.stringify(unrelated), /SECRET_/);
    const publicRequest = buildForumGenerationRequest({ settings: structuredClone(DEFAULT_SETTINGS), sourceContext: { roleMemories: [a, b] } });
    assert.doesNotMatch(JSON.stringify(publicRequest), /SECRET_/); assert.match(JSON.stringify(publicRequest), /PUBLIC_PIN/);
    const thirdParty = buildRoleDirectMessageRequest({ conversation: {}, speaker: b, otherRole: a });
    assert.doesNotMatch(JSON.stringify(thirdParty), /SECRET_/);
});

test('AI relationship transitions use the existing response and skip blocked or nonexistent participants', () => {
    const a = createNpc({ handle: 'a' }), b = createNpc({ handle: 'b' });
    const data = normalizeForumDataShape({ npcs: [a, b] });
    const updates = normalizeWorldUpdates({ worldUpdates: { socialActions: [{ actorHandle: 'a', targetHandle: 'b', action: 'quarrel', reason: '路线分歧' }] } });
    applyWorldUpdates(data, updates, structuredClone(DEFAULT_SETTINGS));
    assert.equal(a.memory.peerRelationships[0].state, 'quarrel');
    assert.equal(b.memory.peerRelationships[0].state, 'quarrel');
    b.blocked = true;
    applyWorldUpdates(data, { socialActions: [{ actorHandle: 'a', targetHandle: 'b', action: 'reconcile', reason: '跳过拉黑角色' }] }, structuredClone(DEFAULT_SETTINGS));
    assert.equal(a.memory.peerRelationships[0].state, 'quarrel');
});

test('turning automatic summaries off keeps the prior summary until explicitly refreshed', () => {
    const npc = createNpc({ handle: 'a' }); refreshMemorySummary(npc, { force: true });
    npc.memory.autoSummarize = false; const before = npc.memory.publicSummary;
    npc.memory.publicHistory.push('新增经历');
    for (let index = 0; index < 12; index++) recordRelationshipEvent(npc, '普通交谈', 0, { privateEvent: true });
    assert.equal(npc.memory.publicSummary, before); assert.equal(npc.memory.relationshipScore, 0);
    compactRoleMemory(npc); assert.match(npc.memory.publicSummary, /新增经历/);
    assert.match(formatMemoryContinuity(npc), /不代表信任/);
});

test('removed AI speech stays out of requests through history and multiline summary excerpts without erasing saved or manual memories', () => {
    const npc = createNpc({ name: '甲', handle: 'a' });
    const hiddenContent = `HIDDEN_MEMORY_SENTINEL\n第二行${'长'.repeat(240)}`;
    const post = { id: 'p', author: '用户', handle: 'me', isAi: false, content: '公开主帖', comments: [
        { id: 'c', isAi: true, handle: 'a', author: '甲', content: hiddenContent },
        { id: 'public', isAi: true, handle: 'a', author: '甲', content: 'VISIBLE_MEMORY_SENTINEL' },
    ] };
    const data = { npcs: [npc], posts: [post] };
    linkNpcAuthors(data);
    npc.memory.publicHistory.push('用户手工记下的往事');
    npc.memory.privateTalks.push('PRIVATE_MEMORY_SENTINEL');
    refreshMemorySummary(npc, { force: true });
    npc.memory.publicSummary = `手工编写的摘要段落\n\n${npc.memory.publicSummary}`;
    post.comments[0].moderation = { hidden: true, action: 'delete' };
    const before = structuredClone(npc.memory);
    const readable = getReadableRoleMemory(npc, data.posts);
    assert.notEqual(readable, npc);
    assert.notEqual(readable.memory, npc.memory);
    assert.doesNotMatch(readable.memory.publicSummary, /HIDDEN_MEMORY_SENTINEL|第二行/);
    assert.equal(readable.memory.publicHistory.includes(`回帖：${hiddenContent}`), false);
    assert.match(readable.memory.publicSummary, /手工编写的摘要段落|VISIBLE_MEMORY_SENTINEL/);
    assert.deepEqual(readable.memory.privateTalks, ['PRIVATE_MEMORY_SENTINEL']);

    const sourceContext = { roleMemories: [readable] };
    const requests = [
        buildThreadReplyRequest({ post, npcs: [npc], settings: {}, sourceContext }),
        buildForumGenerationRequest({ existingPosts: data.posts, settings: structuredClone(DEFAULT_SETTINGS), sourceContext: { roleMemories: [npc] } }),
        buildDirectMessageRequest({ conversation: { type: 'npc', name: '甲', handle: 'a' }, npc, sourceContext }),
        buildRoleDirectMessageRequest({ conversation: {}, speaker: npc, otherRole: createNpc({ name: '乙', handle: 'b' }), sourceContext }),
    ];
    for (const request of requests) {
        assert.doesNotMatch(JSON.stringify(request), /HIDDEN_MEMORY_SENTINEL|第二行/);
        assert.match(JSON.stringify(request), /VISIBLE_MEMORY_SENTINEL/);
        assert.match(JSON.stringify(request), /手工编写的摘要段落/);
    }
    assert.deepEqual(npc.memory, before);
});

test('readable memory handles recycled parent posts and keeps a record that still has a visible source', () => {
    const npc = createNpc({ handle: 'a' });
    const recycled = { id: 'old', npcId: npc.id, handle: 'a', content: 'RECYCLED_POST_SENTINEL', comments: [
        { npcId: npc.id, handle: 'a', content: 'RECYCLED_COMMENT_SENTINEL' },
    ] };
    const repeated = { npcId: npc.id, handle: 'a', content: '仍然公开的相同发言', comments: [] };
    npc.memory.publicHistory = ['发帖：RECYCLED_POST_SENTINEL', '回帖：RECYCLED_COMMENT_SENTINEL', '发帖：仍然公开的相同发言'];
    refreshMemorySummary(npc, { force: true });
    const readable = getReadableRoleMemory(npc, [repeated, { ...repeated, moderation: { hidden: true } }], [recycled]);
    assert.deepEqual(readable.memory.publicHistory, ['发帖：仍然公开的相同发言']);
    assert.doesNotMatch(readable.memory.publicSummary, /RECYCLED_/);
    assert.match(readable.memory.publicSummary, /仍然公开的相同发言/);
});
