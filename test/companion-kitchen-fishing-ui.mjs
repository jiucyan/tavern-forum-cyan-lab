import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

// Exercise real delegated clicks, the roaming controller, the visual wait, and
// the saved model together. The clock lets us inspect the uncommitted midpoint.
const root = process.cwd(), output = await mkdtemp(join(tmpdir(), 'forum-kitchen-fishing-'));
console.log('ARTIFACTS', output);
const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body.toString()
            .replace('companionRoamController ||= createCompanionRoamController({', 'companionRoamController ||= createCompanionRoamController({ random: () => .8,')
            + '\nglobalThis.petTest={viewState,render,closeForum,openForum,cancelHomesteadMotion,showCompanionPanel,stopFishingDisplay,resetRoam(){companionRoamController?.destroy();companionRoamController=null;}};');
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
    await page.locator('.tf-pet-sprite-control').evaluate((el, at) => {
        for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = at; }
    }, at);
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

async function give(page, items) {
    await page.evaluate(async items => {
        const data = (await import('/src/store.js')).getForumData();
        const { addPetItem } = await import('/src/companion-homestead.js');
        for (const [id, quantity] of Object.entries(items)) addPetItem(data, id, quantity);
        petTest.render();
    }, items);
}
async function cast(page) {
    await click(page, '[data-homestead-action="fish-cast"]');
    await until(page, () => !!petTest.viewState.companionFishing && !petTest.viewState.companionHomesteadBusy, 'cast saved');
    assert.equal(await page.locator('.tf-fishing-overlay').getAttribute('data-fishing-phase'), 'waiting');
    assert.equal(await page.locator('[data-work-pose="fishing"] .tf-work-pose-art').count(), 1);
    return (await model(page)).homestead.fishing;
}
async function bite(page) {
    const fishing = (await model(page)).homestead.fishing;
    const delay = await page.evaluate(at => Math.max(0, at - Date.now() + 100), fishing.biteAt);
    await page.clock.runFor(delay);
    await until(page, () => document.querySelector('.tf-fishing-overlay')?.dataset.fishingPhase === 'bite', 'bite signaled');
    return fishing;
}
async function reel(page) {
    await click(page, '.tf-fishing-overlay [data-homestead-action="fish-reel"]');
    await motionStarted(page, 'fish');
}
async function measure(page, label) {
    const dimensions = await page.evaluate(() => {
        const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        const view = document.querySelector('.tf-view');
        return {
            view: { client: view.clientWidth, scroll: view.scrollWidth },
            viewport: box('.tf-device-viewport'), pet: box('.tf-pet-sprite-control'),
            inner: [...document.querySelectorAll('.tf-pet-device-content, .tf-homestead-panel')].filter(n => n.offsetWidth).map(n => ({ client: n.clientWidth, scroll: n.scrollWidth })),
            controls: [...document.querySelectorAll('.tf-pet-device-controls button')].map(el => { const b = el.getBoundingClientRect(); return { w: b.width, h: b.height }; }),
        };
    });
    assert.ok(dimensions.view.scroll <= dimensions.view.client + 2, label + ' outer overflow');
    assert.ok(dimensions.inner.every(row => row.scroll <= row.client + 2), label + ' content overflow');
    assert.ok(dimensions.controls.every(row => row.w >= 44 && row.h >= 44), label + ' touch targets');
    assert.ok(Math.abs(dimensions.viewport.w / dimensions.viewport.h - 4 / 3) < .02, label + ' scene aspect');
    // The tappable sprite box includes transparent art margins; the visible pet is smaller.
    assert.ok(dimensions.pet.h < dimensions.viewport.h * .60, label + ' pet touch box fits room: ' + JSON.stringify(dimensions));
    checks.push({ label, dimensions });
}
async function screenshot(page, name) {
    await page.clock.runFor(300);
    await page.locator('.tf-homestead-scene').evaluateAll(nodes => {
        for (const node of nodes) for (const animation of node.getAnimations()) {
            if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
        }
    });
    await page.locator('.tf-pet-console-wrap').screenshot({ path: join(output, `${name}.png`), animations: 'allow' });
}

try {
    if (process.argv.includes('--visual-only')) {
        for (const width of [1280, 320]) {
            const page = await browser.newPage({ viewport: { width, height: width === 320 ? 760 : 1000 }, hasTouch: width === 320 });
            page.on('pageerror', error => errors.push(error.message));
            await page.clock.install({ time: new Date('2026-10-05T12:00:00+08:00') });
            await page.clock.pauseAt(new Date('2026-10-05T12:00:00+08:00'));
            await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`); await page.waitForFunction(() => globalThis.petTest);
            await fixture(page, { location: 'kitchen' }); await screenshot(page, `kitchen-${width}`);
            await give(page, { carrot: 2, turnip: 2, berry: 2 }); await target(page, 'stove');
            await screenshot(page, `recipes-${width}`);
            await action(page, 'cook', '[data-recipe-id="vegetable-soup"]'); await midpoint(page, `cook-vegetable-soup-${width}`); await finish(page);
            await action(page, 'cook', '[data-recipe-id="bento"]'); await midpoint(page, `cook-bento-${width}`); await finish(page);
            await page.close();
        }
        assert.deepEqual(errors, []); console.log('VISUAL PASS', output);
    } else {
    for (const width of [1280, 320]) {
        const page = await browser.newPage({ viewport: { width, height: width === 320 ? 760 : 1000 }, hasTouch: width === 320 });
        page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-10-05T12:00:00+08:00') });
        await page.clock.pauseAt(new Date('2026-10-05T12:00:00+08:00'));
        await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`); await page.waitForFunction(() => globalThis.petTest);

        await fixture(page); await target(page, 'location:kitchen');
        assert.equal((await model(page)).homestead.location, 'kitchen');
        assert.equal(await page.locator('.tf-homestead-scene[data-indoor="true"]').count(), 1);
        await measure(page, `kitchen-${width}`); await screenshot(page, `kitchen-${width}`);
        await target(page, 'stove');
        assert.equal(await page.locator('[data-recipe-card]').count(), 5);
        assert.equal(await page.locator('[data-recipe-id="grilled-fish"]').isDisabled(), true);
        await give(page, { berry: 4, carrot: 6, turnip: 6, mushroom: 8, 'river-fish': 4, branch: 4 });
        await screenshot(page, `recipes-${width}`);
        const recipes = await page.evaluate(async () => (await import('/src/companion-homestead.js')).RECIPES.map(r => ({ id: r.id, outputId: r.outputId })));
        for (const recipe of recipes) {
            const before = await model(page), outputBefore = await count(page, recipe.outputId), stoveFoot = await foot(page);
            await action(page, 'cook', `[data-recipe-id="${recipe.id}"]`);
            await sameFoot(page, stoveFoot, 'cook stays by stove');
            await midpoint(page, `cook-${recipe.id}-${width}`);
            assert.deepEqual((await model(page)).inventory, before.inventory, recipe.id + ' no ingredients consumed early');
            const startedAt = await page.evaluate(() => petTest.viewState.companionHomesteadMotion.startedAt);
            await click(page, '[data-action="companion-menu-confirm"]', true);
            assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadMotion.startedAt), startedAt, 'duplicate cook ignored');
            await finish(page); assert.equal(await count(page, recipe.outputId), outputBefore + 1);
            assert.equal(await page.locator('[data-recipe-card]').count(), 5, 'recipe book reopened');
            await stableAfter(page, await model(page), 'cook ' + recipe.id);
        }
        const meal = await model(page), soupBefore = await count(page, 'vegetable-soup');
        await action(page, 'feed', '[data-item-id="vegetable-soup"]');
        await midpoint(page, `feed-soup-${width}`); assert.equal((await model(page)).satiety, meal.satiety);
        await finish(page); assert.equal(await count(page, 'vegetable-soup'), soupBefore - 1); assert.ok((await model(page)).satiety > meal.satiety);
        await click(page, '[data-homestead-action="close"]'); await target(page, 'storage');
        assert.equal(await page.locator('[data-homestead-action="feed"][data-item-id="river-fish"]').count(), 0, 'raw fish not feedable');
        await click(page, '[data-homestead-action="close"]'); await target(page, 'location:home');
        await target(page, 'door'); await target(page, 'location:forest'); await target(page, 'location:river');
        assert.equal((await model(page)).homestead.location, 'river', 'world route reaches river');
        await target(page, 'fishing'); assert.equal(await count(page, 'fishing-rod'), 1);
        await screenshot(page, `fishing-panel-${width}`);

        const beforeCatch = await model(page), waitFoot = await foot(page), firstCast = await cast(page);
        await sameFoot(page, waitFoot, 'cast holds fishing spot');
        await screenshot(page, `fishing-waiting-${width}`); await page.clock.runFor(1200);
        await sameFoot(page, waitFoot, 'waiting feet anchored'); assert.deepEqual((await model(page)).inventory, beforeCatch.inventory);
        await bite(page); await screenshot(page, `fishing-bite-${width}`);
        const fishBefore = await count(page, firstCast.fishId);
        await reel(page); await midpoint(page, `fishing-reel-${width}`);
        assert.equal(await count(page, firstCast.fishId), fishBefore, 'fish arrives after reeling');
        await click(page, '[data-action="companion-menu-confirm"]', true);
        await finish(page); assert.equal(await count(page, firstCast.fishId), fishBefore + 1); assert.equal((await model(page)).homestead.fishing, null);
        await screenshot(page, `fishing-caught-${width}`);
        assert.equal(await page.locator('[data-homestead-action="fish-cast"]').isDisabled(), true, 'cooldown displayed');
        await page.clock.runFor(3500);
        assert.equal(await page.locator('[data-homestead-action="fish-cast"]').isDisabled(), false, 'cooldown enables automatically');

        const earlyBefore = await model(page); await cast(page); await reel(page); await finish(page);
        assert.deepEqual((await model(page)).inventory, earlyBefore.inventory, 'early reel catches nothing');
        await page.clock.runFor(3500);
        await cast(page); const lateBefore = await model(page);
        await page.clock.runFor(18000);
        assert.equal((await model(page)).homestead.fishing, null, 'missed bite clears line');
        assert.equal(await page.locator('.tf-fishing-overlay').count(), 0, 'missed bite exits overlay');
        assert.deepEqual((await model(page)).inventory, lateBefore.inventory, 'late catch adds nothing');
        assert.equal(await page.locator('[data-homestead-action="fish-cast"]').isDisabled(), false, 'missed bite can retry');

        // A click inside the bite window remains valid while the reeling animation finishes.
        const lastSecond = await cast(page); await bite(page);
        await page.clock.runFor(await page.evaluate(end => Math.max(0, end - Date.now() - 250), lastSecond.endsAt));
        const lastCount = await count(page, lastSecond.fishId); await reel(page); await finish(page);
        assert.equal(await count(page, lastSecond.fishId), lastCount + 1, 'last-second valid click survives animation');
        await page.clock.runFor(3500);

        // Persisted waiting lines restore on re-entering the fishing spot.
        const resumed = await cast(page);
        await page.evaluate(() => { petTest.stopFishingDisplay({ cancel: false }); petTest.render(); });
        await target(page, 'fishing');
        assert.equal((await model(page)).homestead.fishing.id, resumed.id);
        assert.equal(await page.locator('.tf-fishing-overlay').count(), 1, 'saved line resumes');
        await click(page, '[data-action="companion-menu-nav"][data-direction="1"]');
        assert.equal((await model(page)).homestead.fishing, null, 'C cancels restored line');

        for (const via of ['C', 'menu', 'close']) {
            await fixture(page, { location: 'river' }); await target(page, 'fishing'); const before = await model(page);
            await cast(page); await cancel(page, via);
            assert.equal((await model(page)).homestead.fishing, null, via + ' clears line');
            assert.equal(await page.evaluate(() => petTest.viewState.companionFishing), null, via + ' stops display');
            assert.deepEqual((await model(page)).inventory, before.inventory, via + ' gives no fish');
        }
        await fixture(page, { location: 'river' }); await target(page, 'fishing'); const cancelledBefore = await model(page);
        await cast(page); await bite(page); await reel(page); await page.clock.runFor(300); await cancel(page, 'C');
        assert.deepEqual((await model(page)).inventory, cancelledBefore.inventory, 'cancel during reel gives no fish');
        assert.equal((await model(page)).homestead.fishing, null, 'cancel during reel clears line');

        // Saving a cast can be slow; the bite window and reeling remain usable.
        await fixture(page, { location: 'river' }); await target(page, 'fishing');
        await page.evaluate(() => {
            const context = SillyTavern.getContext(), original = context.saveMetadata;
            let first = true;
            context.saveMetadata = () => {
                if (!first) return original.call(context);
                first = false;
                return new Promise(resolve => { globalThis.finishSlowCastSave = () => { context.saveMetadata = original; resolve(); }; });
            };
        });
        await click(page, '[data-homestead-action="fish-cast"]');
        await until(page, () => !!petTest.viewState.companionFishing, 'slow cast visible');
        assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadBusy), false, 'cast save does not lock bite action');
        const slowCast = await bite(page), slowCount = await count(page, slowCast.fishId);
        await reel(page);
        await page.evaluate(() => globalThis.finishSlowCastSave());
        assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadBusy), true, 'cast save completion keeps reel locked');
        await click(page, '[data-action="companion-menu-confirm"]', true);
        await finish(page); assert.equal(await count(page, slowCast.fishId), slowCount + 1, 'slow cast still catches once');

        await fixture(page, { location: 'kitchen' }); await target(page, 'stove');
        assert.equal(await page.locator('[data-recipe-id="vegetable-soup"]').isDisabled(), true, 'missing ingredients disable cooking');
        await give(page, { carrot: 1, turnip: 1 }); const cancelCookBefore = await model(page);
        await action(page, 'cook', '[data-recipe-id="vegetable-soup"]'); await page.clock.runFor(400); await cancel(page, 'C');
        assert.deepEqual((await model(page)).inventory, cancelCookBefore.inventory, 'cancelling cook keeps all ingredients');

        await fixture(page, { location: 'kitchen' }); await give(page, { berry: 2 }); await target(page, 'storage');
        const pantryFoot = await foot(page), pantryBefore = await model(page), pantryBentoes = await count(page, 'bento');
        await click(page, '[data-homestead-action="cook"][data-recipe-id="bento"]');
        assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadApproaching), true, 'pantry recipe walks to stove first');
        assert.deepEqual((await model(page)).inventory, pantryBefore.inventory, 'approaching stove consumes nothing');
        await motionStarted(page, 'cook');
        const stoveArrival = await foot(page);
        assert.ok(Math.hypot(stoveArrival.x - pantryFoot.x, stoveArrival.y - pantryFoot.y) > 10, 'pet leaves pantry to cook');
        await finish(page); assert.equal(await count(page, 'bento'), pantryBentoes + 1);

        await fixture(page, { location: 'river' }); await target(page, 'fishing'); await cast(page); await bite(page); await reel(page); await finish(page);
        await give(page, { branch: 1 }); await click(page, '[data-homestead-action="close"]');
        await target(page, 'location:forest'); await target(page, 'location:yard'); await target(page, 'location:home'); await target(page, 'location:kitchen'); await target(page, 'stove');
        await action(page, 'cook', '[data-recipe-id="grilled-fish"]'); await finish(page);
        assert.equal(await count(page, 'grilled-fish'), 1, 'caught fish can cook after walk home');
        assert.equal(await count(page, 'river-fish') + await count(page, 'silver-fish') + await count(page, 'golden-fish'), 0, 'cooking uses caught fish');

        for (const skin of ['classic', 'pocket', 'crystal', 'arcane', 'terminal', 'camp', 'marine', 'arcade', 'lunar', 'berry']) {
            await fixture(page, { location: 'kitchen', skin });
            await measure(page, `${skin}-kitchen-${width}`); await screenshot(page, `${skin}-kitchen-${width}`);
            await target(page, 'stove');
            const panel = await page.locator('.tf-homestead-panel').evaluate(n => ({ client: n.clientWidth, scroll: n.scrollWidth }));
            assert.ok(panel.scroll <= panel.client + 2, skin + ' recipe book fits');
        }
        checks.push({ width, recipes: 5, cooking: true, fishing: ['cast', 'waiting', 'bite', 'reel', 'early', 'late', 'last-second', 'cooldown', 'resume', 'cancel'], kitchenSkins: 10 });
        console.log('PASS', width, 'kitchen, 5 recipes, fishing, cancellation and 10 skins');
        await page.close();
    }
    assert.deepEqual(errors, []); await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log('ALL PASS', output);
    }
} catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
        await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
        await writeFile(join(output, 'failure.html'), await page.content()).catch(() => {});
    }
    throw error;
} finally { await browser.close(); await new Promise(done => server.close(done)); }
