import { openCompanionMenu, returnCompanionHome } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-roam-ui-'));
console.log('Artifacts:', output);
// Only the preview hooks and random source differ from the installed plugin.
// Playwright's clock runs its real scheduler and pointer handlers without sleeps.
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body.toString()
            .replace('companionRoamController ||= createCompanionRoamController({', 'companionRoamController ||= createCompanionRoamController({ random: () => globalThis.roamRandomValue ?? .8,')
            + '\nglobalThis.petTest = { viewState, render, get idle() { return companionIdleController; }, get roam() { return companionRoamController; }, resetRoam() { companionRoamController?.destroy(); companionRoamController = null; }, getCompanionAmbientSnapshot };');
        if (pathname === '/preview.html') body = Buffer.from(body.toString()
            .replace('const listeners = new Map();', 'const listeners = globalThis.petListeners = new Map(); globalThis.roamSaves = 0;')
            .replace('saveSettingsDebounced() {}, saveMetadataDebounced() {}, async saveMetadata() {}, setExtensionPrompt() {},', 'saveSettingsDebounced() {}, saveMetadataDebounced() { roamSaves++; }, async saveMetadata() { roamSaves++; }, setExtensionPrompt() {},'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [], snapshots = [];
const selector = '.tf-pet-sprite-control';
const readPet = page => page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world.companion));

async function open(width = 1280) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 390 });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-04T12:00:00+08:00') });
    await page.clock.pauseAt(new Date('2026-10-04T12:00:00+08:00'));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await fixture(page);
    return page;
}

async function fixture(page, { species = '黑猫', stage = 'adult', habitat = 'meadow', pet = {}, life = {}, state = {} } = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        const view = petTest.viewState, companion = getForumData().world.companion;
        document.activeElement?.blur();
        for (const field of ['companionActionTimer', 'companionFeedbackTimer', 'companionRitualTimer', 'companionJourneyTimer']) clearTimeout(view[field]);
        // Isolate visual scheduling from the separate 30-second care clock.
        view.companionClockGeneration += 1; view.companionJourneyTimer = 0;
        view.companionActionToken += 1;
        view.moduleBusy.clear();
        Object.assign(view, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0,
            companionFoodMenuOpen: false, companionCleaning: false, companionCleanProgress: 0, companionFeedback: null,
            companionGameResultOpen: false, companionRitual: null, companionRitualTimer: 0, busy: false }, values.state);
        Object.assign(companion, { name: '团子', species: values.species, status: 'home', satiety: 80, happiness: 75, energy: 80,
            bond: 5, habitat: values.habitat, lastInteractionAt: 0, lastAction: '', avatarUrl: '', accessory: 'none', bodyColor: '', accentColor: '',
            weather: 'clear', timeOfDay: 'day', message: '' }, values.pet);
        const date = new Date(), today = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        Object.assign(companion.life, { stage: values.stage, mode: 'active', cleanliness: 80, game: null, autoSleep: false,
            sleepUntil: 0, awakeUntil: 0, growthNotice: null, lastTickAt: Date.now(), greetingDay: today,
            actionAt: {}, foodLikes: [], diary: [], milestones: [] }, values.life);
        globalThis.roamRandomValue = .8;
        petTest.resetRoam();
        petTest.render();
        globalThis.petCalls = 0; globalThis.roamSaves = 0;
        SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
        await Promise.all([...new Set([...document.querySelectorAll('.tf-pet-sprite-control image')].map(el => el.getAttribute('href')))].map(async href => { const image = new Image(); image.src = href; await image.decode(); }));
    }, { species, stage, habitat, pet, life, state });
    await page.locator('.tf-companion-device').scrollIntoViewIfNeeded();
}

async function position(page) {
    return page.locator(selector).evaluate(node => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const style = getComputedStyle(node);
        return { x: Number.parseFloat(style.getPropertyValue('--tf-roam-x')) || 0, y: Number.parseFloat(style.getPropertyValue('--tf-roam-y')) || 0,
            state: node.dataset.roamState || '', direction: node.dataset.roamDirection || '', active: node.dataset.roamActive || '', idlePose: node.dataset.idlePose || '',
            control: rect(node), sprite: rect(node.querySelector('.tf-pixel-pet')), shadow: rect(node.querySelector('.tf-pet-character-shadow')),
            stage: rect(node.closest('.tf-pet-stage')) };
    });
}

async function advanceUntil(page, predicate, label, maxMs = 14000) {
    for (let elapsed = 0; elapsed <= maxMs; elapsed += 250) {
        const result = await position(page);
        if (predicate(result)) return result;
        await page.clock.runFor(250);
    }
    assert.fail(`${label}: ${JSON.stringify(await position(page))}`);
}

async function walk(page) {
    await advanceUntil(page, value => value.state === 'walking', 'autonomous walk must start');
    await page.clock.runFor(500);
    const result = await position(page);
    assert.ok(Math.hypot(result.x, result.y) > 1, 'autonomous walking must move the actual control');
    return result;
}

async function assertFits(page, label) {
    const value = await position(page), { stage, control, sprite, shadow } = value;
    for (const [name, box] of Object.entries({ control, sprite, shadow })) {
        assert.ok(box.x >= stage.x - 1.5 && box.right <= stage.right + 1.5, `${label}: ${name} outside room horizontally ${JSON.stringify(value)}`);
        assert.ok(box.y >= stage.y - 1.5 && box.bottom <= stage.bottom + 1.5, `${label}: ${name} outside room vertically ${JSON.stringify(value)}`);
    }
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false, `${label}: app horizontal overflow`);
    assert.ok(control.width >= 44 && control.height >= 44, `${label}: touch target too small`);
}

async function assertStopped(page, label, { centered = true } = {}) {
    if (!await page.locator(selector).count()) {
        await page.clock.runFor(12000);
        assert.equal(await page.locator(`${selector}[data-roam-state="walking"]`).count(), 0, `${label}: movement restarted off the home screen`);
        return;
    }
    const before = await position(page);
    assert.notEqual(before.state, 'walking', `${label}: walking state remained`);
    await page.clock.runFor(12000);
    const after = await position(page);
    assert.notEqual(after.state, 'walking', `${label}: walking restarted while unavailable`);
    assert.equal(after.x, before.x, `${label}: horizontal drift`);
    assert.equal(after.y, before.y, `${label}: vertical drift`);
    if (centered) { assert.equal(after.x, 0, `${label}: must restore care position`); assert.equal(after.y, 0, `${label}: must restore care position`); }
}

async function capture(page, name) {
    const bytes = await page.locator('.tf-companion-device').screenshot({ path: join(output, `${name}.png`), animations: 'allow' });
    snapshots.push({ name, uri: `data:image/png;base64,${bytes.toString('base64')}` });
}

try {
    const page = await open();
    const beforePet = await readPet(page), initial = await position(page);
    let walking = await walk(page);
    assert.equal(walking.direction, 'right'); assert.equal(walking.active, 'true');
    const shadowDelta = walking.shadow.x - initial.shadow.x;
    assert.ok(Math.abs(shadowDelta - (walking.control.x - initial.control.x)) < 1, 'shadow follows the relocated touch control');
    assert.equal(await page.locator(selector).getAttribute('data-idle-pose'), null, 'walking interrupts an idle expression');
    await capture(page, 'roam-desktop-right');
    const resting = await advanceUntil(page, value => value.state === 'resting' && value.x > 1, 'walking finishes at its destination');
    await page.clock.runFor(500);
    const quiet = await position(page);
    assert.equal(quiet.x, resting.x, 'the pet stops between walks'); assert.equal(quiet.y, resting.y);
    const idle = await advanceUntil(page, value => Boolean(value.idlePose), 'a stopped pet must naturally play its idle expressions');
    assert.notEqual(idle.state, 'walking', 'a natural idle expression starts only after walking stops');
    await page.evaluate(() => { globalThis.roamIdlePet = document.querySelector('.tf-pet-sprite-control'); });
    await page.evaluate(() => { globalThis.roamRandomValue = .2; });
    let idleElapsed = 0;
    while ((await position(page)).idlePose && idleElapsed <= 4500) {
        const duringIdle = await position(page);
        assert.equal(duringIdle.idlePose, idle.idlePose, 'an idle expression finishes on its original pose');
        assert.notEqual(duringIdle.state, 'walking', 'roaming waits for the complete idle expression');
        assert.equal(await page.evaluate(() => roamIdlePet === document.querySelector('.tf-pet-sprite-control')), true, 'an idle expression does not replace its sprite');
        await page.clock.runFor(250); idleElapsed += 250;
    }
    assert.ok(idleElapsed >= 3000 && idleElapsed <= 4500, `the natural idle expression completed after ${idleElapsed}ms`);
    assert.equal((await position(page)).idlePose, '', 'the natural idle expression completes');
    const left = await advanceUntil(page, value => value.state === 'walking' && value.direction === 'left', 'a subsequent destination turns left');
    await page.clock.runFor(500); assert.ok((await position(page)).x < left.x, 'left-facing walk moves left');
    assert.deepEqual(await readPet(page), beforePet, 'free movement never changes companion care or saved data');
    assert.equal(await page.evaluate(() => petCalls), 0); assert.equal(await page.evaluate(() => roamSaves), 0);
    console.log('PASS real autonomous right/left walking, resting, complete natural idle, shadow, no API and no persistence changes');

    await fixture(page); walking = await walk(page);
    await page.evaluate(() => petTest.render({ preserveScroll: true }));
    const rerendered = await position(page);
    assert.ok(Math.abs(rerendered.x - walking.x) < 1 && Math.abs(rerendered.y - walking.y) < 1, 'ordinary render retains its location');
    await page.clock.runFor(500);
    assert.ok((await position(page)).x >= rerendered.x, 'ordinary render keeps the pending movement');
    for (const [name, update] of [['species', { species: '垂耳兔' }], ['habitat', { habitat: 'beach' }]]) {
        await walk(page);
        await page.evaluate(async update => { Object.assign((await import('/src/store.js')).getForumData().world.companion, update); petTest.render(); }, update);
        assert.equal((await position(page)).x, 0, `${name}: fresh context resets previous location`);
        assert.equal((await position(page)).y, 0, `${name}: fresh context resets previous location`);
    }
    await walk(page);
    await page.evaluate(() => {
        const context = SillyTavern.getContext(); context.chatId = 'another-roaming-pet';
        context.chatMetadata = { tavern_forum_data: { world: { companion: { name: '第二只', species: '黑猫', satiety: 80, happiness: 80, energy: 80,
            life: { autoSleep: false, greetingDay: '2026-10-4', stage: 'adult' } } } } };
        petListeners.get('chat_changed')();
    });
    assert.equal((await position(page)).x, 0, 'new chat cannot inherit the old pet position');
    console.log('PASS rerender preserves movement; species, room and chat changes reset it');

    await fixture(page); walking = await walk(page);
    const clickPoint = { x: walking.control.x + walking.control.width / 2, y: walking.control.y + walking.control.height / 2 };
    const beforeClick = await readPet(page);
    await page.mouse.move(clickPoint.x, clickPoint.y); await page.mouse.down();
    const held = await position(page);
    await page.clock.runFor(1500);
    assert.equal((await position(page)).x, held.x, 'pointer hold freezes the hit target');
    assert.equal((await position(page)).y, held.y);
    assert.notEqual(held.state, 'walking');
    await page.mouse.up();
    assert.ok((await readPet(page)).bond > beforeClick.bond, 'first click on a walking pet still pets it');
    assert.equal((await position(page)).x, 0, 'care action restores its central scene');
    console.log('PASS pointer hold freezes the walking target and first-click care succeeds');

    for (const [label, values] of [
        ['away', { pet: { status: 'away' } }], ['sleep', { life: { sleepUntil: Number.MAX_SAFE_INTEGER } }],
        ['paused', { life: { mode: 'paused' } }], ['daycare', { life: { mode: 'daycare' } }],
        ['feeding action', { state: { companionVisualAction: 'feed' } }], ['cleaning', { state: { companionCleaning: true } }],
        ['food picker', { state: { companionFoodMenuOpen: true } }], ['ritual', { state: { companionRitual: { kind: 'greet', phase: 'hello', startedAt: Date.now() } } }],
        ['status page', { state: { companionPanel: 'status' } }],
    ]) {
        await fixture(page); await walk(page);
        await fixture(page, values); await assertStopped(page, label);
    }
    await fixture(page); await walk(page);
    await page.evaluate(() => { petTest.viewState.moduleBusy.add('travel'); petTest.render(); });
    await assertStopped(page, 'travel generation busy');
    await fixture(page); await walk(page);
    await page.evaluate(() => { petTest.viewState.open = false; petTest.render(); });
    assert.equal(await page.locator('#tavern-forum-root').evaluate(node => node.hidden), true);
    await page.clock.runFor(12000);
    await fixture(page);
    assert.equal((await position(page)).x, 0, 'closed device reopens in its room');
    await walk(page);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await assertStopped(page, 'hidden document', { centered: false });
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await walk(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await assertStopped(page, 'reduced motion', { centered: false });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log('PASS care, games, sleep, travel, pause, daycare, page, close, hidden and reduced-motion guards');

    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const species of ['黑猫', '垂耳兔', '斗鱼', '青蛙', '赤狐', '小企鹅', '机械鸟', '小章鱼', '煤球']) {
            for (const stage of ['adult', 'young', 'baby']) {
                await fixture(page, { species, stage });
                await walk(page); await assertFits(page, `${species}/${stage}/${width}`);
                await advanceUntil(page, value => value.state === 'resting' && value.x > 1, 'matrix destination');
                await assertFits(page, `${species}/${stage}/${width}/destination`);
                if (stage === 'adult' && (width === 390 || species === '黑猫' && width === 320)) await capture(page, `${species}-${stage}-${width}`);
            }
        }
    }
    await page.setViewportSize({ width: 1280, height: 900 }); await fixture(page); await walk(page);
    await advanceUntil(page, value => value.state === 'resting' && value.x > 1, 'resize starting point');
    await page.setViewportSize({ width: 320, height: 900 });
    await page.clock.runFor(50); await assertFits(page, 'resize from desktop to 320');
    console.log('PASS 9 built-in species × adult/young/baby × desktop/390/320 and live resize stay inside the room');
    await page.close();

    const mobile = await open(390), cdp = await mobile.context().newCDPSession(mobile);
    let moving = await walk(mobile);
    let beforeTouch = await readPet(mobile);
    let x = moving.control.right - 2, y = moving.control.y + moving.control.height / 2;
    assert.ok(x > moving.control.right - moving.x, 'touch regression point must lie outside the original unshifted button');
    await mobile.touchscreen.tap(x, y);
    assert.ok((await readPet(mobile)).bond > beforeTouch.bond, 'tapping the translated edge succeeds before any central reset');
    await fixture(mobile); moving = await walk(mobile); beforeTouch = await readPet(mobile);
    x = moving.control.right - 2; y = moving.control.y + moving.control.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 12, y }] });
    const touchHeld = await position(mobile);
    await mobile.clock.runFor(1000);
    assert.equal((await position(mobile)).x, touchHeld.x, 'touch hold freezes the roaming target');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.clock.runFor(50);
    assert.ok((await readPet(mobile)).bond > beforeTouch.bond, 'stroking the translated edge succeeds before any central reset');
    await capture(mobile, 'touch-stroke-mobile');
    await fixture(mobile); await walk(mobile);
    await openCompanionMenu(mobile, 'feed', 'tap');
    await assertStopped(mobile, 'real food picker');
    await mobile.locator('[data-food-id="berry"]').scrollIntoViewIfNeeded();
    const foodBox = await mobile.locator('[data-food-id="berry"]').boundingBox(), petBox = await mobile.locator(selector).boundingBox();
    const foodPoint = { x: foodBox.x + foodBox.width / 2, y: foodBox.y + foodBox.height / 2 };
    const petPoint = { x: petBox.x + petBox.width / 2, y: petBox.y + petBox.height / 2 };
    const beforeFood = await readPet(mobile);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [foodPoint] });
    for (let index = 1; index <= 6; index++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: foodPoint.x + (petPoint.x - foodPoint.x) * index / 6, y: foodPoint.y + (petPoint.y - foodPoint.y) * index / 6 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.clock.runFor(50);
    assert.ok((await readPet(mobile)).satiety > beforeFood.satiety, 'drag feeding still hits the paused pet after roaming');
    assert.equal((await position(mobile)).x, 0); assert.notEqual((await position(mobile)).state, 'walking');
    await mobile.clock.runFor(4000); await returnCompanionHome(mobile, 'tap');
    await fixture(mobile); await walk(mobile);
    await openCompanionMenu(mobile, 'clean', 'tap'); await assertStopped(mobile, 'real washing');
    await fixture(mobile); await walk(mobile);
    await openCompanionMenu(mobile, 'games', 'tap');
    await mobile.locator('[data-action="pet-game-start"][data-game="catch"]').tap(); await assertStopped(mobile, 'real game');
    await fixture(mobile); await walk(mobile);
    await openCompanionMenu(mobile, 'rest', 'tap'); await assertStopped(mobile, 'real rest');
    assert.equal(await mobile.evaluate(() => petCalls), 0);
    await mobile.close();
    console.log('PASS touch stroking follows its new location and real feeding/washing/game/rest interrupt roaming');

    const overview = await browser.newPage({ viewport: { width: 1260, height: 900 } });
    await overview.setContent('<style>body{background:#f5f0e7;font:15px system-ui;padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%}figcaption{text-align:center}</style>' + snapshots.map(({ name, uri }) => `<figure><img src="${uri}"><figcaption>${name}</figcaption></figure>`).join(''));
    await overview.screenshot({ path: join(output, 'roam-overview.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS no browser errors');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
