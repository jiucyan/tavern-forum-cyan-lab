import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

// Exercise real delegated clicks, the roaming controller, the visual wait, and
// the saved model together. The clock lets us inspect the uncommitted midpoint.
const root = process.cwd(), output = await mkdtemp(join(tmpdir(), 'forum-no-tank-'));
console.log('ARTIFACTS', output);
const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body.toString()
            .replace('companionRoamController ||= createCompanionRoamController({', 'companionRoamController ||= createCompanionRoamController({ random: () => .8,')
            + '\nglobalThis.petTest={viewState,render,closeForum,openForum,cancelHomesteadMotion,showCompanionPanel,careForCompanion,handleHomesteadAction,interactWithHomestead,openCompanionFoodMenu,moveTo:(p)=>companionRoamController.moveTo(p),sync:()=>companionRoamController.sync(),resetRoam(){companionRoamController?.destroy();companionRoamController=null;}};');
        res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], checks = [];

async function fixture(page, { location = 'home', skin = 'classic', species = '斗鱼', stage = 'adult', avatarUrl = '' } = {}) {
    await page.evaluate(async values => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const { createCompanionRoomPreset } = await import('/src/companion-room.js');
        const { normalizeHomestead, ensureHomesteadStarter } = await import('/src/companion-homestead.js');
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
        data.world.inventory = []; data.world.trips = []; pet.homestead = normalizeHomestead({ location: values.location, visited: ['home', 'yard', 'forest', 'river'] });
        Object.assign(pet, { name: '团子', species: values.species, status: 'home', satiety: 45, happiness: 70, energy: 80, bond: 5,
            habitat: 'meadow', lastInteractionAt: 0, lastAction: '', deviceSkin: values.skin, avatarUrl: values.avatarUrl, accessory: 'none',
            bodyColor: '', accentColor: '', weather: 'sunny', timeOfDay: 'day', message: '', packedItemIds: [], carrying: '', room: createCompanionRoomPreset('cozy') });
        Object.assign(pet.life, { stage: values.stage, mode: 'active', cleanliness: 70, game: null, autoSleep: false, sleepUntil: 0, awakeUntil: 0,
            roomBedId: '', growthNotice: null, lastTickAt: Date.now(), greetingDay: '2026-10-12', actionAt: {}, foodLikes: [], diary: [], milestones: [] });
        ensureHomesteadStarter(data); petTest.resetRoam(); petTest.render();
    }, { location, skin, species, stage, avatarUrl });
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded(); await page.clock.runFor(50);
    await page.evaluate(async () => Promise.all([...document.querySelectorAll('.tf-pet-sprite-control image')].map(async el => {
        const img = new Image(); img.src = el.getAttribute('href'); await img.decode();
    })));
}

async function geometry(page) {
    return page.evaluate(() => {
        const c = document.querySelector('.tf-pet-sprite-control'), h = document.querySelector('.tf-aquatic-habitat'), s = document.querySelector('.tf-pet-stage');
        const b = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
        return { control:b(c), canvas:b(c.querySelector('.tf-pixel-avatar')), habitat:h?b(h):null, stage:b(s), location:s.dataset.aquaticHabitat, mode:s.dataset.aquaticMode, detached: !h || h.parentElement===s, aquariumInPet: c.querySelectorAll('.tf-aquatic-habitat,.tf-aquatic-back,.tf-aquatic-wheel').length };
    });
}
async function finish(page) { for (let i=0; i<150 && await page.evaluate(()=>petTest.viewState.companionHomesteadBusy); i++) await page.clock.runFor(50); }
try {
 for (const width of [1280,320].filter(value=>!process.argv.some(arg=>arg.startsWith('--width=')) || process.argv.includes(`--width=${value}`))) {
    const page = await browser.newPage({viewport:{width,height:900},hasTouch:width===320}); page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-10-12T12:00:00+08:00')}); await page.clock.pauseAt(new Date('2026-10-12T12:00:00+08:00'));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`); await page.waitForFunction(()=>globalThis.petTest);
    for (const [species,stage] of process.argv.some(arg=>['--care-only','--feed-only'].includes(arg)) ? [] : [['斗鱼','baby'],['斗鱼','young'],['斗鱼','adult'],['青蛙','baby']]) for (const location of process.argv.includes('--indoor-only') ? ['home','kitchen'] : ['home','yard','forest','river','kitchen']) {
        await fixture(page,{species,stage,location}); const before=await geometry(page);
        const indoor = ['home','kitchen'].includes(location);
        assert.ok(before.detached); assert.equal(before.aquariumInPet,0); assert.equal(before.location,location);
        assert.ok(Math.abs(before.canvas.w/before.stage.w-.2375)<.002,'same room-relative aquatic canvas across home, kitchen and outdoor scenes');
        assert.ok(before.control.w>=44 && before.control.h>=44,'the visible-animal hit area remains touchable');
        if (indoor) {
            assert.equal(before.mode,'free'); assert.equal(before.habitat,null);
            assert.equal(await page.locator('.tf-aquatic-habitat,.tf-aquatic-surface').count(),0);
            assert.doesNotMatch(await page.locator('.tf-pet-move-guide').innerText(),/水面|鱼缸|水草/);
        }
        const beforeWater=before.habitat;
        const aquatic = await page.evaluate(async location => (await import('/src/companion-aquatic.js')).getAquaticHabitat(location),location);
        const point = [aquatic.bounds[1],aquatic.bounds[2]];
        const accepted = await page.evaluate(({s,point})=>petTest.moveTo({clientX:s.x+s.w*point[0]/320,clientY:s.y+s.h*point[1]/240}),{s:before.stage,point});
        assert.equal(accepted,true); await page.clock.runFor(indoor?6500:2600);
        const after=await geometry(page); assert.deepEqual(after.habitat,beforeWater,'water never follows resident');
        assert.ok(Math.abs(after.control.x-before.control.x)>1,'pet swims');
        assert.ok(after.control.x>=after.stage.x-.5 && after.control.y>=after.stage.y-.5
            && after.control.x+after.control.w<=after.stage.x+after.stage.w+.5
            && after.control.y+after.control.h<=after.stage.y+after.stage.h+.5,`${width}/${species}/${stage}/${location}: whole touch target remains inside scene at movement boundary ${JSON.stringify(after)}`);
        if (indoor) {
            const pointer = {x:before.stage.x+before.stage.w*.2,y:before.stage.y+before.stage.h*.2};
            if (width===320) await page.touchscreen.tap(pointer.x,pointer.y);
            else await page.mouse.click(pointer.x,pointer.y);
            assert.equal(await page.locator('.tf-pet-sprite-control').getAttribute('data-roam-mode'),'manual','real empty-scene click starts swimming');
            await page.clock.runFor(7500);
            const moved=await geometry(page);
            assert.ok(moved.control.x < moved.stage.x + moved.stage.w*.25,'reaches left side beyond the old tank');
            assert.ok(moved.control.y < moved.stage.y + moved.stage.h*.25,'reaches upper room beyond the old tank');
            assert.ok(moved.control.x >= moved.stage.x-.5 && moved.control.y >= moved.stage.y-.5);
            assert.ok(moved.control.x+moved.control.w <= moved.stage.x+moved.stage.w+.5 && moved.control.y+moved.control.h <= moved.stage.y+moved.stage.h+.5);
        } else {
            const land = await page.evaluate(s=>petTest.moveTo({clientX:s.x+s.w*.2,clientY:s.y+s.h*.2}),before.stage); assert.equal(land,false,'outdoor water bounds');
        }
        await page.locator('.tf-pet-stage').screenshot({path:join(output,`${width}-${species}-${stage}-${location}.png`)});
        checks.push({width,species,stage,location,containerAbsent:indoor,waterFixed:!indoor,freeSwim:indoor,landRejected:!indoor});
    }
    if (process.argv.includes('--move-only')) { await page.close(); continue; }
    for (const [species,stage] of [['斗鱼','baby'],['斗鱼','young'],['斗鱼','adult'],['青蛙','baby']]) {
        await fixture(page,{species,stage});
        await page.evaluate(()=>petTest.openCompanionFoodMenu());
        await page.locator('[data-action="companion-feed-food"][data-food-id="fish-flake"]').click();
        await page.clock.runFor(1400);
        const feeding=await page.evaluate(()=>{const c=document.querySelector('.tf-pet-sprite-control'), f=c.querySelector('.tf-feed-drop'), o=c.querySelector('.tf-food-offering');const b=c.getBoundingClientRect(),d=f.getBoundingClientRect();return {width:b.width,canvas:parseFloat(getComputedStyle(c.querySelector('.tf-pixel-avatar')).width),dropWidth:d.width,dx:Math.abs(b.x-d.x),dy:Math.abs(b.y-d.y),food:parseFloat(getComputedStyle(o).width),stage:document.querySelector('.tf-pet-stage').dataset.aquaticHabitat};});
        assert.ok(Math.abs(feeding.width-feeding.dropWidth)<.1 && feeding.dx<.1 && feeding.dy<.1); assert.ok(feeding.food<feeding.canvas*.2); assert.equal(feeding.stage,'home');
        await page.locator('.tf-pet-stage').screenshot({path:join(output,`${width}-${species}-${stage}-feeding.png`)});
        checks.push({width,species,stage,careFeed:true});
    }
    if (process.argv.includes('--feed-only')) { await page.close(); continue; }
    await fixture(page,{location:'home'});
    await page.evaluate(()=>{ void petTest.careForCompanion('rest'); }); await page.clock.runFor(50);
    const sleep=await page.evaluate(async()=>{const p=(await import('/src/store.js')).getForumData().world.companion; return {bed:p.life.roomBedId,mode:document.querySelector('.tf-pet-stage').dataset.aquaticMode,habitats:document.querySelectorAll('.tf-aquatic-habitat,.tf-aquatic-surface').length,pose:document.querySelector('.tf-pet-sprite-control').dataset.roomPose,message:p.message};});
    assert.equal(sleep.bed,''); assert.equal(sleep.pose,undefined); assert.equal(sleep.mode,'free'); assert.equal(sleep.habitats,0); assert.doesNotMatch(sleep.message,/水草|水面|缸/);
    await page.locator('.tf-pet-stage').screenshot({path:join(output,`${width}-sleep.png`)});
    await fixture(page,{location:'yard'});
    await page.evaluate(()=>{void petTest.interactWithHomestead({dataset:{target:'plot:plot-1',x:'47',y:'144'}});}); await page.clock.runFor(20);
    assert.equal(await page.evaluate(()=>petTest.viewState.companionHomesteadPanel),'plot:plot-1');
    const seedBefore=await page.evaluate(async()=>{const d=(await import('/src/store.js')).getForumData();return (await import('/src/companion-homestead.js')).getPetItemCount(d,'carrot-seed');});
    await page.evaluate(()=>{void petTest.handleHomesteadAction('plant',{dataset:{plotId:'plot-1',cropId:'carrot'}});}); await page.clock.runFor(350);
    assert.equal(await page.locator('.tf-pet-stage > [data-player-task="plant"]').count(),1);
    await page.locator('.tf-pet-stage').screenshot({path:join(output,`${width}-plant.png`)});
    await page.evaluate(()=>petTest.cancelHomesteadMotion()); await page.clock.runFor(100);
    assert.equal(await page.evaluate(async()=>{const d=(await import('/src/store.js')).getForumData();return (await import('/src/companion-homestead.js')).getPetItemCount(d,'carrot-seed');}),seedBefore);
    await page.evaluate(()=>{void petTest.handleHomesteadAction('plant',{dataset:{plotId:'plot-1',cropId:'carrot'}});}); await finish(page);
    assert.equal(await page.evaluate(async()=>{const d=(await import('/src/store.js')).getForumData();return d.world.companion.homestead.plots[0].cropId;}),'carrot');
    await fixture(page,{location:'forest'});
    await page.locator('[data-target="node:berry-bush"]').click(); await page.clock.runFor(150); await finish(page);
    assert.equal(await page.evaluate(async()=>{const d=(await import('/src/store.js')).getForumData();return (await import('/src/companion-homestead.js')).getPetItemCount(d,'berry');}),2);
    for (const [target,location] of [['location:yard','yard'],['location:home','home'],['location:kitchen','kitchen']]) {
        await page.locator(`.tf-homestead-bar [data-target="${target}"]`).first().click(); await page.clock.runFor(50);
        assert.equal(await page.evaluate(async()=>(await import('/src/store.js')).getForumData().world.companion.homestead.location),location);
    }
    await page.locator('.tf-pet-stage [data-target="stove"]').click(); await page.clock.runFor(50);
    assert.equal(await page.evaluate(()=>petTest.viewState.companionHomesteadPanel),'kitchen');
    await page.evaluate(()=>{void petTest.handleHomesteadAction('cook',{dataset:{recipeId:'bento'}});}); await page.clock.runFor(1400);
    await page.locator('.tf-pet-stage').screenshot({path:join(output,`${width}-water-kitchen-work.png`)}); await finish(page);
    assert.equal(await page.evaluate(async()=>{const d=(await import('/src/store.js')).getForumData();return (await import('/src/companion-homestead.js')).getPetItemCount(d,'bento');}),2);
    await fixture(page,{location:'river'});
    await page.locator('.tf-pet-stage [data-target="fishing"]').click(); await page.clock.runFor(50);
    await page.locator('[data-homestead-action="fish-cast"]').click(); await page.clock.runFor(100);
    const fishing=await page.evaluate(async()=>(await import('/src/store.js')).getForumData().world.companion.homestead.fishing);
    assert.ok(fishing?.biteAt);
    await page.clock.runFor(await page.evaluate(at=>Math.max(0,at-Date.now()+100),fishing.biteAt));
    assert.equal(await page.locator('.tf-fishing-overlay').getAttribute('data-fishing-phase'),'bite');
    await page.locator('.tf-fishing-overlay [data-homestead-action="fish-reel"]').click(); await page.clock.runFor(450);
    await page.locator('.tf-pet-stage').screenshot({path:join(output,`${width}-fish-reel.png`)}); await finish(page);
    assert.equal(await page.evaluate(async id=>{const d=(await import('/src/store.js')).getForumData();return (await import('/src/companion-homestead.js')).getPetItemCount(d,id);},fishing.fishId),1);
    checks.push({width,careAndGardening:true,cancelAtomic:true,sceneRoutes:true,gatherCook:true,fishing:true});
    await fixture(page,{species:'青蛙',stage:'young'}); assert.equal(await page.locator('[data-aquatic-habitat]').count(),0);
    await fixture(page,{avatarUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'}); assert.equal(await page.locator('[data-aquatic-habitat]').count(),0);
    await page.close();
 }
 assert.deepEqual(errors,[]); console.log(JSON.stringify({checks:checks.length,output}));
} finally { await writeFile(join(output,'checks.json'),JSON.stringify({checks,errors},null,2)); await browser.close(); await new Promise(r=>server.close(r)); }
