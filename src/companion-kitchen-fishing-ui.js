import { PET_ITEMS, RECIPES, getFishingView, getPetItemCount, getRecipeView } from './companion-homestead.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const svg = (art, cls = 'tf-kitchen-item-icon', width = 32, height = 32) => `<svg class="${cls}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${art}</svg>`;
const button = (action, label, attrs = '', disabled = false) => `<button type="button" data-action="homestead-action" data-homestead-action="${esc(action)}" ${attrs}${disabled ? ' disabled' : ''}>${label}</button>`;

const plate = rect(4, 22, 24, 5, '#b4bfa3') + rect(2, 20, 28, 4, '#e2e3c4') + rect(5, 19, 22, 3, '#faf0d3') + rect(7, 26, 18, 1, '#9caa8f');
const bowl = (soup, extra = '') => rect(6, 25, 20, 2, '#b79e79') + path('M3 14H29V21H27V25H23V28H9V25H5V21H3Z', '#b7836d') + path('M4 14H28V20H26V24H23V26H10V24H7V20H4Z', '#d1a28b') + rect(3, 12, 26, 5, '#ebd4ad') + rect(5, 13, 22, 3, soup) + rect(7, 19, 3, 4, '#e6b99e') + rect(11, 26, 12, 1, '#996e5d') + extra;
const steam = path('M10 3H12V7H10V10H8V6H10ZM21 1H23V5H21V9H19V5H21Z', '#d6c7a7');
const fishArt = (fill = '#8eafa9', light = '#c8d5bc') => path('M4 12H10V9H21V12H25V15H29V23H25V20H21V23H10V20H6V18H3V15H4Z', fill) + path('M9 12H20V14H23V16H19V14H10V16H6V14H9Z', light) + rect(9, 16, 2, 2, '#526f65') + path('M15 9V5H19V9ZM16 23V27H20V23Z', '#b6b990') + rect(13, 19, 7, 1, '#719990');

/** Small local SVGs also serve inventory, scene props and action results. */
export function renderKitchenFishingItemIcon(id) {
    let art = '';
    if (id === 'fish' || id === 'river-fish') art = fishArt();
    else if (id === 'silver-fish') art = fishArt('#99aeb5', '#dfddd0') + rect(15, 14, 2, 2, '#eaf0db') + rect(20, 16, 2, 1, '#dce4d4');
    else if (id === 'golden-fish') art = fishArt('#c4ac70', '#ead299') + rect(14, 15, 2, 2, '#f7e3ac') + rect(24, 17, 4, 4, '#d5b775');
    else if (id === 'fishing-rod') art = path('M5 29L22 3L25 5L8 31Z', '#a48661') + path('M8 24L22 4L23 5L9 25Z', '#d5b583') + path('M25 5H27V23H25V25H22V23H24V22H25Z', '#879e91') + rect(23, 16, 5, 4, '#ce8c78') + rect(23, 20, 5, 3, '#f1ddb5') + rect(4, 26, 5, 4, '#826e56');
    else if (id === 'vegetable-soup') art = steam + bowl('#c8b878', rect(9, 13, 4, 2, '#d6a16d') + rect(18, 14, 4, 2, '#9dab78') + rect(14, 12, 3, 2, '#e8d8a8') + rect(23, 12, 2, 2, '#7f9d6e'));
    else if (id === 'mushroom-stew') art = steam + bowl('#b29471', path('M8 14V11H10V9H14V11H16V14Z', '#e0c297') + rect(11, 14, 3, 2, '#f3e3be') + path('M18 15V12H20V10H24V12H26V15Z', '#c9a680') + rect(21, 15, 2, 2, '#ecd7b0') + rect(5, 14, 3, 1, '#8aa478'));
    else if (id === 'grilled-fish') art = plate + `<g transform="translate(0 -3)">${fishArt('#ba946c', '#e3c28e')}</g>` + path('M14 10L17 13L15 14L12 11ZM19 11L22 14L20 15L17 12Z', '#936f53') + rect(4, 22, 4, 2, '#9fb080') + rect(24, 21, 3, 3, '#e0c476');
    else if (id === 'fish-rice') art = bowl('#e6dab4', path('M7 12H12V10H20V12H24V16H7Z', '#faf0d1') + rect(8, 12, 2, 1, '#e0d3af') + rect(18, 13, 2, 1, '#e0d3af') + path('M10 13H13V11H21V13H24V18H13V16H10Z', '#bc9772') + rect(14, 12, 6, 2, '#dabb8d') + rect(15, 15, 2, 2, '#987353') + rect(20, 15, 2, 2, '#987353') + rect(6, 15, 3, 2, '#99af7b') + rect(23, 12, 3, 2, '#aab980'));
    else if (id === 'bento') art = rect(4, 11, 24, 16, '#b28d6c') + rect(5, 8, 22, 4, '#d6b48b') + rect(7, 12, 18, 11, '#f0dfbd') + rect(8, 14, 8, 7, '#faf0d4') + rect(19, 14, 5, 7, '#9bb77e') + rect(14, 8, 4, 19, '#c99088') + rect(15, 11, 2, 1, '#eed0ab');
    return art ? svg(art, 'tf-homestead-item-icon tf-kitchen-item-icon') : '';
}

function kitchenVignette() {
    const tiles = Array.from({ length: 12 }, (_, index) => rect(index * 12, 0, 11, 13, index % 3 ? '#e7e0c6' : '#d7ddc0') + rect(index * 12, 15, 11, 12, index % 4 ? '#ece4cc' : '#d9dfc1')).join('');
    const counter = rect(0, 36, 144, 18, '#bb9a73') + rect(0, 34, 144, 4, '#d6b789') + rect(1, 34, 142, 1, '#f0d8aa') + rect(0, 38, 144, 2, '#987f61') + rect(10, 42, 38, 12, '#ceae83') + rect(53, 42, 38, 12, '#ceae83') + rect(98, 41, 36, 13, '#7e7761') + rect(21, 45, 12, 2, '#8f8768') + rect(67, 45, 12, 2, '#8f8768');
    const window = rect(7, 2, 33, 29, '#baa47c') + rect(9, 4, 29, 25, '#eff0d5') + rect(11, 6, 25, 21, '#b2cabc') + path('M11 19H15V16H24V19H30V13H36V27H11Z', '#8fae89') + rect(22, 5, 2, 23, '#ecdfbc') + rect(10, 15, 27, 2, '#ecdfbc') + rect(6, 28, 35, 3, '#d5b789');
    const pan = rect(96, 32, 31, 2, '#6d7666') + rect(100, 21, 24, 12, '#82998b') + rect(100, 21, 24, 2, '#b9c8aa') + rect(102, 24, 3, 6, '#a3b5a1') + rect(95, 24, 5, 3, '#718176') + rect(124, 24, 5, 3, '#718176') + path('M106 9H108V13H106V17H104V13H106ZM118 7H120V11H118V16H116V11H118Z', '#f7eed5');
    const produce = rect(49, 28, 37, 5, '#bca17d') + rect(50, 28, 35, 1, '#ead4ad') + path('M54 23H61V26H64V29H55Z', '#d8a16e') + path('M56 23V18H59V22H62V24Z', '#98b17b') + path('M68 24H77V21H80V29H67Z', '#c2cb94') + rect(70, 23, 4, 2, '#e3dfb0') + rect(83, 18, 2, 12, '#ac9471') + rect(82, 14, 4, 6, '#c1c7a7');
    return svg(rect(0, 0, 144, 54, '#f1e8d1') + tiles + window + counter + produce + pan, 'tf-kitchen-vignette', 144, 54);
}

function recipeCard(data, recipe) {
    const view = getRecipeView(data, recipe.id);
    const ingredients = (view.ingredients || []).map(entry => {
        const enough = Number(entry.available) >= Number(entry.quantity);
        return `<li class="${enough ? 'is-ready' : 'is-missing'}"><span>${esc(entry.name || PET_ITEMS[entry.itemId]?.name || entry.itemId)}</span><span class="tf-kitchen-quantity" aria-label="需要 ${Number(entry.quantity) || 0} 份，拥有 ${Number(entry.available) || 0} 份">${Number(entry.available) || 0}<i>/</i>${Number(entry.quantity) || 0}</span></li>`;
    }).join('');
    const status = view.canCook ? '食材齐了，开火吧' : view.reason || '还差一点食材';
    return `<article class="tf-kitchen-recipe${view.canCook ? ' is-ready' : ''}" data-recipe-card="${esc(recipe.id)}"><div class="tf-kitchen-recipe-top"><div class="tf-kitchen-dish">${renderKitchenFishingItemIcon(recipe.outputId)}</div><div><h4>${esc(recipe.name)}</h4><p>${esc(recipe.description)}</p></div></div><ul class="tf-kitchen-ingredients" aria-label="食材：拥有数量 / 需要数量">${ingredients}</ul><div class="tf-kitchen-recipe-bottom"><small>${esc(status)}</small>${button('cook', '做一份', `class="tf-kitchen-cook" data-recipe-id="${esc(recipe.id)}" aria-label="烹饪${esc(recipe.name)}"`, !view.canCook)}</div></article>`;
}

export function renderKitchenPanel(data) {
    const dishes = RECIPES.filter(recipe => getPetItemCount(data, recipe.outputId) > 0);
    const table = dishes.length ? `<section class="tf-kitchen-table"><h4>刚做好的，趁热吃</h4>${dishes.map(recipe => `<div class="tf-kitchen-served">${renderKitchenFishingItemIcon(recipe.outputId)}<span><b>${esc(recipe.name)}</b><small>还有 ${getPetItemCount(data, recipe.outputId)} 份</small></span>${button('feed', '开饭', `data-item-id="${esc(recipe.outputId)}" aria-label="喂一份${esc(recipe.name)}"`)}</div>`).join('')}</section>` : '';
    return { title: '小厨房 · 手写食谱', html: `<div class="tf-kitchen-book"><div class="tf-kitchen-welcome">${kitchenVignette()}<div><span>从菜园到餐桌</span><p>今天，做点好吃的。</p></div></div>${table}<div class="tf-kitchen-recipes">${RECIPES.map(recipe => recipeCard(data, recipe)).join('')}</div><p class="tf-kitchen-footnote">做好的饭菜放进储物柜，也可以带着出门。</p></div>` };
}

const fishingCopy = {
    idle: ['河边慢慢等', '抛下鱼钩，等浮漂沉下去再收竿。'],
    waiting: ['浮漂轻轻摇', '鱼儿还在靠近，再等一会儿。'],
    bite: ['咬钩啦！', '浮漂沉下去了，现在收竿！'],
    escaped: ['鱼儿游走了', '收起鱼线，再试一次吧。'],
    cooldown: ['水面渐渐平静', '稍等片刻，就能再抛一竿。'],
};

function fishingWater(phase) {
    const bite = phase === 'bite';
    return svg(rect(0, 0, 120, 54, '#bdd3c2') + rect(0, 21, 120, 33, '#93bdb2') + path('M0 21H22V24H51V18H79V24H101V20H120V28H0Z', '#a8cbbc') + rect(6, 39, 29, 1, '#d1e2c9') + rect(82, 33, 31, 1, '#d1e2c9') + rect(36, 49, 20, 1, '#b8d4bf') + `<g class="tf-fishing-water-rings">${path('M43 38H53V37H72V38H79V40H69V41H51V40H43Z', '#dbe6ca') + rect(49, 39, 24, 1, '#91b9ad')}</g><g class="tf-fishing-float">${path('M62 0H63V29H62Z', '#7d9c91') + rect(60, bite ? 32 : 25, 5, 7, '#c98771') + rect(60, bite ? 39 : 32, 5, 5, '#f4dfba') + rect(61, bite ? 44 : 37, 3, 4, '#b4a07e') + (bite ? path('M54 28H56V32H54ZM70 27H72V31H70ZM62 19H64V23H62Z', '#f9e6b0') : '')}</g>`, 'tf-fishing-water', 120, 54);
}

function fishingButtons(view, compact = false) {
    const attrs = `class="tf-fishing-reel${view.phase === 'bite' ? ' is-bite' : ''}" data-cast-id="${esc(view.castId || '')}"`;
    if (['waiting', 'bite', 'escaped'].includes(view.phase)) return button('fish-reel', view.phase === 'bite' ? '现在收竿！' : view.phase === 'escaped' ? '收起鱼线' : '收竿', attrs) + button('fish-cancel', compact ? '离开' : '先不钓了', 'class="tf-fishing-cancel"');
    return button('fish-cast', view.phase === 'cooldown' ? '歇一会儿' : '抛下鱼钩', 'class="tf-fishing-cast"', view.phase === 'cooldown' || view.canCast === false);
}

export function renderFishingPanel(data, now = Date.now()) {
    const view = getFishingView(data?.world?.companion, now);
    const [title, description] = fishingCopy[view.phase] || fishingCopy.idle;
    const rod = getPetItemCount(data, 'fishing-rod');
    const fish = ['river-fish', 'silver-fish', 'golden-fish'].reduce((count, id) => count + getPetItemCount(data, id), 0);
    const needsKit = !rod && !data?.world?.companion?.homestead?.fishingKitGranted;
    const controls = needsKit ? button('fish-kit', `${renderKitchenFishingItemIcon('fishing-rod')}领一根小鱼竿`, 'class="tf-fishing-cast"') : fishingButtons({ ...view, canCast: rod > 0 });
    const note = rod ? '小鱼竿可以一直用。鲜鱼带回厨房，烤一烤就很香。' : needsKit ? '河边为你留了一根小鱼竿，领好就能开始。' : '鱼竿暂时不在手边，先把它从行囊里取回来吧。';
    return { title: '河边 · 钓鱼小憩', html: `<div class="tf-fishing-panel is-${esc(view.phase)}">${fishingWater(view.phase)}<div class="tf-fishing-copy" role="status" aria-live="polite"><h4>${title}</h4><p>${description}</p></div><div class="tf-fishing-actions">${controls}</div><div class="tf-fishing-basket">${renderKitchenFishingItemIcon('river-fish')}<span>鱼篓里有 <b>${fish}</b> 条鲜鱼</span></div><p class="tf-fishing-note">${esc(note)}</p></div>` };
}

/** Kept separate so the live float state can update without recreating the pet. */
export function renderFishingOverlay(companion, now = Date.now()) {
    const view = getFishingView(companion, now);
    if (!['waiting', 'bite', 'escaped'].includes(view.phase)) return '';
    const [title] = fishingCopy[view.phase];
    const clock = view.phase === 'bite' ? `${Math.max(0, Math.ceil(view.remainingMs / 1000))} 秒` : '';
    return `<aside class="tf-fishing-overlay is-${esc(view.phase)}" aria-label="钓鱼" data-fishing-phase="${esc(view.phase)}"><div class="tf-fishing-overlay-status"><span class="tf-fishing-float-symbol" aria-hidden="true"></span><b role="status" aria-live="polite" aria-atomic="true">${title}</b><small data-fishing-clock>${clock}</small></div><div class="tf-fishing-overlay-actions">${fishingButtons(view, true)}</div></aside>`;
}
