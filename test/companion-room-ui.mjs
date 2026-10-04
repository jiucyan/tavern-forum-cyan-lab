import { openCompanionMenu, returnCompanionHome } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOM_FURNITURE, ROOM_MAX_ITEMS, ROOM_FLOOR_Y } from '../src/companion-room.js';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-room-ui-'));
console.log('Artifacts:', output);
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body.toString()
            .replace('companionRoamController ||= createCompanionRoamController({', 'companionRoamController ||= createCompanionRoamController({ random: () => .8,')
            + '\nglobalThis.petTest = { viewState, render, resetRoam() { companionRoamController?.destroy(); companionRoamController = null; } };');
        if (pathname === '/preview.html') body = Buffer.from(body.toString()
            .replace('const listeners = new Map();', 'const listeners = globalThis.petListeners = new Map(); globalThis.roomSaves = 0; globalThis.roomCalls = 0;')
            .replace('saveSettingsDebounced() {}, saveMetadataDebounced() {}, async saveMetadata() {}, setExtensionPrompt() {},', 'saveSettingsDebounced() {}, saveMetadataDebounced() { roomSaves++; sessionStorage.setItem("roomMetadata", JSON.stringify(this.chatMetadata)); }, async saveMetadata() { roomSaves++; sessionStorage.setItem("roomMetadata", JSON.stringify(this.chatMetadata)); }, setExtensionPrompt() {},')
            .replace('const local = new Map();', 'if (sessionStorage.getItem("roomMetadata")) context.chatMetadata = JSON.parse(sessionStorage.getItem("roomMetadata")); const local = new Map();'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [], snapshots = [], editor = '.tf-pet-device-page[data-companion-panel="room"]', canvas = `${editor} .tf-room-canvas`;
const liveScene = '.tf-pet-habitat-layer .tf-scene-art', petSelector = '.tf-pet-sprite-control';
const readPet = page => page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world.companion));
const readDraft = page => page.evaluate(() => structuredClone(petTest.viewState.companionRoomDraft.data));
const readSelected = page => page.evaluate(() => petTest.viewState.companionRoomDraft.selected);
const act = (page, action, suffix = '') => page.locator(`${editor} [data-action="room-${action}"]${suffix}`);
const method = page => page.viewportSize().width <= 390 ? 'tap' : 'click';

async function open(width, height = 900) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width <= 390 });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-04T12:00:00+08:00') });
    await page.clock.pauseAt(new Date('2026-10-04T12:00:00+08:00'));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    return page;
}

async function fixture(page, { preset, room = { enabled: true, wall: 'cream', floor: 'wood', items: [] }, pet = {}, life = {} } = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { createCompanionRoomPreset, normalizeCompanionRoom } = await import('/src/companion-room.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        const view = petTest.viewState, companion = getForumData().world.companion;
        document.activeElement?.blur();
        for (const field of ['companionActionTimer', 'companionFeedbackTimer', 'companionRitualTimer', 'companionJourneyTimer']) clearTimeout(view[field]);
        view.companionClockGeneration += 1; view.companionJourneyTimer = 0; view.companionActionToken += 1; view.moduleBusy.clear();
        Object.assign(view, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0,
            companionFoodMenuOpen: false, companionCleaning: false, companionCleanProgress: 0, companionFeedback: null,
            companionGameResultOpen: false, companionRitual: null, companionRitualTimer: 0, companionCareReturnPanel: '', companionRoomDraft: null,
            companionRoomCare: null, companionRoomFoodTarget: null, companionRoomCommand: null, busy: false, toasts: [] });
        Object.assign(companion, { name: '团子', species: '黑猫', status: 'home', satiety: 70, happiness: 75, energy: 80,
            bond: 5, habitat: 'meadow', lastInteractionAt: 0, lastAction: '', avatarUrl: '', accessory: 'none', bodyColor: '', accentColor: '',
            weather: 'sunny', timeOfDay: 'day', message: '', room: values.preset ? createCompanionRoomPreset(values.preset) : normalizeCompanionRoom(values.room) }, values.pet);
        const date = new Date(), today = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        Object.assign(companion.life, { stage: 'adult', mode: 'active', cleanliness: 70, game: null, autoSleep: false,
            sleepUntil: 0, awakeUntil: 0, roomBedId: '', growthNotice: null, lastTickAt: Date.now(), greetingDay: today,
            actionAt: {}, foodLikes: [], diary: [], milestones: [] }, values.life);
        petTest.resetRoam(); petTest.render();
        globalThis.roomCalls = 0; globalThis.roomSaves = 0;
        SillyTavern.getContext().generateRaw = async () => { roomCalls++; throw Error('Unexpected API call'); };
        await Promise.all([...new Set([...document.querySelectorAll('.tf-pet-sprite-control image')].map(el => el.getAttribute('href')))].map(async href => { const image = new Image(); image.src = href; await image.decode(); }));
    }, { preset, room, pet, life });
    await page.locator('.tf-companion-device').scrollIntoViewIfNeeded();
    await page.clock.runFor(300);
}

async function click(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    await locator[method(page)]();
}

async function enter(page) {
    await openCompanionMenu(page, 'room', method(page));
    assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'room');
    await page.locator(canvas).scrollIntoViewIfNeeded();
    assert.equal(await page.locator(canvas).getAttribute('tabindex'), '0');
    assert.equal(await page.locator('.tf-pet-move-guide').isVisible(), false, 'editor uses its own furniture instructions');
    const box = await page.locator(canvas).boundingBox();
    assert.ok(box.width > 100 && Math.abs(box.width / box.height - 4 / 3) < .02, 'room canvas keeps its complete 4:3 coordinate plane');
    const targets = await page.locator(`${editor} .tf-room-catalog-item, ${editor} .tf-room-footer button`).evaluateAll(nodes => nodes.map(node => { const b = node.getBoundingClientRect(); return { width: b.width, height: b.height }; }));
    assert.ok(targets.every(box => box.width >= 43 && box.height >= 43), 'catalog and commit/cancel actions remain touch targets');
    await noOverflow(page);
}

async function noOverflow(page) {
    const result = await page.locator(`${editor} .tf-pet-device-content`).evaluate(node => ({ width: node.clientWidth, content: node.scrollWidth }));
    assert.ok(result.content <= result.width + 2, `editor has no horizontal overflow: ${JSON.stringify(result)}`);
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false, 'device fits the forum surface');
}

async function point(page, x, y) {
    await page.locator(canvas).scrollIntoViewIfNeeded();
    const box = await page.locator(canvas).boundingBox();
    const px = box.x + box.width * x / 320, py = box.y + box.height * y / 240;
    if (method(page) === 'tap') await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
}

async function pick(page, type, x, y) {
    await click(page, act(page, 'pick', `[data-room-type="${type}"]`));
    await point(page, x, y);
    const room = await readDraft(page), id = await readSelected(page);
    const placed = room.items.find(item => item.id === id);
    assert.equal(placed?.type, type, `${type}: actual canvas gesture places the catalog choice`);
    return placed;
}

async function select(page, id) {
    await click(page, page.locator(`${canvas} .tf-room-item[data-room-item="${id}"]`));
    assert.equal(await readSelected(page), id, 'existing visible furniture can be selected');
}

async function details(page, className) {
    const node = page.locator(`${editor} .${className}`);
    if (!await node.evaluate(node => node.open)) await click(page, node.locator('summary'));
}

async function surface(page, action, value) {
    await details(page, 'tf-room-surfaces');
    await click(page, act(page, action, `[data-room-value="${value}"]`));
}

async function preset(page, id) {
    await details(page, 'tf-room-presets');
    await click(page, act(page, 'preset', `[data-room-preset="${id}"]`));
    await noOverflow(page);
}

async function assertHome(page, scene = 'custom-room') {
    await page.waitForFunction(() => document.querySelector('.tf-companion-device')?.dataset.devicePage === 'home');
    await page.clock.runFor(300);
    assert.equal(await page.locator(liveScene).getAttribute('data-scene'), scene);
    if (scene === 'custom-room') {
        const art = await page.evaluate(async () => {
            const { renderCompanionRoom } = await import('/src/companion-room.js');
            const preview = document.createElement('div');
            preview.innerHTML = renderCompanionRoom((await import('/src/store.js')).getForumData().world.companion.room, { furniture: false });
            return preview.firstElementChild.outerHTML;
        });
        assert.equal(await page.locator(liveScene).evaluate(node => node.outerHTML), art, 'the live backdrop uses the exact saved walls, floor, wall art and rug');
        const pieces = await page.evaluate(async () => {
            const { getRoomItemDepth, renderRoomPlacedFurniture } = await import('/src/companion-room.js');
            const room = (await import('/src/store.js')).getForumData().world.companion.room;
            return room.items.filter(item => getRoomItemDepth(item) > 1).map(item => {
                const box = document.createElement('div'); box.innerHTML = renderRoomPlacedFurniture(item);
                return { id: item.id, art: box.firstElementChild.outerHTML };
            });
        });
        assert.equal(await page.locator('.tf-room-live-furniture').count(), pieces.length, 'each saved floor item has its own depth layer');
        for (const piece of pieces) assert.equal(await page.locator(`.tf-room-live-furniture[data-room-furniture="${piece.id}"] .tf-scene-art`).evaluate(node => node.outerHTML), piece.art, 'layered furniture uses the exact saved position, rotation and palette');
    }
    const layers = await page.locator('.tf-pet-habitat-layer, .tf-pet-habitat-layer *, .tf-room-foreground, .tf-room-live-furniture, .tf-room-live-furniture *').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).pointerEvents));
    assert.ok(layers.every(value => value === 'none'), 'decoration remains transparent to pet, furniture controls and floor gestures');
    const bounds = await liveBounds(page);
    for (const [name, box] of Object.entries({ control: bounds.control, sprite: bounds.sprite, shadow: bounds.shadow })) {
        assert.ok(box.x >= bounds.stage.x - 1.5 && box.right <= bounds.stage.right + 1.5, `${name} remains inside the customized room horizontally`);
        assert.ok(box.y >= bounds.stage.y - 1.5 && box.bottom <= bounds.stage.bottom + 1.5, `${name} remains inside the customized room vertically`);
    }
    assert.ok(bounds.control.width >= 44 && bounds.control.height >= 44, 'scaled pet retains a large touch target');
}

async function liveBounds(page) {
    return page.locator('.tf-pet-stage').evaluate(stage => {
        const box = node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
        const control = stage.querySelector('.tf-pet-sprite-control');
        return { stage: box(stage), control: box(control), sprite: box(control.querySelector('.tf-pixel-pet')), shadow: box(control.querySelector('.tf-pet-character-shadow')), mode: control.dataset.roamMode, state: control.dataset.roamState };
    });
}

async function moveAtRoomScale(page) {
    await assertHome(page);
    const before = await readPet(page), bounds = await liveBounds(page);
    const x = bounds.stage.x + 6, y = bounds.stage.y + 25;
    if (method(page) === 'tap') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    assert.equal((await liveBounds(page)).mode, 'manual', 'scaled pet accepts an actual floor click through its furnishings');
    const marker = await page.locator('.tf-pet-move-target').boundingBox();
    assert.ok(marker, 'scaled-room movement shows a destination');
    assert.ok(marker.y + marker.height / 2 >= bounds.stage.y + bounds.stage.height * ROOM_FLOOR_Y / 240, 'wall clicks are clamped to a floor destination');
    for (let elapsed = 0; (await liveBounds(page)).state !== 'resting' && elapsed < 14000; elapsed += 250) await page.clock.runFor(250);
    const final = await liveBounds(page);
    assert.equal(final.state, 'resting', 'scaled-room movement reaches its destination');
    assert.ok(Math.abs(final.shadow.x + final.shadow.width / 2 - marker.x - marker.width / 2) < 1.6, 'scaled pet foot arrives at horizontal target');
    assert.ok(Math.abs(final.shadow.y + final.shadow.height / 2 - marker.y - marker.height / 2) < 1.6, 'scaled pet foot arrives at vertical target');
    assert.ok(final.shadow.y + final.shadow.height / 2 >= final.stage.y + final.stage.height * ROOM_FLOOR_Y / 240, 'scaled pet stays on the room floor');
    assert.deepEqual(await readPet(page), before, 'scaled movement does not reward or persist');
    await assertHome(page);
    await page.locator(petSelector)[method(page)]();
    assert.equal((await readPet(page)).bond - before.bond, 3, 'scaled pet actual tap grants one petting reward');
    await page.clock.runFor(4500); await assertHome(page);
    await page.evaluate(() => { petTest.resetRoam(); petTest.render(); });
    await assertHome(page);
}

async function capture(page, name, selector = '.tf-companion-device') {
    const bytes = await page.locator(selector).screenshot({ path: join(output, `${name}.png`), animations: 'disabled' });
    snapshots.push({ name, uri: `data:image/png;base64,${bytes.toString('base64')}` });
}

async function swipeFurniture(page, id) {
    await page.locator(canvas).scrollIntoViewIfNeeded();
    const box = await page.locator(`${canvas} .tf-room-item[data-room-item="${id}"]`).boundingBox();
    const before = await readDraft(page), selected = await readSelected(page);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 12, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.clock.runFor(150);
    assert.deepEqual(await readDraft(page), before, 'swiping on furniture scrolls without placing or moving pieces');
    assert.equal(await readSelected(page), selected, 'furniture swipe does not become a selection tap');
    await cdp.detach();
}

async function noSideEffects(page, before) {
    assert.deepEqual(await readPet(page), before, 'draft edits do not change saved room or pet care/rewards');
    assert.equal(await page.evaluate(() => roomSaves), 0, 'draft edits do not persist metadata');
    assert.equal(await page.evaluate(() => roomCalls), 0, 'draft edits never call generation');
}

async function controls(page, firstScreen = false) {
    const buttons = page.locator(`${editor} .tf-room-nudge button`);
    const boxes = await buttons.evaluateAll(nodes => nodes.map(node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }));
    assert.equal(boxes.length, 4);
    assert.ok(Math.max(...boxes.map(box => box.y)) - Math.min(...boxes.map(box => box.y)) < 1, 'all four direction buttons stay in one row');
    assert.ok(boxes.every(box => box.width >= 43 && box.height >= 43), 'direction controls retain 44px touch targets');
    if (firstScreen) {
        const visible = await page.locator(`${editor} .tf-room-catalog`).evaluate(node => {
            const c = node.getBoundingClientRect(), page = node.closest('.tf-pet-device-content').getBoundingClientRect(), footer = node.closest('.tf-room-editor').querySelector('.tf-room-footer').getBoundingClientRect();
            return { top: c.top, bottom: c.bottom, pageTop: page.top, cutoff: Math.min(page.bottom, footer.top) };
        });
        assert.ok(visible.top >= visible.pageTop - 1 && visible.bottom <= visible.cutoff + 2, `first screen shows the furniture card row without footer overlap: ${JSON.stringify(visible)}`);
    }
    for (const button of await page.locator(`${editor} .tf-room-footer button`).all()) {
        await button.scrollIntoViewIfNeeded();
        assert.ok(await button.evaluate(node => { const b = node.getBoundingClientRect(); return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('button') === node; }), 'sticky footer actions remain visible and unobstructed');
    }
}

async function swipeTray(page) {
    const tray = page.locator(`${editor} .tf-room-catalog`);
    await tray.scrollIntoViewIfNeeded();
    const box = await tray.boundingBox(), before = await readDraft(page), selected = await readSelected(page);
    const x = box.x + box.width * .85, y = box.y + box.height * .5;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - box.width * .65 * step / 8, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(450);
    assert.deepEqual(await readDraft(page), before, 'horizontal tray swipe never places or moves furniture');
    assert.equal(await readSelected(page), selected, 'tray swipe is not a furniture-pick tap');
    const scrolled = await tray.evaluate(node => node.scrollLeft);
    assert.ok(scrolled > 10, 'actual touch swipe scrolls the furniture tray');
    const target = await tray.evaluate(node => {
        const b = node.getBoundingClientRect();
        const candidates = [...node.querySelectorAll('button')].map(button => ({ button, b: button.getBoundingClientRect() })).filter(value => value.b.left >= b.left + 1 && value.b.right <= b.right - 1);
        const value = candidates[0]; return { x: value.b.x + value.b.width / 2, y: value.b.y + value.b.height / 2, type: value.button.dataset.roomType };
    });
    await page.touchscreen.tap(target.x, target.y);
    assert.equal(await page.evaluate(() => petTest.viewState.companionRoomDraft.type), target.type, 'tap after scrolling picks the visible furniture');
    assert.ok(Math.abs(await tray.evaluate(node => node.scrollLeft) - scrolled) < 3, 'picking from the tray preserves its horizontal scroll position');
    await page.locator(canvas).press('Escape');
    await cdp.detach();
}

async function liveTargets(page) {
    const targets = await page.locator('.tf-room-live-hit').evaluateAll(nodes => nodes.map(node => {
        const b = node.getBoundingClientRect(), s = node.closest('.tf-pet-stage').getBoundingClientRect();
        return { kind: node.dataset.roomKind, width: b.width, height: b.height, left: b.left - s.left,
            top: b.top - s.top, right: b.right - s.right, bottom: b.bottom - s.bottom };
    }));
    assert.ok(targets.length, 'custom home exposes furniture actions');
    assert.ok(targets.every(b => b.width >= 43.9 && b.height >= 43.9 && b.left >= -1 && b.top >= -1 && b.right <= 1 && b.bottom <= 1),
        `every furniture action retains a complete 44px touch target inside the room: ${JSON.stringify(targets)}`);
}

async function waitPose(page, kind) {
    for (let elapsed = 0; await page.locator(petSelector).getAttribute('data-room-pose') !== kind && elapsed < 20000; elapsed += 100) await page.clock.runFor(100);
    const actual = await page.locator(petSelector).getAttribute('data-room-pose');
    if (actual !== kind) {
        console.log('Furniture arrival diagnostics:', await page.evaluate(() => ({ caption: document.querySelector('.tf-room-live-caption')?.textContent,
            pet: document.querySelector('.tf-pet-sprite-control')?.outerHTML.slice(0, 900), command: Boolean(petTest.viewState.companionRoomCommand), care: petTest.viewState.companionRoomCare?.kind })));
        await capture(page, `家具到达诊断-${kind}`);
    }
    assert.equal(actual, kind, `actual furniture gesture reaches ${kind} pose`);
}

async function furnitureQA(width) {
    const page = await open(width);
    await fixture(page, { preset: 'garden' }); await assertHome(page); await liveTargets(page);
    await capture(page, `完整小窝-${width}`);
    for (const [preset, label] of [['cozy', '暖暖卧室'], ['study', '安静书房']]) {
        await fixture(page, { preset }); await assertHome(page); await liveTargets(page);
        await capture(page, `${label}-${width}`);
    }
    for (const [kind, label] of [['sit', '坐上沙发'], ['lie', '趴在软垫'], ['play', '玩玩具球'], ['look', '看看窗外']]) {
        await fixture(page, { preset: 'garden' });
        const before = await readPet(page);
        await click(page, page.locator(`.tf-room-live-hit[data-room-kind="${kind}"]`));
        await waitPose(page, kind); await assertHome(page); await noSideEffects(page, before);
        assert.ok(await page.locator('.tf-room-live-caption').textContent(), 'arrived furniture provides a quiet status caption');
        const active = page.locator(`.tf-room-live-hit[data-room-kind="${kind}"]`);
        assert.equal(await active.getAttribute('data-active'), 'true', 'arrival marks the furniture currently in use');
        assert.equal(await active.evaluate(node => getComputedStyle(node).pointerEvents), 'none', 'used furniture does not cover the pet touch target');
        const id = await active.getAttribute('data-room-item-id');
        if (kind !== 'look') {
            const depth = await page.evaluate(id => ({ pet: Number(getComputedStyle(document.querySelector('.tf-pet-sprite-control')).zIndex),
                item: Number(getComputedStyle(document.querySelector(`.tf-room-live-furniture[data-room-furniture="${id}"]`)).zIndex) }), id);
            assert.ok(depth.pet > depth.item, `resident is in front of the item it uses: ${JSON.stringify(depth)}`);
        }
        if (kind === 'lie') {
            assert.equal(await page.locator(`${petSelector} .tf-pixel-character`).evaluate(node => getComputedStyle(node).display), 'none');
            assert.notEqual(await page.locator(`${petSelector} .tf-room-pose-art`).evaluate(node => getComputedStyle(node).display), 'none', 'lying uses its separately drawn folded body');
            const base = await page.locator(petSelector).evaluate(node => getComputedStyle(node).transform);
            assert.ok(base === 'none' || !base.startsWith('matrix(0,'), 'lying leaves the control unrotated');
        }
        if (['sit', 'lie'].includes(kind)) await capture(page, `${label}-${width}`);
        await page.locator(petSelector)[method(page)]();
        assert.equal((await readPet(page)).bond - before.bond, 3, 'petting a furnished pose grants one petting reward');
    }
    await fixture(page, { preset: 'cozy', pet: { energy: 8 } });
    const beforeRest = await readPet(page);
    await click(page, page.locator('.tf-room-live-hit[data-room-kind="rest"]'));
    assert.deepEqual(await readPet(page), beforeRest, 'low-energy bed click rewards only after approaching the real bed');
    await waitPose(page, 'rest'); await assertHome(page);
    assert.ok(await page.evaluate(async () => (await import('/src/companion-life.js')).getCompanionLifeView((await import('/src/store.js')).getForumData().world.companion).sleeping), 'low-energy resident reaches its own bed and sleeps');
    assert.equal(await page.evaluate(() => roomSaves), 1, 'bed arrival starts care once');
    const bedId = (await readPet(page)).life.roomBedId;
    assert.ok(bedId, 'sleep stores the chosen bed for reload');
    assert.equal(await page.locator('.tf-ritual-blanket').isVisible(), false, 'real bed replaces the floating blanket');
    await capture(page, `睡在小床-${width}`);
    await fixture(page, { preset: 'cozy' });
    await click(page, page.locator('.tf-room-live-hit[data-room-kind="rest"]')); await waitPose(page, 'rest');
    await page.reload(); await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(async () => {
        const { getSettings } = await import('/src/store.js'); getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        Object.assign(petTest.viewState, { open: true, worldPage: 'travel', companionPanel: 'home' }); petTest.render();
    });
    await page.clock.runFor(300); await waitPose(page, 'rest'); await assertHome(page);
    assert.equal((await readPet(page)).life.roomBedId, bedId, 'reload resumes sleep in the chosen bed');
    await page.locator(petSelector)[method(page)](); await page.clock.runFor(4500); await assertHome(page);
    assert.equal((await readPet(page)).life.roomBedId, '', 'waking releases the saved bed');
    assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-roam-interactive'), 'true', 'waking restores room movement');

    await fixture(page, { preset: 'cozy', pet: { satiety: 30 } });
    const beforeMeal = await readPet(page);
    await click(page, page.locator('.tf-room-live-hit[data-room-kind="feed"]'));
    assert.equal(await page.locator('.tf-pet-food-select').count(), 1, 'own bowl opens the food choice');
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]')[method(page)]();
    assert.deepEqual(await readPet(page), beforeMeal, 'meal rewards only after the resident walks to the bowl');
    await waitPose(page, 'feed'); await assertHome(page);
    assert.ok((await readPet(page)).satiety > beforeMeal.satiety, 'own-bowl meal applies the usual food reward');
    assert.equal(await page.evaluate(() => roomSaves), 1, 'own-bowl meal persists once');
    assert.equal(await page.locator('.tf-feed-drop').isVisible(), false, 'real bowl replaces the floating feed tray');
    await capture(page, `在饭碗开饭-${width}`);
    const time = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(new Date(time - 60000)); await page.clock.runFor(6000);
    assert.equal(await page.evaluate(() => petTest.viewState.companionRoomCare), null, 'system time rollback does not extend the temporary bowl hold');
    assert.notEqual(await page.locator(petSelector).getAttribute('data-room-pose'), 'feed', 'bowl pose ends on its monotonic timer');
    assert.equal(await page.evaluate(() => roomCalls), 0);

    await page.clock.setSystemTime(new Date(time + 10000));
    const beforeCooldown = await readPet(page);
    await click(page, page.locator('.tf-room-live-hit[data-room-kind="feed"]'));
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]')[method(page)]();
    await waitPose(page, 'feed');
    const afterCooldown = await readPet(page);
    assert.equal(afterCooldown.bond, beforeCooldown.bond, 'repeated own-bowl meal respects the existing reward cooldown');
    assert.deepEqual(afterCooldown.life.foodLikes, beforeCooldown.life.foodLikes, 'repeated own-bowl meal does not count as another rewarded meal');
    assert.equal(await page.locator('.tf-pet-ritual').count(), 0, 'cooldown does not restart a meal ceremony');
    assert.ok((await page.locator('.tf-pet-touch-feedback').textContent()).includes('过会儿再吃'));
    const feedbackDepth = await page.locator('.tf-pet-life-scene').evaluate(node => Number(getComputedStyle(node).zIndex));
    const furnitureDepth = await page.locator('.tf-room-live-furniture').evaluateAll(nodes => Math.max(...nodes.map(node => Number(getComputedStyle(node).zIndex))));
    assert.ok(feedbackDepth > furnitureDepth, 'the cooldown feedback remains above foreground furniture');
    await page.clock.runFor(4500);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture(page, { preset: 'garden' });
    await click(page, page.locator('.tf-room-live-hit[data-room-kind="lie"]')); await waitPose(page, 'lie'); await assertHome(page);
    const posePoint = await liveBounds(page);
    const footX = posePoint.shadow.x + posePoint.shadow.width / 2, offsetX = footX - posePoint.control.x;
    const desiredX = posePoint.stage.x + posePoint.stage.width * 262 / 320;
    const expectedX = Math.max(posePoint.stage.x + 8 + offsetX, Math.min(desiredX, posePoint.stage.right - 8 - posePoint.control.width + offsetX));
    assert.ok(Math.abs(footX - expectedX) < 2,
        'reduced motion still places the resident on the chosen cushion');
    assert.equal(await page.locator(`${petSelector} .tf-pixel-avatar`).evaluate(node => getComputedStyle(node).animationName), 'none');
    await capture(page, `静态趴卧-${width}`);
    await page.close();
}

try {
    if (process.env.ROOM_UI_FURNITURE_ONLY === '1') {
        for (const width of [390, 320]) await furnitureQA(width);
        assert.deepEqual(errors, []);
        console.log('PASS furniture interaction segment and no browser errors');
    } else {
    for (const width of [1280, 390, 320]) {
        const page = await open(width);
        await fixture(page);
        const before = await readPet(page);
        await enter(page);
        await controls(page);
        if (width <= 390) await swipeTray(page);
        const bed = await pick(page, 'bed', 76, 190);
        const plant = await pick(page, 'plant', 245, 202);
        if (width <= 390) await swipeFurniture(page, bed.id);
        await select(page, bed.id); await point(page, 175, 186);
        let selected = (await readDraft(page)).items.find(item => item.id === bed.id);
        assert.ok(Math.abs(selected.x - 175) <= 1 && Math.abs(selected.y - 186) <= 1, `clicking an empty position moves selected furniture: ${JSON.stringify(selected)}`);
        await click(page, act(page, 'rotate'));
        assert.equal((await readDraft(page)).items.find(item => item.id === bed.id).rotation, 1, 'turning changes placed furniture direction');
        const x = (await readDraft(page)).items.find(item => item.id === bed.id).x;
        await click(page, act(page, 'step', '[data-dx="8"][data-dy="0"]'));
        assert.equal((await readDraft(page)).items.find(item => item.id === bed.id).x, x + 8, 'direction controls nudge furniture');
        await surface(page, 'color', 'rose');
        assert.equal((await readDraft(page)).items.find(item => item.id === bed.id).color, 'rose', 'palette recolors the selected piece');
        await surface(page, 'wall', 'blue'); await surface(page, 'floor', 'checker');
        assert.equal((await readDraft(page)).wall, 'blue'); assert.equal((await readDraft(page)).floor, 'checker');
        await click(page, act(page, 'category', '[data-room-value="wall"]'));
        assert.equal(await page.locator(`${editor} .tf-room-catalog-item`).count(), ROOM_FURNITURE.filter(item => item.category === 'wall').length, 'category filters actual furniture choices');
        await click(page, act(page, 'category', '[data-room-value="all"]'));
        await select(page, bed.id); await click(page, act(page, 'remove'));
        assert.equal((await readDraft(page)).items.length, 1, 'collecting removes only selected furniture');
        await select(page, plant.id);
        const oldX = (await readDraft(page)).items[0].x;
        await page.locator(canvas).press('ArrowLeft');
        assert.equal((await readDraft(page)).items[0].x, oldX - 8, 'canvas keyboard arrows adjust selection');
        await page.locator(canvas).press('Delete');
        assert.equal((await readDraft(page)).items.length, 0, 'Delete collects selected piece');
        await click(page, act(page, 'pick', '[data-room-type="picture"]'));
        await page.locator(canvas).press('Enter');
        assert.equal((await readDraft(page)).items[0].type, 'picture', 'Enter places the current palette choice on the appropriate surface');
        assert.ok((await readDraft(page)).items[0].y < 145, 'wall artwork is placed on the wall');
        await noSideEffects(page, before);
        await click(page, act(page, 'cancel')); await assertHome(page);
        assert.deepEqual(await readPet(page), before, 'cancel discards unsaved furniture, palette and surface changes');
        await enter(page); assert.deepEqual((await readDraft(page)).items, [], 'reopening starts from saved empty home');
        for (const id of ['cozy', 'garden', 'study']) {
            await preset(page, id);
            assert.ok((await readDraft(page)).items.length > 0, `${id}: template is editable furniture`);
            await noSideEffects(page, before);
        }
        await preset(page, 'garden');
        const sofa = (await readDraft(page)).items.find(item => item.type === 'sofa');
        await select(page, sofa.id);
        await click(page, act(page, 'step', '[data-dx="8"][data-dy="0"]'));
        await surface(page, 'color', 'rose');
        await page.locator(`${editor} .tf-pet-device-content`).evaluate(node => { node.scrollTop = 0; });
        await page.locator(canvas).scrollIntoViewIfNeeded();
        await controls(page, true);
        await page.locator(`${editor} .tf-pet-device-content`).evaluate(node => { node.scrollTop = 0; });
        await capture(page, `装修编辑-${width}`, '.tf-device-viewport');
        const draft = await readDraft(page);
        await click(page, act(page, 'save')); await assertHome(page);
        assert.deepEqual((await readPet(page)).room, { ...draft, enabled: true }, 'save adopts complete draft as the current home');
        assert.equal(await page.evaluate(() => roomSaves), 1, 'one save writes metadata once');
        const adopted = await readPet(page);
        assert.deepEqual({ ...adopted, room: before.room }, before, 'saving decoration grants no care, bond, growth or currency reward');
        await moveAtRoomScale(page);
        await capture(page, `入住小窝-${width}`);
        await enter(page); assert.deepEqual(await readDraft(page), adopted.room, 'reopening uses exact saved layout');
        await pick(page, 'chair', 185, 202); await surface(page, 'wall', 'rose');
        await click(page, act(page, 'cancel')); await assertHome(page);
        assert.deepEqual((await readPet(page)).room, adopted.room, 'cancel after editing a saved home keeps its original layout');
        await enter(page); await pick(page, 'chair', 185, 202);
        await click(page, act(page, 'use-scene')); await assertHome(page, 'meadow');
        assert.deepEqual((await readPet(page)).room, { ...adopted.room, enabled: false }, 'using a scene retains saved decoration while discarding pending changes');
        await enter(page); assert.deepEqual(await readDraft(page), adopted.room, 'returning to decoration restores saved pieces');
        await click(page, act(page, 'save')); await assertHome(page);
        const persisted = (await readPet(page)).room;
        await page.reload(); await page.waitForFunction(() => globalThis.petTest);
        await page.evaluate(async () => {
            const { getSettings } = await import('/src/store.js'); getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
            Object.assign(petTest.viewState, { open: true, worldPage: 'travel', companionPanel: 'home' }); petTest.render();
        });
        await assertHome(page);
        assert.deepEqual((await readPet(page)).room, persisted, 'serialized host metadata reloads through store normalization');
        assert.equal(await page.evaluate(() => roomCalls), 0);
        await page.close();
    }
    console.log('PASS desktop/390/320: catalog/canvas placement, selection, move/turn/collect, surfaces/colors, templates, keyboard, save/cancel/reopen, scene toggle, metadata reload, touch targets and no edit rewards/API calls');

    for (const [width, height] of [[390, 844], [320, 568], [1280, 720]]) {
        const short = await open(width, height);
        await fixture(short, { preset: 'garden' });
        await enter(short);
        await select(short, (await readDraft(short)).items.find(item => item.type === 'sofa').id);
        await controls(short);
        await noOverflow(short);
        await details(short, 'tf-room-surfaces');
        await click(short, act(short, 'wall', '[data-room-value="rose"]'));
        await short.locator(canvas).focus();
        await short.locator(`${editor} .tf-room-catalog`).evaluate(node => { node.scrollLeft = node.scrollWidth - node.clientWidth; });
        const scrollBefore = await short.locator(`${editor} .tf-room-catalog`).evaluate(node => node.scrollLeft);
        const draftBefore = await readDraft(short), storedRoom = (await readPet(short)).room;
        await short.evaluate(() => petTest.render({ preserveScroll: true }));
        assert.ok(Math.abs(await short.locator(`${editor} .tf-room-catalog`).evaluate(node => node.scrollLeft) - scrollBefore) < 2, 'full render preserves horizontal tray position');
        assert.equal(await short.locator(`${editor} .tf-room-surfaces`).evaluate(node => node.open), true, 'full render preserves expanded surface options');
        assert.equal(await short.locator(canvas).evaluate(node => document.activeElement === node), true, 'full render preserves editor keyboard focus');
        await short.clock.runFor(31000);
        assert.ok(Math.abs(await short.locator(`${editor} .tf-room-catalog`).evaluate(node => node.scrollLeft) - scrollBefore) < 2, 'actual 30-second living clock preserves horizontal tray position');
        assert.equal(await short.locator(`${editor} .tf-room-surfaces`).evaluate(node => node.open), true, 'living clock preserves expanded editor options');
        assert.equal(await short.locator(canvas).evaluate(node => document.activeElement === node), true, 'living clock preserves editor keyboard focus');
        assert.deepEqual(await readDraft(short), draftBefore, 'living clock does not replace pending decoration');
        assert.deepEqual((await readPet(short)).room, storedRoom, 'living clock does not adopt the pending decoration');
        await capture(short, `短屏装修-${width}-${height}`, '.tf-device-viewport');
        await click(short, act(short, 'cancel')); await assertHome(short);
        const bounds = await liveBounds(short);
        assert.ok(Math.abs(bounds.stage.width / bounds.stage.height - 4 / 3) < .02, 'custom home preserves the room artwork aspect ratio');
        await short.close();
    }
    console.log('PASS 390×844/320×568/desktop720: four arrows on one row, touch/footer access, native scroll, 4:3 home and real 30-second render preserves tray/details/focus');

    const page = await open(390);
    await fixture(page, { room: { enabled: true, wall: 'cream', floor: 'wood', items: Array.from({ length: ROOM_MAX_ITEMS - 1 }, (_, i) => ({ id: `existing-${i}`, type: 'toy', x: 60 + i % 5 * 40, y: 180 + i % 3 * 13, rotation: 0, color: 'natural' })) } });
    const capacitySaved = await readPet(page);
    await enter(page); await pick(page, 'toy', 280, 205);
    assert.equal((await readDraft(page)).items.length, ROOM_MAX_ITEMS);
    await click(page, act(page, 'pick', '[data-room-type="bed"]')); await point(page, 160, 195);
    assert.equal((await readDraft(page)).items.length, ROOM_MAX_ITEMS, 'the 25th placement is refused through a real click');
    assert.match(await page.locator(`${editor} .tf-room-guide`).textContent(), /24/);
    await noSideEffects(page, capacitySaved);
    await click(page, act(page, 'cancel'));
    console.log('PASS 24-piece limit: real 24th placement succeeds, 25th is explained and refused without persistence');

    await fixture(page, { room: { enabled: false, wall: 'cream', floor: 'wood', items: [] } });
    const firstVisit = await readPet(page);
    await enter(page);
    const starter = await page.evaluate(async () => (await import('/src/companion-room.js')).createCompanionRoomPreset('cozy'));
    assert.deepEqual(await readDraft(page), starter, 'first visit offers a cozy furniture draft');
    await noSideEffects(page, firstVisit);
    await click(page, act(page, 'cancel')); await assertHome(page, 'meadow');
    assert.deepEqual(await readPet(page), firstVisit, 'canceling first visit leaves original habitat enabled');
    await enter(page); await click(page, act(page, 'save')); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, starter, 'first save adopts the furnished cozy home');
    console.log('PASS existing chat first visit starts a cozy draft without enabling or saving until committed');

    await fixture(page, { preset: 'cozy' });
    const roomA = (await readPet(page)).room;
    await enter(page); await preset(page, 'garden');
    await page.evaluate(() => {
        globalThis.roomSaveOriginal = SillyTavern.getContext().saveMetadata;
        SillyTavern.getContext().saveMetadata = async () => { roomSaves++; throw Error('模拟保存失败'); };
    });
    await click(page, act(page, 'save'));
    await page.waitForFunction(() => petTest.viewState.companionRoomDraft?.saving === false);
    assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'room', 'failed save stays in the editor');
    assert.deepEqual((await readPet(page)).room, roomA, 'failed save rolls saved room back to original layout');
    assert.notDeepEqual(await readDraft(page), roomA, 'failed save retains an editable draft for retry');
    for (const toast of await page.locator('[data-action="dismiss-toast"]').all()) await click(page, toast);
    await page.evaluate(() => { SillyTavern.getContext().saveMetadata = roomSaveOriginal; });
    await click(page, act(page, 'cancel')); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, roomA, 'cancel after a failed save enters the original home');
    await enter(page); await preset(page, 'study');
    await select(page, (await readDraft(page)).items[0].id);
    const pendingDraft = await readDraft(page), countBeforePending = await page.evaluate(() => roomSaves);
    await page.evaluate(() => {
        SillyTavern.getContext().saveMetadata = () => { roomSaves++; return new Promise(resolve => globalThis.roomReleaseSave = resolve); };
    });
    await click(page, act(page, 'save'));
    await page.waitForFunction(() => petTest.viewState.companionRoomDraft?.saving === true);
    const locked = await page.locator(`${editor} .tf-room-editor button`).evaluateAll(nodes => nodes.every(node => node.disabled));
    assert.ok(locked, 'all editor actions lock while metadata save is pending');
    await click(page, page.locator('.tf-device-menu-toggle'));
    await click(page, page.locator(`${editor} .tf-device-home`));
    await click(page, page.locator('[data-action="companion-menu-nav"][data-direction="1"]'));
    assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'room', 'pending save prevents top navigation and device C from leaving editor');
    await page.locator(canvas).focus(); await page.locator(canvas).press('ArrowRight'); await page.locator(canvas).press('Delete'); await point(page, 160, 200);
    await page.evaluate(() => {
        for (const selector of ['[data-action="room-wall"][data-room-value="rose"]', '[data-action="room-preset"][data-room-preset="cozy"]', '[data-action="room-cancel"]', '[data-action="room-save"]']) {
            document.querySelector(`.tf-room-editor ${selector}`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    });
    assert.deepEqual(await readDraft(page), pendingDraft, 'pending save blocks pointer, keyboard, palette, template and cancel changes');
    assert.equal(await page.evaluate(() => roomSaves), countBeforePending + 1, 'pending save cannot be submitted twice');
    await page.evaluate(() => roomReleaseSave()); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, pendingDraft);
    await page.evaluate(() => { SillyTavern.getContext().saveMetadata = roomSaveOriginal; });
    console.log('PASS failed-save rollback/retry and pending-save action lock without duplicate persistence');

    await fixture(page, { preset: 'cozy' });
    await enter(page); await preset(page, 'garden');
    await page.evaluate(() => {
        const context = SillyTavern.getContext(); globalThis.roomChatA = context.chatMetadata;
        context.chatId = 'room-chat-b'; context.chatMetadata = {};
        petListeners.get('chat_changed')();
    });
    await page.waitForFunction(() => document.querySelector('.tf-companion-device')?.dataset.devicePage === 'home');
    assert.equal((await readPet(page)).room.enabled, false, 'new chat has its own default room');
    assert.equal(await page.evaluate(() => petTest.viewState.companionRoomDraft), null, 'chat change clears the stale room owner and draft');
    await enter(page); await preset(page, 'study'); await click(page, act(page, 'save')); await assertHome(page);
    const roomB = (await readPet(page)).room;
    await page.evaluate(() => {
        const context = SillyTavern.getContext(); globalThis.roomChatB = context.chatMetadata;
        context.chatId = 'preview-chat'; context.chatMetadata = roomChatA;
        petListeners.get('chat_changed')();
    });
    await assertHome(page);
    assert.notDeepEqual((await readPet(page)).room, roomB, 'another chat save never replaces original chat decoration');
    assert.equal((await readPet(page)).room.wall, 'cream', 'unsaved garden draft from original chat was discarded');
    assert.equal(await page.evaluate(() => roomCalls), 0);
    console.log('PASS real chat-change event isolates drafts, saved rooms and their owners');

    await fixture(page, { preset: 'cozy' });
    await enter(page); await preset(page, 'garden');
    const beforeOwnerReplace = (await readPet(page)).room;
    await details(page, 'tf-room-surfaces');
    await page.locator(`${editor} .tf-room-catalog`).evaluate(node => { node.scrollLeft = node.scrollWidth - node.clientWidth; });
    await page.locator(canvas).focus();
    await page.evaluate(async () => {
        const { CHAT_DATA_KEY } = await import('/src/constants.js');
        const context = SillyTavern.getContext(); globalThis.roomRetiredForum = context.chatMetadata[CHAT_DATA_KEY];
        context.chatMetadata[CHAT_DATA_KEY] = structuredClone(context.chatMetadata[CHAT_DATA_KEY]);
        petTest.render();
    });
    assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'room', 'same-chat metadata import can retain the editor');
    assert.deepEqual(await readDraft(page), beforeOwnerReplace, 'replacement forum owner starts from its saved room, not stale draft');
    assert.ok(await page.locator(`${editor} .tf-room-catalog`).evaluate(node => node.scrollLeft < 3), 'new owner does not inherit retired tray scroll position');
    assert.equal(await page.locator(`${editor} .tf-room-surfaces`).evaluate(node => node.open), false, 'new owner does not inherit retired expanded options');
    await pick(page, 'toy', 168, 178);
    await click(page, act(page, 'save')); await assertHome(page);
    assert.equal((await readPet(page)).room.items.length, beforeOwnerReplace.items.length + 1, 'editor remains responsive after forum-owner replacement');
    const retiredRoom = await page.evaluate(() => structuredClone(roomRetiredForum.world.companion.room));
    assert.deepEqual(retiredRoom, beforeOwnerReplace, 'imported owner editing never writes the retired forum object');
    console.log('PASS metadata import/owner replacement refreshes the room draft and keeps the editor responsive');

    await fixture(page, { preset: 'garden' });
    const environmentRoom = (await readPet(page)).room;
    const environmentDetails = page.locator('.tf-device-setting-group').filter({ has: page.locator('.tf-pet-environment-controls') });
    const openEnvironment = async () => {
        await openCompanionMenu(page, 'dress', 'tap');
        if (!await environmentDetails.evaluate(node => node.open)) await click(page, environmentDetails.locator('summary'));
    };
    const chooseEnvironment = async (field, value) => {
        const option = page.locator(`[data-environment-field="${field}"][data-environment-value="${value}"]`);
        await click(page, option);
        await page.waitForFunction(async ({ field, value }) => (await import('/src/store.js')).getForumData().world.companion[field] === value, { field, value });
    };
    await openEnvironment();
    assert.match(await page.locator('.tf-environment-group.is-habitat > header').textContent(), /自己装修的小窝/, 'environment header identifies the active custom room');
    await chooseEnvironment('weather', 'rain'); await chooseEnvironment('timeOfDay', 'night');
    await returnCompanionHome(page, 'tap'); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, environmentRoom, 'weather and time preserve enabled custom decoration');
    await openEnvironment(); await chooseEnvironment('habitat', 'forest');
    await returnCompanionHome(page, 'tap'); await assertHome(page, 'forest');
    assert.deepEqual((await readPet(page)).room, { ...environmentRoom, enabled: false }, 'choosing a preset habitat adopts it while preserving saved custom layout');
    await enter(page); assert.deepEqual(await readDraft(page), environmentRoom, 'switching back to decoration restores pieces after a preset scene choice');
    await click(page, act(page, 'cancel'));
    console.log('PASS custom environment header, weather/time preservation and explicit preset habitat switching');

    await fixture(page, { preset: 'garden' });
    const savedHome = (await readPet(page)).room, beforeMove = await readPet(page);
    const stage = await page.locator('.tf-pet-stage').boundingBox();
    await page.touchscreen.tap(stage.x + 6, stage.y + 25);
    assert.equal(await page.locator(petSelector).getAttribute('data-roam-mode'), 'manual', 'floor movement reaches pet through custom decoration');
    await page.clock.runFor(10000);
    assert.deepEqual(await readPet(page), beforeMove, 'walking in custom home does not persist or reward');
    const beforePet = await readPet(page);
    await page.locator(petSelector).tap();
    assert.equal((await readPet(page)).bond - beforePet.bond, 3, 'custom room petting rewards once');
    await page.clock.runFor(4500); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, savedHome);

    await fixture(page, { preset: 'garden' });
    await openCompanionMenu(page, 'feed', 'tap');
    assert.equal(await page.locator(liveScene).getAttribute('data-scene'), 'custom-room', 'food picker retains customized room');
    const beforeFood = await readPet(page);
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]').tap();
    assert.equal(await page.locator(liveScene).getAttribute('data-scene'), 'kitchen', 'feeding temporarily uses kitchen');
    assert.ok((await readPet(page)).satiety > beforeFood.satiety);
    await page.clock.runFor(4500); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, savedHome);

    await fixture(page, { preset: 'garden', life: { cleanliness: 45 } });
    await openCompanionMenu(page, 'clean', 'tap');
    assert.equal(await page.locator(liveScene).getAttribute('data-scene'), 'bathroom');
    await returnCompanionHome(page, 'tap'); await assertHome(page);
    await openCompanionMenu(page, 'clean', 'tap');
    const beforeBath = await readPet(page);
    for (let scrub = 0; scrub < 3; scrub++) await page.locator(petSelector).tap();
    assert.ok((await readPet(page)).life.cleanliness > beforeBath.life.cleanliness);
    await page.clock.runFor(4500); await returnCompanionHome(page, 'tap'); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, savedHome);

    await fixture(page, { preset: 'garden' });
    await openCompanionMenu(page, 'rest', 'tap');
    assert.equal(await page.locator(liveScene).getAttribute('data-scene'), 'bedroom', 'sleep uses temporary bedroom');
    await page.locator(petSelector).tap(); await page.clock.runFor(4500); await assertHome(page);
    assert.deepEqual((await readPet(page)).room, savedHome);
    assert.equal(await page.evaluate(() => roomCalls), 0);
    console.log('PASS live custom home click movement/petting and temporary kitchen/bathroom/bedroom flows restore the saved custom room');

    await fixture(page, { preset: 'cozy', pet: { timeOfDay: 'day' } });
    const lightOpacity = async () => page.locator(liveScene).evaluate(node => ({ daylight: [...node.querySelectorAll('.tf-scene-daylight')].map(value => Number(getComputedStyle(value).opacity)), lamps: [...node.querySelectorAll('.tf-scene-lamplight')].map(value => Number(getComputedStyle(value).opacity)) }));
    const dayLight = await lightOpacity();
    await capture(page, '暖暖卧室-白天');
    await fixture(page, { preset: 'cozy', pet: { timeOfDay: 'night' } });
    const nightLight = await lightOpacity();
    assert.ok(dayLight.daylight.length && nightLight.daylight.every(value => value === 0), 'night turns off window sun and daylight beams');
    assert.ok(dayLight.lamps.length && nightLight.lamps.some((value, index) => value > dayLight.lamps[index]), 'night switches on the room lamp glow');
    await capture(page, '暖暖卧室-夜晚');
    console.log('PASS custom-room day/night window rays and warm lamp lighting');

    await page.close();
    for (const width of [390, 320]) await furnitureQA(width);
    console.log('PASS 390/320 live furniture: full touch bounds, sofa/cushion/toy/window poses, real drawn lying body, depth, petting, low-energy bed/reload/wake, own-bowl care and clock rollback, reduced-motion position');
    const overview = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const cards = ['装修编辑-390', '入住小窝-390', '装修编辑-320', '入住小窝-320'].map(name => snapshots.find(value => value.name === name));
    await overview.setContent('<style>body{margin:0;background:#f5f0e7;font:15px system-ui;color:#4e5e54}.room-preview{width:680px;padding:18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;box-sizing:border-box;align-items:center}figure{margin:0}img{width:100%;display:block}figcaption{text-align:center;padding:8px 4px 2px}</style><section class="room-preview">' + cards.map(({ name, uri }) => `<figure><img src="${uri}"><figcaption>${name.startsWith('装修') ? '自己布置家具' : '团子住进小窝'} · ${name.endsWith('390') ? '390px' : '320px'}</figcaption></figure>`).join('') + '</section>');
    await overview.locator('.room-preview').screenshot({ path: join(output, '小窝装修与入住.png') });
    assert.deepEqual(errors, []);
    console.log('PASS no browser errors');
    }
} finally { await browser.close(); await new Promise(done => server.close(done)); }
