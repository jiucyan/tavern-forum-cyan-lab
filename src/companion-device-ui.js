import { getCompanionLifeView, canCareForCompanion } from './companion-life.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const DEVICE_PAGES = ['home', 'menu', 'status', 'games', 'album', 'travel', 'dress'];
const menu = [
    ['status', '♡', '状态'], ['feed', '●', '喂食'], ['games', '✦', '游戏'], ['clean', '▧', '清洁'],
    ['rest', '☾', '休息'], ['album', '▣', '相册'], ['travel', '↗', '旅行'], ['dress', '✿', '装扮'],
];
const menuIcons = {
    status: 'M2 3h4v2h2V3h4v2h2v5h-2v2h-2v2H6v-2H4v-2H2Z',
    feed: 'M3 2h2v5H3zM7 2h2v5H7zM2 7h8v2H7v5H5V9H2zM12 2h2v12h-2z',
    games: 'M4 3h8v2h2v7h-3v-2H5v2H2V5h2Zm0 3v2H3v1h2v1h1V9h2V8H6V6Zm6 1v2h2V7Z',
    clean: 'M3 6h10v2h2v4h-2v2H3v-2H1V8h2Zm0-4h2v2H3Zm6-2h2v2H9ZM5 8v2h6V8Z',
    rest: 'M7 1H4v2H2v3H1v4h2v3h3v2h5v-2h3v-3h-4V8H7V5H6V3h1Z',
    album: 'M2 2h12v12H2Zm2 2v5h2V7h2v2h2v2h2V4Zm0 7v1h4v-1Z',
    travel: 'M6 1h4v3h4v10H2V4h4Zm1 2v1h2V3ZM4 6v6h1V6Zm7 0v6h1V6Z',
    dress: 'M5 1h6v3h4v3h-4v8H5V7H1V4h4Zm2 2v2h2V3Z',
};
const menuIcon = id => `<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${menuIcons[id]}"></path></svg>`;

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
        node.innerHTML = `<header><b>${title}</b><button type="button" data-action="companion-panel" data-panel="home" aria-label="返回小窝"><svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M6 2v3h6v2h2v6H6v-2h6V7H6v3L1 6Z"></path></svg></button></header><div class="tf-pet-device-content"></div>`;
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
    content(games).insertAdjacentHTML('beforeend', `<details class="tf-pet-life-details"><summary>更多互动</summary><div class="tf-device-extra-actions">${extraActions.map(item => `<button type="button" data-action="companion-care" data-care="${item.id}">${esc(item.symbol)} ${esc(item.label)}</button>`).join('')}</div></details>`);
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
    nav.innerHTML = menu.map(([id, , label]) => `<button type="button" data-action="companion-device-open" data-panel="${id}" title="${label}" aria-label="${label}" aria-current="${current === id ? 'page' : 'false'}">${menuIcon(id)}<span>${label}</span>${id === 'album' && pet.life.growthNotice ? '<i></i>' : ''}</button>`).join('');
    const viewport = document.createElement('div'); viewport.className = 'tf-device-viewport';
    room.hidden = current !== 'home';
    content(mainMenu).append(nav);
    viewport.append(room, mainMenu, status, games, memories, travel, dress);
    const food = take('.tf-pet-food-select');
    if (food) { viewport.classList.add('is-selecting-food'); viewport.append(food); }
    const top = take('.tf-pet-screen-top');
    top.innerHTML = `<b>${esc(pet.name)}</b><span>${life.stageLabel}</span><button class="tf-device-menu-toggle" type="button" data-action="companion-panel" data-panel="menu" aria-label="打开宠物机菜单" aria-expanded="${current === 'menu'}"><svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M2 2h4v4H2zm8 0h4v4h-4zM2 10h4v4H2zm8 0h4v4h-4z"></path></svg><span>菜单</span>${pet.life.growthNotice ? '<i></i>' : ''}</button>`;
    const bottom = take('.tf-pet-screen-bottom');
    bottom.innerHTML = `<span class="tf-device-selection-label" aria-live="polite">${pet.life.game ? '一起玩' : life.sleeping ? '呼…呼…' : 'A 选择 · B 确认 · C 返回'}</span>`;
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
    const labels = home && !state.companionFoodMenuOpen
        ? ['菜单', state.companionCleaning ? '擦洗' : petAction.includes('叫醒') ? '叫醒' : petAction.includes('继续') ? '继续' : '摸摸', state.companionCleaning ? '收起' : '状态']
        : ['选择', '确认', '返回'];
    page.querySelectorAll('.tf-pet-device-controls button').forEach((node, index) => {
        node.setAttribute('aria-label', labels[index]);
        node.querySelector('span').innerHTML = `${'ABC'[index]}<small>${labels[index]}</small>`;
    });
    const choices = getCompanionDeviceChoices(root);
    page.querySelectorAll('.is-device-selected').forEach(node => node.classList.remove('is-device-selected'));
    const index = Math.min(choices.length - 1, state.companionDeviceCursor ?? -1);
    state.companionDeviceCursor = index;
    const chosen = choices[index];
    if (page.querySelector('.tf-pet-food-select')) choices.forEach((node, i) => node.classList.toggle('is-selected', i === index));
    if (chosen) {
        chosen.classList.add('is-device-selected');
        if (scroll) chosen.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const label = page.querySelector('.tf-device-selection-label');
    if (label) label.textContent = chosen ? chosen.getAttribute('aria-label') || chosen.getAttribute('title') || chosen.textContent.trim().slice(0, 28) || '确认选择' : 'A 选择 · B 确认 · C 返回';
}
