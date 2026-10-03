import { openCompanionMenu, returnCompanionHome } from './companion-navigation.mjs';
import { COMPANION_HABITATS, renderCompanionScene } from '../src/companion-scenes.js';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-layout-ui-'));
const server = createServer(async (request, response) => {
    try {
        const path = new URL(request.url, 'http://localhost').pathname, file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render, closeForum, openForum, processCompanionJourneyClock, renderCompanionAvatar };');
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


const choose = async (page, panel) => {
    if(panel==='home') await returnCompanionHome(page);
    else await openCompanionMenu(page, panel);
};
const press = (page, key) => page.locator(key==='B'?'[data-action="companion-menu-confirm"]':'[data-action="companion-menu-nav"][data-direction="'+(key==='A'?-1:1)+'"]').click();
const checkScenes = async (page, suffix) => {
    for (const scene of COMPANION_HABITATS.filter(item => renderCompanionScene(item.id))) {
        await choose(page, 'dress');
        const settings = page.locator('.tf-device-setting-group').nth(2);
        if (!await settings.evaluate(node => node.open)) await settings.locator(':scope > summary').click();
        assert.equal(await page.locator('[data-environment-field="habitat"]').count(), COMPANION_HABITATS.length);
        const option = page.locator(`[data-environment-field="habitat"][data-environment-value="${scene.id}"]`);
        await option.click();
        assert.equal(await option.getAttribute('aria-selected'), 'true');
        assert.equal(await option.locator('.tf-scene-art').count(), 1);
        await choose(page, 'home');
        assert.equal(await page.locator('.tf-pet-habitat-layer .tf-scene-art').getAttribute('data-scene'), scene.id);
        const saved = await page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/store.js')).getForumData().world.companion)));
        assert.equal(saved.habitat, scene.id);
        assert.match(saved.message, new RegExp(scene.arrival));
        assert.equal(await page.locator('.tf-view').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        await page.screenshot({ path: join(output, `scene-${scene.id}-${suffix}.png`) });
    }
    await page.evaluate(() => { petTest.closeForum(); petTest.openForum(); });
    assert.equal(await page.locator('.tf-pet-habitat-layer .tf-scene-art').getAttribute('data-scene'), 'fairground');
    assert.equal(await page.evaluate(() => petCalls), 0);
};
try {
    const page = await open();
    await page.screenshot({path:join(output,'home-desktop.png')}); console.log(output);
    assert.equal(await page.locator('.tf-pet-dashboard').count(),0);
    assert.equal(await page.locator('.tf-pet-vitals progress').count(),4);
    assert.equal(await page.locator('.tf-packing').isVisible(),false);
    assert.equal(await page.locator('.tf-device-icon-menu').isVisible(),false);
    assert.equal(await page.locator('.tf-pet-room-tools').isVisible(),false);
    assert.equal(await page.locator('.tf-device-page-tabs:visible').count(),0);
    assert.equal(await page.locator('[data-action="companion-menu-nav"][data-direction="-1"]').getAttribute('aria-label'),'菜单');
    await press(page,'C');
    assert.equal(await page.evaluate(()=>petTest.viewState.companionPanel),'status');
    await press(page,'C');
    await press(page,'A'); await press(page,'B');
    assert.equal(await page.evaluate(()=>petTest.viewState.companionPanel),'status');
    await press(page,'C');
    assert.equal(await page.evaluate(()=>petTest.viewState.companionPanel),'home');
    await press(page,'A');
    await press(page,'A'); await press(page,'B');
    assert.equal(await page.locator('.tf-pet-food-select').isVisible(),true);
    await press(page,'B');
    assert.equal(await page.locator('.tf-pet-food-select').count(),0);
    assert.equal(await page.evaluate(async()=>(await import('/src/store.js')).getForumData().world.companion.lastAction),'feed');
    await choose(page,'feed'); await press(page,'A');
    assert.equal(await page.locator('.tf-pet-food-select button.is-selected').count(),1);
    await press(page,'C');
    await choose(page,'clean'); await choose(page,'status'); await press(page,'C');
    assert.equal(await page.locator('.is-washing').count(),0);
    assert.equal(await page.locator('.tf-pet-touch-guide').textContent(),'摸摸我，陪我待一会儿');
    await choose(page,'clean'); for(let i=0;i<3;i++)await press(page,'B');
    assert.equal(await page.evaluate(()=>petTest.viewState.companionCleaning),false);
    await choose(page,'rest');
    assert.equal(await page.evaluate(async()=>(await import('/src/companion-life.js')).getCompanionLifeView((await import('/src/store.js')).getForumData().world.companion).sleeping),true);
    await choose(page,'rest');
    console.log('PASS A/B/C navigate, feed, clean and sleep inside the device');
    for(const panel of ['status','games','album','travel','dress']){
        await choose(page,panel);
        await page.screenshot({path:join(output,panel+'-desktop.png')});
        assert.equal(await page.locator('.tf-pet-device-page:not([hidden])').getAttribute('data-companion-panel'),panel);
    }
    await checkScenes(page, 'desktop'); await choose(page, 'dress');
    const appearance=page.locator('.tf-device-setting-group').nth(1); await appearance.locator('summary').click();
    await page.locator('[data-companion-appearance-field="bodyColor"]').fill('#aa6622');
    await choose(page,'home'); await choose(page,'dress');
    assert.equal(await page.locator('[data-companion-appearance-field="bodyColor"]').inputValue(),'#aa6622');
    await page.locator('[data-action="save-companion-appearance"]').click();
    assert.equal(await page.evaluate(()=>petTest.viewState.companionPanel),'dress');
    await choose(page,'status'); await page.locator('.tf-pet-pack-shortcut').click();
    assert.equal(await page.evaluate(()=>petTest.viewState.companionPanel),'travel');
    await choose(page,'games'); await page.locator('[data-action="pet-game-start"][data-game="catch"]').click();
    await page.waitForTimeout(250); await page.evaluate(()=>globalThis.layoutCanvas=document.querySelector('.tf-pet-arcade canvas'));
    const gameLabel=await page.locator('[data-action="companion-menu-confirm"]').getAttribute('aria-label');
    await choose(page,'album');
    assert.equal(await page.locator('[data-action="companion-menu-confirm"]').getAttribute('aria-label'),'确认');
    assert.equal(await page.evaluate(async()=>(await import('/src/store.js')).getForumData().world.companion.life.game.paused),true);
    await press(page,'C');
    assert.equal(await page.evaluate(()=>petTest.viewState.companionPanel),'home');
    assert.equal(await page.locator('[data-action="companion-menu-confirm"]').getAttribute('aria-label'),gameLabel);
    assert.equal(await page.evaluate(()=>layoutCanvas===document.querySelector('.tf-pet-arcade canvas')),true);
    await page.locator('.tf-arcade-pause [data-action="pet-game-stop"]').click();
    await page.evaluate(async()=>{const pet=(await import('/src/store.js')).getForumData().world.companion;petTest.viewState.companionFeedback=null;pet.life.growthNotice={id:'notice',from:'young',to:'adult',at:Date.now()};petTest.render();});
    await page.locator('[data-action="pet-growth-show"]').click();
    assert.equal(await page.locator('.tf-pet-growth-news').isVisible(),true);
    await page.locator('[data-action="pet-growth-ack"]').click();
    assert.equal(await page.locator('.tf-pet-growth-news').count(),0);
    assert.equal(await page.evaluate(()=>petCalls),0);
    console.log('PASS all screen panes, appearance persistence, packing, canvas continuity and growth');
    for(const width of [390,320]){
        const mobile=await open(true);await mobile.setViewportSize({width,height:900});
        for(const panel of ['home','menu','status','games','album','travel','dress']){
            await choose(mobile,panel);
            assert.equal(await mobile.locator('.tf-view').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,width+' '+panel+' outer overflow');
            if(panel!=='home')assert.equal(await mobile.locator('.tf-pet-device-page:not([hidden]) .tf-pet-device-content').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,width+' '+panel+' screen overflow');
            assert.equal(await mobile.locator('.tf-device-page-tabs:visible').count(), ['home','menu'].includes(panel)?0:1, width+' '+panel+' page tabs visibility');
            await mobile.screenshot({path:join(output,panel+'-mobile-'+width+'.png')});
        }
        await checkScenes(mobile, String(width));
        await choose(mobile,'status'); await mobile.locator('.tf-pet-care-settings > summary').click();
        await mobile.locator('[data-action="pet-mode"][data-mode="paused"]').click();
        await mobile.locator('.tf-pet-need [data-mode="active"]').click();
        assert.equal(await mobile.evaluate(async()=>(await import('/src/store.js')).getForumData().world.companion.life.mode),'active');
        await choose(mobile,'dress');await mobile.evaluate(()=>petListeners.get('chat_changed')());
        assert.equal(await mobile.evaluate(()=>petTest.viewState.companionPanel),'home');
        assert.equal(await mobile.evaluate(()=>petCalls),0);await mobile.close();
    }
    console.log('PASS all new scenes at desktop/390/320px, persistence, screen panes, pause/resume, chat isolation and zero API calls');
    assert.deepEqual(errors,[]);
} finally {await browser.close();await new Promise(done=>server.close(done));}
