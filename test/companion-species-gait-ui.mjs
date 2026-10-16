import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

// Isolate the visual gait from route timing; click-move-ui covers the live route.
// The real device, sprite masks, style cascade and growth art are used unchanged.
const root = process.cwd(), output = await mkdtemp(join(tmpdir(), 'forum-species-gait-'));
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
            room: createCompanionRoomPreset('cozy'), homestead: normalizeHomestead({ location: 'yard' }) });
        Object.assign(pet.life, { stage, mode: 'active', cleanliness: 80, game: null, autoSleep: false, sleepUntil: 0, awakeUntil: 0,
            roomBedId: '', growthNotice: null, lastTickAt: Date.now(), greetingDay: '2026-10-11', actionAt: {}, foodLikes: [], diary: [], milestones: [] });
        petTest.render(); petTest.stop();
        const control = document.querySelector('.tf-pet-sprite-control');
        Object.assign(control.dataset, { roamActive: 'true', roamState: 'walking', roamDirection: 'right', roamMode: 'manual' });
        delete control.dataset.idlePose;
        await Promise.all([...control.querySelectorAll('image')].map(async el => { const image = new Image(); image.src = el.getAttribute('href'); await image.decode(); }));
    }, { name, stage, color });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    assert.equal(await page.locator(`.tf-pet-sprite-control .is-kind-${kind}.is-growth-${stage}`).count(), 1);
}
async function phase(page, fraction) {
    return page.locator('.tf-pet-sprite-control').evaluate((control, fraction) => {
        for (const a of control.getAnimations({ subtree: true })) {
            a.pause(); a.currentTime = Number(a.effect.getTiming().duration) * fraction;
        }
        const avatar = control.querySelector(':scope > .tf-pixel-avatar'), box = control.getBoundingClientRect();
        const style = getComputedStyle(avatar);
        return { x: box.x, y: box.y, gait: style.animationName, translate: style.translate, transform: style.transform,
            parts: [...control.querySelectorAll('.tf-pixel-character :is(.tf-raster-frame.is-idle .tf-raster-part,.tf-pixel-tail,.tf-pixel-legs,.tf-octopus-arm,.tf-rabbit-ear,.tf-betta-fin)')].map(el => ({
                part: el.dataset.part || el.classList.value, animation: getComputedStyle(el).animationName,
                delay: getComputedStyle(el).animationDelay, transform: getComputedStyle(el).transform,
            })),
        };
    }, fraction);
}
async function aquaticGait(page) {
    return page.locator('.tf-pet-sprite-control').evaluate(control => {
        const rect = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        return { stage: rect(control.closest('.tf-pet-stage')), control: rect(control),
            scale: getComputedStyle(control.querySelector(':scope > .tf-pixel-avatar')).scale,
            tanks: document.querySelectorAll('.tf-aquatic-back,.tf-aquatic-front,.tf-aquatic-wheel,.tf-aquatic-habitat.is-tank,.tf-aquatic-surface.is-tank').length };
    });
}
try {
    for (const width of [1280, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 320 });
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-10-11T12:00:00+08:00') });
        await page.clock.pauseAt(new Date('2026-10-11T12:00:00+08:00'));
        await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
        await page.waitForFunction(() => globalThis.petTest);
        for (const [kind, name, gait] of species) for (const stage of ['baby', 'young', 'adult']) {
            await fixture(page, kind, name, stage);
            const expected = kind === 'frog' && stage === 'baby' ? 'swim' : gait;
            const start = await phase(page, 0), mid = await phase(page, .25), end = await phase(page, .75);
            assert.equal(mid.gait, `tf-roam-${expected}`, `${kind}/${stage} uses its species gait`);
            assert.equal(start.x, mid.x, 'gait leaves route x unchanged'); assert.equal(start.y, end.y, 'gait leaves floor anchor unchanged');
            assert.notEqual(mid.transform + mid.translate, end.transform + end.translate, `${kind}/${stage} animates`);
            if (['cat', 'fox', 'penguin', 'robo-bird'].includes(kind) && stage === 'adult') {
                const left = mid.parts.find(p => p.part === 'foot-left'), right = mid.parts.find(p => p.part === 'foot-right');
                assert.ok(left && right, 'adult feet are separately articulated');
                assert.notEqual(left.delay, right.delay, 'feet step in opposite phases');
            }
            if (kind === 'octopus') {
                const arms = mid.parts.filter(p => /arm/.test(p.part));
                assert.ok(arms.length >= 3 && arms.every(p => p.animation === 'tf-roam-tentacle-plant'));
                assert.ok(new Set(arms.map(p => p.delay)).size >= 3, 'tentacles plant in a travelling sequence');
            }
            if (expected === 'swim') {
                assert.ok(Math.abs(Number.parseFloat(mid.translate.split(' ')[1])) < 2, 'aquatic body makes a small swimming gesture');
                let stillScene, stillControl;
                for (const direction of ['left', 'right']) {
                    await page.locator('.tf-pet-sprite-control').evaluate((el, direction) => { el.dataset.roamDirection = direction; }, direction);
                    for (const fraction of [0, .25, .5, .75]) {
                        await phase(page, fraction);
                        const water = await aquaticGait(page);
                        stillScene ||= water.stage; stillControl ||= water.control;
                        assert.deepEqual(water.stage, stillScene, 'swimming and turning do not transform the scene');
                        assert.deepEqual(water.control, stillControl, 'swimming does not displace the click target');
                        assert.equal(Number.parseFloat(water.scale), direction === 'left' ? 1 : -1, 'aquatic face turns toward travel');
                        assert.equal(water.tanks, 0, 'the animal has no tank or wheels');
                    }
                }
            }
            if (width === 320 && stage === 'adult') await page.locator('.tf-device-viewport').screenshot({ path: join(output, `320-${kind}-mid.png`), animations: 'allow' });
            await page.locator('.tf-pet-sprite-control').evaluate(el => { el.dataset.roamPhase = 'turn'; });
            const turning = await phase(page, .25);
            assert.equal(turning.gait, 'none', 'a turn settles the body before travelling again');
            assert.ok(turning.parts.every(p => p.animation === 'none'), 'feet, fins and tentacles pause during a turn');
            await page.locator('.tf-pet-sprite-control').evaluate(el => { el.dataset.roamPhase = 'cruise'; });
            assert.equal((await phase(page, .25)).gait, `tf-roam-${expected}`, 'walking resumes after the turn');
            assert.ok(await page.locator('.tf-view').evaluate(el => el.scrollWidth <= el.clientWidth + 2), 'small viewport fits');
            if (width === 1280) {
                await page.locator('.tf-device-viewport').screenshot({ path: join(output, `${kind}-${stage}-mid.png`), animations: 'allow' });
                if (stage === 'adult' && ['cat', 'fox', 'penguin', 'robo-bird'].includes(kind)) {
                    await page.addStyleTag({ content: '#tavern-forum-root .tf-pet-sprite-control { --pet-sprite-size: 240px !important; }' });
                    await phase(page, 0);
                    await page.locator('.tf-pet-sprite-control').screenshot({ path: join(output, `${kind}-feet-neutral.png`), animations: 'allow' });
                    await phase(page, .25);
                    await page.locator('.tf-pet-sprite-control').screenshot({ path: join(output, `${kind}-feet-step.png`), animations: 'allow' });
                    await page.locator('style').last().evaluate(el => el.remove());
                }
            }
            await page.locator('.tf-pet-sprite-control').evaluate(el => { el.dataset.roamState = 'idle'; });
            const restored = await phase(page, .25);
            assert.ok(!restored.gait.startsWith('tf-roam-'), 'standing restores idle body');
            assert.ok(!restored.parts.some(p => p.animation.startsWith('tf-roam-')), 'standing restores idle limbs');
            // A stale walking attribute must never restart gait during work/care/rest.
            for (const blocked of ['workPose', 'homesteadMotion', 'fishingPhase', 'roomPose', 'idlePose']) {
                await page.locator('.tf-pet-sprite-control').evaluate((el, field) => { el.dataset.roamState = 'walking'; el.dataset[field] = 'test'; }, blocked);
                assert.ok(!(await phase(page, .25)).gait.startsWith('tf-roam-'), blocked + ' excludes locomotion');
                await page.locator('.tf-pet-sprite-control').evaluate((el, field) => { delete el.dataset[field]; }, blocked);
            }
            checks.push({ width, kind, stage, expected, mid, end });
        }
        for (const [kind, name] of species.filter(([k]) => ['cat', 'fox', 'penguin', 'robo-bird'].includes(k))) {
            await fixture(page, kind, name, 'adult', '#8fadd3'); await phase(page, .25);
            const tint = await page.locator('.tf-pet-sprite-control .tf-raster-frame.is-idle [data-part="foot-left"] .tf-animal-tint-body').first().evaluate(el => ({ display: getComputedStyle(el).display, opacity: getComputedStyle(el).opacity, filter: el.getAttribute('filter') }));
            assert.notEqual(tint.display, 'none'); assert.notEqual(tint.opacity, '0'); assert.ok(tint.filter.includes('body'));
            if (width === 1280) await page.locator('.tf-device-viewport').screenshot({ path: join(output, `${kind}-custom-color.png`), animations: 'allow' });
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        for (const [kind, name] of species) {
            await fixture(page, kind, name, 'adult');
            const reduced = await phase(page, .3);
            assert.equal(reduced.gait, 'none'); assert.ok(reduced.parts.every(p => p.animation === 'none'), 'reduced motion suppresses every gait limb');
        }
        await page.close();
    }
    assert.deepEqual(errors, []);
    await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log(`PASS: ${checks.length} species/growth/viewport gaits, anchors, opposite feet, tentacle phases, idle/work exclusions, custom colors and reduced motion.`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
