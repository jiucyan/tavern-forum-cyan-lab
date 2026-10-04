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
        cozy: { wall: 'cream', floor: 'wood', items: [['window', 84, 66], ['picture', 242, 67], ['bed', 62, 198], ['rug', 182, 212, 'sage'], ['lamp', 275, 181], ['food-bowl', 268, 223, 'rose']] },
        garden: { wall: 'sage', floor: 'lightwood', items: [['window', 154, 65], ['wall-shelf', 250, 91, 'sage'], ['sofa', 68, 190, 'sage'], ['flowers', 266, 198, 'rose'], ['plant', 228, 214, 'sage'], ['cushion', 153, 220, 'sage']] },
        study: { wall: 'blue', floor: 'stone', items: [['clock', 225, 65, 'sky'], ['picture', 91, 64, 'sky'], ['bookshelf', 39, 186], ['table', 251, 199, 'sky'], ['chair', 193, 222, 'sky'], ['aquarium', 266, 161, 'sky']] },
    };
    const preset = presets[id] || presets.cozy;
    return normalizeCompanionRoom({ ...preset, enabled: true, items: preset.items.map(([type, x, y, color = 'natural'], index) => ({ id: `room-item-${index + 1}`, type, x, y, rotation: 0, color })) });
}

const rect = (x, y, width, height, fill, className = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"${className ? ` class="${className}"` : ''}/>`;

function itemArt(type, color) {
    const p = colorsById.get(color) || ROOM_COLORS[0];
    const r = rect;
    switch (type) {
    case 'bed': return r(3, 8, 66, 33, p.dark) + r(6, 11, 60, 24, p.wood) + r(9, 5, 54, 26, p.soft) + r(9, 5, 18, 23, '#f6efdc') + r(29, 5, 34, 26, p.accent) + r(34, 10, 5, 15, p.soft) + r(6, 37, 6, 9, p.dark) + r(60, 37, 6, 9, p.dark);
    case 'sofa': return r(8, 0, 54, 24, p.dark) + r(11, 3, 48, 18, p.soft) + r(0, 15, 70, 20, p.dark) + r(3, 18, 64, 14, p.accent) + r(10, 18, 24, 9, p.soft) + r(37, 18, 23, 9, p.soft) + r(7, 35, 5, 5, p.wood) + r(58, 35, 5, 5, p.wood);
    case 'table': return r(7, 17, 5, 23, p.dark) + r(38, 17, 5, 23, p.dark) + r(0, 7, 50, 13, p.dark) + r(3, 4, 44, 13, p.wood) + r(7, 7, 36, 3, p.soft) + r(23, 0, 11, 7, '#ece4d0') + r(25, 0, 7, 3, p.accent);
    case 'chair': return r(4, 0, 20, 24, p.dark) + r(7, 3, 14, 13, p.soft) + r(0, 17, 28, 8, p.wood) + r(3, 25, 4, 9, p.dark) + r(21, 25, 4, 9, p.dark) + r(4, 19, 20, 3, p.accent);
    case 'bookshelf': return r(0, 0, 44, 78, p.dark) + r(4, 4, 36, 69, p.wood) + [7, 28, 50].map((y, row) => r(4, y + 16, 36, 4, p.dark) + [6, 14, 23, 32].map((x, i) => r(x, y + (i % 2 ? 3 : 0), 6, 16 - (i % 2 ? 3 : 0), ['#b97666', '#a7bda3', '#9eb9c8', '#ddc797'][(i + row) % 4]) + r(x + 1, y + 7, 4, 2, '#e7dfc7')).join('')).join('') + r(5, 74, 5, 4, p.dark) + r(34, 74, 5, 4, p.dark);
    case 'drawer': return r(0, 0, 44, 33, p.dark) + [3, 13, 23].map(y => r(3, y, 38, 7, p.wood) + r(19, y + 2, 6, 2, p.soft)).join('') + r(5, 33, 5, 5, p.dark) + r(34, 33, 5, 5, p.dark);
    case 'lamp': return r(12, 20, 3, 34, p.dark) + r(4, 54, 20, 6, p.wood) + r(6, 0, 14, 6, p.dark) + r(3, 6, 20, 7, p.soft) + r(0, 13, 26, 8, p.accent) + r(7, 21, 12, 5, '#edce83', 'tf-scene-lamplight');
    case 'stool': return r(5, 8, 4, 14, p.dark) + r(20, 8, 4, 14, p.dark) + r(0, 3, 28, 9, p.dark) + r(3, 0, 22, 8, p.soft) + r(6, 2, 16, 3, p.accent);
    case 'plant': return r(13, 10, 4, 21, '#74946a') + r(2, 12, 12, 9, '#829f70') + r(6, 8, 9, 6, '#a8bd89') + r(16, 3, 11, 10, '#6d9267') + r(17, 11, 13, 6, '#9ab17c') + r(10, 0, 9, 8, '#95b07d') + r(6, 27, 19, 4, p.dark) + r(8, 31, 15, 11, p.accent) + r(11, 32, 3, 8, p.soft);
    case 'flowers': return r(13, 7, 3, 18, '#7d9969') + r(5, 17, 8, 4, '#93aa74') + r(17, 14, 8, 4, '#93aa74') + r(10, 0, 11, 10, '#d39891') + r(14, 3, 4, 4, '#efda94') + r(0, 8, 11, 10, '#e9c890') + r(4, 11, 4, 4, '#c19569') + r(20, 5, 10, 10, '#b7bbd6') + r(24, 8, 3, 3, '#efda94') + r(6, 23, 19, 9, p.accent) + r(4, 21, 23, 4, p.dark);
    case 'rug': return r(3, 3, 76, 22, p.dark) + r(6, 5, 70, 18, p.soft) + r(10, 8, 62, 12, p.accent) + r(16, 11, 50, 6, p.soft) + [0, 79].map(x => [3, 9, 15, 21].map(y => r(x, y, 3, 4, p.soft)).join('')).join('') + r(39, 10, 4, 8, p.accent);
    case 'cushion': return r(3, 3, 34, 20, p.dark) + r(0, 7, 40, 12, p.dark) + r(4, 5, 32, 14, p.soft) + r(9, 7, 22, 11, p.accent) + r(18, 10, 4, 4, p.soft) + r(6, 22, 28, 4, p.dark);
    case 'food-bowl': return r(0, 6, 30, 7, p.dark) + r(3, 13, 24, 5, p.accent) + r(3, 3, 24, 8, p.soft) + r(6, 5, 18, 5, '#936b48') + r(9, 0, 5, 5, '#cfa46c') + r(17, 2, 5, 4, '#e0bd83');
    case 'toy': return r(6, 0, 14, 26, p.dark) + r(0, 6, 26, 14, p.dark) + r(4, 4, 18, 18, p.accent) + r(4, 10, 18, 6, p.soft) + r(10, 4, 6, 18, p.soft) + r(7, 6, 4, 4, '#f4edda');
    case 'basket': return r(0, 8, 34, 6, p.dark) + r(3, 14, 28, 16, p.wood) + [7, 15, 23].map(x => r(x, 15, 3, 14, p.soft)).join('') + r(3, 21, 28, 3, p.dark) + r(7, 0, 20, 4, p.dark) + r(4, 3, 4, 5, p.dark) + r(26, 3, 4, 5, p.dark) + r(11, 8, 13, 4, p.accent);
    case 'aquarium': return r(0, 0, 46, 34, p.dark) + r(3, 4, 40, 26, '#a8cbd0') + r(3, 8, 40, 20, '#8fb6c1') + r(5, 26, 36, 4, '#d3c698') + r(8, 17, 3, 10, '#6e9b76') + r(11, 13, 3, 9, '#84ab83') + r(22, 15, 11, 6, '#deb27f') + r(33, 13, 5, 10, '#c89374') + r(24, 16, 2, 2, p.dark) + r(17, 7, 2, 2, '#d6ebdd') + r(20, 3, 2, 2, '#d6ebdd');
    case 'window': return r(0, 0, 64, 54, p.dark) + r(4, 4, 56, 46, '#b6d8dc', 'tf-scene-sky') + r(5, 29, 54, 20, '#a4bf8d') + r(10, 32, 16, 17, '#8ea977') + r(43, 25, 16, 24, '#93af83') + r(31, 3, 3, 47, p.soft) + r(4, 24, 56, 3, p.soft) + r(0, 0, 7, 49, p.accent) + r(57, 0, 7, 49, p.accent) + r(0, 50, 64, 4, p.wood) + r(40, 11, 7, 7, '#f0e0af', 'tf-scene-daylight');
    case 'picture': return r(0, 0, 38, 32, p.dark) + r(3, 3, 32, 26, p.wood) + r(6, 6, 26, 20, '#c6d8d5') + r(6, 20, 26, 6, '#a4b28b') + r(10, 16, 12, 10, '#7f9678') + r(21, 19, 11, 7, '#92a485') + r(23, 8, 5, 5, '#e8d19b');
    case 'clock': return r(7, 0, 14, 28, p.dark) + r(0, 7, 28, 14, p.dark) + r(4, 4, 20, 20, p.wood) + r(7, 7, 14, 14, '#f3ead3') + r(13, 9, 2, 7, p.dark) + r(15, 14, 5, 2, p.dark) + r(12, 3, 4, 3, p.soft) + r(12, 22, 4, 3, p.soft);
    case 'wall-shelf': return r(0, 27, 52, 5, p.dark) + r(3, 24, 46, 4, p.wood) + r(7, 32, 5, 2, p.dark) + r(39, 32, 5, 2, p.dark) + r(6, 5, 8, 19, '#b98877') + r(15, 0, 7, 24, '#a6bc9b') + r(23, 6, 7, 18, '#a8c4d0') + r(37, 16, 9, 8, p.accent) + r(40, 8, 3, 9, '#87a577') + r(34, 7, 9, 5, '#94b583') + r(41, 3, 8, 7, '#779b6c');
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
    if (floor.id === 'wood' || floor.id === 'lightwood') {
        for (let y = 166; y < 240; y += 24) art += rect(0, y, 320, 1, floor.line);
        for (let row = 0; row < 5; row++) for (let x = (row % 2) * 40; x < 320; x += 80) art += rect(x, 143 + row * 24, 1, 23, floor.line);
    } else if (floor.id === 'checker') {
        for (let row = 0; row < 5; row++) for (let col = 0; col < 14; col++) if ((row + col) % 2) art += rect(col * 24, 142 + row * 24, Math.min(24, 320 - col * 24), Math.min(24, 240 - (142 + row * 24)), floor.line);
    } else {
        for (let y = 166; y < 240; y += 24) art += rect(0, y, 320, 2, floor.line);
        for (let row = 0; row < 5; row++) for (let x = (row % 2) * 32; x < 320; x += 64) art += rect(x, 142 + row * 24, 2, 24, floor.line);
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
    return `<svg class="tf-scene-art" data-scene="custom-room" data-indoor="true" viewBox="0 0 320 240" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${rect(0, 0, 320, 142, wall.color)}${rect(0, 138, 320, 4, '#b6a58b')}${floorArt(floor)}${items.map(placedArt).join('')}</svg>`;
}
