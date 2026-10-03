import { openCompanionMenu, returnCompanionHome } from './companion-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve('.'), output = await mkdtemp(join(tmpdir(), 'forum-companion-packing-ui-'));
console.log('Artifacts:', output);
const server = createServer(async (request, response) => {
    try {
        const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname), file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render };');
        if (path === '/preview.html') body = Buffer.from(body.toString()
            .replace('const listeners = new Map();', `const savedMetadata = localStorage.getItem('forum-packing-test-metadata');
    if (savedMetadata) Object.assign(metadata, JSON.parse(savedMetadata));
    const listeners = globalThis.petListeners = new Map();`)
            .replace('saveSettingsDebounced() {}, saveMetadataDebounced() {}, async saveMetadata() {}, setExtensionPrompt() {},', `saveSettingsDebounced() {},
        saveMetadataDebounced() { localStorage.setItem('forum-packing-test-metadata', JSON.stringify(context.chatMetadata)); },
        async saveMetadata() { localStorage.setItem('forum-packing-test-metadata', JSON.stringify(context.chatMetadata)); }, setExtensionPrompt() {},`));
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [];
const note = page => page.locator('.tf-packing-note [data-companion-field="carrying"]');
const readWorld = page => page.evaluate(async () => structuredClone((await import('/src/store.js')).getForumData().world));
const carrying = '一块小毛巾、饼干 ×3，沿途拍照，平安回来。';
const departureNote = '带好蓝色小毛巾、饼干 ×3，去湖边看夕阳。';
const travelPlan = { worldUpdates: { travel: {
    companion: { name: '团子', species: '黑猫', status: 'away', mood: '期待', destination: '湖边小路', message: '带好小毛巾，去湖边看风景啦。' },
    journeys: [{ destination: '湖边小路', traveler: '团子', status: 'away', departureMessage: '带好小毛巾，去湖边看风景啦。',
        messages: [{ content: '我走到了湖边，旅途平安。', progress: .25 }, { content: '树荫下很凉快，我歇了一会儿。', progress: .6 }],
        returnMessage: '我平安回来啦。', notes: '沿湖边小路拍了照。', souvenir: '湖边小石子', souvenirDescription: '一块光滑的小石子。' }],
} } };

async function showTravel(page, { reset = false } = {}) {
    await page.evaluate(async reset => {
        const { getForumData, getSettings } = await import('/src/store.js');
        const settings = getSettings(), world = getForumData().world;
        settings.modules.travel.enabled = true; settings.modules.travel.apiProfileId = 'sillytavern-default';
        settings.activeApiProfileId = 'sillytavern-default'; settings.modules.travel.generationMode = 'independent';
        settings.sources.worldInfo = false; settings.ui.activeTab = 'services';
        Object.assign(petTest.viewState, { open: true, worldPage: 'travel', companionPanel: 'home' });
        if (reset) {
            world.inventory = []; world.trips = [];
            Object.assign(world.companion, { name: '团子', species: '黑猫', status: 'home', carrying: '', packedItemIds: [], satiety: 75, energy: 80 });
            Object.assign(world.companion.life, { autoSleep: false, sleepUntil: 0, greetingDay: '2999-1-1' });
        }
        globalThis.packingCalls = 0;
        SillyTavern.getContext().generateRaw = async () => { packingCalls++; throw Error('Local packing must not call API'); };
        petTest.render();
    }, reset);
}

async function open(width = 1280) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 390 });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await showTravel(page, { reset: true });
    await openCompanionMenu(page, 'travel', width <= 390 ? 'tap' : 'click');
    await note(page).waitFor({ state: 'visible' });
    return page;
}

async function enterNote(page, value) {
    await note(page).fill(value);
    await note(page).press('Tab');
    await page.waitForFunction(async value => (await import('/src/store.js')).getForumData().world.companion.carrying === value, value);
    assert.equal(await note(page).inputValue(), value);
}

async function assertFits(page, label) {
    const boxes = await note(page).evaluate(input => {
        const pane = input.closest('.tf-pet-device-page'), content = input.closest('.tf-pet-device-content'), device = input.closest('.tf-companion-device');
        const box = node => node.getBoundingClientRect().toJSON();
        return { input: box(input), content: box(content), device: box(device), width: innerWidth,
            overflow: content.scrollWidth > content.clientWidth + 2,
            controls: [...pane.querySelectorAll('button')].map(box) };
    });
    assert.equal(boxes.overflow, false, `${label}: travel page overflows horizontally`);
    assert.ok(boxes.device.left >= -2 && boxes.device.right <= boxes.width + 2, `${label}: device exceeds viewport`);
    assert.ok(boxes.input.left >= boxes.content.left - 2 && boxes.input.right <= boxes.content.right + 2, `${label}: packing input exceeds pane`);
    assert.ok(boxes.controls.every(box => box.width === 0 || (box.left >= boxes.device.left - 2 && box.right <= boxes.device.right + 2)), `${label}: travel controls exceed device`);
}

async function assertActionContrast(page, label) {
    const buttons = await page.locator('.tf-pet-trip-actions button').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        return { text: node.textContent.trim(), color: style.color, background: style.backgroundColor };
    }));
    const luminance = color => {
        const rgb = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
        assert.ok(rgb, `${label}: action has an opaque background and text color (${color})`);
        return rgb.slice(1).map(channel => {
            const value = Number(channel) / 255;
            return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    };
    for (const button of buttons) {
        assert.ok(button.text, `${label}: travel action has a label`);
        const foreground = luminance(button.color), background = luminance(button.background);
        const contrast = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
        assert.ok(contrast >= 4.5, `${label}: ${button.text} has unreadable text (contrast ${contrast.toFixed(2)})`);
    }
}

try {
    const page = await open();
    await assertActionContrast(page, 'before departure');
    assert.equal(await page.locator('[data-companion-field="carrying"]').count(), 1, 'the travel field replaces the hidden dressing field');
    assert.equal(await note(page).isEditable(), true, 'an empty backpack permits a handwritten note');
    await enterNote(page, carrying);
    let world = await readWorld(page);
    assert.deepEqual(world.inventory, [], 'handwritten quantities never create inventory');
    assert.deepEqual(world.companion.packedItemIds, []);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('forum-packing-test-metadata')).tavern_forum_data.world.companion.carrying), carrying);
    await returnCompanionHome(page); await openCompanionMenu(page, 'status');
    await page.locator('.tf-pet-pack-shortcut').click();
    assert.equal(await page.locator('.tf-companion-device').getAttribute('data-device-page'), 'travel');
    assert.equal(await note(page).evaluate(node => document.activeElement === node), true, 'the status shortcut focuses the note with an empty backpack');
    assert.equal(await note(page).inputValue(), carrying);
    await page.reload(); await page.waitForFunction(() => globalThis.petTest); await showTravel(page);
    await openCompanionMenu(page, 'travel');
    assert.equal(await note(page).inputValue(), carrying, 'saved note survives a real reload');
    assert.deepEqual((await readWorld(page)).inventory, []);
    assert.equal(await page.evaluate(() => packingCalls), 0);
    console.log('PASS empty-backpack note is visible, editable, focused by the status shortcut and saved across reload');

    await page.evaluate(async () => {
        const world = (await import('/src/store.js')).getForumData().world;
        world.inventory = [
            { id: 'packing-food', name: '鱼肉饼', quantity: 3, usable: true, consumed: false, source: '回归测试' },
            { id: 'packing-map', name: '小地图', quantity: 1, usable: true, consumed: false, source: '回归测试' },
        ];
        petTest.render();
    });
    await page.locator('[data-packed-item-id="packing-food"]').check();
    assert.equal(await note(page).evaluate(node => node.readOnly), true);
    assert.equal(await note(page).inputValue(), '鱼肉饼');
    await page.locator('[data-packed-item-id="packing-map"]').check();
    assert.equal(await note(page).inputValue(), '鱼肉饼、小地图');
    world = await readWorld(page);
    assert.deepEqual(world.companion.packedItemIds, ['packing-food', 'packing-map']);
    assert.deepEqual(world.inventory.map(item => item.quantity), [3, 1], 'selection does not deduct inventory before departure');
    await page.reload(); await page.waitForFunction(() => globalThis.petTest); await showTravel(page);
    await openCompanionMenu(page, 'travel');
    assert.equal(await page.locator('[data-packed-item-id="packing-food"]').isChecked(), true);
    assert.equal(await page.locator('[data-packed-item-id="packing-map"]').isChecked(), true);
    assert.equal(await note(page).evaluate(node => node.readOnly), true);
    assert.equal(await note(page).inputValue(), '鱼肉饼、小地图', 'real selections and their carrying list survive reload');
    await page.locator('[data-packed-item-id="packing-food"]').uncheck();
    assert.equal(await note(page).inputValue(), '小地图');
    assert.equal(await note(page).evaluate(node => node.readOnly), true);
    await page.locator('[data-packed-item-id="packing-map"]').uncheck();
    assert.equal(await note(page).isEditable(), true, 'canceling all selections restores handwriting');
    await enterNote(page, carrying);
    assert.deepEqual((await readWorld(page)).inventory.map(item => item.quantity), [3, 1]);
    assert.equal(await page.evaluate(() => packingCalls), 0);
    console.log('PASS real inventory selection survives reload; its readonly carrying list tracks checks and becomes editable when cleared');

    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await assertFits(page, `${width}px`);
        await page.locator('.tf-companion-device').screenshot({ path: join(output, `packing-note-${width}.png`) });
    }
    console.log('PASS packing input and travel controls fit desktop and 390/320 mobile widths');

    await page.evaluate(async () => {
        const world = (await import('/src/store.js')).getForumData().world;
        world.inventory = []; world.companion.packedItemIds = []; petTest.render();
        globalThis.packingCalls = 0; globalThis.packingPrompt = '';
        SillyTavern.getContext().generateRaw = async options => {
            packingCalls++;
            packingPrompt = options.prompt.map(message => message.content).join('\n');
            return new Promise(resolve => { globalThis.releasePackingPlan = resolve; });
        };
    });
    await note(page).fill(departureNote);
    assert.equal(await note(page).evaluate(node => document.activeElement === node), true, 'departure is clicked while the edited note still has focus');
    await page.evaluate(() => {
        globalThis.packingClickTrace = [];
        for (const type of ['pointerdown', 'change', 'pointerup', 'click']) document.addEventListener(type, event => {
            packingClickTrace.push({ type, tag: event.target.tagName, action: event.target.closest('[data-action]')?.dataset.action || '',
                field: event.target.dataset.companionField || '', connected: event.target.isConnected });
        }, true);
    });
    await page.locator('[data-action="companion-depart-ai"]').click();
    try {
        await page.waitForFunction(() => packingCalls === 1 && typeof releasePackingPlan === 'function', null, { timeout: 2000 });
    } catch (error) {
        console.log('Direct departure click evidence:', await page.evaluate(async () => ({ calls: packingCalls,
            busy: petTest.viewState.moduleBusy.has('travel'), carrying: (await import('/src/store.js')).getForumData().world.companion.carrying,
            trace: packingClickTrace })));
        throw error;
    }
    assert.equal(await page.evaluate(() => petTest.viewState.moduleBusy.has('travel')), true);
    assert.equal(await note(page).isDisabled(), true, 'packing note is locked while the travel plan is being prepared');
    assert.equal(await page.locator('[data-action="companion-depart-ai"]').isDisabled(), true);
    assert.match(await page.locator('.tf-packing-note').innerText(), /操作进行中，行囊暂不可修改/);
    assert.doesNotMatch(await page.locator('.tf-packing').innerText(), /填写上方行囊|可手动填写|可以留空轻装出发/);
    assert.ok((await page.evaluate(() => packingPrompt)).includes(departureNote), 'the first departure click saves and sends the still-focused handwritten note');
    await page.evaluate(plan => releasePackingPlan(JSON.stringify(plan)), travelPlan);
    await page.waitForFunction(async () => {
        const world = (await import('/src/store.js')).getForumData().world;
        return world.companion.status === 'away' && !petTest.viewState.moduleBusy.has('travel');
    });
    world = await readWorld(page);
    const trip = world.trips.find(trip => trip.status === 'away');
    assert.ok(trip && trip.schedulePreparedAt > 0);
    assert.ok(trip.packingSummary.includes(departureNote), 'trip history retains the handwritten note');
    assert.deepEqual(trip.packingItems, []); assert.deepEqual(world.inventory, [], 'text-only packing deducts and creates no inventory');
    assert.equal(world.companion.departedCarrying, departureNote);
    assert.equal(await note(page).isDisabled(), true, 'packing stays locked while the companion is away');
    assert.match(await page.locator('.tf-packing-note').innerText(), /旅途中暂不可修改/);
    assert.doesNotMatch(await page.locator('.tf-packing').innerText(), /填写上方行囊|可手动填写|可以留空轻装出发/);
    await assertActionContrast(page, 'away');
    assert.equal(await page.evaluate(() => packingCalls), 1);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => packingCalls), 1, 'no further API is requested after departure');
    await assertFits(page, 'away/320px');
    await page.locator('.tf-pet-trip-actions').scrollIntoViewIfNeeded();
    await page.locator('.tf-companion-device').screenshot({ path: join(output, 'packing-note-departed-320.png') });
    await page.locator('.tf-packing-note').scrollIntoViewIfNeeded();
    await page.locator('.tf-companion-device').screenshot({ path: join(output, 'packing-note-locked-320.png') });
    console.log('PASS the first click after typing departs with the saved note in one stubbed API request, preserving its trip summary without consuming inventory');
    console.log('PASS home/away travel actions have readable labels and away packing guidance matches the locked controls');
    await page.close();

    const mobile = await open(390);
    await enterNote(mobile, '带好小毛巾，平安回来。');
    await returnCompanionHome(mobile, 'tap'); await openCompanionMenu(mobile, 'status', 'tap');
    await mobile.locator('.tf-pet-pack-shortcut').tap();
    assert.equal(await note(mobile).isEditable(), true);
    assert.equal(await note(mobile).evaluate(node => document.activeElement === node), true);
    assert.equal(await mobile.evaluate(() => packingCalls), 0);
    await mobile.evaluate(() => {
        SillyTavern.getContext().generateRaw = async () => { packingCalls++; throw Error('Simulated travel provider failure'); };
    });
    const mobileNote = '带一条小围巾，去河边散步。';
    await note(mobile).fill(mobileNote);
    assert.equal(await note(mobile).evaluate(node => document.activeElement === node), true);
    await mobile.locator('[data-action="companion-depart-ai"]').tap();
    await mobile.waitForFunction(() => packingCalls === 1 && !petTest.viewState.moduleBusy.has('travel'));
    assert.equal((await readWorld(mobile)).companion.carrying, mobileNote, 'the first touch departure saves the still-focused note');
    assert.equal(await note(mobile).isEditable(), true, 'provider failure unlocks the note');
    assert.equal(await mobile.locator('[data-action="companion-depart-ai"]').isEnabled(), true);
    assert.equal((await readWorld(mobile)).companion.status, 'home');
    assert.deepEqual((await readWorld(mobile)).trips, [], 'failed preparation leaves no journey');
    await mobile.evaluate(async () => {
        const world = (await import('/src/store.js')).getForumData().world;
        world.inventory = [
            { id: 'packing-last-food', name: '最后一份口粮', quantity: 1, usable: true, consumed: false },
            { id: 'packing-tool', name: '小指南针', quantity: 1, usable: true, consumed: false },
            { id: 'packing-unselected', name: '留在家的玩偶', quantity: 1, usable: true, consumed: false },
        ];
        packingCalls = 0; petTest.render();
    });
    await mobile.locator('[data-packed-item-id="packing-last-food"]').check();
    await mobile.locator('[data-packed-item-id="packing-tool"]').check();
    await mobile.evaluate(() => {
        SillyTavern.getContext().generateRaw = async () => {
            packingCalls++;
            return new Promise(resolve => { globalThis.releasePackingPlan = resolve; });
        };
    });
    await mobile.locator('[data-action="companion-depart-ai"]').tap();
    await mobile.waitForFunction(() => packingCalls === 1 && petTest.viewState.moduleBusy.has('travel') && typeof releasePackingPlan === 'function');
    assert.equal(await note(mobile).isDisabled(), true);
    assert.equal(await mobile.locator('[data-packed-item-id="packing-last-food"]').isDisabled(), true);
    assert.equal(await mobile.locator('[data-packed-item-id="packing-tool"]').isDisabled(), true);
    await mobile.evaluate(() => releasePackingPlan(Promise.reject(Error('Simulated packed travel failure'))));
    await mobile.waitForFunction(() => !petTest.viewState.moduleBusy.has('travel'));
    assert.equal(await mobile.locator('[data-packed-item-id="packing-last-food"]').isEnabled(), true);
    assert.equal(await mobile.locator('[data-packed-item-id="packing-tool"]').isEnabled(), true);
    assert.equal(await mobile.locator('[data-action="companion-depart-ai"]').isEnabled(), true);
    assert.deepEqual((await readWorld(mobile)).inventory.map(item => item.quantity), [1, 1, 1], 'provider failure consumes no real items');
    while (await mobile.locator('[data-action="dismiss-toast"]').count()) await mobile.locator('[data-action="dismiss-toast"]').first().click();
    await mobile.evaluate(() => { packingCalls = 0; delete globalThis.releasePackingPlan; });
    await mobile.locator('[data-action="companion-depart-ai"]').tap();
    await mobile.waitForFunction(() => packingCalls === 1 && typeof releasePackingPlan === 'function');
    await mobile.evaluate(plan => releasePackingPlan(JSON.stringify(plan)), travelPlan);
    await mobile.waitForFunction(async () => (await import('/src/store.js')).getForumData().world.companion.status === 'away' && !petTest.viewState.moduleBusy.has('travel'));
    world = await readWorld(mobile);
    assert.equal(world.inventory.find(item => item.id === 'packing-last-food').quantity, 0);
    assert.equal(world.inventory.find(item => item.id === 'packing-last-food').consumed, true);
    assert.equal(world.inventory.find(item => item.id === 'packing-tool').quantity, 1);
    assert.equal(world.inventory.find(item => item.id === 'packing-unselected').quantity, 1);
    assert.deepEqual(world.trips.find(trip => trip.status === 'away').packingItems.map(item => [item.id, item.consumed]), [['packing-last-food', 1], ['packing-tool', 0]]);
    assert.equal(await mobile.locator('[data-packed-item-id]').count(), 0, 'away packing shows the departure snapshot, not current inventory choices');
    assert.equal(await mobile.locator('.tf-packing-trip-item').count(), 2);
    assert.match(await mobile.locator('.tf-packing-items').innerText(), /最后一份口粮\s+出发已消耗 1 份/);
    assert.match(await mobile.locator('.tf-packing-items').innerText(), /小指南针\s+随身携带 · 返家后可用/);
    assert.doesNotMatch(await mobile.locator('.tf-packing-items').innerText(), /没有携带背包物品|留在家的玩偶/);
    await assertActionContrast(mobile, 'packed touch departure');
    await mobile.locator('.tf-packing-items').scrollIntoViewIfNeeded();
    await mobile.locator('.tf-companion-device').screenshot({ path: join(output, 'packing-real-items-departed-390.png') });
    await mobile.close();
    assert.deepEqual(errors, []);
    console.log('PASS first touch departure saves the note; failed preparation unlocks notes and checks without consuming inventory or leaving a journey');
    console.log('PASS real touch departure consumes one food portion, preserves tools and displays the actual trip snapshot even when food stock reaches zero');
    console.log('Screenshots:', output);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
