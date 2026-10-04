// A room uses the same 320 × 240 coordinate system as the pet scene.
// Item positions are center anchors; the editor and the live room share this art.
export const ROOM_MAX_ITEMS = 24;

export const ROOM_FURNITURE = Object.freeze([
    { id: 'bed', name: '小床', category: 'furniture', width: 72, height: 46 },
    { id: 'sofa', name: '软沙发', category: 'furniture', width: 70, height: 40 },
    { id: 'table', name: '圆角茶几', category: 'furniture', width: 50, height: 40 },
    { id: 'chair', name: '木椅', category: 'furniture', width: 28, height: 34 },
    { id: 'bookshelf', name: '书柜', category: 'furniture', width: 44, height: 78 },
    { id: 'drawer', name: '抽屉柜', category: 'furniture', width: 44, height: 38 },
    { id: 'lamp', name: '落地灯', category: 'furniture', width: 26, height: 60 },
    { id: 'stool', name: '小圆凳', category: 'furniture', width: 28, height: 22 },
    { id: 'plant', name: '绿植', category: 'decor', width: 30, height: 42 },
    { id: 'flowers', name: '花盆', category: 'decor', width: 30, height: 32 },
    { id: 'rug', name: '织纹地毯', category: 'decor', width: 82, height: 28 },
    { id: 'cushion', name: '软垫', category: 'decor', width: 40, height: 26 },
    { id: 'food-bowl', name: '饭碗', category: 'decor', width: 30, height: 18 },
    { id: 'toy', name: '玩具球', category: 'decor', width: 26, height: 26 },
    { id: 'basket', name: '收纳篮', category: 'decor', width: 34, height: 30 },
    { id: 'aquarium', name: '小鱼缸', category: 'decor', width: 46, height: 34 },
    { id: 'window', name: '小窗', category: 'wall', width: 64, height: 54 },
    { id: 'picture', name: '风景画', category: 'wall', width: 38, height: 32 },
    { id: 'clock', name: '挂钟', category: 'wall', width: 28, height: 28 },
    { id: 'wall-shelf', name: '壁挂架', category: 'wall', width: 52, height: 34 },
].map(Object.freeze));

export const ROOM_WALLS = Object.freeze([
    { id: 'cream', name: '奶油白', color: '#ede4cf' },
    { id: 'sage', name: '鼠尾草', color: '#cdd9c3' },
    { id: 'rose', name: '樱花粉', color: '#ead3cf' },
    { id: 'blue', name: '雾蓝', color: '#cbdbe2' },
].map(Object.freeze));

export const ROOM_FLOORS = Object.freeze([
    { id: 'wood', name: '暖木地板', color: '#bd9970', line: '#a88964' },
    { id: 'lightwood', name: '浅木地板', color: '#d6c3a0', line: '#bdad8d' },
    { id: 'checker', name: '奶油格砖', color: '#e0d7bf', line: '#c4c6ab' },
    { id: 'stone', name: '灰石地砖', color: '#bcc6c2', line: '#a2afaa' },
].map(Object.freeze));

export const ROOM_COLORS = Object.freeze([
    { id: 'natural', name: '暖木奶油', color: '#ceb78e', wood: '#ae8156', dark: '#755c44', soft: '#dfd1ab', accent: '#bd815c' },
    { id: 'sage', name: '森林绿', color: '#a4bb98', wood: '#9c8760', dark: '#586752', soft: '#b8c8a5', accent: '#7d9c72' },
    { id: 'rose', name: '莓果粉', color: '#d3a5a2', wood: '#af8170', dark: '#805e61', soft: '#e8c7bf', accent: '#c08487' },
    { id: 'sky', name: '晴空蓝', color: '#a8c5d1', wood: '#929581', dark: '#596d79', soft: '#c4d8da', accent: '#789eb5' },
].map(Object.freeze));

const furnitureById = new Map(ROOM_FURNITURE.map(item => [item.id, item]));
const colorsById = new Map(ROOM_COLORS.map(item => [item.id, item]));
const safeId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const number = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const rotate = value => ((Math.round(number(value, 0)) % 4) + 4) % 4;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const chosenId = (values, value, fallback) => values.some(item => item.id === value) ? value : fallback;

export function getRoomItemBounds(item) {
    const definition = furnitureById.get(item?.type);
    if (!definition) return { x: 0, y: 0, width: 0, height: 0 };
    const odd = rotate(item.rotation) % 2;
    const width = odd ? definition.height : definition.width;
    const height = odd ? definition.width : definition.height;
    return { x: number(item.x, 160) - width / 2, y: number(item.y, 190) - height / 2, width, height };
}

export function normalizeCompanionRoom(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const seen = new Set();
    const items = [];
    for (const [index, candidate] of (Array.isArray(source.items) ? source.items : []).entries()) {
        if (items.length >= ROOM_MAX_ITEMS) break;
        if (!candidate || typeof candidate !== 'object') continue;
        const definition = furnitureById.get(candidate.type);
        if (!definition) continue;
        let id = typeof candidate.id === 'string' && safeId.test(candidate.id) ? candidate.id : `room-item-${index + 1}`;
        if (seen.has(id)) {
            id = `room-item-${index + 1}`;
            let suffix = 2;
            while (seen.has(id)) id = `room-item-${index + 1}-${suffix++}`;
        }
        seen.add(id);
        const item = { id, type: definition.id, x: number(candidate.x, 160), y: number(candidate.y, definition.category === 'wall' ? 78 : 190), rotation: rotate(candidate.rotation), color: colorsById.has(candidate.color) ? candidate.color : 'natural' };
        const bounds = getRoomItemBounds(item);
        const minY = definition.category === 'wall' ? 18 : 142;
        const maxY = definition.category === 'wall' ? 145 : 240;
        item.x = clamp(item.x, bounds.width / 2, 320 - bounds.width / 2);
        item.y = clamp(item.y, minY + bounds.height / 2, maxY - bounds.height / 2);
        items.push(item);
    }
    return { enabled: source.enabled === true, wall: chosenId(ROOM_WALLS, source.wall, 'cream'), floor: chosenId(ROOM_FLOORS, source.floor, 'wood'), items };
}

export function addRoomItem(room, type, x, y, color = 'natural') {
    const current = normalizeCompanionRoom(room);
    if (!furnitureById.has(type) || current.items.length >= ROOM_MAX_ITEMS) return current;
    let counter = 1;
    while (current.items.some(item => item.id === `room-item-${counter}`)) counter++;
    return normalizeCompanionRoom({ ...current, items: [...current.items, { id: `room-item-${counter}`, type, x, y, color, rotation: 0 }] });
}

export function updateRoomItem(room, id, changes) {
    const current = normalizeCompanionRoom(room);
    const patch = changes && typeof changes === 'object' ? changes : {};
    // Identity and furniture kind belong to the placed item, not to an edit patch.
    return normalizeCompanionRoom({ ...current, items: current.items.map(item => item.id === id ? { ...item, x: patch.x ?? item.x, y: patch.y ?? item.y, rotation: patch.rotation ?? item.rotation, color: patch.color ?? item.color } : item) });
}

export function removeRoomItem(room, id) {
    const current = normalizeCompanionRoom(room);
    return { ...current, items: current.items.filter(item => item.id !== id) };
}

export function createCompanionRoomPreset(id = 'cozy') {
    const presets = {
        cozy: { wall: 'cream', floor: 'wood', items: [['window', 72, 64], ['clock', 176, 53], ['picture', 253, 73, 'rose'], ['bed', 58, 196, 'rose'], ['lamp', 108, 178], ['rug', 175, 216, 'sage'], ['plant', 279, 182, 'sage'], ['basket', 266, 224]] },
        garden: { wall: 'sage', floor: 'lightwood', items: [['window', 170, 64, 'sage'], ['wall-shelf', 64, 93], ['picture', 264, 81, 'sage'], ['sofa', 58, 188, 'sage'], ['table', 92, 220], ['rug', 187, 218, 'sage'], ['flowers', 278, 175, 'rose'], ['plant', 253, 216, 'sage']] },
        study: { wall: 'blue', floor: 'lightwood', items: [['window', 152, 66, 'sky'], ['clock', 273, 57], ['wall-shelf', 57, 97], ['bookshelf', 37, 186], ['drawer', 281, 168], ['table', 257, 207, 'sky'], ['chair', 203, 221, 'sky'], ['rug', 139, 215]] },
    };
    const preset = presets[id] || presets.cozy;
    return normalizeCompanionRoom({ ...preset, enabled: true, items: preset.items.map(([type, x, y, color = 'natural'], index) => ({ id: `room-item-${index + 1}`, type, x, y, rotation: 0, color })) });
}

const rect = (x, y, width, height, fill, className = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"${className ? ` class="${className}"` : ''}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const tint = (hex, amount, target = '#f6f0df') => {
    const rgb = value => [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
    const start = rgb(hex), end = rgb(target);
    return '#' + start.map((value, index) => Math.round(value + (end[index] - value) * amount).toString(16).padStart(2, '0')).join('');
};
const contactShadow = (width, height) => path(`M4 ${height - 5}H${width - 4}V${height - 4}H${width - 1}V${height - 2}H${width - 5}V${height}H5V${height - 1}H1V${height - 3}H4Z`, '#6e6653', 'opacity=".17"');

function itemArt(type, color) {
    const p = colorsById.get(color) || ROOM_COLORS[0];
    const r = rect;
    const top = tint(p.wood, .38), side = tint(p.wood, .2, p.dark);
    const fabric = tint(p.accent, .34), seam = tint(p.accent, .28, p.dark), cream = '#f1e8d1';
    switch (type) {
    case 'bed': return [
        contactShadow(72, 46), r(5, 0, 11, 36, p.dark), r(7, 2, 7, 30, top), r(9, 6, 2, 20, p.wood),
        r(7, 31, 60, 8, side), r(8, 29, 59, 4, p.wood), r(12, 37, 5, 6, p.dark), r(60, 37, 5, 6, p.dark),
        path('M12 6H63V9H68V30H12Z', p.dark), r(14, 7, 48, 3, cream), r(13, 10, 52, 18, p.soft), r(65, 12, 3, 16, tint(p.soft, .22, p.dark)),
        r(16, 10, 14, 14, tint(p.soft, .45)), r(17, 10, 12, 11, cream), r(19, 12, 8, 2, '#fbf6e8'), r(17, 21, 11, 2, '#d2c5a9'),
        r(32, 8, 32, 22, fabric), r(35, 10, 27, 15, p.accent), r(36, 10, 2, 13, tint(p.accent, .45)), r(60, 11, 2, 13, seam),
        r(32, 25, 32, 5, p.soft), r(33, 25, 30, 1, cream), [38, 45, 52, 59].map(x => r(x, 27, 3, 1, seam)).join(''),
        r(8, 33, 56, 1, top), r(20, 35, 13, 1, tint(p.wood, .3)),
    ].join('');
    case 'sofa': return [
        contactShadow(70, 40), r(9, 0, 52, 25, seam), r(11, 1, 48, 4, tint(fabric, .3)), r(10, 5, 25, 17, fabric), r(36, 5, 24, 17, fabric),
        r(12, 7, 21, 1, tint(fabric, .4)), r(38, 7, 20, 1, tint(fabric, .4)), r(33, 6, 1, 13, seam), r(36, 6, 1, 13, seam),
        r(6, 19, 58, 15, p.accent), r(9, 20, 25, 7, p.soft), r(36, 20, 25, 7, p.soft), r(10, 21, 23, 1, cream), r(37, 21, 23, 1, cream),
        r(10, 27, 50, 1, seam), r(12, 31, 46, 2, seam), r(0, 14, 8, 19, seam), r(2, 14, 5, 14, fabric), r(2, 14, 5, 2, p.soft),
        r(62, 14, 8, 19, seam), r(63, 14, 5, 14, fabric), r(63, 14, 5, 2, p.soft), r(7, 33, 5, 4, side), r(58, 33, 5, 4, side),
        r(16, 9, 12, 11, seam), r(17, 8, 10, 10, p.soft), r(18, 9, 8, 1, cream), r(21, 11, 2, 3, p.accent),
        r(45, 11, 11, 8, tint(p.accent, .12, p.dark)), r(46, 10, 9, 7, tint(p.accent, .55)),
    ].join('');
    case 'table': return [
        contactShadow(50, 40), r(8, 13, 5, 23, side), r(39, 13, 5, 23, p.dark), r(10, 17, 2, 14, top), r(16, 25, 22, 3, side),
        path('M4 7H45V10H49V18H4V16H0V10H4Z', side), path('M4 6H45V8H49V13H45V15H4V13H1V9H4Z', top), r(7, 7, 36, 1, tint(top, .32)),
        r(5, 15, 42, 2, p.wood), r(11, 11, 10, 1, tint(p.wood, .25)), r(29, 13, 11, 1, tint(p.wood, .25)),
        r(8, 7, 12, 6, '#9a9c78'), r(9, 6, 10, 4, '#c2c3a1'), r(10, 7, 8, 1, '#e5ddc4'),
        r(31, 5, 11, 7, '#d4c8ae'), r(33, 1, 7, 7, cream), r(39, 3, 4, 4, cream), r(40, 4, 2, 2, side), r(34, 2, 5, 2, '#ad8660'), r(35, 6, 3, 1, '#fbf5e5'),
    ].join('');
    case 'chair': return [
        contactShadow(28, 34), r(4, 0, 20, 21, p.dark), r(6, 1, 16, 3, top), r(7, 4, 14, 10, p.wood), r(9, 5, 1, 8, top), r(19, 5, 1, 8, side),
        r(5, 4, 2, 19, side), r(21, 4, 2, 19, side), r(4, 23, 4, 8, p.dark), r(21, 23, 4, 8, p.dark), r(8, 28, 13, 2, side),
        path('M3 16H25V18H28V24H0V18H3Z', side), r(3, 16, 22, 5, top), r(5, 17, 18, 3, p.soft), r(6, 17, 16, 1, cream), r(5, 21, 19, 2, p.wood),
        r(12, 7, 4, 4, tint(p.wood, .25, side)), r(13, 7, 2, 3, top),
    ].join('');
    case 'bookshelf': return [
        contactShadow(44, 78), r(2, 3, 38, 69, side), r(5, 7, 32, 61, tint(p.wood, .26, p.dark)), r(37, 5, 6, 68, p.dark), r(38, 6, 3, 64, side),
        r(0, 2, 39, 5, top), r(2, 1, 37, 2, tint(top, .25)), r(2, 7, 3, 62, top), r(34, 7, 3, 62, p.wood),
        [8, 28].map((y, row) => [6, 13, 20, 28].map((x, i) => {
            const book = ['#af8170', '#91aa83', '#98b5c0', '#d4b37c'][(i + row) % 4], h = [14, 17, 13, 16][i];
            return r(x, y + 17 - h, i === 3 ? 5 : 6, h, tint(book, .2, '#675d4b')) + r(x + 1, y + 17 - h, 4, 2, tint(book, .35)) + r(x + 1, y + 8, 4, 1, '#e9ddc1') + r(x + 1, y + 15, 4, 1, tint(book, .2));
        }).join('')).join(''),
        [25, 46].map(y => r(5, y, 31, 3, side) + r(5, y, 29, 1, top)).join(''),
        r(7, 54, 15, 12, '#c8b28a'), r(7, 54, 15, 2, cream), r(9, 57, 11, 1, '#b18e68'), r(9, 61, 11, 1, '#b18e68'), r(14, 55, 2, 11, '#aa8a65'),
        r(25, 61, 8, 5, '#a1b599'), r(26, 54, 6, 8, '#b9c8ac'), r(25, 57, 8, 1, '#dbe0bd'), r(27, 56, 2, 2, cream),
        r(2, 69, 35, 4, p.wood), r(3, 69, 31, 1, top), r(5, 73, 5, 3, p.dark), r(33, 73, 5, 3, p.dark),
    ].join('');
    case 'drawer': return [
        contactShadow(44, 38), r(3, 9, 35, 23, side), r(38, 8, 5, 24, p.dark), r(39, 10, 2, 20, side),
        r(1, 6, 37, 5, top), r(2, 6, 34, 1, tint(top, .25)), r(1, 10, 38, 2, p.wood),
        [13, 22].map(y => r(5, y, 29, 7, p.wood) + r(6, y, 27, 1, top) + r(7, y + 5, 25, 1, side) + r(17, y + 2, 6, 2, p.dark) + r(18, y + 2, 4, 1, '#d7c29a')).join(''),
        r(5, 32, 4, 4, p.dark), r(34, 32, 4, 4, p.dark), r(9, 4, 11, 3, '#94a890'), r(10, 3, 9, 2, '#c6d0b0'),
        r(27, 2, 7, 5, p.accent), r(28, 0, 5, 3, '#d5c4a4'), r(29, 1, 3, 1, cream),
    ].join('');
    case 'lamp': return [
        contactShadow(26, 60), r(10, 19, 4, 33, side), r(11, 21, 1, 29, top), r(5, 52, 16, 4, side), r(3, 55, 20, 3, p.dark), r(4, 54, 18, 2, top),
        path('M7 2H19V7H22V13H25V19H1V13H4V7H7Z', seam), path('M8 3H18V8H21V13H24V17H2V13H5V8H8Z', p.soft),
        r(8, 4, 2, 12, cream), r(13, 3, 2, 13, tint(p.soft, .3)), r(18, 8, 2, 8, tint(p.soft, .3, p.accent)), r(2, 17, 22, 2, fabric),
        r(8, 20, 10, 3, '#edd49b', 'tf-scene-lamplight'), r(19, 20, 1, 8, '#a6936d'), r(18, 27, 3, 3, '#d4b17a'),
    ].join('');
    case 'stool': return [
        contactShadow(28, 22), r(5, 9, 4, 10, side), r(20, 9, 4, 10, p.dark), r(8, 14, 12, 2, p.wood),
        path('M4 2H24V4H27V10H24V12H4V10H1V4H4Z', side), path('M5 1H23V3H26V7H23V9H5V7H2V3H5Z', top),
        r(5, 2, 18, 1, tint(top, .35)), r(8, 5, 12, 1, p.wood), r(6, 8, 17, 1, p.wood),
    ].join('');
    case 'plant': return [
        contactShadow(30, 42), r(13, 8, 3, 23, '#6e8661'), r(5, 20, 9, 2, '#789269'), r(17, 11, 9, 2, '#789269'),
        path('M1 12H6V9H12V12H15V19H10V22H5V19H1Z', '#7e9c71'), path('M3 12H9V14H12V17H6V15H3Z', '#a4b58b'),
        path('M16 4H23V1H27V8H30V13H24V16H18V12H16Z', '#78956a'), r(19, 6, 7, 2, '#a1b28a'), r(19, 8, 2, 5, '#8da57a'),
        path('M8 0H15V3H18V10H12V8H8Z', '#91ab7b'), r(11, 2, 2, 6, '#b9c79d'),
        path('M4 28H25V32H23V39H7V32H4Z', side), r(5, 27, 19, 3, top), r(7, 30, 15, 8, p.accent), r(9, 31, 3, 6, fabric), r(20, 30, 2, 8, seam), r(8, 38, 13, 1, p.dark),
    ].join('');
    case 'flowers': return [
        contactShadow(30, 32), r(13, 8, 2, 15, '#7d9468'), r(6, 12, 2, 12, '#8da271'), r(22, 10, 2, 14, '#81996a'),
        path('M1 5H5V2H9V5H12V10H9V13H4V10H1Z', '#e0c18b'), r(5, 6, 3, 3, '#af8860'), r(2, 6, 2, 3, '#f0d6a4'),
        path('M9 2H12V0H17V2H21V7H18V10H12V7H9Z', '#c78d88'), r(13, 3, 4, 3, '#ead397'), r(10, 3, 2, 3, '#e3b5ab'),
        path('M19 5H22V2H26V5H29V10H26V12H22V10H19Z', '#adacc8'), r(23, 6, 3, 3, '#e6d5a4'),
        path('M6 15H11V19H14V21H8V19H6ZM17 17H21V14H26V18H23V20H17Z', '#a0b185'),
        r(5, 22, 20, 3, side), r(7, 25, 16, 5, p.accent), r(8, 23, 14, 1, top), r(9, 26, 2, 3, fabric), r(20, 25, 2, 5, seam),
    ].join('');
    case 'rug': return [
        contactShadow(82, 28), path('M7 2H75V4H78V23H4V4H7Z', seam), r(7, 3, 68, 19, p.soft), r(9, 5, 64, 15, fabric), r(10, 6, 62, 1, cream), r(10, 19, 62, 1, seam),
        [16, 28, 40, 52, 64].map(x => path(`M${x} 9H${x + 2}V7H${x + 4}V9H${x + 6}V12H${x + 4}V15H${x + 2}V12H${x}Z`, p.soft) + r(x + 2, 10, 2, 2, p.accent)).join(''),
        [0, 78].map(x => [4, 8, 12, 16, 20].map(y => r(x + 1, y, 3, 2, p.soft) + r(x, y + 1, 1, 2, seam)).join('')).join(''),
        r(7, 23, 68, 1, tint(p.soft, .24, p.dark)), [13, 23, 33, 43, 53, 63].map(x => r(x, 17, 4, 1, p.accent)).join(''),
    ].join('');
    case 'cushion': return [
        contactShadow(40, 26), path('M8 2H32V4H36V8H39V18H35V22H5V18H1V8H5V4H8Z', seam),
        path('M9 3H31V5H34V8H37V16H33V19H7V16H3V8H6V5H9Z', fabric), r(10, 4, 20, 2, tint(fabric, .25)), r(7, 7, 1, 9, p.soft), r(31, 7, 1, 9, seam),
        path('M9 16H31V18H28V20H12V18H9Z', p.accent), r(17, 10, 6, 4, p.accent), r(18, 10, 4, 2, p.soft), r(6, 20, 28, 2, tint(p.accent, .2, p.dark)),
        [12, 19, 26].map(x => r(x, 7, 2, 1, p.soft) + r(x, 16, 2, 1, seam)).join(''),
    ].join('');
    case 'food-bowl': return [
        contactShadow(30, 18), path('M3 5H27V7H30V10H27V15H3V10H0V7H3Z', seam), r(3, 9, 24, 5, p.accent), r(4, 10, 4, 3, fabric), r(24, 9, 2, 5, seam),
        path('M4 4H26V6H28V9H25V11H5V9H2V6H4Z', cream), r(5, 6, 20, 3, '#926e4e'), r(8, 5, 4, 3, '#c9a46e'), r(14, 6, 4, 2, '#d8b581'), r(20, 5, 3, 3, '#b68c5d'),
        r(13, 12, 4, 2, p.soft), r(12, 10, 1, 1, p.soft), r(17, 10, 1, 1, p.soft),
    ].join('');
    case 'toy': return [
        contactShadow(26, 26), path('M8 1H18V3H22V7H25V17H22V21H18V23H8V21H4V17H1V7H4V3H8Z', seam),
        path('M8 2H17V4H21V8H23V15H20V19H16V21H8V19H4V15H3V8H5V4H8Z', fabric),
        path('M10 2H15V8H21V13H15V20H10V13H4V8H10Z', p.soft), r(10, 8, 5, 5, p.accent), r(7, 4, 3, 3, '#fbf2db'), r(18, 16, 3, 2, p.accent), r(8, 20, 8, 2, p.accent),
    ].join('');
    case 'basket': return [
        contactShadow(34, 30), path('M3 9H31V12H33V24H30V27H4V24H1V12H3Z', side), r(4, 14, 26, 10, p.wood), r(5, 15, 25, 1, top),
        [6, 12, 18, 24].map(x => r(x, 15, 2, 9, top) + r(x + 2, 16, 1, 8, tint(p.wood, .16, p.dark))).join(''),
        r(4, 18, 26, 1, side), r(4, 22, 26, 1, side), r(5, 25, 24, 1, p.dark),
        path('M8 0H26V3H29V9H25V4H9V9H5V3H8Z', side), r(9, 1, 15, 1, top),
        r(8, 7, 17, 6, fabric), r(11, 6, 12, 4, p.soft), r(13, 7, 7, 1, cream), r(7, 10, 19, 3, p.accent),
        r(2, 12, 30, 3, top), r(3, 13, 28, 1, p.soft), r(13, 19, 8, 3, '#d8c59f'), r(15, 20, 4, 1, p.dark),
    ].join('');
    case 'aquarium': return [
        contactShadow(46, 34), r(1, 2, 40, 27, p.dark), r(40, 4, 5, 25, side), r(3, 4, 35, 21, '#c1d9d8'), r(4, 8, 33, 17, '#9fbdc3'), r(4, 8, 33, 1, '#dfebe0'),
        r(38, 5, 3, 21, '#819fa7'), r(39, 7, 1, 17, '#b7cacc'), r(3, 24, 35, 4, '#c9bf9a'), r(5, 25, 4, 2, '#e0d2ae'), r(18, 26, 3, 1, '#a99778'), r(31, 24, 5, 2, '#b0a27c'),
        r(8, 15, 2, 10, '#7f9c78'), r(11, 12, 2, 13, '#8cab80'), r(7, 18, 7, 2, '#aac395'), r(10, 15, 6, 2, '#aac395'),
        path('M22 15H30V17H33V20H29V22H22V20H19V17H22Z', '#d3a46f'), path('M32 15H36V22H32V20H30V17H32Z', '#bb8e68'), r(21, 17, 1, 1, '#666d64'), r(23, 16, 5, 1, '#ecc48c'),
        r(16, 10, 1, 1, '#e0eee4'), r(18, 6, 2, 2, '#d6e8de'), r(4, 5, 2, 13, '#edf3e6'), r(6, 5, 2, 6, '#dce9dc'),
        r(0, 0, 41, 3, top), r(2, 1, 37, 1, p.soft), r(1, 29, 43, 3, p.wood), r(3, 29, 37, 1, top),
    ].join('');
    case 'window': return [
        r(2, 3, 60, 50, '#a69576'), r(4, 1, 55, 48, p.wood), r(7, 4, 49, 40, '#c1d7d7', 'tf-scene-sky'), r(8, 5, 47, 1, '#dae6d9'),
        path('M8 30H14V26H20V28H26V33H33V29H39V23H46V29H55V44H8Z', '#aabc98'), path('M8 35H15V32H23V37H31V33H39V34H45V30H55V44H8Z', '#8da682'),
        r(39, 10, 7, 7, '#f1ddac', 'tf-scene-daylight'), r(15, 13, 12, 3, '#e7ecdf'), r(19, 11, 5, 2, '#e7ecdf'),
        r(29, 4, 3, 41, p.soft), r(7, 25, 49, 3, p.soft), r(30, 5, 1, 38, cream), r(8, 26, 46, 1, cream),
        path('M0 0H12V8H10V15H8V35H11V43H2V36H0Z', fabric), path('M52 0H64V36H62V43H53V35H56V15H54V8H52Z', fabric),
        r(2, 2, 2, 32, p.soft), r(6, 3, 2, 11, tint(fabric, .3)), r(57, 3, 2, 12, p.soft), r(61, 2, 1, 31, seam), r(2, 33, 7, 3, p.wood), r(55, 33, 7, 3, p.wood),
        r(3, 45, 58, 4, p.dark), r(1, 44, 62, 3, top), r(2, 44, 59, 1, p.soft), r(5, 49, 55, 2, '#897a62'),
    ].join('');
    case 'picture': return [
        r(2, 2, 36, 30, '#a59579'), r(0, 0, 36, 29, side), r(1, 1, 33, 26, top), r(3, 3, 29, 22, cream), r(6, 6, 23, 16, '#bdcec8'),
        r(21, 8, 4, 4, '#e6d1a0'), path('M6 18H9V15H14V12H18V16H22V18H29V22H6Z', '#93a789'), path('M6 21H11V19H19V17H23V19H29V22H6Z', '#788e76'),
        r(11, 17, 3, 2, '#d0d4b4'), r(3, 24, 29, 1, '#c9bc9d'), r(34, 2, 2, 26, p.dark), r(2, 27, 32, 2, side), r(1, 1, 33, 1, p.soft),
    ].join('');
    case 'clock': return [
        path('M9 2H21V5H25V9H28V21H25V25H21V28H9V25H5V21H2V9H5V5H9Z', '#a6977d'),
        path('M7 0H19V2H23V6H26V18H23V22H19V25H7V22H3V18H0V6H3V2H7Z', side),
        path('M8 1H18V3H22V7H24V17H22V21H18V23H8V21H4V17H2V7H4V3H8Z', top),
        path('M8 4H18V6H21V9H22V16H19V19H16V21H9V19H6V16H5V9H6V6H8Z', cream),
        r(12, 5, 2, 2, p.dark), r(12, 18, 2, 2, p.dark), r(6, 11, 2, 2, p.dark), r(19, 11, 2, 2, p.dark),
        r(12, 8, 2, 6, side), r(14, 12, 5, 2, side), r(12, 12, 2, 2, p.accent), r(5, 4, 3, 1, p.soft),
    ].join('');
    case 'wall-shelf': return [
        r(3, 27, 49, 5, '#ac9d80'), r(3, 30, 6, 4, side), r(42, 30, 6, 4, side), r(4, 30, 3, 2, top), r(43, 30, 3, 2, top),
        r(1, 23, 48, 5, side), r(0, 22, 50, 3, top), r(2, 23, 45, 1, p.soft), r(1, 27, 48, 1, p.dark),
        r(5, 6, 7, 16, '#b48777'), r(6, 6, 5, 2, '#d0a08b'), r(6, 13, 5, 1, cream),
        r(13, 2, 6, 20, '#97ac86'), r(14, 3, 4, 2, '#c2caaa'), r(14, 15, 4, 1, cream), r(20, 8, 6, 14, '#a4bec8'), r(21, 9, 4, 1, '#d5dfd5'),
        r(32, 15, 11, 7, p.accent), r(33, 15, 9, 2, top), r(34, 18, 2, 3, fabric), r(37, 6, 2, 10, '#779469'),
        path('M30 4H36V6H38V10H33V8H30ZM39 0H46V4H43V7H39Z', '#92ad80'), r(40, 1, 4, 1, '#c0cf9d'), r(32, 5, 4, 1, '#b5c595'),
    ].join('');
    default: return '';
    }
}

function placedArt(item) {
    const definition = furnitureById.get(item.type);
    return `<g data-room-item="${item.id}" transform="translate(${item.x} ${item.y}) rotate(${item.rotation * 90})"><g transform="translate(${-definition.width / 2} ${-definition.height / 2})">${itemArt(item.type, item.color)}</g></g>`;
}

export function renderRoomFurniture(type, color = 'natural', rotation = 0) {
    const definition = furnitureById.get(type);
    if (!definition) return '';
    const item = { id: 'thumbnail', type, color: colorsById.has(color) ? color : 'natural', rotation: rotate(rotation) };
    const bounds = getRoomItemBounds(item);
    item.x = bounds.width / 2 + 4;
    item.y = bounds.height / 2 + 4;
    return `<svg class="tf-room-furniture-art" viewBox="0 0 ${bounds.width + 8} ${bounds.height + 8}" shape-rendering="crispEdges" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${placedArt(item)}</svg>`;
}

function floorArt(floor) {
    let art = rect(0, 142, 320, 98, floor.color);
    const project = (x, y) => Math.round(160 + (x - 160) * (1 + (y - 142) / 190));
    const line = (x1, y1, x2, y2, color, opacity = 1) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="1" opacity="${opacity}" fill="none"/>`;
    const rows = [142, 154, 171, 191, 214, 240];
    if (floor.id === 'wood' || floor.id === 'lightwood') {
        for (let x = -20; x <= 340; x += 36) {
            art += line(project(x, 142), 142, project(x, 240), 240, floor.line, .64);
            art += line(project(x, 142) + 1, 142, project(x, 240) + 1, 240, tint(floor.color, .34), .8);
        }
        for (let row = 0; row < rows.length - 1; row++) {
            const y = rows[row + 1];
            for (let x = -20 + (row % 2) * 36; x < 340; x += 72) {
                art += line(project(x, y), y, project(x + 36, y), y, floor.line, .54);
                const grainX = project(x + 8, y - 5);
                art += rect(grainX, y - 5, 9 + row * 2, 1, tint(floor.color, .16, floor.line));
                art += rect(grainX + 6, y - 3, 5 + row, 1, tint(floor.color, .15));
            }
        }
    } else if (floor.id === 'checker') {
        for (let row = 0; row < rows.length - 1; row++) {
            const y1 = rows[row], y2 = rows[row + 1];
            for (let col = -2; col < 13; col++) if ((row + col) % 2) {
                const x1 = col * 32, x2 = x1 + 32;
                art += path(`M${project(x1, y1)} ${y1}H${project(x2, y1)}L${project(x2, y2)} ${y2}H${project(x1, y2)}Z`, tint(floor.line, .18));
            }
            art += rect(0, y2, 320, 1, tint(floor.color, .3));
        }
    } else {
        for (let row = 0; row < rows.length - 1; row++) {
            const y1 = rows[row], y2 = rows[row + 1];
            art += rect(0, y2 - 1, 320, 1, floor.line) + rect(0, y2, 320, 1, tint(floor.color, .35));
            for (let x = -32 + (row % 2) * 32; x < 352; x += 64) {
                art += line(project(x, y1), y1, project(x, y2), y2, floor.line, .8);
                art += rect(project(x + 12, y2 - 6), y2 - 6, 13, 1, tint(floor.color, .1));
            }
        }
    }
    return art + `<g opacity=".1">${rect(0, 142, 320, 3, '#5e6655')}</g><g opacity=".08">${rect(0, 146, 320, 7, floor.line)}</g>`;
}

function wallArt(wall) {
    const upper = tint(wall.color, .13), panel = tint(wall.color, .18, '#a3987f');
    let art = rect(0, 0, 320, 142, wall.color) + rect(8, 8, 304, 94, upper);
    art += rect(0, 0, 320, 4, '#e2d8bf') + rect(0, 4, 320, 2, '#f4ecd7') + rect(0, 6, 320, 2, tint(wall.color, .18, '#a3987f'));
    // Recessed panels give the empty room architecture without adding fixed props.
    art += rect(0, 103, 320, 33, panel) + rect(0, 102, 320, 2, tint(wall.color, .26, '#a3987f')) + rect(0, 104, 320, 2, tint(wall.color, .45));
    for (let x = 15; x < 320; x += 48) {
        art += rect(x, 111, 38, 22, tint(panel, .16, '#a3987f')) + rect(x + 1, 112, 36, 20, panel) + rect(x + 2, 113, 35, 1, tint(panel, .28));
        art += rect(x + 1, 112, 1, 19, tint(panel, .24)) + rect(x + 36, 113, 1, 18, tint(panel, .12, '#a3987f'));
    }
    art += rect(0, 136, 320, 3, '#bcab8f') + rect(0, 136, 320, 1, '#e9ddc3') + rect(0, 139, 320, 3, '#a7977f');
    for (let edge = 0; edge < 4; edge++) {
        const shade = tint(wall.color, .12 - edge * .024, '#938b75');
        art += rect(edge * 2, 8, 2, 128, shade) + rect(318 - edge * 2, 8, 2, 128, shade);
    }
    return art;
}

function roomLight(items) {
    let art = '';
    for (const item of items) {
        const bounds = getRoomItemBounds(item);
        if (item.type === 'window') {
            const left = bounds.x + 7, right = bounds.x + bounds.width - 7, top = bounds.y + bounds.height - 8;
            const drift = item.x < 160 ? 55 : -55;
            art += `<g class="tf-scene-daylight">${path(`M${left} ${top}H${right}L${right + drift + 20} 239H${left + drift - 20}Z`, '#fff5cc', 'opacity=".1"')}${path(`M${item.x - 1} ${top}H${item.x + 2}L${item.x + drift + 4} 239H${item.x + drift}Z`, '#fff7d9', 'opacity=".14"')}</g>`;
        } else if (item.type === 'lamp') {
            art += `<g class="tf-scene-lamplight">${path(`M${item.x - 7} ${bounds.y + 18}H${item.x + 7}L${item.x + 33} ${Math.min(239, bounds.y + bounds.height)}H${item.x - 33}Z`, '#f9dea0', 'opacity=".09"')}</g>`;
        }
    }
    return art;
}

export function renderCompanionRoom(room) {
    const current = normalizeCompanionRoom(room);
    const wall = ROOM_WALLS.find(item => item.id === current.wall);
    const floor = ROOM_FLOORS.find(item => item.id === current.floor);
    const items = [...current.items].sort((a, b) => {
        const layer = item => furnitureById.get(item.type).category === 'wall' ? 0 : item.type === 'rug' ? 1 : 2;
        return layer(a) - layer(b) || a.y - b.y;
    });
    return `<svg class="tf-scene-art" data-scene="custom-room" data-indoor="true" viewBox="0 0 320 240" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${wallArt(wall)}${floorArt(floor)}${roomLight(items)}${items.map(placedArt).join('')}</svg>`;
}
