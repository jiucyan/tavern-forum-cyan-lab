import { openCompanionMenu } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.');
const output = process.env.TAVERN_FORUM_SCREENSHOT_DIR || resolve(tmpdir(), `forum-workflows-${Date.now()}`);
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
    try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw new Error('outside root');
        let body = await readFile(file);
        // Test hooks exist only in this isolated server's responses.
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body.toString() + '\nglobalThis.workflowTest = { runGeneration, runTaskVerification, runWorldModuleGeneration, viewState, render, applyForumImport, setMeSection };');
        if (pathname === '/preview.html') body = Buffer.from(body.toString().replace('const listeners = new Map();', 'const listeners = globalThis.workflowListeners = new Map();'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(pathname)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.TAVERN_FORUM_BROWSER_PATH || (existsSync(edge) ? edge : '');
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const errors = [];
async function fresh(width = 1440) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.workflowTest);
    return page;
}

try {
    let page = await fresh();
    const switched = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().sources.worldInfo = false;
        const context = SillyTavern.getContext();
        let finish;
        const started = new Promise(resolveStarted => { context.generateRaw = () => { resolveStarted(); return new Promise(resolveResult => { finish = resolveResult; }); }; });
        const pending = workflowTest.runGeneration();
        await started;
        context.chatId = 'chat-b'; context.chatMetadata = { tavern_forum_data: { topic: 'B', posts: [{ id: 'b-only', handle: 'b', content: 'B original', comments: [] }] } };
        workflowListeners.get('chat_changed')();
        finish(JSON.stringify({ topic: 'A', posts: [{ content: 'A response', handle: 'a' }] }));
        await pending;
        const saved = getForumData(); return { topic: saved.topic, ids: saved.posts.map(post => post.id), logs: saved.generationLogs.length };
    });
    assert.equal(switched.topic, 'B'); assert.deepEqual(switched.ids, ['b-only']); assert.equal(switched.logs, 0);
    console.log('PASS chat switch preserves the destination forum');
    await page.close();

    page = await fresh();
    const task = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().modules.tasks.verificationApiEnabled = false;
        SillyTavern.getContext().chat.push({ mes: '终于拿到了蓝色钥匙。' });
        getForumData().world.tasks.push({ id: 'test-task', title: '寻找蓝色钥匙', objectiveTarget: '蓝色钥匙', acceptedMessageIndex: 2, status: 'accepted', reward: '徽章' });
        await workflowTest.runTaskVerification('test-task');
        await workflowTest.runTaskVerification('test-task');
        const data = getForumData(); return { status: data.world.tasks.find(item => item.id === 'test-task').status, rewards: data.world.inventory.filter(item => item.source === '任务奖励 · test-task').length };
    });
    assert.deepEqual(task, { status: 'completed', rewards: 1 });
    console.log('PASS task completion survives rendering and grants one reward');
    await page.close();

    page = await fresh();
    const disabled = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const config = getSettings(); config.sources.worldInfo = false; config.modules.tasks.enabled = false; config.orchestration.enabled = false;
        SillyTavern.getContext().generateRaw = async () => JSON.stringify({ topic: 'test', posts: [{ content: '普通帖子', handle: 'person' }], worldUpdates: { tasks: [{ title: 'DISABLED_TASK', description: '不应该送达', issuer: '禁用委托人', issuerHandle: 'disabled-issuer' }] } });
        await workflowTest.runGeneration();
        const data = getForumData(); return { npc: data.npcs.some(item => item.handle === 'disabled-issuer'), delivered: data.conversations.some(item => item.messages.some(message => message.content.includes('DISABLED_TASK'))) };
    });
    assert.deepEqual(disabled, { npc: false, delivered: false });
    console.log('PASS disabled modules cannot create contacts or messages');
    await page.close();

    page = await fresh();
    const journey = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const config = getSettings(); config.sources.worldInfo = false; config.orchestration.enabled = true;
        Object.assign(config.modules.travel, { enabled: true, generationMode: 'linked', probability: 100 });
        SillyTavern.getContext().generateRaw = async () => JSON.stringify({ topic: 'test', posts: [{ content: '普通帖子', handle: 'person' }], worldUpdates: { travel: { companion: { status: 'away', destination: '花园' }, journeys: [{ destination: '花园', status: 'away', messages: [{ content: '花开了', progress: .5 }], souvenir: '石头' }] } } });
        await workflowTest.runGeneration();
        const trip = getForumData().world.trips.at(-1);
        return { scheduled: trip.messages.every(message => message.scheduledAt > 0), returnAt: trip.returnAt };
    });
    assert.equal(journey.scheduled, true); assert.ok(journey.returnAt > Date.now());
    console.log('PASS linked travel schedules messages and return');
    await page.close();

    page = await fresh(390);
    const focused = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().sources.worldInfo = false;
        const original = getForumData().posts.length;
        const comments = getForumData().posts[0].comments.length;
        workflowTest.viewState.generationMode = 'threads';
        SillyTavern.getContext().generateRaw = async () => JSON.stringify({ threadUpdates: [{ postId: 'post-1', comments: [{ author: '居民', handle: 'resident', content: '接着聊这个话题。' }] }] });
        await workflowTest.runGeneration();
        const data = getForumData(); return { posts: data.posts.length - original, comments: data.posts[0].comments.length - comments };
    });
    assert.deepEqual(focused, { posts: 0, comments: 1 });
    await page.screenshot({ path: resolve(output, 'workflow-mobile.png') });
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false);
    console.log('PASS thread-only generation adds replies without creating posts');
    await page.close();

    page = await fresh();
    await page.evaluate(async () => {
        const { getSettings } = await import('/src/store.js'); getSettings().sources.worldInfo = false;
        SillyTavern.getContext().generateRaw = () => new Promise(resolve => { globalThis.finishCancelledGeneration = resolve; });
        void workflowTest.runGeneration();
    });
    await page.waitForFunction(() => globalThis.finishCancelledGeneration);
    await page.locator('[data-action="cancel-generation"]').click();
    await page.waitForFunction(() => !workflowTest.viewState.busy);
    const cancelled = await page.evaluate(async () => {
        finishCancelledGeneration('{"posts":[{"content":"不要保存"}]}');
        await new Promise(resolve => setTimeout(resolve, 20));
        const { getForumData } = await import('/src/store.js');
        return getForumData().posts.some(post => post.content === '不要保存');
    });
    assert.equal(cancelled, false);
    console.log('PASS cancel button rejects late responses');
    await page.close();

    page = await fresh();
    const packed = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const config = getSettings(); config.sources.worldInfo = false;
        Object.assign(config.modules.travel, { enabled: true, generationMode: 'independent' });
        const data = getForumData();
        data.world.inventory.push({ id: 'packed-food', name: '口粮', quantity: 2, usable: true });
        data.world.companion.packedItemIds = ['packed-food'];
        SillyTavern.getContext().generateRaw = async () => JSON.stringify({ worldUpdates: { travel: { companion: { status: 'away', destination: '山间' }, journeys: [{ destination: '山间', status: 'away', departureMessage: '出发', messages: [{ content: '路上见闻' }] }] } } });
        await workflowTest.runWorldModuleGeneration('travel', { forceApi: true, startJourney: true });
        const saved = getForumData();
        return { quantity: saved.world.inventory.find(item => item.id === 'packed-food').quantity, packing: saved.world.trips.at(-1).packingSummary, away: saved.world.companion.status };
    });
    assert.equal(packed.quantity, 1); assert.equal(packed.away, 'away'); assert.match(packed.packing, /口粮/);
    console.log('PASS departure consumes selected food and retains the packing record');
    await page.close();

    page = await fresh(390);
    await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings(); settings.sources.worldInfo = false;
        Object.assign(settings.modules.travel, { enabled: true, generationMode: 'independent', travelDurationPreset: 'custom', travelMinMinutes: 10, travelMaxMinutes: 10, travelMessageMinMinutes: 2, travelMessageMaxMinutes: 2 });
        settings.ui.activeTab = 'services'; workflowTest.viewState.worldPage = 'travel';
        const data = getForumData(); data.world.trips = []; data.world.companion.status = 'home'; data.world.companion.packedItemIds = [];
        data.world.inventory.push({ id: 'test-food', name: '旅途口粮', quantity: 2, usable: true }, { id: 'test-map', name: '溪流地图', description: '画着水边小路', quantity: 1, usable: true });
        globalThis.travelCalls = 0;
        SillyTavern.getContext().generateRaw = async () => { globalThis.travelCalls++; return JSON.stringify({ worldUpdates: { travel: { journeys: [{ destination: '溪边', status: 'away', departureMessage: '带着行囊出门啦', messages: [{ content: '沿地图找到溪流', progress: .2 }, { content: '尚未到达的瀑布', progress: .8 }], notes: '完整结局隐藏文字', returnMessage: '平安回来啦', souvenir: '溪石纪念章' }] } } }); };
        workflowTest.render();
    });
    await openCompanionMenu(page, 'travel', 'click');
    await page.locator('[data-packed-item-id="test-food"]').check();
    await page.locator('[data-packed-item-id="test-map"]').check();
    assert.match(await page.locator('.tf-packing-preview').innerText(), /缩短 15%/);
    assert.match(await page.locator('.tf-packing-preview').innerText(), /旅途口粮 ×1/);
    assert.match(await page.locator('.tf-packing-preview').innerText(), /溪流地图 ×1/);
    await page.locator('.tf-packing').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'packing-mobile.png') });
    await page.locator('[data-action="companion-depart-ai"]').click();
    await page.waitForFunction(() => !workflowTest.viewState.moduleBusy.has('travel'));
    assert.equal(await page.locator('.tf-travel-record').count(), 1);
    assert.doesNotMatch(await page.locator('.tf-travel-history').textContent(), /完整结局隐藏文字|溪石纪念章|尚未到达的瀑布/);
    assert.equal(await page.locator('[data-packed-item-id="test-map"]').isDisabled(), true);
    const settled = await page.evaluate(async () => {
        const { getForumData } = await import('/src/store.js'); const { advanceCompanionJourney } = await import('/src/world.js');
        const data = getForumData(); const trip = data.world.trips.at(-1);
        advanceCompanionJourney(data, { now: trip.returnAt }); workflowTest.render();
        return { minutes: trip.plannedDurationMinutes, quantity: data.world.inventory.find(x => x.id === 'test-food').quantity, calls: globalThis.travelCalls };
    });
    assert.deepEqual(settled, { minutes: 8.5, quantity: 1, calls: 1 });
    await page.locator('.tf-travel-record summary').click();
    assert.match(await page.locator('.tf-travel-history').innerText(), /完整结局隐藏文字/);
    assert.match(await page.locator('.tf-travel-history').innerText(), /溪石纪念章 · 已放入背包/);
    assert.match(await page.locator('.tf-travel-history').innerText(), /返还道具：溪流地图/);
    assert.equal(await page.locator('[data-packed-item-id="test-map"]').isDisabled(), false);
    await page.locator('.tf-travel-record').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'travel-record-mobile.png') });
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false);
    console.log('PASS mobile packing preview, hidden endings and complete return records');
    await page.close();

    page = await fresh();
    const failedDeparture = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings(); settings.sources.worldInfo = false; settings.modules.travel.enabled = true;
        const data = getForumData(); data.world.trips = []; data.world.companion.status = 'home';
        data.world.inventory.push({ id: 'test-food', name: '口粮', quantity: 2, usable: true }); data.world.companion.packedItemIds = ['test-food'];
        SillyTavern.getContext().generateRaw = async () => { throw new Error('模拟连接失败'); };
        await workflowTest.runWorldModuleGeneration('travel', { forceApi: true, startJourney: true });
        const first = { quantity: getForumData().world.inventory.find(x => x.id === 'test-food').quantity, trips: getForumData().world.trips.length };
        SillyTavern.getContext().generateRaw = async () => {
            getForumData().world.companion.packedItemIds = [];
            return JSON.stringify({ worldUpdates: { travel: { journeys: [{ destination: '小路', status: 'away' }] } } });
        };
        await workflowTest.runWorldModuleGeneration('travel', { forceApi: true, startJourney: true });
        return { first, changed: { quantity: getForumData().world.inventory.find(x => x.id === 'test-food').quantity, trips: getForumData().world.trips.length, status: getForumData().world.companion.status } };
    });
    assert.deepEqual(failedDeparture, { first: { quantity: 2, trips: 0 }, changed: { quantity: 2, trips: 0, status: 'home' } });
    console.log('PASS failed requests and changed packing leave no consumption or ghost journeys');
    await page.close();

    page = await fresh();
    page.on('dialog', dialog => dialog.accept());
    await page.locator('[data-action="toggle-post-menu"][data-post-id="post-1"]').click();
    await page.locator('[data-action="delete-post"][data-post-id="post-1"]').click();
    await page.evaluate(() => workflowTest.setMeSection('data'));
    await page.locator('.tf-recycle-bin summary').click();
    await page.locator('[data-action="restore-deleted-post"][data-deleted-id="post-1"]').click();
    const restored = await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); return getForumData().posts.find(post => post.id === 'post-1')?.comments.length; });
    assert.ok(restored > 0);
    console.log('PASS deleting and restoring a post preserves its comments');
    await page.close();

    page = await fresh();
    const recovered = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js'); getSettings().sources.worldInfo = false;
        let calls = 0; SillyTavern.getContext().generateRaw = async () => { calls++; throw new Error('must not call'); };
        const data = getForumData(); const original = data.posts.length;
        data.generationLogs.push({ id: 'recover', status: 'error', output: JSON.stringify({ posts: [{ content: '可恢复的帖子', handle: 'restore' }] }) });
        await workflowTest.runGeneration({ recoveredLog: data.generationLogs.at(-1) });
        return { calls, added: getForumData().posts.length - original, recovered: Boolean(getForumData().generationLogs.find(log => log.id === 'recover').recoveredAt) };
    });
    assert.deepEqual(recovered, { calls: 0, added: 1, recovered: true });
    console.log('PASS recovery parses stored output without requesting a model');
    await page.close();

    page = await fresh(390);
    await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { buildForumBackup, readForumBackup } = await import('/src/backup.js');
        const bundle = await buildForumBackup(getForumData(), getSettings(), SillyTavern.libs.localforage);
        workflowTest.viewState.pendingImport = readForumBackup(bundle);
        workflowTest.setMeSection('data');
    });
    assert.equal(await page.locator('.tf-import-preview').count(), 1);
    await page.screenshot({ path: resolve(output, 'import-preview-mobile.png') });
    await page.locator('[data-action="apply-forum-import"][data-import-mode="merge"]').click();
    await page.waitForFunction(() => !workflowTest.viewState.pendingImport);
    assert.equal(await page.locator('[data-action="undo-forum-import"]').count(), 1);
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false);
    console.log('PASS import preview, merge and undo entry on mobile');
    await page.close();
    page = await fresh(390);
    await page.evaluate(async () => {
        const { getForumData } = await import('/src/store.js');
        const npc = getForumData().npcs.find(role => role.id === 'npc-night');
        npc.memory.importantMemories = ['承诺一起调查灯塔'];
        npc.memory.unresolvedEvents = ['等待旧码头的回信'];
        npc.memory.privateImportantMemories = ['只在私信中保留的线索'];
        workflowTest.viewState.selectedMemoryNpcId = npc.id;
        workflowTest.setMeSection('memory');
    });
    await page.locator('[data-action="refresh-memory-summary"]').click();
    assert.match(await page.locator('.tf-memory-summary pre').first().textContent(), /承诺一起调查灯塔/);
    assert.doesNotMatch(await page.locator('.tf-memory-summary pre').first().textContent(), /只在私信/);
    await page.locator('[data-memory-auto-summary]').uncheck();
    assert.equal(await page.locator('[data-memory-auto-summary]').isChecked(), false);
    await page.locator('[data-action="resolve-memory-event"]').click();
    assert.equal(await page.locator('[data-action="resolve-memory-event"]').count(), 0);
    page.on('dialog', dialog => dialog.accept('对调查路线的分歧'));
    await page.locator('[data-action="record-memory-transition"][data-transition="quarrel"]').click();
    const quarrel = await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); return getForumData().npcs.find(role => role.id === 'npc-night').socialState; });
    assert.equal(quarrel, 'quarrel');
    await page.locator('[data-action="record-memory-transition"][data-transition="reconcile"]').click();
    const reconciled = await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); return getForumData().npcs.find(role => role.id === 'npc-night').socialState; });
    assert.equal(reconciled, 'normal');
    await page.locator('.tf-memory-summary').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'memory-summary-mobile.png') });
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false);
    console.log('PASS memory summaries, unresolved items and relationship transitions on mobile');
    await page.close();
    page = await fresh(390);
    await page.locator('[data-action="toggle-post-menu"][data-post-id="post-1"]').click();
    await page.locator('[data-action="track-post-event"][data-post-id="post-1"]').click();
    await page.waitForFunction(() => document.querySelector('.tf-event-record[open]'));
    assert.equal(await page.locator('.tf-event-record[open]').count(), 1);
    await page.evaluate(async () => {
        const { getForumData, getSettings, saveForumData } = await import('/src/store.js'); const data = getForumData(); const settings = getSettings();
        settings.modules.tasks.enabled = true; settings.sources.worldInfo = false;
        data.world.tasks = [{ id: 'delivery-ui', title: '蓝花交付', issuer: '花匠', status: 'offered', objectiveType: 'delivery', objectiveTarget: '蓝色花朵', objectiveQuantity: 3, rewardItems: [{ name: '纪念币', quantity: 5 }], eventId: data.events[0].id }];
        data.world.inventory.push({ id: 'flowers-1', name: '蓝色花朵', quantity: 2 }, { id: 'flowers-2', name: '蓝色花朵', quantity: 2 });
        globalThis.deliveryApiCalls = 0; SillyTavern.getContext().generateRaw = async () => { globalThis.deliveryApiCalls++; throw new Error('local delivery must not call API'); };
        await saveForumData(data, true); workflowTest.render();
    });
    await page.locator('[data-action="open-event-task"]').first().click();
    await page.locator('[data-world-item-id="delivery-ui"] [data-action="set-task-status"][data-status="accepted"]').click();
    await page.locator('[data-delivery-item="flowers-1"]').fill('2'); await page.locator('[data-delivery-item="flowers-1"]').dispatchEvent('change');
    await page.locator('[data-delivery-item="flowers-2"]').fill('1'); await page.locator('[data-delivery-item="flowers-2"]').dispatchEvent('change');
    assert.equal(await page.locator('[data-action="submit-task-delivery"]').isEnabled(), true);
    assert.match(await page.locator('.tf-delivery-preview').innerText(), /纪念币 ×5/);
    await page.locator('.tf-task-delivery').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'task-delivery-mobile.png') });
    await page.locator('[data-action="submit-task-delivery"]').click();
    await page.locator('.tf-delivery-receipt summary').click();
    assert.match(await page.locator('.tf-delivery-receipt').innerText(), /实际扣除：蓝色花朵 ×2、蓝色花朵 ×1/);
    assert.match(await page.locator('.tf-delivery-receipt').innerText(), /实际奖励：纪念币 ×5/);
    assert.equal(await page.evaluate(() => globalThis.deliveryApiCalls), 0);
    await page.locator('.tf-delivery-receipt [data-action="open-story-event"]').click();
    assert.match(await page.locator('.tf-event-record[open]').innerText(), /蓝花交付 · 已完成/);
    await page.locator('.tf-event-record[open]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'story-event-mobile.png') });
    await page.locator('[data-action="set-story-event-status"]').click();
    assert.match(await page.locator('.tf-event-record > summary').innerText(), /已收尾/);
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false);
    console.log('PASS mobile event tracking, local delivery and durable receipts without API calls');
    await page.close();

    page = await fresh();
    const linkedEvent = await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings(); settings.sources.worldInfo = false; settings.orchestration.enabled = true;
        Object.assign(settings.modules.tasks, { enabled: true, generationMode: 'linked', probability: 100 });
        Object.assign(settings.social.proactiveDms, { enabled: true, withForumRefresh: true, requireFollow: false, probability: 100, maxPerRun: 2 });
        let calls = 0, received = '';
        const npc = getForumData().npcs.find(item => item.id === 'npc-night'); npc.profileGenerated = true;
        SillyTavern.getContext().generateRaw = async options => { calls++; received = JSON.stringify(options.prompt); return JSON.stringify({
            posts: [{ content: '灯塔的求助有了线索', handle: npc.handle, eventId: 'new:lighthouse' }],
            eventUpdates: [{ id: 'new:lighthouse', title: '灯塔求助' }],
            worldUpdates: { tasks: [{ title: '收集灯油', issuer: npc.name, issuerHandle: npc.handle, objectiveType: 'delivery', objectiveTarget: '灯油', eventId: 'new:lighthouse' }] },
            dmEvents: [{ targetHandle: npc.handle, content: '私信中的秘密灯塔线索', eventId: 'new:lighthouse' }]
        }); };
        await workflowTest.runGeneration();
        const data = getForumData(); const event = data.events[0];
        const { buildStoryEventInstruction } = await import('/src/events.js');
        return { calls, instructions: received.includes('持续事件'), count: data.events.length, linked: data.posts.at(-1).eventId === event.id && data.world.tasks.at(-1).eventId === event.id, privateEntries: event.entries.filter(item => item.private).length, nextPrompt: buildStoryEventInstruction(data) };
    });
    assert.equal(linkedEvent.calls, 1); assert.equal(linkedEvent.instructions, true); assert.equal(linkedEvent.count, 1); assert.equal(linkedEvent.linked, true);
    assert.ok(linkedEvent.privateEntries >= 2); assert.doesNotMatch(linkedEvent.nextPrompt, /私信中的秘密灯塔线索/);
    console.log('PASS posts, tasks and private event links reuse one forum request');
    await page.close();

    page = await fresh();
    await page.evaluate(async () => {
        const { getForumData, getSettings, saveForumData } = await import('/src/store.js');
        const data = getForumData(); getSettings().modules.tasks.enabled = true; getSettings().ui.activeTab = 'services'; workflowTest.viewState.worldPage = 'tasks';
        data.world.tasks = [{ id: 'stale-delivery', title: '交付', status: 'accepted', objectiveType: 'item', objectiveTarget: '药草', objectiveQuantity: 2 }];
        data.world.inventory.push({ id: 'herb', name: '药草', quantity: 2 }); await saveForumData(data, true); workflowTest.render();
    });
    await page.locator('[data-delivery-item="herb"]').fill('2'); await page.locator('[data-delivery-item="herb"]').dispatchEvent('change');
    await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); getForumData().world.inventory.find(item => item.id === 'herb').quantity = 1; });
    await page.locator('[data-action="submit-task-delivery"]').click();
    const stale = await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); const data = getForumData(); return { status: data.world.tasks[0].status, quantity: data.world.inventory.find(item => item.id === 'herb').quantity }; });
    assert.deepEqual(stale, { status: 'accepted', quantity: 1 });
    console.log('PASS stale delivery previews cannot consume changed inventory');
    await page.close();

    page = await fresh(390);
    await page.evaluate(async () => {
        const { getForumData, getSettings, saveForumData } = await import('/src/store.js');
        const data = getForumData(), settings = getSettings(); settings.modules.travel.enabled = true;
        settings.ui.activeTab = 'services'; workflowTest.viewState.worldPage = 'travel';
        data.world.companion.life.cleanliness = 20; data.world.companion.life.coins = 80;
        data.world.inventory.push({ id: 'pet-souvenir', name: '湖边贝壳', quantity: 1, source: '团子返程 · test' });
        globalThis.petApiCalls = 0; SillyTavern.getContext().generateRaw = async () => { petApiCalls++; throw new Error('local pet requested a model'); };
        await saveForumData(data, true); workflowTest.render();
    });
    await openCompanionMenu(page, 'status', 'click');
    await page.locator('.tf-pet-care-settings > summary').click();
    await page.locator('.tf-pet-care-settings [data-action="pet-tend"][data-tend="clean"]').click();
    assert.equal(await page.locator('.tf-pet-life meter').getAttribute('value'), '55');
    await page.locator('.tf-pet-care-settings [data-action="pet-mode"][data-mode="paused"]').click();
    assert.equal(await page.locator('.tf-pet-care-settings [data-action="pet-tend"][data-tend="clean"]').isDisabled(), true);
    await page.locator('.tf-pet-care-settings [data-action="pet-mode"][data-mode="active"]').click();
    await page.locator('.tf-pet-care-settings [data-action="pet-tend"][data-tend="rest"]').click();
    assert.equal(await page.locator('.is-living-sleep').count(), 1);
    await page.locator('.tf-pet-care-settings [data-action="pet-tend"][data-tend="wake"]').click();
    await openCompanionMenu(page, 'dress', 'click');
    const shop = page.locator('.tf-pet-life-details').filter({ has: page.locator('.tf-pet-shop') });
    await shop.locator('summary').click();
    await page.locator('[data-action="pet-buy"][data-item="snack"]').click();
    await page.locator('[data-action="pet-buy"][data-item="ball"]').click();
    await page.locator('[data-action="pet-toy"][data-item="ball"]').click();
    await page.locator('[data-action="pet-buy"][data-item="lamp"]').click();
    const shelf = page.locator('.tf-pet-life-details').filter({ has: page.locator('[data-pet-setting="displayItemId"]') });
    await shelf.locator('summary').click();
    await page.locator('[data-pet-setting="displayItemId"]').selectOption('pet-souvenir');
    assert.match(await page.locator('.tf-pet-keepsake').textContent(), /湖边贝壳/);
    await page.locator('[data-action="companion-menu-nav"][data-direction="1"]').click();
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'pet-life-mobile.png') });
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false);
    const beforeGame = await page.evaluate(async () => {
        const { getForumData } = await import('/src/store.js'); const data = getForumData();
        return { coins: data.world.companion.life.coins, quantity: data.world.inventory.find(item => item.id === 'pet-souvenir').quantity, snacks: data.world.inventory.find(item => item.source === '陪伴小铺').quantity };
    });
    assert.deepEqual(beforeGame, { coins: 26, quantity: 1, snacks: 1 });
    await openCompanionMenu(page, 'games', 'click');
    await page.locator('[data-action="pet-game-start"][data-game="catch"]').click();
    await page.locator('.tf-pet-game').waitFor();
    await page.waitForTimeout(2200);
    for (let move = 0; move < 6; move++) {
        await page.locator(`[data-action="companion-menu-nav"][data-direction="${move % 2 ? 1 : -1}"]`).click();
        await page.waitForTimeout(130);
    }
    await page.screenshot({ path: resolve(output, 'pet-game-mobile.png') });
    await page.waitForFunction(async () => { const { getForumData } = await import('/src/store.js'); return !getForumData().world.companion.life.game; }, null, { timeout: 45000 });
    await page.waitForFunction(() => /获得 .*陪伴币/.test(document.querySelector('.tf-pet-message')?.textContent || ''));
    assert.match(await page.locator('.tf-pet-message').textContent(), /获得 .*陪伴币/);
    const gameCoins = await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); return getForumData().world.companion.life.coins; });
    assert.ok(gameCoins > beforeGame.coins);
    await page.locator('[data-action="companion-menu-confirm"]').click();
    assert.equal(await page.evaluate(() => petApiCalls), 0);
    console.log('PASS mobile care, sleep, modes, shop, souvenir display and timed three-button game without API calls');
    await page.close();

    page = await fresh();
    await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services'; workflowTest.viewState.worldPage = 'travel';
        getForumData().world.companion.life.autoSleep = false; workflowTest.render();
    });
    await openCompanionMenu(page, 'games', 'click');
    await page.locator('[data-action="pet-game-start"][data-game="catch"]').click();
    await page.locator('[data-action="companion-menu-nav"][data-direction="1"]').click();
    await page.evaluate(() => {
        const context = SillyTavern.getContext(); context.chatId = 'pet-other-chat'; context.chatMetadata = { tavern_forum_data: { world: { companion: { name: '第二只', life: { coins: 7, autoSleep: false } } } } };
        workflowListeners.get('chat_changed')();
    });
    await page.waitForTimeout(1200);
    const switchedPet = await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); const companion = getForumData().world.companion; return { name: companion.name, coins: companion.life.coins, game: companion.life.game }; });
    assert.deepEqual(switchedPet, { name: '第二只', coins: 7, game: null });
    await page.locator('.tf-companion-home').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'pet-life-desktop.png') });
    await openCompanionMenu(page, 'status', 'click');
    await page.screenshot({ path: resolve(output, 'pet-life-panel-desktop.png') });
    console.log('PASS pet clock and game state remain isolated after switching chats');
    await page.close();

    assert.deepEqual(errors, []);
    console.log('Screenshots:', output);
} finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
}
