import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { openCompanionMenu } from './companion-navigation.mjs';

// Keep generated screenshots outside the repository and exercise the real preview UI.
const root = resolve('.');
const output = await mkdtemp(join(tmpdir(), 'forum-frog-sprite-ui-'));
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render, renderPixelCompanion };');
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [];
const mainSprite = '.tf-pet-sprite-control > .tf-pixel-avatar > .tf-pixel-pet';
const mainRaster = mainSprite + ' .tf-frog-raster';

async function open(width = 1280) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 600 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings();
        settings.modules.travel.enabled = true;
        settings.ui.activeTab = 'services';
        petTest.viewState.worldPage = 'travel';
        petTest.viewState.companionPanel = 'home';
        petTest.viewState.companionVisualAction = '';
        const pet = getForumData().world.companion;
        Object.assign(pet, { species: '青蛙', status: 'home', satiety: 40, happiness: 65, energy: 80, bodyColor: '', accentColor: '', accessory: 'none' });
        Object.assign(pet.life, { stage: 'adult', cleanliness: 85, autoSleep: false, sleepUntil: 0, awakeUntil: 0, mode: 'active', growthNotice: null });
        globalThis.petCalls = 0;
        SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
        petTest.render();
    });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    await page.locator(mainRaster).waitFor();
    return page;
}

// Read effective visibility, including ancestor opacity. SVG bounding boxes alone
// include hidden frames, so they cannot detect blank or overlapping expressions.
async function sampleFrames(page, selector = mainRaster, duration = 0) {
    return page.evaluate(async ({ selector, duration }) => {
        const samples = [], start = performance.now();
        function read() {
            const root = document.querySelector(selector);
            if (!root) throw Error('Missing sprite: ' + selector);
            const visible = [...root.querySelectorAll('.tf-raster-frame')].filter(frame => {
                let opacity = 1;
                for (let node = frame; node; node = node.parentElement) {
                    const style = getComputedStyle(node);
                    if (style.display === 'none' || style.visibility === 'hidden') return false;
                    opacity *= Number(style.opacity);
                }
                return opacity > .05;
            }).map(frame => [...frame.classList].find(name => /^is-(idle|happy|feed|sleep)$/.test(name)));
            const body = root.closest('.tf-pixel-body-rig');
            samples.push({ elapsed: Math.round(performance.now() - start), visible, transform: body ? getComputedStyle(body).transform : null });
        }
        read();
        while (performance.now() - start < duration) { await new Promise(requestAnimationFrame); read(); }
        return samples;
    }, { selector, duration });
}

function assertOneFrame(samples, label, expected) {
    const bad = samples.filter(sample => sample.visible.length !== 1);
    assert.deepEqual(bad.slice(0, 8), [], `${label}: every sampled instant must show exactly one full frame`);
    if (expected) assert.ok(samples.some(sample => sample.visible[0] === 'is-' + expected), `${label}: ${expected} frame was never visible`);
}

async function clearAction(page) {
    await page.evaluate(async () => {
        clearTimeout(petTest.viewState.companionActionTimer);
        petTest.viewState.companionActionTimer = 0;
        petTest.viewState.companionVisualAction = '';
        petTest.viewState.companionPanel = 'home';
        petTest.viewState.companionFoodMenuOpen = false;
        const pet = (await import('/src/store.js')).getForumData().world.companion;
        pet.status = 'home'; pet.life.sleepUntil = 0; pet.life.autoSleep = false;
        petTest.render();
    });
}

async function decodedDifference(page, before, after) {
    return page.evaluate(async ({ before, after }) => {
        async function pixels(uri) {
            const image = new Image(); image.src = uri; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
        }
        const a = await pixels(before), b = await pixels(after);
        if (a.width !== b.width || a.height !== b.height) throw Error('Color preview resized the sprite');
        let changed = 0;
        for (let i = 0; i < a.data.length; i += 4) {
            if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) changed++;
        }
        return changed;
    }, { before: 'data:image/png;base64,' + before.toString('base64'), after: 'data:image/png;base64,' + after.toString('base64') });
}

// Record real UI screenshots with the browser encoder, without an external ffmpeg install.
async function recordDemo(page, actions) {
    await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = innerWidth; canvas.height = innerHeight;
        const stream = canvas.captureStream(15);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
        const chunks = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        globalThis.frogRecording = { canvas, stream, recorder, chunks };
    });
    let recording = true, started = false;
    const capture = (async () => {
        while (recording) {
            const frame = await page.screenshot({ type: 'jpeg', quality: 90 });
            await page.evaluate(async ({ frame, start }) => {
                const image = new Image(); image.src = 'data:image/jpeg;base64,' + frame;
                await image.decode();
                frogRecording.canvas.getContext('2d').drawImage(image, 0, 0);
                if (start) frogRecording.recorder.start();
            }, { frame: frame.toString('base64'), start: !started });
            started = true;
            await new Promise(done => setTimeout(done, 65));
        }
    })();
    try { await actions(); } finally { recording = false; await capture; }
    const bytes = await page.evaluate(async () => {
        const { recorder, chunks, stream } = frogRecording;
        await new Promise(done => { recorder.onstop = done; recorder.stop(); });
        stream.getTracks().forEach(track => track.stop());
        const bytes = [...new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer())];
        delete globalThis.frogRecording;
        return bytes;
    });
    assert.ok(bytes.length > 1000, 'Recorded demonstration is empty');
    const path = join(output, 'frog-in-game.webm');
    await writeFile(path, Buffer.from(bytes));
    console.log('Video:', path);
}

try {
    const page = await open();
    const asset = await page.locator(mainRaster).evaluate(async raster => {
        const frames = [...raster.querySelectorAll('.tf-raster-frame')];
        const sources = frames.map(frame => frame.querySelector('.tf-frog-source image'));
        const urls = sources.map(source => source?.getAttribute('href') || source?.getAttribute('xlink:href'));
        const decoded = await Promise.all([...new Set(urls)].map(async href => {
            if (!href) throw Error('A frame has no source image');
            const image = new Image(); image.src = new URL(href, location.href).href; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const data = context.getImageData(0, 0, image.width, image.height).data;
            let transparent = 0, opaque = 0;
            for (let i = 3; i < data.length; i += 4) { if (data[i] === 0) transparent++; if (data[i] > 240) opaque++; }
            return { url: image.src, width: image.width, height: image.height, transparent, opaque };
        }));
        return { decoded, crops: frames.map(frame => {
            const viewport = frame.matches('svg[viewBox]') ? frame : frame.querySelector('svg[viewBox]');
            const box = viewport?.viewBox.baseVal;
            const style = viewport && getComputedStyle(viewport);
            return box && { x: box.x, y: box.y, width: box.width, height: box.height, viewportWidth: Number(viewport.getAttribute('width')), viewportHeight: Number(viewport.getAttribute('height')), cssWidth: parseFloat(style.width), cssHeight: parseFloat(style.height), overflow: style.overflow };
        }) };
    });
    assert.equal(asset.decoded.length, 1, 'All frames should crop the same sheet');
    assert.match(asset.decoded[0].url, /assets\/companions\/frog-pixel-a-v1\.png/);
    assert.ok(asset.decoded[0].width > 0 && asset.decoded[0].height > 0);
    assert.ok(asset.decoded[0].transparent > 0 && asset.decoded[0].opaque > 0, 'The sheet must contain a real transparent silhouette');
    assert.equal(asset.crops.length, 4);
    assert.ok(asset.crops.every(crop => crop?.width > 0 && crop?.height > 0));
    assert.equal(new Set(asset.crops.map(crop => `${crop.width},${crop.height}`)).size, 1, 'Frame crop dimensions differ');
    assert.equal(new Set(asset.crops.map(crop => `${crop.x},${crop.y}`)).size, 4, 'Frame crops repeat');
    for (const crop of asset.crops) {
        assert.equal(crop.cssWidth, crop.viewportWidth, 'Generic SVG width styles resize a frame viewport');
        assert.equal(crop.cssHeight, crop.viewportHeight, 'Generic SVG height styles resize a frame viewport');
        assert.equal(crop.overflow, 'hidden', 'A frame can leak neighboring atlas cells');
    }
    assertOneFrame(await sampleFrames(page), 'idle');
    await page.screenshot({ path: join(output, 'home-desktop.png'), animations: 'disabled' });
    console.log('PASS transparent sheet decodes and four equal, distinct crops load');

    const idle = await sampleFrames(page, mainRaster, 6000);
    assertOneFrame(idle, 'continuous idle', 'idle');
    assertOneFrame(idle, 'idle blink', 'sleep');
    assert.ok(new Set(idle.map(sample => sample.transform)).size > 20, 'Idle body does not breathe continuously');
    await page.evaluate(async () => {
        (await import('/src/store.js')).getForumData().world.companion.life.mode = 'paused';
        petTest.render();
    });
    const paused = await sampleFrames(page, mainRaster, 500);
    assertOneFrame(paused, 'paused');
    assert.equal(new Set(paused.map(sample => sample.transform)).size, 1, 'Paused body still moves');
    assert.equal(new Set(paused.map(sample => sample.visible.join(','))).size, 1, 'Paused expression still changes');
    await page.evaluate(async () => {
        (await import('/src/store.js')).getForumData().world.companion.life.mode = 'active';
        petTest.render();
    });
    console.log('PASS continuous breathing, complete blink cycle and pause freeze');

    await page.locator('.tf-pet-sprite-control').click();
    await page.locator('.tf-companion-v4.is-action-pet').waitFor();
    assertOneFrame(await sampleFrames(page, mainRaster, 2450), 'pet', 'happy');
    await clearAction(page);
    await openCompanionMenu(page, 'feed');
    await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
    await page.locator('.tf-companion-v4.is-action-feed').waitFor();
    const feeding = await sampleFrames(page, mainRaster, 2750);
    assertOneFrame(feeding, 'feed', 'feed');
    assertOneFrame(feeding, 'feed satisfaction', 'happy');
    await clearAction(page);
    await page.evaluate(async () => {
        const pet = (await import('/src/store.js')).getForumData().world.companion;
        pet.life.sleepUntil = Date.now() + 60000;
        petTest.viewState.companionVisualAction = 'feed';
        petTest.render();
    });
    await page.locator('.tf-companion-v4.is-living-sleep').waitFor();
    const sleeping = await sampleFrames(page, mainRaster, 350);
    assertOneFrame(sleeping, 'sleep priority', 'sleep');
    assert.ok(sleeping.every(sample => sample.visible[0] === 'is-sleep'), 'Active feed overrides sleep');
    await page.screenshot({ path: join(output, 'sleep-desktop.png'), animations: 'disabled' });
    console.log('PASS pet/feed action timelines never blank or overlap; sleeping has priority');

    await clearAction(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assertOneFrame(await sampleFrames(page, mainRaster, 200), 'reduced motion idle', 'idle');
    const reducedAnimations = await page.locator(mainRaster + ' .tf-raster-frame').evaluateAll(frames => frames.map(frame => getComputedStyle(frame).animationName));
    assert.ok(reducedAnimations.every(name => name === 'none'), 'Reduced motion still animates frame changes');
    await page.evaluate(() => { petTest.viewState.companionVisualAction = 'feed'; petTest.render(); });
    assertOneFrame(await sampleFrames(page, mainRaster, 150), 'reduced motion feed', 'feed');
    await clearAction(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
        const fixture = document.createElement('section'); fixture.id = 'frog-static-check';
        fixture.style.cssText = 'position:fixed;z-index:2147483647;left:12px;bottom:12px;display:flex;background:#fff8ee;padding:12px;gap:10px';
        fixture.innerHTML = '<div class="tf-growth-photo">' + petTest.renderPixelCompanion('青蛙', 'home', true, { life: { stage: 'adult' } }) + '</div><div class="mini-resting">' + petTest.renderPixelCompanion('青蛙', 'resting', true, { life: { stage: 'adult' } }) + '</div>';
        document.querySelector('#tavern-forum-root').append(fixture);
    });
    assertOneFrame(await sampleFrames(page, '#frog-static-check .tf-growth-photo .tf-frog-raster'), 'static album', 'idle');
    assertOneFrame(await sampleFrames(page, '#frog-static-check .mini-resting .tf-frog-raster'), 'resting mini', 'sleep');
    await page.locator('#frog-static-check').screenshot({ path: join(output, 'static-and-resting-mini.png') });
    await page.evaluate(() => document.querySelector('#frog-static-check').remove());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    console.log('PASS reduced motion, static album and resting mini select usable frames');

    // Pixel comparison catches the failure where CSS variables persist but PNG colors do not change.
    // Freeze unrelated effects/backgrounds so only the color change contributes to the comparison.
    await page.addStyleTag({ content: '#tavern-forum-root .tf-pet-stage * { animation: none !important; transition: none !important; }' });
    const original = await page.locator(mainSprite).screenshot({ path: join(output, 'color-original.png') });
    await page.locator(mainSprite).evaluate(sprite => sprite.style.setProperty('--pet-body-user', '#8d48bd'));
    const body = await page.locator(mainSprite).screenshot({ path: join(output, 'color-body.png') });
    const changedBody = await decodedDifference(page, original, body);
    assert.ok(changedBody > 30, `Body control changed only ${changedBody} pixels`);
    await page.locator(mainSprite).evaluate(sprite => { sprite.style.removeProperty('--pet-body-user'); sprite.style.setProperty('--pet-accent-user', '#338bdd'); });
    const accent = await page.locator(mainSprite).screenshot({ path: join(output, 'color-accent.png') });
    const changedAccent = await decodedDifference(page, original, accent);
    assert.ok(changedAccent > 10, `Accent control changed only ${changedAccent} pixels`);
    await page.locator(mainSprite).evaluate(sprite => sprite.style.removeProperty('--pet-accent-user'));
    const reset = await page.locator(mainSprite).screenshot();
    assert.equal(await decodedDifference(page, original, reset), 0, 'Clearing color overrides does not restore the original pixels');
    console.log(`PASS independent color variables visibly recolor the sprite and reset (${changedBody} body / ${changedAccent} accent pixels)`);

    for (const accessory of ['crown', 'glasses', 'scarf']) {
        await page.evaluate(async accessory => {
            (await import('/src/store.js')).getForumData().world.companion.accessory = accessory;
            petTest.render();
        }, accessory);
        assertOneFrame(await sampleFrames(page), accessory);
        assert.ok(await page.locator(mainSprite + ` [data-accessory="${accessory}"]`).count() > 0);
        await page.screenshot({ path: join(output, `accessory-${accessory}-desktop.png`), animations: 'disabled' });
    }
    assert.equal(await page.evaluate(() => petCalls), 0);
    await page.close();

    for (const width of [390, 320]) {
        const mobile = await open(width);
        await mobile.emulateMedia({ reducedMotion: 'reduce' });
        assertOneFrame(await sampleFrames(mobile), `${width}px screen`, 'idle');
        assert.equal(await mobile.locator('.tf-view').evaluate(view => view.scrollWidth > view.clientWidth + 1), false, `${width}px view overflows`);
        const sprite = await mobile.locator(mainSprite).boundingBox(), screen = await mobile.locator('.tf-pet-screen').boundingBox();
        assert.ok(sprite && screen && sprite.x >= screen.x - 1 && sprite.x + sprite.width <= screen.x + screen.width + 1, `${width}px sprite clips outside the screen`);
        await mobile.screenshot({ path: join(output, `home-${width}.png`), animations: 'disabled' });
        assert.equal(await mobile.evaluate(() => petCalls), 0);
        await mobile.close();
    }
    console.log('PASS desktop and 390/320px screens; crown, glasses and scarf snapshots saved');
    if (process.env.FORUM_RECORD_VIDEO === '1') {
        const demo = await open(390);
        await recordDemo(demo, async () => {
            await sampleFrames(demo, mainRaster, 5900);
            await demo.locator('.tf-pet-sprite-control').click();
            await sampleFrames(demo, mainRaster, 2450);
            await clearAction(demo);
            await openCompanionMenu(demo, 'feed');
            await demo.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
            await sampleFrames(demo, mainRaster, 2800);
            await clearAction(demo);
            await openCompanionMenu(demo, 'rest');
            await sampleFrames(demo, mainRaster, 3000);
        });
        await demo.close();
    }
    assert.deepEqual(errors, []);
    console.log('Screenshots:', output);
} finally {
    await browser.close();
    await new Promise(done => server.close(done));
}
