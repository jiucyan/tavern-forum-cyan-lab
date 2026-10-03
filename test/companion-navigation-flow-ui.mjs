import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { openCompanionMenu } from './companion-navigation.mjs';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-navigation-ui-'));
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
const press = (page, key) => page.locator(key === 'B' ? '[data-action="companion-menu-confirm"]' : `[data-action="companion-menu-nav"][data-direction="${key === 'A' ? -1 : 1}"]`).click();
const panel = page => page.locator('.tf-companion-device').getAttribute('data-device-page');
const readPet = page => page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world.companion));
const selected = page => page.locator('.tf-device-icon-menu .is-device-selected').getAttribute('data-panel');
const pages = ['status', 'games', 'album', 'travel', 'dress'];
const tabs = page => page.locator('.tf-device-page-tabs:visible');
async function assertHomeControls(page) {
    assert.equal(await panel(page), 'home');
    assert.equal(await tabs(page).count(), 0, 'home keeps its original screen without page tabs');
    for (const [key, label] of [['A', '菜单'], ['B', '摸摸'], ['C', '状态']]) {
        const control = page.locator(key === 'B' ? '[data-action="companion-menu-confirm"]' : `[data-action="companion-menu-nav"][data-direction="${key === 'A' ? -1 : 1}"]`);
        assert.equal(await control.getAttribute('aria-label'), label, `home ${key} keeps ${label}`);
    }
}
async function home(page) {
    for (let step = 0; step < 8; step++) {
        const transient = await page.evaluate(() => petTest.viewState.companionCleaning || petTest.viewState.companionFoodMenuOpen);
        if (await panel(page) === 'home' && !transient) return;
        await press(page, 'C');
    }
    assert.fail('Return chain did not reach home');
}
async function fixture(page, values = {}) {
    await home(page);
    await page.evaluate(async values => {
        const pet = (await import('/src/store.js')).getForumData().world.companion;
        Object.assign(pet, { status: 'home', satiety: 80, energy: 80, happiness: 80, lastInteractionAt: 0 }, values.pet);
        Object.assign(pet.life, { mode: 'active', autoSleep: false, sleepUntil: 0, awakeUntil: 0, cleanliness: 80, game: null, growthNotice: null, stage: 'adult', lastTickAt: Date.now() }, values.life);
        petTest.viewState.companionFeedback = null;
        petTest.viewState.companionGameResultOpen = false;
        petTest.render();
    }, values);
}
async function open(width = 1280) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 600 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(async () => {
        const { getSettings } = await import('/src/store.js');
        const settings = getSettings(); settings.modules.travel.enabled = true; settings.ui.activeTab = 'services'; petTest.viewState.worldPage = 'travel';
        globalThis.petCalls = 0; SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
        petTest.render();
    });
    await fixture(page);
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    return page;
}
async function enterCare(page, kind, source) {
    await fixture(page, kind === 'feed' ? { pet: { satiety: 20 } } : { life: { cleanliness: 20 } });
    if (source === 'menu') await openCompanionMenu(page, kind);
    else if (source === 'status') {
        await press(page, 'C');
        await page.locator('.tf-pet-need button').click();
    } else await page.locator('.tf-device-need').click();
    assert.equal(await panel(page), 'home', `${kind} is performed with pet visible`);
    assert.equal(await page.evaluate(kind => kind === 'feed' ? petTest.viewState.companionFoodMenuOpen : petTest.viewState.companionCleaning, kind), true);
}
try {
    console.log('Screenshots:', output);
    const page = await open();
    await assertHomeControls(page);
    for (const target of pages) {
        await openCompanionMenu(page, target);
        assert.equal(await panel(page), target);
        await press(page, 'C');
        await assertHomeControls(page);
        await press(page, 'A');
        assert.equal(await selected(page), target, `${target} keeps the same semantic menu choice`);
        assert.equal(await tabs(page).count(), 0, 'menu does not contain page tabs');
        await press(page, 'C'); assert.equal(await panel(page), 'home');
        await openCompanionMenu(page, target);
        await page.locator('.tf-pet-device-page:not([hidden]) > header [data-action="companion-panel"][data-panel="home"]').click();
        await assertHomeControls(page);
    }
    await openCompanionMenu(page, 'travel');
    for (const target of [...pages, ...pages.slice().reverse()]) {
        assert.deepEqual(await tabs(page).locator('[data-panel]').evaluateAll(nodes => nodes.map(node => node.dataset.panel)), pages);
        await tabs(page).locator(`[data-panel="${target}"]`).click();
        assert.equal(await panel(page), target, `one tab click opens ${target}`);
        assert.equal(await tabs(page).locator('[aria-current="page"]').getAttribute('data-panel'), target, 'current tab is accessible');
        assert.equal(await page.locator('.tf-device-icon-menu').isVisible(), false, 'tab switch does not open menu');
    }
    await press(page, 'C'); await assertHomeControls(page);
    await press(page, 'A'); assert.equal(await selected(page), 'status', 'menu remembers the last direct tab selection');
    await press(page, 'C'); await assertHomeControls(page);
    await press(page, 'C'); assert.equal(await panel(page), 'status');
    await press(page, 'C'); assert.equal(await panel(page), 'home', 'home status shortcut returns straight home');
    await press(page, 'C'); await page.locator('.tf-pet-pack-shortcut').click();
    assert.equal(await panel(page), 'travel'); await press(page, 'C'); await assertHomeControls(page);
    console.log('PASS five direct page tabs, one-press home from C/header, unchanged home controls and menu memory');

    await openCompanionMenu(page, 'dress'); await home(page);
    await press(page, 'A'); assert.equal(await panel(page), 'menu'); assert.equal(await selected(page), 'dress');
    await press(page, 'B'); assert.equal(await panel(page), 'dress', 'B executes remembered pointer choice immediately');
    await press(page, 'C'); await press(page, 'A'); assert.equal(await selected(page), 'dress');
    await press(page, 'A'); assert.equal(await selected(page), 'status');
    await press(page, 'B'); assert.equal(await panel(page), 'status');
    await home(page); await press(page, 'A'); assert.equal(await selected(page), 'status');
    await press(page, 'B'); assert.equal(await panel(page), 'status', 'A/B choices persist too');
    await home(page);
    console.log('PASS menu memory follows the semantic item selected by pointer or A/B');

    for (const kind of ['feed', 'clean']) for (const source of ['home', 'status', 'menu']) {
        await enterCare(page, kind, source);
        await press(page, 'C'); assert.equal(await panel(page), source, `${kind} C returns to ${source}`);
        assert.equal(await page.locator('.tf-pet-food-select').count(), 0);
        assert.equal(await page.evaluate(() => petTest.viewState.companionCleaning), false);
        if (kind === 'feed') {
            await enterCare(page, kind, source);
            await page.locator('.tf-pet-food-select [data-action="companion-device-back"]').click();
            assert.equal(await panel(page), source, `food back button returns to ${source}`);
        }
    }
    await enterCare(page, 'feed', 'status'); await page.locator('[data-food-id="berry"]').click();
    await page.waitForFunction(() => !petTest.viewState.companionFoodMenuOpen);
    assert.equal(await panel(page), 'home'); assert.ok((await readPet(page)).satiety > 20);
    assert.equal(await page.locator('.tf-pet-touch-feedback').isVisible(), true);
    await press(page, 'C'); assert.equal(await panel(page), 'status', 'completed care clears transient origin');
    await home(page); await enterCare(page, 'clean', 'menu');
    for (let i = 0; i < 3; i++) await press(page, 'B');
    await page.waitForFunction(() => !petTest.viewState.companionCleaning);
    assert.equal(await panel(page), 'home'); assert.ok((await readPet(page)).life.cleanliness > 20);
    assert.equal(await page.locator('.tf-pet-touch-feedback').isVisible(), true);
    console.log('PASS food and washing cancellation restore all three origins; completion shows home feedback');

    const needs = [
        ['hungry', { pet: { satiety: 20 } }, 'feed'],
        ['dirty', { life: { cleanliness: 20 } }, 'clean'],
        ['tired', { pet: { energy: 20 } }, 'rest'],
        ['lonely', { pet: { happiness: 20 } }, 'pet'],
    ];
    for (const [need, values, action] of needs) {
        await fixture(page, values);
        const chip = page.locator('.tf-device-need');
        assert.equal(await chip.isVisible(), true, need);
        await chip.click();
        if (action === 'feed') assert.equal(await page.locator('.tf-pet-food-select').isVisible(), true);
        if (action === 'clean') assert.equal(await page.evaluate(() => petTest.viewState.companionCleaning), true);
        if (action === 'rest') assert.ok((await readPet(page)).life.sleepUntil > Date.now());
        if (action === 'pet') assert.equal((await readPet(page)).lastAction, 'pet');
        assert.equal(await page.locator('.tf-device-need').isVisible(), false, `${need} chip hides during action`);
    }
    for (const [state, values] of [
        ['normal', {}], ['sleeping', { pet: { satiety: 20 }, life: { sleepUntil: Date.now() + 3600000 } }],
        ['paused', { pet: { satiety: 20 }, life: { mode: 'paused' } }],
        ['daycare', { pet: { satiety: 20 }, life: { mode: 'daycare' } }],
        ['away', { pet: { status: 'away', satiety: 20, departedAt: Date.now(), returnAt: Date.now() + 3600000 } }],
    ]) {
        await fixture(page, values); assert.equal(await page.locator('.tf-device-need').count(), 0, state);
    }
    await fixture(page, { pet: { satiety: 20 } });
    await page.evaluate(() => { petTest.viewState.moduleBusy.add('travel'); petTest.render(); });
    assert.equal(await page.locator('.tf-device-need').count(), 0, 'travel preparation blocks care');
    await page.evaluate(() => { petTest.viewState.moduleBusy.delete('travel'); petTest.render(); });
    await page.locator('.tf-pet-sprite-control').click();
    assert.equal(await page.locator('.tf-device-need').isVisible(), false, 'feedback takes precedence over need');
    await page.locator('.tf-pet-touch-feedback').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.tf-device-need').isVisible(), true, 'need reappears when feedback is dismissed without a full render');
    console.log('PASS one relevant need opens the correct local action and unavailable states offer no care chip');

    await fixture(page, { pet: { satiety: 20 } });
    await openCompanionMenu(page, 'games');
    await page.locator('[data-action="pet-game-start"][data-game="catch"]').click();
    await page.waitForTimeout(2200);
    assert.equal(await page.locator('.tf-device-need').count(), 0, 'no need chip over running game');
    const beforeGame = (await readPet(page)).life.game;
    for (const key of ['A', 'B', 'C']) { await press(page, key); assert.equal(await panel(page), 'home', `${key} stays a game input`); }
    const afterGame = (await readPet(page)).life.game;
    assert.ok(afterGame.moves > beforeGame.moves); assert.ok(afterGame.skillUntil > beforeGame.skillUntil);
    await openCompanionMenu(page, 'games'); await page.locator('.tf-pet-games [data-action="pet-game-stop"]').click();
    assert.equal(await page.evaluate(() => petCalls), 0);
    console.log('PASS A/B/C still control the game; all care and navigation remain local');

    await fixture(page); await openCompanionMenu(page, 'dress'); await home(page);
    await page.evaluate(() => {
        const context = SillyTavern.getContext(); context.chatId = 'navigation-second-pet';
        context.chatMetadata = { tavern_forum_data: { world: { companion: { name: '第二只', life: { autoSleep: false } } } } };
        petListeners.get('chat_changed')();
    });
    await page.waitForFunction(() => petTest.viewState.companionPanel === 'home');
    await press(page, 'A'); assert.equal(await selected(page), 'status', 'another chat starts with its own initial menu');
    await press(page, 'B'); assert.equal(await panel(page), 'status');
    await press(page, 'C'); assert.equal(await panel(page), 'home');
    await page.close();

    for (const width of [390, 320]) {
        const mobile = await open(width);
        await fixture(mobile, { pet: { satiety: 20 } });
        const chip = mobile.locator('.tf-device-need');
        assert.equal(await chip.isVisible(), true);
        const layout = await chip.evaluate(node => {
            const chip = node.getBoundingClientRect(), room = node.closest('.tf-pet-stage').getBoundingClientRect();
            const sprite = node.closest('.tf-pet-stage').querySelector('.tf-pixel-pet').getBoundingClientRect();
            return { inside: chip.left >= room.left && chip.right <= room.right && chip.top >= room.top && chip.bottom <= room.bottom, overlap: chip.left < sprite.right && chip.right > sprite.left && chip.top < sprite.bottom && chip.bottom > sprite.top };
        });
        assert.equal(layout.inside, true, width + ' need stays inside stage');
        assert.equal(layout.overlap, false, width + ' need does not cover pet');
        assert.equal(await mobile.locator('.tf-view').evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
        await mobile.screenshot({ path: join(output, `need-home-${width}.png`) });
        await chip.tap(); await mobile.locator('.tf-pet-food-select [data-action="companion-device-back"]').tap(); assert.equal(await panel(mobile), 'home');
        await openCompanionMenu(mobile, 'travel', 'tap');
        assert.equal(await mobile.locator('.tf-pet-device-page:not([hidden]) .tf-pet-device-content').evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
        for (const target of pages) {
            await tabs(mobile).locator(`[data-panel="${target}"]`).tap();
            assert.equal(await panel(mobile), target, `${width} one tap opens ${target}`);
            const tabLayout = await tabs(mobile).evaluate(node => {
                const box = node.getBoundingClientRect(), screen = node.closest('.tf-pet-device-page').getBoundingClientRect();
                return { overflow: node.scrollWidth > node.clientWidth + 1, inside: box.left >= screen.left - 1 && box.right <= screen.right + 1, clipped: [...node.querySelectorAll('button')].some(button => button.scrollWidth > button.clientWidth + 1) };
            });
            assert.deepEqual(tabLayout, { overflow: false, inside: true, clipped: false }, `${width} ${target} all tabs fit`);
        }
        await mobile.screenshot({ path: join(output, `direct-page-tabs-${width}.png`) });
        await press(mobile, 'C'); await assertHomeControls(mobile);
        await press(mobile, 'A'); assert.equal(await panel(mobile), 'menu');
        assert.equal(await selected(mobile), 'dress');
        await mobile.screenshot({ path: join(output, `remembered-menu-${width}.png`) });
        assert.equal(await mobile.evaluate(() => petCalls), 0);
        await mobile.close();
    }
    console.log('PASS chat-local menu reset and 390/320px touch layouts without pet overlap or overflow');
    assert.deepEqual(errors, []);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
