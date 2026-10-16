import { HOMESTEAD_LOCATIONS, CROPS, PET_ITEMS, RESOURCE_NODES, getCropView, getPetItemCount } from './companion-homestead.js';
import { getRoomItemBounds } from './companion-room.js';
import { renderDetailedHomesteadBackdrop } from './companion-homestead-scenery.js';
import { renderKitchenPanel, renderFishingPanel, renderKitchenFishingItemIcon } from './companion-kitchen-fishing-ui.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rect = (x, y, w, h, color, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" ${extra}/>`;
const path = (d, color, extra = '') => `<path d="${d}" fill="${color}" ${extra}/>`;
const group = (html, x, y, extra = '') => `<g transform="translate(${x} ${y})" ${extra}>${html}</g>`;
const svg = (html, cls = '', width = 320, height = 240) => `<svg class="${cls}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${html}</svg>`;
const plotPosition = index => ({ x: [65, 160, 255][index % 3], y: index < 3 ? 119 : 195, approachY: index < 3 ? 144 : 220 });
const locationOf = companion => HOMESTEAD_LOCATIONS.find(item => item.id === companion?.homestead?.location) || HOMESTEAD_LOCATIONS[0];
const minuteLabel = ms => ms <= 0 ? '快好了' : ms < 60000 ? '不到 1 分钟' : `约 ${Math.ceil(ms / 60000)} 分钟`;
const action = (id, label, attrs = '', disabled = false) => `<button type="button" data-action="homestead-action" data-homestead-action="${id}" ${attrs}${disabled ? ' disabled' : ''}>${label}</button>`;
const target = (id, label, x, y, extra = '') => `<button type="button" data-action="homestead-target" data-target="${esc(id)}" data-x="${x}" data-y="${y}" ${extra}>${label}</button>`;

function cropArt(id, stage = 'ready') {
    if (stage === 'empty') return rect(-10, 0, 20, 2, '#bd9b77') + rect(-7, -2, 14, 2, '#caa785');
    if (stage === 'dry') return [-13, 0, 13].map(x => rect(x, -3, 3, 3, '#e0bf8d')).join('');
    const leaves = path('M-2 -3H2V-15H-2ZM-2 -11H-8V-18H-3V-15H-2ZM2 -10H8V-18H3V-14H2Z', '#83a276') + rect(-6, -18, 3, 2, '#b5c78d');
    if (stage === 'sprout') return leaves;
    const matureLeaves = leaves + path('M-2 -10H-13V-17H-8V-21H-2ZM2 -9H13V-16H9V-22H3Z', '#789767') + rect(-11, -17, 6, 3, '#a2bc7b') + rect(5, -21, 4, 3, '#a2bc7b');
    if (stage === 'growing') return matureLeaves;
    if (id === 'strawberry') return matureLeaves + path('M-13 -13H-5V-10H-2V-4H-5V0H-10V-3H-13ZM5 -10H13V-7H16V-1H13V3H8V0H5Z', '#cb7e76') + rect(-10, -10, 2, 2, '#f2cf9e') + rect(-6, -6, 2, 2, '#f2cf9e') + rect(9, -6, 2, 2, '#f2cf9e');
    if (id === 'turnip') return matureLeaves + path('M-8 -9H8V-4H11V3H7V7H2V11H-1V7H-7V3H-10V-4H-8Z', '#f0dcb8') + rect(-8, -8, 16, 4, '#c09cae') + rect(-6, -3, 4, 6, '#fae9c9');
    return matureLeaves + path('M-8 -7H8V-2H5V5H2V10H-1V13H-3V6H-5V1H-8Z', '#d99966') + rect(-6, -5, 5, 6, '#efb780') + rect(1, 1, 4, 2, '#be8056');
}

export function renderHomesteadItemIcon(id) {
    const kitchenIcon = renderKitchenFishingItemIcon(id);
    if (kitchenIcon) return kitchenIcon;
    let art;
    if (id.endsWith('-seed')) art = rect(5, 4, 22, 25, '#b69c73') + rect(6, 5, 20, 23, '#efdfb8') + rect(7, 5, 18, 4, '#9caf82') + rect(7, 25, 18, 3, '#d2b58a') + `<g transform="translate(16 21) scale(.48)">${cropArt(id.replace('-seed', ''), 'ready')}</g>` + rect(8, 11, 3, 1, '#fff2d4');
    else if (['carrot', 'turnip', 'strawberry'].includes(id)) art = group(cropArt(id), 16, 22);
    else if (id === 'bento') art = rect(4, 11, 24, 16, '#b89271') + rect(5, 8, 22, 4, '#d0af89') + rect(7, 12, 18, 11, '#f0dfbd') + rect(8, 14, 8, 7, '#faf0d4') + rect(19, 14, 5, 7, '#9bb77e') + rect(14, 8, 4, 19, '#c99088');
    else if (id === 'berry') art = path('M8 11H23V14H26V24H23V27H8V24H5V14H8Z', '#b77d86') + rect(8, 14, 5, 5, '#d8a1a4') + path('M15 12V5H18V12ZM16 7H8V3H13V5H16ZM18 8H25V4H20V6H18Z', '#91a676');
    else if (id === 'mushroom') art = rect(13, 15, 7, 13, '#e7d3af') + path('M5 16V10H9V6H23V10H27V16Z', '#c68e78') + rect(10, 9, 4, 3, '#f0d5b0') + rect(20, 12, 4, 3, '#f0d5b0');
    else if (id === 'branch') art = path('M7 25L22 6L26 9L11 28ZM14 18L9 9L12 7L18 15Z', '#b2916b') + path('M9 24L22 8L24 9L11 25Z', '#d2b488');
    else if (id === 'reed') art = path('M10 28V9H12V28ZM17 28V5H19V28ZM24 28V13H26V28Z', '#8da073') + rect(8, 5, 6, 9, '#beaa7f') + rect(15, 2, 6, 8, '#b49b72') + rect(22, 8, 6, 9, '#ccb790');
    else if (id === 'stone') art = path('M6 24V15H10V10H22V13H27V24Z', '#a5afa0') + path('M7 15H12V11H21V14H12V18H7Z', '#c7cdba');
    else if (id === 'watering-can') art = rect(7, 14, 16, 13, '#99b7ad') + rect(8, 11, 12, 4, '#c7d1b9') + path('M23 17L30 11V17L23 23ZM7 15H2V8H12V11H5V13H7Z', '#9daf96');
    else art = rect(14, 3, 4, 17, '#b49a74') + path('M9 19H23V26H20V30H12V26H9Z', '#a6b3a7') + rect(12, 20, 3, 6, '#ced2bb');
    return svg(art, 'tf-homestead-item-icon', 32, 32);
}
const itemIcon = renderHomesteadItemIcon;

const grass = (x, y) => group(path('M0 7H3V0H5V7H8V3H10V10H0Z', '#9daf84') + rect(4, 0, 1, 3, '#c4cf9b'), x, y);
const flower = (x, y, color = '#d7a396') => group(rect(4, 7, 2, 8, '#98ab7c') + path('M2 0H7V3H10V8H7V10H2V8H0V3H2Z', color) + rect(3, 4, 3, 3, '#f2dcab'), x, y);
const tree = (x, y, size = 1) => group(
    path('M9 64H43V67H48V70H39V73H10V70H4V67H9Z', '#748b65', 'opacity=".2"') +
    path('M24 27H34V60H38V65H21V61H24Z', '#897452') + rect(25, 31, 3, 31, '#c2a17a') + rect(29, 47, 2, 12, '#735f49') + path('M26 48L17 39L19 36L28 44ZM31 42L38 34L40 37L33 46Z', '#a88a65') + rect(22, 62, 13, 2, '#b59a70') +
    path('M14 0H41V5H49V12H55V22H58V34H51V41H40V45H16V42H7V36H0V20H5V9H14Z', '#6e8965') +
    path('M14 2H39V7H48V14H53V24H55V32H48V38H39V41H17V38H9V32H3V21H8V11H14Z', '#8da773') +
    path('M15 3H36V7H43V13H32V17H19V14H12V23H5V19H9V10H15Z', '#b9cb8d') + path('M15 3H29V6H21V9H13V12H10V9H15Z', '#d0dcaa') +
    path('M33 18H47V22H53V31H46V35H34V31H25V25H33Z', '#799866') + path('M34 18H45V21H49V24H39V27H31V23H34Z', '#a4bb7d') +
    path('M8 25H20V21H27V28H31V32H24V36H12V32H7Z', '#9bb77c') + path('M15 28H24V31H18V34H11V31H15Z', '#bdd198') +
    rect(18, 10, 6, 2, '#d3dfaa') + rect(8, 20, 4, 2, '#c9dba0') + rect(39, 10, 5, 2, '#c0d092') + rect(36, 29, 5, 2, '#b1c386') + rect(21, 38, 9, 2, '#5f805c') + rect(44, 34, 3, 2, '#64855e'), x, y).replace(`translate(${x} ${y})`, `translate(${x} ${y}) scale(${size})`);
const sign = (x, y, left = false) => group(rect(-5, 23, 14, 2, '#82996e', 'opacity=".25"') + rect(-2, 0, 4, 24, '#ad8c65') + rect(-2, 5, 1, 17, '#ddbf91') + path(left ? 'M-22 -9H17V7H-22L-30 -1Z' : 'M-17 -9H22L30 -1L22 7H-17Z', '#a98d66') + path(left ? 'M-22 -9H17V4H-22L-29 -2Z' : 'M-17 -9H22L29 -2L22 4H-17Z', '#dac297') + rect(left ? -20 : -15, -8, 30, 1, '#efdbb1') + path(left ? 'M-20 -2L-14 -6V-3H8V0H-14V3Z' : 'M20 -2L14 -6V-3H-8V0H14V3Z', '#7c9269') + rect(left ? 12 : -13, -3, 1, 1, '#896e50'), x, y);

// Fixed, sparse marks add texture without making the small screen noisy.
const groundDetails = points => points.map(([x, y], i) => group(rect(0, 0, 2, 1, '#789663', 'opacity=".45"') + rect(4, 2, 3, 1, '#e4e2b6', 'opacity=".7"') + (i % 3 === 0 ? grass(8, -4) : ''), x, y)).join('');
const pebble = (x, y) => group(path('M0 3H2V0H8V2H10V6H0Z', '#a1ab91') + rect(2, 1, 5, 2, '#d8d9b9') + rect(1, 6, 9, 1, '#879a7c', 'opacity=".35"'), x, y);
const leafLitter = (x, y, color = '#c2b37d') => group(path('M0 2H3V0H7V2H5V4H1V3H0Z', color) + rect(5, 3, 3, 1, '#9d9c6d'), x, y);
const shrub = (x, y) => group(path('M0 15V8H6V3H15V0H26V4H32V10H36V19H4V17Z', '#91aa79') + path('M3 9H8V5H16V3H24V6H17V10H9V14H3Z', '#b5c991') + path('M13 15H25V11H33V17H27V20H10V18H13Z', '#7c986b') + rect(10, 7, 3, 2, '#d0dbaa'), x, y);

// The raised front edge and inset soil share one footprint with the click target.
function gardenBed(wet) {
    return path('M-27 19H32V23H-25V21H-27Z', '#758962', 'opacity=".24"') +
        path('M-30 -18H30V19H-30Z', '#92734f') + rect(-28, -16, 56, 31, wet ? '#967956' : '#b28d62') +
        rect(-29, -18, 59, 3, '#ddbb87') + rect(-29, -15, 3, 30, '#c3a173') + rect(27, -15, 3, 31, '#a08259') +
        rect(-26, -15, 53, 2, wet ? '#755e47' : '#94714f') + rect(-26, -13, 2, 26, wet ? '#846c4d' : '#a68056') +
        [-8, 1, 10].map(py => path(`M-22 ${py}H-8V${py - 1}H7V${py}H23V${py + 1}H6V${py}H-8V${py + 1}H-22Z`, wet ? '#776048' : '#94734f') + rect(-20, py + 2, 17, 1, wet ? '#b09266' : '#c8a676') + rect(8, py + 2, 13, 1, wet ? '#a88c62' : '#c19b6b')).join('') +
        [[-20,-11],[-8,-5],[18,-10],[8,6],[-17,7],[22,11],[0,12]].map(([px,py],i)=>rect(px,py,i%2?2:1,1,wet?'#c0a37c':'#dfbd88')).join('') +
        rect(-30, 14, 60, 5, '#b39365') + rect(-28, 14, 56, 1, '#e0bf8a') + rect(-25, 17, 20, 1, '#9d7e54') + rect(8, 16, 16, 1, '#c6a573') +
        [[-28,-17],[28,-17],[-28,16],[28,16]].map(([px,py])=>rect(px,py,1,1,'#755e45')).join('');
}

function yardBackdrop() {
    return rect(0, 0, 320, 240, '#c4d0a4') + rect(0, 0, 320, 70, '#dce3c9') + path('M0 48H37V39H73V52H119V59H162V45H199V39H247V53H289V41H320V80H0Z', '#b7c9a0') +
        path('M43 53H54V48H73V52H88V58H102V75H41Z', '#a7be90') + shrub(237, 50) +
        tree(-25, -22, 1.35) + tree(278, -27, 1.25) + rect(0, 77, 320, 6, '#829c70', 'opacity=".16"') +
        rect(0, 61, 320, 3, '#b19a70') + rect(0, 62, 320, 1, '#f1dfb4') + rect(0, 71, 320, 3, '#b49b70') +
        Array.from({ length: 16 }, (_, i) => group(path('M0 3H3V0H6V3H9V26H0Z', '#dfcaa0') + rect(0, 4, 2, 22, '#f1dfb7') + rect(7, 4, 2, 22, '#bda67a') + rect(4, 12, 1, 1, '#a78c66') + rect(4, 22, 1, 1, '#a78c66'), i * 22, 51)).join('') +
        path('M0 148H320V164H0ZM112 78H126V240H112ZM207 78H221V240H207Z', '#ded0a9') + rect(0, 163, 320, 2, '#bdb993') +
        path('M137 70H185V73H137Z', '#83996b', 'opacity=".35"') + rect(138, 44, 44, 26, '#b8946b') + rect(139, 46, 40, 23, '#d1b78b') +
        path('M132 45H188V50H132ZM148 31H172V36H178V42H184V46H136V42H142V36H148Z', '#9c8065') +
        path('M148 31H172V34H148ZM143 36H177V39H143ZM138 42H182V45H138Z', '#c1a481') + rect(132, 45, 56, 2, '#ddbe92') +
        rect(152, 49, 17, 21, '#9d825f') + rect(154, 51, 13, 18, '#e9d5aa') + rect(155, 52, 10, 5, '#adc6ad') + rect(159, 52, 1, 5, '#e9ddb9') + rect(155, 60, 10, 1, '#c6b083') + rect(164, 59, 2, 3, '#a88a58') +
        rect(141, 52, 7, 8, '#9f9f79') + rect(142, 53, 5, 5, '#d9ddbc') + rect(140, 60, 9, 2, '#b3966b') + rect(176, 54, 2, 12, '#bca174') + rect(151, 69, 20, 3, '#e7d4a9') +
        sign(17, 145, true) + sign(303, 145) +
        [flower(24, 78), flower(290, 78, '#e2c58d'), grass(6, 215), grass(299, 217), flower(154, 226, '#ded3a5')].join('') +
        rect(0, 78, 320, 2, '#809b70', 'opacity=".14"') +
        groundDetails([[34,91],[85,85],[191,83],[260,85],[13,188],[99,178],[196,174],[290,192],[38,229],[210,231]]) +
        [[116, 91],[211,112],[118,179],[212,219],[92,153],[196,153],[268,153]].map(([x,y]) => rect(x,y,5,1,'#bcae89') + rect(x+3,y+3,4,1,'#eee1bd')).join('') +
        group(rect(0,22,20,2,'#8da276','opacity=".3"') + rect(0,4,16,19,'#ae936d') + rect(1,5,14,16,'#ccb08a') + rect(3,5,1,16,'#e3c697') + rect(10,5,1,16,'#ac9069') + rect(0,8,16,2,'#8e957c') + rect(0,18,16,2,'#8e957c') + rect(3,2,10,4,'#89afa1') + rect(4,3,8,1,'#dce6c5') + rect(19,1,2,21,'#b29163') + path('M17 0H24V2H22V5H21V2H19V5H18V2H17Z','#879c83'), 202, 52) +
        group(path('M0 2H12V12H10V15H2V12H0Z','#b8916f') + rect(0,1,12,3,'#d5ad80') + rect(2,0,8,2,'#847451') + rect(5,-5,2,7,'#8aa477') + path('M5 -2H1V-5H5ZM7 -4H11V-8H7Z','#9bb780'),84,66) +
        flower(103,72,'#d9a59c') + flower(261,70,'#edcd8d') + leafLitter(7, 194) + leafLitter(288, 234, '#dbca91');
}

function forestBackdrop() {
    return rect(0, 0, 320, 240, '#bccfa3') + rect(0, 0, 320, 84, '#c7d8b6') +
        path('M0 43H33V33H73V43H102V36H124V49H197V36H235V40H267V34H320V93H0Z','#a8bf93') +
        [shrub(2,67), shrub(44,59), shrub(100,52), shrub(188,52), shrub(262,68)].join('') +
        [tree(-13, 0, 1.2), tree(44, -23, 1.05), tree(118, -36, 1.2), tree(207, -28, 1.15), tree(267, -2, 1.3)].join('') +
        path('M0 82H25V87H65V93H84V102H55V98H11V94H0ZM265 80H320V103H303V109H277V102H260Z','#829e73','opacity=".15"') +
        path('M121 66H188V94H200V126H191V158H205V190H193V221H216V240H128V223H111V192H122V164H110V126H121Z', '#daceaa') +
        path('M144 81H166V101H178V126H164V151H177V169H165V191H177V213H163V233H180V240H146V221H137V197H147V165H137V127H147V104H144Z', '#e5d8b5') +
        path('M123 92H130V96H120V110H115V99H123ZM190 144H196V158H205V161H190ZM116 199H123V211H114Z','#b6b990') +
        rect(220, 88, 41, 4, '#81996c','opacity=".28"') + rect(221, 52, 3, 32, '#a38a62') + rect(256, 52, 3, 32, '#a38a62') + rect(219, 51, 42, 5, '#c0a174') + rect(220, 51, 40, 1, '#e1c18f') +
        rect(217, 64, 46, 6, '#ab8f66') + rect(224, 69, 5, 21, '#a08760') + rect(251, 69, 5, 21, '#a08760') + rect(216, 60, 48, 5, '#d0b58c') + rect(218, 60, 44, 1, '#ecd4a7') + rect(218, 63, 44, 1, '#b99a70') + rect(227, 71, 27, 2, '#b69b72') +
        sign(16, 216, true) + sign(305, 216) +
        [grass(16, 95), grass(93, 123), grass(218, 120), grass(286, 96), grass(48, 207), grass(270, 215), flower(21, 188), flower(279, 189, '#e7cb9a')].join('') +
        [[92, 85], [213, 160], [88, 210], [237, 229]].map(([x, y]) => rect(x, y, 7, 2, '#b7b588') + rect(x + 4, y - 2, 5, 2, '#d0b58b')).join('') +
        groundDetails([[31,112],[65,92],[89,186],[11,236],[223,96],[288,136],[248,227],[206,186],[84,232]]) +
        pebble(117,112) + pebble(189,184) + pebble(145,232) +
        group(path('M0 0H17V11H13V15H4V11H0Z','#a28662') + rect(1,0,15,4,'#d3b58a') + rect(4,1,9,1,'#9e815c') + rect(3,6,2,7,'#bd9c70'),77,88) +
        path('M82 71H102V85H114V110H94V97H82Z','#f4e9b8','opacity=".22"') + path('M249 80H265V103H274V119H253Z','#f4e9b8','opacity=".22"') +
        path('M149 77H159V88H171V98H162V91H149Z','#f7edc4','opacity=".28"') +
        [[103,113],[198,137],[118,173],[201,207],[135,222],[73,211]].map(([x,y],i)=>leafLitter(x,y,i%2?'#b8af77':'#ceb884')).join('') +
        [[135,106],[177,142],[149,188],[166,215]].map(([x,y])=>rect(x,y,4,1,'#bdb58c')+rect(x+7,y+4,2,1,'#f1e3b9')).join('');
}

function riverBackdrop() {
    return rect(0, 0, 320, 240, '#c8d3ae') + rect(0, 0, 320, 93, '#cddbc1') +
        path('M0 34H28V28H71V35H120V27H165V34H210V24H257V37H288V30H320V89H0Z', '#adc3a4') +
        path('M0 56H33V49H64V58H110V47H139V55H177V50H218V57H256V50H287V59H320V84H0Z','#9fb899') +
        path('M0 67H38V74H80V66H120V75H166V66H210V76H257V67H290V75H320V140H290V133H247V143H195V133H148V142H101V131H60V140H0Z', '#95bdb2') +
        path('M0 76H36V83H82V76H118V85H165V76H211V85H259V77H288V85H320V98H284V91H252V97H207V90H163V96H119V91H79V96H36V90H0Z','#7da9a1','opacity=".46"') +
        path('M0 122H61V117H102V127H149V119H195V128H246V118H293V125H320V143H0Z','#abcabc') +
        path('M0 134H59V126H101V136H148V129H194V137H246V127H291V134H320V138H290V132H247V141H194V140H147V139H102V139H60V136H0Z','#d0ddc6') +
        path('M0 136H60V127H104V138H148V129H194V138H246V129H291V135H320V147H289V144H248V151H193V145H146V151H99V144H59V149H0Z', '#e3d5b1') +
        path('M0 144H59V137H99V145H146V143H193V146H248V143H289V139H320V147H289V144H248V151H193V148H146V151H99V147H59V149H0Z','#b7b68e') +
        `<g class="tf-scene-pond-ripple">${[[15, 90, 43], [99, 112, 61], [227, 98, 51], [275, 124, 27], [52, 119, 23]].map(([x, y, w]) => rect(x, y, w, 2, '#cbe0ce')).join('')}</g>` +
        rect(0, 216, 320, 24, '#d9ccaa') + path('M142 126H168V216H142Z', '#d9ccaa') +
        path('M20 107H86V111H91V120H25V116H20Z','#659990','opacity=".3"') +
        rect(15, 69, 73, 5, '#947a59') + Array.from({ length: 6 }, (_, i) => group(rect(0,0,10,36,'#b89b71') + rect(0,0,9,33,'#d1b98e') + rect(1,1,7,2,'#eddbb0') + rect(2,8+i%3,1,16,'#b79a6e') + rect(5,14,1,11,'#dfc99c') + rect(2,4,1,1,'#987d56') + rect(2,30,1,1,'#987d56'),17+i*12,75)).join('') +
        [20,78].map(x=>rect(x,62,5,56,'#a08760') + rect(x,62,3,52,'#c5aa7d') + rect(x-1,61,7,3,'#e0c797') + rect(x,108,5,2,'#7c9c86')).join('') +
        tree(270, -10, 1.1) + sign(17, 218, true) + [grass(6, 174), grass(290, 190), flower(268, 208, '#dcca93'), flower(46, 199)].join('') +
        groundDetails([[20,158],[105,171],[216,182],[82,216],[276,224],[197,226]]) + pebble(91,147) + pebble(109,151) + pebble(206,148) + pebble(282,152) +
        group(path('M0 5H4V1H15V4H20V10H0Z','#8fa99a') + path('M1 5H5V2H14V4H8V6H1Z','#c5d0b8') + rect(-3,10,26,1,'#d2e2ce'),111,122) +
        group(path('M0 5H4V0H14V3H19V8H0Z','#a3b1a0') + rect(5,1,8,2,'#dce0c4') + rect(-4,8,27,1,'#dce7ca'),224,130) +
        [[12,120],[93,87],[202,114],[256,81],[288,97],[147,128]].map(([x,y])=>rect(x,y,17,1,'#d7e8ce')+rect(x+6,y+3,8,1,'#b8d5c2')).join('') +
        path('M189 91H203V94H207V100H195V97H189Z','#aec69b') + rect(193,90,8,2,'#ced8ac') +
        path('M184 105H203V106H184ZM207 98H218V99H207Z','#d7e5c9') +
        path('M245 120H251V123H254V125H246V123H241V121H245Z','#6faaa5','opacity=".65"') +
        [[6,72],[285,67],[309,75]].map(([x,y])=>grass(x,y)).join('') +
        group(path('M0 20V2H2V20ZM6 22V-4H8V22ZM12 20V4H14V20Z','#829b70') + rect(-1,-2,4,8,'#b39e6f') + rect(5,-9,4,9,'#c0aa78') + path('M1 15L-5 7L-3 7L2 12ZM8 14L15 5L17 5L8 18Z','#9bb17d'),302,117) +
        [[17,140],[64,136],[178,140],[259,138]].map(([x,y])=>rect(x,y,3,1,'#b8b189')+rect(x+7,y+2,2,1,'#f0e3bc')).join('') +
        leafLitter(109,204) + leafLitter(230,224,'#c8bb86');
}

function resourceArt(node, ready) {
    const x = Number(node.x) || 160, y = Number(node.y) || 180;
    let art = path('M-25 0H25V5H-25Z', '#91a27f', 'opacity=".22"');
    if (node.itemId === 'berry') art += path('M-21 -5V-24H-15V-31H13V-25H21V-5Z', '#8da379') + path('M-14 -27H10V-23H-13V-13H-19V-22H-14Z', '#b4c48d') + (ready ? [[-13, -18], [1, -24], [10, -13], [-2, -8]].map(([bx, by]) => rect(bx, by, 6, 5, '#bd858a') + rect(bx, by, 2, 2, '#e1aca6')).join('') : '');
    else if (node.itemId === 'branch') art += ready ? path('M-23 -6L15 -19L18 -13L-20 0ZM1 -13L0 -26L5 -26L7 -14Z', '#b1936d') + path('M-19 -6L14 -17L15 -15L-18 -4Z', '#d2b58b') : rect(-11, -3, 22, 2, '#bcb995');
    else if (node.itemId === 'mushroom') art += ready ? group(rect(7, -17, 6, 17, '#e6d5af') + path('M0 -17V-25H5V-29H18V-25H23V-17Z', '#c28c77') + rect(5, -24, 4, 3, '#ebd4ae'), -13, -2) + group(rect(4, -9, 4, 10, '#e6d5af') + path('M-1 -9V-15H3V-18H10V-15H14V-9Z', '#d3a07f'), 7, 0) : rect(-12, -3, 4, 4, '#d6c4a0') + rect(7, -2, 3, 3, '#d6c4a0');
    else if (node.itemId === 'reed') art += [-15, -5, 6, 16].map((rx, i) => rect(rx, ready ? -32 - i % 2 * 9 : -11, 3, ready ? 32 + i % 2 * 9 : 11, '#8da579') + (ready ? rect(rx - 2, -37 - i % 2 * 9, 7, 12, '#b59e73') : '')).join('');
    else art += ready ? path('M-22 -2V-11H-18V-16H-4V-11H1V-2ZM5 0V-7H9V-11H19V-7H23V0Z', '#a9b3a1') + rect(-17, -15, 10, 3, '#ced4bd') + rect(10, -10, 7, 2, '#d1d8c2') : rect(-14, -2, 8, 2, '#b9c2a4') + rect(9, 0, 5, 2, '#b9c2a4');
    return group(art, x, y);
}

/** The art and target coordinates share the room's 320 × 240 canvas. */
export function renderHomesteadScene(companion, now = Date.now()) {
    const location = locationOf(companion);
    if (location.id === 'home') return { html: '', habitat: location.habitat };
    let art = renderDetailedHomesteadBackdrop(location.id) || (location.id === 'yard' ? yardBackdrop() : location.id === 'forest' ? forestBackdrop() : riverBackdrop());
    let controls = '';
    if (location.id === 'yard') {
        for (let index = 0; index < 6; index++) {
            const plotId = `plot-${index + 1}`, plot = companion?.homestead?.plots?.find(item => item.id === plotId) || { id: plotId };
            const view = getCropView(plot, now), { x, y, approachY } = plotPosition(index);
            const wet = ['sprout', 'growing', 'ready'].includes(view.stage), label = view.stage === 'empty' ? '播种' : view.stage === 'dry' ? '浇水' : view.stage === 'ready' ? '收获' : '生长中';
            const plants = view.stage === 'empty' ? cropArt('', 'empty') : `<g transform="translate(-14 3) scale(.66)">${cropArt(view.cropId, view.stage)}</g><g transform="translate(13 7) scale(.72)">${cropArt(view.cropId, view.stage)}</g><g transform="translate(0 -6) scale(.65)">${cropArt(view.cropId, view.stage)}</g>`;
            art += group(gardenBed(wet) + plants, x, y);
            controls += target(`plot:${plotId}`, `<span>${label}</span>`, Math.max(28, x - 38), approachY, `class="tf-homestead-target is-plot is-${view.stage}" data-plot-id="${plotId}" data-work-x="${x + 27}" data-work-y="${y + 8}" aria-label="第 ${index + 1} 块地，${esc(view.crop?.name || '空地')}，${label}" style="left:${x / 3.2}%;top:${y / 2.4}%"`);
        }
    } else if (location.id === 'kitchen') {
        controls += target('stove', '<span>做点好吃的</span>', 195, 153, 'class="tf-homestead-target is-kitchen-stove" aria-label="灶台，选择菜谱做菜" style="left:67.2%;top:45.8%"');
        controls += target('storage', '<span>食材柜</span>', 75, 157, 'class="tf-homestead-target is-kitchen-pantry" aria-label="看看食材柜" style="left:19.4%;top:44%"');
    } else {
        for (const node of RESOURCE_NODES.filter(item => item.location === location.id)) {
            const readyAt = Number(companion?.homestead?.nodes?.[node.id]) || 0, ready = readyAt <= now;
            art += resourceArt(node, ready);
            controls += target(`node:${node.id}`, `<span>${ready ? esc(node.name) : '再等等'}</span>`, Math.max(28, node.x - 38), node.y, `class="tf-homestead-target is-resource ${ready ? 'is-ready' : 'is-restoring'}" data-node-id="${esc(node.id)}" data-work-x="${Math.min(286, node.x + 12)}" data-work-y="${node.y + 2}" aria-label="${esc(node.name)}${ready ? '，可以采集' : `，${minuteLabel(readyAt - now)}后恢复`}" style="left:${Number(node.x) / 3.2}%;top:${(Number(node.y) - 12) / 2.4}%"`);
        }
        if (location.id === 'river') controls += target('fishing', '<span>钓鱼</span>', 220, 155, 'class="tf-homestead-target is-fishing-spot" aria-label="到水边钓鱼" style="left:72%;top:47%"');
    }
    return { html: `<div class="tf-homestead-world">${svg(art, `tf-scene-art tf-homestead-scene is-${location.id}`).replace('<svg ', `<svg data-indoor="${location.id === 'kitchen'}" `)}<div class="tf-homestead-targets">${controls}</div></div>`, habitat: location.habitat };
}

const stationArt = {
    kitchen: path('M15 7L20 2L25 7', 'none', 'stroke="#ad9270" stroke-width="1.5"') + rect(2, 8, 36, 18, '#a58965') + rect(3, 8, 34, 16, '#e1c79c') + rect(4, 9, 32, 1, '#f5e1bc') + rect(5, 22, 29, 1, '#c7a77a') + path('M8 15H23V18H21V21H11V18H8Z', '#87a293') + rect(9, 14, 13, 2, '#b7c7a8') + rect(11, 16, 9, 1, '#dfe1bc') + path('M13 12V10H14V9M18 12V10H19V9', 'none', 'stroke="#b49b77" stroke-width="1"') + path('M26 14H30V12L34 17L30 21V19H26Z', '#8a8f6e') + rect(5, 12, 1, 1, '#9e825d') + rect(34, 12, 1, 1, '#9e825d'),
    door: rect(3, 2, 42, 80, '#a78965') + rect(4, 3, 40, 78, '#e1c8a1') + rect(7, 6, 34, 74, '#8e785b') + rect(8, 7, 32, 72, '#caaa7c') + rect(9, 8, 2, 69, '#e6c99e') + rect(37, 8, 2, 70, '#b08f65') + rect(12, 12, 24, 26, '#8ba38e') + rect(13, 13, 22, 23, '#c7d5b7') + path('M13 29H18V25H24V28H29V24H35V36H13Z', '#a5bd9c') + rect(23, 12, 2, 26, '#ead8b5') + rect(12, 24, 24, 2, '#ead8b5') + rect(12, 45, 24, 27, '#b39268') + rect(13, 46, 22, 25, '#d9bc90') + rect(14, 47, 1, 22, '#ead1a6') + rect(16, 66, 13, 1, '#c7a87c') + rect(33, 41, 3, 9, '#a38653') + rect(31, 44, 5, 2, '#ead18d') + rect(7, 19, 2, 5, '#8b8e73') + rect(7, 62, 2, 5, '#8b8e73') + rect(3, 80, 42, 2, '#ae9475') + rect(4, 80, 40, 1, '#ead4ac') + rect(5, 82, 38, 2, '#ad9c76', 'opacity=".24"'),
    packing: rect(5, 54, 49, 2, '#8e9a73', 'opacity=".18"') + rect(7, 30, 6, 24, '#a58561') + rect(8, 32, 2, 21, '#d7b68a') + rect(46, 30, 6, 24, '#987b59') + rect(47, 32, 2, 20, '#c5a177') + rect(12, 45, 35, 3, '#ab8c65') + rect(13, 45, 33, 1, '#d7b889') + path('M3 27H54V31H55V34H3Z', '#a98b65') + rect(3, 27, 52, 3, '#dfc396') + rect(5, 27, 48, 1, '#f0d9af') + rect(13, 31, 14, 1, '#c3a276') + rect(38, 31, 11, 1, '#c3a276') + rect(17, 9, 26, 18, '#8f9b74') + rect(18, 10, 24, 16, '#b7bb8f') + path('M23 9V5H37V9H34V7H26V9Z', '#9a926b') + rect(19, 12, 22, 6, '#d2cfaa') + rect(20, 13, 20, 1, '#e6dfba') + rect(28, 9, 5, 17, '#a79872') + rect(28, 17, 5, 5, '#e5cf93') + rect(29, 18, 3, 2, '#9c936e') + rect(20, 23, 5, 2, '#a5ae81') + rect(7, 22, 9, 5, '#e8d8b8') + rect(8, 23, 7, 1, '#b9bea0') + rect(45, 23, 5, 4, '#a8b19b') + rect(46, 23, 3, 1, '#e1dec0'),
    storage: rect(5, 62, 46, 2, '#8d8b6c', 'opacity=".18"') + rect(3, 5, 50, 53, '#a98760') + rect(3, 5, 50, 3, '#e0c49a') + rect(4, 5, 47, 1, '#f0d8b0') + rect(4, 8, 3, 49, '#c9a678') + rect(50, 8, 3, 49, '#92734f') + rect(8, 10, 41, 19, '#dcc29b') + rect(9, 11, 39, 1, '#f0d9b1') + rect(9, 27, 39, 2, '#b19167') + rect(8, 31, 41, 22, '#d4b78d') + rect(9, 32, 39, 1, '#ead0a5') + rect(9, 51, 39, 2, '#b19167') + rect(23, 18, 10, 3, '#8c8e6f') + rect(24, 18, 8, 1, '#d7c58c') + rect(23, 40, 10, 3, '#8c8e6f') + rect(24, 40, 8, 1, '#d7c58c') + rect(12, 24, 11, 1, '#ceb083') + rect(35, 35, 9, 1, '#c1a275') + rect(6, 58, 6, 5, '#a68b69') + rect(44, 58, 6, 5, '#a68b69') + rect(15, 1, 25, 4, '#a6b98d') + rect(15, 1, 25, 1, '#c4d0a0') + rect(18, 3, 19, 1, '#91a578'),
};

// Art, touch targets, player tools and the persistent bar share scene geometry.
// The painted bounds deliberately exclude transparent touch-target padding.
export function getHomeStationGeometry(companion) {
    const decorated = companion?.room?.enabled;
    const packingX = decorated ? 160 : 135, packingY = decorated ? 110 : 108;
    return [
        { id: 'door', label: '出门', barLabel: '出门', x: decorated ? 105 : 30, y: 72, width: 48, height: 84, painted: [3, 2, 42, 80], approach: { x: decorated ? 105 : 30, y: 132 } },
        { id: 'packing', label: '整理行囊', barLabel: '行囊', x: packingX, y: packingY, width: 58, height: 56, painted: [3, 5, 52, 49], approach: { x: packingX - 44, y: 139 }, work: { x: packingX, y: packingY - 1 } },
        { id: 'storage', label: '储物柜', barLabel: '收纳', x: 288, y: 86, width: 56, height: 64, painted: [3, 1, 50, 62], approach: { x: 240, y: 132 }, work: { x: 288, y: 61 } },
        { id: 'location:kitchen', label: '厨房', barLabel: '厨房', x: decorated ? 232 : 217, y: 48, width: 40, height: 28, painted: [2, 2, 36, 24], approach: { x: 224, y: 132 } },
    ];
}

const stationWorkAttrs = station => station?.work ? ` data-work-x="${station.work.x}" data-work-y="${station.work.y}"` : '';

export function renderHomeStations(companion) {
    const stations = getHomeStationGeometry(companion);
    const occupied = companion?.room?.enabled ? (companion.room.items || []).filter(item => item.type !== 'rug').map(getRoomItemBounds) : [];
    return `<div class="tf-homestead-stations">${stations.map(station => {
        const { id, label, x, y, width, height, painted, approach } = station;
        const left = x - width / 2 + painted[0], top = y - height / 2 + painted[1];
        const overlaps = occupied.some(box => box.x < left + painted[2] && box.x + box.width > left && box.y < top + painted[3] && box.y + box.height > top);
        if (overlaps) return '';
        const art = svg(stationArt[id === 'location:kitchen' ? 'kitchen' : id], '', width, height);
        return target(id, `${art}<span>${label}</span>`, approach.x, approach.y, `class="tf-homestead-station"${stationWorkAttrs(station)} aria-label="${label}" style="left:${x / 3.2}%;top:${y / 2.4}%;--tf-station-w:${width / 3.2}cqi;--tf-station-h:${height / 3.2}cqi"`);
    }).join('')}</div>`;
}

export function renderHomesteadBar(companion) {
    const location = locationOf(companion);
    const homeStations = getHomeStationGeometry(companion);
    const routes = { home: ['packing', 'storage', 'location:kitchen', 'door'].map(id => { const station = homeStations.find(item => item.id === id); return [id, station.barLabel, station.approach.x, station.approach.y, stationWorkAttrs(station)]; }), kitchen: [['location:home', '回小窝', 22, 196], ['storage', '食材', 75, 157], ['stove', '做菜', 195, 153]], yard: [['location:home', '小窝', 16, 155], ['location:forest', '林间', 304, 155]], forest: [['location:yard', '庭院', 16, 216], ['location:river', '河边', 304, 216]], river: [['fishing', '钓鱼', 220, 155], ['location:forest', '回林间', 16, 216]] };
    return `<nav class="tf-homestead-bar" aria-label="小世界地点与生活入口"><b>${esc(location.name)}</b><div>${routes[location.id].map(([id, label, x, y, attrs = '']) => target(id, `<span>${label}</span><i aria-hidden="true">${id.includes('location') || id === 'door' ? '›' : '·'}</i>`, x, y, attrs)).join('')}</div></nav>`;
}

function plotPanel(data, plotId, now) {
    const plot = data.world.companion.homestead?.plots?.find(item => item.id === plotId), view = getCropView(plot, now);
    const index = Math.max(1, Number(plotId.split('-')[1]) || 1), attrs = `data-plot-id="${esc(plotId)}"`;
    if (view.stage === 'empty') return { title: `第 ${index} 块小田`, html: '<p>选一包种子，埋进松软的泥土里。</p><div class="tf-homestead-seeds">' + CROPS.map(crop => {
        const count = getPetItemCount(data, crop.seedId);
        return action('plant', `${itemIcon(crop.seedId)}<span><b>${esc(crop.name)}</b><small>${Math.ceil(crop.durationMs / 60000)} 分钟成熟</small></span><em>×${count}</em>`, `${attrs} data-crop-id="${esc(crop.id)}"`, count < 1);
    }).join('') + '</div><p class="tf-homestead-note">种好后浇一次水，就会慢慢长大。种子可在储物柜用收获交换。</p>' };
    const crop = view.crop || CROPS.find(item => item.id === plot?.cropId);
    const message = view.stage === 'dry' ? '刚刚种下，等你浇一壶水。' : view.stage === 'ready' ? '已经成熟啦！可以收进储物柜。' : `${view.stage === 'sprout' ? '小芽探出了泥土' : '叶子正在慢慢长大'}，还要${minuteLabel(view.remainingMs)}。`;
    return { title: crop?.name || '我的小田', html: `<div class="tf-homestead-growing">${svg(group(cropArt(crop?.id, view.stage), 40, 42), '', 80, 64)}<p>${message}</p></div>${view.stage === 'dry' ? action('water', '浇水', attrs) : view.stage === 'ready' ? action('harvest', `收获 ${crop?.yield || 3} 份${esc(crop?.name || '作物')}`, attrs) : `<progress max="1" value="${Math.min(1, Math.max(0, Number(view.progress) || 0))}" aria-label="作物生长进度"></progress><p class="tf-homestead-note">关掉页面也会继续生长。成熟后会一直等你回来。</p>`}` };
}

function storagePanel(data) {
    const entries = Object.values(PET_ITEMS).filter(item => item.kind === 'seed' || getPetItemCount(data, item.id) > 0);
    const foods = Object.values(PET_ITEMS).filter(item => item.kind === 'food' && getPetItemCount(data, item.id) > 0);
    const ingredients = ['berry', ...CROPS.map(crop => crop.produceId)].reduce((sum, id) => sum + getPetItemCount(data, id), 0);
    return { title: '小小储物柜', html: `<p>采来的、种出的，都好好收在这里。</p><div class="tf-homestead-inventory">${entries.map(item => `<div>${itemIcon(item.id)}<span><b>${esc(item.name)}</b><small>${esc(item.kind === 'seed' ? '种子' : ['food', 'ingredient'].includes(item.kind) ? '食材' : item.kind === 'tool' ? '工具' : '材料')}</small></span><strong>×${getPetItemCount(data, item.id)}</strong></div>`).join('') || '<p>柜子暂时空空的，去林间走走吧。</p>'}</div><section class="tf-homestead-recipes"><h4>为下一趟出门准备</h4>${action('cook', `${itemIcon('bento')}<span><b>做一份便当</b><small>浆果或作物任意 2 份 → 便当 1 份</small></span>`, data.world.companion.homestead.location === 'kitchen' ? 'data-recipe-id="bento"' : '', ingredients < 2)}${foods.length ? '<h4>今天的收获</h4>' + foods.map(crop => `<div class="tf-homestead-produce"><b>${esc(crop.name)}</b><div>${action('feed', '喂一份', `data-item-id="${esc(crop.id)}"`)}${CROPS.some(entry => entry.id === crop.id) ? action('exchange', '1 份换 2 包种子', `data-crop-id="${esc(crop.id)}"`) : ''}</div></div>`).join('') : ''}</section>` };
}

/** Full-height screen sheet: its own scrolling keeps the device shell stable. */
export function renderHomesteadPanel(data, state, now = Date.now()) {
    const panel = String(state?.companionHomesteadPanel || '');
    if (!panel) return '';
    let content;
    if (panel.startsWith('plot:')) content = plotPanel(data, panel.slice(5), now);
    else if (panel === 'storage') content = storagePanel(data);
    else if (panel === 'kitchen') content = renderKitchenPanel(data);
    else if (panel === 'fishing') content = renderFishingPanel(data, now);
    else if (panel === 'packing' || panel === 'travel') return '';
    else return '';
    return `<section class="tf-homestead-panel" data-homestead-panel="${esc(panel)}" role="region" aria-label="${esc(content.title)}"><header><b>${esc(content.title)}</b>${action('close', '返回', 'aria-label="收起，回到小世界"')}</header><div class="tf-homestead-panel-content">${content.html}</div></section>`;
}
