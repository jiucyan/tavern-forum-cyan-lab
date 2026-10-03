import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { openCompanionMenu } from './companion-navigation.mjs';

// Render through the actual preview UI. Screenshots and recordings are kept out of the repo.
const species = [['cat', '黑猫'], ['rabbit', '垂耳兔'], ['fox', '赤狐'], ['penguin', '小企鹅'], ['robo-bird', '机械鸟'], ['octopus', '小章鱼'], ['goldfish', '斗鱼'], ['soot', '煤球']];
// Optional resume after a preview run was interrupted. Every appearance/mobile check still runs.
const completedDynamics = new Set((process.env.FORUM_RASTER_SKIP_DYNAMICS || '').split(',').filter(Boolean));
const root = resolve('.');
const output = await mkdtemp(join(tmpdir(), 'forum-animal-raster-ui-'));
console.log('Artifacts:', output);
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
const mainRaster = mainSprite + ' .tf-animal-raster';

async function setPet(page, name, options = {}) {
    await page.evaluate(async ({ name, options }) => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings();
        settings.modules.travel.enabled = true;
        settings.ui.activeTab = 'services';
        clearTimeout(petTest.viewState.companionActionTimer);
        Object.assign(petTest.viewState, { worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0, companionFoodMenuOpen: false });
        const pet = getForumData().world.companion;
        Object.assign(pet, { species: name, status: 'home', satiety: 40, happiness: 65, energy: 80, bodyColor: '', accentColor: '', accessory: 'none', ...options });
        Object.assign(pet.life, { stage: 'adult', cleanliness: 85, autoSleep: false, sleepUntil: 0, awakeUntil: 0, mode: 'active', growthNotice: null });
        petTest.render();
    }, { name, options });
    await page.locator(mainRaster).waitFor();
}

async function open(width = 1280) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 600 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(() => {
        globalThis.petCalls = 0;
        SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
    });
    await setPet(page, species[0][1]);
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    return page;
}

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
            }).map(frame => frame.dataset.frame);
            const body = root.closest('.tf-pixel-body-rig');
            samples.push({ elapsed: Math.round(performance.now() - start), visible, transform: body && getComputedStyle(body).transform });
        }
        read();
        while (performance.now() - start < duration) { await new Promise(requestAnimationFrame); read(); }
        return samples;
    }, { selector, duration });
}

function assertOneFrame(samples, label, expected) {
    assert.deepEqual(samples.filter(sample => sample.visible.length !== 1).slice(0, 8), [], `${label}: blank or overlapping expressions`);
    if (expected) assert.ok(samples.some(sample => sample.visible[0] === expected), `${label}: missing ${expected} expression`);
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
        if (a.width !== b.width || a.height !== b.height) throw Error('Color control resized the sprite');
        let changed = 0;
        for (let i = 0; i < a.data.length; i += 4) {
            if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) changed++;
        }
        return changed;
    }, { before: 'data:image/png;base64,' + before.toString('base64'), after: 'data:image/png;base64,' + after.toString('base64') });
}

async function checkAsset(page, kind) {
    const asset = await page.locator(mainRaster).evaluate(async raster => {
        const frames = [...raster.querySelectorAll('.tf-raster-frame')];
        const hrefs = frames.map(frame => frame.querySelector('image')?.getAttribute('href'));
        const decoded = await Promise.all([...new Set(hrefs)].map(async href => {
            if (!href) throw Error('Missing source image');
            const image = new Image(); image.src = new URL(href, location.href).href; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, image.width, image.height).data;
            let transparent = 0, opaque = 0;
            for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) transparent++; if (pixels[i] > 240) opaque++; }
            return { href, width: image.width, height: image.height, transparent, opaque };
        }));
        return { decoded, crops: frames.map(frame => {
            const viewport = frame.querySelector('svg[viewBox]');
            const box = viewport?.viewBox.baseVal, style = viewport && getComputedStyle(viewport);
            return box && { x: box.x, y: box.y, width: box.width, height: box.height, viewportWidth: Number(viewport.getAttribute('width')), viewportHeight: Number(viewport.getAttribute('height')), cssWidth: parseFloat(style.width), cssHeight: parseFloat(style.height), overflow: style.overflow };
        }) };
    });
    assert.equal(asset.decoded.length, 1, `${kind}: expressions must use one sheet`);
    assert.ok(asset.decoded[0].href.endsWith(`/assets/companions/${kind}-pixel-a-v1.png`));
    assert.ok(asset.decoded[0].transparent > 0 && asset.decoded[0].opaque > 0, `${kind}: no real alpha silhouette`);
    assert.equal(asset.crops.length, 4, `${kind}: not four expressions`);
    assert.equal(new Set(asset.crops.map(crop => `${crop.x},${crop.y}`)).size, 4, `${kind}: duplicate frame crops`);
    for (const crop of asset.crops) {
        assert.ok(crop.width > 0 && crop.height > 0 && crop.x >= 0 && crop.y >= 0);
        assert.ok(crop.x + crop.width <= asset.decoded[0].width && crop.y + crop.height <= asset.decoded[0].height, `${kind}: crop outside atlas`);
        assert.ok(Math.abs(crop.cssWidth - crop.viewportWidth) < .01 && Math.abs(crop.cssHeight - crop.viewportHeight) < .01, `${kind}: global SVG CSS resized a frame`);
        assert.equal(crop.overflow, 'hidden', `${kind}: neighboring cells may leak into the screen`);
    }
}

async function contactSheet(page, accessories = ['none']) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(({ species, accessories }) => {
        const fixture = document.createElement('section');
        fixture.id = 'animal-contact';
        fixture.className = 'tf-companion-v4';
        fixture.innerHTML = `<h1>${accessories.length === 1 ? '旅伴 · 成年像素形象' : '旅伴 · 配饰适配'}</h1><p>游戏实际渲染 · ${accessories.length === 1 ? '静止表情' : '眼镜 / 围巾 / 王冠'}</p><div class="contact-grid">${species.flatMap(([kind, name]) => accessories.map(accessory => `<article><div class="contact-pet">${petTest.renderPixelCompanion(name, 'home', false, { accessory, life: { stage: 'adult' } })}</div><b>${name}</b><small>${accessory === 'none' ? kind : accessory}</small></article>`)).join('')}</div>`;
        document.querySelector('#tavern-forum-root').append(fixture);
    }, { species, accessories });
    await page.addStyleTag({ content: '#tavern-forum-root{position:static!important;display:block!important;height:auto!important;overflow:visible!important}#tavern-forum-root>:not(#animal-contact){display:none!important}#animal-contact{position:relative!important;width:1200px;box-sizing:border-box;padding:36px;background:#f7f2e9;color:#433e38;font-family:system-ui}#animal-contact h1{font-size:25px;margin:0 0 8px}#animal-contact p{font-size:13px;opacity:.65;margin:0 0 25px}#animal-contact .contact-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}#animal-contact article{display:flex;align-items:center;flex-direction:column;background:#fffaf2;border:1px solid #e5dccf;border-radius:18px;padding:16px 12px 19px;gap:5px}#animal-contact .contact-pet{height:170px;width:190px;display:grid;place-items:center;background:#e8eee0;border-radius:10px;margin-bottom:9px}#animal-contact .tf-pixel-avatar{width:150px!important;height:150px!important;max-width:none!important}#animal-contact .tf-pixel-pet{width:150px!important;height:150px!important}#animal-contact small{font-size:11px;opacity:.55}#animal-contact *{animation:none!important;transition:none!important}' });
    const oldViewport = page.viewportSize();
    const contactHeight = await page.locator('#animal-contact').evaluate(element => Math.ceil(element.getBoundingClientRect().height));
    // The preview document clips at its viewport height; expand before capturing the whole sheet.
    await page.setViewportSize({ width: 1280, height: contactHeight + 24 });
    await page.locator('#animal-contact').screenshot({ path: join(output, accessories.length === 1 ? 'adult-animals.png' : 'adult-accessories.png') });
    await page.evaluate(() => document.querySelector('#animal-contact').remove());
    await page.setViewportSize(oldViewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
}

// Use the browser's encoder to record actual UI screenshots; no ffmpeg dependency.
async function recordDemo(page) {
    await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = innerWidth; canvas.height = innerHeight;
        const stream = canvas.captureStream(15), chunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        globalThis.animalRecording = { canvas, stream, recorder, chunks };
    });
    let recording = true, started = false;
    const capture = (async () => {
        while (recording) {
            const frame = await page.screenshot({ type: 'jpeg', quality: 90 });
            await page.evaluate(async ({ frame, start }) => {
                const image = new Image(); image.src = 'data:image/jpeg;base64,' + frame; await image.decode();
                animalRecording.canvas.getContext('2d').drawImage(image, 0, 0);
                if (start) animalRecording.recorder.start();
            }, { frame: frame.toString('base64'), start: !started });
            started = true;
            await new Promise(done => setTimeout(done, 65));
        }
    })();
    try {
        for (const [kind, name] of species) {
            await setPet(page, name);
            await sampleFrames(page, mainRaster, 700);
            await page.locator('.tf-pet-sprite-control').click();
            await sampleFrames(page, mainRaster, 2400);
        }
    } finally { recording = false; await capture; }
    const bytes = await page.evaluate(async () => {
        const { recorder, chunks, stream } = animalRecording;
        await new Promise(done => { recorder.onstop = done; recorder.stop(); });
        stream.getTracks().forEach(track => track.stop());
        return [...new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer())];
    });
    assert.ok(bytes.length > 1000);
    await writeFile(join(output, 'animals-in-game.webm'), Buffer.from(bytes));
}

try {
    const gallery = await open();
    await contactSheet(gallery);
    await contactSheet(gallery, ['glasses', 'scarf', 'crown']);
    await gallery.close();
    console.log('Contact sheets:', join(output, 'adult-animals.png'), join(output, 'adult-accessories.png'));
    const page = await open();
    for (const [kind, name] of species) {
        await setPet(page, name);
        await checkAsset(page, kind);
        if (completedDynamics.has(kind)) { console.log(`RESUME ${kind}: prior completed dynamics retained; atlas verified again`); continue; }
        const idle = await sampleFrames(page, mainRaster, 6000);
        assertOneFrame(idle, `${kind} idle`, 'idle');
        assertOneFrame(idle, `${kind} blink`, 'sleep');
        assert.ok(new Set(idle.map(sample => sample.transform)).size > 20, `${kind}: breathing is static`);
        await page.evaluate(async () => { (await import('/src/store.js')).getForumData().world.companion.life.mode = 'paused'; petTest.render(); });
        const paused = await sampleFrames(page, mainRaster, 250);
        assertOneFrame(paused, `${kind} paused`);
        assert.equal(new Set(paused.map(sample => sample.transform)).size, 1, `${kind}: paused body moves`);
        assert.equal(new Set(paused.map(sample => sample.visible.join(','))).size, 1, `${kind}: paused expression changes`);
        await setPet(page, name);
        await page.locator('.tf-pet-sprite-control').click();
        assertOneFrame(await sampleFrames(page, mainRaster, 450), `${kind} pet`, 'happy');
        await setPet(page, name);
        await openCompanionMenu(page, 'feed');
        await page.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
        const feeding = await sampleFrames(page, mainRaster, 2750);
        assertOneFrame(feeding, `${kind} feeding`, 'feed');
        assertOneFrame(feeding, `${kind} satisfaction`, 'happy');
        await page.evaluate(async () => {
            const pet = (await import('/src/store.js')).getForumData().world.companion;
            pet.life.sleepUntil = Date.now() + 60000;
            petTest.viewState.companionVisualAction = 'feed';
            petTest.render();
        });
        const sleeping = await sampleFrames(page, mainRaster, 150);
        assertOneFrame(sleeping, `${kind} sleep`, 'sleep');
        assert.ok(sleeping.every(sample => sample.visible[0] === 'sleep'), `${kind}: feeding overrides sleep`);
        await setPet(page, name);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assertOneFrame(await sampleFrames(page, mainRaster, 100), `${kind} reduced idle`, 'idle');
        assert.ok((await page.locator(mainRaster + ' .tf-raster-frame').evaluateAll(frames => frames.map(frame => getComputedStyle(frame).animationName))).every(name => name === 'none'));
        await page.evaluate(() => { petTest.viewState.companionVisualAction = 'feed'; petTest.render(); });
        assertOneFrame(await sampleFrames(page), `${kind} reduced feed`, 'feed');
        await setPet(page, name);
        await page.screenshot({ path: join(output, `${kind}-home-desktop.png`), animations: 'disabled' });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        console.log(`PASS ${kind}: transparent atlas, no clipping, breath/blink, pet/feed, sleep, pause and reduced motion`);
    }

    await setPet(page, species[0][1]);
    await page.evaluate(species => {
        const fixture = document.createElement('section'); fixture.id = 'raster-static-check';
        fixture.innerHTML = species.map(([kind, name]) => `<div data-static-kind="${kind}"><div class="tf-growth-photo">${petTest.renderPixelCompanion(name, 'home', true, { life: { stage: 'adult' } })}</div><div class="mini-resting">${petTest.renderPixelCompanion(name, 'resting', true, { life: { stage: 'adult' } })}</div></div>`).join('');
        document.querySelector('#tavern-forum-root').append(fixture);
    }, species);
    for (const [kind] of species) {
        const base = `#raster-static-check [data-static-kind="${kind}"]`;
        assertOneFrame(await sampleFrames(page, base + ' .tf-growth-photo .tf-animal-raster'), `${kind} album`, 'idle');
        assertOneFrame(await sampleFrames(page, base + ' .mini-resting .tf-animal-raster'), `${kind} resting mini`, 'sleep');
    }
    await page.evaluate(() => document.querySelector('#raster-static-check').remove());

    // Freeze all scene effects for exact PNG color comparisons.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addStyleTag({ content: '#tavern-forum-root .tf-pet-stage *{animation:none!important;transition:none!important}' });
    for (const [kind, name] of species) {
        await setPet(page, name);
        const original = await page.locator(mainSprite).screenshot();
        await page.locator(mainSprite).evaluate(sprite => sprite.style.setProperty('--pet-body-user', '#8d48bd'));
        const body = await page.locator(mainSprite).screenshot({ path: join(output, `${kind}-color-body.png`) });
        const bodyChanges = await decodedDifference(page, original, body);
        assert.ok(bodyChanges > 30, `${kind}: body control changes only ${bodyChanges} pixels`);
        await page.locator(mainSprite).evaluate(sprite => { sprite.style.removeProperty('--pet-body-user'); sprite.style.setProperty('--pet-accent-user', '#338bdd'); });
        const accent = await page.locator(mainSprite).screenshot({ path: join(output, `${kind}-color-accent.png`) });
        const accentChanges = await decodedDifference(page, original, accent);
        assert.ok(accentChanges > 10, `${kind}: accent control changes only ${accentChanges} pixels`);
        await page.locator(mainSprite).evaluate(sprite => sprite.style.removeProperty('--pet-accent-user'));
        assert.equal(await decodedDifference(page, original, await page.locator(mainSprite).screenshot()), 0, `${kind}: colors do not reset`);
        for (const accessory of ['glasses', 'scarf', 'crown']) {
            await setPet(page, name, { accessory });
            assertOneFrame(await sampleFrames(page), `${kind}/${accessory}`);
            assert.ok(await page.locator(`${mainSprite} [data-accessory="${accessory}"]`).count() > 0);
        }
        for (const stage of ['baby', 'young']) {
            await page.evaluate(async stage => { (await import('/src/store.js')).getForumData().world.companion.life.stage = stage; petTest.render(); }, stage);
            assert.equal(await page.locator(mainRaster).count(), 0, `${kind}/${stage}: adult sprite leaked into juvenile`);
            assert.ok(await page.locator(mainSprite + ' .tf-pixel-pupils').count() > 0);
        }
        console.log(`PASS ${kind}: ${bodyChanges} body / ${accentChanges} accent pixels; reset, accessories and juvenile art`);
    }
    assert.equal(await page.evaluate(() => petCalls), 0);
    await page.close();

    for (const width of [390, 320]) {
        const mobile = await open(width);
        await mobile.emulateMedia({ reducedMotion: 'reduce' });
        for (const [kind, name] of species) {
            await setPet(mobile, name);
            assertOneFrame(await sampleFrames(mobile), `${kind}/${width}`, 'idle');
            assert.equal(await mobile.locator('.tf-view').evaluate(view => view.scrollWidth > view.clientWidth + 1), false, `${kind}/${width}: view overflows`);
            const sprite = await mobile.locator(mainSprite).boundingBox(), screen = await mobile.locator('.tf-pet-screen').boundingBox();
            assert.ok(sprite && screen && sprite.x >= screen.x - 1 && sprite.x + sprite.width <= screen.x + screen.width + 1, `${kind}/${width}: sprite outside screen`);
            await mobile.screenshot({ path: join(output, `${kind}-home-${width}.png`), animations: 'disabled' });
        }
        assert.equal(await mobile.evaluate(() => petCalls), 0);
        await mobile.close();
    }
    console.log('PASS all eight species at 390/320px and no API use');
    if (process.env.FORUM_RECORD_VIDEO === '1') {
        const demo = await open(390);
        await recordDemo(demo);
        await demo.close();
        console.log('Video:', join(output, 'animals-in-game.webm'));
    }
    assert.deepEqual(errors, [], 'Browser raised runtime errors');
    console.log('Screenshots:', output);
} finally {
    await browser.close();
    await new Promise(done => server.close(done));
}
