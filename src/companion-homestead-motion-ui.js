import { renderHomesteadItemIcon } from './companion-homestead-ui.js';
import { renderWorkPoseArt } from './companion-work-pose.js';

const actions = new Set(['plant', 'water', 'harvest', 'gather', 'pack', 'cook', 'feed', 'fish']);
const goods = new Set(['carrot', 'turnip', 'strawberry', 'berry', 'mushroom', 'branch', 'reed', 'stone', 'bento']);
const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const group = (name, art) => `<g class="tf-hm-${name}">${art}</g>`;
const item = (id, x, y, size = 26) => `<g transform="translate(${x} ${y}) scale(${size / 32})">${renderHomesteadItemIcon(id).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
const contactShadow = `<g opacity=".16">${rect(59, 89, 27, 2, '#726b50') + rect(64, 91, 17, 1, '#726b50')}</g>`;

function planting(id) {
    const shovel = group('shovel', path('M66 48H77V52H73V74H69V52H66Z', '#af8d66') + rect(69, 50, 4, 2, '#e0bd8e') + path('M64 73H78V82H75V86H68V82H64Z', '#92aba0') + rect(66, 75, 4, 6, '#ccd8bb'));
    const soil = group('soil', rect(65, 86, 22, 2, '#997f5d') + rect(70, 82, 10, 4, '#ad8962') + rect(62, 81, 3, 3, '#bba079') + rect(85, 83, 3, 3, '#bba079'));
    const seed = ['carrot-seed', 'turnip-seed', 'strawberry-seed'].includes(id) ? id : ['carrot', 'turnip', 'strawberry'].includes(id) ? `${id}-seed` : 'carrot-seed';
    const pouch = group('seed-pouch', item(seed, 58, 56, 23));
    const seeds = [0, 1, 2].map((i) => `<g class="tf-hm-seed tf-hm-seed-${i}">${rect(74 + i * 3, 68, 2, 3, '#e4bd7c')}</g>`).join('');
    return soil + shovel + pouch + seeds;
}

function watering() {
    const can = group('can', path('M59 59H70V62H62V70H59Z', '#819c8b') + rect(62, 66, 20, 16, '#8eafa3') + rect(63, 63, 17, 5, '#c2d2b9') + rect(65, 69, 4, 9, '#b5c9b1') + rect(63, 80, 18, 2, '#718e83') + rect(64, 65, 14, 1, '#e5e5c7') + rect(74, 69, 3, 2, '#d3d8b8') + path('M81 70L91 63L93 68L82 78Z', '#8eafa3') + rect(89, 61, 6, 4, '#b4c9b4') + rect(91, 61, 1, 3, '#72968e'));
    const drops = [0, 1, 2, 3].map(i => `<g class="tf-hm-drop tf-hm-drop-${i}">${rect(88 + i % 2 * 4, 74, 2, 4, '#87bcb8')}</g>`).join('');
    return group('wet-soil', rect(82, 88, 16, 2, '#739e91') + rect(88, 86, 6, 2, '#94c4b8')) + can + drops;
}

function picking(id, harvest) {
    const crop = goods.has(id) ? id : harvest ? 'carrot' : 'berry';
    const soil = harvest ? group('soil', rect(65, 86, 21, 2, '#ac8d64') + rect(65, 83, 3, 3, '#c3a078') + rect(87, 84, 3, 2, '#c3a078')) : '';
    return soil + group(harvest ? 'harvest' : 'gather', item(crop, 61, 60, 31)) + group('pickup-leaf', path('M82 70H87V74H90V77H85V73H82Z', '#a9bd85'));
}

function packing(id) {
    const bag = group('bag', path('M65 66V60H78V66H75V63H68V66Z', '#a78d68') + path('M59 69H83V74H86V91H56V74H59Z', '#a8ad80') + rect(59, 72, 24, 16, '#c9ca9c') + rect(61, 81, 20, 7, '#dcd6ad') + rect(69, 78, 5, 4, '#b8986c') + rect(57, 76, 2, 10, '#8e9a73'));
    const flap = group('bag-flap', path('M58 69H84V76H80V79H62V76H58Z', '#b1ba88') + rect(69, 75, 5, 4, '#dfc389'));
    const packed = goods.has(id) || ['carrot-seed', 'turnip-seed', 'strawberry-seed'].includes(id) ? id : 'bento';
    return bag + group('pack-item', item(packed, 58, 39, 25)) + flap;
}

function cooking(id) {
    if (id !== 'bento') return group('cooking-pot', path('M53 75H87V87H84V92H58V88H53Z', '#789b92') + rect(54, 74, 32, 3, '#d7d7b9') + rect(57, 78, 26, 3, '#edcca1') + rect(49, 78, 5, 3, '#927854') + rect(87, 78, 6, 3, '#927854') + rect(58, 84, 3, 5, '#acc5ad'))
        + group('cook-spoon', path('M75 58H79V78H75Z', '#bc996e') + rect(73, 76, 8, 4, '#d6b483'))
        + group('steam', path('M61 66V62H64V58H67V61H64V66ZM77 65V60H80V56H83V60H80V65Z', '#f9ecd0'))
        + group('cooked-dish', item(id, 58, 55, 29));
    const box = group('bento-box', rect(54, 78, 33, 14, '#ad8b68') + rect(56, 76, 29, 12, '#d9b886') + rect(58, 78, 25, 8, '#f1dfb6') + rect(59, 79, 12, 6, '#fff0ce') + rect(74, 79, 7, 6, '#a4b980') + rect(78, 81, 3, 3, '#c78d7b'));
    const lid = group('bento-lid', rect(53, 73, 35, 5, '#b99a70') + rect(55, 73, 31, 3, '#e4c99a') + rect(69, 73, 5, 5, '#c38f88'));
    return box + group('cook-item', item('carrot', 58, 41, 24)) + lid + group('steam', path('M61 66V62H64V58H67V61H64V66ZM77 65V60H80V56H83V60H80V65Z', '#f9ecd0'));
}

function feeding(id, { kind, growthStage, aquatic }) {
    const food = ['carrot', 'turnip', 'strawberry', 'berry', 'mushroom', 'bento', 'vegetable-soup', 'mushroom-stew', 'grilled-fish', 'fish-rice'].includes(id) ? id : 'berry';
    if (aquatic) {
        // The aquatic avatar uses a .72 fit about its centre, then moves down 3%.
        // Keep the food at the actual mouth, rather than the land pets' front paws.
        const mouth = kind === 'frog' ? [28, 49] : growthStage === 'baby' ? [14, 44] : growthStage === 'young' ? [11, 39] : [6.1, 30.8];
        const x = 50 + (mouth[0] / 64 * 100 - 50) * .72;
        const y = 53 + (mouth[1] / 64 * 100 - 50) * .72;
        return `<g class="tf-hm-food is-aquatic" style="--tf-hm-mouth-x:${x}px;--tf-hm-mouth-y:${y}px">${item(food, -8, -8, 16)}</g>`
            + `<g class="tf-hm-aquatic-bubbles"><circle cx="${x - 3}" cy="${y - 8}" r="1.3" fill="none" stroke="#c3e2dd" stroke-width="1"/><circle cx="${x + 4}" cy="${y - 13}" r="1" fill="#c3e2dd"/></g>`
            + group('heart', path('M34 42H38V45H40V42H44V48H42V50H40V52H38V50H36V48H34Z', '#d79894'));
    }
    return group('food', item(food, 55, 58, 27)) + group('crumbs', rect(53, 57, 2, 2, '#deb87d') + rect(61, 60, 3, 2, '#edcc94') + rect(50, 65, 2, 2, '#d7ab79')) + group('heart', path('M34 42H38V45H40V42H44V48H42V50H40V52H38V50H36V48H34Z', '#d79894'));
}

/** Decorative art only: interaction and persistence belong to the motion controller. */
export function renderHomesteadMotion(action, { itemId = '', atStove = false, kind = '', growthStage = 'adult', aquatic = kind === 'goldfish' || (kind === 'frog' && growthStage === 'baby'), workPoint = { x: 160, y: 170 } } = {}) {
    if (!actions.has(action)) return '';
    if ((action === 'cook' && atStove) || action === 'fish') return renderWorkPoseArt(action, itemId);
    const art = action === 'plant' ? planting(itemId) : action === 'water' ? watering()
        : action === 'harvest' || action === 'gather' ? picking(itemId, action === 'harvest')
        : action === 'pack' ? packing(itemId) : action === 'cook' ? cooking(itemId) : feeding(itemId, { kind, growthStage, aquatic });
    const isFeeding = action === 'feed';
    const x = Math.max(48, Math.min(292, Number(workPoint?.x) || 160));
    const y = Math.max(48, Math.min(226, Number(workPoint?.y) || 170));
    // The player works at the selected plot/table. Only food offered to the pet
    // follows its body; tools never travel on a fish tank or sprout from a paw.
    const position = isFeeding ? '' : ` data-player-task="${action}" data-homestead-motion="${action}" style="left:${x / 3.2}%;top:${y / 2.4}%"`;
    return `<span class="tf-homestead-motion-art${isFeeding ? '' : ' tf-player-task'}"${isFeeding && aquatic ? ' data-aquatic-action="true"' : ''}${position} aria-hidden="true"><svg viewBox="0 0 100 100" shape-rendering="crispEdges" focusable="false" xmlns="http://www.w3.org/2000/svg">${isFeeding ? art : contactShadow + art}</svg></span>`;
}

export function renderFishingRod() {
    return renderWorkPoseArt('fishing');
}
