// Indoors, aquatic companions float freely without a container. Outdoor water
// belongs to the scene. These 320 × 240 coordinates describe the animal centre.
export const AQUATIC_HABITATS = Object.freeze({
    home: { kind: 'free', label: '小窝', box: [0, 0, 320, 240], bounds: [28, 292, 32, 212], spawn: [160, 166], rest: [160, 180] },
    kitchen: { kind: 'free', label: '厨房', box: [0, 0, 320, 240], bounds: [28, 292, 32, 212], spawn: [116, 180], rest: [100, 187] },
    yard: { kind: 'pond', label: '庭院小池', box: [221, 30, 90, 61], bounds: [245, 287, 53, 70], spawn: [266, 62], rest: [246, 69] },
    forest: { kind: 'stream', label: '林间浅溪', box: [189, 185, 121, 53], bounds: [215, 286, 207, 219], spawn: [253, 213], rest: [217, 217] },
    river: { kind: 'river', label: '河边水域', box: [20, 75, 180, 64], bounds: [46, 174, 99, 117], spawn: [132, 111], rest: [52, 116] },
});

// Independent selectable scenes have their own geometry. In particular, the
// native pond's distant water strip is much shallower than the homestead river.
// bodyScale fits visible artwork; it must never shrink the 44 px pointer target.
const naturalPool = (label, kind = 'pond') => Object.freeze({ kind, label, box: [100, 158, 128, 76],
    bounds: [140, 188, 188, 204], spawn: [164, 198], rest: [144, 203], bodyScale: 1 });
const SCENE_AQUATIC_HABITATS = Object.freeze({
    'habitat:meadow': naturalPool('草地小池'),
    'habitat:forest': naturalPool('林间浅溪', 'stream'),
    'habitat:snowfield': naturalPool('融雪小潭'),
    'habitat:city': naturalPool('屋顶水景'),
    'habitat:garden': naturalPool('花园小池'),
    'habitat:fairground': naturalPool('乐园水景'),
    'habitat:pond': Object.freeze({ kind: 'pond', label: '荷叶池塘水面', nativeWater: true, bodyScale: .4,
        box: [115, 115, 82, 28], bounds: [132, 182, 127, 131], spawn: [160, 128], rest: [136, 130] }),
    'habitat:beach': Object.freeze({ kind: 'sea', label: '海边水面', nativeWater: true, bodyScale: 1,
        box: [88, 90, 156, 60], bounds: [124, 208, 120, 120], spawn: [166, 120], rest: [128, 120] }),
});

export function isAquaticCompanion(kind, stage = 'adult', avatarUrl = '') {
    return !avatarUrl && (kind === 'goldfish' || kind === 'frog' && stage === 'baby');
}

export function getAquaticHabitat(location = 'home') {
    return AQUATIC_HABITATS[location] || SCENE_AQUATIC_HABITATS[location] || AQUATIC_HABITATS.home;
}

export function isAquaticPoint(point, habitat) {
    if (!habitat || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return false;
    const [x, y, width, height] = habitat.box;
    if (habitat.kind === 'free') return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
    return point.x >= x + 7 && point.x <= x + width - 7 && point.y >= y + 10 && point.y <= y + height - 7;
}

const plants = '<path d="M17 54Q9 43 16 29Q21 39 17 54M21 55Q24 42 31 36Q29 50 21 55M79 55Q86 41 81 32Q76 46 79 55" fill="none" stroke="#789f78" stroke-width="3" stroke-linecap="round"/><path d="M17 48Q9 46 10 39M23 49Q31 47 32 42" fill="none" stroke="#a4bc85" stroke-width="2"/>';
export function renderAquaticHabitat(location = 'home') {
    const habitat = getAquaticHabitat(location);
    if (habitat.kind === 'free' || habitat.nativeWater) return '';
    const [x, y, width, height] = habitat.box;
    const style = `left:${x / 3.2}%;top:${y / 2.4}%;width:${width / 3.2}%;height:${height / 2.4}%`;
    const back = habitat.kind === 'river' ? '' : habitat.kind === 'stream'
            ? '<path d="M1 28Q17 0 54 12T100 9V66H26Q2 62 1 28Z" fill="#8b9d78"/><path d="M5 29Q22 7 54 17T100 15V66H29Q7 60 5 29Z" fill="#8db9a8"/><path d="M13 26Q33 14 61 25T100 23M26 54Q59 43 100 51" fill="none" stroke="#c7dcc0" stroke-width="1.6"/>'
            : '<path d="M7 13Q23 1 52 7T94 19Q104 35 88 50T46 60Q17 63 6 47T7 13Z" fill="#8b9d78"/><path d="M10 16Q27 5 52 11T90 22Q98 36 84 48T46 56Q20 60 10 45T10 16Z" fill="#8db9a8"/><path d="M13 21Q34 12 59 16T88 27" fill="none" stroke="#bdd3b9" stroke-width="3"/><path d="M18 49Q44 56 73 46" fill="none" stroke="#a7ccba" stroke-width="3"/>';
    const front = '<path d="M14 38H26M47 26H58M73 39H84" stroke="#dfebce" stroke-width="1" opacity=".7"/>';
    const svg = art => `<svg viewBox="0 0 100 66" preserveAspectRatio="none" aria-hidden="true" focusable="false">${art}</svg>`;
    return `<span class="tf-aquatic-habitat is-${habitat.kind}" data-aquatic-location="${location}" style="${style}" aria-hidden="true">${svg(back + plants)}</span><span class="tf-aquatic-surface is-${habitat.kind}" style="${style}" aria-hidden="true">${svg(front)}</span>`;
}
