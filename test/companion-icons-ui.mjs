import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { openCompanionMenu, returnCompanionHome } from './companion-navigation.mjs';

const baseline = process.argv.includes('--baseline');
const root = resolve('.'), output = await mkdtemp(join(tmpdir(), `forum-pet-icons-${baseline ? 'baseline' : 'ui'}-`));
const server = createServer(async (request, response) => {
    try {
        const path = new URL(request.url, 'http://localhost').pathname, file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep)) throw Error('outside root');
        let body = await readFile(file);
        if (path === '/src/ui-v3.js') body = Buffer.from(body + '\nglobalThis.petTest = { viewState, render };');
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(file)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const errors = [];
const panel = page => page.locator('.tf-companion-device').getAttribute('data-device-page');
const pages = ['status', 'games', 'album', 'travel', 'dress'];

async function fixture(page, stage = 'adult') {
    await returnCompanionHome(page);
    await page.evaluate(async stage => {
        const { getForumData } = await import('/src/store.js');
        const pet = getForumData().world.companion;
        Object.assign(pet, { status: 'home', satiety: 80, energy: 80, happiness: 80, lastInteractionAt: 0 });
        Object.assign(pet.life, { mode: 'active', autoSleep: false, sleepUntil: 0, awakeUntil: 0, cleanliness: 80, game: null, growthNotice: null, stage, actionAt: {}, lastTickAt: Date.now() });
        petTest.viewState.companionFeedback = null;
        petTest.viewState.companionGameResultOpen = false;
        petTest.viewState.companionRitual = null;
        petTest.render();
    }, stage);
}

async function open(width, height = 900) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 600, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview.html`);
    await page.waitForFunction(() => globalThis.petTest);
    await page.evaluate(async () => {
        const { getSettings } = await import('/src/store.js');
        const settings = getSettings(); settings.modules.travel.enabled = true; settings.ui.activeTab = 'services';
        petTest.viewState.worldPage = 'travel';
        globalThis.petCalls = 0; SillyTavern.getContext().generateRaw = async () => { petCalls++; throw Error('Unexpected API call'); };
        petTest.render();
    });
    await fixture(page);
    await page.locator('.tf-pet-console').scrollIntoViewIfNeeded();
    return page;
}

async function shot(page, name) {
    await page.locator('.tf-pet-console').screenshot({ path: join(output, name + '.png') });
}

async function checkLayout(page, width, title) {
    const layout = await page.locator('.tf-companion-device').evaluate(device => {
        const pane = device.querySelector('.tf-pet-device-page:not([hidden])');
        const content = pane?.querySelector('.tf-pet-device-content');
        const view = device.closest('.tf-view');
        return { viewOverflow: view.scrollWidth > view.clientWidth + 1, contentOverflow: content ? content.scrollWidth > content.clientWidth + 1 : false };
    });
    assert.deepEqual(layout, { viewOverflow: false, contentOverflow: false }, `${width} ${title} has no horizontal overflow`);
    const labels = await page.locator('.tf-device-icon-menu:visible button, .tf-device-page-tabs:visible button, .tf-device-home:visible').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(node);
        const childBoxes = [...node.querySelectorAll('svg,span')].filter(child => !child.closest('svg') || child.tagName.toLowerCase() === 'svg').map(child => child.getBoundingClientRect());
        const viewport = node.closest('.tf-pet-screen').getBoundingClientRect();
        return { label: node.getAttribute('aria-label') || node.textContent.trim(), height: box.height, clipped: box.left < viewport.left - 1 || box.right > viewport.right + 1 || box.top < viewport.top - 1 || box.bottom > viewport.bottom + 1 || node.scrollWidth > node.clientWidth + 1 || childBoxes.some(child => child.left < box.left - 1 || child.right > box.right + 1 || child.top < box.top - 1 || child.bottom > box.bottom + 1) };
    }));
    for (const label of labels) {
        assert.equal(label.clipped, false, `${width} ${title}: ${label.label} is readable`);
        assert.ok(label.height >= 44, `${width} ${title}: ${label.label} touch target is ${label.height}px high`);
    }
}

async function checkIcons(page, selector) {
    const icons = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(), art = node.getBBox();
        return { id: node.dataset.petIcon, viewBox: node.getAttribute('viewBox'), hidden: node.getAttribute('aria-hidden'), focusable: node.getAttribute('focusable'), width: box.width, height: box.height, artWidth: art.width, artHeight: art.height };
    }));
    assert.ok(icons.length, selector + ' contains icons');
    for (const icon of icons) {
        assert.equal(icon.viewBox, '0 0 24 24'); assert.equal(icon.hidden, 'true'); assert.equal(icon.focusable, 'false');
        const minimum = icon.id === 'check' ? 6 : 12;
        assert.ok(icon.width >= minimum && icon.height >= minimum, `${icon.id} remains visible (${icon.width} × ${icon.height})`);
        assert.ok(icon.artWidth > 0 && icon.artHeight > 0, `${icon.id} has visible art`);
    }
}

async function checkMenuContrast(page, name) {
    const contrasts = await page.locator('.tf-device-icon-menu button').evaluateAll(nodes => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const rgb = value => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
        const luminance = value => value.slice(0, 3).map(c => { const s = c / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
        return nodes.map(node => {
            let background = node, rgba;
            do { rgba = rgb(getComputedStyle(background).backgroundColor); if (rgba[3] > 250) break; background = background.parentElement; } while (background);
            const foreground = luminance(rgb(getComputedStyle(node.querySelector('svg')).color)), behind = luminance(rgba);
            return { label: node.textContent.trim(), contrast: (Math.max(foreground, behind) + .05) / (Math.min(foreground, behind) + .05) };
        });
    });
    for (const result of contrasts) assert.ok(result.contrast >= 3, `${name} ${result.label} icon contrast ${result.contrast.toFixed(2)} >= 3`);
}

async function finalChecks(page, width) {
    const method = width < 600 ? 'tap' : 'click';
    await returnCompanionHome(page, method);
    await openCompanionMenu(page, 'status', method);
    await returnCompanionHome(page, method);
    await openCompanionMenu(page, 'menu', method);
    assert.equal(await panel(page), 'menu');
    assert.deepEqual(await page.locator('.tf-device-icon-menu button').evaluateAll(nodes => nodes.map(node => node.dataset.panel)), ['status', 'feed', 'games', 'clean', 'rest', 'album', 'travel', 'dress']);
    await checkIcons(page, '.tf-device-icon-menu:visible svg');
    await checkLayout(page, width, 'menu');
    const selected = page.locator('.tf-device-icon-menu .is-device-selected');
    assert.equal(await selected.getAttribute('data-panel'), 'status');
    await selected.focus(); await page.keyboard.press('Enter'); assert.equal(await panel(page), 'status', 'Enter opens the selected icon');
    for (const target of [...pages, ...pages.slice().reverse()]) {
        await page.locator(`.tf-device-page-tabs:visible [data-panel="${target}"]`)[method]();
        assert.equal(await panel(page), target);
        assert.equal(await page.locator('.tf-device-page-tabs:visible [aria-current="page"]').getAttribute('data-panel'), target);
        await checkIcons(page, '.tf-device-page-tabs:visible svg');
        await checkLayout(page, width, target);
    }
    await page.locator('.tf-device-home:visible')[method](); assert.equal(await panel(page), 'home');

    // Keyboard A/B controls must still move the semantic choice and execute it.
    const a = page.locator('[data-action="companion-menu-nav"][data-direction="-1"]');
    const b = page.locator('[data-action="companion-menu-confirm"]');
    const c = page.locator('[data-action="companion-menu-nav"][data-direction="1"]');
    await a.focus(); await page.keyboard.press('Enter'); assert.equal(await panel(page), 'menu');
    const first = await selected.getAttribute('data-panel');
    await a.focus(); await page.keyboard.press('Space');
    assert.notEqual(await selected.getAttribute('data-panel'), first);
    await b.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.tf-pet-food-select').isVisible(), true, 'A/B keyboard choices still open the food selector');
    await shot(page, `food-${width}`);
    const foods = await page.locator('.tf-pet-food-select [data-food-id] svg').evaluateAll(nodes => nodes.map(node => ({ art: node.querySelector('.tf-feed-food-whole').innerHTML, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    assert.equal(foods.length, 10); assert.equal(new Set(foods.map(food => food.art)).size, 10, 'all ten food icons are distinct');
    assert.ok(foods.every(food => food.width >= 24 && food.height >= 24), 'food art remains readable');
    const foodLayout = await page.locator('.tf-pet-food-select').evaluate(tray => {
        const box = tray.getBoundingClientRect(), viewport = tray.parentElement.getBoundingClientRect();
        const pet = tray.parentElement.querySelector('.tf-pixel-avatar').getBoundingClientRect();
        const target = tray.parentElement.querySelector('.tf-pet-sprite-control').getBoundingClientRect();
        return { display: getComputedStyle(tray).display, fullWidth: Math.abs(box.width - viewport.width) <= 2, overflow: tray.scrollWidth > tray.clientWidth + 1, petVisible: pet.top >= viewport.top - 1 && pet.bottom <= box.top + 1, petTarget: Math.min(target.width, target.height), buttons: [...tray.querySelectorAll('[data-food-id]')].map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, textClipped: node.querySelector('b').scrollWidth > node.querySelector('b').clientWidth + 1 })) };
    });
    assert.equal(foodLayout.display, 'block'); assert.equal(foodLayout.fullWidth, true); assert.equal(foodLayout.overflow, false);
    assert.equal(foodLayout.petVisible, true, 'food tray leaves the whole pet visible'); assert.ok(foodLayout.petTarget >= 44, 'pet stays reachable while selecting food');
    for (const target of foodLayout.buttons) { assert.ok(target.width >= 44 && target.height >= 44, 'food is a reachable touch target'); assert.equal(target.textClipped, false, 'food name is readable'); }
    await page.locator('.tf-pet-food-select [data-food-id]').last().scrollIntoViewIfNeeded();
    const lastFoodInside = await page.locator('.tf-pet-food-select [data-food-id]').last().evaluate(node => { const box = node.getBoundingClientRect(), tray = node.closest('.tf-pet-food-select').getBoundingClientRect(); return box.top >= tray.top - 1 && box.bottom <= tray.bottom + 1; });
    assert.equal(lastFoodInside, true, 'last food row can be reached by scrolling');
    await c.focus(); await page.keyboard.press('Enter'); assert.equal(await panel(page), 'menu');
    await c.focus(); await page.keyboard.press('Enter'); assert.equal(await panel(page), 'home');

    await fixture(page, 'baby'); await openCompanionMenu(page, 'games', method);
    const disabled = page.locator('.tf-pet-games [data-game="memory"]');
    assert.equal(await disabled.isDisabled(), true, 'locked game remains disabled');
    assert.equal(await page.locator('.tf-pet-games [data-game="dodge"]').isDisabled(), true);
    await disabled.evaluate(node => node.focus());
    assert.equal(await disabled.evaluate(node => node === document.activeElement), false, 'disabled icon button does not accept keyboard focus');
    await a.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.tf-pet-games .is-device-selected').getAttribute('data-game'), 'catch', 'A selection skips locked games');
    await checkIcons(page, '.tf-pet-games svg');
    await shot(page, `locked-games-${width}`);
    await fixture(page); await openCompanionMenu(page, 'dress', method);
    const environment = page.locator('.tf-device-setting-group').nth(2);
    await environment.locator(':scope > summary')[method]();
    await checkIcons(page, '.tf-pet-environment-controls svg.tf-pet-icon');
    await checkLayout(page, width, 'environment');
    for (const field of ['weather', 'timeOfDay']) {
        await page.locator(`.tf-environment-group.is-${field} > header`).scrollIntoViewIfNeeded();
        await shot(page, `environment-${field}-${width}`);
    }
    const shop = page.locator('.tf-pet-decorate details').first();
    if (!await shop.evaluate(node => node.open)) await shop.locator(':scope > summary')[method]();
    await checkIcons(page, '.tf-pet-shop svg');
    const coins = await page.evaluate(async () => (await import('/src/store.js')).getForumData().world.companion.life.coins);
    assert.equal(coins, 0);
    assert.equal(await page.locator('.tf-pet-shop button:disabled').count(), 5, 'unaffordable shop choices remain disabled');
    await checkLayout(page, width, 'shop');
    await page.locator('.tf-pet-shop > div').first().scrollIntoViewIfNeeded();
    await shot(page, `shop-${width}`);
    assert.equal(await page.evaluate(() => petCalls), 0);
}

async function checkFoodInteraction(page, width) {
    const method = width < 600 ? 'tap' : 'click';
    const readSatiety = () => page.evaluate(async () => (await import('/src/store.js')).getForumData().world.companion.satiety);
    const center = async selector => { const box = await page.locator(selector).boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
    const prepare = async () => {
        await fixture(page);
        await page.evaluate(async () => { (await import('/src/store.js')).getForumData().world.companion.satiety = 20; petTest.render(); });
        await openCompanionMenu(page, 'feed', method);
        await page.locator('[data-food-id="berry"]').scrollIntoViewIfNeeded();
        return center('[data-food-id="berry"] svg');
    };
    const checkGhost = async () => {
        const ghost = page.locator('.tf-pet-drag-snack svg[data-food-art="berry"]');
        assert.equal(await ghost.count(), 1, 'dragging keeps the selected food art');
        const box = await ghost.boundingBox(); assert.equal(box.width, 26); assert.equal(box.height, 26);
        await page.screenshot({ path: join(output, `drag-food-${width}.png`) });
    };
    let food = await prepare();
    if (width < 600) await page.touchscreen.tap(food.x, food.y); else await page.mouse.click(food.x, food.y);
    await page.locator('.tf-pet-food-select').waitFor({ state: 'detached' });
    assert.ok(await readSatiety() > 20, `${width} actual click on the food SVG feeds the pet`);
    food = await prepare(); const pet = await center('.tf-pet-sprite-control');
    if (width < 600) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [food] });
        for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: food.x + (pet.x - food.x) * i / 12, y: food.y + (pet.y - food.y) * i / 12 }] });
        await checkGhost();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    } else {
        await page.mouse.move(food.x, food.y); await page.mouse.down(); await page.mouse.move(pet.x, pet.y, { steps: 12 }); await checkGhost(); await page.mouse.up();
    }
    await page.locator('.tf-pet-food-select').waitFor({ state: 'detached' });
    assert.ok(await readSatiety() > 20, `${width} dragging from the food SVG feeds the pet`);
    assert.equal(await page.locator('.tf-pet-drag-snack').count(), 0, 'drop removes the food ghost');
    food = await prepare();
    if (width < 600) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [food] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: food.x, y: food.y - 30 }] });
        assert.equal(await page.locator('.tf-pet-drag-snack svg[data-food-art="berry"]').count(), 1);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp.detach();
    } else {
        await page.mouse.move(food.x, food.y); await page.mouse.down(); await page.mouse.move(20, 120, { steps: 12 }); await page.mouse.up();
    }
    assert.equal(await readSatiety(), 20, 'canceling the drag does not feed the pet');
    assert.equal(await page.locator('.tf-pet-drag-snack').count(), 0, 'cancel removes the food ghost');
    await returnCompanionHome(page, method);
}

async function checkGamePause(page, largeScore = false) {
    await fixture(page); await openCompanionMenu(page, 'games');
    await page.locator('[data-action="pet-game-start"][data-game="catch"]').click();
    const pause = page.locator('.tf-pet-arcade header [data-action="pet-game-pause"]');
    await pause.waitFor();
    if (largeScore) {
        await page.evaluate(async () => { (await import('/src/store.js')).getForumData().world.companion.life.game.score = 99999; });
        await page.waitForFunction(() => document.querySelector('[data-game-score]').textContent.includes('99999'));
        const header = await pause.evaluate(button => {
            const head = button.parentElement.getBoundingClientRect();
            return [...button.parentElement.children].map(node => {
                const box = node.getBoundingClientRect();
                const visible = button.closest('.tf-pet-screen').getBoundingClientRect();
                return { label: node.getAttribute('aria-label') || node.textContent, inside: box.left >= Math.max(head.left, visible.left) - 1 && box.right <= Math.min(head.right, visible.right) + 1 && box.top >= head.top - 1 && box.bottom <= head.bottom + 1, clipped: node.scrollWidth > node.clientWidth + 1 };
            });
        });
        for (const item of header) { assert.equal(item.inside, true, `${item.label} remains inside the large-score header`); assert.equal(item.clipped, false, `${item.label} is readable`); }
    }
    assert.equal(await pause.locator('[data-pet-icon="pause"]').isVisible(), true);
    assert.equal(await pause.locator('[data-pet-icon="resume"]').isVisible(), false);
    await pause.click();
    await page.waitForFunction(() => document.querySelector('.tf-pet-arcade header [data-action="pet-game-pause"]').getAttribute('aria-pressed') === 'true');
    assert.equal(await pause.getAttribute('aria-label'), '继续游戏');
    assert.equal(await pause.locator('[data-pet-icon="pause"]').isVisible(), false);
    assert.equal(await pause.locator('[data-pet-icon="resume"]').isVisible(), true);
    if (largeScore) {
        const paused = await pause.evaluate(button => {
            const screen = button.closest('.tf-pet-screen'), room = button.closest('.tf-device-viewport');
            const boundary = screen.getBoundingClientRect(), title = button.parentElement.querySelector('b');
            const range = document.createRange(); range.selectNodeContents(title); const text = range.getBoundingClientRect();
            return { fits: room.getBoundingClientRect().width <= screen.clientWidth + 1, scrolled: screen.scrollLeft, readable: text.left >= boundary.left && text.right <= boundary.right };
        });
        assert.deepEqual(paused, { fits: true, scrolled: 0, readable: true }, 'pausing a large-score game keeps its title and screen inside the device');
    }
    await shot(page, largeScore ? 'paused-game-320-large-score' : 'paused-game');
    await pause.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.tf-pet-arcade header [data-action="pet-game-pause"]').getAttribute('aria-pressed') === 'false');
    assert.equal(await pause.locator('[data-pet-icon="pause"]').isVisible(), true);
    assert.equal(await pause.locator('[data-pet-icon="resume"]').isVisible(), false);
    await pause.click(); await page.locator('.tf-arcade-pause [data-action="pet-game-stop"]').click();
}

async function checkLongName(page) {
    await fixture(page);
    await page.evaluate(async () => { (await import('/src/store.js')).getForumData().world.companion.name = '这是一个三十二字的长名字用来检查菜单仍然可以点击且小窝不会溢出呀'; petTest.render(); });
    const result = await page.locator('.tf-pet-screen-top').evaluate(top => {
        const box = top.getBoundingClientRect(), toggle = top.querySelector('.tf-device-menu-toggle'), button = toggle.getBoundingClientRect();
        return { inside: button.left >= box.left && button.right <= box.right && button.top >= box.top && button.bottom <= box.bottom, clickable: document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2)?.closest('button') === toggle, overflow: top.scrollWidth > top.clientWidth + 1, stageOneLine: getComputedStyle(top.querySelector(':scope > span')).whiteSpace === 'nowrap' };
    });
    assert.deepEqual(result, { inside: true, clickable: true, overflow: false, stageOneLine: true }, '32-character name preserves a reachable menu without overflow');
    await shot(page, 'long-name-320'); await openCompanionMenu(page, 'menu', 'tap'); assert.equal(await panel(page), 'menu');
}

try {
    console.log('Screenshots:', output);
    for (const width of [1280, 390, 320]) {
        const page = await open(width);
        await shot(page, `home-${width}`);
        await openCompanionMenu(page, 'menu');
        await shot(page, `menu-${width}`);
        for (const target of ['status', 'games', 'dress']) {
            await openCompanionMenu(page, target);
            if (target === 'dress') await page.locator('.tf-pet-decorate summary').first().click();
            await shot(page, `${target}-${width}`);
        }
        if (!baseline) { await finalChecks(page, width); await checkFoodInteraction(page, width); }
        assert.equal(await page.evaluate(() => petCalls), 0);
        await page.close();
    }
    if (!baseline) {
        const page = await open(1280);
        await checkGamePause(page);
        for (const dark of [false, true]) for (const skin of ['classic', 'pocket', 'crystal', 'arcane', 'terminal', 'camp', 'marine', 'arcade', 'lunar', 'berry']) {
            await fixture(page);
            await page.evaluate(async ({ skin, dark }) => {
                const { getForumData, getSettings } = await import('/src/store.js');
                getForumData().world.companion.deviceSkin = skin;
                Object.assign(getSettings().appearance, dark ? { backgroundColor: '#181c24', cardColor: '#252c37', textColor: '#eeeeee' } : { backgroundColor: '#fbf5f8', cardColor: '#ffffff', textColor: '#28313b' });
                petTest.render();
            }, { skin, dark });
            await openCompanionMenu(page, 'menu');
            await checkIcons(page, '.tf-device-icon-menu:visible svg');
            await checkMenuContrast(page, `${skin} ${dark ? 'dark' : 'light'}`);
            if (['classic', 'arcade', 'lunar'].includes(skin)) await shot(page, `${skin}-${dark ? 'dark' : 'light'}`);
        }
        assert.equal(await page.evaluate(() => petCalls), 0); await page.close();
        const short = await open(320, 640);
        await checkLongName(short); await checkGamePause(short, true);
        await openCompanionMenu(short, 'menu'); await checkLayout(short, 320, 'short-height menu'); await shot(short, 'menu-320x640');
        await openCompanionMenu(short, 'games'); await checkLayout(short, 320, 'short-height games'); await shot(short, 'games-320x640');
        assert.equal(await short.evaluate(() => petCalls), 0); await short.close();
        console.log('PASS 1280/390/320 icon layouts, real tabs and keyboard choices, native disabled controls, 10 device skins in light/dark themes and zero API calls');
    }
    assert.deepEqual(errors, []);
    console.log('PASS screenshots, local navigation and no browser errors');
} finally {
    await browser.close(); await new Promise(done => server.close(done));
}
