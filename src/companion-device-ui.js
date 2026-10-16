import { getCompanionLifeView, canCareForCompanion } from './companion-life.js';
import { renderCompanionIcon } from './companion-icons.js';
import { renderCompanionRoomEditor } from './companion-room-ui.js';
import { renderHomesteadScene, renderHomeStations, renderHomesteadBar, renderHomesteadPanel, getHomeStationGeometry } from './companion-homestead-ui.js';
import { renderHomesteadMotion, renderFishingRod } from './companion-homestead-motion-ui.js';
import { renderFishingOverlay } from './companion-kitchen-fishing-ui.js';
import { getFishingView } from './companion-homestead.js';
import { renderAquaticHabitat, getAquaticHabitat, isAquaticCompanion } from './companion-aquatic.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const DEVICE_PAGES = ['home', 'menu', 'status', 'games', 'album', 'travel', 'dress', 'room'];
const menu = [
    ['status', '状态'], ['feed', '喂食'], ['games', '游戏'], ['clean', '清洁'],
    ['rest', '休息'], ['album', '相册'], ['travel', '旅行'], ['dress', '装扮'], ['room', '装修'],
];
const pageTabs = menu.filter(([id]) => ['status', 'games', 'album', 'travel', 'dress'].includes(id));

function deviceControlLabels(home, state, petAction = '') {
    if (state.companionFishing) return ['菜单', state.companionFishing.phase === 'bite' ? '收竿！' : '收竿', '取消'];
    if (state.companionHomesteadBusy) return state.companionHomesteadJob?.committed ? ['菜单', '保存中', '等待'] : ['菜单', '忙碌', '取消'];
    if (state.companionHomesteadPanel) return ['选择', '确认', '返回'];
    if (state.companionFoodMenuOpen) return ['选择', '确认', '返回'];
    if (!home) return ['选择', '确认', '回小窝'];
    const returnFromCare = state.companionCareReturnPanel && state.companionCareReturnPanel !== 'home';
    const middle = state.companionCleaning ? '擦洗' : petAction.includes('叫醒') ? '叫醒' : petAction.includes('继续') ? '继续' : '摸摸';
    const last = state.companionCleaning ? returnFromCare ? '返回' : '收起' : '状态';
    return ['菜单', middle, last];
}
const deviceControlHint = labels => labels.map((text, i) => `${'ABC'[i]} ${text}`).join(' · ');

// Reuse the existing controls and handlers; only their placement and presentation change.
export function renderCompanionDevice(html, data, state, extraActions) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const page = template.content.querySelector('.tf-companion-page');
    const pet = data.world.companion, life = getCompanionLifeView(pet);
    const current = DEVICE_PAGES.includes(state.companionPanel) ? state.companionPanel : 'home';
    const take = selector => page.querySelector(selector);
    const device = take('.tf-pet-console'), screen = take('.tf-pet-screen'), room = take('.tf-pet-stage');
    const character = room.querySelector('.tf-pixel-pet');
    const kind = [...(character?.classList || [])].find(value => value.startsWith('is-kind-'))?.slice(8) || 'mystery';
    const growthStage = [...(character?.classList || [])].find(value => value.startsWith('is-growth-'))?.slice(10) || 'adult';
    const aquatic = isAquaticCompanion(kind, growthStage, pet.avatarUrl);
    if (aquatic) {
        const control = room.querySelector('.tf-pet-sprite-control');
        const location = pet.homestead?.location || 'home', habitat = getAquaticHabitat(location);
        const point = life.sleeping ? habitat.rest : habitat.spawn;
        control.dataset.aquatic = kind === 'goldfish' ? 'fish' : 'tadpole';
        room.dataset.aquaticHabitat = location;
        room.dataset.aquaticMode = habitat.kind;
        control.style.setProperty('--tf-water-home-x', `${point[0] / 3.2}%`);
        control.style.setProperty('--tf-water-home-y', `${point[1] / 2.4}%`);
        room.insertAdjacentHTML('beforeend', renderAquaticHabitat(location));
        const animationLayer = room.querySelector('.tf-pet-animation-layer');
        if (animationLayer) control.append(animationLayer);
        // Keep care available without sending a floating companion onto a bed.
        room.querySelectorAll('.tf-room-live-hit').forEach(node => {
            const item = pet.room?.items?.find(value => value.id === node.dataset.roomItemId);
            if (['bed', 'bowl'].includes(item?.type)) {
                const label = habitat.kind === 'free'
                    ? item.type === 'bed' ? '安静休息' : '喂食'
                    : item.type === 'bed' ? '在水边安静休息' : '往水中投喂';
                node.setAttribute('aria-label', label); node.setAttribute('title', label);
            }
            else node.remove();
        });
    }
    room.insertAdjacentHTML('beforeend', '<span class="tf-pet-move-target" aria-hidden="true"></span>');
    const dashboard = take('.tf-pet-dashboard'), album = take('.tf-pet-memory-book');
    page.classList.add('tf-companion-device');
    page.classList.remove(...DEVICE_PAGES.map(id => 'is-panel-' + id));
    page.classList.add('is-panel-' + current);
    page.dataset.devicePage = current;
    page.dataset.homesteadLocation = pet.homestead?.location || 'home';
    const homesteadVisible = current === 'home' && !pet.life.game && !state.companionGameResultOpen
        && !state.companionCleaning && !state.companionFoodMenuOpen && !state.companionRoomCare;
    if ((homesteadVisible || aquatic && current === 'home' && !pet.life.game && !state.companionGameResultOpen) && pet.status !== 'away') {
        const scene = renderHomesteadScene(pet);
        if (scene.html) {
            room.classList.add(pet.homestead.location === 'kitchen' ? 'is-homestead-kitchen' : 'is-homestead-outdoors');
            const layer = room.querySelector('.tf-pet-habitat-layer');
            layer.removeAttribute('aria-hidden');
            layer.innerHTML = scene.html;
            room.querySelectorAll('.tf-room-foreground,.tf-room-live-hit').forEach(node => node.remove());
        } else room.insertAdjacentHTML('beforeend', renderHomeStations(pet));
        const motion = state.companionHomesteadMotion;
        if (motion) {
            room.classList.add('is-homestead-working');
            room.querySelectorAll('[data-action="homestead-target"]').forEach(node => {
                if (node.dataset.target === state.companionHomesteadJob?.target) node.classList.add('is-working-target');
            });
            const control = room.querySelector('.tf-pet-sprite-control');
            const label = { plant: '你正在播种', water: '你正在浇水', harvest: '你正在收获', gather: '你正在采集', pack: state.companionHomesteadJob?.action === 'exchange' ? '你正在分装种子' : '你正在整理行囊', cook: motion.itemId === 'bento' ? '你正在做便当' : '小锅咕嘟咕嘟', feed: '正在吃东西', fish: '你轻轻收竿' }[motion.action];
            control.dataset.homesteadMotion = motion.action;
            const atStove = motion.action === 'cook' && pet.homestead.location === 'kitchen';
            if (atStove) control.dataset.atStove = 'true';
            for (const node of [room, control]) {
                node.style.setProperty('--tf-homestead-duration', `${motion.duration}ms`);
                node.style.setProperty('--tf-homestead-elapsed', `${-Math.min(motion.duration, Math.max(0, Date.now() - motion.startedAt))}ms`);
            }
            control.setAttribute('aria-busy', 'true');
            control.setAttribute('aria-disabled', 'true');
            control.setAttribute('aria-label', label);
            const taskTarget = [...room.querySelectorAll('[data-action="homestead-target"]')].find(node => node.dataset.target === state.companionHomesteadJob?.target);
            const homeStations = getHomeStationGeometry(pet);
            const homeWorkPoint = homeStations.find(station => station.id === state.companionHomesteadJob?.target)?.work
                || homeStations.find(station => station.id === (motion.action === 'pack' ? 'packing' : 'storage'))?.work;
            const workPoint = taskTarget?.dataset.workX && taskTarget?.dataset.workY
                ? { x: Number(taskTarget.dataset.workX), y: Number(taskTarget.dataset.workY) }
                : taskTarget?.style.left && taskTarget?.style.top
                    ? { x: parseFloat(taskTarget.style.left) * 3.2, y: parseFloat(taskTarget.style.top) * 2.4 + 8 }
                    : ['pack', 'cook'].includes(motion.action) ? homeWorkPoint : { x: 160, y: 160 };
            const task = renderHomesteadMotion(motion.action, { itemId: motion.itemId, atStove, kind, growthStage, aquatic, workPoint });
            (task.includes('data-player-task=') ? room : control).insertAdjacentHTML('beforeend', task);
            room.insertAdjacentHTML('beforeend', `<span class="tf-homestead-working" role="status">${label}<i aria-hidden="true"></i></span>`);
        }
        if (state.companionFishing) {
            room.classList.add('is-homestead-fishing');
            room.querySelectorAll('[data-action="homestead-target"]').forEach(node => node.setAttribute('aria-disabled', 'true'));
            const control = room.querySelector('.tf-pet-sprite-control');
            control.dataset.fishingPhase = getFishingView(pet).phase;
            control.style.setProperty('--tf-fishing-cast-elapsed', `${-Math.max(0, Date.now() - (pet.homestead.fishing?.startedAt || 0))}ms`);
            control.setAttribute('aria-label', '正在河边钓鱼');
            control.insertAdjacentHTML('beforeend', renderFishingRod());
            room.insertAdjacentHTML('beforeend', renderFishingOverlay(pet, Date.now()));
            room.querySelector('[data-target="fishing"]')?.classList.add('is-working-target');
        }
        if (state.companionHomesteadFxUntil > Date.now()) room.insertAdjacentHTML('beforeend', `<span class="tf-homestead-result" aria-hidden="true">${esc(state.companionHomesteadFx)}</span>`);
    }
    const pane = (id, title) => {
        const node = document.createElement('section');
        node.className = 'tf-pet-device-page tf-pet-life'; node.dataset.companionPanel = id;
        node.hidden = current !== id;
        node.setAttribute('aria-label', title);
        const simpleHeader = id === 'menu' || id === 'room';
        const tabs = simpleHeader ? `<b>${title}</b>` : `<nav class="tf-device-page-tabs" aria-label="切换旅伴功能">${pageTabs.map(([panel, label]) => `<button type="button" data-action="companion-device-open" data-panel="${panel}" aria-current="${panel === id ? 'page' : 'false'}">${renderCompanionIcon(panel)}<span>${label}</span></button>`).join('')}</nav>`;
        node.innerHTML = `<header class="${simpleHeader ? '' : 'has-page-tabs'}">${tabs}<button type="button" class="tf-device-home" data-action="companion-panel" data-panel="home" aria-label="回到小窝">${renderCompanionIcon('home')}<span>回小窝</span></button></header><div class="tf-pet-device-content"></div>`;
        return node;
    };
    const mainMenu = pane('menu', '今天做什么');
    const status = pane('status', '看看状态'), games = pane('games', '一起玩'), memories = pane('album', '成长相册');
    const travel = pane('travel', '准备旅行'), dress = pane('dress', '装扮与设置'), roomEditor = pane('room', '装修小窝');
    travel.classList.add('tf-pet-travel-panel');
    const content = node => node.querySelector('.tf-pet-device-content');
    const statusContent = content(status);
    for (const selector of ['.tf-pet-vitals', '.tf-pet-pocket-meta', '.tf-pet-need', '.tf-pet-message', '.tf-pet-care-settings']) statusContent.append(dashboard.querySelector(selector));
    const gameList = dashboard.querySelector('.tf-pet-games');
    gameList.querySelector('h4')?.remove();
    content(games).append(gameList);
    content(games).insertAdjacentHTML('beforeend', `<details class="tf-pet-life-details"><summary>更多互动</summary><div class="tf-device-extra-actions">${extraActions.map(item => `<button type="button" data-action="companion-care" data-care="${item.id}">${renderCompanionIcon(item.id)}<span>${esc(item.label)}</span></button>`).join('')}</div></details>`);
    if (!canCareForCompanion(pet, 'play')) {
        const instructions = document.createElement('details');
        instructions.className = 'tf-pet-life-details';
        instructions.innerHTML = '<summary>玩法与奖励 · 每局 30 秒</summary>';
        instructions.append(gameList.querySelector('p'));
        content(games).append(instructions);
    }
    const news = album.querySelector('.tf-pet-growth-news');
    if (news) content(memories).append(news);
    for (const selector of ['.tf-pet-growth-album', '.tf-pet-growth', '.tf-pet-life-facts', '.tf-pet-diary']) {
        const node = album.querySelector(selector);
        if (node) content(memories).append(node.closest('details') || node);
    }
    content(travel).append(...take('.tf-pet-travel-panel').children);
    content(travel).querySelector('.tf-pet-section-heading')?.remove();
    const visited = pet.homestead?.visited || ['home'];
    const localRoutes = [['forest', '林间小径', '草莓种子'], ['river', '河边', '小萝卜种子']];
    const canDepart = pet.status !== 'away' && pet.homestead?.location === 'home' && !canCareForCompanion(pet, 'trip') && !state.moduleBusy?.has('travel');
    if (!pet.homestead?.starterGranted) content(travel).insertAdjacentHTML('afterbegin', '<section class="tf-homestead-travel"><p>柜子里为你备好了种子、工具和第一份便当。</p><button type="button" data-action="homestead-action" data-homestead-action="starter">领取小窝用品，装进行囊</button></section>');
    content(travel).insertAdjacentHTML('afterbegin', `<section class="tf-homestead-travel"><h3>沿着熟悉的小路出发</h3><p>先在行囊里选好物品，再让它独自去走走。途中会来信，返家会带回种子。</p><div>${localRoutes.map(([id, title, seed]) => `<button type="button" data-action="homestead-action" data-homestead-action="depart" data-location="${id}" ${canDepart && visited.includes(id) ? '' : 'disabled'}><b>${title}</b><small>${visited.includes(id) ? `带回 ${seed} ×2` : '陪它走到这里后解锁'}</small></button>`).join('')}</div>${pet.homestead?.location !== 'home' ? '<p>先沿小路回到小窝，再整理行囊出发。</p>' : ''}</section>`);
    if (pet.status !== 'away') {
        const packing = content(travel).querySelector('.tf-packing');
        const rules = document.createElement('details');
        rules.className = 'tf-pet-life-details';
        rules.innerHTML = '<summary>行囊有什么作用</summary>';
        rules.append(packing.querySelector(':scope > p'));
        packing.append(rules);
    }
    const profile = take('.tf-companion-profile-content');
    for (const [selector, title] of [
        ['.tf-companion-identity-section', '选择旅伴与名字'], ['.tf-pet-appearance-controls', '颜色与配饰'],
        ['.tf-pet-environment-controls', '小窝环境'], ['.tf-device-skin-section', '更换机身'],
    ]) {
        const details = document.createElement('details');
        details.className = 'tf-pet-life-details tf-device-setting-group';
        details.name = 'tf-companion-settings';
        details.innerHTML = `<summary>${title}</summary>`;
        const section = profile.querySelector(selector);
        if (selector === '.tf-pet-appearance-controls') {
            const preview = document.createElement('div'); preview.className = 'tf-device-appearance-preview';
            preview.innerHTML = room.querySelector('.tf-pixel-pet')?.outerHTML || '';
            section.prepend(preview);
        }
        details.append(section); content(dress).append(details);
    }
    content(dress).append(take('.tf-pet-decorate'));
    content(dress).insertAdjacentHTML('afterbegin', `<button type="button" class="tf-room-entry" data-action="companion-device-open" data-panel="room">${renderCompanionIcon('brush')}<span>自己装修小窝</span></button>`);
    content(roomEditor).innerHTML = renderCompanionRoomEditor(pet.room, state.companionRoomDraft);
    const nav = document.createElement('nav');
    nav.className = 'tf-pet-navigation tf-device-icon-menu'; nav.setAttribute('aria-label', '宠物机功能');
    nav.innerHTML = menu.map(([id, label]) => `<button type="button" data-action="companion-device-open" data-panel="${id}" title="${label}" aria-label="${label}" aria-current="${current === id ? 'page' : 'false'}">${renderCompanionIcon(id === 'room' ? 'brush' : id)}<span>${label}</span>${id === 'album' && pet.life.growthNotice ? '<i></i>' : ''}</button>`).join('');
    const viewport = document.createElement('div'); viewport.className = 'tf-device-viewport';
    room.hidden = current !== 'home';
    const need = {
        hungry: ['肚子饿了', '喂食', 'feed'], dirty: ['想洗个澡', '清洁', 'clean'],
        tired: ['有点困了', '休息', 'rest'], lonely: ['想你陪陪', '摸摸', 'pet'],
    }[life.activity];
    const busy = state.companionCleaning || state.companionFoodMenuOpen || state.companionGameResultOpen
        || state.companionHomesteadBusy || state.companionHomesteadPanel || state.companionFishing
        || state.moduleBusy?.has('travel');
    if (need && !busy && !canCareForCompanion(pet, need[2])) {
        const action = need[2] === 'pet' ? 'data-action="companion-care" data-care="pet"' : `data-action="companion-device-open" data-panel="${need[2]}"`;
        room.insertAdjacentHTML('beforeend', `<button type="button" class="tf-device-need" ${action} aria-label="${need[0]}，${need[1]}"><span>${need[0]}</span><b>· ${need[1]}</b>${renderCompanionIcon('right')}</button>`);
    }
    content(mainMenu).append(nav);
    viewport.append(room, mainMenu, status, games, memories, travel, dress, roomEditor);
    if (homesteadVisible) viewport.insertAdjacentHTML('beforeend', renderHomesteadPanel(data, state));
    const food = take('.tf-pet-food-select');
    if (food) { viewport.classList.add('is-selecting-food'); viewport.append(food); }
    const top = take('.tf-pet-screen-top');
    top.innerHTML = `<b>${esc(pet.name)}</b><span>${life.stageLabel}</span><button class="tf-device-menu-toggle" type="button" data-action="companion-panel" data-panel="menu" aria-label="打开宠物机菜单" aria-expanded="${current === 'menu'}">${renderCompanionIcon('menu')}<span>菜单</span>${pet.life.growthNotice ? '<i></i>' : ''}</button>`;
    const bottom = take('.tf-pet-screen-bottom');
    const labels = deviceControlLabels(current === 'home', state, room.querySelector('.tf-pet-sprite-control')?.getAttribute('aria-label') || '');
    bottom.innerHTML = `<span class="tf-device-selection-label" aria-live="polite">${pet.life.game ? '一起玩' : deviceControlHint(labels)}</span>`;
    screen.replaceChildren(top, viewport, bottom);
    if (homesteadVisible) bottom.insertAdjacentHTML('beforebegin', renderHomesteadBar(pet));
    if (pet.life.game || state.companionGameResultOpen) device.querySelectorAll('.tf-pet-device-controls button').forEach(node => {
        node.dataset.gameLabel = node.querySelector('span').innerHTML;
        node.dataset.gameAria = node.getAttribute('aria-label');
    });
    const wrap = document.createElement('div'); wrap.className = 'tf-pet-console-wrap'; wrap.append(device);
    const home = document.createElement('section'); home.className = 'tf-companion-home';
    home.append(wrap);
    home.insertAdjacentHTML('beforeend', `<p class="tf-pet-move-guide">${aquatic ? `${getAquaticHabitat(pet.homestead?.location).kind === 'free' ? '点场景空处' : '点水面'}，让它游过去 · 种地和做菜由你来操作` : '点小窝空地，让它走过去 · 点宠物摸摸它'}</p>`);
    const guide = home.querySelector('.tf-pet-move-guide');
    guide.setAttribute('role', 'status');
    guide.textContent = state.companionFishing ? state.companionFishing.error || '看浮漂轻轻晃动，等鱼儿咬钩后点击收竿 · C 可收起鱼竿' : state.companionHomesteadBusy
        ? state.companionHomesteadJob?.committed ? '已经忙完啦，正在记下这份小收获。' : '等它忙完这一小会 · 点空地或按 C 可以取消'
        : state.companionHomesteadNotice || '点空地走过去 · 从小窝出门，去种菜和采集';
    page.replaceChildren(home);
    return page.outerHTML;
}

export function getCompanionDeviceChoices(root) {
    const page = root?.querySelector('.tf-companion-device');
    if (!page) return [];
    if (page.querySelector('.tf-pet-food-select')) return [...page.querySelectorAll('.tf-pet-food-select [data-food-id]')];
    if (page.querySelector('.tf-homestead-panel')) return [...page.querySelectorAll('.tf-homestead-panel button')].filter(node => !node.disabled && node.getClientRects().length);
    const pane = page.querySelector('.tf-pet-device-page:not([hidden])');
    if (!pane) return [];
    return [...pane.querySelectorAll('.tf-pet-device-content button, .tf-pet-device-content summary, .tf-pet-device-content input, .tf-pet-device-content select')]
        .filter(node => !node.disabled && node.tabIndex !== -1 && node.getClientRects().length);
}

export function paintCompanionDeviceCursor(root, state, { scroll = false } = {}) {
    const page = root?.querySelector('.tf-companion-device');
    if (!page) return;
    if (page.dataset.devicePage === 'home') page.querySelectorAll('.tf-pet-device-controls button[data-game-label]').forEach(node => {
        node.querySelector('span').innerHTML = node.dataset.gameLabel;
        node.setAttribute('aria-label', node.dataset.gameAria);
    });
    const home = page.dataset.devicePage === 'home';
    if (home && (page.classList.contains('is-playing-game') || state.companionGameResultOpen)) return;
    const petAction = page.querySelector('.tf-pet-sprite-control')?.getAttribute('aria-label') || '';
    const labels = deviceControlLabels(home, state, petAction);
    page.querySelectorAll('.tf-pet-device-controls button').forEach((node, index) => {
        node.setAttribute('aria-disabled', String(Boolean(state.companionHomesteadBusy && index === 1)));
        node.setAttribute('aria-label', labels[index]);
        node.querySelector('span').innerHTML = `${'ABC'[index]}<small>${labels[index]}</small>`;
    });
    const choices = getCompanionDeviceChoices(root);
    page.querySelectorAll('.is-device-selected').forEach(node => node.classList.remove('is-device-selected'));
    let index = Math.min(choices.length - 1, state.companionDeviceCursor ?? -1);
    if (page.dataset.devicePage === 'menu' && index < 0 && choices.length) {
        index = Math.max(0, choices.findIndex(node => node.dataset.panel === state.companionMenuSelection));
    }
    state.companionDeviceCursor = index;
    const chosen = choices[index];
    if (page.querySelector('.tf-pet-food-select')) choices.forEach((node, i) => node.classList.toggle('is-selected', i === index));
    if (chosen) {
        chosen.classList.add('is-device-selected');
        if (page.dataset.devicePage === 'menu' && chosen.dataset.panel) state.companionMenuSelection = chosen.dataset.panel;
        if (scroll) chosen.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const label = page.querySelector('.tf-device-selection-label');
    if (label) {
        const selected = chosen && (chosen.getAttribute('aria-label') || chosen.getAttribute('title') || chosen.textContent.trim().slice(0, 28) || '确认选择');
        label.textContent = deviceControlHint(labels) + (selected ? ` · ${selected}` : '');
    }
}
