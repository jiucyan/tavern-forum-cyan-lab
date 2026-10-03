import { openCompanionMenu, returnCompanionHome } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { COMPANION_HABITATS } from '../src/companion-scenes.js';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-scenes-ui-'));
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
            .replace('const listeners = new Map();', 'const listeners = globalThis.petListeners = new Map(); globalThis.sceneSaves = 0;')
            .replace('saveSettingsDebounced() {}, saveMetadataDebounced() {}, async saveMetadata() {}, setExtensionPrompt() {},', 'saveSettingsDebounced() {}, saveMetadataDebounced() { sceneSaves++; }, async saveMetadata() { sceneSaves++; }, setExtensionPrompt() {},'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [], snapshots = [], petSelector = '.tf-pet-sprite-control', sceneSelector = '.tf-pet-habitat-layer .tf-scene-art';
const readPet = page => page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world.companion));

async function open(width) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 390 });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-04T12:00:00+08:00') });
    await page.clock.pauseAt(new Date('2026-10-04T12:00:00+08:00'));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    return page;
}

async function fixture(page, { habitat = 'meadow', time = 'day', weather = 'sunny', pet = {}, life = {}, state = {} } = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        const view = petTest.viewState, companion = getForumData().world.companion;
        document.activeElement?.blur();
        for (const field of ['companionActionTimer', 'companionFeedbackTimer', 'companionRitualTimer', 'companionJourneyTimer']) clearTimeout(view[field]);
        view.companionClockGeneration += 1; view.companionJourneyTimer = 0; view.companionActionToken += 1; view.moduleBusy.clear();
        Object.assign(view, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0,
            companionFoodMenuOpen: false, companionCleaning: false, companionCleanProgress: 0, companionFeedback: null,
            companionGameResultOpen: false, companionRitual: null, companionRitualTimer: 0, companionCareReturnPanel: '', busy: false }, values.state);
        Object.assign(companion, { name: '团子', species: '黑猫', status: 'home', satiety: 70, happiness: 75, energy: 80,
            bond: 5, habitat: values.habitat, lastInteractionAt: 0, lastAction: '', avatarUrl: '', accessory: 'none', bodyColor: '', accentColor: '',
            weather: values.weather, timeOfDay: values.time, message: '' }, values.pet);
        const date = new Date(), today = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        Object.assign(companion.life, { stage: 'adult', mode: 'active', cleanliness: 70, game: null, autoSleep: false,
            sleepUntil: 0, awakeUntil: 0, growthNotice: null, lastTickAt: Date.now(), greetingDay: today,
            actionAt: {}, foodLikes: [], diary: [], milestones: [] }, values.life);
        petTest.resetRoam(); petTest.render();
        globalThis.sceneCalls = 0; globalThis.sceneSaves = 0;
        SillyTavern.getContext().generateRaw = async () => { sceneCalls++; throw Error('Unexpected API call'); };
        await Promise.all([...new Set([...document.querySelectorAll('.tf-pet-sprite-control image')].map(el => el.getAttribute('href')))].map(async href => { const image = new Image(); image.src = href; await image.decode(); }));
    }, { habitat, time, weather, pet, life, state });
    await page.locator('.tf-companion-device').scrollIntoViewIfNeeded();
    // Settle JavaScript scheduling; screenshot capture separately finishes the
    // finite CSS entry fade because CSS timelines do not follow the fake clock.
    await page.clock.runFor(300);
}

async function measure(page) {
    return page.locator('.tf-pet-stage').evaluate(stage => {
        const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const pet = stage.querySelector('.tf-pet-sprite-control'), art = stage.querySelector('.tf-scene-art'), style = getComputedStyle(pet);
        return { room: box(stage), art: art && box(art), pet: box(pet), sprite: box(pet.querySelector('.tf-pixel-pet')), shadow: box(pet.querySelector('.tf-pet-character-shadow')),
            habitat: stage.querySelector('.tf-pet-habitat-layer').dataset.habitat, scene: art?.dataset.scene,
            x: Number.parseFloat(style.getPropertyValue('--tf-roam-x')) || 0, y: Number.parseFloat(style.getPropertyValue('--tf-roam-y')) || 0,
            state: pet.dataset.roamState || '', mode: pet.dataset.roamMode || '' };
    });
}

async function assertRoom(page, label, habitat) {
    const value = await measure(page), room = value.room;
    assert.equal(value.scene, habitat, `${label}: the selected habitat has its own rendered artwork`);
    assert.equal(value.habitat, habitat, `${label}: scene and selected habitat agree`);
    assert.ok(value.art.width > 100 && value.art.height > 100, `${label}: scene art is visible`);
    for (const [name, box] of Object.entries({ art: value.art, pet: value.pet, sprite: value.sprite, shadow: value.shadow })) {
        assert.ok(box.x >= room.x - 1.5 && box.right <= room.right + 1.5, `${label}: ${name} overflows horizontally ${JSON.stringify(value)}`);
        assert.ok(box.y >= room.y - 1.5 && box.bottom <= room.bottom + 1.5, `${label}: ${name} overflows vertically ${JSON.stringify(value)}`);
    }
    const layers = await page.locator('.tf-pet-habitat-layer, .tf-pet-habitat-layer *').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).pointerEvents));
    assert.ok(layers.every(value => value === 'none'), `${label}: background does not intercept pet care or floor taps`);
    assert.equal(await page.locator('.tf-app').evaluate(node => node.scrollWidth > node.clientWidth + 2), false, `${label}: no horizontal scrolling`);
    const hit = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.tf-pet-sprite-control')), { x: value.sprite.x + value.sprite.width / 2, y: value.sprite.y + value.sprite.height / 2 });
    assert.ok(hit, `${label}: the central pet remains visible and interactive`);
    return value;
}

async function move(page, habitat, width, reduced = false) {
    const before = await assertRoom(page, `${habitat}/${width}/before`, habitat);
    const point = { x: before.room.x + 6, y: before.room.y + 25 };
    if (width <= 390) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    let position = await measure(page);
    assert.equal(position.mode, 'manual', `${habitat}/${width}: floor gesture is accepted through scenery`);
    if (reduced) {
        assert.equal(position.state, 'resting', 'reduced motion places the pet statically');
        assert.ok(position.x < -1 && position.y < -13, 'explicit placement still changes its rendered position');
        return assertRoom(page, `${habitat}/${width}/static`, habitat);
    }
    assert.equal(position.state, 'walking', `${habitat}/${width}: the pet walks toward its destination`);
    const marker = await page.locator('.tf-pet-move-target').boundingBox();
    assert.ok(marker, `${habitat}/${width}: destination is visible`);
    const target = { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 };
    for (let elapsed = 0; position.state !== 'resting' && elapsed < 14000; elapsed += 250) {
        await page.clock.runFor(250); position = await measure(page);
    }
    assert.equal(position.state, 'resting', `${habitat}/${width}: command finishes`);
    assert.ok(Math.abs(position.shadow.x + position.shadow.width / 2 - target.x) < 1.6, `${habitat}/${width}: horizontal foot destination`);
    assert.ok(Math.abs(position.shadow.y + position.shadow.height / 2 - target.y) < 1.6, `${habitat}/${width}: vertical foot destination`);
    return assertRoom(page, `${habitat}/${width}/arrived`, habitat);
}

async function capture(page, name, selector = '.tf-companion-device') {
    const bytes = await page.locator(selector).screenshot({ path: join(output, `${name}.png`), animations: 'disabled' });
    snapshots.push({ name, uri: `data:image/png;base64,${bytes.toString('base64')}` });
    return createHash('sha256').update(bytes).digest('hex');
}

async function setting(page, value, method = 'click') {
    await openCompanionMenu(page, 'dress', method);
    const settings = page.locator('.tf-device-setting-group').filter({ has: page.locator('.tf-pet-environment-controls') });
    if (!await settings.evaluate(node => node.open)) await settings.locator('summary')[method]();
    const option = page.locator(`[data-environment-field="habitat"][data-environment-value="${value}"]`);
    await option.scrollIntoViewIfNeeded();
    assert.equal(await option.locator('.tf-scene-art').getAttribute('data-scene'), value, `${value}: picker thumbnail has this scene artwork`);
    const preview = await option.locator('.tf-scene-art').evaluate(node => node.outerHTML);
    await option[method]();
    assert.equal(await option.getAttribute('aria-selected'), 'true', `${value}: selection is announced`);
    assert.equal((await readPet(page)).habitat, value, `${value}: real picker stores the choice`);
    await returnCompanionHome(page, method); await page.clock.runFor(300);
    assert.equal(await page.locator(sceneSelector).evaluate(node => node.outerHTML), preview, `${value}: full scene reuses the same artwork as its thumbnail`);
    await assertRoom(page, `${value}/picker`, value);
}

try {
    for (const width of [1280, 390, 320]) {
        const page = await open(width), hashes = [];
        for (const habitat of COMPANION_HABITATS) {
            await fixture(page, { habitat: habitat.id });
            const saved = await readPet(page);
            await assertRoom(page, `${habitat.id}/${width}`, habitat.id);
            hashes.push(await capture(page, `${habitat.id}-day-${width}`));
            await move(page, habitat.id, width);
            assert.deepEqual(await readPet(page), saved, `${habitat.id}/${width}: scenic movement leaves pet data unchanged`);
            assert.equal(await page.evaluate(() => sceneCalls), 0); assert.equal(await page.evaluate(() => sceneSaves), 0);
        }
        assert.equal(new Set(hashes).size, COMPANION_HABITATS.length, `all ${COMPANION_HABITATS.length} scenes have visually distinct artwork at ${width}px`);
        await page.close();
    }
    console.log('PASS 14 scenes × desktop/390/320: distinct art, intact pet, scenery hit testing, actual tap/click foot destinations and no data/API side effects');

    const page = await open(390);
    for (const habitat of COMPANION_HABITATS) {
        await fixture(page, { habitat: habitat.id, time: 'day' });
        const day = await capture(page, `${habitat.id}-day-light`, '.tf-pet-stage');
        const dayStyle = await page.locator(sceneSelector).evaluate(node => ({ sky: node.querySelector('.tf-scene-sky') && getComputedStyle(node.querySelector('.tf-scene-sky')).fill, lamps: [...node.querySelectorAll('.tf-scene-lamplight')].map(node => getComputedStyle(node).opacity), animated: [...node.querySelectorAll('*')].some(node => getComputedStyle(node).animationName !== 'none') }));
        await fixture(page, { habitat: habitat.id, time: 'night' });
        const night = await capture(page, `${habitat.id}-night-light`, '.tf-pet-stage');
        const nightStyle = await page.locator(sceneSelector).evaluate(node => ({ sky: node.querySelector('.tf-scene-sky') && getComputedStyle(node.querySelector('.tf-scene-sky')).fill, lamps: [...node.querySelectorAll('.tf-scene-lamplight')].map(node => getComputedStyle(node).opacity), animated: [...node.querySelectorAll('*')].some(node => getComputedStyle(node).animationName !== 'none') }));
        assert.notEqual(night, day, `${habitat.id}: day and night have different rendered lighting`);
        if (dayStyle.sky) assert.notEqual(nightStyle.sky, dayStyle.sky, `${habitat.id}: visible window/sky changes at night`);
        if (dayStyle.lamps.length) assert.ok(nightStyle.lamps.some((opacity, i) => Number(opacity) > Number(dayStyle.lamps[i])), `${habitat.id}: room light becomes warmer at night`);
        if (['meadow', 'pond', 'forest', 'snowfield', 'space', 'arcade', 'kitchen', 'bathroom', 'library', 'garden', 'beach', 'fairground'].includes(habitat.id)) {
            assert.ok(dayStyle.animated || nightStyle.animated, `${habitat.id}: the animated setting renders ambient motion`);
        }
    }
    for (const [habitat, weather] of [['meadow', 'wind'], ['pond', 'rain'], ['snowfield', 'snow'], ['beach', 'cloudy'], ['kitchen', 'rain']]) {
        await fixture(page, { habitat, weather, time: 'dusk' });
        assert.equal(await page.locator('.tf-companion-device').evaluate((node, weather) => node.classList.contains(`is-weather-${weather}`), weather), true);
        await assertRoom(page, `${habitat}/${weather}`, habitat); await capture(page, `${habitat}-${weather}-dusk`);
        if (habitat === 'kitchen') assert.ok((await page.locator('.tf-pet-weather > span').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display))).every(display => display === 'none'), 'rain stays outside an indoor room');
    }
    console.log('PASS all 14 day/night renderings and representative wind, rain, snow, cloud and indoor weather');

    await fixture(page);
    for (const { id } of COMPANION_HABITATS) await setting(page, id, 'tap');
    await capture(page, 'scene-picker-selected-mobile');
    console.log('PASS all 14 real mobile picker choices: thumbnail artwork matches selected full scene and is saved');

    await fixture(page, { habitat: 'library' });
    const beforePet = await readPet(page);
    await page.locator(petSelector).tap();
    assert.equal((await readPet(page)).bond - beforePet.bond, 3, 'care through the scene rewards exactly one petting');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'library', 'petting uses the selected scene');
    await page.clock.runFor(4500);
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'library', 'petting completion retains its room');

    await fixture(page, { habitat: 'forest' });
    await openCompanionMenu(page, 'feed', 'tap');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'forest', 'food selection keeps the selected room');
    const beforeFood = await readPet(page);
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]').tap();
    assert.ok((await readPet(page)).satiety > beforeFood.satiety, 'feeding uses the existing care flow');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'kitchen', 'feeding temporarily uses kitchen');
    await page.clock.runFor(4500);
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'forest', 'feeding completion restores chosen forest');
    assert.equal((await readPet(page)).habitat, 'forest', 'feeding does not replace saved environment');

    await fixture(page, { habitat: 'beach' });
    await openCompanionMenu(page, 'clean', 'tap');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'bathroom', 'washing uses bathroom');
    await returnCompanionHome(page, 'tap');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'beach', 'closing washing restores selected beach');
    assert.equal((await readPet(page)).habitat, 'beach');

    await fixture(page, { habitat: 'garden', life: { cleanliness: 45 } });
    await openCompanionMenu(page, 'clean', 'tap');
    const beforeBath = await readPet(page);
    for (let scrub = 0; scrub < 3; scrub++) await page.locator(petSelector).tap();
    assert.ok((await readPet(page)).life.cleanliness > beforeBath.life.cleanliness, 'completing a real bath updates cleanliness');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'bathroom', 'bath completion reaction stays in bathroom');
    await page.clock.runFor(4500); await returnCompanionHome(page, 'tap');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'garden', 'completed bath returns to selected garden');
    assert.equal((await readPet(page)).habitat, 'garden');

    await fixture(page, { habitat: 'fairground' });
    await openCompanionMenu(page, 'rest', 'tap');
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'bedroom', 'actual sleep uses bedroom');
    assert.equal((await readPet(page)).habitat, 'fairground', 'sleep retains chosen environment');
    await page.locator(petSelector).tap(); await page.clock.runFor(4500);
    assert.equal(await page.locator(sceneSelector).getAttribute('data-scene'), 'fairground', 'waking restores selected fairground');
    assert.equal(await page.evaluate(() => sceneCalls), 0);
    console.log('PASS actual petting, feeding, washing cancellation and sleep/wake temporary rooms restore the saved environment');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const { id } of COMPANION_HABITATS) {
        await fixture(page, { habitat: id });
        const animated = await page.locator('.tf-pet-habitat-layer, .tf-pet-habitat-layer *').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).animationName !== 'none').map(node => node.getAttribute('class')));
        assert.deepEqual(animated, [], `${id}: reduced motion disables scene animation`);
        const position = await move(page, id, 390, true);
        await page.clock.runFor(10000);
        const settled = await measure(page);
        assert.equal(settled.x, position.x); assert.equal(settled.y, position.y);
    }
    await capture(page, 'scene-reduced-motion-mobile');
    await page.close();
    console.log('PASS reduced motion stops all scenery animation while explicit floor taps keep static placement');

    const overview = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const cards = COMPANION_HABITATS.flatMap(({ id }) => [1280, 390, 320].map(width => snapshots.find(({ name }) => name === `${id}-day-${width}`)));
    await overview.setContent('<style>body{background:#f5f0e7;font:14px system-ui;padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%;display:block}figcaption{text-align:center;padding:6px}</style>' + cards.map(({ name, uri }) => `<figure><img src="${uri}"><figcaption>${name}</figcaption></figure>`).join(''));
    await overview.screenshot({ path: join(output, 'scenes-overview.png'), fullPage: true });
    await overview.setContent('<style>body{background:#f5f0e7;font:13px system-ui;padding:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0}img{width:100%;display:block}figcaption{text-align:center;padding:6px}</style>' + snapshots.filter(({ name }) => /-(?:day|night)-light$/.test(name)).map(({ name, uri }) => `<figure><img src="${uri}"><figcaption>${name}</figcaption></figure>`).join(''));
    await overview.screenshot({ path: join(output, 'scenes-day-night-overview.png'), fullPage: true });
    await overview.setContent('<style>body{margin:0;background:#f5f0e7;font:16px system-ui}.scenes-four-preview{width:650px;padding:18px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px;box-sizing:border-box}figure{margin:0}img{width:100%;display:block}figcaption{text-align:center;padding:10px 4px 2px;color:#4e5e54}</style><section class="scenes-four-preview">' + ['meadow', 'forest', 'snowfield', 'space'].map(id => ({ ...snapshots.find(({ name }) => name === `${id}-day-390`), label: COMPANION_HABITATS.find(scene => scene.id === id).name })).map(({ label, uri }) => `<figure><img src="${uri}"><figcaption>${label}</figcaption></figure>`).join('') + '</section>');
    await overview.locator('.scenes-four-preview').screenshot({ path: join(output, 'scenes-four-preview.png') });
    assert.deepEqual(errors, []);
    console.log('PASS no browser errors');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
