import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-idle-scenes-ui-'));
console.log('Artifacts:', output);
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render, showCompanionPanel, get idle() { return companionIdleController; } };');
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' }); response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const page = await browser.newPage({ viewport: { width: 960, height: 900 } });
const errors = [], captures = [];
page.on('pageerror', error => errors.push(error.message));
const habitat = () => page.locator('.tf-pet-habitat-layer').getAttribute('data-habitat');
const idlePose = () => page.locator('.tf-pet-sprite-control').getAttribute('data-idle-pose');
async function fixture(species = '黑猫', stage = 'adult', habitat = 'beach') {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        getSettings().modules.travel.enabled = true; getSettings().ui.activeTab = 'services';
        clearTimeout(petTest.viewState.companionActionTimer); clearTimeout(petTest.viewState.companionFeedbackTimer);
        Object.assign(petTest.viewState, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionActionTimer: 0, companionFoodMenuOpen: false, companionCleaning: false, companionFeedback: null, companionGameResultOpen: false });
        const pet = getForumData().world.companion;
        Object.assign(pet, { species: values.species, status: 'home', satiety: 80, happiness: 75, energy: 80, habitat: values.habitat, lastInteractionAt: 0, accessory: 'none', bodyColor: '', accentColor: '', weather: 'clear', timeOfDay: 'day' });
        Object.assign(pet.life, { stage: values.stage, mode: 'active', cleanliness: 80, game: null, autoSleep: false, sleepUntil: 0, awakeUntil: 0, growthNotice: null, lastTickAt: Date.now() });
        petTest.render();
        await Promise.all([...new Set([...document.querySelectorAll('.tf-pet-sprite-control image')].map(el => el.getAttribute('href')))].map(async href => { const image = new Image(); image.src = href; await image.decode(); }));
    }, { species, stage, habitat });
}
async function seek(ms) {
    return page.evaluate(ms => {
        const stage = document.querySelector('.tf-pet-stage');
        for (const animation of stage.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = ms; }
        const sprite = stage.querySelector('.tf-pixel-pet');
        return [...sprite.querySelectorAll('.tf-raster-frame')].filter(frame => getComputedStyle(frame).visibility !== 'hidden' && Number(getComputedStyle(frame).opacity) > .05).map(frame => frame.dataset.frame);
    }, ms);
}
async function capture(name) {
    const png = await page.locator('.tf-pet-stage').screenshot({ path: join(output, name + '.png') });
    captures.push({ name, uri: 'data:image/png;base64,' + png.toString('base64') });
}
try {
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await fixture();
    await page.waitForFunction(() => document.querySelector('.tf-pet-sprite-control')?.dataset.idlePose, { timeout: 7000 });
    assert.ok(await idlePose(), 'idle must start naturally without refreshing the page');
    await page.evaluate(() => petTest.idle.cancel());
    for (const pose of ['look', 'listen', 'groom', 'stretch', 'doze', 'playful']) {
        assert.equal(await page.evaluate(pose => petTest.idle.play(pose), pose), true);
        for (const ms of [0, 800, 1700, 2600, 3550]) assert.equal((await seek(ms)).length, 1, `${pose}: overlapping or missing expression`);
        await seek(1700); await capture(`cat-${pose}`);
        await page.evaluate(() => petTest.idle.cancel());
    }
    await page.evaluate(() => petTest.idle.play('look'));
    await page.locator('.tf-device-menu-toggle').click();
    assert.equal(await idlePose(), null, 'opening a menu interrupts idle immediately');
    await page.locator('.tf-device-icon-menu [data-panel="feed"]').click();
    assert.equal(await habitat(), 'beach', 'food selection preserves the chosen room');
    await page.locator('[data-food-id="fish-flake"]').click();
    assert.equal(await habitat(), 'kitchen'); assert.equal(await idlePose(), null);
    await capture('feeding-kitchen');
    assert.equal(await page.evaluate(async () => (await import('/src/store.js')).getForumData().world.companion.habitat), 'beach', 'temporary room must not overwrite settings');
    await page.waitForFunction(() => document.querySelector('.tf-pet-habitat-layer')?.dataset.habitat === 'beach', { timeout: 5000 });
    await page.locator('.tf-device-menu-toggle').click();
    await page.locator('.tf-device-icon-menu [data-panel="clean"]').click();
    assert.equal(await habitat(), 'bathroom'); await capture('washing-bathroom');
    await page.locator('[data-action="companion-menu-nav"][data-direction="1"]').click();
    assert.equal(await habitat(), 'beach', 'cancelling a wash restores the room');
    await fixture();
    await page.locator('.tf-device-menu-toggle').click();
    await page.locator('.tf-device-icon-menu [data-panel="clean"]').click();
    await page.evaluate(() => { petTest.viewState.companionCleanProgress = .95; });
    await page.locator('.tf-pet-sprite-control').click();
    assert.equal(await habitat(), 'bathroom', 'completed washing keeps its brief reaction');
    await page.waitForFunction(() => document.querySelector('.tf-pet-habitat-layer')?.dataset.habitat === 'beach', { timeout: 4000 });
    await fixture();
    await page.locator('.tf-device-menu-toggle').click();
    await page.locator('.tf-device-icon-menu [data-panel="rest"]').click();
    assert.equal(await habitat(), 'bedroom');
    assert.equal(await page.locator('.tf-companion-device').evaluate(el => el.classList.contains('is-scene-sleep')), true);
    assert.equal(await page.locator('.tf-pet-weather').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.evaluate(() => petTest.idle.play('playful')), false);
    await capture('sleep-bedroom');
    await page.locator('.tf-pet-sprite-control').click();
    assert.equal(await habitat(), 'beach', 'waking restores the chosen room');
    await fixture();
    await page.evaluate(async () => { const pet = (await import('/src/store.js')).getForumData().world.companion; (await import('/src/companion-life.js')).startCompanionGame(pet, 'catch'); petTest.render(); });
    assert.equal(await habitat(), 'garden'); assert.equal(await page.evaluate(() => petTest.idle.play('look')), false);
    await fixture();
    for (const unavailable of ['away', 'paused', 'daycare']) {
        await page.evaluate(async unavailable => { const pet = (await import('/src/store.js')).getForumData().world.companion; pet.status = unavailable === 'away' ? 'away' : 'home'; pet.life.mode = unavailable === 'away' ? 'active' : unavailable; petTest.render(); }, unavailable);
        assert.equal(await page.evaluate(() => petTest.idle.play('stretch')), false, `${unavailable} must stop idle`);
        assert.equal(await habitat(), 'beach');
    }
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 860 });
        for (const [kind, name] of [['cat','黑猫'],['rabbit','垂耳兔'],['goldfish','斗鱼'],['frog','青蛙'],['fox','赤狐'],['penguin','小企鹅'],['robo-bird','机械鸟'],['octopus','小章鱼'],['soot','煤球']]) {
            await fixture(name); assert.equal(await page.evaluate(() => petTest.idle.play('stretch')), true);
            assert.equal((await seek(1700)).length, 1);
            const overflow = await page.locator('.tf-device-viewport').evaluate(el => el.scrollWidth > el.clientWidth + 1);
            assert.equal(overflow, false, `${kind}/${width}: horizontal overflow`);
            if (width === 390) await capture(`${kind}-stretch-${width}`);
        }
    }
    for (const stage of ['baby', 'young']) { await fixture('垂耳兔', stage); await page.evaluate(() => petTest.idle.play('look')); await seek(1600); await capture(`rabbit-${stage}`); }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await fixture();
    assert.equal(await page.evaluate(() => petTest.idle.play('doze')), false);
    assert.equal(await idlePose(), null);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    if (process.env.FORUM_IDLE_RECORD === '1') {
        await page.setViewportSize({ width: 960, height: 900 });
        const frames = [];
        for (const [name, pose, label] of [['黑猫','groom','黑猫 · 整理'],['垂耳兔','listen','垂耳兔 · 听动静'],['斗鱼','stretch','斗鱼 · 舒展鱼鳍'],['黑猫','doze','黑猫 · 打个哈欠']]) {
            await fixture(name); await page.evaluate(pose => petTest.idle.play(pose), pose);
            for (let frame = 0; frame < 54; frame++) {
                // Reset only the wall-clock scheduler; the rendered CSS pose is sampled below.
                await page.evaluate(pose => petTest.idle.play(pose), pose);
                await seek(frame * 1000 / 15);
                const png = await page.locator('.tf-pet-stage').screenshot(); frames.push({ label, uri: 'data:image/png;base64,' + png.toString('base64') });
            }
        }
        const recorderPage = await browser.newPage({ viewport: { width: 620, height: 600 } });
        await recorderPage.setContent('<canvas width="620" height="600"></canvas>');
        const bytes = await recorderPage.evaluate(async frames => {
            const decoded = await Promise.all(frames.map(async frame => { const image = new Image(); image.src = frame.uri; await image.decode(); return { image, label: frame.label }; }));
            const canvas = document.querySelector('canvas'), context = canvas.getContext('2d'), chunks = [];
            const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1800000 });
            recorder.ondataavailable = event => chunks.push(event.data);
            const done = new Promise(resolve => { recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))); });
            recorder.start(); const start = performance.now();
            for (let i = 0; i < decoded.length; i++) { const { image, label } = decoded[i]; context.fillStyle='#f5f0e7'; context.fillRect(0,0,620,600); context.fillStyle='#423b34'; context.font='bold 23px system-ui'; context.fillText('旅伴 · 待机动作',35,42); context.font='18px system-ui'; context.fillText(label,35,74); context.imageSmoothingEnabled=false; context.drawImage(image,35,100,550,550*image.height/image.width); await new Promise(resolve => setTimeout(resolve,Math.max(0,start+(i+1)*1000/15-performance.now()))); }
            recorder.stop(); return done;
        }, frames);
        await writeFile(join(output, 'idle-in-game.webm'), Buffer.from(bytes)); await recorderPage.close();
    }
    await page.setViewportSize({ width: 1240, height: 900 });
    await page.setContent('<style>body{background:#f5f0e7;font:15px system-ui;padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%}figcaption{text-align:center}</style>' + captures.map(({name,uri}) => `<figure><img src="${uri}"><figcaption>${name}</figcaption></figure>`).join(''));
    await page.screenshot({ path: join(output, 'idle-scenes-overview.png'), fullPage: true });
    assert.deepEqual(errors, []); console.log('PASS idle expressions, interruption, automatic rooms, return, mobile and reduced motion');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
