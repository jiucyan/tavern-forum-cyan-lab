import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { openCompanionMenu } from './companion-navigation.mjs';

const root = resolve('.');
const baseline = process.env.FORUM_ARTICULATION_BASELINE || 'C:/Users/ADMINI~1/AppData/Local/Temp/forum-articulation-before-76959a23';
const output = await mkdtemp(join(tmpdir(), 'forum-articulation-ui-'));
const species = [['frog', '青蛙'], ['cat', '黑猫'], ['rabbit', '垂耳兔'], ['fox', '赤狐'], ['penguin', '小企鹅'], ['robo-bird', '机械鸟'], ['octopus', '小章鱼'], ['goldfish', '斗鱼'], ['soot', '煤球']];
const failures = [], errors = [];
console.log('Artifacts:', output);
const server = createServer(async (request, response) => {
    try {
        let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const before = pathname.startsWith('/before/');
        if (before) pathname = pathname.slice(7);
        let file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        const oldFile = resolve(baseline, '.' + pathname);
        if (before && oldFile.startsWith(resolve(baseline) + sep) && existsSync(oldFile)) file = oldFile;
        let body = await readFile(file);
        if (!before && pathname === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render, renderPixelCompanion };');
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const mainSprite = '.tf-pet-sprite-control > .tf-pixel-avatar > .tf-pixel-pet';

async function open() {
    const page = await browser.newPage({ viewport: { width: 1140, height: 1060 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(async () => {
        const { getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true;
        getSettings().ui.activeTab = 'services';
        petTest.viewState.worldPage = 'travel';
        globalThis.petCalls = 0;
        SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
    });
    return page;
}

async function setPet(page, name) {
    await page.evaluate(async name => {
        const pet = (await import('/src/store.js')).getForumData().world.companion;
        Object.assign(pet, { species: name, status: 'home', satiety: 40, happiness: 65, energy: 80, bodyColor: '', accentColor: '', accessory: 'none' });
        Object.assign(pet.life, { stage: 'adult', cleanliness: 85, autoSleep: false, sleepUntil: 0, awakeUntil: 0, mode: 'active', growthNotice: null });
        clearTimeout(petTest.viewState.companionActionTimer);
        Object.assign(petTest.viewState, { companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0, companionFoodMenuOpen: false });
        petTest.render();
    }, name);
    await page.locator(mainSprite + ' .tf-raster-core').first().waitFor();
}

async function gallery(page, kinds = species.map(([kind]) => kind)) {
    const shown = species.filter(([kind]) => kinds.includes(kind));
    await page.evaluate(shown => {
        const fixture = document.createElement('section'); fixture.id = 'articulation-gallery'; fixture.className = 'tf-companion-page tf-companion-v4 is-action-idle';
        fixture.innerHTML = '<h1>旅伴 · 独立部位动作</h1><p class="phase">待机 · 耳朵、尾巴与鱼鳍各自动起来</p><div class="rig-grid">' + shown.map(([kind, name]) => `<article data-kind="${kind}"><div class="tf-pet-stage">${petTest.renderPixelCompanion(name, 'home', false, { accessory: 'none', life: { stage: 'adult' } })}</div><b>${name}</b></article>`).join('') + '</div>';
        document.querySelector('#tavern-forum-root').append(fixture);
    }, shown);
    await page.addStyleTag({ content: 'html,body{height:auto!important;overflow:visible!important}#tavern-forum-root{position:static!important;display:block!important;height:auto!important;overflow:visible!important;background:#f7f2e9!important}#tavern-forum-root>:not(#articulation-gallery){display:none!important}#articulation-gallery{box-sizing:border-box;padding:30px;width:1140px;background:#f7f2e9;color:#423d37;font-family:system-ui}#articulation-gallery h1{font-size:25px;margin:0 0 8px}#articulation-gallery p{font-size:14px;margin:0 0 22px;opacity:.68}#articulation-gallery .rig-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}#articulation-gallery article{display:flex;flex-direction:column;align-items:center;background:#fffbf4;padding:13px;border:1px solid #e6ddd0;border-radius:18px;gap:10px}#articulation-gallery .tf-pet-stage{position:relative!important;width:285px!important;height:224px!important;min-height:0!important;display:grid!important;place-items:center!important;border-radius:11px;background:#e8eee0!important;overflow:visible!important;padding:0!important}#articulation-gallery .tf-pixel-pet{position:static!important;width:208px!important;height:208px!important;margin:0!important;max-width:none!important}#articulation-gallery article>b{font-size:15px}' });
    await page.setViewportSize({ width: 1140, height: shown.length > 3 ? 1050 : 440 });
    await page.evaluate(async () => {
        const images = [...document.querySelectorAll('#articulation-gallery image')];
        await Promise.all([...new Set(images.map(image => image.getAttribute('href')))].map(async href => { const image = new Image(); image.src = href; await image.decode(); }));
    });
}

async function sample(page, selector, duration) {
    return page.evaluate(async ({ selector, duration }) => {
        const samples = [], started = performance.now();
        const matrix = m => m ? [m.a, m.b, m.c, m.d, m.e, m.f].map(value => Math.round(value * 10000) / 10000).join(',') : 'none';
        function read() {
            const current = [...document.querySelectorAll(selector)].map(svg => {
                const body = svg.querySelector('.tf-pixel-body-rig');
                const bodyMatrix = body.getCTM();
                const frames = [...svg.querySelectorAll('.tf-raster-frame')];
                const visible = frames.filter(frame => {
                    const style = getComputedStyle(frame);
                    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > .05;
                });
                const frame = visible[0];
                return { kind: svg.closest('[data-kind]')?.dataset.kind || [...svg.classList].find(value => value.startsWith('is-kind-'))?.slice(8), frame: visible.map(frame => frame.dataset.frame), body: matrix(bodyMatrix), phases: frames.map(frame => [...frame.querySelectorAll('.tf-raster-part')].map(part => `${part.dataset.part}:${getComputedStyle(part).transform}`).join('|')), parts: [...(frame?.querySelectorAll('.tf-raster-part') || [])].map(part => ({ name: part.dataset.part, motion: part.dataset.motion, relative: matrix(bodyMatrix.inverse().multiply(part.getCTM())), transform: getComputedStyle(part).transform, animation: getComputedStyle(part).animationName })) };
            });
            samples.push(current);
        }
        read();
        while (performance.now() - started < duration) { await new Promise(requestAnimationFrame); read(); }
        return samples;
    }, { selector, duration });
}

function verifyFrames(samples, label, expected) {
    const states = samples.flat();
    if (states.some(state => state.frame.length !== 1)) failures.push(`${label}: blank or overlapping expression frames`);
    if (states.some(state => state.phases.length !== 4 || new Set(state.phases).size !== 1)) failures.push(`${label}: four expression frames do not share the same limb phase`);
    if (expected && !states.some(state => state.frame[0] === expected)) failures.push(`${label}: no ${expected} expression`);
}

function verifyFrozen(samples, label) {
    for (const [kind] of species) {
        const states = samples.map(frame => frame.find(state => state.kind === kind)).filter(Boolean);
        if (!states.length) continue;
        if (label === 'paused' || label === 'reduced motion') {
            if (new Set(states.map(state => state.body)).size !== 1) failures.push(`${label}/${kind}: body keeps moving`);
            if (new Set(states.map(state => state.frame.join('|'))).size !== 1) failures.push(`${label}/${kind}: expression keeps changing`);
        }
        const names = new Set(states.flatMap(state => state.parts.map(part => part.name)));
        for (const name of names) {
            const positions = new Set(states.map(state => state.parts.find(part => part.name === name)?.transform));
            if (positions.size !== 1) {
                failures.push(`${label}/${kind}/${name}: part keeps moving`);
                console.log('FROZEN DIFFERENCE', label, kind, name, [...positions].slice(0, 4));
            }
        }
    }
}

async function difference(page, before, after) {
    return page.evaluate(async ({ before, after }) => {
        const decode = async src => {
            const image = new Image(); image.src = src; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            return { width: image.width, height: image.height, pixels: ctx.getImageData(0, 0, image.width, image.height).data };
        };
        const a = await decode(before), b = await decode(after);
        if (a.width !== b.width || a.height !== b.height) throw Error('Static render dimensions changed');
        let changed = 0, total = 0;
        for (let i = 0; i < a.pixels.length; i += 4) {
            const delta = Math.abs(a.pixels[i] - b.pixels[i]) + Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) + Math.abs(a.pixels[i + 2] - b.pixels[i + 2]);
            total += delta; if (delta > 30) changed++;
        }
        return { changed, fraction: changed / (a.width * a.height), meanChannelDelta: total / (a.width * a.height * 3) };
    }, { before: 'data:image/png;base64,' + before.toString('base64'), after: 'data:image/png;base64,' + after.toString('base64') });
}

async function record(page) {
    await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = innerWidth; canvas.height = innerHeight;
        const stream = canvas.captureStream(15), chunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        globalThis.rigRecording = { canvas, stream, recorder, chunks };
    });
    let recording = true, started = false;
    const capture = (async () => {
        while (recording) {
            const frame = await page.screenshot({ type: 'jpeg', quality: 94 });
            await page.evaluate(async ({ frame, start }) => {
                const image = new Image(); image.src = 'data:image/jpeg;base64,' + frame; await image.decode();
                rigRecording.canvas.getContext('2d').drawImage(image, 0, 0);
                if (start) rigRecording.recorder.start();
            }, { frame: frame.toString('base64'), start: !started });
            started = true; await new Promise(done => setTimeout(done, 60));
        }
    })();
    const phase = async (action, label, duration) => {
        await page.evaluate(({ action, label }) => {
            const gallery = document.querySelector('#articulation-gallery');
            gallery.className = 'tf-companion-page tf-companion-v4 is-action-' + (action || 'idle');
            gallery.querySelector('.phase').textContent = label;
        }, { action, label });
        await page.waitForTimeout(duration);
    };
    try {
        await phase('', '待机 · 耳朵、尾巴与鱼鳍各自动起来', 7000);
        await phase('pet', '摸摸 · 开心回应，肢体继续活动', 2400);
        await phase('', '待机 · 三只旅伴独立活动', 1400);
        await phase('feed', '喂食 · 张嘴、咀嚼与满足', 2600);
        await phase('', '待机 · 身体安稳，局部有自己的节奏', 4600);
    } finally { recording = false; await capture; }
    const bytes = await page.evaluate(async () => {
        const { recorder, chunks, stream } = rigRecording;
        await new Promise(done => { recorder.onstop = done; recorder.stop(); });
        stream.getTracks().forEach(track => track.stop());
        return [...new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer())];
    });
    assert.ok(bytes.length > 1000);
    await writeFile(join(output, 'articulation-cat-rabbit-fish.webm'), Buffer.from(bytes));
    // Decode the saved bytes as a real video; a nonempty MediaRecorder blob alone
    // does not establish that an artifact can be played or sought successfully.
    const playback = await browser.newPage();
    const decoded = await playback.evaluate(async encoded => {
        const video = document.createElement('video');
        video.muted = true; video.preload = 'auto';
        const loaded = new Promise((done, fail) => {
            video.onloadeddata = done; video.onerror = () => fail(Error('Recorded video cannot be decoded'));
        });
        video.src = 'data:video/webm;base64,' + encoded;
        document.body.append(video);
        await loaded;
        const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const frames = [];
        for (const seconds of [1, 8, 12, 16]) {
            await new Promise((done, fail) => {
                const timer = setTimeout(() => fail(Error(`Video seek timed out at ${seconds}s`)), 10000);
                video.onseeked = () => { clearTimeout(timer); done(); };
                video.currentTime = seconds;
            });
            canvas.getContext('2d').drawImage(video, 0, 0);
            frames.push({ seconds, actual: video.currentTime, png: canvas.toDataURL('image/png').split(',')[1] });
        }
        return { width: video.videoWidth, height: video.videoHeight, frames };
    }, Buffer.from(bytes).toString('base64'));
    assert.equal(decoded.width, 1140); assert.equal(decoded.height, 440);
    assert.equal(new Set(decoded.frames.map(frame => frame.png)).size, 4, 'Recorded video must contain changing frames');
    for (const frame of decoded.frames) await writeFile(join(output, `video-frame-${frame.seconds}s.png`), Buffer.from(frame.png, 'base64'));
    console.log('Video decoded:', JSON.stringify({ width: decoded.width, height: decoded.height, samples: decoded.frames.map(({ seconds, actual }) => ({ seconds, actual })) }));
    await playback.close();
}

async function maximumSwing(target, action, path) {
    await target.evaluate(action => {
        document.querySelector('#articulation-gallery').className = 'tf-companion-page tf-companion-v4 is-action-' + action;
        for (const svg of document.querySelectorAll('#articulation-gallery .tf-pixel-pet')) {
            for (const animation of svg.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 0; }
            const body = svg.querySelector('.tf-pixel-body-rig');
            for (const part of svg.querySelectorAll('.tf-raster-frame .tf-raster-part')) {
                for (const animation of part.getAnimations()) {
                    const duration = Number(animation.effect.getComputedTiming().duration);
                    if (!(duration > 0)) continue;
                    let best = 0, bestScore = -1;
                    for (let step = 0; step < 100; step++) {
                        animation.currentTime = duration * step / 100;
                        const matrix = body.getCTM().inverse().multiply(part.getCTM());
                        const score = Math.abs(matrix.a - 1) * 30 + Math.abs(matrix.b) * 30 + Math.abs(matrix.c) * 30 + Math.abs(matrix.d - 1) * 30 + Math.abs(matrix.e) + Math.abs(matrix.f);
                        if (score > bestScore) { best = animation.currentTime; bestScore = score; }
                    }
                    animation.currentTime = best;
                }
            }
        }
        document.querySelector('#articulation-gallery .phase').textContent = (action === 'idle' ? '待机' : '互动') + '最大摆幅 · 接缝与轮廓检查';
    }, action);
    await target.screenshot({ path: join(output, path) });
    console.log('Maximum swing:', join(output, path));
}

try {
    if (process.env.FORUM_MAX_ONLY === '1') {
        const allExtreme = await open();
        await gallery(allExtreme);
        await maximumSwing(allExtreme, 'pet', 'active-max-swing-all-animals.png');
        await allExtreme.close();
        const extreme = await open();
        await gallery(extreme, ['cat', 'rabbit', 'goldfish']);
        await maximumSwing(extreme, 'idle', 'max-swing-cat-rabbit-fish.png');
        await maximumSwing(extreme, 'pet', 'active-max-swing-cat-rabbit-fish.png');
        await extreme.close();
    } else {
    const page = await open();
    await gallery(page);
    await page.screenshot({ path: join(output, 'all-articulated-animals.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Compare at rest against the real pre-change renderer. Only the PNG's cut edges
    // may differ slightly through anti-aliasing; missing or repeated body pixels may not.
    const staticStyle = await page.addStyleTag({ content: '#articulation-gallery .tf-pixel-pet *{animation:none!important;transition:none!important;transform:none!important}' });
    for (const [kind] of species) {
        const sprite = page.locator(`#articulation-gallery [data-kind="${kind}"] .tf-pixel-pet`);
        const originalMarkup = await sprite.innerHTML();
        const current = await sprite.screenshot({ path: join(output, `${kind}-split-static.png`) });
        await sprite.evaluate(async (svg, kind) => { const { renderCompanionArtwork } = await import('/before/src/companion-art.js'); svg.innerHTML = renderCompanionArtwork(kind, 'none', 'adult'); }, kind);
        await page.evaluate(async () => {
            await Promise.all([...new Set([...document.querySelectorAll('#articulation-gallery image')].map(image => image.getAttribute('href')))].map(async href => { const image = new Image(); image.src = href; await image.decode(); }));
        });
        const original = await sprite.screenshot({ path: join(output, `${kind}-original-static.png`) });
        const delta = await difference(page, original, current);
        if (delta.fraction > .025 || delta.meanChannelDelta > 1.25) failures.push(`${kind}: static split changed ${delta.changed} pixels (${(delta.fraction * 100).toFixed(2)}%, mean ${delta.meanChannelDelta.toFixed(3)})`);
        console.log(`STATIC ${kind}:`, JSON.stringify(delta));
        await sprite.evaluate((svg, markup) => svg.innerHTML = markup, originalMarkup);
    }
    await staticStyle.evaluate(element => element.remove());
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log('Static reference comparisons saved:', output);
    const extreme = await open();
    await gallery(extreme, ['cat', 'rabbit', 'goldfish']);
    await maximumSwing(extreme, 'idle', 'max-swing-cat-rabbit-fish.png');
    await maximumSwing(extreme, 'pet', 'active-max-swing-cat-rabbit-fish.png');
    await extreme.close();
    const allExtreme = await open();
    await gallery(allExtreme);
    await maximumSwing(allExtreme, 'pet', 'active-max-swing-all-animals.png');
    await allExtreme.close();
    const moving = await sample(page, '#articulation-gallery .tf-pixel-pet', 6200);
    verifyFrames(moving, 'idle', 'idle');
    for (const [kind] of species) {
        const states = moving.map(frame => frame.find(state => state.kind === kind)).filter(state => state?.frame[0] === 'idle');
        const names = [...new Set(states.flatMap(state => state.parts.map(part => part.name)))];
        const trajectories = names.map(name => states.map(state => state.parts.find(part => part.name === name)?.relative));
        const animated = trajectories.filter(trajectory => new Set(trajectory).size > 5);
        if (animated.length < 2) failures.push(`${kind}: only ${animated.length} independent moving parts`);
        if (new Set(animated.map(trajectory => trajectory.join('|'))).size < 2) failures.push(`${kind}: parts share the same body-relative motion`);
        console.log(`PARTS ${kind}: ${animated.length}/${names.length} animate relative to the body (${names.join(', ')})`);
    }

    await page.evaluate(() => document.querySelector('#articulation-gallery').className = 'tf-companion-page tf-companion-v4 is-action-feed');
    const allFeeding = await sample(page, '#articulation-gallery .tf-pixel-pet', 2700);
    verifyFrames(allFeeding, 'all species/feed', 'feed');
    verifyFrames(allFeeding, 'all species/feed finish', 'happy');
    await page.evaluate(() => document.querySelector('#articulation-gallery').className = 'tf-companion-page tf-companion-v4 is-action-idle');

    await page.evaluate(() => document.querySelector('#articulation-gallery').classList.add('is-living-paused'));
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const paused = await sample(page, '#articulation-gallery .tf-pixel-pet', 350);
    verifyFrames(paused, 'paused'); verifyFrozen(paused, 'paused');
    await page.evaluate(() => document.querySelector('#articulation-gallery').className = 'tf-companion-page tf-companion-v4 is-action-idle is-living-sleep');
    const sleeping = await sample(page, '#articulation-gallery .tf-pixel-pet', 350);
    verifyFrames(sleeping, 'sleep', 'sleep'); verifyFrozen(sleeping, 'sleep');
    await page.evaluate(() => document.querySelector('#articulation-gallery').className = 'tf-companion-page tf-companion-v4 is-action-idle');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await sample(page, '#articulation-gallery .tf-pixel-pet', 350);
    verifyFrames(reduced, 'reduced motion', 'idle'); verifyFrozen(reduced, 'reduced motion');

    await page.close();

    const live = await open();
    for (const [kind, name] of species.filter(([kind]) => ['cat', 'rabbit', 'goldfish'].includes(kind))) {
        await setPet(live, name);
        await live.screenshot({ path: join(output, `real-game-${kind}.png`) });
        await live.locator('.tf-pet-sprite-control').click();
        verifyFrames(await sample(live, mainSprite, 500), `${kind}/real pet`, 'happy');
        await setPet(live, name);
        await openCompanionMenu(live, 'feed');
        await live.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
        const feed = await sample(live, mainSprite, 2750);
        verifyFrames(feed, `${kind}/real feed`, 'feed'); verifyFrames(feed, `${kind}/feed finish`, 'happy');
    }
    assert.equal(await live.evaluate(() => petCalls), 0);
    await live.close();

    if (process.env.FORUM_RECORD_VIDEO === '1') {
        const demo = await open();
        await gallery(demo, ['cat', 'rabbit', 'goldfish']);
        await demo.screenshot({ path: join(output, 'articulation-cat-rabbit-fish.png') });
        await record(demo);
        await demo.close();
        console.log('Video:', join(output, 'articulation-cat-rabbit-fish.webm'));
    }
    await writeFile(join(output, 'results.json'), JSON.stringify({ failures, errors }, null, 2));
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert.deepEqual(failures, [], 'Articulation regressions');
    console.log('PASS independent parts, rest/pause/reduced motion, original PNG appearance and real pet/feed actions');
    }
} finally {
    await browser.close();
    await new Promise(done => server.close(done));
}
