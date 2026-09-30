import { openCompanionMenu } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-touch-ui-'));
const server = createServer(async (request, response) => {
    try {
        const path = new URL(request.url, 'http://localhost').pathname, file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render };');
        if (path === '/preview.html') body = Buffer.from(body.toString().replace('const listeners = new Map();', 'const listeners = globalThis.petListeners = new Map();'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(file)] || 'application/octet-stream' }); response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [];
async function open(mobile = false) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, hasTouch: mobile });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings(); settings.modules.travel.enabled = true; settings.ui.activeTab = 'services'; petTest.viewState.worldPage = 'travel';
        const companion = getForumData().world.companion;
        companion.satiety = 40; companion.happiness = 45; companion.life.cleanliness = 20; companion.life.autoSleep = false;
        globalThis.petCalls = 0; SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
        petTest.render();
    });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    return page;
}
const readPet = page => page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); return structuredClone(getForumData().world.companion); });
async function point(page, selector) {
    const box = await page.locator(selector).boundingBox(); assert.ok(box);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
try {
    const page = await open();
    await openCompanionMenu(page, 'feed', 'click');
    let food = await point(page, '[data-food-id="berry"]'), pet = await point(page, '.tf-pet-sprite-control');
    await page.mouse.move(food.x, food.y); await page.mouse.down(); await page.mouse.move(pet.x, pet.y, { steps: 12 });
    assert.equal(await page.locator('.tf-pet-drag-snack').count(), 1);
    assert.equal(await page.locator('.is-snack-target').count(), 1);
    await page.mouse.up();
    await page.locator('.is-action-feed').waitFor();
    assert.ok((await readPet(page)).satiety > 40);
    assert.match(await page.locator('.tf-pet-touch-feedback').innerText(), /饱腹 \+/);
    await page.screenshot({ path: join(output, 'feeding-desktop.png') });
    const fed = (await readPet(page)).satiety;
    await openCompanionMenu(page, 'feed', 'click');
    food = await point(page, '[data-food-id="berry"]');
    await page.mouse.move(food.x, food.y); await page.mouse.down(); await page.mouse.move(20, 120, { steps: 10 }); await page.mouse.up();
    assert.equal((await readPet(page)).satiety, fed); assert.equal(await page.locator('.tf-pet-drag-snack').count(), 0);
    assert.equal(await page.locator('.tf-pet-food-select').count(), 1);
    await page.locator('[data-action="companion-food-back"]').click();
    pet = await point(page, '.tf-pet-sprite-control');
    await page.mouse.move(pet.x - 30, pet.y); await page.mouse.down(); await page.mouse.move(pet.x + 30, pet.y, { steps: 12 }); await page.mouse.up();
    await page.locator('.is-action-pet').waitFor();
    const once = (await readPet(page)).bond; assert.ok(once > 0);
    await page.locator('.tf-pet-sprite-control').click(); assert.equal((await readPet(page)).bond, once);
    assert.match(await page.locator('.tf-pet-touch-feedback').innerText(), /蹭蹭/);
    console.log('PASS mouse feeding requires a valid drop; stroking responds without duplicate rewards');

    await openCompanionMenu(page, 'clean', 'click');
    pet = await point(page, '.tf-pet-sprite-control');
    await page.mouse.move(pet.x - 30, pet.y); await page.mouse.down();
    for (let i = 0; i < 4; i++) await page.mouse.move(pet.x + (i % 2 ? -30 : 30), pet.y, { steps: 8 });
    await page.mouse.up();
    await page.locator('.is-bath-done').waitFor(); assert.equal((await readPet(page)).life.cleanliness, 55);
    assert.match(await page.locator('.tf-pet-touch-feedback').innerText(), /清洁 \+35/);
    await page.screenshot({ path: join(output, 'bath-desktop.png') });
    await openCompanionMenu(page, 'clean', 'click');
    await page.locator('.tf-pet-sprite-control').focus();
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => petTest.viewState.companionCleaning), false);
    assert.equal((await readPet(page)).life.cleanliness, 55);
    await openCompanionMenu(page, 'games'); await page.locator('[data-action="pet-game-start"][data-game="catch"]').click(); await page.locator('.tf-pet-game').waitFor();
    const movesBefore = (await readPet(page)).life.game.moves;
    await page.locator('[data-action="companion-menu-nav"][data-direction="1"]').click();
    assert.ok((await readPet(page)).life.game.moves > movesBefore);
    assert.equal(await page.evaluate(() => petCalls), 0);
    console.log('PASS soap scrubbing completes locally and room toy starts a controllable game');
    await page.close();

    const mobile = await open(true);
    await openCompanionMenu(mobile, 'clean', 'tap');
    await mobile.locator('.tf-pet-sprite-control').tap();
    assert.equal((await readPet(mobile)).life.cleanliness, 20);
    assert.match(await mobile.locator('.tf-pet-touch-guide').innerText(), /34%/);
    await mobile.locator('.tf-pet-sprite-control').tap(); await mobile.locator('.tf-pet-sprite-control').tap();
    await mobile.locator('.is-bath-done').waitFor(); assert.equal((await readPet(mobile)).life.cleanliness, 55);
    await mobile.screenshot({ path: join(output, 'bath-mobile.png') });
    await openCompanionMenu(mobile, 'feed', 'tap');
    food = await point(mobile, '[data-food-id="berry"]'); pet = await point(mobile, '.tf-pet-sprite-control');
    const cdp = await mobile.context().newCDPSession(mobile);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: food.x, y: food.y }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: food.x + (pet.x - food.x) * i / 12, y: food.y + (pet.y - food.y) * i / 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.locator('.is-action-feed').waitFor(); assert.ok((await readPet(mobile)).satiety > 40);
    assert.equal(await mobile.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false);
    await mobile.screenshot({ path: join(output, 'feeding-mobile.png') });
    await openCompanionMenu(mobile, 'feed', 'tap');
    food = await point(mobile, '[data-food-id="berry"]');
    const beforeCancel = (await readPet(mobile)).satiety;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: food.x, y: food.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: food.x, y: food.y - 30 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal((await readPet(mobile)).satiety, beforeCancel); assert.equal(await mobile.locator('.tf-pet-drag-snack').count(), 0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: food.x, y: food.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: food.x, y: food.y - 30 }] });
    await mobile.evaluate(() => {
        const context = SillyTavern.getContext(); context.chatId = 'another-pet'; context.chatMetadata = { tavern_forum_data: { world: { companion: { name: '第二只', satiety: 30, life: { autoSleep: false } } } } };
        petListeners.get('chat_changed')();
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal((await readPet(mobile)).satiety, 30); assert.equal(await mobile.locator('.tf-pet-drag-snack').count(), 0);
    assert.equal(await mobile.evaluate(() => petCalls), 0);
    console.log('PASS touch feeding, tap-to-wash fallback and chat-switch cancellation');
    await mobile.close();
    const sleeping = await open(true);
    await sleeping.evaluate(async () => {
        const { getForumData } = await import('/src/store.js'); const life = getForumData().world.companion.life;
        const hour = new Date().getHours(); life.autoSleep = true; life.sleepStart = hour; life.sleepEnd = (hour + 1) % 24;
        petTest.render();
    });
    await sleeping.locator('[aria-label="轻轻叫醒旅伴"]').tap();
    await sleeping.locator('.tf-pet-sprite-control[data-action="companion-care"]').waitFor();
    assert.ok((await readPet(sleeping)).life.awakeUntil > Date.now());
    await openCompanionMenu(sleeping, 'status', 'tap');
    await sleeping.locator('.tf-pet-care-settings > summary').tap();
    await sleeping.locator('.tf-pet-life [data-action="pet-mode"][data-mode="paused"]').tap();
    await sleeping.locator('[data-action="companion-menu-nav"][data-direction="1"]').tap();
    await sleeping.locator('[aria-label="继续照顾旅伴"]').tap();
    assert.equal((await readPet(sleeping)).life.mode, 'active');
    console.log('PASS sleeping and paused pets can resume directly from the screen');
    await sleeping.close();
    assert.deepEqual(errors, []);
    console.log('Screenshots:', output);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
