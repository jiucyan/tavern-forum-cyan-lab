import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

// Real delegated input + a controlled clock: body/tool snapshots cannot mask an
// early inventory commit, drifting floor anchor, or leftover work after cancel.
const root = process.cwd(), output = await mkdtemp(join(tmpdir(), 'forum-work-pose-'));
console.log('ARTIFACTS', output);
const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body.toString()
            .replace('companionRoamController ||= createCompanionRoamController({', 'companionRoamController ||= createCompanionRoamController({ random: () => .8,')
            + '\nglobalThis.petTest={viewState,render,closeForum,cancelHomesteadMotion,stopFishingDisplay,resetRoam(){companionRoamController?.destroy();companionRoamController=null;}};');
        res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], checks = [];
const species = [
    ['frog', '青蛙'], ['cat', '黑猫'], ['rabbit', '垂耳兔'], ['fox', '赤狐'], ['penguin', '小企鹅'],
    ['robo-bird', '机械鸟'], ['octopus', '小章鱼'], ['goldfish', '斗鱼'], ['soot', '煤球'],
];
const specimens = species.map(([kind, name]) => ({ kind, name, stage: 'adult' }));
for (const [kind, name] of species) for (const stage of ['baby', 'young']) specimens.push({ kind, name, stage });

async function fixture(page, specimen, location = 'kitchen') {
    await page.evaluate(async ({ specimen, location }) => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { createCompanionRoomPreset } = await import('/src/companion-room.js');
        const { normalizeHomestead, ensureHomesteadStarter, addPetItem } = await import('/src/companion-homestead.js');
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
        data.world.inventory = []; data.world.trips = [];
        pet.homestead = normalizeHomestead({ location, visited: ['home', 'yard', 'forest', 'river', 'kitchen'] });
        Object.assign(pet, { name: '团子', species: specimen.name, status: 'home', satiety: 45, happiness: 70, energy: 80, bond: 5,
            habitat: 'meadow', lastInteractionAt: 0, lastAction: '', deviceSkin: 'classic', avatarUrl: '', accessory: 'none',
            bodyColor: '', accentColor: '', weather: 'sunny', timeOfDay: 'day', message: '', packedItemIds: [], carrying: '', room: createCompanionRoomPreset('cozy') });
        Object.assign(pet.life, { stage: specimen.stage, mode: 'active', cleanliness: 70, game: null, autoSleep: false, sleepUntil: 0, awakeUntil: 0,
            roomBedId: '', growthNotice: null, lastTickAt: Date.now(), greetingDay: '2026-10-5', actionAt: {}, foodLikes: [], diary: [], milestones: [] });
        ensureHomesteadStarter(data); addPetItem(data, 'carrot', 2); addPetItem(data, 'turnip', 2);
        petTest.resetRoam(); petTest.render();
    }, { specimen, location });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded(); await page.clock.runFor(50);
    await page.evaluate(async () => Promise.all([...document.querySelectorAll('.tf-pet-sprite-control image')].map(async el => {
        const img = new Image(); img.src = el.getAttribute('href'); await img.decode();
    })));
    assert.equal(await page.locator(`.tf-pet-sprite-control .is-growth-${specimen.stage}`).count(), 1, 'requested growth silhouette renders');
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
async function click(page, selector) {
    const button = page.locator(selector).last();
    if (page.viewportSize().width === 320) await button.tap(); else await button.click();
}
async function target(page, id) {
    await click(page, `[data-action="homestead-target"][data-target="${id}"]`);
    await until(page, () => !petTest.viewState.companionHomesteadCommand && !petTest.viewState.companionHomesteadBusy, 'arrival ' + id);
}
async function startCook(page) {
    await click(page, '[data-homestead-action="cook"][data-recipe-id="vegetable-soup"]');
    await until(page, () => !!petTest.viewState.companionHomesteadMotion, 'cook started');
    assert.equal(await page.locator('.tf-pet-sprite-control').getAttribute('data-homestead-motion'), 'cook');
}
async function inventory(page) { return page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world.inventory)); }
async function count(page, id) { return page.evaluate(async id => (await import('/src/companion-homestead.js')).getPetItemCount((await import('/src/store.js')).getForumData(), id), id); }
async function floorAnchor(page) { return page.locator('.tf-pet-sprite-control').evaluate(el => {
    const b = el.getBoundingClientRect(), room = el.closest('.tf-pet-stage').getBoundingClientRect();
    return { x: (b.x + b.width / 2 - room.left) * 320 / room.width, y: (b.bottom - room.top) * 240 / room.height };
}); }
async function sameAnchor(page, before, label) {
    const after = await floorAnchor(page);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 2, `${label}: ${JSON.stringify({ before, after })}`);
}
async function atFraction(page, fraction) {
    const delta = await page.evaluate(fraction => {
        const m = petTest.viewState.companionHomesteadMotion;
        return Math.max(0, Math.floor(m.duration * fraction) - (Date.now() - m.startedAt));
    }, fraction);
    await page.clock.runFor(delta);
}
async function capture(page, name) {
    const snapshot = await page.locator('.tf-pet-sprite-control').evaluate(el => {
        const avatar = el.querySelector(':scope > .tf-pixel-avatar');
        const room = el.closest('.tf-pet-stage'), b = room.getBoundingClientRect();
        const view = document.querySelector('.tf-view');
        return { attributes: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])),
            avatarTransform: avatar ? getComputedStyle(avatar).transform : '',
            avatarTranslate: avatar ? getComputedStyle(avatar).translate : '',
            avatarScale: avatar ? getComputedStyle(avatar).scale : '',
            addedAnatomy: el.querySelectorAll('[data-work-arm],[data-work-second-wing],[data-work-second-grip],[data-work-grip-shape],[data-work-stool],[data-work-support-stand],[data-work-helper-cog],[data-work-joint]').length,
            playerOperated: el.querySelector('.tf-work-pose-art')?.dataset.playerOperated,
            hiddenAnatomy: [...el.querySelectorAll('.tf-raster-part,.tf-penguin-wing,.tf-robo-wing,.tf-octopus-arm')].filter(part => part.style.visibility === 'hidden').length,
            carriedWater: el.querySelectorAll('.tf-aquatic-back,.tf-aquatic-front,.tf-aquatic-wheel').length,
            bodyY: parseFloat(avatar?.style.getPropertyValue('--tf-work-y')) || 0,
            room: { w: b.width, h: b.height }, viewportOverflow: view.scrollWidth - view.clientWidth,
            animated: el.getAnimations({ subtree: true }).map(a => ({ name: a.animationName || '', state: a.playState })),
            skeletalAnimations: [...el.querySelectorAll('.tf-raster-part,.tf-pixel-body-rig,.tf-pixel-growth-motion,.tf-pixel-ears,.tf-pixel-wings,.tf-pixel-tentacles,.tf-pixel-fins,.tf-pixel-tail,.tf-rabbit-ear,.tf-penguin-wing,.tf-robo-wing,.tf-octopus-arm,.tf-betta-fin')]
                .flatMap(part => part.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || 'unnamed')),
            contact: (() => {
                const tool = el.querySelector('[data-work-tool]');
                if (!tool || !tool.getAttribute('d')) return null;
                const p = tool.getPointAtLength(0), point = new DOMPoint(p.x, p.y).matrixTransform(tool.getScreenCTM());
                return { tool: { x: point.x, y: point.y }, opacity: Number(tool.getAttribute('opacity')), progress: Number(el.dataset.workProgress), phase: el.dataset.workPhase };
            })(),
        };
    });
    assert.ok(snapshot.viewportOverflow <= 2, name + ' fits viewport');
    assert.ok(snapshot.contact, name + ' shared pose/tool geometry exists');
    assert.equal(snapshot.addedAnatomy, 0, name + ' no invented limbs or artificial platform');
    assert.equal(snapshot.hiddenAnatomy, 0, name + ' original anatomy remains visible');
    assert.equal(snapshot.playerOperated, 'true', name + ' tool belongs to player activity');
    assert.equal(snapshot.bodyY, 0, name + ' companion stays at its native floor/water height');
    assert.deepEqual(snapshot.skeletalAnimations, [], name + ' skeleton shares the action clock without a second CSS animation');
    await page.locator('.tf-device-viewport').screenshot({ path: join(output, name + '.png'), animations: 'allow' });
    return snapshot;
}
function assertSpecies(snapshot, specimen, action, label) {
    const aquatic = specimen.kind === 'goldfish' || specimen.kind === 'frog' && specimen.stage === 'baby';
    assert.equal(snapshot.attributes['data-work-kind'], specimen.kind, label + ' uses matching anatomy');
    assert.ok(snapshot.attributes['data-work-behavior'], label + ' has a species movement profile');
    assert.equal(snapshot.attributes['data-work-support'], aquatic ? 'water' : 'ground', label + ' preserves native resting support');
    assert.equal(snapshot.carriedWater, 0, label + ' never carries a tank or wheels');

}
async function resizeContact(page, name, action) {
    const original = page.viewportSize(), changed = { ...original, width: original.width === 320 ? 390 : 320 };
    const startedAt = await page.evaluate(() => (petTest.viewState.companionHomesteadMotion || petTest.viewState.companionFishing).startedAt);
    for (const [suffix, viewport] of [['resized', changed], ['restored', original]]) {
        await page.setViewportSize(viewport); await page.clock.runFor(35);
        const contact = await page.locator('.tf-pet-sprite-control').evaluate((el, action) => {
            const room = el.closest('.tf-pet-stage').getBoundingClientRect();
            const anchor = el.querySelector(action === 'cook' ? '[data-work-pot]' : '[data-work-float]');
            const actual = new DOMPoint(0, 0).matrixTransform(anchor.getScreenCTM());
            const expected = { x: room.left + room.width * (action === 'cook' ? 218 : 264) / 320,
                y: room.top + room.height * (action === 'cook' ? 98 : 116) / 240 };
            return { dx: Math.abs(actual.x - expected.x), dy: Math.abs(actual.y - expected.y), unit: room.width / 320 };
        }, action);
        assert.ok(contact.dx < .5 && contact.dy < (action === 'cook' ? .5 : contact.unit * .8), name + ' scene contact follows ' + suffix + ': ' + JSON.stringify(contact));
        assert.equal(await page.evaluate(() => (petTest.viewState.companionHomesteadMotion || petTest.viewState.companionFishing).startedAt), startedAt, name + ' resize preserves action clock');
        await capture(page, name + '-' + suffix);
    }
}
async function finish(page) {
    await until(page, () => !petTest.viewState.companionHomesteadBusy, 'work finished');
    assert.equal(await page.locator('[data-homestead-motion]').count(), 0);
    assert.equal(await page.locator('.tf-homestead-motion-art').count(), 0);
}
async function cast(page) {
    await click(page, '[data-homestead-action="fish-cast"]');
    await until(page, () => !!petTest.viewState.companionFishing, 'cast line');
    assert.equal(await page.locator('[data-work-pose="fishing"] .tf-work-pose-art').count(), 1);
    return page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world.companion.homestead.fishing));
}
async function bite(page, line) {
    const delay = await page.evaluate(at => Math.max(0, at - Date.now() + 100), line.biteAt);
    await page.clock.runFor(delay);
    await until(page, () => document.querySelector('.tf-fishing-overlay')?.dataset.fishingPhase === 'bite', 'bite signaled');
}
async function reel(page) {
    await click(page, '.tf-fishing-overlay [data-homestead-action="fish-reel"]');
    await until(page, () => petTest.viewState.companionHomesteadMotion?.action === 'fish', 'reel started');
}
async function cancel(page) {
    await click(page, '[data-action="companion-menu-nav"][data-direction="1"]');
    await page.clock.runFor(2500);
    assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadBusy), false);
    assert.equal(await page.evaluate(() => petTest.viewState.companionHomesteadMotion), null);
    assert.equal(await page.evaluate(() => petTest.viewState.companionFishing), null);
    assert.equal(await page.locator('.tf-homestead-motion-art,.tf-fishing-rod-art,[data-homestead-motion],[data-fishing-phase],[data-work-pose]').count(), 0, 'no cancelled work art/pose survives');
}

try {
    for (const width of [1280, 320]) {
        const page = await browser.newPage({ viewport: { width, height: width === 320 ? 760 : 1000 }, hasTouch: width === 320 });
        page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-10-05T12:00:00+08:00') });
        await page.clock.pauseAt(new Date('2026-10-05T12:00:00+08:00'));
        await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`); await page.waitForFunction(() => globalThis.petTest);
        const requestedSpecies = process.argv.find(arg => arg.startsWith('--species='))?.slice('--species='.length).split(',');
        const selection = requestedSpecies ? specimens.filter(s => requestedSpecies.includes(s.kind))
            : process.argv.includes('--quick') ? specimens.filter(s => ['cat', 'frog'].includes(s.kind) && s.stage !== 'young')
            : process.argv.includes('--extra-growth') ? specimens.filter(s => s.stage !== 'adult' && !['frog', 'cat', 'rabbit'].includes(s.kind)) : specimens;
        const stageFilter = process.argv.find(arg => arg.startsWith('--stage='))?.slice('--stage='.length);
        for (const specimen of selection.filter(s => !stageFilter || s.stage === stageFilter)) {
            const label = `${width}-${specimen.kind}-${specimen.stage}`;
            const contactFocus = specimen.kind === 'cat' && specimen.stage === 'adult'
                || specimen.kind === 'goldfish' && specimen.stage === 'adult'
                || specimen.kind === 'frog' && specimen.stage === 'baby'
                || specimen.kind === 'octopus' && specimen.stage === 'adult';
            await fixture(page, specimen); await target(page, 'stove');
            const before = await inventory(page), anchor = await floorAnchor(page), soupCount = await count(page, 'vegetable-soup');
            await startCook(page); const frames = [];
            const phases = specimen.stage === 'adult' || specimen.kind === 'frog' && specimen.stage === 'baby'
                ? [['prepare', .03], ['work', .45], ['serve', .79], ['settle', .9], ['returned', .995]]
                : [['work', .45], ['returned', .995]];
            for (const [phase, fraction] of phases) {
                await atFraction(page, fraction);
                await sameAnchor(page, anchor, label + ' ' + phase + ' floor anchor');
                assert.deepEqual(await inventory(page), before, label + ' no ingredients committed during ' + phase);
                const frame = await capture(page, `${label}-cook-${phase}`);
                assertSpecies(frame, specimen, 'cook', label);
                assert.equal(frame.contact.phase, phase === 'returned' ? 'settle' : phase, label + ' phase follows shared clock');
                assert.ok(Math.abs(frame.contact.progress - fraction) < .015, label + ' pose follows action clock');
                if (phase === 'returned') {
                    const y = await page.locator('.tf-pet-sprite-control > .tf-pixel-avatar').evaluate(el => Math.abs(parseFloat(getComputedStyle(el).translate.split(' ')[1]) || 0));
                    assert.ok(y < 1.5, label + ' feet return to floor before commit');
                    assert.ok(frame.contact.opacity < .01, label + ' tool put down before commit');
                }
                frames.push({ phase, fraction, ...frame });
                if (phase === 'work' && contactFocus) {
                    await page.evaluate(() => petTest.render());
                    const resumed = await capture(page, `${label}-cook-rerender`);
                    assert.ok(Math.abs(resumed.contact.progress - frame.contact.progress) < .01, label + ' rerender keeps action progress');
                    assert.ok(Math.hypot(resumed.contact.tool.x - frame.contact.tool.x, resumed.contact.tool.y - frame.contact.tool.y) < 1, label + ' rerender keeps tool in the scene');
                    await sameAnchor(page, anchor, label + ' rerender keeps floor anchor');
                    assert.deepEqual(await inventory(page), before, label + ' rerender does not commit ingredients');
                    if (!process.argv.includes('--no-resize')) await resizeContact(page, label + '-cook', 'cook');
                    assert.deepEqual(await inventory(page), before, label + ' resize does not commit ingredients');
                }
            }
            await finish(page); assert.equal(await count(page, 'vegetable-soup'), soupCount + 1, label + ' dish committed once');

            await fixture(page, specimen, 'river'); await target(page, 'fishing');
            const riverAnchor = await floorAnchor(page), beforeFish = await inventory(page), line = await cast(page);
            if (specimen.stage === 'adult' || specimen.kind === 'frog' && specimen.stage === 'baby') {
                await page.clock.runFor(300);
                const casting = await capture(page, `${label}-fishing-cast`);
                assert.equal(casting.contact.phase, 'cast', label + ' cast has a distinct preparatory pose');
                frames.push({ phase: 'cast', ...casting });
            }
            await page.clock.runFor(1000); await sameAnchor(page, riverAnchor, label + ' waiting floor anchor');
            const waiting = await capture(page, `${label}-fishing-wait`);
            assertSpecies(waiting, specimen, 'fishing', label);
            assert.equal(waiting.contact.phase, 'wait', label + ' cast settles into waiting');
            frames.push({ phase: 'waiting', ...waiting });
            if (contactFocus && !process.argv.includes('--no-resize')) await resizeContact(page, label + '-fishing', 'fishing');
            assert.deepEqual(await inventory(page), beforeFish, 'waiting awards nothing');
            await bite(page, line);
            const biting = await capture(page, `${label}-fishing-bite`);
            assert.equal(biting.contact.phase, 'bite', label + ' bite affects the scene rod');
            frames.push({ phase: 'bite', ...biting });
            const fishCount = await count(page, line.fishId); await reel(page); await atFraction(page, .5);
            await sameAnchor(page, riverAnchor, label + ' reeling floor anchor');
            assert.deepEqual(await inventory(page), beforeFish, 'reeling awards nothing before completion');
            const reeling = await capture(page, `${label}-fishing-reel`);
            assertSpecies(reeling, specimen, 'fish', label);
            frames.push({ phase: 'reel', ...reeling });
            await finish(page); assert.equal(await count(page, line.fishId), fishCount + 1, label + ' catch committed once');
            checks.push({ label, frames }); console.log('PASS', label, 'cook enter/work/leave, fishing wait/bite/reel');
        }

        const cat = specimens.find(s => s.kind === 'cat');
        await fixture(page, cat); await target(page, 'stove'); const kept = await inventory(page);
        await startCook(page); await atFraction(page, .5); await cancel(page);
        assert.deepEqual(await inventory(page), kept, 'cancel cook keeps ingredients');
        await fixture(page, cat, 'river'); await target(page, 'fishing'); const keptFish = await inventory(page);
        const cancelledLine = await cast(page); await bite(page, cancelledLine); await reel(page); await atFraction(page, .5); await cancel(page);
        assert.deepEqual(await inventory(page), keptFish, 'cancel reel awards no fish');

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await fixture(page, cat); await target(page, 'stove'); const quietBefore = await inventory(page);
        await startCook(page);
        const quiet = await capture(page, `${width}-reduced-cook`);
        assert.ok(quiet.animated.every(a => a.state !== 'running'), 'reduced motion has no running character/tool animations');
        assert.deepEqual(await inventory(page), quietBefore, 'reduced motion keeps inventory until completion');
        await finish(page);
        await fixture(page, cat, 'river'); await target(page, 'fishing'); const quietLine = await cast(page); await page.clock.runFor(1000);
        const quietFishing = await capture(page, `${width}-reduced-fishing`);
        assert.ok(quietFishing.animated.every(a => a.state !== 'running'), 'reduced fishing has no running character/tool animations');
        await bite(page, quietLine); const quietFishBefore = await inventory(page), quietFishCount = await count(page, quietLine.fishId);
        await reel(page);
        const quietReel = await capture(page, `${width}-reduced-reel`);
        assert.equal(quietReel.contact.phase, 'catch', 'reduced reel shows a readable caught-fish pose');
        assert.ok(quietReel.contact.opacity > .99, 'reduced reel retains visible rod');
        assert.ok(Number(await page.locator('[data-work-catch]').getAttribute('opacity')) > .99, 'reduced reel displays caught fish');
        assert.ok(quietReel.animated.every(a => a.state !== 'running'), 'reduced reel has no running character/tool animations');
        assert.deepEqual(await inventory(page), quietFishBefore, 'reduced reel keeps inventory until completion');
        await finish(page); assert.equal(await count(page, quietLine.fishId), quietFishCount + 1, 'reduced reel commits catch once');
        checks.push({ width, cancellation: true, reducedMotion: true, resize: !process.argv.includes('--no-resize') });
        await page.close();
    }
    assert.deepEqual(errors, []); await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log('ALL PASS', output);
} catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
        await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
        await writeFile(join(output, 'failure.html'), await page.content()).catch(() => {});
    }
    throw error;
} finally { await browser.close(); await new Promise(done => server.close(done)); }
