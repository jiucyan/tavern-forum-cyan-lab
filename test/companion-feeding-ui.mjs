import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.');
const before = process.env.FORUM_FEED_BEFORE === '1';
const baselineCss = process.env.FORUM_FEED_BASELINE_CSS;
if (before && !baselineCss) throw Error('Before mode requires FORUM_FEED_BASELINE_CSS pointing to a saved style.css.');
const output = await mkdtemp(join(tmpdir(), 'forum-feeding-ui-'));
console.log('Artifacts:', output);
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        let file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        if (before) {
            const baselineFile = resolve(dirname(baselineCss), '.' + pathname);
            if (baselineFile.startsWith(resolve(dirname(baselineCss)) + sep) && existsSync(baselineFile)) file = baselineFile;
            if (pathname === '/style.css') file = baselineCss;
        }
        let body = await readFile(file);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render };');
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [], captures = [];
const species = [['cat', '黑猫', 'fish-flake'], ['rabbit', '垂耳兔', 'berry'], ['goldfish', '斗鱼', 'fish-flake'], ['frog', '青蛙', 'bug-cookie']];
const otherSpecies = [['fox', '赤狐', 'berry'], ['penguin', '小企鹅', 'ice-fish'], ['robo-bird', '机械鸟', 'battery'], ['octopus', '小章鱼', 'melon-jelly'], ['soot', '煤球', 'honey-drop']];
const page = await browser.newPage({ viewport: { width: 960, height: 900 } });
page.on('pageerror', error => errors.push(error.message));

async function setPet(name, food, stage = 'adult') {
    await page.evaluate(async ({ name, food, stage }) => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true;
        getSettings().ui.activeTab = 'services';
        clearTimeout(petTest.viewState.companionActionTimer);
        Object.assign(petTest.viewState, { worldPage: 'travel', companionPanel: 'home', companionVisualAction: 'feed', companionActionTimer: 0, companionFoodMenuOpen: false });
        const pet = getForumData().world.companion;
        Object.assign(pet, { species: name, status: 'home', satiety: 60, happiness: 65, energy: 80, bodyColor: '', accentColor: '', accessory: 'none', lastFood: food, weather: 'clear', timeOfDay: 'day', habitat: 'meadow' });
        Object.assign(pet.life, { stage, cleanliness: 85, autoSleep: false, sleepUntil: 0, awakeUntil: 0, mode: 'active', growthNotice: null });
        petTest.render();
        await Promise.all([...new Set([...document.querySelectorAll('.tf-pet-sprite-control image')].map(image => image.getAttribute('href')))].map(async href => { const image = new Image(); image.src = href; await image.decode(); }));
    }, { name, food, stage });
    await page.locator('.tf-pet-stage').scrollIntoViewIfNeeded();
}

async function seek(ms) {
    return page.evaluate(ms => {
        for (const animation of document.querySelector('.tf-pet-stage').getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = ms; }
        const food = document.querySelector('.tf-food-offering'), sprite = document.querySelector('.tf-pet-sprite-control .tf-pixel-pet');
        const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const visible = el => getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > .05;
        const foodStates = [...food.querySelectorAll(':scope > svg > g')].filter(visible).map(el => el.getAttribute('class'));
        const frames = [...sprite.querySelectorAll('.tf-raster-frame')].filter(visible);
        const muzzle = frames[0]?.querySelector('.tf-raster-muzzle');
        return { food: box(food), sprite: box(sprite), opacity: Number(getComputedStyle(food).opacity), foodStates, muzzleTransform: muzzle ? getComputedStyle(muzzle).transform : '', visibleFrames: frames.map(frame => frame.dataset.frame) };
    }, ms);
}

try {
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    for (const [kind, name, food] of species) {
        await setPet(name, food);
        for (const ms of [400, 1000, 1400, 1900, 2400, 3100]) {
            const metrics = await seek(ms);
            const capture = await page.locator('.tf-pet-stage').screenshot({ path: join(output, `${kind}-${ms}.png`) });
            captures.push({ kind, label: `${name} · ${(ms / 1000).toFixed(2)}s`, uri: 'data:image/png;base64,' + capture.toString('base64') });
            assert.equal(metrics.visibleFrames.length, 1, `${kind}: expression overlap at ${ms}ms`);
            if (!before && ms === 1000) {
                assert.ok(metrics.food.width <= 36 && metrics.food.height <= 36, `${kind}: oversized food`);
                assert.ok(metrics.opacity > .9, `${kind}: food missing at bite`);
                assert.equal(await page.locator('.tf-food-tray').evaluate(el => getComputedStyle(el).display), 'none');
                assert.equal(await page.locator('.tf-food-crumb').first().evaluate(el => getComputedStyle(el).display), 'none');
            }
            if (!before) {
                assert.equal(metrics.visibleFrames[0], ms === 1000 || ms === 1900 || ms === 2400 ? 'feed' : ms === 3100 ? 'happy' : 'idle', `${kind}: bite expression out of sequence`);
                assert.deepEqual(metrics.foodStates, ms < 1152 ? ['tf-feed-food-whole'] : ms < 1944 ? ['tf-feed-food-bitten'] : [], `${kind}: incorrect remaining portion`);
                if (ms >= 2400) assert.equal(metrics.opacity, 0, `${kind}: food remains after swallowing`);
            }
            console.log(kind, ms, JSON.stringify(metrics));
        }
        if (!before) {
            const last = await seek(2200);
            assert.deepEqual(last.foodStates, ['tf-feed-food-last']);
            const chewA = await seek(1250), chewB = await seek(1360);
            assert.notEqual(chewA.muzzleTransform, chewB.muzzleTransform, `${kind}: mouth is static while chewing`);
        }
    }
    if (!before) {
        for (const [kind, name, food] of otherSpecies) {
            await setPet(name, food);
            const metrics = await seek(1000);
            assert.equal(metrics.visibleFrames.length, 1, `${kind}: expression overlap`);
            assert.ok(metrics.food.width <= 36 && metrics.food.height <= 36, `${kind}: oversized food`);
            await page.locator('.tf-pet-stage').screenshot({ path: join(output, `${kind}-1000.png`) });
        }
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 860 });
            for (const [kind, name, food] of [...species, ...otherSpecies]) for (const stage of ['adult', 'baby', 'young']) {
                await setPet(name, food, stage);
                const metrics = await seek(1000);
                const bounds = await page.locator('.tf-pet-stage').boundingBox();
                assert.ok(metrics.food.x >= bounds.x && metrics.food.x + metrics.food.width <= bounds.x + bounds.width, `${kind}/${stage}/${width}: food outside stage`);
                assert.ok(metrics.food.y >= metrics.sprite.y && metrics.food.y + metrics.food.height <= metrics.sprite.y + metrics.sprite.height + 5, `${kind}/${stage}/${width}: food detached from pet`);
                if (width === 390 && stage !== 'young') await page.locator('.tf-pet-stage').screenshot({ path: join(output, `${kind}-${stage}-${width}.png`) });
            }
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await setPet('黑猫', 'fish-flake');
        assert.equal(await page.locator('.tf-food-offering').evaluate(el => getComputedStyle(el).animationName), 'none');
        assert.ok(await page.locator('.tf-food-offering').evaluate(el => Number(getComputedStyle(el).opacity) > .9));
        assert.equal(await page.locator('.tf-raster-frame.is-feed .tf-raster-muzzle').first().evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.locator('.tf-pet-stage').screenshot({ path: join(output, 'reduced-motion.png') });
        for (const stage of ['baby', 'young']) {
            await setPet('垂耳兔', 'berry', stage);
            for (const selector of ['.tf-pixel-eyes-open', '.tf-pixel-mouth-feed']) assert.equal(await page.locator(`.tf-pet-sprite-control ${selector}`).evaluate(el => Number(getComputedStyle(el).opacity)), 1, `${stage}: face missing with reduced motion`);
            await page.locator('.tf-pet-stage').screenshot({ path: join(output, `reduced-motion-${stage}.png`) });
        }
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setViewportSize({ width: 960, height: 900 });
        await setPet('黑猫', 'fish-flake');
        const beforeCare = await page.evaluate(async () => {
            const pet = (await import('/src/store.js')).getForumData().world.companion;
            pet.satiety = 40; pet.life.actionAt.feed = 0; pet.life.lastTickAt = Date.now();
            pet.life.foodLikes = []; pet.life.game = null;
            Object.assign(petTest.viewState, { companionVisualAction: '', companionFeedback: null, companionFoodMenuOpen: true });
            petTest.render(); return pet.satiety;
        });
        await page.locator('[data-action="companion-feed-food"][data-food-id="fish-flake"]').click();
        await page.waitForFunction(() => document.querySelector('.tf-companion-device')?.classList.contains('is-action-feed'));
        assert.equal(await page.locator('.tf-food-offering').evaluate(el => getComputedStyle(el).animationDuration), '3.6s');
        const afterCare = await page.evaluate(async () => {
            const pet = (await import('/src/store.js')).getForumData().world.companion;
            return { satiety: pet.satiety, count: pet.life.foodLikes.find(food => food.id === 'fish-flake')?.count };
        });
        assert.ok(afterCare.satiety > beforeCare);
        assert.equal(afterCare.count, 1, 'one click must only record one meal');
        await page.waitForFunction(() => !document.querySelector('.tf-companion-device')?.classList.contains('is-action-feed'), { timeout: 5000 });
        assert.equal(await page.locator('.tf-raster-frame.is-idle .tf-raster-muzzle').first().evaluate(el => getComputedStyle(el).display), 'none', 'mouth overlay must end with the action');
        assert.equal(await page.locator('.tf-feed-drop').evaluate(el => getComputedStyle(el).display), 'none', 'food must disappear when the action finishes');
        const afterAnimation = await page.evaluate(async () => {
            const pet = (await import('/src/store.js')).getForumData().world.companion;
            Object.assign(petTest.viewState, { companionFoodMenuOpen: true, companionFeedback: null }); petTest.render(); return pet.satiety;
        });
        await page.locator('.tf-pet-food-select [data-action="companion-device-back"]').click();
        assert.equal(await page.evaluate(async () => (await import('/src/store.js')).getForumData().world.companion.satiety), afterAnimation, 'cancelling selection must not feed again');
    }
    if (!before && process.env.FORUM_FEED_RECORD === '1') {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setViewportSize({ width: 960, height: 900 });
        const videoFrames = [];
        for (const [, name, food] of species.slice(0, 3)) {
            await setPet(name, food);
            for (let frame = 0; frame <= 59; frame++) {
                await seek(frame * 1000 / 15);
                const png = await page.locator('.tf-pet-stage').screenshot();
                videoFrames.push({ uri: 'data:image/png;base64,' + png.toString('base64'), name });
            }
        }
        const recorder = await browser.newPage({ viewport: { width: 620, height: 600 } });
        await recorder.setContent('<canvas width="620" height="600"></canvas>');
        const bytes = await recorder.evaluate(async frames => {
            const canvas = document.querySelector('canvas'), context = canvas.getContext('2d');
            // Decode first, then play sampled game frames at their original 15 fps.
            const ready = await Promise.all(frames.map(async frame => { const image = new Image(); image.src = frame.uri; await image.decode(); return { image, name: frame.name }; }));
            globalThis.recorded = [];
            globalThis.recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1800000 });
            recorder.ondataavailable = event => recorded.push(event.data);
            globalThis.recordingDone = new Promise(resolve => { recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(recorded, { type: 'video/webm' }).arrayBuffer()))); });
            recorder.start();
            const started = performance.now();
            for (let index = 0; index < ready.length; index++) {
                const { image, name } = ready[index];
                context.fillStyle = '#f5f0e7'; context.fillRect(0, 0, 620, 600);
                context.fillStyle = '#423b34'; context.font = 'bold 23px system-ui'; context.fillText('旅伴 · 喂食动作', 34, 42);
                context.font = '18px system-ui'; context.fillText(name + ' · 实际游戏画面', 34, 72);
                context.imageSmoothingEnabled = false;
                context.drawImage(image, 35, 100, 550, 550 * image.height / image.width);
                await new Promise(resolve => setTimeout(resolve, Math.max(0, started + (index + 1) * 1000 / 15 - performance.now())));
            }
            recorder.stop(); return recordingDone;
        }, videoFrames);
        await writeFile(join(output, 'feeding-in-game.webm'), Buffer.from(bytes));
        await recorder.close();
    }
    await page.setViewportSize({ width: 1680, height: 1250 });
    await page.setContent('<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>body{margin:0;background:#f5f0e7;color:#423b34;font-family:system-ui;padding:24px}h1{font-size:22px;margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}figure{margin:0;background:#fffaf1;padding:9px;border-radius:10px}img{width:100%;display:block}figcaption{font-size:13px;text-align:center;padding:9px 0}</style></head><body><h1>' + (before ? '调整前' : '调整后') + ' · 实际游戏喂食过程</h1><div class="grid">' + captures.map(capture => `<figure><img src="${capture.uri}"><figcaption>${capture.label}</figcaption></figure>`).join('') + '</div></body></html>');
    await page.screenshot({ path: join(output, before ? 'feeding-before.png' : 'feeding-after.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS feeding expressions, scaled food, mobile, juvenile and reduced-motion checks');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
