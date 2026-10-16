import { openCompanionMenu } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-click-move-ui-'));
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

async function fixture(page, { species = '黑猫', stage = 'adult', habitat = 'meadow', roomPreset = '', pet = {}, life = {}, state = {} } = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { createCompanionRoomPreset, normalizeCompanionRoom } = await import('/src/companion-room.js');
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
            weather: 'clear', timeOfDay: 'day', message: '',
            room: values.roomPreset ? createCompanionRoomPreset(values.roomPreset) : normalizeCompanionRoom({}) }, values.pet);
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
    }, { species, stage, habitat, roomPreset, pet, life, state });
    await page.locator('.tf-companion-device').scrollIntoViewIfNeeded();
}

async function position(page) {
    return page.locator(selector).evaluate(node => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const style = getComputedStyle(node);
        return { x: Number.parseFloat(style.getPropertyValue('--tf-roam-x')) || 0, y: Number.parseFloat(style.getPropertyValue('--tf-roam-y')) || 0,
            mode: node.dataset.roamMode || '', state: node.dataset.roamState || '', direction: node.dataset.roamDirection || '', active: node.dataset.roamActive || '', idlePose: node.dataset.idlePose || '',
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

async function assertFits(page, label) {
    const value = await position(page), { stage, control, sprite, shadow } = value;
    for (const [name, box] of Object.entries({ control, sprite, shadow })) {
        assert.ok(box.x >= stage.x - 1.5 && box.right <= stage.right + 1.5, `${label}: ${name} outside room horizontally ${JSON.stringify(value)}`);
        assert.ok(box.y >= stage.y - 1.5 && box.bottom <= stage.bottom + 1.5, `${label}: ${name} outside room vertically ${JSON.stringify(value)}`);
    }
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false, `${label}: app horizontal overflow`);
    assert.ok(control.width >= 44 && control.height >= 44, `${label}: touch target too small`);
}
async function assertHomeScale(page, label) {
    const value = await position(page), sceneWidth = value.sprite.width / value.stage.width * 320;
    assert.ok(Math.abs(sceneWidth - 76) <= 1, `${label}: pet must remain 76 scene units at every viewport; got ${sceneWidth}`);
}

async function capture(page, name) {
    const bytes = await page.locator('.tf-companion-device').screenshot({ path: join(output, `${name}.png`), animations: 'allow' });
    snapshots.push({ name, uri: `data:image/png;base64,${bytes.toString('base64')}` });
}
async function floorPoint(page, side = 'left', high = true, touch = false) {
    return page.locator('.tf-pet-stage').evaluate((stage, { side, high, touch }) => {
        const box = stage.getBoundingClientRect(), x = side === 'left' ? box.x + 6 : box.right - 6;
        // Landmarks can extend to the edge. A floor test must not activate the
        // full-height doorway and then mistake its scene transition for arrival.
        const candidates = high ? [25, box.height * .48, box.height * .6, box.height * .75] : [box.height - 25, box.height * .8, box.height * .65];
        for (const offset of candidates) {
            const point = { x, y: box.y + offset }, hit = document.elementFromPoint(point.x, point.y);
            if (hit?.closest('.tf-pet-stage') !== stage || hit.closest('button,a,input,[role="button"]')) continue;
            // Chromium may adjust a touch to a nearby clickable SVG even when
            // elementFromPoint reports empty floor. Keep the finger area clear.
            if (touch && [...stage.querySelectorAll('button,a,input,[role="button"]')].some(node => {
                const rect = node.getBoundingClientRect();
                return rect.width && rect.height && point.x > rect.left - 18 && point.x < rect.right + 18
                    && point.y > rect.top - 18 && point.y < rect.bottom + 18;
            })) continue;
            return point;
        }
        throw Error('No exposed floor at requested edge');
    }, { side, high, touch });
}
async function command(page, side = 'left', high = true, touch = false) {
    const point = await floorPoint(page, side, high, touch);
    await page.evaluate(() => {
        globalThis.roamPointerTrace = [];
        if (globalThis.roamPointerTraceBound) return;
        globalThis.roamPointerTraceBound = true;
        for (const type of ['pointerdown', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
            roamPointerTrace.push({ type, id: event.pointerId, primary: event.isPrimary, x: event.clientX, y: event.clientY,
                target: event.target.outerHTML.slice(0, 200), button: event.target.closest('button')?.outerHTML.slice(0, 350), at: Date.now() });
        }, true);
    });
    if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    const moving = await position(page);
    const inputContext = moving.mode === 'manual' ? null : await page.evaluate(point => {
        const hit = document.elementFromPoint(point.x, point.y), stage = document.querySelector('.tf-pet-stage');
        return { point, hit: hit?.outerHTML.slice(0, 350), classes: stage?.className,
            visualAction: petTest.viewState.companionVisualAction, foodMenu: petTest.viewState.companionFoodMenuOpen,
            busy: petTest.viewState.companionHomesteadBusy, panel: petTest.viewState.companionPanel, pointerTrace: roamPointerTrace };
    }, point);
    assert.equal(moving.mode, 'manual', 'a real floor pointer gesture commands manual movement: ' + JSON.stringify(inputContext));
    assert.equal(moving.state, 'walking', 'normal motion walks instead of teleporting');
    assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-roam-target'), 'true');
    assert.ok(await page.locator('.tf-pet-move-target').isVisible(), 'reachable destination is visible');
    const marker = await page.locator('.tf-pet-move-target').boundingBox();
    return { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 };
}
async function arrive(page, target, label) {
    const settled = await advanceUntil(page, value => value.state === 'resting', label);
    assert.ok(Math.abs(settled.shadow.x + settled.shadow.width / 2 - target.x) < 1.6, `${label}: foot reaches marker horizontally ${JSON.stringify({ target, settled })}`);
    assert.ok(Math.abs(settled.shadow.y + settled.shadow.height / 2 - target.y) < 1.6, `${label}: foot reaches marker vertically`);
    assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-roam-target'), null, `${label}: target clears on arrival`);
    await assertFits(page, label);
    return settled;
}
async function noTarget(page, label) {
    assert.equal(await page.locator('.tf-pet-stage[data-roam-target]').count(), 0, label + ': no lingering destination');
    assert.equal(await page.locator('.tf-pet-stage[data-roam-interactive]').count(), 0, label + ': floor unavailable');
    assert.equal(await page.locator('.tf-pet-move-guide').isVisible(), false, label + ': instruction hidden');
}
async function petTouchPoint(page) {
    return page.locator(selector).evaluate(node => {
        const box = node.getBoundingClientRect();
        // Home landmarks overlap some transparent parts of the pet button.
        // Touch its exposed body rather than accidentally activating a doorway.
        for (const [x, y] of [[.5, .72], [.5, .5], [.3, .65], [.7, .65]]) {
            const point = { x: box.x + box.width * x, y: box.y + box.height * y };
            if (document.elementFromPoint(point.x, point.y)?.closest('.tf-pet-sprite-control') === node) return point;
        }
        throw Error('The moved pet has no exposed touch point');
    });
}

try {
    if (!process.argv.includes('--mobile-only')) {
    const page = await open();
    const saved = await readPet(page);
    assert.equal(await page.locator('.tf-pet-move-guide').isVisible(), true);
    let target = await command(page);
    await page.clock.runFor(100);
    let moving = await position(page);
    assert.ok(moving.x < 0 && moving.x > -5 && moving.y < 0, 'floor click begins a continuous diagonal walk');
    assert.equal(moving.direction, 'left');
    target = await command(page, 'right', false);
    assert.equal((await position(page)).direction, 'right', 'a second floor click changes direction immediately');
    await capture(page, 'click-move-desktop');
    await arrive(page, target, 'last destination');
    assert.deepEqual(await readPet(page), saved);
    assert.equal(await page.evaluate(() => roamSaves), 0); assert.equal(await page.evaluate(() => petCalls), 0);
    console.log('PASS desktop click, diagonal walking, retarget, actual foot destination and no save/API side effects');

    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        // Fish and tadpole movement is covered by companion-aquatic-ui.mjs.
        // This matrix exercises the different land avatars and growth stages.
        for (const [species, stage] of [['黑猫', 'adult'], ['小企鹅', 'baby'], ['垂耳兔', 'young']]) {
            await fixture(page, { species, stage });
            await assertHomeScale(page, `${species}/${stage}/${width}`);
            for (const [side, high] of [['left', true], ['right', false]]) {
                target = await command(page, side, high);
                await arrive(page, target, `${species}/${stage}/${width}/${side}`);
            }
            if (species === '黑猫') await capture(page, `click-move-arrived-${width}`);
        }
    }
    console.log('PASS desktop/390/320 and different species/ages keep the entire target, avatar and shadow inside the room');

    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await fixture(page, { roomPreset: 'cozy' });
        await assertHomeScale(page, `furnished-room/${width}`);
        assert.equal(await page.locator('.tf-pet-stage .tf-scene-art[data-scene="custom-room"]').count(), 1);
        for (const [side, high] of [['left', true], ['right', false]]) {
            target = await command(page, side, high);
            await arrive(page, target, `furnished-room/${width}/${side}`);
        }
        await capture(page, `click-move-furnished-${width}`);
    }
    console.log('PASS furnished home uses the same movement and boundary checks at desktop/390/320');

    await page.setViewportSize({ width: 1280, height: 900 }); await fixture(page);
    let point = await floorPoint(page);
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x + 16, point.y); await page.mouse.move(point.x, point.y); await page.mouse.up();
    assert.notEqual((await position(page)).mode, 'manual', 'dragging out and back is not a tap');
    await page.mouse.click(point.x, point.y, { button: 'right' });
    assert.notEqual((await position(page)).mode, 'manual', 'right-click does not move the pet');
    await page.mouse.down(); await page.clock.runFor(700); await page.mouse.up();
    assert.notEqual((await position(page)).mode, 'manual', 'a long hold is not a tap');
    await page.locator(selector).focus();
    target = await command(page); await arrive(page, target, 'floor click after pet focus');
    assert.equal(await page.locator(selector).evaluate(node => node === document.activeElement), false);
    await fixture(page); target = await command(page, 'right', false);
    await page.clock.runFor(200); await page.evaluate(() => petTest.render());
    assert.equal((await position(page)).mode, 'manual', 'rerender keeps an ongoing command');
    await arrive(page, target, 'command after rerender');
    await command(page); await page.setViewportSize({ width: 320, height: 900 });
    await page.clock.runFor(50); await assertFits(page, 'resize during a command');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await noTarget(page, 'hidden document');
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    console.log('PASS drag, right-click and long-hold rejection, keyboard-focus release, rerender, resize and hidden cleanup');

    for (const values of [
        { state: { companionPanel: 'menu' } }, { state: { companionFoodMenuOpen: true } }, { state: { companionCleaning: true } },
        { life: { sleepUntil: Number.MAX_SAFE_INTEGER } }, { life: { mode: 'paused' } }, { life: { mode: 'daycare' } },
        { pet: { status: 'away' } }, { pet: { energy: 0 } }, { state: { companionGameResultOpen: true } },
    ]) {
        await fixture(page, values); await noTarget(page, JSON.stringify(values));
        const stageBox = await page.locator('.tf-pet-stage').boundingBox();
        if (stageBox) {
            await page.mouse.click(stageBox.x + 3, stageBox.y + 3);
            assert.notEqual((await position(page)).mode, 'manual', 'an unavailable room does not accept a command');
        }
    }
    await fixture(page); await command(page);
    await page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); getForumData().world.companion.habitat = 'bedroom'; petTest.render(); });
    assert.equal((await position(page)).x, 0); assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-roam-target'), null);
    await command(page);
    await page.evaluate(() => {
        const context = SillyTavern.getContext(); context.chatId = 'another-click-move-pet';
        context.chatMetadata = { tavern_forum_data: { world: { companion: { name: '第二只', species: '黑猫', satiety: 80, happiness: 80, energy: 80,
            life: { autoSleep: false, greetingDay: '2026-10-4', stage: 'adult' } } } } };
        petListeners.get('chat_changed')();
    });
    assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-roam-target'), null, 'chat switch drops the old command');
    console.log('PASS unavailable modes, changing rooms and chat discard the command');

    await fixture(page); await page.emulateMedia({ reducedMotion: 'reduce' });
    const originalPosition = await position(page);
    const originalFoot = { x: originalPosition.shadow.x + originalPosition.shadow.width / 2, y: originalPosition.shadow.y + originalPosition.shadow.height / 2 };
    point = await floorPoint(page);
    // The entire touch target stays 8px inside the room. A tap above/left of
    // that reachable area places the feet on its nearest safe boundary; the
    // displacement depends on the current responsive layout, not a fixed y.
    const reachableFoot = {
        x: Math.max(originalPosition.stage.x + 8 + originalFoot.x - originalPosition.control.x,
            Math.min(point.x, originalPosition.stage.right - 8 - (originalPosition.control.right - originalFoot.x))),
        y: Math.max(originalPosition.stage.y + 8 + originalFoot.y - originalPosition.control.y,
            Math.min(point.y, originalPosition.stage.bottom - 8 - (originalPosition.control.bottom - originalFoot.y))),
    };
    await page.mouse.click(point.x, point.y);
    const staticPosition = await position(page);
    assert.equal(staticPosition.mode, 'manual'); assert.equal(staticPosition.state, 'resting');
    assert.ok(Math.hypot(staticPosition.shadow.x + staticPosition.shadow.width / 2 - originalFoot.x,
        staticPosition.shadow.y + staticPosition.shadow.height / 2 - originalFoot.y) > 10, 'reduced motion leaves the original foot position');
    assert.ok(Math.abs(staticPosition.shadow.x + staticPosition.shadow.width / 2 - reachableFoot.x) < 1.6, 'reduced motion reaches the clamped horizontal foot destination');
    assert.ok(Math.abs(staticPosition.shadow.y + staticPosition.shadow.height / 2 - reachableFoot.y) < 1.6, 'reduced motion reaches the clamped vertical foot destination');
    await assertFits(page, 'reduced-motion placement');
    assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-roam-target'), null, 'instant arrival leaves no destination marker');
    assert.notEqual(await page.locator(selector).evaluate(node => getComputedStyle(node).translate), '0px', 'static movement is rendered by CSS');
    await page.clock.runFor(10000); assert.equal((await position(page)).x, staticPosition.x); assert.equal((await position(page)).y, staticPosition.y);
    await capture(page, 'click-move-reduced-motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.close();
    console.log('PASS reduced-motion floor taps place the pet instantly and never start automatic movement');
    }

    const mobile = await open(390), cdp = await mobile.context().newCDPSession(mobile);
    let target = await command(mobile, 'left', true, true); await mobile.clock.runFor(250);
    await capture(mobile, 'click-move-mobile'); await arrive(mobile, target, 'mobile tap');
    const beforeCare = await readPet(mobile), petPoint = await petTouchPoint(mobile);
    await mobile.touchscreen.tap(petPoint.x, petPoint.y);
    const afterCare = await readPet(mobile);
    assert.equal(afterCare.bond - beforeCare.bond, 3, 'touching the moved pet applies one normal petting reward');
    assert.equal(await mobile.locator('.tf-pet-stage').getAttribute('data-roam-target'), null, 'care never creates a floor instruction');
    await fixture(mobile); let point = await floorPoint(mobile, 'right', false, true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 35, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.notEqual((await position(mobile)).mode, 'manual', 'page swipe does not move the pet');
    await fixture(mobile); point = await floorPoint(mobile, 'left', true, true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }, { x: point.x + 25, y: point.y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.notEqual((await position(mobile)).mode, 'manual', 'multi-touch is not a floor tap');
    await fixture(mobile); await command(mobile, 'right', false, true);
    await openCompanionMenu(mobile, 'feed', 'tap'); await noTarget(mobile, 'feed picker after manual movement');
    await mobile.locator('[data-food-id="berry"]').scrollIntoViewIfNeeded();
    const foodBox = await mobile.locator('[data-food-id="berry"]').boundingBox(), newPetBox = await mobile.locator(selector).boundingBox();
    const food = { x: foodBox.x + foodBox.width / 2, y: foodBox.y + foodBox.height / 2 }, end = { x: newPetBox.x + newPetBox.width / 2, y: newPetBox.y + newPetBox.height / 2 };
    const beforeFood = await readPet(mobile);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [food] });
    for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: food.x + (end.x - food.x) * step / 6, y: food.y + (end.y - food.y) * step / 6 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await mobile.clock.runFor(50);
    assert.ok((await readPet(mobile)).satiety > beforeFood.satiety, 'drag feeding still works after a manual command');
    for (const mode of ['clean', 'games', 'rest']) {
        await fixture(mobile); await command(mobile, 'left', true, true); await openCompanionMenu(mobile, mode, 'tap');
        if (mode === 'games') await mobile.locator('[data-action="pet-game-start"][data-game="catch"]').tap();
        await noTarget(mobile, `real ${mode} after manual movement`);
    }
    await fixture(mobile, { roomPreset: 'cozy' });
    await assertHomeScale(mobile, 'mobile furnished home');
    target = await command(mobile, 'left', true, true);
    await arrive(mobile, target, 'mobile furnished home tap');
    const beforeRoomCare = await readPet(mobile), roomPetPoint = await petTouchPoint(mobile);
    await mobile.touchscreen.tap(roomPetPoint.x, roomPetPoint.y);
    assert.equal((await readPet(mobile)).bond - beforeRoomCare.bond, 3, 'touching the moved furnished-room pet applies one reward');
    await capture(mobile, 'click-move-furnished-mobile-care');
    await mobile.close(); assert.deepEqual(errors, []);
    console.log('PASS actual mobile taps, single-care hit, scrolling/multi-touch rejection, drag feeding, wash, game and rest');
    console.log('PASS no browser errors');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
