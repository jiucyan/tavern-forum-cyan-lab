import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const root = resolve('.');
const server = createServer(async (request, response) => {
    try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const path = resolve(root, '.' + pathname);
        if (!path.startsWith(root + sep)) throw new Error('outside root');
        let body = await readFile(path);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body.toString() + '\nglobalThis.imageAssetTest = { viewState, importImageAsset, runImageGeneration, runCommentImageGeneration, handleRootClick };');
        if (pathname === '/preview.html') body = Buffer.from(body.toString().replace('const listeners = new Map();', 'const listeners = globalThis.imageAssetListeners = new Map();'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(path)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.TAVERN_FORUM_BROWSER_PATH || (existsSync(edge) ? edge : '');
let browser;
const errors = [];
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=';
async function fresh() {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.imageAssetTest);
    return page;
}

try {
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    let page = await fresh();
    const shared = await page.evaluate(async image => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { createNpc } = await import('/src/forum.js');
        const data = getForumData(), settings = getSettings(), storage = SillyTavern.libs.localforage;
        await storage.setItem('shared-avatar', image);
        data.npcs.push(createNpc({ name: 'A', avatarKey: 'shared-avatar' }), createNpc({ name: 'B', avatarKey: 'shared-avatar' }));
        const [a, b] = data.npcs.slice(-2);
        settings.avatarLibrary.push({ id: 'shared-library-entry', name: '共享图片', url: '', imageKey: 'shared-avatar' });
        const button = document.createElement('button');
        button.dataset.action = 'clear-npc-avatar'; button.dataset.npcId = a.id;
        await imageAssetTest.handleRootClick({ target: button });
        button.dataset.action = 'delete-avatar-url'; button.dataset.avatarId = 'shared-library-entry';
        await imageAssetTest.handleRootClick({ target: button });
        return { firstKey: a.avatarKey, secondKey: b.avatarKey, stored: await storage.getItem('shared-avatar'), removedFromLibrary: !getSettings().avatarLibrary.some(item => item.id === 'shared-library-entry') };
    }, `data:image/png;base64,${pixel}`);
    assert.equal(shared.firstKey, ''); assert.equal(shared.secondKey, 'shared-avatar');
    assert.equal(shared.stored, `data:image/png;base64,${pixel}`); assert.equal(shared.removedFromLibrary, true);
    console.log('PASS clearing an avatar and removing its library entry preserve other image references');
    await page.close();

    page = await fresh();
    const generated = await page.evaluate(async image => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const context = SillyTavern.getContext(), storage = SillyTavern.libs.localforage;
        Object.assign(getSettings().apiProfiles[0].image, { enabled: true, endpoint: `${location.origin}/fixture-images/v1`, model: 'fixture' });
        const originalFetch = globalThis.fetch;
        let imageVersion = image;
        globalThis.fetch = async (url, options) => String(url).includes('/fixture-images/')
            ? new Response(JSON.stringify({ data: [{ b64_json: imageVersion }] }), { headers: { 'Content-Type': 'application/json' } })
            : originalFetch(url, options);
        const fixture = () => ({ posts: [{ id: 'copied-post', handle: 'user', content: '配图', imagePrompt: '测试配图', comments: [{ id: 'copied-comment', content: '配图', imagePrompt: '测试配图' }] }] });
        context.chatId = 'A'; context.chatMetadata = { tavern_forum_data: fixture() };
        imageAssetListeners.get('chat_changed')();
        const a = getForumData();
        await imageAssetTest.runImageGeneration('copied-post', false);
        await imageAssetTest.runCommentImageGeneration('copied-post', 'copied-comment', false);
        context.chatId = 'B'; context.chatMetadata = { tavern_forum_data: fixture() };
        imageAssetListeners.get('chat_changed')();
        imageVersion = image + '\n';
        const b = getForumData();
        await imageAssetTest.runImageGeneration('copied-post', false);
        await imageAssetTest.runCommentImageGeneration('copied-post', 'copied-comment', false);
        globalThis.fetch = originalFetch;
        const aKeys = [a.posts[0].imageKey, a.posts[0].comments[0].imageKey];
        const bKeys = [b.posts[0].imageKey, b.posts[0].comments[0].imageKey];
        return { aKeys, bKeys, aValues: await Promise.all(aKeys.map(key => storage.getItem(key))), bValues: await Promise.all(bKeys.map(key => storage.getItem(key))) };
    }, pixel);
    assert.equal(new Set([...generated.aKeys, ...generated.bKeys]).size, 4);
    assert.deepEqual(generated.aValues, Array(2).fill(`data:image/png;base64,${pixel}`));
    assert.deepEqual(generated.bValues, Array(2).fill(`data:image/png;base64,${pixel}\n`));
    console.log('PASS copied post and comment IDs generate independent images in different chats');
    await page.close();

    for (const kind of ['avatar', 'background']) {
        page = await fresh();
        const switched = await page.evaluate(async ({ kind, image }) => {
            const { getForumData } = await import('/src/store.js');
            const context = SillyTavern.getContext(), storage = SillyTavern.libs.localforage;
            context.chatId = 'A'; context.chatMetadata = { tavern_forum_data: { posts: [], npcs: [{ id: 'copied-role', name: 'A', [`${kind}Key`]: 'A-old' }] } };
            const a = getForumData();
            const OriginalReader = globalThis.FileReader;
            let finishRead;
            globalThis.FileReader = class { readAsDataURL() { finishRead = () => { this.result = image; this.onload(); }; } };
            imageAssetTest.viewState[kind === 'avatar' ? 'pendingNpcAvatarId' : 'pendingNpcBackgroundId'] = 'copied-role';
            const pending = imageAssetTest.importImageAsset({ id: `tf-import-npc-${kind}-file`, files: [new File(['image'], 'file.png', { type: 'image/png' })], value: '' }).catch(error => error.name);
            context.chatId = 'B'; context.chatMetadata = { tavern_forum_data: { posts: [], npcs: [{ id: 'copied-role', name: 'B', [`${kind}Key`]: 'B-old' }] } };
            imageAssetListeners.get('chat_changed')();
            const b = getForumData();
            await storage.setItem('B-old', image);
            finishRead();
            const status = await pending;
            globalThis.FileReader = OriginalReader;
            return { status, a: a.npcs.find(item => item.id === 'copied-role')[`${kind}Key`], b: b.npcs.find(item => item.id === 'copied-role')[`${kind}Key`], bStored: await storage.getItem('B-old') };
        }, { kind, image: `data:image/png;base64,${pixel}` });
        assert.deepEqual(switched, { status: 'AbortError', a: 'A-old', b: 'B-old', bStored: `data:image/png;base64,${pixel}` });
        console.log(`PASS chat switch during ${kind} reading preserves both chats`);
        await page.close();
    }

    for (const mode of ['upload', 'post', 'comment']) {
        page = await fresh();
        const switched = await page.evaluate(async ({ mode, image }) => {
            const { getForumData, getSettings } = await import('/src/store.js');
            const context = SillyTavern.getContext(), storage = SillyTavern.libs.localforage;
            const originalSetItem = storage.setItem.bind(storage), originalFetch = globalThis.fetch;
            context.chatId = 'A';
            context.chatMetadata = { tavern_forum_data: { posts: [{ id: 'copied-post', imagePrompt: '测试配图', imageKey: 'old-post', comments: [{ id: 'copied-comment', imagePrompt: '测试配图', imageKey: 'old-comment' }] }], npcs: [{ id: 'copied-role', avatarKey: 'old-avatar' }] } };
            const a = getForumData();
            for (const key of ['old-post', 'old-comment', 'old-avatar']) await originalSetItem(key, image);
            let finishWrite, started, writtenKey;
            const writing = new Promise(resolveStarted => { started = resolveStarted; });
            storage.setItem = async (key, value) => { writtenKey = key; await originalSetItem(key, value); started(); await new Promise(resolveWrite => { finishWrite = resolveWrite; }); };
            Object.assign(getSettings().apiProfiles[0].image, { enabled: true, endpoint: `${location.origin}/fixture-images/v1`, model: 'fixture' });
            globalThis.fetch = async (url, options) => String(url).includes('/fixture-images/')
                ? new Response(JSON.stringify({ data: [{ b64_json: image.split(',')[1] }] }), { headers: { 'Content-Type': 'application/json' } }) : originalFetch(url, options);
            let pending;
            if (mode === 'upload') {
                imageAssetTest.viewState.pendingNpcAvatarId = 'copied-role';
                const bytes = Uint8Array.from(atob(image.split(',')[1]), char => char.charCodeAt(0));
                pending = imageAssetTest.importImageAsset({ id: 'tf-import-npc-avatar-file', files: [new File([bytes], 'file.png', { type: 'image/png' })], value: '' }).catch(error => error.name);
            } else pending = mode === 'post' ? imageAssetTest.runImageGeneration('copied-post', false) : imageAssetTest.runCommentImageGeneration('copied-post', 'copied-comment', false);
            await writing;
            context.chatId = 'B'; context.chatMetadata = { tavern_forum_data: { topic: 'B-original', posts: [], npcs: [{ id: 'copied-role', avatarKey: 'B-old' }] } };
            imageAssetListeners.get('chat_changed')();
            finishWrite();
            await pending;
            storage.setItem = originalSetItem; globalThis.fetch = originalFetch;
            return { aKeys: [a.posts[0].imageKey, a.posts[0].comments[0].imageKey, a.npcs.find(item => item.id === 'copied-role').avatarKey], topic: getForumData().topic, bKey: getForumData().npcs.find(item => item.id === 'copied-role').avatarKey, newStored: Boolean(await storage.getItem(writtenKey)), oldStored: await storage.getItem('old-post') };
        }, { mode, image: `data:image/png;base64,${pixel}` });
        assert.deepEqual(switched.aKeys, ['old-post', 'old-comment', 'old-avatar']);
        assert.equal(switched.topic, 'B-original'); assert.equal(switched.bKey, 'B-old');
        assert.equal(switched.newStored, false); assert.equal(switched.oldStored, `data:image/png;base64,${pixel}`);
        console.log(`PASS chat switch during ${mode} persistence removes only the unattached image`);
        await page.close();
    }

    page = await fresh();
    const imported = await page.evaluate(async image => {
        const { getForumData } = await import('/src/store.js');
        const data = getForumData(), npc = data.npcs.find(item => data.conversations.some(conversation => conversation.targetId === item.id));
        imageAssetTest.viewState.pendingNpcAvatarId = npc.id;
        const bytes = Uint8Array.from(atob(image), char => char.charCodeAt(0));
        await imageAssetTest.importImageAsset({ id: 'tf-import-npc-avatar-file', files: [new File([bytes], 'avatar.png', { type: 'image/png' })], value: '' });
        return { key: npc.avatarKey, stored: await SillyTavern.libs.localforage.getItem(npc.avatarKey), dmKey: data.conversations.find(item => item.targetId === npc.id)?.avatarKey };
    }, pixel);
    assert.ok(imported.key); assert.equal(imported.stored, `data:image/png;base64,${pixel}`); assert.equal(imported.dmKey, imported.key);
    console.log('PASS a normal avatar upload updates the captured role and its conversation');
    await page.close();
    assert.deepEqual(errors, []);
} finally {
    await browser?.close();
    await new Promise(resolveClose => server.close(resolveClose));
}
