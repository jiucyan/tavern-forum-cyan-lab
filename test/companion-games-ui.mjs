import { openCompanionMenu } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-games-ui-'));
const server = createServer(async (request, response) => {
    try {
        const path = new URL(request.url, 'http://localhost').pathname, file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render, closeForum, openForum };');
        if (path === '/preview.html') body = Buffer.from(body.toString().replace('const listeners = new Map();', 'const listeners = globalThis.petListeners = new Map();'));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(file)] || 'application/octet-stream' }); response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [];
async function open(mobile = false) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, hasTouch: mobile });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(async () => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings(); settings.modules.travel.enabled = true; settings.ui.activeTab = 'services'; petTest.viewState.worldPage = 'travel';
        const companion = getForumData().world.companion;
        companion.satiety = 40; companion.happiness = 45; companion.life.cleanliness = 20; companion.life.autoSleep = false; companion.life.stage = 'adult';
        globalThis.petCalls = 0; SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
        petTest.render();
    });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    return page;
}
const readPet = page => page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); return structuredClone(getForumData().world.companion); });
async function point(page, selector) {
    const box = await page.locator(selector).boundingBox(); assert.ok(box);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
const game = async page => (await readPet(page)).life.game;
async function start(page, kind = 'catch') {
    await openCompanionMenu(page, 'games', 'click');
    await page.locator('[data-action="pet-game-start"][data-game="' + kind + '"]').click();
    await page.locator('.tf-pet-arcade canvas').waitFor();
    await page.waitForTimeout(2200);
    assert.equal((await game(page)).paused, false);
}
try {
    const page = await open(); await start(page);
    await page.evaluate(() => {
        globalThis.canvasBefore = document.querySelector('.tf-pet-arcade canvas'); globalThis.gameSaves = 0;
        SillyTavern.getContext().saveMetadataDebounced = () => gameSaves++;
        SillyTavern.getContext().saveMetadata = async () => gameSaves++;
    });
    await page.locator('canvas').focus(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(110);
    let x = (await game(page)).x; assert.ok(x > .55 && x < .85, 'continuous position ' + x);
    await page.keyboard.up('ArrowRight'); const releaseX = (await game(page)).x; await page.waitForTimeout(100);
    assert.equal((await game(page)).x, releaseX);
    await page.keyboard.press('Space'); const skill = (await game(page)).skillUntil;
    await page.keyboard.press('Space'); assert.equal((await game(page)).skillUntil, skill);
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + box.width * .2, box.y + box.height * .7); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .7, { steps: 15 }); await page.mouse.up(); await page.waitForTimeout(250);
    assert.ok(Math.abs((await game(page)).x - .65) < .03);
    assert.equal(await page.evaluate(() => canvasBefore === document.querySelector('.tf-pet-arcade canvas')), true);
    assert.ok(await page.evaluate(() => gameSaves) <= 1, 'inputs should not write metadata');
    await page.screenshot({ path: join(output, 'catch-desktop.png') });
    console.log('PASS stable canvas, continuous keyboard/drag movement, cooldown and no per-input saves');

    await page.keyboard.press('Escape'); await page.locator('.tf-arcade-pause:not([hidden])').waitFor();
    const elapsed = (await game(page)).elapsed; await page.waitForTimeout(300); assert.equal((await game(page)).elapsed, elapsed);
    assert.equal(await page.locator('#tavern-forum-root').isVisible(), true);
    await page.screenshot({ path: join(output, 'paused-desktop.png') });
    await page.locator('.tf-arcade-pause [data-action="pet-game-pause"]').click();
    await page.waitForTimeout(100); assert.ok((await game(page)).elapsed > elapsed);
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal((await game(page)).paused, true);
    await page.locator('.tf-arcade-pause [data-action="pet-game-pause"]').click();
    await page.evaluate(async () => { const {getForumData} = await import('/src/store.js'); const g = getForumData().world.companion.life.game; g.elapsed = 31900; g.score = 120; g.bestCombo = 6; });
    await page.locator('.tf-arcade-result').waitFor();
    const result = await readPet(page); assert.equal(result.life.lastGameResult.coins, 5); assert.equal(result.life.gameRecords.catch.best, 120);
    await page.screenshot({ path: join(output, 'result-desktop.png') });
    await page.locator('[data-action="companion-menu-confirm"]').click(); await page.locator('canvas').waitFor();
    assert.equal((await game(page)).score, 0); assert.equal((await readPet(page)).life.coins, result.life.coins);
    await page.evaluate(() => petTest.closeForum());
    assert.equal((await game(page)).paused, true); const closedElapsed = (await game(page)).elapsed;
    await page.waitForTimeout(250); assert.equal((await game(page)).elapsed, closedElapsed);
    await page.evaluate(() => petTest.openForum());
    await page.locator('.tf-arcade-pause:not([hidden])').waitFor();
    await page.locator('.tf-arcade-pause [data-action="pet-game-pause"]').click();
    // Simulate a restored round: it must wait for an explicit resume.
    await page.evaluate(async () => {
        const {getForumData} = await import('/src/store.js'); const life = getForumData().world.companion.life;
        life.game = JSON.parse(JSON.stringify(life.game)); life.game.lastTickAt -= 5000; petTest.render();
    });
    assert.equal((await game(page)).paused, true);
    await openCompanionMenu(page, 'games', 'click');
    await page.locator('.tf-pet-games [data-action="pet-game-stop"]').click();
    console.log('PASS Escape and blur pause, result settlement, best score and replay');

    await start(page, 'memory');
    await page.waitForFunction(async () => { const {getForumData} = await import('/src/store.js'); return getForumData().world.companion.life.game.phase === 'answer'; });
    const sequence = (await game(page)).sequence;
    for (const direction of sequence) await page.locator('[data-arcade-answer="' + (direction - 1) + '"]').click();
    assert.equal((await game(page)).score, 10); await page.waitForTimeout(950);
    assert.equal((await game(page)).sequence.length, 3);
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, 'memory-desktop.png') });
    await page.evaluate(async()=>{const {getForumData}=await import('/src/store.js');const g=getForumData().world.companion.life.game;g.sequence=[1,1];g.answer=0;g.phase='answer';g.phaseAt=g.elapsed;});
    await page.locator('[data-action="companion-menu-confirm"]').scrollIntoViewIfNeeded();
    const confirm=await page.locator('[data-action="companion-menu-confirm"]').boundingBox();
    await page.mouse.move(confirm.x+confirm.width/2,confirm.y+confirm.height/2);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.up();
    assert.equal((await game(page)).answer,1,'held memory button must not answer twice');
    await page.keyboard.press('Enter');assert.equal((await game(page)).phase,'between','keyboard activation immediately after pointer release must work');
    await openCompanionMenu(page, 'games', 'click');
    await page.locator('.tf-pet-games [data-action="pet-game-stop"]').click();
    console.log('PASS memory pads show and accept ordered, growing sequences');
    assert.equal(await page.evaluate(() => petCalls), 0); await page.close();

    const mobile = await open(true); await start(mobile, 'dodge');
    const cdp = await mobile.context().newCDPSession(mobile), field = await mobile.locator('canvas').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:field.x+field.width*.25,y:field.y+field.height*.5}]});
    for(let i=0;i<=10;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:field.x+field.width*(.25+i*.045),y:field.y+field.height*.5}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await mobile.waitForTimeout(250);
    assert.ok(Math.abs((await game(mobile)).x-.7)<.03);
    const button = await mobile.locator('[data-action="companion-menu-nav"][data-direction="-1"]').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:button.x+button.width/2,y:button.y+button.height/2}]}); await mobile.waitForTimeout(350);
    const moved = (await game(mobile)).x; assert.ok(moved<.6);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await mobile.waitForTimeout(100);
    const stopped=(await game(mobile)).x; await mobile.waitForTimeout(100);assert.equal((await game(mobile)).x,stopped);
    await mobile.locator('[data-arcade-skill]').tap();assert.ok((await game(mobile)).skillUntil>(await game(mobile)).elapsed);
    assert.equal(await mobile.locator('.tf-app').evaluate(node=>node.scrollWidth>node.clientWidth+2),false);
    await mobile.screenshot({path:join(output,'dodge-mobile.png')});
    const old=await readPet(mobile);
    await mobile.evaluate(()=>{const ctx=SillyTavern.getContext();ctx.chatId='second-pet';ctx.chatMetadata={tavern_forum_data:{world:{companion:{name:'第二只',life:{coins:7,autoSleep:false}}}}};petListeners.get('chat_changed')();});
    await mobile.waitForTimeout(400);const next=await readPet(mobile);assert.equal(next.life.coins,7);assert.equal(next.life.game,null);assert.equal(next.name,'第二只');
    assert.equal(await mobile.evaluate(()=>petCalls),0);await mobile.close();
    console.log('PASS real touch drag, held buttons, shield and chat isolation on mobile');
    assert.deepEqual(errors,[]);console.log('Screenshots:',output);
} finally {await browser.close();await new Promise(done=>server.close(done));}
