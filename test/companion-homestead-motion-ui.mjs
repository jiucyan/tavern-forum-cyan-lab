import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

// Exercise real delegated clicks, the roaming controller, the visual wait, and
// the saved model together. The clock lets us inspect the uncommitted midpoint.
const root = process.cwd(), output = await mkdtemp(join(tmpdir(), 'forum-homestead-motion-'));
console.log('ARTIFACTS', output);
const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body.toString()
            .replace('companionRoamController ||= createCompanionRoamController({', 'companionRoamController ||= createCompanionRoamController({ random: () => .8,')
            + '\nglobalThis.petTest={viewState,render,closeForum,openForum,cancelHomesteadMotion,showCompanionPanel,resetRoam(){companionRoamController?.destroy();companionRoamController=null;}};');
        res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], checks = [];

async function fixture(page, { location = 'home', skin = 'classic' } = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { createCompanionRoomPreset } = await import('/src/companion-room.js');
        const { normalizeHomestead, ensureHomesteadStarter } = await import('/src/companion-homestead.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        const view = petTest.viewState, data = getForumData(), pet = data.world.companion;
        petTest.cancelHomesteadMotion(); document.activeElement?.blur();
        for (const name of ['companionActionTimer', 'companionFeedbackTimer', 'companionRitualTimer', 'companionJourneyTimer']) clearTimeout(view[name]);
        view.companionClockGeneration++; view.companionActionToken++; view.moduleBusy.clear();
        Object.assign(view, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0,
            companionFoodMenuOpen: false, companionCleaning: false, companionFeedback: null, companionGameResultOpen: false,
            companionRitual: null, companionRitualTimer: 0, companionRoomDraft: null, companionRoomCare: null,
            companionRoomFoodTarget: null, companionRoomCommand: null, busy: false, companionHomesteadPanel: '',
            companionHomesteadNotice: '', companionHomesteadCommand: null, companionHomesteadFxUntil: 0 });
        data.world.inventory = []; data.world.trips = []; pet.homestead = normalizeHomestead({ location: values.location, visited: ['home', 'yard', 'forest', 'river'] });
        Object.assign(pet, { name: '团子', species: '黑猫', status: 'home', satiety: 45, happiness: 70, energy: 80, bond: 5,
            habitat: 'meadow', lastInteractionAt: 0, lastAction: '', deviceSkin: values.skin, avatarUrl: '', accessory: 'none',
            bodyColor: '', accentColor: '', weather: 'sunny', timeOfDay: 'day', message: '', packedItemIds: [], carrying: '', room: createCompanionRoomPreset('cozy') });
        Object.assign(pet.life, { stage: 'adult', mode: 'active', cleanliness: 70, game: null, autoSleep: false, sleepUntil: 0, awakeUntil: 0,
            roomBedId: '', growthNotice: null, lastTickAt: Date.now(), greetingDay: '2026-10-5', actionAt: {}, foodLikes: [], diary: [], milestones: [] });
        ensureHomesteadStarter(data); petTest.resetRoam(); petTest.render();
    }, { location, skin });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded(); await page.clock.runFor(50);
    await page.evaluate(async () => Promise.all([...document.querySelectorAll('.tf-pet-sprite-control image')].map(async el => {
        const img = new Image(); img.src = el.getAttribute('href'); await img.decode();
    })));
}
async function until(page, predicate, label) {
    for (let step = 0; step < 440; step++) {
        if (await page.evaluate(predicate)) return;
        await page.clock.runFor(50);
    }
    throw Error(label + ' ' + JSON.stringify(await page.evaluate(() => ({
        busy: petTest.viewState.companionHomesteadBusy, motion: petTest.viewState.companionHomesteadMotion,
        notice: petTest.viewState.companionHomesteadNotice, panel: petTest.viewState.companionPanel,
    }))));
}
async function click(page, selector, force = false) {
    const button = page.locator(selector).last();
    if (page.viewportSize().width === 320) await button.tap({ force }); else await button.click({ force });
}
async function target(page, id, motion = '') {
    await click(page, `[data-action="homestead-target"][data-target="${id}"]`);
    if (motion) await motionStarted(page, motion);
    else await until(page, () => !petTest.viewState.companionHomesteadCommand && !petTest.viewState.companionHomesteadBusy, 'arrival ' + id);
}
async function action(page, id, extra = '') {
    await click(page, `[data-homestead-action="${id}"]${extra}`);
    await motionStarted(page, id === 'depart' || id === 'exchange' ? 'pack' : id);
}
async function motionStarted(page, action) {
    await until(page, () => !!petTest.viewState.companionHomesteadMotion, 'motion ' + action);
    assert.equal(await page.locator('.tf-pet-sprite-control').getAttribute('data-homestead-motion'), action);
    assert.equal(await page.locator('.tf-homestead-motion-art').count(), 1);
}
async function finish(page) {
    await until(page, () => !petTest.viewState.companionHomesteadBusy, 'finish');
    assert.equal(await page.locator('[data-homestead-motion]').count(), 0);
}
async function count(page, id) { return page.evaluate(async id => (await import('/src/companion-homestead.js')).getPetItemCount((await import('/src/store.js')).getForumData(), id), id); }
async function model(page) { return page.evaluate(async () => {
    const data = (await import('/src/store.js')).getForumData();
    return { homestead: structuredClone(data.world.companion.homestead), inventory: structuredClone(data.world.inventory), satiety: data.world.companion.satiety, status: data.world.companion.status, trips: structuredClone(data.world.trips) };
}); }
async function foot(page) { return page.locator('.tf-pet-sprite-control').evaluate(el => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.bottom }; }); }
async function sameFoot(page, before, label) { const after = await foot(page); assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 2, `${label}: ${JSON.stringify({ before, after })}`); }
async function midpoint(page, name) {
    const state = await page.evaluate(() => petTest.viewState.companionHomesteadMotion);
    await page.clock.runFor(Math.max(1, Math.floor(state.duration / 2) - 50));
    const at = await page.evaluate(() => Date.now() - petTest.viewState.companionHomesteadMotion.startedAt);
    await page.locator('.tf-pet-stage').evaluate((el, at) => {
        for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = at; }
    }, at);
    if (state.action !== 'feed') {
        const tools = page.locator('.tf-player-task');
        assert.equal(await tools.count(), 1, 'player tools have their own scene layer');
        assert.equal(await tools.evaluate(node => node.parentElement.classList.contains('tf-pet-stage')), true, 'tools stay at the plot/table rather than moving with the companion');
        assert.equal(await page.locator('.tf-pet-sprite-control .tf-player-task, [data-aquatic-support], [data-work-stool]').count(), 0, 'no pet-mounted tools or support rig');
        const geometry = await tools.evaluate(node => {
            const stage = node.parentElement, room = stage.getBoundingClientRect();
            const control = stage.querySelector('.tf-pet-sprite-control'), pet = control.querySelector('.tf-pixel-pet').getBoundingClientRect();
            const controlBefore = control.getBoundingClientRect();
            const svg = node.querySelector('svg'), matrix = svg.getScreenCTM();
            const anchor = new DOMPoint(74, 88).matrixTransform(matrix);
            const expected = { x: room.left + parseFloat(node.style.left) / 100 * room.width,
                y: room.top + parseFloat(node.style.top) / 100 * room.height };
            const selected = stage.querySelector('[data-action="homestead-target"].is-working-target');
            const stationPoint = selected?.hasAttribute('data-work-x') && selected?.hasAttribute('data-work-y')
                ? { x: room.left + Number(selected.dataset.workX) / 320 * room.width,
                    y: room.top + Number(selected.dataset.workY) / 240 * room.height } : null;
            const prop = node.querySelector('.tf-hm-can,.tf-hm-bag,.tf-hm-bento-box,.tf-hm-harvest,.tf-hm-gather,.tf-hm-seed-pouch');
            const box = prop.getBoundingClientRect(), before = node.getBoundingClientRect();
            const oldStyle = control.getAttribute('style');
            control.style.setProperty('margin-left', '40px', 'important');
            const shiftedPet = control.getBoundingClientRect(), after = node.getBoundingClientRect();
            if (oldStyle === null) control.removeAttribute('style'); else control.setAttribute('style', oldStyle);
            const compact = b => ({ x: b.x, y: b.y, width: b.width, height: b.height });
            return { anchor, expected, pet: compact(pet), prop: compact(box),
                target: selected?.dataset.target, positionError: Math.hypot(anchor.x - expected.x, anchor.y - expected.y),
                stationPoint, stationError: stationPoint ? Math.hypot(anchor.x - stationPoint.x, anchor.y - stationPoint.y) : null,
                independentError: Math.hypot(after.x - before.x, after.y - before.y), petShift: shiftedPet.x - controlBefore.x,
                // The cat's authored head occupies x=12..49 of the 64-unit art;
                // the rightmost pixels belong to its tail, outside the face.
                clearsFace: box.x + box.width / 2 > pet.left + pet.width * .8 || box.bottom < pet.top + pet.height * .17 || box.top > pet.top + pet.height * .65 };
        });
        assert.ok(geometry.positionError < .5, name + ' SVG contact meets its scene anchor: ' + JSON.stringify(geometry));
        if (geometry.stationPoint) assert.ok(geometry.stationError < .5, name + ' tools meet the authored furniture work point: ' + JSON.stringify(geometry));
        assert.ok(geometry.petShift > 15 && geometry.independentError < .01, name + ' moving the pet leaves scene tools fixed: ' + JSON.stringify(geometry));
        assert.equal(geometry.clearsFace, true, name + ' player tools must clear the companion face: ' + JSON.stringify(geometry));
        checks.push({ name, geometry });
    }
    await page.locator('.tf-pet-console-wrap').screenshot({ path: join(output, `${name}.png`), animations: 'allow' });
}
async function stableAfter(page, expected, label) {
    await page.clock.runFor(2000);
    const actual = await model(page);
    assert.deepEqual(actual.inventory, expected.inventory, label + ' inventory once');
    assert.deepEqual(actual.homestead, expected.homestead, label + ' world once');
}
async function cancel(page, via) {
    if (via === 'C') await click(page, '[data-action="companion-menu-nav"][data-direction="1"]');
    else if (via === 'menu') await click(page, '.tf-device-menu-toggle');
    else await page.evaluate(() => petTest.closeForum());
    await page.clock.runFor(2000);
    assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadBusy), false);
    assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadMotion), null);
}

async function hiddenStorageExchange(page, width) {
    await fixture(page);
    await page.evaluate(async () => {
        const { getForumData } = await import('/src/store.js');
        const { addPetItem } = await import('/src/companion-homestead.js');
        const data = getForumData();
        data.world.companion.room.items.push({ id: 'cover-storage', type: 'bookshelf', x: 288, y: 86, rotation: 0, color: 'natural' });
        addPetItem(data, 'carrot', 1); petTest.resetRoam(); petTest.render();
    });
    assert.equal(await page.locator('.tf-homestead-station[data-target="storage"]').count(), 0, 'decorating over storage hides the overlapping station');
    await target(page, 'storage');
    const before = await model(page), seeds = await count(page, 'carrot-seed');
    await action(page, 'exchange', '[data-crop-id="carrot"]');
    await midpoint(page, `hidden-storage-exchange-${width}`);
    const point = await page.locator('.tf-player-task svg').evaluate(svg => {
        const room = svg.closest('.tf-pet-stage').getBoundingClientRect();
        const contact = new DOMPoint(74, 88).matrixTransform(svg.getScreenCTM());
        return { x: (contact.x - room.left) * 320 / room.width, y: (contact.y - room.top) * 240 / room.height };
    });
    assert.ok(Math.hypot(point.x - 288, point.y - 61) < .5, 'hidden storage exchange keeps the cabinet work point: ' + JSON.stringify(point));
    assert.deepEqual((await model(page)).inventory, before.inventory, 'exchange waits for the visible action');
    await finish(page);
    assert.equal(await count(page, 'carrot'), 0);
    assert.equal(await count(page, 'carrot-seed'), seeds + 2);
    await stableAfter(page, await model(page), 'hidden storage exchange');
    checks.push({ width, hiddenStorageExchange: true, point, passed: true });
}

try {
    for (const width of [1280, 320]) {
        const page = await browser.newPage({ viewport: { width, height: width === 320 ? 760 : 1000 }, hasTouch: width === 320 });
        page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-10-05T12:00:00+08:00') });
        await page.clock.pauseAt(new Date('2026-10-05T12:00:00+08:00'));
        await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`); await page.waitForFunction(() => globalThis.petTest);

        await hiddenStorageExchange(page, width);
        if (process.argv.includes('--only=hidden-storage')) { await page.close(); continue; }

        await fixture(page, { location: 'yard' });
        await target(page, 'plot:plot-1'); const arrived = await foot(page), seedCount = await count(page, 'carrot-seed');
        const emptyPlot = (await model(page)).homestead.plots[0];
        await action(page, 'plant', '[data-crop-id="carrot"]'); await sameFoot(page, arrived, 'plant retains arrival');
        await midpoint(page, `plant-${width}`); await sameFoot(page, arrived, 'plant feet anchored');
        assert.equal(await count(page, 'carrot-seed'), seedCount); assert.deepEqual((await model(page)).homestead.plots[0], emptyPlot);
        const startedAt = await page.evaluate(() => petTest.viewState.companionHomesteadMotion.startedAt);
        await click(page, '.tf-pet-sprite-control', true);
        await click(page, '[data-action="companion-menu-confirm"]', true);
        assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadMotion.startedAt), startedAt, 'busy clicks do not restart');
        await finish(page); assert.equal(await count(page, 'carrot-seed'), seedCount - 1); assert.equal((await model(page)).homestead.plots[0].cropId, 'carrot');
        await stableAfter(page, await model(page), 'plant');

        await target(page, 'plot:plot-1'); const plantedFoot = await foot(page);
        await action(page, 'water'); await sameFoot(page, plantedFoot, 'water retains arrival');
        await midpoint(page, `water-${width}`); assert.equal((await model(page)).homestead.plots[0].wateredAt, 0);
        assert.equal(await page.locator('.tf-hm-can').count(), 1); assert.equal(await page.locator('.tf-hm-drop').count(), 4);
        await finish(page); assert.ok((await model(page)).homestead.plots[0].wateredAt > 0);
        await page.clock.fastForward(5 * 60000); await page.evaluate(() => petTest.render());
        await target(page, 'plot:plot-1'); await action(page, 'harvest');
        await midpoint(page, `harvest-${width}`); assert.equal(await count(page, 'carrot'), 0); assert.equal((await model(page)).homestead.plots[0].cropId, 'carrot');
        await finish(page); assert.equal(await count(page, 'carrot'), 3); assert.equal((await model(page)).homestead.plots[0].cropId, '');
        await stableAfter(page, await model(page), 'harvest');

        await fixture(page, { location: 'forest' });
        await target(page, 'node:berry-bush', 'gather'); const gatherFoot = await foot(page);
        await midpoint(page, `gather-${width}`); await sameFoot(page, gatherFoot, 'gather feet anchored');
        assert.equal(await count(page, 'berry'), 0); assert.equal((await model(page)).homestead.nodes['berry-bush'], 0);
        await finish(page); assert.equal(await count(page, 'berry'), 2); assert.ok((await model(page)).homestead.nodes['berry-bush'] > 0);
        await stableAfter(page, await model(page), 'gather');

        await target(page, 'location:yard'); await target(page, 'location:home'); await target(page, 'storage');
        const cookBefore = await model(page), storageFoot = await foot(page);
        await action(page, 'cook'); await sameFoot(page, storageFoot, 'cook retains cabinet arrival');
        await midpoint(page, `cook-${width}`); assert.deepEqual((await model(page)).inventory, cookBefore.inventory);
        await finish(page); assert.equal(await count(page, 'bento'), 2); assert.equal(await count(page, 'berry'), 0);
        assert.equal(await page.locator('.tf-homestead-panel').count(), 1, 'cook reopens cabinet');
        const feedBefore = await model(page);
        await action(page, 'feed', '[data-item-id="bento"]'); await midpoint(page, `feed-${width}`);
        assert.deepEqual((await model(page)).inventory, feedBefore.inventory); assert.equal((await model(page)).satiety, feedBefore.satiety);
        await finish(page); assert.equal(await count(page, 'bento'), 1); assert.ok((await model(page)).satiety > feedBefore.satiety);
        await stableAfter(page, await model(page), 'feed');
        await click(page, '[data-homestead-action="close"]');
        const packBefore = await model(page);
        await target(page, 'packing', 'pack'); await midpoint(page, `pack-${width}`);
        assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'home');
        assert.deepEqual((await model(page)).inventory, packBefore.inventory);
        await finish(page); assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'travel');
        assert.deepEqual((await model(page)).inventory, packBefore.inventory, 'opening packing consumes nothing');
        const bentoId = (await model(page)).inventory.find(item => item.petItemId === 'bento').id;
        await page.locator(`input[data-packed-item-id="${bentoId}"]`).check();
        const beforeDeparture = await model(page);
        await action(page, 'depart', '[data-location="forest"]'); await midpoint(page, `departure-${width}`);
        assert.equal((await model(page)).status, 'home'); assert.deepEqual((await model(page)).inventory, beforeDeparture.inventory);
        assert.equal((await model(page)).trips.length, 0);
        await finish(page); assert.equal((await model(page)).status, 'away'); assert.equal(await count(page, 'bento'), 0);
        assert.equal((await model(page)).trips.length, 1);

        for (const interruption of ['.tf-pet-sprite-control', '[data-action="homestead-target"][data-target="storage"]']) {
            // The room station leaves the pet at the packing table already.
            // Open travel through the menu so departure really has a walk to cancel.
            await fixture(page); await click(page, '.tf-device-menu-toggle');
            await click(page, '.tf-device-icon-menu [data-action="companion-device-open"][data-panel="travel"]');
            const id = (await model(page)).inventory.find(item => item.petItemId === 'bento').id;
            await page.locator(`input[data-packed-item-id="${id}"]`).check();
            const before = await model(page);
            await click(page, '[data-homestead-action="depart"][data-location="forest"]');
            assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadApproaching), true, 'departure approaches packing table: ' + JSON.stringify(await page.evaluate(() => ({
                panel: petTest.viewState.companionPanel, busy: petTest.viewState.companionHomesteadBusy,
                motion: petTest.viewState.companionHomesteadMotion, notice: petTest.viewState.companionHomesteadNotice,
                pet: document.querySelector('.tf-pet-sprite-control')?.outerHTML.slice(0, 500),
            }))));
            assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadMotion), null, 'packing waits for arrival');
            await click(page, interruption, true); await finish(page); await page.clock.runFor(2000);
            assert.equal((await model(page)).status, 'home', 'interrupted approach does not depart');
            assert.deepEqual((await model(page)).inventory, before.inventory, 'interrupted approach keeps supplies');
            assert.equal((await model(page)).trips.length, 0, 'interrupted approach creates no trip');
            checks.push({ width, approachInterruption: interruption, passed: true });
        }

        for (const via of ['C', 'menu', 'close']) {
            await fixture(page, { location: 'forest' }); const before = await model(page);
            await target(page, 'node:berry-bush', 'gather'); await page.clock.runFor(400); await cancel(page, via);
            assert.deepEqual((await model(page)).inventory, before.inventory, via + ' cancel inventory');
            assert.equal((await model(page)).homestead.nodes['berry-bush'], 0, via + ' cancel cooldown');
            checks.push({ width, cancel: via, passed: true });
        }
        await fixture(page, { location: 'yard' }); await target(page, 'plot:plot-1'); const beforeCancel = await model(page);
        await action(page, 'plant', '[data-crop-id="carrot"]'); await page.clock.runFor(500); await cancel(page, 'C');
        assert.deepEqual((await model(page)).inventory, beforeCancel.inventory, 'cancel plant keeps seed');
        assert.equal((await model(page)).homestead.plots[0].cropId, '', 'cancel plant keeps plot empty');

        await fixture(page, { location: 'yard' }); await target(page, 'plot:plot-1');
        await page.evaluate(() => {
            const context = SillyTavern.getContext(), original = context.saveMetadata;
            context.saveMetadata = () => new Promise(resolve => { globalThis.finishSlowSave = () => { context.saveMetadata = original; resolve(); }; });
        });
        await action(page, 'plant', '[data-crop-id="carrot"]');
        await until(page, () => !!petTest.viewState.companionHomesteadJob?.committed, 'commit before slow save');
        assert.equal(await count(page, 'carrot-seed'), 1, 'commit consumes one seed before save finishes');
        assert.equal(await page.locator('[data-homestead-motion]').count(), 0, 'completed tools disappear while saving');
        assert.match(await page.locator('[data-action="companion-menu-confirm"]').textContent(), /保存中/);
        assert.match(await page.locator('[data-action="companion-menu-nav"][data-direction="1"]').textContent(), /等待/);
        await click(page, '[data-action="companion-menu-nav"][data-direction="1"]');
        assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadJob?.committed), true, 'C cannot cancel a committed save');
        await click(page, '[data-action="companion-menu-confirm"]', true);
        assert.equal(await count(page, 'carrot-seed'), 1, 'buttons cannot repeat committed work');
        await page.evaluate(() => globalThis.finishSlowSave()); await finish(page);
        await stableAfter(page, await model(page), 'slow save');
        checks.push({ width, slowSave: true, passed: true });

        await page.emulateMedia({ reducedMotion: 'reduce' }); await fixture(page, { location: 'yard' }); await target(page, 'plot:plot-1');
        await action(page, 'plant', '[data-crop-id="carrot"]');
        assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadMotion.duration), 120);
        assert.equal(await count(page, 'carrot-seed'), 2); await page.clock.runFor(60); assert.equal(await count(page, 'carrot-seed'), 2);
        await finish(page); assert.equal(await count(page, 'carrot-seed'), 1); await stableAfter(page, await model(page), 'reduced plant');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        checks.push({ width, actions: ['plant', 'water', 'harvest', 'gather', 'cook', 'feed', 'pack', 'depart'], reducedMotion: true, anchoredFeet: true });
        console.log('PASS', width, 'deferred commits, anchored movement, busy click guard, interruption, reduced motion');
        await page.close();
    }
    assert.deepEqual(errors, []); await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log('ALL PASS', output);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
