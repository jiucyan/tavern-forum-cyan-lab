import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

// Real furniture taps drive the route and pose; the native sprite masks,
// stage geometry and growth art are used unchanged.
const root = process.cwd(), output = await mkdtemp(join(tmpdir(), 'forum-room-posture-'));
console.log('ARTIFACTS', output);
const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body.toString()
            + '\nglobalThis.petTest={viewState,render,stop(){companionRoamController?.destroy();companionRoamController=null;companionIdleController?.stop?.();}};');
        res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], checks = [];
const species = [
    ['frog', '青蛙', 'frog'], ['cat', '黑猫', 'cat'], ['rabbit', '垂耳兔', 'rabbit'],
    ['fox', '赤狐', 'fox'], ['penguin', '小企鹅', 'penguin'], ['robo-bird', '机械鸟', 'machine'],
    ['octopus', '小章鱼', 'crawl'], ['goldfish', '斗鱼', 'swim'], ['soot', '煤球', 'soot'],
];
const filter = (name, allowed) => {
    const argument = process.argv.slice(2).find(value => value.startsWith(`--${name}=`));
    if (!argument) return null;
    const values = argument.slice(name.length + 3).split(',');
    assert.ok(values.length && values.every(value => allowed.includes(value)), `valid --${name} values: ${allowed.join(',')}`);
    return [...new Set(values)];
};
const speciesFilter = filter('species', species.map(([kind]) => kind));
const stageFilter = filter('stage', ['baby', 'young', 'adult']);
const widthFilter = filter('width', ['1280', '320']);
async function furnitureGeometry(page) {
    return page.locator('.tf-pet-sprite-control').evaluate(async control => {
        const { getForumData } = await import('/src/store.js');
        const { getRoomInteraction, getRoomItemBounds } = await import('/src/companion-room.js');
        const item = getForumData().world.companion.room.items.find(value => value.id === control.dataset.roomItemId);
        const anchor = getRoomInteraction(item).anchor, furniture = getRoomItemBounds(item);
        const room = control.closest('.tf-pet-stage').getBoundingClientRect();
        const shadow = control.querySelector('.tf-pet-character-shadow'), shadowBox = shadow.getBoundingClientRect();
        const point = { x: (shadowBox.x - room.x + shadowBox.width / 2) * 320 / room.width,
            y: (shadowBox.y - room.y + shadowBox.height / 2) * 240 / room.height };
        const sprite = control.querySelector(':scope > .tf-pixel-avatar > svg').getBoundingClientRect();
        return { anchor, point, furniture, spriteSize: sprite.width * 320 / room.width,
            controlAnimation: getComputedStyle(control).animationName, controlTransform: getComputedStyle(control).transform };
    });
}
async function fixture(page, kind, name, stage, color = '') {
    await page.evaluate(async ({ name, stage, color }) => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { normalizeHomestead } = await import('/src/companion-homestead.js');
        const { createCompanionRoomPreset } = await import('/src/companion-room.js');
        const view = petTest.viewState, data = getForumData(), pet = data.world.companion;
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        document.activeElement?.blur(); petTest.stop();
        for (const field of ['companionActionTimer', 'companionFeedbackTimer', 'companionRitualTimer', 'companionJourneyTimer']) clearTimeout(view[field]);
        view.companionClockGeneration++; view.companionActionToken++; view.moduleBusy.clear();
        Object.assign(view, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0,
            companionFoodMenuOpen: false, companionCleaning: false, companionFeedback: null, companionGameResultOpen: false,
            companionRitual: null, companionRitualTimer: 0, companionRoomDraft: null, companionRoomCare: null,
            companionRoomFoodTarget: null, companionRoomCommand: null, busy: false, companionHomesteadPanel: '',
            companionHomesteadNotice: '', companionHomesteadCommand: null, companionHomesteadFxUntil: 0 });
        data.world.inventory = []; data.world.trips = [];
        Object.assign(pet, { name: '团子', species: name, status: 'home', satiety: 80, happiness: 70, energy: 80, bond: 5,
            habitat: 'meadow', lastInteractionAt: 0, lastAction: '', deviceSkin: 'classic', avatarUrl: '', accessory: 'none',
            bodyColor: color, accentColor: '', weather: 'sunny', timeOfDay: 'day', message: '', packedItemIds: [], carrying: '',
            room: createCompanionRoomPreset('cozy'), homestead: normalizeHomestead({ location: 'room' }) });
        Object.assign(pet.life, { stage, mode: 'active', cleanliness: 80, game: null, autoSleep: false, sleepUntil: 0, awakeUntil: 0,
            roomBedId: '', growthNotice: null, lastTickAt: Date.now(), greetingDay: '2026-10-11', actionAt: {}, foodLikes: [], diary: [], milestones: [] });
        petTest.render();
        const control = document.querySelector('.tf-pet-sprite-control');

        delete control.dataset.idlePose;
        await Promise.all([...control.querySelectorAll('image')].map(async el => { const image = new Image(); image.src = el.getAttribute('href'); await image.decode(); }));
    }, { name, stage, color });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    assert.equal(await page.locator(`.tf-pet-sprite-control .is-kind-${kind}.is-growth-${stage}`).count(), 1);
}
try {
    for (const width of widthFilter ? widthFilter.map(Number) : [1280, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 320 });
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-10-12T12:00:00+08:00') });
        await page.clock.pauseAt(new Date('2026-10-12T12:00:00+08:00'));
        await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
        await page.waitForFunction(() => globalThis.petTest);
        for (const [kind, name] of species.filter(([kind]) => !speciesFilter || speciesFilter.includes(kind))) for (const stage of stageFilter || ['baby', 'young', 'adult']) {
            if (kind === 'goldfish' || kind === 'frog' && stage === 'baby') continue;
            await fixture(page, kind, name, stage, stage === 'young' ? '#9eb9bd' : '');
            await page.clock.runFor(100);
            const bed = page.locator('.tf-room-live-hit[data-room-kind="rest"]');
            await bed[width === 320 ? 'tap' : 'click']();
            for (let t = 0; t < 25000; t += 200) {
                if (await page.locator('.tf-pet-sprite-control').getAttribute('data-room-pose') === 'rest') break;
                await page.clock.runFor(200);
            }
            assert.equal(await page.locator('.tf-pet-sprite-control').getAttribute('data-room-pose'), 'rest', `${kind}/${stage} arrives at its bed`);
            const result = await page.locator('.tf-pet-sprite-control').evaluate(control => {
                const pose = control.querySelector('.tf-room-pose-art');
                // Raster frame groups include the offscreen sprite sheet; its
                // clipped pixels are bounded by the native character viewport.
                const b = control.querySelector(':scope > .tf-pixel-avatar > svg').getBoundingClientRect(), room = control.closest('.tf-pet-stage').getBoundingClientRect();
                const frames = [...pose.querySelectorAll('.tf-raster-frame')].filter(el => getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).opacity === '1');
                const parts = [...pose.querySelectorAll('.tf-room-rest-head [data-part]')].filter(el => /^(wing|foot|arm|leg)-|^tail$/.test(el.dataset.part));
                const body = control.querySelector('.tf-pixel-character');
                return { anatomy: pose.dataset.poseAnatomy, poseDisplay: getComputedStyle(pose).display, bodyDisplay: getComputedStyle(body).display,
                    frames: frames.map(el => el.dataset.frame), duplicateLimbs: parts.filter(el => getComputedStyle(el).visibility !== 'hidden').map(el => el.dataset.part),
                    x: b.x - room.x, y: b.y - room.y, right: b.right - room.right, bottom: b.bottom - room.bottom,
                    growthMotion: getComputedStyle(control.querySelector('.tf-pixel-growth-motion')).animationName };
            });
            assert.notEqual(result.poseDisplay, 'none'); assert.equal(result.bodyDisplay, 'none');
            assert.equal(result.growthMotion, 'none', 'resting animal cannot bounce away from the mattress');
            assert.deepEqual(result.duplicateLimbs, [], 'resting anatomy has no original standing limbs');
            if (stage === 'adult') assert.deepEqual(result.frames, ['sleep'], 'native sleeping face is retained');
            assert.ok(result.x >= -2 && result.y >= -2 && result.right <= 2 && result.bottom <= 2, `${kind}/${stage} resting bounds: ${JSON.stringify(result)}`);
            const bedGeometry = await furnitureGeometry(page);
            assert.ok(Math.hypot(bedGeometry.point.x - bedGeometry.anchor.x, bedGeometry.point.y - bedGeometry.anchor.y) <= 2, `${kind}/${stage} foot anchor on mattress: ${JSON.stringify(bedGeometry)}`);
            assert.ok(Math.abs(bedGeometry.spriteSize - 76) < .5, `${kind}/${stage} keeps the shared room scale on ${width}px: ${JSON.stringify(bedGeometry)}`);
            if (width === 1280 || stage === 'adult' || stageFilter) await page.locator('.tf-device-viewport').screenshot({ path: join(output, `${width}-${kind}-${stage}.png`), animations: 'disabled' });
            if (width === 1280) {
                await page.addStyleTag({ content: '#tavern-forum-root .tf-pet-sprite-control { --pet-sprite-size: 200px !important; }' });
                await page.locator('.tf-pet-sprite-control').screenshot({ path: join(output, `${kind}-${stage}-detail.png`), animations: 'disabled' });
                await page.locator('style').last().evaluate(el => el.remove());
            }
            checks.push({ width, kind, stage, ...result, geometry: bedGeometry });
            if (stage !== 'young' && !stageFilter) continue;
            // The default suite checks young companions' whole-body hop;
            // focused stage runs also inspect the selected ages on the sofa.
            // Sitting suppresses hopping without replacing upright native art.
            await fixture(page, kind, name, stage);
            await page.locator('.tf-room-live-hit[data-room-kind="sit"]')[width === 320 ? 'tap' : 'click']();
            for (let t = 0; t < 25000; t += 200) {
                if (await page.locator('.tf-pet-sprite-control').getAttribute('data-room-pose') === 'sit') break;
                await page.clock.runFor(200);
            }
            assert.equal(await page.locator('.tf-pet-sprite-control').getAttribute('data-room-pose'), 'sit', `${kind}/${stage} arrives at its sofa`);
            const seat = await page.locator('.tf-pet-sprite-control').evaluate(control => ({
                poseDisplay: getComputedStyle(control.querySelector('.tf-room-pose-art')).display,
                bodyDisplay: getComputedStyle(control.querySelector('.tf-pixel-character')).display,
                growthMotion: getComputedStyle(control.querySelector('.tf-pixel-growth-motion')).animationName,
            }));
            assert.equal(seat.poseDisplay, 'none', 'seated companions retain their upright body');
            assert.notEqual(seat.bodyDisplay, 'none');
            assert.equal(seat.growthMotion, 'none', 'sitting companions cannot hop away from the sofa');
            const seatGeometry = await furnitureGeometry(page);
            assert.ok(Math.hypot(seatGeometry.point.x - seatGeometry.anchor.x, seatGeometry.point.y - seatGeometry.anchor.y) <= 2, `${kind}/${stage} foot anchor on sofa: ${JSON.stringify(seatGeometry)}`);
            assert.ok(Math.abs(seatGeometry.spriteSize - 76) < .5, `${kind}/${stage} keeps the shared sofa scale on ${width}px: ${JSON.stringify(seatGeometry)}`);
            await page.locator('.tf-device-viewport').screenshot({ path: join(output, `${width}-${kind}-${stage}-sofa.png`), animations: 'disabled' });
            checks.push({ width, kind, stage, furniture: 'sofa', ...seat, geometry: seatGeometry });
        }
        await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
        const reduced = await page.locator('.tf-pet-sprite-control[data-room-pose] .tf-room-pose-breath').evaluateAll(nodes => nodes.map(el => ({ animation: getComputedStyle(el).animationName,
            pose: el.closest('.tf-pet-sprite-control')?.dataset.roomPose, display: getComputedStyle(el.closest('.tf-room-pose-art')).display,
            parent: el.closest('.tf-pixel-avatar')?.parentElement.className })));
        assert.ok(reduced.every(({ animation }) => animation === 'none'), `reduced motion stops furniture breathing: ${JSON.stringify(reduced)}`);
        await page.close();
    }
    assert.deepEqual(errors, []);
    await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log(`PASS ${checks.length} real bed/sofa arrivals, distinct supported postures, native faces, no duplicate limbs and viewport bounds.`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
