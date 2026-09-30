import { openCompanionMenu } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-pet-growth-ui-'));
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
const readPet = page => page.evaluate(async () => { const { getForumData } = await import('/src/store.js'); return structuredClone(getForumData().world.companion); });
async function point(page, selector) {
    const box = await page.locator(selector).boundingBox(); assert.ok(box);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
const species = ['frog','cat','rabbit','fox','penguin','robo-bird','octopus','goldfish','soot','mystery'];
const stages = ['baby','young','adult'];
try {
    const sheet = await open();
    await sheet.setViewportSize({width:940,height:1850});
    await sheet.evaluate(async ({species,stages})=>{
        const {renderCompanionArtwork}=await import('/src/companion-art.js');
        document.head.insertAdjacentHTML('beforeend','<style>#tavern-forum-root{position:static!important;display:block!important;overflow:visible!important;height:auto!important;padding:24px;background:#f4efe6;color:#333}#growth-sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#growth-sheet section{display:flex;align-items:center;justify-content:center;flex-direction:column;padding:12px;background:#fffaf2;border-radius:12px}#growth-sheet svg{width:130px!important;height:130px!important}#growth-sheet *{animation:none!important}#growth-sheet small{font:12px sans-serif}</style>');
        document.querySelector('#tavern-forum-root').innerHTML='<main id="growth-sheet">'+species.flatMap(kind=>stages.map(stage=>'<section data-kind="'+kind+'" data-stage="'+stage+'"><svg class="tf-pixel-pet is-kind-'+kind+' is-growth-'+stage+' is-mini" viewBox="0 0 '+(kind==='cat'?72:64)+' 64" shape-rendering="crispEdges">'+renderCompanionArtwork(kind,'none',stage)+'</svg><small>'+kind+' · '+stage+'</small></section>')).join('')+'</main>';
        globalThis.checkAccessories=()=>{
            const failures=[];
            for(const kind of species)for(const stage of ['baby','young'])for(const accessory of ['scarf','satchel','flower','charm','ribbon','glasses','crown','leaf','headphones','cape','bell']){
                if(kind==='mystery')continue;
                const svg=document.querySelector('section[data-kind="'+kind+'"][data-stage="'+stage+'"] svg');svg.innerHTML=renderCompanionArtwork(kind,accessory,stage);
                const b=svg.getBBox();if(b.x < -2||b.y < -2||b.x+b.width>65||b.y+b.height>65)failures.push({kind,stage,accessory,x:b.x,y:b.y,w:b.width,h:b.height});
            }
            return failures;
        };
    },{species,stages});
    await sheet.locator('#growth-sheet').screenshot({path:join(output,'all-growth-stages.png')});
    const bounds=await sheet.evaluate(()=>checkAccessories());assert.deepEqual(bounds,[]);
    await sheet.locator('#growth-sheet').screenshot({path:join(output,'growth-accessory-bells.png')});
    console.log('PASS all stage silhouettes and 198 juvenile accessory fits stay within their canvas');await sheet.close();

    const care = await open();
    for (const stage of ['baby','young']) for (const speciesName of ['青蛙','黑猫','垂耳兔','赤狐','企鹅','机械鸟','章鱼','金鱼','煤球精灵']) {
        await care.evaluate(async({stage,speciesName})=>{const {getForumData}=await import('/src/store.js');const p=getForumData().world.companion;p.species=speciesName;p.life.stage=stage;p.life.growthNotice=null;p.status='home';p.life.sleepUntil=0;p.life.autoSleep=false;petTest.viewState.companionVisualAction='';petTest.render();},{stage,speciesName});
        await openCompanionMenu(care, 'feed', 'click');await care.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
        assert.notEqual(await care.locator('.tf-pet-sprite-control .tf-pixel-mouth-feed').evaluate(n=>getComputedStyle(n).display),'none');
        const motion=await care.locator('.tf-pet-sprite-control .tf-pixel-body-rig').evaluate(n=>getComputedStyle(n).animationName);assert.ok(motion.includes('feed'));
    }
    assert.equal(await care.evaluate(()=>petCalls),0);await care.close();console.log('PASS feeding expressions and body motion across juvenile forms');

    const page=await open();
    await page.evaluate(async()=>{
        const {getForumData}=await import('/src/store.js');const p=getForumData().world.companion;
        Object.assign(p,{name:'团子',species:'黑猫',bodyColor:'#35465a',accentColor:'#a9d8f2',accessory:'crown',accessoryColor:'#caa46b',status:'home'});
        Object.assign(p.life,{stage:'baby',growthMinutes:719,careDays:['2026-9-26','2026-9-27'],growthAlbum:[],growthNotice:null,lastTickAt:Date.now()-65000});
        await petTest.processCompanionJourneyClock();
    });
    assert.equal((await readPet(page)).life.stage,'young');
    await page.locator('.tf-pet-growth-news').waitFor({state:'attached'});
    assert.equal(await page.locator('.tf-pet-sprite-control [data-growth-stage="young"]').count(),1);
    const avatar=await page.evaluate(async()=>{const {getForumData}=await import('/src/store.js');return petTest.renderCompanionAvatar(getForumData());});assert.match(avatar,/data-growth-stage="young"/);
    const album=(await readPet(page)).life.growthAlbum;assert.equal(album.length,2);assert.equal(album[0].bodyColor,'#35465a');
    await page.locator('[data-action="pet-growth-show"]').click();assert.equal(await page.locator('.tf-pet-growth-news.is-replaying').count(),1);await page.waitForTimeout(1450);await page.screenshot({path:join(output,'growth-celebration-desktop.png')});
    await page.locator('[data-action="pet-growth-ack"]').click();assert.equal((await readPet(page)).life.growthNotice,null);
    await page.evaluate(async()=>{const {getForumData}=await import('/src/store.js');const p=getForumData().world.companion;p.bodyColor='#cc8844';p.species='狐狸';petTest.render();});
    assert.equal((await readPet(page)).life.growthAlbum[0].species,'黑猫');
    const oldPhoto=page.locator('.tf-growth-photos figure').first();assert.equal(await oldPhoto.locator('svg.is-kind-cat').count(),1);assert.match(await oldPhoto.locator('svg').getAttribute('style'),/#35465a/);
    await page.locator('.tf-pet-growth-album').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,'growth-album-desktop.png')});
    assert.equal(await page.evaluate(()=>petCalls),0);await page.close();
    console.log('PASS automatic growth updates room and DM avatars, records snapshots and preserves old identity/colors');

    const mobile=await open(true);
    await mobile.evaluate(async()=>{const {getForumData}=await import('/src/store.js');const p=getForumData().world.companion;p.life.stage='young';p.life.growthMinutes=2879;p.life.careDays=['1','2','3','4'];p.life.lastTickAt=Date.now()-65000;await petTest.processCompanionJourneyClock();});
    await mobile.locator('[data-action="pet-growth-show"]').tap();await mobile.waitForTimeout(1450);await mobile.screenshot({path:join(output,'growth-celebration-mobile.png')});
    assert.equal((await readPet(mobile)).life.stage,'adult');
    await mobile.locator('[data-action="pet-growth-ack"]').tap();
    await mobile.locator('.tf-pet-growth-album').scrollIntoViewIfNeeded();assert.equal(await mobile.locator('.tf-app').evaluate(n=>n.scrollWidth>n.clientWidth+2),false);
    await mobile.screenshot({path:join(output,'growth-album-mobile.png')});
    await mobile.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await mobile.locator('.tf-pixel-growth-motion').first().evaluate(n=>getComputedStyle(n).animationName),'none');
    await mobile.evaluate(()=>{const ctx=SillyTavern.getContext();ctx.chatId='growth-other';ctx.chatMetadata={tavern_forum_data:{world:{companion:{name:'另一只',life:{autoSleep:false}}}}};petListeners.get('chat_changed')();});
    assert.equal(await mobile.locator('.tf-pet-growth-news').count(),0);assert.equal((await readPet(mobile)).life.growthAlbum.length,0);
    assert.equal(await mobile.evaluate(()=>petCalls),0);await mobile.close();
    console.log('PASS mobile growth, album, reduced motion and chat isolation without API calls');
    assert.deepEqual(errors,[]);console.log('Screenshots:',output);
}finally{await browser.close();await new Promise(done=>server.close(done));}
