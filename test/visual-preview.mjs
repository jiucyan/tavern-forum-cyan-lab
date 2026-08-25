import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const previewRoot = resolve(process.cwd());
let modelCatalogRequests = 0;
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
        if (pathname === '/mock-api/models') {
            modelCatalogRequests += 1;
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({ data: [{ id: 'story-model-large' }, { id: 'story-model-fast' }, { id: 'image-model-v1' }] }));
            return;
        }
        const file = resolve(previewRoot, pathname.replace(/^\/+/, '') || 'preview.html');
        if (file !== previewRoot && !file.startsWith(`${previewRoot}${sep}`)) throw new Error('outside preview root');
        const body = await readFile(file);
        response.writeHead(200, { 'Content-Type': contentTypes[extname(file).toLocaleLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(body);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
    }
});
await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
});
const url = `http://127.0.0.1:${server.address().port}/preview.html`;
const systemEdge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = process.env.TAVERN_FORUM_BROWSER_PATH?.trim()
    || (process.platform === 'win32' && existsSync(systemEdge) ? systemEdge : '');
const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
});

function enableScreenshotRetry(page) {
    const capture = page.screenshot.bind(page);
    Object.defineProperty(page, 'screenshot', {
        configurable: true,
        value: async options => {
            let lastError;
            for (let attempt = 0; attempt < 4; attempt += 1) {
                try { return await capture(options); } catch (error) {
                    lastError = error;
                    if (!/UNKNOWN|EBUSY|EPERM/i.test(String(error?.code || error?.message || ''))) throw error;
                    await new Promise(resolveWait => setTimeout(resolveWait, 120 * (attempt + 1)));
                }
            }
            throw lastError;
        },
    });
}

try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    enableScreenshotRetry(desktop);
    await desktop.goto(url, { waitUntil: 'networkidle' });
    await desktop.locator('.tf-app').evaluate(node => { node.dataset.renderSentinel = 'stable-desktop'; });
    await desktop.locator('.tf-topbar [data-tab="services"]').click();
    if (!await desktop.getByRole('heading', { name: '世界', exact: true }).count()) throw new Error('stable world hub entry is missing');
    if (!await desktop.locator('.tf-world-home-title').count()) throw new Error('world hub does not expose its stable home header');
    if (await desktop.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-desktop') throw new Error('switching tabs replaced the full app shell and may flash on mobile');
    await desktop.screenshot({ path: 'preview-world.png' });
    await desktop.locator('.tf-topbar .tf-main-nav [data-tab="home"]').click();
    if (await desktop.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-desktop') throw new Error('returning home replaced the full app shell');
    const visibleTextImages = await desktop.locator('.tf-feed-list .tf-text-image').count();
    if (visibleTextImages !== 1) throw new Error(`expected only intentional post images to display, found ${visibleTextImages}`);
    if (!/[\u3400-\u9fff]/u.test(await desktop.locator('.tf-text-image p').first().innerText())) throw new Error('text image description is not Chinese');
    const postOrder = await desktop.locator('.tf-post').first().evaluate(post => ({ caption: [...post.children].findIndex(node => node.classList.contains('tf-post-caption')), image: [...post.children].findIndex(node => node.classList.contains('tf-text-image') || node.classList.contains('tf-post-image')), actions: [...post.children].findIndex(node => node.classList.contains('tf-post-actions')) }));
    if (!(postOrder.caption < postOrder.image && postOrder.image < postOrder.actions)) throw new Error('post body, image and action order is incorrect');
    if (await desktop.getByText('文字配图', { exact: true }).count()) throw new Error('text image labels should stay hidden');
    if (await desktop.locator('.tf-post-image-editor').count()) throw new Error('post image editor should stay closed until explicitly requested');
    await desktop.screenshot({ path: 'preview.png' });
    await desktop.locator('[data-action="open-post"]').first().click();
    await desktop.screenshot({ path: 'preview-post-detail.png' });
    await desktop.locator('[data-action="back-post"]').click();
    await desktop.locator('.tf-feed-list [data-action="open-npc"]').first().click();
    await desktop.screenshot({ path: 'preview-public-profile.png' });
    await desktop.locator('[data-action="edit-npc"]').first().click();
    if (await desktop.locator('.tf-memory-card').count()) throw new Error('role memory should not stay embedded in the profile editor');
    await desktop.screenshot({ path: 'preview-role-profile.png' });
    await desktop.locator('.tf-topbar [data-tab="me"]').click();
    await desktop.screenshot({ path: 'preview-profile.png' });
    const profileShellWidth = await desktop.locator('.tf-profile-page-shell').evaluate(node => node.getBoundingClientRect().width);
    await desktop.locator('.tf-topbar [data-tab="messages"]').click();
    await desktop.locator('[data-action="message-mode"][data-mode="notifications"]').click();
    const messageShellWidth = await desktop.locator('.tf-message-shell').evaluate(node => node.getBoundingClientRect().width);
    if (Math.abs(profileShellWidth - messageShellWidth) > 1) throw new Error(`profile and message layouts shift horizontally: ${profileShellWidth} vs ${messageShellWidth}`);
    if (await desktop.locator('.tf-notifications').evaluate(node => node.getBoundingClientRect().width) !== messageShellWidth) throw new Error('notifications still apply a second nested width cap');
    await desktop.screenshot({ path: 'preview-notifications.png' });
    await desktop.locator('[data-action="message-mode"][data-mode="dm"]').click();
    await desktop.locator('.tf-topbar [data-tab="me"]').click();
    await desktop.locator('[data-action="me-section"][data-section="memory"]').click();
    if (!await desktop.locator('.tf-memory-card').count()) throw new Error('standalone role memory page is missing');
    await desktop.screenshot({ path: 'preview-role-memory.png' });
    await desktop.locator('.tf-settings-entry').click();
    await desktop.locator('[data-action="me-section"][data-section="boundaries"]').click();
    await desktop.screenshot({ path: 'preview-boundaries.png' });
    await desktop.locator('[data-action="me-section"][data-section="sources"]').click();
    await desktop.locator('[data-action="toggle-source-preset"]').check({ force: true });
    if (!await desktop.locator('[data-action="toggle-source-preset"]').isChecked()) throw new Error('preset source switch did not persist');
    if (!await desktop.evaluate(() => globalThis.SillyTavern.getContext().extensionSettings.tavern_forum.sources.sillyTavernPreset)) throw new Error('preset source setting did not persist');
    const firstPresetEntry = desktop.locator('[data-preset-entry]').first();
    const selectedPresetId = await firstPresetEntry.getAttribute('data-preset-entry');
    if (await firstPresetEntry.count() && !await firstPresetEntry.isChecked()) await firstPresetEntry.check({ force: true });
    if (!await desktop.locator('[data-action="toggle-world-book"]').count()) throw new Error('world book master switch is missing');
    if (!await desktop.locator('.tf-world-bound-badge').count()) throw new Error('character-bound world book was not recognized');
    await desktop.screenshot({ path: 'preview-sources.png' });

    await desktop.locator('[data-action="me-section"][data-section="appearance"]').click();
    if (!await desktop.locator('[data-appearance-number="postOpacity"]').count()) throw new Error('post opacity control is missing');
    if (!await desktop.locator('[data-appearance-image-url="brandIcon"]').count()) throw new Error('brand icon control is missing');
    await desktop.locator('[data-action="restore-standard-css"]').click();
    const globalCssTemplate = await desktop.locator('.tf-custom-css').inputValue();
    if (!globalCssTemplate.includes('微坛全局 CSS 主题模板 v2')) throw new Error('current global CSS template was not loaded');
    if (!globalCssTemplate.includes('.tf-world-hub') || !globalCssTemplate.includes('.tf-fortune-ritual') || !globalCssTemplate.includes('.tf-health-case')) throw new Error('global CSS template does not cover current world apps');
    if (globalCssTemplate.split('\n').some(line => line.trim().startsWith('.') && !line.includes('#tavern-forum-root'))) throw new Error('global CSS template contains an unscoped selector');
    if (!await desktop.locator('.tf-custom-css-scope-note').count()) throw new Error('global CSS scope guidance is missing');
    if (await desktop.locator('.tf-world-layout-settings').count()) throw new Error('world home layout controls should no longer be buried in appearance settings');
    await desktop.screenshot({ path: 'preview-appearance.png' });

    await desktop.locator('[data-action="me-section"][data-section="prompts"]').click();
    if (selectedPresetId) await desktop.waitForFunction(id => [...document.querySelectorAll('.tf-prompt-entry[data-read-order-id]')].some(entry => entry.dataset.readOrderId === `preset:${id}`), selectedPresetId);
    if (!await desktop.locator('.tf-prompt-entry').count()) throw new Error('forum prompt preset list is missing');
    const visibleReadOrderIds = await desktop.locator('.tf-prompt-entry[data-read-order-id]').evaluateAll(entries => entries.map(entry => entry.dataset.readOrderId));
    if (selectedPresetId && !visibleReadOrderIds.includes(`preset:${selectedPresetId}`)) throw new Error('selected preset entry did not appear in the actual API order');
    if (visibleReadOrderIds.length < 4) throw new Error('canonical forum queue does not list enabled sources');
    if (await desktop.locator('.tf-prompt-editor:visible').count()) throw new Error('forum prompt entries should be collapsed by default');
    await desktop.locator('[data-action="toggle-prompt-editor"]').first().click();
    if (!await desktop.locator('.tf-prompt-editor:visible').count()) throw new Error('collapsed forum prompt entry did not open');
    while (await desktop.locator('.tf-prompt-entry.is-open').count()) await desktop.locator('.tf-prompt-entry.is-open [data-action="toggle-prompt-editor"]').first().click();
    const promptEntriesBeforeDrag = await desktop.locator('.tf-prompt-entry[data-read-order-id]').evaluateAll(entries => entries.map(entry => entry.dataset.readOrderId));
    if (promptEntriesBeforeDrag.length < 2) throw new Error('forum prompt queue does not have enough reorderable entries');
    const promptDropTarget = desktop.locator('.tf-prompt-entry[data-read-order-id]').last();
    const promptDragBox = await desktop.locator('.tf-prompt-drag-handle').first().boundingBox();
    const promptDropBox = await promptDropTarget.boundingBox();
    if (!promptDragBox || !promptDropBox) throw new Error('forum prompt drag geometry is unavailable');
    await desktop.mouse.move(promptDragBox.x + promptDragBox.width / 2, promptDragBox.y + promptDragBox.height / 2);
    await desktop.mouse.down();
    await desktop.mouse.move(promptDropBox.x + 24, promptDropBox.y + promptDropBox.height - 8, { steps: 8 });
    await desktop.mouse.up();
    const promptEntriesAfterDrag = await desktop.locator('.tf-prompt-entry[data-read-order-id]').evaluateAll(entries => entries.map(entry => entry.dataset.readOrderId));
    if (promptEntriesAfterDrag[0] === promptEntriesBeforeDrag[0]) throw new Error(`dragging a forum prompt did not persist its new order: ${JSON.stringify({ promptEntriesBeforeDrag, promptEntriesAfterDrag })}`);
    await desktop.screenshot({ path: 'preview-prompts-v2.png' });

    await desktop.locator('[data-action="me-section"][data-section="api"]').click();
    await desktop.locator('[data-action="select-api-profile"]').selectOption('default-api-profile');
    if (await desktop.locator('.tf-api-model-field').count() !== 2) throw new Error('text and image API settings are missing their model pickers');
    if (await desktop.locator('[data-action="fetch-api-models"]').count() !== 2) throw new Error('model catalogs are not explicitly fetchable');
    const callsBeforeManualModel = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.locator('[data-api-setting="text.endpoint"]').fill(`${new URL(url).origin}/mock-api`);
    await desktop.locator('[data-action="fetch-api-models"][data-api-kind="text"]').click();
    await desktop.locator('.tf-api-model-field datalist option[value="story-model-large"]').waitFor({ state: 'attached' });
    if (modelCatalogRequests !== 1) throw new Error(`explicit model loading made ${modelCatalogRequests} catalog requests instead of one`);
    await desktop.locator('[data-api-setting="text.endpoint"]').fill('https://api.example.com/v1');
    await desktop.locator('[data-api-setting="text.model"]').fill('manual-model-name');
    if (await desktop.locator('[data-api-setting="text.model"]').inputValue() !== 'manual-model-name') throw new Error('model name can no longer be entered manually');
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeManualModel) throw new Error('typing a model name unexpectedly called the API');
    await desktop.screenshot({ path: 'preview-api-model-picker-v3.png' });
    await desktop.locator('[data-action="select-api-profile"]').selectOption('sillytavern-default');

    await desktop.locator('[data-action="me-section"][data-section="modules"]').click();
    if (!await desktop.locator('.tf-modules-page > .tf-world-layout-settings').count()) throw new Error('world home layout controls are missing from world settings');
    if (await desktop.locator('.tf-orchestrator-card option[value="inherit"]').first().textContent() !== '跟随当前插件') throw new Error('inherited module API label does not identify the current plugin configuration');
    const firstWorldSettingsCard = await desktop.locator('.tf-modules-page > .tf-card').first().getAttribute('class');
    if (!firstWorldSettingsCard?.includes('tf-world-layout-settings')) throw new Error('world home layout controls are not the first world settings card');
    if (await desktop.locator('[data-action="test-module-probability"]').count()) throw new Error('obsolete 100-run probability test should not be rendered');
    if (await desktop.locator('[data-action="toggle-module-injection"][data-module-id="forum"]').count()) throw new Error('forum injection switch should only exist on the main-chat injection page');
    if (!await desktop.getByText('主聊天读取论坛内容', { exact: true }).count()) throw new Error('forum card is missing its injection status summary');
    const nativeOptionStyle = await desktop.locator('select option').first().evaluate(option => {
        const style = getComputedStyle(option);
        return { color: style.color, background: style.backgroundColor };
    });
    const readableNativeOption = (nativeOptionStyle.color === 'rgb(38, 38, 38)' && nativeOptionStyle.background === 'rgb(255, 255, 255)')
        || (nativeOptionStyle.color === 'rgb(111, 54, 71)' && nativeOptionStyle.background === 'rgb(248, 231, 236)');
    if (!readableNativeOption) throw new Error(`native select menu colors are unreadable: ${JSON.stringify(nativeOptionStyle)}`);
    await desktop.locator('[data-module-id="forum"] [data-action="go-injection-settings"]').click();
    if (!await desktop.locator('[data-settings-block="chat-injection"]').count()) throw new Error('forum card did not open the centralized main-chat injection controls');
    if (!await desktop.getByText('论坛 → 正文', { exact: true }).count()) throw new Error('main-chat injection direction is not labelled');
    await desktop.waitForTimeout(40);
    const injectionOffset = await desktop.locator('[data-settings-block="chat-injection"]').evaluate((block) => {
        const view = block.closest('.tf-view');
        return block.getBoundingClientRect().top - view.getBoundingClientRect().top;
    });
    if (injectionOffset > 80) throw new Error(`main-chat injection controls were not focused after navigation (${injectionOffset}px)`);
    await desktop.screenshot({ path: 'preview-injection-v2.png' });
    await desktop.locator('[data-action="me-section"][data-section="modules"]').click();
    await desktop.screenshot({ path: 'preview-settings-v3.png' });
    if (await desktop.locator('[data-action="set-world-home-layout"], .tf-world-layout-switch').count()) throw new Error('removed world layout switch is still visible');
    const travelToggle = desktop.locator('[data-action="toggle-world-module"][data-module-id="travel"]');
    if (!await travelToggle.isChecked()) await travelToggle.check({ force: true });
    await desktop.locator('[data-module-id="travel"] [data-module-field="travelDurationPreset"]').selectOption('test');
    if (!/2 分钟～5 分钟返家/.test(await desktop.locator('[data-module-id="travel"] .tf-travel-timing-settings').innerText())) throw new Error('travel duration preset did not expose the user-selected return window');
    if (await desktop.locator('[data-module-id="travel"] [data-module-field="generationMode"]').count()) throw new Error('travel should not expose a repeated linked-generation mode');
    await desktop.locator('[data-module-id="travel"] [data-module-field="travelDurationPreset"]').selectOption('custom');
    if (await desktop.locator('[data-module-id="travel"] .tf-travel-custom-time input').count() !== 4) throw new Error('custom travel timing did not expose duration and message interval controls');
    await desktop.locator('[data-module-id="travel"] [data-module-field="travelDurationPreset"]').selectOption('test');
    await desktop.locator('[data-module-id="travel"] .tf-travel-timing-settings').scrollIntoViewIfNeeded();
    await desktop.screenshot({ path: 'preview-travel-settings-v2.png' });
    const fortuneToggle = desktop.locator('[data-action="toggle-world-module"][data-module-id="fortune"]');
    if (!await fortuneToggle.isChecked()) await fortuneToggle.check({ force: true });
    const healthToggle = desktop.locator('[data-action="toggle-world-module"][data-module-id="health"]');
    if (!await healthToggle.isChecked()) await healthToggle.check({ force: true });
    const inventoryToggle = desktop.locator('[data-action="toggle-world-module"][data-module-id="inventory"]');
    if (!await inventoryToggle.isChecked()) await inventoryToggle.check({ force: true });
    if (await desktop.locator('[data-action="toggle-fortune-api-draw"]').isChecked()) throw new Error('AI fortune draw must be disabled by default');
    await desktop.locator('.tf-topbar [data-tab="services"]').click();
    if (await desktop.locator('.tf-service-card').count() < 4) throw new Error('enabled world modules are missing from the world hub');
    if (!await desktop.locator('.tf-world-hub.is-layout-bento .tf-world-bento').count()) throw new Error('default world home is missing its companion bento layout');
    if (!await desktop.locator('.tf-world-app-dock.is-bento-dock').count()) throw new Error('bento world home is missing its compact app dock');
    await desktop.screenshot({ path: 'preview-world.png' });
    await desktop.locator('.tf-service-card[data-action="open-world-page"][data-module-id="inventory"]').click();
    if (!await desktop.locator('.tf-inventory-app .tf-inventory-hero').count()) throw new Error('inventory did not render its standalone app shell');
    if (await desktop.locator('.tf-inventory-empty .tf-empty-pockets > span').count() !== 3) throw new Error('empty inventory did not render its three compact storage slots');
    await desktop.screenshot({ path: 'preview-inventory-empty-v2.png' });
    await desktop.locator('[data-action="back-world-home"]').click();
    const callsBeforeLayoutSwitch = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.evaluate(() => {
        const context = globalThis.SillyTavern.getContext();
        context.extensionSettings.tavern_forum.ui.worldHomeLayout = 'window';
        context.chatMetadata.tavern_forum_data.world.companion.weather = 'snow';
        context.chatMetadata.tavern_forum_data.world.companion.timeOfDay = 'dusk';
    });
    await desktop.locator('.tf-topbar .tf-main-nav [data-tab="home"]').click();
    await desktop.locator('.tf-topbar [data-tab="services"]').click();
    if (!await desktop.locator('.tf-world-hub.is-layout-window .tf-world-window-scene').count()) throw new Error('world window layout did not render');
    if (!await desktop.locator('.tf-world-hub.is-weather-snow.is-time-dusk').count()) throw new Error('world window did not apply weather and time to the full scene');
    if (await desktop.locator('.tf-window-snow b').count() !== 30) throw new Error('world window snow does not expose the complete depth field');
    if (/✦/.test(await desktop.locator('.tf-window-snow').innerText())) throw new Error('world window snow fell back to decorative star glyphs');
    if (!await desktop.locator('.tf-world-window-scene .tf-window-companion').count()) throw new Error('world window lost its companion overlay');
    if (await desktop.locator('.tf-window-companion .tf-pixel-avatar').count()) throw new Error('world window status strip repeated the scene companion');
    if (!await desktop.locator('#tavern-forum-fab').isHidden()) throw new Error('floating launcher should hide while the app is open');
    if (await desktop.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-desktop') throw new Error('desktop layout switch replaced the app shell');
    const windowSceneBackground = await desktop.locator('.tf-window-scene-image').evaluate(node => getComputedStyle(node).backgroundImage);
    if (!/world-window-base\.png/.test(windowSceneBackground)) throw new Error(`world window did not load its bundled local scene: ${windowSceneBackground}`);
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeLayoutSwitch) throw new Error('switching world home layout unexpectedly called the API');
    await desktop.screenshot({ path: 'preview-world-window.png' });
    await desktop.locator('.tf-window-fortune').click();
    if (!await desktop.locator('.tf-fortune-ritual, .tf-fortune-reveal, .tf-fortune-app').count()) throw new Error('window fortune overlay opened the wrong world app');
    await desktop.locator('[data-action="back-world-home"]').click();
    if (!await desktop.locator('.tf-world-hub.is-layout-window').count()) throw new Error('returning from a window overlay lost the selected layout');
    await desktop.evaluate(() => {
        const context = globalThis.SillyTavern.getContext();
        context.extensionSettings.tavern_forum.ui.worldHomeLayout = 'bento';
        context.chatMetadata.tavern_forum_data.world.companion.weather = 'auto';
        context.chatMetadata.tavern_forum_data.world.companion.timeOfDay = 'auto';
    });
    await desktop.locator('.tf-topbar .tf-main-nav [data-tab="home"]').click();
    await desktop.locator('.tf-topbar [data-tab="services"]').click();
    if (!await desktop.locator('.tf-world-hub.is-layout-bento').count()) throw new Error('world home did not switch back to bento');
    if (await desktop.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-desktop') throw new Error('returning to the card layout replaced the app shell');
    await desktop.locator('.tf-service-card[data-action="open-world-page"][data-module-id="travel"]').click();
    if (await desktop.locator('.tf-pet-screen-menu').count() !== 1) throw new Error('in-device care menu is missing');
    if (await desktop.locator('.tf-companion-status [data-action="companion-care"]').count()) throw new Error('care actions should not be duplicated beside the device');
    if (await desktop.locator('[data-companion-field="avatarUrl"]').count()) throw new Error('companion avatar URL field should stay hidden');
    if (await desktop.getByText('寄回的见闻', { exact: true }).count()) throw new Error('companion travel log should stay hidden');
    await desktop.locator('[data-action="toggle-companion-profile"]').click();
    if (await desktop.locator('[data-action="choose-companion-species"]').count() !== 9) throw new Error('expected nine built-in pixel companions');
    if (await desktop.locator('[data-action="choose-companion-device"]').count() !== 10) throw new Error('expected ten device structures');
    if (await desktop.locator('.tf-pet-appearance-controls input[type="color"]').count() !== 3) throw new Error('companion body, accent and accessory palettes are incomplete');
    if (await desktop.locator('.tf-pet-appearance-controls select[data-companion-appearance-field="accessory"]').count() !== 1) throw new Error('companion accessory control is missing');
    if (await desktop.locator('[data-action="save-companion-appearance"]').count() !== 1) throw new Error('companion appearance has no explicit save action');
    const speciesBodyColors = await desktop.locator('[data-action="choose-companion-species"] .tf-pixel-body').evaluateAll(nodes => [...new Set(nodes.map(node => getComputedStyle(node).fill))]);
    if (speciesBodyColors.length < 5) throw new Error(`companion species are still visually monochrome: ${JSON.stringify(speciesBodyColors)}`);
    const companionSpecies = ['frog', 'cat', 'rabbit', 'fox', 'penguin', 'robo-bird', 'octopus', 'goldfish', 'soot'];
    const companionAccessories = ['scarf', 'satchel', 'flower', 'charm', 'ribbon', 'glasses', 'crown', 'leaf', 'headphones', 'cape', 'bell'];
    const speciesPreviews = await desktop.locator('[data-action="choose-companion-species"] .tf-pixel-pet').evaluateAll((nodes, ids) => nodes.map((node, index) => ({ id: ids[index], svg: node.outerHTML })), companionSpecies);
    await desktop.evaluate(previews => {
        const sheet = document.createElement('section');
        sheet.id = 'tf-species-contact-sheet';
        sheet.style.cssText = 'position:fixed;inset:10px;z-index:99999;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px;background:#e9e3d9;color:#29352f;font:800 13px/1.2 sans-serif';
        sheet.innerHTML = previews.map(item => `<article style="display:grid;grid-template-columns:150px 1fr;place-items:center;gap:12px;padding:12px 18px;background:#fff;border:1px solid #d2c8bb;border-radius:18px"><div>${item.svg}</div><div><b>${item.id}</b><small style="display:block;margin-top:7px;color:#7b756e;font-weight:600">统一 2px 网格 · 独立轮廓与动作部件</small></div></article>`).join('');
        sheet.querySelectorAll('.tf-pixel-pet').forEach(node => { node.style.width = '145px'; node.style.height = '145px'; });
        document.querySelector('#tavern-forum-root').append(sheet);
    }, speciesPreviews);
    await desktop.locator('#tf-species-contact-sheet').screenshot({ path: 'preview-companion-species-v3.png' });
    await desktop.locator('#tf-species-contact-sheet').evaluate(node => node.remove());
    const accessoryPreviews = [];
    for (const speciesId of companionSpecies) {
        await desktop.locator(`[data-action="choose-companion-species"][data-species-id="${speciesId}"]`).click();
        const bodyFillBeforeAccessories = await desktop.locator('.tf-pet-stage .tf-pixel-body').first().evaluate(node => getComputedStyle(node).fill);
        for (const accessoryId of companionAccessories) {
            await desktop.locator('[data-companion-appearance-field="accessory"]').selectOption(accessoryId);
            const visibleAccessory = desktop.locator(`.tf-pet-stage .tf-pixel-accessory[data-accessory="${accessoryId}"]`);
            if (!await visibleAccessory.count()) throw new Error(`${speciesId} did not render ${accessoryId}`);
            if (await desktop.locator(`.tf-pet-stage .tf-pixel-accessory:not([data-accessory="${accessoryId}"])`).count()) throw new Error(`${speciesId} rendered inactive accessory layers beside ${accessoryId}`);
            const currentBodyFill = await desktop.locator('.tf-pet-stage .tf-pixel-body').first().evaluate(node => getComputedStyle(node).fill);
            if (currentBodyFill !== bodyFillBeforeAccessories) throw new Error(`${accessoryId} changed ${speciesId}'s body color`);
            accessoryPreviews.push({ speciesId, accessoryId, svg: await desktop.locator('.tf-pet-stage .tf-pixel-pet').evaluate(node => node.outerHTML) });
        }
    }
    await desktop.evaluate(previews => {
        const sheet = document.createElement('section');
        sheet.id = 'tf-accessory-contact-sheet';
        sheet.style.cssText = 'position:fixed;inset:8px;z-index:99999;display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:4px;padding:7px;background:#f4efe6;overflow:hidden;color:#29352f;font:700 8px/1.05 sans-serif';
        sheet.innerHTML = previews.map(item => `<article style="display:grid;place-items:center;gap:1px;min-height:96px;padding:3px;background:#fff;border:1px solid #d9d0c3;border-radius:7px"><span>${item.speciesId} · ${item.accessoryId}</span>${item.svg}</article>`).join('');
        sheet.querySelectorAll('.tf-pixel-pet').forEach(node => { node.style.width = '61px'; node.style.height = '61px'; });
        document.querySelector('#tavern-forum-root').append(sheet);
    }, accessoryPreviews);
    await desktop.locator('#tf-accessory-contact-sheet').screenshot({ path: 'preview-companion-accessories-v3.png' });
    await desktop.locator('#tf-accessory-contact-sheet').evaluate(node => node.remove());
    await desktop.locator('[data-action="choose-companion-species"][data-species-id="goldfish"]').click();
    const callsBeforeBettaBubbles = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    if (await desktop.locator('[data-action="companion-care"][data-care="talk"]').count()) throw new Error('secondary care actions should stay behind the in-device more menu');
    await desktop.locator('[data-action="companion-menu-more"]').click();
    if (!await desktop.locator('[data-action="companion-care"][data-care="talk"]').count()) throw new Error('the in-device more menu did not reveal secondary care actions');
    await desktop.locator('[data-action="companion-care"][data-care="talk"]').click();
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeBettaBubbles) throw new Error('local betta bubble interaction unexpectedly called the API');
    if (!await desktop.locator('.tf-companion-v3.is-species-goldfish.is-action-talk .tf-betta-bubbles').isVisible()) throw new Error('betta talk interaction did not reveal its local bubble trail');
    const bettaBubbleAnimation = await desktop.locator('.tf-betta-bubbles i').first().evaluate(node => getComputedStyle(node).animationName);
    if (!bettaBubbleAnimation.includes('tf-betta-bubble')) throw new Error(`betta bubble animation is inactive: ${bettaBubbleAnimation}`);
    await desktop.waitForTimeout(980);
    await desktop.locator('.tf-pet-screen').screenshot({ path: 'preview-companion-betta-bubbles-v3.png' });
    await desktop.locator('[data-action="choose-companion-species"][data-species-id="fox"]').click();
    await desktop.locator('[data-companion-appearance-field="bodyColor"]').fill('#2f6f9f');
    await desktop.locator('[data-companion-appearance-field="accentColor"]').fill('#f1b54a');
    await desktop.locator('[data-companion-appearance-field="accessoryColor"]').fill('#cf6f91');
    await desktop.locator('[data-companion-appearance-field="accessory"]').selectOption('scarf');
    if (!await desktop.locator('.tf-pet-stage .tf-pixel-pet.is-accessory-scarf').count()) throw new Error('selected companion accessory did not appear on the device');
    if (await desktop.locator('[data-action="save-companion-appearance"]').isDisabled()) throw new Error('editing companion colors did not enable explicit saving');
    const colorsBeforeSave = await desktop.evaluate(() => ({ ...globalThis.SillyTavern.getContext().chatMetadata.tavern_forum_data.world.companion }));
    if (colorsBeforeSave.bodyColor || colorsBeforeSave.accessory !== 'none') throw new Error('companion preview was persisted before the save button was pressed');
    await desktop.locator('[data-action="save-companion-appearance"]').click();
    const savedAppearance = await desktop.evaluate(() => ({ ...globalThis.SillyTavern.getContext().chatMetadata.tavern_forum_data.world.companion }));
    if (savedAppearance.bodyColor !== '#2f6f9f' || savedAppearance.accentColor !== '#f1b54a' || savedAppearance.accessoryColor !== '#cf6f91' || savedAppearance.accessory !== 'scarf') throw new Error(`companion appearance did not persist: ${JSON.stringify(savedAppearance)}`);
    await desktop.locator('[data-action="back-world-home"]').click();
    await desktop.locator('.tf-service-card[data-module-id="travel"]').click();
    if (await desktop.locator('[data-companion-appearance-field="bodyColor"]').inputValue() !== '#2f6f9f') throw new Error('saved companion color disappeared after re-entering the app');
    if (await desktop.locator('[data-companion-appearance-field="accessory"]').inputValue() !== 'scarf') throw new Error('saved companion accessory disappeared after re-entering the app');
    if (await desktop.locator('.tf-pet-screen-menu.is-extra').count()) await desktop.locator('[data-action="companion-menu-more"]').click();
    const callsBeforePet = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.locator('[data-action="companion-care"][data-care="feed"]').last().click();
    if (await desktop.locator('[data-action="companion-feed-food"]').count() !== 10) throw new Error('pet food selector did not expose all ten foods inside the device');
    await desktop.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
    const callsAfterPet = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    if (callsAfterPet !== callsBeforePet) throw new Error('local companion care unexpectedly called the API');
    if (await desktop.locator('.tf-feed-drop').getAttribute('data-food-animation') !== 'berry') throw new Error('feed animation did not use the selected food');
    if (!await desktop.locator('.tf-food-tray').count() || !await desktop.locator('.tf-food-offering').count() || await desktop.locator('.tf-food-crumb').count() !== 3) throw new Error('feed sequence is missing its hand, tray, offering or bite crumbs');
    const feedSequence = await desktop.locator('.tf-feed-drop').evaluate(node => {
        const read = selector => {
            const style = getComputedStyle(node.querySelector(selector));
            return { name: style.animationName, duration: style.animationDuration };
        };
        return { tray: read('.tf-food-tray'), food: read('.tf-food-offering') };
    });
    if (!feedSequence.tray.name.includes('tf-feed-tray-v3') || !feedSequence.food.name.includes('tf-food-present-v3')) throw new Error(`food presentation choreography is inactive: ${JSON.stringify(feedSequence)}`);
    if (feedSequence.tray.duration !== '2.6s' || feedSequence.food.duration !== '2.6s') throw new Error(`food and tray timelines are not synchronized: ${JSON.stringify(feedSequence)}`);
    const feedMotionRig = await desktop.locator('.tf-pet-sprite-control').evaluate(node => ({
        control: getComputedStyle(node).animationName,
        body: getComputedStyle(node.querySelector('.tf-pixel-body-rig')).animationName,
        face: getComputedStyle(node.querySelector('.tf-pixel-face-rig')).animationName,
        hasShadow: Boolean(node.querySelector('.tf-pet-character-shadow')),
    }));
    if (feedMotionRig.control !== 'none' || !feedMotionRig.body.includes('tf-feed-body-v4') || !feedMotionRig.face.includes('tf-feed-face-v4') || !feedMotionRig.hasShadow) throw new Error(`companion feed still behaves as one moving image: ${JSON.stringify(feedMotionRig)}`);
    const feedFaceFrames = await desktop.locator('.tf-pet-sprite-control').evaluate(node => ({
        open: getComputedStyle(node.querySelector('.tf-pixel-eyes-open')).animationName,
        happy: getComputedStyle(node.querySelector('.tf-pixel-eyes-happy')).animationName,
        pupils: getComputedStyle(node.querySelector('.tf-pixel-pupils')).animationName,
        closedMouth: getComputedStyle(node.querySelector('.tf-pixel-mouth-default')).animationName,
        mouth: getComputedStyle(node.querySelector('.tf-pixel-mouth-feed')).animationName,
    }));
    if (!feedFaceFrames.open.includes('tf-feed-eyes-open-v3') || !feedFaceFrames.happy.includes('tf-feed-eyes-happy-v3') || !feedFaceFrames.pupils.includes('tf-feed-pupils-v3') || !feedFaceFrames.closedMouth.includes('tf-feed-mouth-closed-v3') || !feedFaceFrames.mouth.includes('tf-feed-mouth-bites-v3')) throw new Error(`feeding has no staged facial performance: ${JSON.stringify(feedFaceFrames)}`);
    await desktop.waitForTimeout(1200);
    await desktop.locator('.tf-pet-screen').screenshot({ path: 'preview-companion-feed-v3.png' });
    const feedingSpecies = [
        ['frog', '.tf-pixel-legs'], ['cat', '.tf-pixel-tail'], ['rabbit', '.tf-pixel-paws'], ['penguin', '.tf-penguin-wing.is-left'],
        ['robo-bird', '.tf-pixel-antenna'], ['octopus', '.tf-octopus-arm.is-front-left'], ['goldfish', '.tf-betta-fin.is-pectoral'], ['soot', '.tf-pixel-arms'], ['fox', '.tf-pixel-tail'],
    ];
    for (const [speciesId, anatomySelector] of feedingSpecies) {
        await desktop.locator(`[data-action="choose-companion-species"][data-species-id="${speciesId}"]`).click();
        await desktop.locator('[data-action="companion-care"][data-care="feed"]').last().click();
        await desktop.locator('[data-action="companion-feed-food"][data-food-id="berry"]').click();
        const anatomyMotion = await desktop.locator('.tf-pet-sprite-control').evaluate((node, selector) => getComputedStyle(node.querySelector(selector)).animationName, anatomySelector);
        if (anatomyMotion === 'none') throw new Error(`${speciesId} has no species-aware feeding anatomy`);
        if (!await desktop.locator('.tf-food-tray').count()) throw new Error(`${speciesId} lost the shared hand-fed sequence`);
    }
    if (await desktop.locator('[data-action="choose-companion-species"][data-species-id="fox"]').getAttribute('aria-pressed') !== 'true') throw new Error('pixel companion selection did not update species');
    if (!await desktop.locator('.tf-companion-v3.is-action-feed .tf-feed-drop').isVisible()) throw new Error('feed animation did not activate');
    await desktop.locator('[data-action="companion-care"][data-care="pet"]').first().click();
    const petMotionRig = await desktop.locator('.tf-pet-sprite-control').evaluate(node => ({
        control: getComputedStyle(node).animationName,
        body: getComputedStyle(node.querySelector('.tf-pixel-body-rig')).animationName,
        face: getComputedStyle(node.querySelector('.tf-pixel-face-rig')).animationName,
    }));
    if (petMotionRig.control !== 'none' || !petMotionRig.body.includes('tf-living-nuzzle-body-v3') || !petMotionRig.face.includes('tf-living-nuzzle-face')) throw new Error(`companion petting did not use the internal motion rig: ${JSON.stringify(petMotionRig)}`);
    const namedReaction = await desktop.locator('.tf-pet-message').innerText();
    if (!/团子/.test(namedReaction) || /赤狐绕过/.test(namedReaction)) throw new Error(`companion interaction used the species instead of its name: ${namedReaction}`);
    await desktop.waitForTimeout(2450);
    if (!await desktop.locator('.tf-companion-v4.is-action-idle').count()) throw new Error('companion expression stayed locked after the interaction ended');
    const idleFace = await desktop.locator('.tf-pet-sprite-control').evaluate(node => ({
        open: getComputedStyle(node.querySelector('.tf-pixel-eyes-open')).display,
        happy: getComputedStyle(node.querySelector('.tf-pixel-eyes-happy')).display,
        pupils: getComputedStyle(node.querySelector('.tf-pixel-pupils')).animationName,
    }));
    if (idleFace.open === 'none' || idleFace.happy !== 'none' || !idleFace.pupils.includes('tf-expression-idle-pupils')) throw new Error(`companion did not return to an alert idle face: ${JSON.stringify(idleFace)}`);
    await desktop.locator('[data-action="choose-companion-species"][data-species-id="rabbit"]').click();
    await desktop.locator('[data-action="companion-care"][data-care="play"]').first().click();
    await desktop.waitForTimeout(260);
    const rabbitPlayFrameA = await desktop.locator('.tf-pet-sprite-control').evaluate(node => {
        const value = selector => getComputedStyle(node.querySelector(selector)).transform;
        return { body: value('.tf-pixel-body-rig'), pupils: value('.tf-pixel-pupils'), leftEar: value('.tf-rabbit-ear.is-left'), rightEar: value('.tf-rabbit-ear.is-right'), paws: value('.tf-pixel-paws') };
    });
    await desktop.waitForTimeout(430);
    const rabbitPlayFrameB = await desktop.locator('.tf-pet-sprite-control').evaluate(node => {
        const value = selector => getComputedStyle(node.querySelector(selector)).transform;
        return { body: value('.tf-pixel-body-rig'), pupils: value('.tf-pixel-pupils'), leftEar: value('.tf-rabbit-ear.is-left'), rightEar: value('.tf-rabbit-ear.is-right'), paws: value('.tf-pixel-paws'), mouthOpen: getComputedStyle(node.querySelector('.tf-pixel-mouth-feed')).display };
    });
    if (!await desktop.locator('.tf-companion-v4.is-action-play').count() || rabbitPlayFrameB.mouthOpen === 'none' || Object.keys(rabbitPlayFrameA).filter(key => rabbitPlayFrameA[key] !== rabbitPlayFrameB[key]).length < 4) throw new Error(`rabbit play did not articulate body, face, ears and paws: ${JSON.stringify({ rabbitPlayFrameA, rabbitPlayFrameB })}`);
    await desktop.waitForTimeout(2150);
    if (!await desktop.locator('.tf-companion-v4.is-action-idle').count()) throw new Error('rabbit play expression did not return to idle');
    const articulatedSpecies = [
        ['frog', '.tf-pixel-legs'],
        ['cat', '.tf-cat-ear.is-left'],
        ['fox', '.tf-fox-ear.is-left'],
        ['penguin', '.tf-penguin-wing.is-left'],
        ['robo-bird', '.tf-pixel-antenna'],
        ['octopus', '.tf-octopus-arm.is-left'],
        ['goldfish', '.tf-pixel-tail'],
        ['soot', '.tf-pixel-arms'],
    ];
    for (const [speciesId, anatomySelector] of articulatedSpecies) {
        await desktop.locator(`[data-action="choose-companion-species"][data-species-id="${speciesId}"]`).click();
        await desktop.locator('[data-action="companion-care"][data-care="play"]').first().click();
        await desktop.waitForTimeout(70);
        const motion = await desktop.locator('.tf-pet-sprite-control').evaluate((node, selector) => ({
            anatomy: getComputedStyle(node.querySelector(selector)).animationName,
            body: getComputedStyle(node.querySelector('.tf-pixel-body-rig')).animationName,
            pupils: getComputedStyle(node.querySelector('.tf-pixel-pupils')).animationName,
            mouthOpen: getComputedStyle(node.querySelector('.tf-pixel-mouth-feed')).display,
        }), anatomySelector);
        if (motion.anatomy === 'none' || !motion.body.includes('tf-living-play-body-v3') || !motion.pupils.includes('tf-expression-pupils-chase') || motion.mouthOpen === 'none') throw new Error(`${speciesId} has no complete species play choreography: ${JSON.stringify(motion)}`);
    }
    await desktop.evaluate(() => {
        const companion = globalThis.SillyTavern.getContext().chatMetadata.tavern_forum_data.world.companion;
        companion.energy = 100;
        companion.satiety = 100;
    });
    await desktop.waitForTimeout(2750);
    await desktop.locator('[data-action="choose-companion-species"][data-species-id="fox"]').click();
    const companionDevices = [
        ['classic', '经典蛋机'], ['pocket', '口袋掌机'], ['crystal', '透明糖果机'], ['arcane', '魔法通讯器'], ['terminal', '机械终端'],
        ['camp', '露营电台'], ['marine', '深海观察窗'], ['arcade', '迷你街机'], ['lunar', '月相怀表'], ['berry', '莓果翻盖机'],
    ];
    if (await desktop.locator('[data-action="choose-companion-device"]').count() !== companionDevices.length) throw new Error('device picker does not expose all ten shells');
    const devicePreviews = [];
    const deviceSignatures = new Set();
    for (const [deviceId, deviceName] of companionDevices) {
        const option = desktop.locator(`[data-action="choose-companion-device"][data-device-skin="${deviceId}"]`);
        await option.click();
        if (!await desktop.locator(`.tf-companion-v3.is-device-${deviceId}`).count()) throw new Error(`${deviceId} device structure selection did not persist`);
        if (await option.getAttribute('aria-pressed') !== 'true') throw new Error(`${deviceId} device option does not expose its selected state`);
        const shell = await desktop.locator('.tf-pet-console').evaluate(node => ({
            html: node.outerHTML,
            background: getComputedStyle(node).backgroundImage,
            radius: getComputedStyle(node).borderRadius,
            bezel: getComputedStyle(node.querySelector('.tf-pet-screen-bezel')).borderRadius,
            ornamentCount: node.querySelectorAll('.tf-device-ornaments > *').length,
        }));
        if (shell.ornamentCount !== 4) throw new Error(`${deviceId} shell is missing dedicated construction details`);
        deviceSignatures.add(`${shell.background}|${shell.radius}|${shell.bezel}`);
        devicePreviews.push({ id: deviceId, name: deviceName, html: shell.html });
    }
    if (deviceSignatures.size !== companionDevices.length) throw new Error(`device shells are not visually distinct enough: ${deviceSignatures.size}/${companionDevices.length}`);
    if (!await desktop.locator('.tf-companion-profile-card').evaluate(node => node.hasAttribute('open'))) throw new Error('companion profile collapsed after changing a device');
    await desktop.evaluate(previews => {
        const sheet = document.createElement('section');
        sheet.id = 'tf-device-contact-sheet';
        sheet.style.cssText = 'position:fixed;inset:8px;z-index:99999;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px;padding:10px;background:#e9e3d9;color:#342d33;font:800 12px/1.2 sans-serif';
        sheet.innerHTML = previews.map(item => `<article style="display:grid;grid-template-rows:28px 1fr;min-width:0;overflow:hidden;padding:9px;border:1px solid #d1c6b9;border-radius:14px;background:linear-gradient(145deg,#fff,#f5f0e8)"><header style="display:flex;justify-content:space-between;gap:6px"><b>${item.name}</b><small style="color:#8b7e83">${item.id}</small></header><div style="position:relative;min-height:0"><div class="tf-companion-v3 tf-companion-v4 is-device-${item.id} is-species-fox is-weather-sunny is-time-day is-habitat-meadow" style="position:absolute;top:0;left:50%;width:460px;transform:translateX(-50%) scale(.58);transform-origin:top center">${item.html}</div></div></article>`).join('');
        document.querySelector('#tavern-forum-root').append(sheet);
    }, devicePreviews);
    await desktop.locator('#tf-device-contact-sheet').screenshot({ path: 'preview-companion-devices-v2.png' });
    await desktop.locator('#tf-device-contact-sheet').evaluate(node => node.remove());
    if (await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="habitat"]').count() !== 8) throw new Error('visual habitat picker does not expose all eight scenes');
    if (await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="weather"]').count() !== 6) throw new Error('visual weather picker does not expose all weather modes');
    if (await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="timeOfDay"]').count() !== 5) throw new Error('visual time picker does not expose all time modes');
    const nativeHabitatControl = await desktop.locator('[data-companion-environment="habitat"]').evaluate(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, pointerEvents: getComputedStyle(node).pointerEvents, tabIndex: node.tabIndex }));
    if (nativeHabitatControl.width > 1 || nativeHabitatControl.height > 1 || nativeHabitatControl.pointerEvents !== 'none' || nativeHabitatControl.tabIndex !== -1) throw new Error(`native habitat dropdown is still interactive: ${JSON.stringify(nativeHabitatControl)}`);
    await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="weather"][data-environment-value="sunny"]').click();
    await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="timeOfDay"][data-environment-value="day"]').click();
    const habitatPreviews = [];
    for (const habitat of [['meadow', '风吹草地'], ['pond', '荷叶池塘'], ['bedroom', '暖灯卧室'], ['forest', '林间树屋'], ['snowfield', '雪原营地'], ['city', '城市天台'], ['space', '星际舷窗'], ['arcade', '像素街机厅']]) {
        await desktop.locator(`[data-action="choose-companion-environment"][data-environment-field="habitat"][data-environment-value="${habitat[0]}"]`).click();
        habitatPreviews.push({ id: habitat[0], name: habitat[1], stage: await desktop.locator('.tf-pet-stage').evaluate(node => node.outerHTML) });
    }
    await desktop.evaluate(previews => {
        const sheet = document.createElement('section');
        sheet.id = 'tf-habitat-contact-sheet';
        sheet.style.cssText = 'position:fixed;inset:10px;z-index:99999;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:10px;padding:12px;background:#e8e1d6;color:#29352f;font:800 12px/1.2 sans-serif';
        sheet.innerHTML = previews.map(item => `<article class="tf-companion-v3 tf-companion-v4 is-device-classic is-weather-sunny is-time-day is-habitat-${item.id}" style="display:grid;grid-template-rows:auto 1fr;gap:7px;min-width:0;padding:9px;background:#fff;border:1px solid #d3c9bc;border-radius:15px"><header style="display:flex;justify-content:space-between"><b>${item.name}</b><small style="color:#8b8278">${item.id}</small></header>${item.stage}</article>`).join('');
        document.querySelector('#tavern-forum-root').append(sheet);
    }, habitatPreviews);
    await desktop.locator('#tf-habitat-contact-sheet').screenshot({ path: 'preview-companion-habitats-v2.png' });
    await desktop.locator('#tf-habitat-contact-sheet').evaluate(node => node.remove());
    await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="habitat"][data-environment-value="snowfield"]').click();
    if (!await desktop.locator('.tf-companion-v4.is-habitat-snowfield').count()) throw new Error('visual habitat selection did not update the device scene');
    if (await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="habitat"][data-environment-value="snowfield"]').getAttribute('aria-selected') !== 'true') throw new Error('visual habitat selection did not expose its selected state');
    await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="weather"][data-environment-value="rain"]').click();
    await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="timeOfDay"][data-environment-value="night"]').click();
    if (!await desktop.locator('.tf-companion-v3.is-weather-rain.is-time-night').count()) throw new Error('manual weather and room time did not update the pet screen');
    if (await desktop.locator('[data-companion-environment="weather"]').inputValue() !== 'rain') throw new Error('manual weather did not persist');
    await desktop.locator('.tf-pet-environment-controls').screenshot({ path: 'preview-companion-environment-v2.png' });
    await desktop.locator('[data-action="choose-companion-environment"][data-environment-field="habitat"][data-environment-value="meadow"]').click();
    await desktop.locator('[data-action="choose-companion-device"][data-device-skin="classic"]').click();
    await desktop.locator('.tf-companion-home').scrollIntoViewIfNeeded();
    await desktop.screenshot({ path: 'preview-companion.png' });
    await desktop.locator('.tf-companion-profile-card').scrollIntoViewIfNeeded();
    await desktop.screenshot({ path: 'preview-companion-profile.png' });

    await desktop.evaluate(() => { Math.random = () => 0; });
    const callsBeforeJourney = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.locator('[data-action="companion-depart-ai"]').click();
    await desktop.locator('.tf-companion-trip-schedule').waitFor();
    await desktop.waitForFunction(before => globalThis.SillyTavern.getContext().generateCalls === before + 1, callsBeforeJourney);
    if (!/2 则来信/.test(await desktop.locator('.tf-companion-trip-schedule').innerText())) throw new Error('the one-call journey did not persist its full message schedule');
    await desktop.locator('.tf-companion-home').scrollIntoViewIfNeeded();
    await desktop.screenshot({ path: 'preview-companion-journey-v2.png' });
    await desktop.locator('[data-action="companion-signal-local"]').click();
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeJourney + 1) throw new Error('checking journey progress unexpectedly called the API again');
    await desktop.locator('[data-action="companion-return"]').click();
    await desktop.getByText(/已经放进背包/).waitFor();
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeJourney + 1) throw new Error('returning and settling the journey unexpectedly called the API again');
    if (!/背包/.test(await desktop.locator('.tf-pet-message').innerText())) throw new Error('companion return did not confirm souvenir inventory settlement');

    await desktop.locator('[data-action="back-world-home"]').click();
    await desktop.locator('.tf-service-card[data-action="open-world-page"][data-module-id="inventory"]').click();
    if (!/返程/.test(await desktop.locator('.tf-inventory-app').innerText())) throw new Error('returned companion souvenir is missing from inventory');
    if (!await desktop.locator('.tf-inventory-grid .tf-inventory-item').count()) throw new Error('inventory did not render returned items in its item grid');
    if (!await desktop.locator('.tf-inventory-detail').count()) throw new Error('inventory did not render the selected item detail');
    const callsBeforeInventory = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.locator('[data-action="set-inventory-filter"][data-filter="story"]').click();
    if (!await desktop.locator('.tf-inventory-filters [data-filter="story"].is-active').count()) throw new Error('inventory category selection did not persist');
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeInventory) throw new Error('local inventory filtering unexpectedly called the API');
    await desktop.screenshot({ path: 'preview-inventory-v2.png' });
    await desktop.locator('[data-action="back-world-home"]').click();
    await desktop.locator('.tf-service-card[data-action="open-world-page"][data-module-id="fortune"]').click();
    if (await desktop.locator('[data-action="revoke-local-fortune"]').count()) await desktop.locator('[data-action="revoke-local-fortune"]').click();
    if (!await desktop.locator('.tf-fortune-ritual .tf-fortune-deck').count()) throw new Error('fortune module is missing its independent ritual draw stage');
    if (await desktop.locator('.tf-fortune-ai-action').count()) throw new Error('disabled AI fortune should not leak API controls into the ritual');
    await desktop.screenshot({ path: 'preview-fortune-draw-v3.png' });
    const callsBeforeFortune = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.locator('[data-action="draw-local-fortune"]').first().click();
    if (!await desktop.locator('.tf-fortune-reveal.is-revealing').count()) throw new Error('fortune card did not enter its reveal animation state');
    if (await desktop.locator('.tf-fortune-impact article').count() !== 3) throw new Error('fortune result does not explain its cross-module effects');
    await desktop.waitForTimeout(1150);
    await desktop.screenshot({ path: 'preview-fortune-v3.png' });
    if (!await desktop.locator('[data-action="revoke-local-fortune"]').count()) throw new Error('fortune revoke action is missing');
    await desktop.locator('[data-action="revoke-local-fortune"]').click();
    if (!await desktop.locator('[data-action="draw-local-fortune"]').count()) throw new Error('fortune did not return to the local draw state after revoke');
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeFortune) throw new Error('local fortune draw or revoke unexpectedly called the API');

    await desktop.locator('.tf-settings-entry').click();
    const aiFortuneToggle = desktop.locator('[data-action="toggle-fortune-api-draw"]');
    if (!await aiFortuneToggle.isChecked()) await aiFortuneToggle.check({ force: true });
    await desktop.locator('[data-action="open-module-context"][data-module-id="fortune"]').click();
    const callsBeforeAiFortune = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.locator('[data-action="toggle-ai-fortune-mode"]').click();
    if (!await desktop.locator('.tf-fortune-ritual.is-ai-mode [data-action="draw-api-fortune"]').count()) throw new Error('AI fortune did not keep the physical card selection ritual');
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeAiFortune) throw new Error('arming AI fortune called the API before the user chose a card');
    await desktop.locator('[data-action="draw-api-fortune"][data-choice="middle"]').click();
    await desktop.waitForFunction(before => globalThis.SillyTavern.getContext().generateCalls === before + 1, callsBeforeAiFortune);
    await desktop.locator('.tf-fortune-reveal.is-revealing.is-choice-middle').waitFor();
    if (await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls) !== callsBeforeAiFortune + 1) throw new Error('AI fortune used more than one API call');
    await desktop.waitForTimeout(1150);
    await desktop.screenshot({ path: 'preview-fortune-ai-v4.png' });
    await desktop.locator('[data-action="revoke-local-fortune"]').click();

    await desktop.locator('[data-action="back-world-home"]').click();
    await desktop.locator('.tf-service-card[data-action="open-world-page"][data-module-id="health"]').click();
    if (!await desktop.locator('.tf-clinic-header').count()) throw new Error('health module is missing its independent clinic app header');
    await desktop.locator('[data-action="create-local-health"]').click();
    if (!await desktop.locator('.tf-care-scene').count()) throw new Error('animated local health scene is missing');
    if (!await desktop.locator('.tf-care-room .tf-care-character.is-patient').count()) throw new Error('health scene is missing its patient character');
    if (!await desktop.locator('.tf-care-progress-label').count()) throw new Error('health scene progress has no readable label');
    if (!await desktop.locator('.tf-care-instrument').count()) throw new Error('health scene is missing its examination instrument');
    if (!await desktop.locator('.tf-clinic-timeline').count()) throw new Error('health case is missing its recovery timeline');
    if (!await desktop.locator('.tf-clinic-appointment').count()) throw new Error('health case is missing its appointment panel');
    if (await desktop.getByText('CARE MOMENT', { exact: true }).count()) throw new Error('old mixed-language health heading should not be rendered');
    await desktop.locator('[data-action="health-find-provider"]').first().click();
    if (!await desktop.locator('.tf-health-case-v3.is-stage-seeking').count()) throw new Error('health animation stage did not advance');
    if (!await desktop.locator('.tf-care-character.is-helper').count()) throw new Error('health provider did not enter the scene');
    await desktop.screenshot({ path: 'preview-health-v3.png' });

    await desktop.locator('.tf-settings-entry').click();
    await desktop.locator('[data-action="me-section"][data-section="moderation"]').click();
    if (await desktop.locator('[data-action="toggle-system-ai-admin"]').isChecked()) throw new Error('system AI administrator must be disabled by default');
    if (!await desktop.locator('[data-action="toggle-npc-reports"]').isChecked()) throw new Error('NPC report capability should be available by default');
    await desktop.screenshot({ path: 'preview-moderation-ai.png' });

    await desktop.locator('.tf-topbar [data-tab="messages"]').click();
    if (!await desktop.locator('.tf-companion-dm-avatar').count()) throw new Error('companion conversation should use the pet portrait instead of an initial avatar');
    await desktop.locator('[data-action="open-conversation"][data-conversation-id="dm-1"]').click();
    if (!await desktop.locator('.tf-dm-profile-link').count()) throw new Error('conversation header profile link is missing');
    const callsBeforeSend = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    await desktop.locator('#tf-dm-input').fill('我会避开东岸。');
    await desktop.locator('[data-action="send-dm"]').click();
    await desktop.waitForTimeout(30);
    const callsAfterSend = await desktop.evaluate(() => globalThis.SillyTavern.getContext().generateCalls);
    if (callsAfterSend !== callsBeforeSend) throw new Error('plain DM send unexpectedly called the API');
    await desktop.locator('[data-action="generate-dm-reply"]').click();
    await desktop.waitForFunction(before => globalThis.SillyTavern.getContext().generateCalls > before, callsAfterSend);
    await desktop.screenshot({ path: 'preview-messages.png' });
    await desktop.locator('.tf-dm-profile-link').click();
    if (!await desktop.locator('.tf-public-profile').count()) throw new Error('conversation profile link did not open the role home page');
    await desktop.screenshot({ path: 'preview-dm-profile.png' });
    await desktop.locator('[data-action="close"]').last().click();
    const fab = desktop.locator('#tavern-forum-fab');
    const fabBox = await fab.boundingBox();
    if (!fabBox) throw new Error('floating launcher is missing');
    await desktop.mouse.move(fabBox.x + fabBox.width / 2, fabBox.y + fabBox.height / 2);
    await desktop.mouse.down();
    await desktop.mouse.move(fabBox.x - 70, fabBox.y - 55, { steps: 4 });
    await desktop.mouse.up();
    const savedFabPosition = await desktop.evaluate(() => globalThis.SillyTavern.getContext().extensionSettings.tavern_forum.ui.floatingButtonPosition);
    if (!Number.isFinite(savedFabPosition?.x) || !Number.isFinite(savedFabPosition?.y)) throw new Error('floating launcher position was not saved');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    enableScreenshotRetry(mobile);
    await mobile.goto(url, { waitUntil: 'networkidle' });
    await mobile.addStyleTag({ content: 'html { height: 0 !important; transform: translateZ(0); } body { position: fixed; inset: 0; height: 100dvh; }' });
    if (!await mobile.locator('#tavern-forum-root').isVisible()) throw new Error('mobile forum did not open from the floating launcher');
    const mobileRootBox = await mobile.locator('#tavern-forum-root').boundingBox();
    if (!mobileRootBox || mobileRootBox.height < 800) throw new Error(`mobile forum collapsed to ${mobileRootBox?.height || 0}px under a transformed zero-height root`);
    await mobile.locator('[data-action="close"]').last().click();
    await mobile.locator('#tavern-forum-menu-item').dispatchEvent('touchend');
    if (!await mobile.locator('#tavern-forum-root').isVisible()) throw new Error('mobile extension menu touch did not open the forum');
    await mobile.screenshot({ path: 'preview-mobile.png' });
    await mobile.locator('.tf-app').evaluate(node => { node.dataset.renderSentinel = 'stable-mobile'; });
    await mobile.locator('.tf-view').evaluate(node => { node.scrollTop = Math.min(420, node.scrollHeight - node.clientHeight); });
    const mobileHomeScroll = await mobile.locator('.tf-view').evaluate(node => node.scrollTop);
    await mobile.evaluate(() => {
        const settings = globalThis.SillyTavern.getContext().extensionSettings.tavern_forum;
        settings.modules.travel.enabled = true;
        settings.modules.fortune.enabled = true;
        settings.modules.health.enabled = true;
        settings.modules.inventory.enabled = true;
        settings.ui.worldHomeLayout = 'bento';
    });
    await mobile.locator('.tf-mobile-main-nav [data-tab="services"]').click();
    if (await mobile.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-mobile') throw new Error('mobile tab switch replaced the full app shell');
    if (!await mobile.locator('.tf-world-hub.is-layout-bento .tf-world-bento').count()) throw new Error('mobile world bento is missing');
    const mobileWorldWidth = await mobile.locator('.tf-world-hub').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    if (mobileWorldWidth.scroll > mobileWorldWidth.client + 2) throw new Error(`mobile world launcher overflowed horizontally (${mobileWorldWidth.scroll} > ${mobileWorldWidth.client})`);
    await mobile.screenshot({ path: 'preview-world-mobile.png' });
    await mobile.evaluate(() => {
        const context = globalThis.SillyTavern.getContext();
        context.extensionSettings.tavern_forum.ui.worldHomeLayout = 'window';
        context.chatMetadata.tavern_forum_data.world.companion.weather = 'rain';
        context.chatMetadata.tavern_forum_data.world.companion.timeOfDay = 'day';
    });
    await mobile.locator('.tf-mobile-main-nav [data-tab="home"]').click();
    await mobile.locator('.tf-mobile-main-nav [data-tab="services"]').click();
    if (!await mobile.locator('.tf-world-hub.is-layout-window .tf-world-window-scene').count()) throw new Error('mobile world window is missing');
    if (!await mobile.locator('.tf-world-hub.is-weather-rain.is-time-day').count()) throw new Error('mobile world window did not apply its weather scene');
    if (await mobile.locator('.tf-window-rain b').count() !== 28) throw new Error('mobile world window lost its rain depth field');
    if (await mobile.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-mobile') throw new Error('mobile layout switch replaced the app shell');
    const mobileReactionWidth = await mobile.locator('.tf-window-reaction').evaluate(node => node.getBoundingClientRect().width);
    if (mobileReactionWidth < 220) throw new Error(`mobile companion reaction is too narrow (${mobileReactionWidth}px)`);
    const mobileWindowWidth = await mobile.locator('.tf-world-hub').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    if (mobileWindowWidth.scroll > mobileWindowWidth.client + 2) throw new Error(`mobile world window overflowed horizontally (${mobileWindowWidth.scroll} > ${mobileWindowWidth.client})`);
    await mobile.screenshot({ path: 'preview-world-window-mobile.png', fullPage: true });
    await mobile.evaluate(() => {
        const context = globalThis.SillyTavern.getContext();
        context.extensionSettings.tavern_forum.ui.worldHomeLayout = 'bento';
        context.chatMetadata.tavern_forum_data.world.companion.weather = 'auto';
        context.chatMetadata.tavern_forum_data.world.companion.timeOfDay = 'auto';
    });
    await mobile.locator('.tf-mobile-main-nav [data-tab="home"]').click();
    await mobile.locator('.tf-mobile-main-nav [data-tab="services"]').click();
    if (await mobile.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-mobile') throw new Error('mobile return to the card layout replaced the app shell');
    await mobile.locator('.tf-service-card[data-module-id="fortune"]').click();
    if (await mobile.locator('[data-action="revoke-local-fortune"]').count()) await mobile.locator('[data-action="revoke-local-fortune"]').click();
    if (!await mobile.locator('.tf-fortune-deck').count()) throw new Error('mobile fortune ritual is missing');
    const mobileDeckWidth = await mobile.locator('.tf-fortune-ritual').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    if (mobileDeckWidth.scroll > mobileDeckWidth.client + 2) throw new Error(`mobile fortune ritual overflowed horizontally (${mobileDeckWidth.scroll} > ${mobileDeckWidth.client})`);
    await mobile.screenshot({ path: 'preview-fortune-mobile-v3.png', fullPage: true });
    await mobile.locator('[data-action="back-world-home"]').click();
    await mobile.locator('.tf-service-card[data-module-id="health"]').click();
    if (!await mobile.locator('.tf-health-case-v4').count()) await mobile.locator('[data-action="create-local-health"]').click();
    if (!await mobile.locator('.tf-clinic-timeline').count()) throw new Error('mobile health clinic lost its case timeline');
    await mobile.screenshot({ path: 'preview-health-mobile-v4.png', fullPage: true });
    await mobile.locator('[data-action="back-world-home"]').click();
    await mobile.locator('.tf-service-card[data-module-id="inventory"]').click();
    if (!await mobile.locator('.tf-inventory-app').count()) throw new Error('mobile inventory app is missing');
    const mobileInventoryWidth = await mobile.locator('.tf-inventory-app').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    if (mobileInventoryWidth.scroll > mobileInventoryWidth.client + 2) throw new Error(`mobile inventory overflowed horizontally (${mobileInventoryWidth.scroll} > ${mobileInventoryWidth.client})`);
    const mobileInventoryHasItems = await mobile.locator('.tf-inventory-grid .tf-inventory-item').count();
    if (mobileInventoryHasItems && !await mobile.locator('.tf-inventory-detail').count()) throw new Error('mobile inventory lost its item detail');
    if (!mobileInventoryHasItems && !await mobile.locator('.tf-inventory-empty').count()) throw new Error('mobile inventory lost both its item grid and empty state');
    await mobile.screenshot({ path: 'preview-inventory-mobile-v2.png', fullPage: true });
    await mobile.locator('[data-action="back-world-home"]').click();
    await mobile.locator('.tf-mobile-main-nav [data-tab="home"]').click();
    await mobile.waitForTimeout(40);
    const restoredMobileHomeScroll = await mobile.locator('.tf-view').evaluate(node => node.scrollTop);
    if (mobileHomeScroll > 80 && Math.abs(restoredMobileHomeScroll - mobileHomeScroll) > 8) throw new Error(`switching tabs did not restore home scroll from ${mobileHomeScroll} to ${restoredMobileHomeScroll}`);
    if (await mobile.locator('.tf-app').getAttribute('data-render-sentinel') !== 'stable-mobile') throw new Error('mobile return home replaced the full app shell');
    await mobile.locator('.tf-mobile-main-nav [data-tab="me"]').click();
    await mobile.locator('.tf-settings-entry').click();
    await mobile.locator('[data-action="me-section"][data-section="modules"]').click();
    const mobileSettingsNav = mobile.locator('.tf-settings-page .tf-me-nav');
    await mobileSettingsNav.evaluate(node => { node.scrollLeft = Math.min(260, node.scrollWidth - node.clientWidth); });
    const settingsNavScrollBefore = await mobileSettingsNav.evaluate(node => node.scrollLeft);
    await mobile.locator('[data-action="me-section"][data-section="prompts"]').evaluate(node => node.click());
    await mobile.waitForTimeout(80);
    const settingsNavScrollAfter = await mobile.locator('.tf-settings-page .tf-me-nav').evaluate(node => node.scrollLeft);
    if (settingsNavScrollBefore > 20 && Math.abs(settingsNavScrollAfter - settingsNavScrollBefore) > 8) throw new Error(`switching settings reset horizontal navigation from ${settingsNavScrollBefore} to ${settingsNavScrollAfter}`);
    const mobileReadOrderWidth = await mobile.locator('.tf-prompt-settings').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    if (mobileReadOrderWidth.scroll > mobileReadOrderWidth.client + 2) throw new Error(`mobile forum read order overflowed horizontally (${mobileReadOrderWidth.scroll} > ${mobileReadOrderWidth.client})`);
    await mobile.locator('.tf-prompt-list').scrollIntoViewIfNeeded();
    await mobile.screenshot({ path: 'preview-sources-order-mobile.png' });
    await mobile.screenshot({ path: 'preview-settings-mobile.png' });
    await mobile.locator('[data-action="me-section"][data-section="api"]').evaluate(node => node.click());
    await mobile.locator('[data-action="select-api-profile"]').selectOption('default-api-profile');
    await mobile.locator('[data-api-setting="text.endpoint"]').fill(`${new URL(url).origin}/mock-api`);
    const mobileModelInput = mobile.locator('[data-api-setting="text.model"]');
    await mobileModelInput.focus();
    await mobile.locator('[data-action="fetch-api-models"][data-api-kind="text"]').dispatchEvent('click');
    const mobileModelCatalog = mobile.locator('[data-api-model-choice="text"]');
    await mobileModelCatalog.waitFor({ state: 'visible' });
    const mobileModelInputStillFocused = await mobileModelInput.evaluate(node => document.activeElement === node);
    if (mobileModelInputStillFocused) throw new Error('mobile model loading left the manual input focused and kept the soft keyboard open');
    await mobileModelCatalog.selectOption('story-model-large');
    if (await mobile.locator('[data-api-setting="text.model"]').inputValue() !== 'story-model-large') throw new Error('mobile model catalog did not update the active API model');
    const mobileApiWidth = await mobile.locator('.tf-section-page').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    if (mobileApiWidth.scroll > mobileApiWidth.client + 2) throw new Error(`mobile API model picker overflowed horizontally (${mobileApiWidth.scroll} > ${mobileApiWidth.client})`);
    if (await mobile.locator('[data-api-setting="text.model"]').count() !== 1) throw new Error('mobile API settings lost manual model input');
    await mobile.screenshot({ path: 'preview-api-model-picker-mobile-v4.png', fullPage: true });
    await mobile.locator('[data-action="select-api-profile"]').selectOption('sillytavern-default');
    await mobile.locator('[data-action="me-section"][data-section="modules"]').evaluate(node => node.click());
    if (await mobile.locator('.tf-world-layout-options input').count() !== 2) throw new Error('mobile world settings lost the two home layouts');
    const mobileLayoutWidth = await mobile.locator('.tf-world-layout-settings').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    if (mobileLayoutWidth.scroll > mobileLayoutWidth.client + 2) throw new Error(`mobile world layout selector overflowed horizontally (${mobileLayoutWidth.scroll} > ${mobileLayoutWidth.client})`);
    await mobile.locator('.tf-world-layout-settings').scrollIntoViewIfNeeded();
    await mobile.screenshot({ path: 'preview-settings-world-mobile-v2.png' });
    const mobileTravelToggle = mobile.locator('[data-action="toggle-world-module"][data-module-id="travel"]');
    if (!await mobileTravelToggle.isChecked()) await mobileTravelToggle.check({ force: true });
    await mobile.locator('[data-action="open-module-context"][data-module-id="travel"]').click();
    await mobile.locator('[data-action="toggle-companion-profile"]').click();
    await mobile.locator('[data-action="choose-companion-device"][data-device-skin="lunar"]').click();
    if (!await mobile.locator('.tf-companion-v4.is-device-lunar').count()) throw new Error('new device shell did not persist on mobile');
    await mobile.locator('[data-action="toggle-companion-profile"]').click();
    const mobileConsoleBox = await mobile.locator('.tf-pet-console').boundingBox();
    if (!mobileConsoleBox || mobileConsoleBox.width > 370) throw new Error('mobile companion console overflowed the viewport');
    await mobile.locator('.tf-view').evaluate(node => { node.scrollTop = Math.min(480, node.scrollHeight - node.clientHeight); });
    const mobileScrollBefore = await mobile.locator('.tf-view').evaluate(node => node.scrollTop);
    await mobile.locator('[data-action="companion-care"][data-care="pet"]').first().evaluate(node => node.click());
    await mobile.waitForTimeout(80);
    const mobileScrollAfter = await mobile.locator('.tf-view').evaluate(node => node.scrollTop);
    if (mobileScrollBefore > 80 && Math.abs(mobileScrollAfter - mobileScrollBefore) > 8) throw new Error(`mobile interaction changed scroll from ${mobileScrollBefore} to ${mobileScrollAfter}`);
    await mobile.locator('.tf-view').evaluate(node => { node.scrollTop = 0; });
    await mobile.waitForTimeout(80);
    const mobileConsoleAtTop = await mobile.locator('.tf-pet-console').boundingBox();
    const mobileViewport = mobile.viewportSize();
    if (!mobileConsoleAtTop || !mobileViewport || mobileConsoleAtTop.y < 90 || mobileConsoleAtTop.y + mobileConsoleAtTop.height > mobileViewport.height - 70) throw new Error('mobile companion console is not fully visible between the app header and bottom navigation');
    await mobile.screenshot({ path: 'preview-companion-mobile.png', fullPage: true });
    await mobile.locator('[data-action="back-world-home"]').click();
    await mobile.locator('.tf-mobile-main-nav [data-tab="home"]').click();
    const mobileStories = mobile.locator('.tf-stories');
    await mobileStories.evaluate(node => { node.scrollLeft = Math.min(160, node.scrollWidth - node.clientWidth); });
    const storiesScrollBefore = await mobileStories.evaluate(node => node.scrollLeft);
    await mobile.locator('[data-action="feed-mode"][data-feed="latest"]').evaluate(node => node.click());
    await mobile.waitForTimeout(80);
    const storiesScrollAfter = await mobile.locator('.tf-stories').evaluate(node => node.scrollLeft);
    if (storiesScrollBefore > 20 && Math.abs(storiesScrollAfter - storiesScrollBefore) > 8) throw new Error(`switching feed reset stories scroll from ${storiesScrollBefore} to ${storiesScrollAfter}`);
    await mobile.locator('.tf-view').evaluate(node => { node.scrollTop = Math.min(620, node.scrollHeight - node.clientHeight); });
    const homeScrollBeforePost = await mobile.locator('.tf-view').evaluate(node => node.scrollTop);
    await mobile.locator('[data-action="open-post"]').first().evaluate(node => node.click());
    await mobile.screenshot({ path: 'preview-post-detail-mobile.png' });
    await mobile.locator('[data-action="back-post"]').click();
    await mobile.waitForTimeout(80);
    const homeScrollAfterPost = await mobile.locator('.tf-view').evaluate(node => node.scrollTop);
    if (homeScrollBeforePost > 80 && Math.abs(homeScrollAfterPost - homeScrollBeforePost) > 8) throw new Error(`leaving post reset home scroll from ${homeScrollBeforePost} to ${homeScrollAfterPost}`);
    await mobile.locator('.tf-mobile-main-nav [data-tab="messages"]').click();
    if (!await mobile.locator('.tf-dm-list').isVisible()) throw new Error('mobile conversation list is not visible');
    await mobile.screenshot({ path: 'preview-messages-list-mobile.png' });
    await mobile.locator('[data-action="open-conversation"]').first().click();
    if (!await mobile.locator('.tf-dm-chat').isVisible() || await mobile.locator('.tf-dm-list').isVisible()) throw new Error('mobile chat did not replace the conversation list');
    await mobile.screenshot({ path: 'preview-messages-chat-mobile-v9.png' });
    await mobile.locator('[data-action="back-dm-list"]').click();
    await mobile.locator('[data-action="message-mode"][data-mode="notifications"]').click();
    await mobile.screenshot({ path: 'preview-notifications-mobile.png' });
} finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
}
