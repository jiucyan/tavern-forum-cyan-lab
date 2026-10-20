import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd(), output = await mkdtemp(join(tmpdir(), 'forum-scene-context-'));
const resourceErrors = [], errors = [], checks = [];
console.log('ARTIFACTS', output);
const server = createServer(async (request, response) => {
    let pathname = request.url;
    try {
        pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const path = resolve(root, '.' + pathname);
        if (!path.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(path);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.sceneContextTest={viewState,render,getCompanionDisplayedScene,resetRoam(){companionRoamController?.destroy();companionRoamController=null;}};');
        if (pathname === '/preview.html') body = Buffer.from(body.toString().replace('async generateRaw(options) {', 'async generateRaw(options) { globalThis.sceneApiCalls=(globalThis.sceneApiCalls||0)+1; throw Error("Unexpected API request in scene test");'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }[extname(path)] || 'application/octet-stream' });
        response.end(body);
    } catch (error) {
        if (pathname !== '/favicon.ico') resourceErrors.push(`${pathname}: ${error.message}`);
        response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(`${pathname}: ${error.message}`);
    }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;

async function healthy(page) {
    assert.deepEqual(resourceErrors, [], 'local source resources must load');
    assert.deepEqual(errors, [], 'scripts and requests must succeed');
    const css = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => ({ path: new URL(link.href).pathname, rules: link.sheet?.cssRules.length || 0 })));
    assert.ok(css.some(sheet => sheet.path === '/style.css' && sheet.rules > 0), 'plugin CSS must be loaded before measuring or taking screenshots');
    assert.equal(await page.evaluate(() => globalThis.sceneApiCalls || 0), 0);
}

async function settle(page) {
    for (let step = 0; step < 160; step++) {
        if (await page.evaluate(() => !sceneContextTest.viewState.companionHomesteadCommand && !sceneContextTest.viewState.companionHomesteadBusy)) {
            await page.clock.runFor(50); await healthy(page); return;
        }
        await page.clock.runFor(100);
    }
    throw Error('scene navigation did not settle');
}

async function press(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    if (page.viewportSize().width <= 390) await locator.tap(); else await locator.click();
    await settle(page);
}

async function fixture(page, { location = 'home', habitat = 'meadow', room = false } = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { createCompanionRoomPreset } = await import('/src/companion-room.js');
        const { normalizeHomestead } = await import('/src/companion-homestead.js');
        const data = getForumData(), pet = data.world.companion, view = sceneContextTest.viewState, now = Date.now();
        document.activeElement?.blur();
        for (const key of ['companionActionTimer', 'companionFeedbackTimer', 'companionRitualTimer', 'companionJourneyTimer']) clearTimeout(view[key]);
        view.companionClockGeneration++; view.companionActionToken++; view.moduleBusy.clear();
        Object.assign(view, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionFoodMenuOpen: false, companionCleaning: false, companionFeedback: null, companionRitual: null, companionRoomCare: null, companionRoomDraft: null, companionRoomFoodTarget: null, companionRoomCommand: null, companionGameResultOpen: false, companionHomesteadPanel: '', companionHomesteadCommand: null, companionHomesteadBusy: false, companionHomesteadNotice: '', companionHomesteadFxUntil: 0 });
        const settings = getSettings(); settings.ui.activeTab = 'services'; settings.modules.travel.enabled = true; settings.sources.worldInfo = false;
        Object.assign(pet, { name: '团子', species: '青蛙', status: 'home', avatarUrl: '', accessory: 'none', deviceSkin: 'classic', habitat: values.habitat, weather: 'sunny', timeOfDay: 'day', lastAction: '', lastInteractionAt: now, message: '', satiety: 70, happiness: 70, energy: 80, room: createCompanionRoomPreset('cozy'), homestead: normalizeHomestead({ location: values.location, starterGranted: true, plots: [{ id: 'plot-1', cropId: 'carrot', plantedAt: now - 60000, wateredAt: now - 60000, readyAt: now + 600000 }], nodes: { 'berry-bush': now + 120000 } }) });
        pet.room.enabled = values.room;
        Object.assign(pet.life, { stage: 'baby', mode: 'active', autoSleep: false, sleepUntil: 0, awakeUntil: 0, roomBedId: '', lastTickAt: now, growthNotice: null, game: null, actionAt: {}, foodLikes: [], diary: [], milestones: [] });
        data.world.trips = [{ id: 'keep-history', traveler: '团子', destination: '保留的旧行程', status: 'returned', souvenir: '', createdAt: now - 1200000, returnedAt: now - 600000 }];
        sceneContextTest.resetRoam(); sceneContextTest.render();
    }, { location, habitat, room });
    await settle(page);
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
}

async function saved(page) {
    return page.evaluate(async () => {
        const data = (await import('/src/store.js')).getForumData(), pet = data.world.companion;
        return structuredClone({ habitat: pet.habitat, location: pet.homestead.location, roomEnabled: pet.room.enabled, roomItems: pet.room.items, status: pet.status, trips: data.world.trips, plots: pet.homestead.plots, nodes: pet.homestead.nodes });
    });
}

function assertProgressPreserved(before, after) {
    for (const key of ['status', 'trips', 'plots', 'nodes', 'roomItems']) assert.deepEqual(after[key], before[key], `changing the selected scene preserves ${key}`);
}

async function assertScene(page, sceneId, indoor) {
    for (const node of [page.locator('.tf-companion-device'), page.locator('.tf-pet-stage')]) {
        assert.equal(await node.getAttribute('data-scene-id'), sceneId);
        assert.equal(await node.getAttribute('data-scene-indoor'), String(indoor));
    }
    assert.equal(await page.locator('.tf-pet-stage .tf-homestead-stations').count(), sceneId === 'custom-room' ? 1 : 0,
        'only the editable room adds household stations; native scenes retain their own painted furniture');
    if (sceneId === 'habitat:bedroom') {
        const art = page.locator('.tf-pet-stage .tf-scene-art');
        assert.equal(await art.count(), 1);
        assert.equal(await art.getAttribute('data-scene'), 'bedroom', 'the indoor bedroom keeps its native background');
        assert.equal(await art.getAttribute('data-indoor'), 'true');
    }
    const measured = await page.evaluate(async () => {
        const pet = (await import('/src/store.js')).getForumData().world.companion;
        const scene = sceneContextTest.getCompanionDisplayedScene(pet), water = (await import('/src/companion-aquatic.js')).getAquaticHabitat(scene.aquaticLocation);
        const room = document.querySelector('.tf-pet-stage'), control = room.querySelector('.tf-pet-sprite-control'), svg = control.querySelector('.tf-pixel-pet'), character = svg.querySelector('.tf-pixel-character');
        const r = room.getBoundingClientRect(), c = control.getBoundingClientRect(), b = character.getBBox(), m = svg.getScreenCTM();
        const points = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y]) => ({ x:m.a*x+m.c*y+m.e, y:m.b*x+m.d*y+m.f }));
        const body = { left: Math.min(...points.map(p=>p.x)), right: Math.max(...points.map(p=>p.x)), top: Math.min(...points.map(p=>p.y)), bottom: Math.max(...points.map(p=>p.y)) };
        const [x,y,w,h] = water.box;
        return { key: room.dataset.aquaticHabitat, mode: room.dataset.aquaticMode, aquaticLocation: scene.aquaticLocation, body,
            water: { left:r.x+r.width*x/320, right:r.x+r.width*(x+w)/320, top:r.y+r.height*y/240, bottom:r.y+r.height*(y+h)/240 },
            stage: { left:r.left,right:r.right,top:r.top,bottom:r.bottom }, control: { left:c.left,right:c.right,top:c.top,bottom:c.bottom,width:c.width,height:c.height }, overflow: document.querySelector('.tf-app').scrollWidth > document.querySelector('.tf-app').clientWidth + 1 };
    });
    assert.equal(measured.key, indoor ? 'home' : sceneId);
    if (indoor) assert.equal(measured.mode, 'free'); else assert.notEqual(measured.mode, 'free', 'outdoor backgrounds use natural water instead of indoor free movement');
    for (const axis of ['left','top']) assert.ok(measured.body[axis] >= measured.water[axis] - 1.5, `body stays in water: ${JSON.stringify(measured)}`);
    for (const axis of ['right','bottom']) assert.ok(measured.body[axis] <= measured.water[axis] + 1.5, `body stays in water: ${JSON.stringify(measured)}`);
    assert.ok(measured.control.width >= 44 && measured.control.height >= 44);
    assert.ok(measured.control.left >= measured.stage.left - .5 && measured.control.top >= measured.stage.top - .5 && measured.control.right <= measured.stage.right + .5 && measured.control.bottom <= measured.stage.bottom + .5, 'the complete touch target stays in the scene');
    assert.equal(measured.overflow, false);
    return measured;
}

async function returnToScene(page) {
    const button = page.locator('.tf-device-home:visible');
    assert.equal(await button.innerText(), '返回场景');
    assert.doesNotMatch(await button.getAttribute('aria-label') || '', /回.*小窝/);
    await press(page, button);
    assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'home');
}

async function chooseScene(page, habitat) {
    await press(page, page.locator('.tf-device-menu-toggle'));
    await press(page, page.locator('.tf-device-icon-menu [data-panel="dress"]'));
    const group = page.locator('.tf-device-setting-group').filter({ has: page.locator('[data-environment-field="habitat"]') });
    assert.equal(await group.count(), 1);
    if (!await group.evaluate(node => node.open)) await press(page, group.locator(':scope > summary'));
    const option = page.locator(`[data-environment-field="habitat"][data-environment-value="${habitat}"]`);
    await press(page, option);
    assert.equal(await option.getAttribute('aria-selected'), 'true');
    await returnToScene(page);
}

async function screenshot(page, name) {
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    await healthy(page);
    await page.screenshot({ path: join(output, `${page.viewportSize().width}-${name}.png`) });
}

try {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    for (const width of [1280, 390, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 390, reducedMotion: 'reduce' });
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname !== '/favicon.ico') errors.push(`HTTP ${response.status()}: ${response.url()}`); });
        page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
        await page.route('**/*', async route => {
            if (new URL(route.request().url()).origin !== origin) { errors.push(`Unexpected external request: ${route.request().url()}`); await route.abort(); }
            else await route.continue();
        });
        const now = new Date('2026-10-19T12:00:00+08:00');
        await page.clock.install({ time: now }); await page.clock.pauseAt(now);
        await page.goto(origin + '/preview.html'); await healthy(page);
        await page.waitForFunction(() => globalThis.sceneContextTest);

        // Exact original combination: the home navigation location must not
        // turn an outdoor meadow into an indoor room or add house furniture.
        await fixture(page);
        const meadow = await assertScene(page, 'habitat:meadow', false);
        await screenshot(page, 'meadow-original-combination');
        const original = await saved(page);
        await press(page, page.locator('.tf-device-menu-toggle')); await returnToScene(page);
        assert.deepEqual(await saved(page), original);
        await assertScene(page, 'habitat:meadow', false);
        await press(page, page.locator('.tf-homestead-bar [data-target="packing"]'));
        assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'travel');
        await returnToScene(page);
        await press(page, page.locator('.tf-homestead-bar [data-target="storage"]'));
        assert.equal(await page.evaluate(() => sceneContextTest.viewState.companionHomesteadPanel), 'storage');
        await press(page, page.locator('.tf-homestead-panel [data-homestead-action="close"]'));
        assertProgressPreserved(original, await saved(page));

        await fixture(page, { location: 'yard' });
        const yardBefore = await saved(page);
        await chooseScene(page, 'bedroom');
        const bedroomSaved = await saved(page);
        assert.equal(bedroomSaved.habitat, 'bedroom'); assert.equal(bedroomSaved.location, 'home'); assert.equal(bedroomSaved.roomEnabled, false);
        assertProgressPreserved(yardBefore, bedroomSaved);
        await assertScene(page, 'habitat:bedroom', true); await screenshot(page, 'bedroom-from-yard');

        await fixture(page, { room: true, habitat: 'bedroom' });
        const roomBefore = await saved(page);
        assert.equal(roomBefore.roomEnabled, true);
        await chooseScene(page, 'pond');
        const pondSaved = await saved(page);
        assert.equal(pondSaved.habitat, 'pond'); assert.equal(pondSaved.location, 'home'); assert.equal(pondSaved.roomEnabled, false);
        assertProgressPreserved(roomBefore, pondSaved);
        await assertScene(page, 'habitat:pond', false);
        assert.equal(await page.locator('.tf-pet-stage .tf-aquatic-habitat').count(), 0, 'pond reuses its own painted water instead of layering a second pool');
        await screenshot(page, 'pond-from-custom-room');

        await press(page, page.locator('.tf-homestead-bar [data-target="door"],.tf-homestead-bar [data-target="location:yard"]').first());
        const yardAfter = await saved(page);
        assert.equal(yardAfter.location, 'yard'); assertProgressPreserved(pondSaved, yardAfter);
        assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-scene-indoor'), 'false');
        assert.equal(await page.locator('.tf-pet-stage').getAttribute('data-aquatic-habitat'), 'yard');
        assert.equal(await page.locator('.tf-homestead-target[data-target^="plot:"]').count(), 6, 'the real yard still has all farming plots');
        await screenshot(page, 'real-yard-preserves-farm');
        checks.push({ width, originalScene: 'habitat:meadow', naturalWater: meadow.mode, menuReturn: true, outdoorSupplies: true, yardToBedroom: true, customRoomToPond: true, pondWaterReused: true, farmPreserved: true });
        await healthy(page); await page.close();
        console.log('PASS', width, 'original outdoor combination, real selection and unchanged farm/history');
    }
    await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log(JSON.stringify({ checks: checks.length, output }));
} finally {
    await browser?.close();
    await new Promise(done => server.close(done));
}
