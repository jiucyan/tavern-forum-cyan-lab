import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FORUM_DATA } from '../src/constants.js';
import { normalizeForumDataShape } from '../src/forum.js';
import { normalizeGeneratedForum, prunePosts } from '../src/prompt.js';
import { normalizeWorldUpdates, getTaskProgress } from '../src/world.js';
import { trackPostEvent, syncStoryEventLinks, buildStoryEventInstruction, applyStoryEventUpdates, setStoryEventStatus, getEventProtectedPostIds } from '../src/events.js';
import { buildTaskDeliveryPlan, commitTaskDelivery } from '../src/task-delivery.js';
import { mergeForumBackup } from '../src/backup.js';

function fixture() {
    return normalizeForumDataShape({ ...structuredClone(EMPTY_FORUM_DATA), posts: [{ id: 'p', content: '谁能送来蓝色花朵？', comments: [] }], world: {
        tasks: [{ id: 't', title: '收集蓝花', objectiveType: 'delivery', objectiveTarget: '蓝色花朵', objectiveQuantity: 3, status: 'accepted', rewardItems: [{ name: '纪念币', quantity: 5 }] }],
        inventory: [{ id: 'i1', name: '蓝色花朵', quantity: 2 }, { id: 'i2', name: '蓝色花朵', quantity: 2 }, { id: 'wrong', name: '红色花朵', quantity: 10 }],
    } });
}

test('delivery combines exact-name stacks, previews quantities and grants one durable receipt', () => {
    const data = fixture(); const selected = { i1: 2, i2: 1 };
    const plan = buildTaskDeliveryPlan(data, 't', selected);
    assert.equal(plan.ready, true); assert.equal(plan.requirements[0].available, 4);
    const event = trackPostEvent(data, 'p'); data.world.tasks[0].eventId = event.id;
    const receipt = commitTaskDelivery(data, 't', selected, plan.signature);
    assert.equal(data.world.inventory[0].quantity, 0); assert.equal(data.world.inventory[1].quantity, 1);
    assert.deepEqual(receipt.items.map(item => item.quantity), [2, 1]); assert.equal(receipt.rewards[0].quantity, 5);
    assert.equal(data.world.tasks[0].status, 'completed');
    assert.throws(() => commitTaskDelivery(data, 't', selected, plan.signature), /不能重复/);
    assert.equal(data.world.inventory.filter(item => item.source === '任务奖励 · t').length, 1);
    const loaded = normalizeForumDataShape(JSON.parse(JSON.stringify(data)));
    assert.deepEqual(loaded.world.tasks[0].deliveryReceipt, receipt);
    assert.ok(loaded.events[0].entries.some(entry => entry.kind === 'task' && entry.summary.includes('已完成')));
});

test('wrong, fractional, insufficient, excessive and traveling inventory never partially settles', () => {
    for (const selection of [{ wrong: 3 }, { i1: 1.5, i2: 1.5 }, { i1: 1 }, { i1: 2, i2: 2 }, { i1: 3 }]) {
        const data = fixture(); const original = JSON.stringify(data.world.inventory);
        const plan = buildTaskDeliveryPlan(data, 't', selection);
        assert.equal(plan.ready, false); assert.throws(() => commitTaskDelivery(data, 't', selection, plan.signature));
        assert.equal(JSON.stringify(data.world.inventory), original);
    }
    const data = fixture(); data.world.trips.push({ status: 'away', packingItems: [{ id: 'i1', consumed: 0 }] });
    const plan = buildTaskDeliveryPlan(data, 't', { i1: 2, i2: 1 });
    assert.equal(plan.ready, false); assert.equal(plan.requirements[0].available, 2);
});

test('inventory, reward and task changes invalidate an old handover preview', () => {
    for (const change of [data => { data.world.inventory[0].quantity = 1; }, data => { data.world.tasks[0].rewardItems[0].quantity = 99; }, data => { data.world.tasks[0].status = 'abandoned'; }]) {
        const data = fixture(); const selection = { i1: 2, i2: 1 }; const plan = buildTaskDeliveryPlan(data, 't', selection);
        change(data); const before = JSON.stringify(data.world);
        assert.throws(() => commitTaskDelivery(data, 't', selection, plan.signature)); assert.equal(JSON.stringify(data.world), before);
    }
});

test('multi-item deliveries require every item and do not bypass additional story steps', () => {
    const data = fixture();
    data.world.tasks[0].deliveryRequirements = [{ name: '蓝色花朵', quantity: 2 }, { name: '红色花朵', quantity: 4 }];
    assert.equal(buildTaskDeliveryPlan(data, 't', { i1: 2 }).ready, false);
    assert.equal(buildTaskDeliveryPlan(data, 't', { i1: 2, wrong: 4 }).ready, true);
    data.world.tasks[0].steps = ['调查花园'];
    assert.equal(buildTaskDeliveryPlan(data, 't', { i1: 2, wrong: 4 }).ready, false);
});

test('model output cannot manufacture a local receipt or verified timestamp', () => {
    const result = normalizeWorldUpdates({ worldUpdates: { tasks: [{ title: 'test', verifiedAt: 12, deliveryReceipt: { id: 'fake', items: [] } }] } });
    assert.equal(result.tasks[0].verifiedAt, 0); assert.equal(result.tasks[0].deliveryReceipt, null);
});

test('one response connects posts, tasks and private messages and deduplicates event creation', () => {
    const data = fixture();
    const raw = { posts: [{ content: '蓝花求助的后续', eventId: 'new:flowers' }], eventUpdates: [{ id: 'new:flowers', title: '寻找蓝花' }] };
    const posts = normalizeGeneratedForum(raw).posts; data.posts.push(...posts);
    data.world.tasks[0].eventId = 'new:flowers'; data.conversations.push({ id: 'c', messages: [{ id: 'm', content: '私下的线索', eventId: 'new:flowers' }] });
    applyStoryEventUpdates(data, raw, { newPosts: posts });
    assert.equal(data.events.length, 1); const id = data.events[0].id;
    assert.equal(posts[0].eventId, id); assert.equal(data.world.tasks[0].eventId, id); assert.equal(data.conversations[0].messages[0].eventId, id);
    assert.equal(data.events[0].entries.filter(entry => entry.private).length, 2);
    syncStoryEventLinks(data); assert.equal(data.events[0].entries.length, 3);
    const more = normalizeGeneratedForum(raw).posts; data.posts.push(...more); applyStoryEventUpdates(data, raw, { newPosts: more });
    assert.equal(data.events.length, 1);
});

test('public continuation excludes private messages, private task status and removed public sources', () => {
    const data = fixture(); const event = trackPostEvent(data, 'p');
    data.world.tasks[0].title = '私密交付目标'; data.world.tasks[0].eventId = event.id;
    data.conversations.push({ id: 'c', messages: [{ id: 'secret', content: '私信密码123', eventId: event.id }] }); syncStoryEventLinks(data);
    const prompt = buildStoryEventInstruction(data);
    assert.match(prompt, /谁能送来蓝色花朵/); assert.doesNotMatch(prompt, /私信密码123|私密交付目标/);
    data.posts[0].moderation.hidden = true;
    assert.doesNotMatch(buildStoryEventInstruction(data), /谁能送来蓝色花朵/);
    assert.equal(buildStoryEventInstruction(data, { allowNew: false }), '');
});

test('active tasks prevent generated closure; explicit closure never completes or rewards tasks', () => {
    const data = fixture(); const event = trackPostEvent(data, 'p'); data.world.tasks[0].eventId = event.id;
    const posts = normalizeGeneratedForum({ posts: [{ content: '结果来了', eventId: event.id }] }).posts; data.posts.push(...posts);
    applyStoryEventUpdates(data, { eventUpdates: [{ id: event.id, status: 'resolved' }] }, { newPosts: posts });
    assert.equal(event.status, 'active');
    setStoryEventStatus(data, event.id, 'resolved'); assert.equal(data.world.tasks[0].status, 'accepted');
    assert.equal(data.world.inventory.length, 3);
    assert.doesNotMatch(buildStoryEventInstruction(data), /结果来了/);
});

test('events are bounded in prompts and backup merging keeps timeline entries', () => {
    const data = fixture(); const event = trackPostEvent(data, 'p');
    const incoming = structuredClone(data); incoming.events[0].entries.push({ id: 'note', kind: 'status', summary: '后续记录', createdAt: Date.now() });
    const merged = mergeForumBackup(data, incoming); assert.equal(merged.events[0].entries.length, 2);
    for (let i = 0; i < 20; i++) {
        const post = { id: 'big' + i, content: '长'.repeat(2000), comments: [] }; data.posts.push(post); trackPostEvent(data, post.id);
    }
    const prompt = buildStoryEventInstruction(data); assert.ok(prompt.length < 6000);
    assert.equal((prompt.match(/事件 event_/g) || []).length <= 6, true);
});

test('cleanup retains recent sources of active events until the event is closed', () => {
    const data = fixture(); const event = trackPostEvent(data, 'p');
    for (let i = 0; i < 5; i++) data.posts.push({ id: 'followup-' + i, content: '进展', eventId: event.id });
    const result = prunePosts(data.posts, 1, getEventProtectedPostIds(data));
    assert.deepEqual(result.posts.map(item => item.id), ['followup-2', 'followup-3', 'followup-4']);
    setStoryEventStatus(data, event.id, 'resolved');
    assert.equal(prunePosts(data.posts, 1, getEventProtectedPostIds(data)).posts.length, 1);
});

test('story verification of a delivery checks actual handover of every requested item', () => {
    const task = { objectiveType: 'delivery', objectiveQuantity: 2, acceptedMessageIndex: 0, deliveryRequirements: [{ name: '蓝色花朵', quantity: 2 }, { name: '纪念币', quantity: 1 }] };
    assert.equal(getTaskProgress(task, [{ mes: '找到了两株蓝色花朵和一枚纪念币' }]).eligible, false);
    assert.equal(getTaskProgress(task, [{ mes: '交付了两株蓝色花朵' }]).eligible, false);
    assert.equal(getTaskProgress(task, [{ mes: '交付了两株蓝色花朵和一枚纪念币' }]).eligible, true);
});
