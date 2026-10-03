import { openCompanionMenu, returnCompanionHome } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

// The preview normally starts with fresh metadata. Persist through its real save
// hooks so reload exercises the same greeting record as a reopened ST chat.
const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-ritual-ui-'));
console.log('Artifacts:', output);
const server = createServer(async (request, response) => {
    try {
        const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname), file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render };');
        if (path === '/preview.html') body = Buffer.from(body.toString()
            .replace('const listeners = new Map();', `const savedMetadata = localStorage.getItem('forum-ritual-test-metadata');
    if (savedMetadata) Object.assign(metadata, JSON.parse(savedMetadata));
    const listeners = globalThis.petListeners = new Map();`)
            .replace('saveSettingsDebounced() {}, saveMetadataDebounced() {}, async saveMetadata() {}, setExtensionPrompt() {},', `saveSettingsDebounced() {},
        saveMetadataDebounced() { localStorage.setItem('forum-ritual-test-metadata', JSON.stringify(context.chatMetadata)); },
        async saveMetadata() { localStorage.setItem('forum-ritual-test-metadata', JSON.stringify(context.chatMetadata)); }, setExtensionPrompt() {},`));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [];
const ritual = (page, kind, phase) => page.locator(`.tf-pet-ritual[data-ritual-kind="${kind}"]${phase ? `[data-ritual-phase="${phase}"]` : ''}`);
const readPet = page => page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world.companion));
const today = page => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; });

async function showTravel(page) {
    await page.evaluate(async () => {
        const { getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        Object.assign(petTest.viewState, { open: true, worldPage: 'travel', companionPanel: 'home' });
        globalThis.petCalls = 0;
        SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
        petTest.render();
    });
    await page.locator('.tf-companion-device').scrollIntoViewIfNeeded();
}

async function fixture(page, values = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        const state = petTest.viewState, pet = getForumData().world.companion;
        clearTimeout(state.companionActionTimer); clearTimeout(state.companionFeedbackTimer); clearTimeout(state.companionRitualTimer);
        state.companionActionToken += 1;
        Object.assign(state, { open: true, worldPage: 'travel', companionPanel: values.panel || 'home', companionVisualAction: '', companionActionTimer: 0,
            companionFoodMenuOpen: false, companionCleaning: false, companionFeedback: null, companionGameResultOpen: false,
            companionRitual: null, companionRitualTimer: 0 });
        Object.assign(pet, { name: '团子', species: '黑猫', status: 'home', satiety: 40, happiness: 50, energy: 80, bond: 5,
            lastInteractionAt: 0, lastAction: '', lastFood: 'berry', message: '', habitat: 'meadow' }, values.pet);
        Object.assign(pet.life, { startedAt: Date.now() - 11 * 86400000, lastTickAt: Date.now(), mode: 'active', autoSleep: false,
            sleepUntil: 0, awakeUntil: 0, cleanliness: 80, game: null, growthNotice: null, stage: 'adult',
            greetingDay: '', bedtimeDay: '', diary: [], milestones: [], foodLikes: [], actionAt: {},
            traits: { lively: 0, curious: 0, calm: 0, affectionate: 0 } }, values.life);
        petTest.render();
    }, values);
}

async function open(width = 1280, values = {}) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 390 });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await fixture(page, values);
    await page.locator('.tf-companion-device').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
        globalThis.petCalls = 0;
        SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
    });
    return page;
}

async function cancelAtMenu(page) {
    const wasGreeting = await page.evaluate(() => petTest.viewState.companionRitual?.kind === 'greet');
    await openCompanionMenu(page, 'menu');
    assert.equal(await page.locator('.tf-pet-ritual').count(), 0);
    assert.equal(await page.evaluate(() => petTest.viewState.companionRitualTimer), 0, 'menu cancellation releases the ritual timer');
    if (wasGreeting) assert.equal(await page.locator('.tf-companion-page.is-action-idle').count(), 1, 'canceling reunion releases its happy action immediately');
    await returnCompanionHome(page);
    if (wasGreeting) assert.equal(await page.locator('.tf-companion-page.is-action-idle').count(), 1, 'returning home after reunion cancellation restores idle');
}

async function assertFits(page, label) {
    const metrics = await page.locator('.tf-companion-device').evaluate(device => {
        const stage = device.querySelector('.tf-pet-stage'), ritual = device.querySelector('.tf-pet-ritual'), caption = ritual?.querySelector('.tf-pet-ritual-caption');
        const box = node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
        return { device: box(device), stage: box(stage), ritual: box(ritual), caption: box(caption), width: innerWidth,
            appOverflow: document.querySelector('.tf-app').scrollWidth > document.querySelector('.tf-app').clientWidth + 2,
            captionOverflow: caption.scrollWidth > caption.clientWidth + 2 };
    });
    assert.equal(metrics.appOverflow, false, `${label}: app overflows horizontally`);
    assert.equal(metrics.captionOverflow, false, `${label}: caption text is clipped`);
    assert.ok(metrics.device.x >= -2 && metrics.device.right <= metrics.width + 2, `${label}: device outside viewport`);
    assert.ok(metrics.caption.x >= metrics.stage.x - 2 && metrics.caption.right <= metrics.stage.right + 2, `${label}: caption outside stage`);
    assert.ok(metrics.caption.y >= metrics.stage.y - 2 && metrics.caption.bottom <= metrics.stage.bottom + 2, `${label}: caption outside stage vertically`);
}

try {
    const page = await open();
    await ritual(page, 'greet', 'hello').waitFor();
    assert.match(await ritual(page, 'greet').innerText(), /一起生活的第\s*12\s*天/);
    let pet = await readPet(page);
    assert.equal(pet.life.greetingDay, await today(page));
    assert.equal(pet.life.diary.filter(note => /第一次重逢时/.test(note.text)).length, 1);
    assert.equal(pet.life.milestones.filter(key => key === 'first-greeting').length, 1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('forum-ritual-test-metadata')).tavern_forum_data.world.companion.life.greetingDay), pet.life.greetingDay);
    await page.screenshot({ path: join(output, 'greeting-desktop.png'), animations: 'allow' });
    await ritual(page, 'greet').waitFor({ state: 'detached' });
    await openCompanionMenu(page, 'status'); await returnCompanionHome(page);
    assert.equal(await ritual(page, 'greet').count(), 0, 'returning home does not replay today\'s greeting');
    await page.reload(); await page.waitForFunction(() => globalThis.petTest); await showTravel(page);
    assert.equal(await ritual(page, 'greet').count(), 0, 'saved greeting survives reload');
    assert.equal((await readPet(page)).life.diary.filter(note => /第一次重逢时/.test(note.text)).length, 1);
    console.log('PASS first daily reunion is saved; same-day page changes and reload do not replay it');

    for (const [label, values] of [
        ['away', { pet: { status: 'away' } }], ['sleeping', { life: { sleepUntil: Date.now() + 3600000 } }],
        ['paused', { life: { mode: 'paused' } }], ['daycare', { life: { mode: 'daycare' } }], ['another page', { panel: 'status' }],
    ]) {
        await fixture(page, values);
        assert.equal((await readPet(page)).life.greetingDay, '', `${label}: greeting must remain available`);
        assert.equal(await ritual(page, 'greet').count(), 0, `${label}: greeting must not play`);
        if (label === 'another page') await returnCompanionHome(page);
        else await page.evaluate(async () => {
            const pet = (await import('/src/store.js')).getForumData().world.companion;
            pet.status = 'home'; pet.life.mode = 'active'; pet.life.sleepUntil = 0; petTest.render();
        });
        await ritual(page, 'greet', 'hello').waitFor();
        assert.equal((await readPet(page)).life.greetingDay, await today(page), `${label}: eligible return claims the greeting`);
        await cancelAtMenu(page);
    }
    await fixture(page, { life: { greetingDay: '', game: null }, panel: 'games' });
    await page.locator('[data-action="pet-game-start"][data-game="catch"]').click();
    await page.locator('.tf-pet-game').waitFor();
    await page.evaluate(() => { petTest.viewState.companionPanel = 'home'; petTest.render(); });
    assert.equal((await readPet(page)).life.greetingDay, '', 'an active game does not consume reunion');
    assert.equal(await ritual(page, 'greet').count(), 0);
    console.log('PASS travel, sleep, pause, daycare and other screens keep the greeting for an eligible reunion');

    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await fixture(page, { pet: { satiety: 20 } });
        await ritual(page, 'greet', 'hello').waitFor();
        const chip = page.locator('.tf-device-need');
        assert.equal(await chip.isVisible(), true, `${width}: hungry reunion keeps the food shortcut visible`);
        const layout = await chip.evaluate(node => {
            const need = node.getBoundingClientRect(), stage = node.closest('.tf-pet-stage'), room = stage.getBoundingClientRect();
            const caption = stage.querySelector('.tf-pet-ritual-caption').getBoundingClientRect();
            const sprite = stage.querySelector('.tf-pixel-pet').getBoundingClientRect();
            const overlaps = box => need.left < box.right && need.right > box.left && need.top < box.bottom && need.bottom > box.top;
            // The pet's transparent SVG extends below its feet. Protect its face
            // and ears; the bottom shortcut may share the transparent foot area.
            return { inside: need.left >= room.left && need.right <= room.right && need.top >= room.top && need.bottom <= room.bottom,
                captionOverlap: overlaps(caption), faceOverlap: overlaps({ ...sprite.toJSON(), bottom: sprite.top + sprite.height * .65 }) };
        });
        assert.deepEqual(layout, { inside: true, captionOverlap: false, faceOverlap: false }, `${width}: need and reunion copy fit without covering the face`);
        await page.locator('.tf-companion-device').screenshot({ path: join(output, `hungry-greeting-${width}.png`), animations: 'allow' });
        await chip.click();
        await page.locator('.tf-pet-food-select').waitFor();
        assert.equal(await ritual(page, 'greet').count(), 0, 'food shortcut cancels reunion before selecting food');
        assert.equal(await page.evaluate(() => petTest.viewState.companionRitualTimer), 0);
        await returnCompanionHome(page);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    console.log('PASS hungry daily reunion keeps a clear, clickable food shortcut on mobile and desktop');

    await fixture(page, { life: { greetingDay: await today(page) } });
    await openCompanionMenu(page, 'feed');
    const beforeMeal = await readPet(page);
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]').evaluate(node => { node.click(); node.click(); });
    await ritual(page, 'meal', 'prepare').waitFor();
    const initialFeedingClock = await page.evaluate(() => {
        globalThis.ritualSprite = document.querySelector('.tf-pet-sprite-control');
        globalThis.ritualOffering = document.querySelector('.tf-food-offering');
        const animation = globalThis.ritualFeedingAnimation = ritualOffering.getAnimations()[0];
        return { duration: getComputedStyle(ritualOffering).animationDuration, startTime: animation?.startTime, pending: animation?.pending };
    });
    assert.equal(initialFeedingClock.duration, '3.6s', 'existing feeding animation keeps its 3.6-second duration');
    // Finding the newly inserted CSS animation flushes style before Chromium has
    // assigned its document-timeline start on the next frame. Keep the original
    // nodes, then wait for that same animation to actually begin; a missing or
    // replaced scene still fails within one second.
    if (initialFeedingClock.startTime === null) assert.equal(initialFeedingClock.pending, true, 'an unset startTime must belong to a pending animation');
    await page.waitForFunction(() => {
        return ritualOffering.isConnected && ritualOffering.getAnimations().includes(ritualFeedingAnimation)
            && typeof ritualFeedingAnimation?.startTime === 'number';
    }, null, { timeout: 1000 });
    const feedingClock = await page.evaluate(() => ({ startTime: ritualOffering.getAnimations()[0]?.startTime }));
    assert.ok(feedingClock.startTime !== undefined && feedingClock.startTime !== null);
    await ritual(page, 'meal', 'eat').waitFor();
    for (const phase of ['eat', 'thanks']) {
        if (phase === 'thanks') await ritual(page, 'meal', phase).waitFor();
        const clock = await page.evaluate(() => ({ sameSprite: ritualSprite === document.querySelector('.tf-pet-sprite-control'),
            sameOffering: ritualOffering === document.querySelector('.tf-food-offering'), startTime: ritualOffering.getAnimations()[0]?.startTime }));
        assert.ok(clock.sameSprite && clock.sameOffering, `${phase}: the feeding scene is not replaced`);
        assert.equal(clock.startTime, feedingClock.startTime, `${phase}: species feeding animation is not restarted`);
    }
    await page.screenshot({ path: join(output, 'meal-thanks-desktop.png'), animations: 'allow' });
    const settledMeal = await readPet(page);
    assert.ok(settledMeal.satiety > beforeMeal.satiety);
    assert.equal(settledMeal.life.foodLikes.find(food => food.id === 'berry').count, 1, 'double click gives one meal reward');
    assert.equal(settledMeal.life.traits.calm, 1);
    assert.equal(settledMeal.life.diary.filter(note => /第一次照顾/.test(note.text)).length, 1);
    await ritual(page, 'meal').waitFor({ state: 'detached' });
    assert.equal((await readPet(page)).satiety, settledMeal.satiety, 'phase completion never settles a second meal');
    console.log('PASS meal prepare → eat → thanks preserves feeding clock and settles double clicks once');

    await fixture(page, { life: { greetingDay: await today(page) } });
    await openCompanionMenu(page, 'feed');
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
    await ritual(page, 'meal', 'prepare').waitFor();
    await page.evaluate(() => {
        globalThis.ritualNativeDateNow = Date.now;
        globalThis.ritualRollbackStartedAt = performance.now();
        Date.now = () => ritualNativeDateNow() - 3600000;
    });
    try {
        await ritual(page, 'meal', 'eat').waitFor();
        await ritual(page, 'meal', 'thanks').waitFor();
        await ritual(page, 'meal').waitFor({ state: 'detached', timeout: 4100 });
        const elapsed = await page.evaluate(() => performance.now() - ritualRollbackStartedAt);
        assert.ok(elapsed <= 3900, `clock rollback prolonged the 3.6-second meal to ${elapsed}ms`);
        assert.equal(await page.evaluate(() => petTest.viewState.companionRitualTimer), 0);
    } finally {
        await page.evaluate(() => { Date.now = ritualNativeDateNow; delete globalThis.ritualNativeDateNow; });
    }
    console.log('PASS clock rollback cannot prolong the local feeding ceremony');

    await fixture(page, { life: { greetingDay: await today(page) } });
    await openCompanionMenu(page, 'rest');
    await ritual(page, 'bedtime', 'settle').waitFor();
    pet = await readPet(page);
    assert.equal(pet.status, 'resting');
    const remainingSleep = await page.evaluate(async () => (await import('/src/store.js')).getForumData().world.companion.life.sleepUntil - Date.now());
    assert.ok(remainingSleep > 3595000 && remainingSleep <= 3600000, 'the existing rest action sleeps for one hour');
    assert.equal(pet.life.bedtimeDay, await today(page));
    assert.equal(pet.life.diary.filter(note => /第一次道过晚安后/.test(note.text)).length, 1);
    await ritual(page, 'bedtime', 'sleep').waitFor();
    await page.screenshot({ path: join(output, 'bedtime-desktop.png'), animations: 'allow' });
    await ritual(page, 'bedtime').waitFor({ state: 'detached' });
    await openCompanionMenu(page, 'rest');
    assert.equal((await readPet(page)).life.diary.filter(note => /第一次道过晚安后/.test(note.text)).length, 1, 'repeated bedtime keeps one first-bedtime memory');
    await cancelAtMenu(page);
    console.log('PASS bedtime settle → sleep → finish retains one-hour rest and one first-bedtime memory');

    // Fixture only the transient decoration for the viewport matrix. Timed action
    // behavior is verified above through real controls, without delaying each photo.
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [kind, phases] of [['greet', ['hello']], ['meal', ['prepare', 'eat', 'thanks']], ['bedtime', ['settle', 'sleep']]]) {
            for (const phase of phases) {
                await fixture(page, { pet: { status: kind === 'bedtime' ? 'resting' : 'home' },
                    life: { greetingDay: await today(page), sleepUntil: kind === 'bedtime' ? Date.now() + 3600000 : 0 } });
                await page.evaluate(({ kind, phase }) => {
                    petTest.viewState.companionRitual = { kind, phase, days: 12, foodName: '莓果小点', favorite: true, startedAt: Date.now(), until: Date.now() + 60000 };
                    if (kind === 'meal') petTest.viewState.companionVisualAction = 'feed';
                    petTest.render();
                }, { kind, phase });
                await ritual(page, kind, phase).waitFor();
                await page.locator('.tf-companion-device').scrollIntoViewIfNeeded();
                await assertFits(page, `${kind}/${phase}/${width}`);
                await page.locator('.tf-companion-device').screenshot({ path: join(output, `${kind}-${phase}-${width}.png`), animations: 'allow' });
            }
        }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [kind, phase] of [['greet', 'hello'], ['meal', 'eat'], ['bedtime', 'sleep']]) {
        await fixture(page, { pet: { status: kind === 'bedtime' ? 'resting' : 'home' },
            life: { greetingDay: await today(page), sleepUntil: kind === 'bedtime' ? Date.now() + 3600000 : 0 } });
        await page.evaluate(({ kind, phase }) => {
            petTest.viewState.companionRitual = { kind, phase, days: 12, foodName: '莓果小点', startedAt: Date.now(), until: Date.now() + 60000 };
            petTest.render();
        }, { kind, phase });
        const motion = await ritual(page, kind).evaluate(node => [node, ...node.querySelectorAll('*')].map(element => {
            const style = getComputedStyle(element); return { name: style.animationName, duration: style.animationDuration };
        }));
        assert.ok(motion.every(item => item.name === 'none' || item.duration.split(',').every(duration => parseFloat(duration) <= .00001)), `${kind}: reduced-motion leaves an active ritual animation`);
        assert.ok((await ritual(page, kind).innerText()).trim(), `${kind}: reduced-motion keeps ceremony copy readable`);
        await assertFits(page, `${kind}/reduced-motion`);
        await page.locator('.tf-companion-device').screenshot({ path: join(output, `${kind}-reduced-motion.png`), animations: 'allow' });
    }
    console.log('PASS all phases fit 320/390 mobile and desktop; reduced-motion keeps readable static rituals');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await fixture(page, { life: { greetingDay: await today(page) } });
    await openCompanionMenu(page, 'feed');
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
    await ritual(page, 'meal').waitFor();
    await page.evaluate(day => {
        const context = SillyTavern.getContext();
        context.chatId = 'another-ritual-pet';
        context.chatMetadata = { tavern_forum_data: { world: { companion: { name: '第二只', satiety: 30, life: { autoSleep: false, greetingDay: day } } } } };
        petListeners.get('chat_changed')();
    }, await today(page));
    assert.equal(await page.locator('.tf-pet-ritual').count(), 0);
    assert.equal(await page.evaluate(() => petTest.viewState.companionRitual), null);
    assert.equal(await page.evaluate(() => petTest.viewState.companionRitualTimer), 0);
    await page.waitForTimeout(3900);
    const switched = await readPet(page);
    assert.equal(switched.name, '第二只'); assert.equal(switched.satiety, 30);
    assert.equal(switched.life.foodLikes.length, 0); assert.equal(switched.life.diary.length, 0);
    assert.equal(await ritual(page, 'meal').count(), 0, 'old meal timer cannot paint the new chat');
    assert.equal(await page.locator('.is-action-feed').count(), 0);
    assert.equal(await page.evaluate(() => petCalls), 0);
    console.log('PASS chat changes cancel pending ritual timers without affecting the next pet; no API calls');
    await page.close();

    const mobile = await open(390, { life: { greetingDay: '2999-1-1' } });
    await openCompanionMenu(mobile, 'feed', 'tap');
    await mobile.locator('[data-action="companion-feed-food"][data-food-id="berry"]').tap();
    await ritual(mobile, 'meal', 'prepare').waitFor();
    await assertFits(mobile, 'real touch meal');
    await cancelAtMenu(mobile);
    await mobile.setViewportSize({ width: 320, height: 900 });
    await openCompanionMenu(mobile, 'rest', 'tap');
    await ritual(mobile, 'bedtime', 'settle').waitFor();
    assert.equal((await readPet(mobile)).status, 'resting');
    await ritual(mobile, 'bedtime', 'sleep').waitFor();
    await assertFits(mobile, 'real touch bedtime');
    await mobile.locator('.tf-companion-device').screenshot({ path: join(output, 'bedtime-sleep-touch-320.png'), animations: 'allow' });
    assert.equal(await mobile.evaluate(() => petCalls), 0);
    await mobile.close();
    assert.deepEqual(errors, []);
    console.log('PASS touch menu controls start meals and bedtime without errors');
    console.log('Screenshots:', output);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
