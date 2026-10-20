import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd(), baseline = process.argv.includes('--baseline');
const checkResources = process.argv.includes('--check-resources');
const reference = process.argv.find(value => value.startsWith('--reference='))?.slice(12) || 'HEAD';
const displayFiles = new Set(['style.css', 'src/companion-art.js', 'src/companion-growth-art.js', 'src/companion-device-ui.js', 'src/companion-roam.js']);
const resourceErrors = [], referenceSources = new Map();
const output = await mkdtemp(join(tmpdir(), `forum-pet-scale-${baseline ? 'before' : 'after'}-`));
console.log('ARTIFACTS', output);
const server = createServer(async (request, response) => {
    let pathname = request.url;
    try {
        pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const path = resolve(root, '.' + pathname);
        if (!path.startsWith(root + sep)) throw Error('outside root');
        // The optional comparison serves committed display sources read-only;
        // it never checks out files or changes the working version under test.
        let body;
        if (baseline && displayFiles.has(pathname.slice(1))) {
            if (!referenceSources.has(pathname)) referenceSources.set(pathname,
                execFileSync('git', ['show', `${reference}:${pathname.slice(1)}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 }));
            body = referenceSources.get(pathname);
        } else body = await readFile(path);
        if (pathname === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.scaleTest={viewState,render,openCompanionFoodMenu,resetRoam(){companionRoamController?.destroy();companionRoamController=null;},moveTo:p=>companionRoamController.moveTo(p)};');
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(path)] || 'application/octet-stream' });
        response.end(body);
    } catch (error) {
        const message = `${pathname}: ${error.message}`;
        if (pathname !== '/favicon.ico') {
            resourceErrors.push(message);
            process.stderr.write(`Fixture resource failed: ${message}\n`);
        }
        response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(message);
    }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
const measurements = [], errors = [];
function assertResourcesSucceeded() {
    assert.deepEqual(resourceErrors, [], 'source resources must load successfully before a comparison is valid');
    assert.deepEqual(errors, [], 'the preview must initialize without script or request failures');
}
async function assertStylesLoaded(page) {
    assertResourcesSucceeded();
    const styles = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => {
        try { return { href: link.href, rules: link.sheet?.cssRules.length || 0 }; }
        catch (error) { return { href: link.href, rules: 0, error: error.message }; }
    }));
    assert.ok(styles.some(style => new URL(style.href).pathname === '/style.css'), 'the preview must request the plugin stylesheet');
    assert.ok(styles.every(style => style.rules > 0), `every requested stylesheet must contain loaded CSS rules: ${JSON.stringify(styles)}`);
}
try {
    if (checkResources) {
        for (const pathname of ['/preview.html', ...[...displayFiles].map(path => '/' + path), '/src/ui-v3.js']) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}${pathname}`);
            const body = await response.text();
            assert.equal(response.status, 200, `${pathname} failed with HTTP ${response.status}: ${body}`);
            assert.ok(body.length > 0, `${pathname} must not be empty`);
            if (pathname === '/style.css') {
                assert.match(response.headers.get('content-type'), /text\/css/);
                assert.ok(body.includes('#tavern-forum-root'), 'the CSS response must contain the plugin rules');
                console.log(`PASS ${baseline ? reference : 'working tree'} stylesheet loads (${Buffer.byteLength(body)} bytes)`);
            }
        }
        assertResourcesSucceeded();
        console.log('PASS preview display sources load without a browser or screenshots');
    } else {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    for (const width of [1280, 390, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {
            const pathname = new URL(response.url()).pathname;
            if (response.status() >= 400 && pathname !== '/favicon.ico') errors.push(`HTTP ${response.status()}: ${response.url()}`);
        });
        page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText || 'request failed'}`));
        await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
        await assertStylesLoaded(page);
        await page.waitForFunction(() => globalThis.scaleTest);
        await page.clock.install();
        for (const [species, kind] of [['青蛙', 'frog'], ['黑猫', 'cat'], ['斗鱼', 'goldfish']]) for (const stage of ['baby', 'young', 'adult']) {
            await page.evaluate(async values => {
                const { getForumData, getSettings } = await import('/src/store.js');
                const { createCompanionRoomPreset } = await import('/src/companion-room.js');
                const { normalizeHomestead, ensureHomesteadStarter } = await import('/src/companion-homestead.js');
                const pet = getForumData().world.companion, view = scaleTest.viewState;
                for (const name of ['companionActionTimer', 'companionFeedbackTimer', 'companionRitualTimer', 'companionJourneyTimer']) clearTimeout(view[name]);
                view.companionClockGeneration++; view.companionActionToken++;
                Object.assign(view, { open: true, worldPage: 'travel', companionPanel: 'home', companionVisualAction: '', companionFoodMenuOpen: false, companionCleaning: false, companionFeedback: null, companionRitual: null, companionRoomCare: null, companionGameResultOpen: false, companionHomesteadPanel: '', companionHomesteadCommand: null, companionHomesteadFxUntil: 0 });
                getSettings().ui.activeTab = 'services'; getSettings().modules.travel.enabled = true;
                Object.assign(pet, { name: '团子', species: values.species, status: 'home', avatarUrl: '', accessory: 'none', lastAction: '', room: createCompanionRoomPreset('cozy'), homestead: normalizeHomestead({ location: 'home' }), habitat: 'meadow', weather: 'sunny', timeOfDay: 'day', message: '', satiety: 80, energy: 80, happiness: 80 });
                Object.assign(pet.life, { stage: values.stage, mode: 'active', autoSleep: false, sleepUntil: 0, awakeUntil: 0, lastTickAt: Date.now(), growthNotice: null, game: null, actionAt: {}, foodLikes: [], diary: [], milestones: [] });
                ensureHomesteadStarter(getForumData()); scaleTest.resetRoam(); scaleTest.render();
            }, { species, stage });
            await page.clock.runFor(50);
            await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
            await page.evaluate(async () => Promise.all([...document.querySelectorAll('.tf-pet-sprite-control image')].map(async el => { const image = new Image(); image.src = el.getAttribute('href'); await image.decode(); })));
            await assertStylesLoaded(page);
            const measured = await page.evaluate(() => {
                const control = document.querySelector('.tf-pet-sprite-control'), svg = control.querySelector('.tf-pixel-pet'), character = svg.querySelector('.tf-pixel-character'), room = control.closest('.tf-pet-stage');
                const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
                const raster = character.querySelector('.tf-raster-frame.is-idle svg');
                let body;
                {
                    const b = raster ? { x:raster.x.baseVal.value,y:raster.y.baseVal.value,width:raster.width.baseVal.value,height:raster.height.baseVal.value } : character.getBBox(), m = svg.getScreenCTM();
                    const corners = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y]) => ({ x:m.a*x+m.c*y+m.e, y:m.b*x+m.d*y+m.f }));
                    const xs=corners.map(p=>p.x), ys=corners.map(p=>p.y); body={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
                }
                const bounds = character.getBBox();
                const raw = raster ? [raster.x.baseVal.value, raster.y.baseVal.value, raster.width.baseVal.value, raster.height.baseVal.value] : [bounds.x, bounds.y, bounds.width, bounds.height];
                const pseudo = getComputedStyle(control, '::before');
                const shadow=control.querySelector('.tf-pet-character-shadow'), shadowRect=shadow?rect(shadow):null, c=rect(control);
                const anchor=control.hasAttribute('data-aquatic')?{x:c.x+c.width/2,y:c.y+c.height/2}:shadowRect?{x:shadowRect.x+shadowRect.width/2,y:shadowRect.y+shadowRect.height/2}:null;
                return { room:rect(room), control:c, canvas:rect(svg), body, raw, anchor, aquatic:control.dataset.aquatic||'', hitWidth:Math.max(c.width,parseFloat(pseudo.width)||0),hitHeight:Math.max(c.height,parseFloat(pseudo.height)||0),canvasTransform:getComputedStyle(svg).transform, overflow:document.querySelector('.tf-app').scrollWidth>document.querySelector('.tf-app').clientWidth+1 };
            });
            measurements.push({ width, kind, stage, ...measured });
            await page.locator('.tf-pet-stage').screenshot({ path: join(output, `${width}-${kind}-${stage}.png`) });
            if (width === 390 && kind === 'frog' && stage === 'baby') await page.screenshot({ path: join(output, '390-frog-baby-full.png') });
            if (!baseline) {
                assert.equal(measured.overflow, false);
                assert.ok(measured.hitWidth >= 44 && measured.hitHeight >= 44);
                assert.ok(measured.body.width >= measured.room.width * .14 && measured.body.height >= measured.room.width * .10, `${width}/${kind}/${stage}: the painted animal must remain readable beside the furniture`);
                assert.ok(measured.body.width <= measured.room.width * .26 && measured.body.height <= measured.room.width * .22, `${width}/${kind}/${stage}: the animal must still fit the room scale`);
                if (measured.aquatic) {
                    assert.ok(Math.abs(measured.body.x + measured.body.width / 2 - measured.anchor.x) < 1);
                    assert.ok(Math.abs(measured.body.y + measured.body.height / 2 - measured.anchor.y) < 1);
                } else {
                    assert.equal(measured.canvasTransform, 'none', 'land animals retain their original canvas and floor projection');
                    assert.ok(Math.abs(measured.body.y + measured.body.height - measured.anchor.y) < measured.room.width*.018, `${width}/${kind}/${stage}: native feet remain within the original floor-shadow allowance (${(measured.body.y+measured.body.height-measured.anchor.y).toFixed(2)}px)`);
                }
            }
            if (measured.aquatic && !baseline) {
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                await page.evaluate(() => scaleTest.openCompanionFoodMenu());
                await page.locator('[data-action="companion-feed-food"][data-food-id="fish-flake"]').click();
                await page.clock.runFor(1400);
                const feeding = await page.evaluate(({kind,stage}) => {
                    const control=document.querySelector('.tf-pet-sprite-control'), svg=control.querySelector('.tf-pixel-pet'), food=control.querySelector('.tf-food-offering');
                    for(const animation of food.getAnimations()) { animation.pause(); animation.currentTime=Number(animation.effect.getTiming().duration)*.52; }
                    // These are landmarks in the unmodified source artwork, independent
                    // of the CSS variables that position the food.
                    const [x,y]=kind==='frog'?[28,49]:stage==='baby'?[14,44]:stage==='young'?[11,39]:[6.1,30.8];
                    const m=svg.getScreenCTM(), mouth={x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
                    const r=food.getBoundingClientRect(), center={x:r.x+r.width/2,y:r.y+r.height/2};
                    return {distance:Math.hypot(center.x-mouth.x,center.y-mouth.y),mouth,center,opacity:Number(getComputedStyle(food).opacity)};
                }, {kind,stage});
                assert.ok(feeding.opacity > .9 && feeding.distance < 8, `${width}/${kind}/${stage}: a visible bite reaches the painted mouth (${feeding.distance.toFixed(2)}px)`);
                measurements.at(-1).feeding=feeding;
                await assertStylesLoaded(page);
                await page.locator('.tf-pet-stage').screenshot({path:join(output,`${width}-${kind}-${stage}-feeding.png`)});
                await page.emulateMedia({ reducedMotion: 'reduce' });
            }
        }
        await page.close();
    }
    await writeFile(join(output, 'measurements.json'), JSON.stringify(measurements, null, 2));
    if (!baseline) for (const width of [1280,390,320]) for (const kind of ['frog','cat','goldfish']) {
        const rows=measurements.filter(row=>row.width===width&&row.kind===kind), baby=rows.find(row=>row.stage==='baby'),adult=rows.find(row=>row.stage==='adult');
        assert.ok(baby.body.height > adult.body.height*.55 && baby.body.height < adult.body.height*.9, `${width}/${kind}: the juvenile silhouette remains smaller than the adult`);
    }
    console.log(JSON.stringify(measurements.map(({width,kind,stage,room,body,anchor,aquatic,raw})=>({width,kind,stage,room:Math.round(room.width),body:[body.width,body.height].map(n=>Math.round(n*10)/10),raw,anchor,aquatic})),null,2));
    assertResourcesSucceeded();
    }
} finally {
    await browser?.close();
    await new Promise(done => server.close(done));
}
