import { getCompanionLifeView, canCareForCompanion } from './companion-life.js';
import { renderCompanionIcon } from './companion-icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const DEVICE_PAGES = ['home', 'menu', 'status', 'games', 'album', 'travel', 'dress'];
const menu = [
    ['status', '状态'], ['feed', '喂食'], ['games', '游戏'], ['clean', '清洁'],
    ['rest', '休息'], ['album', '相册'], ['travel', '旅行'], ['dress', '装扮'],
];
const pageTabs = menu.filter(([id]) => ['status', 'games', 'album', 'travel', 'dress'].includes(id));

function deviceControlLabels(home, state, petAction = '') {
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
    const dashboard = take('.tf-pet-dashboard'), album = take('.tf-pet-memory-book');
    page.classList.add('tf-companion-device');
    page.dataset.devicePage = current;
    const pane = (id, title) => {
        const node = document.createElement('section');
        node.className = 'tf-pet-device-page tf-pet-life'; node.dataset.companionPanel = id;
        node.hidden = current !== id;
        node.setAttribute('aria-label', title);
        const tabs = id === 'menu' ? `<b>${title}</b>` : `<nav class="tf-device-page-tabs" aria-label="切换旅伴功能">${pageTabs.map(([panel, label]) => `<button type="button" data-action="companion-device-open" data-panel="${panel}" aria-current="${panel === id ? 'page' : 'false'}">${renderCompanionIcon(panel)}<span>${label}</span></button>`).join('')}</nav>`;
        node.innerHTML = `<header class="${id === 'menu' ? '' : 'has-page-tabs'}">${tabs}<button type="button" class="tf-device-home" data-action="companion-panel" data-panel="home" aria-label="回到小窝">${renderCompanionIcon('home')}<span>回小窝</span></button></header><div class="tf-pet-device-content"></div>`;
        return node;
    };
    const mainMenu = pane('menu', '今天做什么');
    const status = pane('status', '看看状态'), games = pane('games', '一起玩'), memories = pane('album', '成长相册');
    const travel = pane('travel', '准备旅行'), dress = pane('dress', '装扮与设置');
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
    const nav = document.createElement('nav');
    nav.className = 'tf-pet-navigation tf-device-icon-menu'; nav.setAttribute('aria-label', '宠物机功能');
    nav.innerHTML = menu.map(([id, label]) => `<button type="button" data-action="companion-device-open" data-panel="${id}" title="${label}" aria-label="${label}" aria-current="${current === id ? 'page' : 'false'}">${renderCompanionIcon(id)}<span>${label}</span>${id === 'album' && pet.life.growthNotice ? '<i></i>' : ''}</button>`).join('');
    const viewport = document.createElement('div'); viewport.className = 'tf-device-viewport';
    room.hidden = current !== 'home';
    const need = {
        hungry: ['肚子饿了', '喂食', 'feed'], dirty: ['想洗个澡', '清洁', 'clean'],
        tired: ['有点困了', '休息', 'rest'], lonely: ['想你陪陪', '摸摸', 'pet'],
    }[life.activity];
    const busy = state.companionCleaning || state.companionFoodMenuOpen || state.companionGameResultOpen
        || state.moduleBusy?.has('travel');
    if (need && !busy && !canCareForCompanion(pet, need[2])) {
        const action = need[2] === 'pet' ? 'data-action="companion-care" data-care="pet"' : `data-action="companion-device-open" data-panel="${need[2]}"`;
        room.insertAdjacentHTML('beforeend', `<button type="button" class="tf-device-need" ${action} aria-label="${need[0]}，${need[1]}"><span>${need[0]}</span><b>· ${need[1]}</b>${renderCompanionIcon('right')}</button>`);
    }
    content(mainMenu).append(nav);
    viewport.append(room, mainMenu, status, games, memories, travel, dress);
    const food = take('.tf-pet-food-select');
    if (food) { viewport.classList.add('is-selecting-food'); viewport.append(food); }
    const top = take('.tf-pet-screen-top');
    top.innerHTML = `<b>${esc(pet.name)}</b><span>${life.stageLabel}</span><button class="tf-device-menu-toggle" type="button" data-action="companion-panel" data-panel="menu" aria-label="打开宠物机菜单" aria-expanded="${current === 'menu'}">${renderCompanionIcon('menu')}<span>菜单</span>${pet.life.growthNotice ? '<i></i>' : ''}</button>`;
    const bottom = take('.tf-pet-screen-bottom');
    const labels = deviceControlLabels(current === 'home', state, room.querySelector('.tf-pet-sprite-control')?.getAttribute('aria-label') || '');
    bottom.innerHTML = `<span class="tf-device-selection-label" aria-live="polite">${pet.life.game ? '一起玩' : deviceControlHint(labels)}</span>`;
    screen.replaceChildren(top, viewport, bottom);
    if (pet.life.game || state.companionGameResultOpen) device.querySelectorAll('.tf-pet-device-controls button').forEach(node => {
        node.dataset.gameLabel = node.querySelector('span').innerHTML;
        node.dataset.gameAria = node.getAttribute('aria-label');
    });
    const wrap = document.createElement('div'); wrap.className = 'tf-pet-console-wrap'; wrap.append(device);
    const home = document.createElement('section'); home.className = 'tf-companion-home';
    home.append(wrap);
    page.replaceChildren(home);
    return page.outerHTML;
}

export function getCompanionDeviceChoices(root) {
    const page = root?.querySelector('.tf-companion-device');
    if (!page) return [];
    if (page.querySelector('.tf-pet-food-select')) return [...page.querySelectorAll('.tf-pet-food-select [data-food-id]')];
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
