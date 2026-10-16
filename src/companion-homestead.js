import { advanceCompanionLife, canCareForCompanion, normalizeCompanionLife, recordCompanionCare } from './companion-life.js';

// The little world shares the ordinary inventory and uses persisted wall-clock
// deadlines. Rendering and save normalization never grant gifts or rewards.
const MINUTE = 60000;
const array = value => Array.isArray(value) ? value : [];
const timestamp = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(8640000000000000, Math.floor(Number(value)))) : 0;
const quantity = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(9999, Math.floor(Number(value)))) : 0;
const freezeList = entries => Object.freeze(entries.map(Object.freeze));

export const HOMESTEAD_LOCATIONS = freezeList([
    { id: 'home', name: '小窝', habitat: 'bedroom' },
    { id: 'yard', name: '庭院', habitat: 'garden' },
    { id: 'forest', name: '林间小径', habitat: 'forest' },
    { id: 'river', name: '河边', habitat: 'pond' },
    { id: 'kitchen', name: '小厨房', habitat: 'bedroom' },
]);

export const HOMESTEAD_PATHS = freezeList([
    ['home', 'yard'], ['yard', 'forest'], ['forest', 'river'], ['home', 'kitchen'],
]);

export const CROPS = freezeList([
    { id: 'carrot', name: '胡萝卜', seedId: 'carrot-seed', produceId: 'carrot', durationMs: 5 * MINUTE, yield: 3 },
    { id: 'turnip', name: '小萝卜', seedId: 'turnip-seed', produceId: 'turnip', durationMs: 10 * MINUTE, yield: 3 },
    { id: 'strawberry', name: '草莓', seedId: 'strawberry-seed', produceId: 'strawberry', durationMs: 15 * MINUTE, yield: 3 },
]);

const item = (id, name, kind, description, effect) => Object.freeze({ id, name, kind, description, effect, packRole: kind === 'food' ? 'food' : 'tool' });
export const PET_ITEMS = Object.freeze({
    'carrot-seed': item('carrot-seed', '胡萝卜种子', 'seed', '埋进庭院的空地，浇水后约 5 分钟成熟。', '用于庭院播种，不可喂食。'),
    'turnip-seed': item('turnip-seed', '小萝卜种子', 'seed', '埋进庭院的空地，浇水后约 10 分钟成熟。', '用于庭院播种，不可喂食。'),
    'strawberry-seed': item('strawberry-seed', '草莓种子', 'seed', '埋进庭院的空地，浇水后约 15 分钟成熟。', '用于庭院播种，不可喂食。'),
    carrot: item('carrot', '胡萝卜', 'food', '从自家菜地收获的脆甜胡萝卜。', '可以喂食、做便当，或用 1 份交换 2 包同种种子。'),
    turnip: item('turnip', '小萝卜', 'food', '洗净后圆滚滚的小萝卜。', '可以喂食、做便当，或用 1 份交换 2 包同种种子。'),
    strawberry: item('strawberry', '草莓', 'food', '亲手种出的红草莓，还带着清甜的香气。', '可以喂食、做便当，或用 1 份交换 2 包同种种子。'),
    berry: item('berry', '林间浆果', 'food', '从林间浆果丛采下的成熟小果子。', '可以喂食；两份浆果或作物可以做成一份便当。'),
    bento: item('bento', '手作便当', 'food', '用当天的收获装成的小小饭盒。', '可以喂食或装进行囊，出发时消耗一份并缩短行程。'),
    'vegetable-soup': item('vegetable-soup', '田园蔬菜汤', 'food', '胡萝卜和小萝卜煮成的暖暖浓汤。', '可以喂食或装进行囊，恢复饱腹和心情。'),
    'mushroom-stew': item('mushroom-stew', '蘑菇炖菜', 'food', '林间蘑菇和小萝卜炖成的小锅料理。', '可以喂食或装进行囊，恢复饱腹和心情。'),
    'grilled-fish': item('grilled-fish', '香烤河鱼', 'food', '用干净树枝生火，慢慢烤得外酥里嫩的河鱼。', '可以喂食或装进行囊，恢复饱腹和心情。'),
    'fish-rice': item('fish-rice', '田园鱼料理', 'food', '鲜鱼配上胡萝卜和蘑菇，装成一盘暖心料理。', '可以喂食或装进行囊，恢复更多饱腹和心情。'),
    'river-fish': item('river-fish', '溪流小鱼', 'ingredient', '从河里钓起的小鱼，先带回厨房做熟吧。', '烤鱼或田园鱼料理的食材，不可直接喂食。'),
    'silver-fish': item('silver-fish', '银鳞鱼', 'ingredient', '银色鳞片像河面的碎光，适合做成鱼料理。', '烤鱼或田园鱼料理的食材，不可直接喂食。'),
    'golden-fish': item('golden-fish', '金尾鱼', 'ingredient', '偶尔才会遇见的金尾小鱼，可以珍藏也可以烹饪。', '烤鱼或田园鱼料理的食材，不可直接喂食。'),
    'fishing-rod': item('fishing-rod', '竹制钓竿', 'tool', '河边备好的小竹竿，可以一直重复使用。', '在河边抛竿，等浮漂动起来再收竿，不消耗。'),
    shovel: item('shovel', '小铲子', 'tool', '木柄圆头的小铲子，可以一直重复使用。', '庭院播种时使用，不消耗。'),
    'watering-can': item('watering-can', '小水壶', 'tool', '能从院中水缸取水的小水壶，可以一直重复使用。', '为作物浇水并开始生长，不消耗。'),
    branch: item('branch', '柔韧树枝', 'material', '捡起的一小段干净树枝。', '收纳在背包里的林间材料，可以作为旅行随身物。'),
    mushroom: item('mushroom', '香香蘑菇', 'food', '小世界中可以食用的圆帽蘑菇。', '可以喂食，或装进行囊。'),
    reed: item('reed', '河岸芦苇', 'material', '河岸边采来的柔软芦苇。', '收纳在背包里的河岸材料，可以作为旅行随身物。'),
    stone: item('stone', '圆润石子', 'material', '溪水磨圆的小石子。', '收纳在背包里的河岸材料，可以作为旅行随身物。'),
});

const BENTO_INGREDIENTS = Object.freeze(['berry', ...CROPS.map(crop => crop.produceId)]);
const FISH_ITEMS = Object.freeze(['river-fish', 'silver-fish', 'golden-fish']);
const ingredient = (itemId, amount = 1, alternatives) => Object.freeze({ itemId, quantity: amount, ...(alternatives ? { alternatives } : {}) });
export const RECIPES = freezeList([
    { id: 'bento', name: '手作便当', description: '任选两份浆果或菜园收获，装进小饭盒。', ingredients: Object.freeze([]), flexible: true, outputId: 'bento', quantity: 1 },
    { id: 'vegetable-soup', name: '田园蔬菜汤', description: '两种根菜一起慢煮，盛一碗热乎乎的汤。', ingredients: Object.freeze([ingredient('carrot'), ingredient('turnip')]), outputId: 'vegetable-soup', quantity: 1 },
    { id: 'mushroom-stew', name: '蘑菇炖菜', description: '小萝卜与林间蘑菇煨成一锅鲜香炖菜。', ingredients: Object.freeze([ingredient('mushroom', 2), ingredient('turnip')]), outputId: 'mushroom-stew', quantity: 1 },
    { id: 'grilled-fish', name: '香烤河鱼', description: '任选一条鱼，用一根干净树枝生火烤香。', ingredients: Object.freeze([ingredient('river-fish', 1, FISH_ITEMS), ingredient('branch')]), outputId: 'grilled-fish', quantity: 1 },
    { id: 'fish-rice', name: '田园鱼料理', description: '任选一条鱼，配上胡萝卜和蘑菇做成一盘料理。', ingredients: Object.freeze([ingredient('river-fish', 1, FISH_ITEMS), ingredient('carrot'), ingredient('mushroom')]), outputId: 'fish-rice', quantity: 1 },
]);

export const RESOURCE_NODES = freezeList([
    { id: 'berry-bush', location: 'forest', itemId: 'berry', quantity: 2, cooldownMs: 3 * MINUTE, name: '浆果丛', x: 65, y: 164 },
    { id: 'fallen-branch', location: 'forest', itemId: 'branch', quantity: 1, cooldownMs: 4 * MINUTE, name: '落枝', x: 160, y: 204 },
    { id: 'mushroom-patch', location: 'forest', itemId: 'mushroom', quantity: 1, cooldownMs: 5 * MINUTE, name: '蘑菇圈', x: 255, y: 164 },
    { id: 'reed-bed', location: 'river', itemId: 'reed', quantity: 2, cooldownMs: 4 * MINUTE, name: '芦苇丛', x: 65, y: 164 },
    { id: 'river-stones', location: 'river', itemId: 'stone', quantity: 2, cooldownMs: 5 * MINUTE, name: '浅滩石子', x: 160, y: 204 },
    { id: 'driftwood', location: 'river', itemId: 'branch', quantity: 1, cooldownMs: 4 * MINUTE, name: '漂流木', x: 255, y: 164 },
]);

const emptyPlot = id => ({ id, cropId: '', plantedAt: 0, wateredAt: 0, readyAt: 0 });
const cropById = id => CROPS.find(crop => crop.id === id);
const locationById = id => HOMESTEAD_LOCATIONS.find(location => location.id === id);

export function normalizeHomestead(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const location = locationById(source.location)?.id || 'home';
    const visited = [...new Set(['home', ...array(source.visited).filter(id => locationById(id)), location])];
    const plots = Array.from({ length: 6 }, (_, index) => {
        const id = `plot-${index + 1}`, sourcePlot = array(source.plots).find(plot => plot?.id === id);
        const crop = cropById(sourcePlot?.cropId), plantedAt = timestamp(sourcePlot?.plantedAt);
        if (!crop || !plantedAt) return emptyPlot(id);
        const rawWatered = timestamp(sourcePlot.wateredAt);
        const wateredAt = rawWatered > 0 ? Math.max(plantedAt, rawWatered) : 0;
        const rawReady = timestamp(sourcePlot.readyAt);
        const readyAt = wateredAt ? (rawReady > wateredAt ? rawReady : wateredAt + crop.durationMs) : 0;
        return { id, cropId: crop.id, plantedAt, wateredAt, readyAt };
    });
    const nodes = Object.fromEntries(RESOURCE_NODES.map(node => [node.id, timestamp(source.nodes?.[node.id])]));
    const rawFishing = source.fishing && typeof source.fishing === 'object' ? source.fishing : {};
    const startedAt = timestamp(rawFishing.startedAt), biteAt = timestamp(rawFishing.biteAt), endsAt = timestamp(rawFishing.endsAt);
    const fishing = location === 'river' && typeof rawFishing.id === 'string' && rawFishing.id.length > 0 && rawFishing.id.length <= 160
        && startedAt > 0 && biteAt >= startedAt + 4000 && biteAt <= startedAt + 7000 && endsAt === biteAt + 6000 && FISH_ITEMS.includes(rawFishing.fishId)
        ? { id: rawFishing.id, startedAt, biteAt, endsAt, fishId: rawFishing.fishId } : null;
    return { location, visited, starterGranted: source.starterGranted === true, plots, nodes,
        fishingKitGranted: source.fishingKitGranted === true, fishingReadyAt: timestamp(source.fishingReadyAt), fishing };
}

function traveling(data, inventoryId) {
    return array(data?.world?.trips).some(trip => trip?.status === 'away'
        && array(trip.packingItems).some(entry => entry?.id === inventoryId && !entry.consumed));
}

function availableRows(data, itemId) {
    return array(data?.world?.inventory).filter(entry => entry?.petItemId === itemId
        && !entry.consumed && entry.usable !== false && quantity(entry.quantity) > 0 && !traveling(data, entry.id));
}

export function getPetItemCount(data, itemId) {
    if (!Object.hasOwn(PET_ITEMS, itemId)) return 0;
    return availableRows(data, itemId).reduce((total, entry) => total + quantity(entry.quantity), 0);
}

export function getRecipeView(data, recipeId, now = Date.now()) {
    const recipe = RECIPES.find(entry => entry.id === recipeId) || null;
    if (!recipe) return { recipe: null, ingredients: [], canCook: false, reason: '还没有学会这道料理' };
    const ingredients = recipe.flexible
        ? [{ itemId: 'berry', name: '浆果或收获的作物', quantity: 2, available: BENTO_INGREDIENTS.reduce((total, id) => total + getPetItemCount(data, id), 0) }]
        : recipe.ingredients.map(entry => {
            const itemId = entry.alternatives?.find(id => getPetItemCount(data, id) >= entry.quantity) || entry.itemId;
            return { ...entry, itemId, name: PET_ITEMS[itemId].name, available: getPetItemCount(data, itemId) };
        });
    let reason = '';
    if (!data?.world?.companion) reason = '请先打开旅伴的小窝';
    else if (data.world.companion.homestead?.location !== 'kitchen') reason = '先走到小厨房再做这件事吧';
    else reason = canCareForCompanion(data.world.companion, 'play', now);
    if (!reason) {
        const missing = ingredients.filter(entry => entry.available < entry.quantity);
        if (missing.length) reason = `还缺${missing.map(entry => `${entry.quantity - entry.available} 份${entry.name}`).join('、')}`;
    }
    if (!reason) {
        try { addItem(workingCopy(data, now), recipe.outputId, recipe.quantity, now); }
        catch (error) { reason = error.message; }
    }
    return { recipe, ingredients, canCook: !reason, reason };
}

function workingCopy(data, now) {
    if (!data?.world?.companion) throw new Error('请先打开旅伴的小窝');
    const companion = data.world.companion;
    const life = { ...companion.life, game: companion.life?.game ? structuredClone(companion.life.game) : null };
    return { world: { ...data.world, inventory: array(data.world.inventory).map(entry => ({ ...entry })), companion: {
        ...companion, homestead: normalizeHomestead(companion.homestead), life: normalizeCompanionLife(life, now),
    } } };
}

function commit(data, work) {
    Object.assign(data.world.companion, work.world.companion);
    data.world.inventory = work.world.inventory;
}

function addItem(data, itemId, amount, now) {
    const definition = PET_ITEMS[itemId];
    let remaining = amount;
    const existing = data.world.inventory.filter(entry => entry.petItemId === itemId && entry.usable !== false && !traveling(data, entry.id));
    for (const entry of existing) {
        const count = entry.consumed ? 0 : quantity(entry.quantity);
        const added = Math.min(9999 - count, remaining);
        if (!added) continue;
        entry.quantity = count + added;
        entry.consumed = false;
        entry.updatedAt = now;
        remaining -= added;
        if (!remaining) return;
    }
    if (data.world.inventory.length >= 300) throw new Error('背包已经装满了，先整理一些物品再来吧');
    const prefix = `pet-${itemId}-${now.toString(36)}`;
    let id = prefix, suffix = 0;
    while (data.world.inventory.some(entry => entry.id === id)) id = `${prefix}-${++suffix}`;
    data.world.inventory.push({ id, petItemId: itemId, name: definition.name, description: definition.description,
        quantity: remaining, effect: definition.effect, source: '小窝生活', usable: true, consumed: false, createdAt: now, updatedAt: now });
}

export function addPetItem(data, itemId, amount = 1, now = Date.now()) {
    if (!Object.hasOwn(PET_ITEMS, itemId)) throw new Error('没有找到这种物品');
    if (!Number.isInteger(amount) || amount < 1 || amount > 9999) throw new Error('物品数量应为 1 到 9999 之间的整数');
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at);
    addItem(work, itemId, amount, at);
    commit(data, work);
    return { changed: true, message: `收好了 ${amount} 份${PET_ITEMS[itemId].name}` };
}

function requireItem(data, itemId, amount = 1) {
    const definition = PET_ITEMS[itemId];
    if (!definition) throw new Error('没有找到这种物品');
    if (getPetItemCount(data, itemId) >= amount) return;
    if (data.world.inventory.some(entry => entry.petItemId === itemId && traveling(data, entry.id))) {
        throw new Error(`${definition.name}正随旅伴旅行，返家后才能使用`);
    }
    throw new Error(`${definition.name}不足，需要 ${amount} 份`);
}

function consumeItem(data, itemId, amount, now) {
    requireItem(data, itemId, amount);
    let remaining = amount;
    for (const entry of availableRows(data, itemId)) {
        const consumed = Math.min(quantity(entry.quantity), remaining);
        entry.quantity = quantity(entry.quantity) - consumed;
        entry.consumed = entry.quantity === 0;
        entry.updatedAt = now;
        remaining -= consumed;
        if (!remaining) break;
    }
}

export function ensureHomesteadStarter(data, now = Date.now()) {
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at);
    if (work.world.companion.homestead.starterGranted) return { changed: false, message: '' };
    for (const crop of CROPS) addItem(work, crop.seedId, 2, at);
    for (const itemId of ['shovel', 'watering-can', 'bento']) addItem(work, itemId, 1, at);
    work.world.companion.homestead.starterGranted = true;
    commit(data, work);
    return { changed: true, message: '柜子里收好了三种种子、小铲子、小水壶和一份便当。一起出门看看吧。' };
}

export function ensureFishingKit(data, now = Date.now()) {
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at);
    requireActive(work, at);
    const homestead = work.world.companion.homestead;
    if (homestead.fishingKitGranted) return { changed: false, message: '竹制钓竿已经领过了，可以反复使用。' };
    if (homestead.location !== 'river') throw new Error('先走到河边领取钓竿吧');
    if (!getPetItemCount(work, 'fishing-rod')) addItem(work, 'fishing-rod', 1, at);
    homestead.fishingKitGranted = true;
    return finish(data, work, at, '收好了一根竹制钓竿。抛竿后等浮漂动起来，再及时收竿吧。');
}

export function getFishingView(companion, now = Date.now()) {
    const homestead = normalizeHomestead(companion?.homestead), at = timestamp(now), fishing = homestead.fishing;
    if (fishing) {
        if (at < fishing.biteAt) return { phase: 'waiting', remainingMs: fishing.biteAt - at, castId: fishing.id };
        if (at <= fishing.endsAt) return { phase: 'bite', remainingMs: Math.max(0, fishing.endsAt - at), castId: fishing.id };
        return { phase: 'escaped', remainingMs: 0, castId: fishing.id };
    }
    if (homestead.fishingReadyAt > at) return { phase: 'cooldown', remainingMs: homestead.fishingReadyAt - at, castId: '' };
    return { phase: 'idle', remainingMs: 0, castId: '' };
}

export function castHomesteadLine(data, now = Date.now(), random = Math.random) {
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at), homestead = work.world.companion.homestead;
    requireActive(work, at);
    if (homestead.location !== 'river') throw new Error('先走到河边再抛竿吧');
    requireItem(work, 'fishing-rod');
    const view = getFishingView(work.world.companion, at);
    if (['waiting', 'bite'].includes(view.phase)) throw new Error('鱼线已经在水里了，留意浮漂再收竿吧');
    if (view.phase === 'cooldown') throw new Error('先收好鱼线，稍等片刻就能再次抛竿');
    const roll = () => { const value = Number(random()); return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .5; };
    const waitMs = 4000 + Math.floor(roll() * 3000), fishRoll = roll();
    const fishId = fishRoll < .65 ? 'river-fish' : fishRoll < .93 ? 'silver-fish' : 'golden-fish';
    const castId = `cast-${at.toString(36)}-${waitMs}-${fishId}`;
    homestead.fishing = { id: castId, startedAt: at, biteAt: at + waitMs, endsAt: at + waitMs + 6000, fishId };
    homestead.fishingReadyAt = at + 3000;
    return { ...finish(data, work, at, '鱼线轻轻落进水里，等浮漂动起来再收竿。'), castId };
}

export function reelHomesteadFish(data, castId, now = Date.now()) {
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at), homestead = work.world.companion.homestead;
    requireActive(work, at);
    if (homestead.location !== 'river') throw new Error('先走到河边再收竿吧');
    const fishing = homestead.fishing;
    if (!fishing || fishing.id !== castId) return { changed: false, caught: false, message: '这次鱼线已经收好了，重新抛竿试试吧。' };
    const caught = at >= fishing.biteAt && at <= fishing.endsAt;
    if (caught) addItem(work, fishing.fishId, 1, at);
    homestead.fishing = null;
    homestead.fishingReadyAt = Math.max(homestead.fishingReadyAt, at + 3000);
    const message = caught ? `钓到了一条${PET_ITEMS[fishing.fishId].name}！收进背包，带回厨房做料理吧。`
        : at < fishing.biteAt ? '收竿有点早，鱼儿还没咬钩。休息一下再试试吧。' : '鱼儿已经游走了，下次浮漂动起来就及时收竿吧。';
    return { ...finish(data, work, at, message), caught, ...(caught ? { itemId: fishing.fishId } : {}) };
}

export function cancelHomesteadFishing(data, castId, now = Date.now()) {
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at), homestead = work.world.companion.homestead;
    if (!homestead.fishing || homestead.fishing.id !== castId) return { changed: false, message: '' };
    homestead.fishing = null;
    homestead.fishingReadyAt = Math.max(homestead.fishingReadyAt, at + 1500);
    return finish(data, work, at, '轻轻收好鱼线，想钓鱼时再来吧。');
}

export function getCropView(plot, now = Date.now()) {
    const crop = cropById(plot?.cropId);
    const base = { crop: crop || null, cropId: crop?.id || '', name: crop?.name || '空地', remainingMs: 0, progress: 0 };
    if (!crop || !timestamp(plot?.plantedAt)) return { ...base, stage: 'empty' };
    if (!timestamp(plot.wateredAt) || !timestamp(plot.readyAt)) return { ...base, stage: 'dry' };
    const at = timestamp(now), remainingMs = Math.max(0, timestamp(plot.readyAt) - at);
    const duration = Math.max(1, timestamp(plot.readyAt) - timestamp(plot.wateredAt));
    const progress = Math.min(1, Math.max(0, 1 - remainingMs / duration));
    return { ...base, remainingMs, progress, stage: remainingMs === 0 ? 'ready' : progress < .35 ? 'sprout' : 'growing' };
}

function requireActive(work, now) {
    const blocked = canCareForCompanion(work.world.companion, 'play', now);
    if (blocked) throw new Error(blocked);
}

function finish(data, work, now, message) {
    work.world.companion.message = message;
    work.world.companion.lastInteractionAt = now;
    work.world.companion.updatedAt = now;
    commit(data, work);
    return { changed: true, message };
}

export function changeHomesteadLocation(data, id, now = Date.now()) {
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at);
    requireActive(work, at);
    const destination = locationById(id), homestead = work.world.companion.homestead;
    if (!destination) throw new Error('这条小路还没有开放');
    if (homestead.location === id) return { changed: false, message: `已经在${destination.name}了` };
    if (!HOMESTEAD_PATHS.some(path => path.includes(homestead.location) && path.includes(id))) throw new Error('沿着相邻的小路一步步走过去吧');
    homestead.location = id;
    homestead.fishing = null;
    if (!homestead.visited.includes(id)) homestead.visited.push(id);
    advanceCompanionLife(work.world.companion, at);
    return finish(data, work, at, id === 'home' ? '回到暖暖的小窝，把今天的收获收拾好。' : `沿着小路来到${destination.name}。`);
}

export function performHomesteadAction(data, action, options = {}, now = Date.now()) {
    const at = Math.max(1, timestamp(now)), work = workingCopy(data, at);
    const companion = work.world.companion, homestead = companion.homestead;
    requireActive(work, at);
    const requireLocation = id => {
        if (homestead.location !== id) throw new Error(`先走到${locationById(id).name}再做这件事吧`);
    };
    const requireIndoor = () => {
        if (!['home', 'kitchen'].includes(homestead.location)) throw new Error('先回小窝或小厨房再做这件事吧');
    };
    const selectedPlot = () => {
        requireLocation('yard');
        const plot = homestead.plots.find(entry => entry.id === options?.plotId);
        if (!plot) throw new Error('请先选一块菜地');
        return plot;
    };
    let message = '';
    if (action === 'plant') {
        const plot = selectedPlot(), crop = cropById(options?.cropId);
        if (!crop) throw new Error('请先选一种种子');
        if (plot.cropId) throw new Error('这块地已经种下作物了');
        requireItem(work, 'shovel');
        consumeItem(work, crop.seedId, 1, at);
        Object.assign(plot, { cropId: crop.id, plantedAt: at, wateredAt: 0, readyAt: 0 });
        message = `把${crop.name}种子埋进土里了，再浇一点水吧。`;
    } else if (action === 'water') {
        const plot = selectedPlot(), crop = cropById(plot.cropId);
        if (!crop) throw new Error('这块地还没有播种');
        if (plot.wateredAt) return { changed: false, message: getCropView(plot, at).stage === 'ready' ? '作物已经成熟，可以收获了' : '泥土还是湿润的，等它慢慢长大吧' };
        requireItem(work, 'watering-can');
        plot.wateredAt = at;
        plot.readyAt = at + crop.durationMs;
        message = `给${crop.name}浇好了水，约 ${crop.durationMs / MINUTE} 分钟后就能收获。`;
    } else if (action === 'harvest') {
        const plot = selectedPlot(), view = getCropView(plot, at);
        if (view.stage !== 'ready') throw new Error(view.stage === 'empty' ? '这块地还没有可以收获的作物' : view.stage === 'dry' ? '先给作物浇水，它才会开始生长' : '作物还在慢慢长大，再等等吧');
        addItem(work, view.crop.produceId, view.crop.yield, at);
        Object.assign(plot, emptyPlot(plot.id));
        message = `收获了 ${view.crop.yield} 份${view.crop.name}，已经放进背包。`;
    } else if (action === 'gather') {
        const node = RESOURCE_NODES.find(entry => entry.id === options?.nodeId);
        if (!node) throw new Error('这里没有可以采集的东西');
        requireLocation(node.location);
        if (homestead.nodes[node.id] > at) throw new Error('这里刚刚采集过，过一会儿再来看看吧');
        addItem(work, node.itemId, node.quantity, at);
        homestead.nodes[node.id] = at + node.cooldownMs;
        message = `采到了 ${node.quantity} 份${PET_ITEMS[node.itemId].name}，已经放进背包。`;
    } else if (action === 'cook') {
        const legacyBento = !options?.recipeId, recipeId = legacyBento ? 'bento' : options.recipeId;
        requireLocation(legacyBento ? 'home' : 'kitchen');
        const recipe = RECIPES.find(entry => entry.id === recipeId);
        if (!recipe) throw new Error('还没有学会这道料理');
        if (recipe.flexible) {
            if (options?.itemId && !BENTO_INGREDIENTS.includes(options.itemId)) throw new Error('选两份浆果或收获的作物来做便当吧');
            const choices = options?.itemId ? [options.itemId] : BENTO_INGREDIENTS;
            if (choices.reduce((count, itemId) => count + getPetItemCount(work, itemId), 0) < 2) throw new Error('做一份便当需要两份浆果或收获的作物，先去采集或收菜吧');
            let remaining = 2;
            for (const itemId of choices) {
                const amount = Math.min(remaining, getPetItemCount(work, itemId));
                if (amount) consumeItem(work, itemId, amount, at);
                remaining -= amount;
                if (!remaining) break;
            }
        } else {
            const view = getRecipeView(work, recipe.id, at);
            if (!view.canCook) throw new Error(view.reason);
            for (const entry of view.ingredients) consumeItem(work, entry.itemId, entry.quantity, at);
        }
        addItem(work, recipe.outputId, recipe.quantity, at);
        message = recipe.flexible ? '把两份收获仔细装好，做成了一份手作便当。' : `做好了一份${recipe.name}，已经放进背包。趁热尝尝吧。`;
    } else if (action === 'exchange') {
        requireIndoor();
        const crop = cropById(options?.cropId);
        if (!crop) throw new Error('选一种收获来换种子吧');
        consumeItem(work, crop.produceId, 1, at);
        addItem(work, crop.seedId, 2, at);
        message = `用一份${crop.name}换回两包种子，明天也有期待了。`;
    } else if (action === 'feed') {
        requireIndoor();
        const food = Object.hasOwn(PET_ITEMS, options?.itemId) ? PET_ITEMS[options.itemId] : null;
        if (food?.kind !== 'food') throw new Error(food?.kind === 'ingredient' ? '生鱼不能喂食，先去小厨房做成料理吧' : '种子、工具和材料不能喂食，请选一份食物');
        consumeItem(work, food.id, 1, at);
        advanceCompanionLife(companion, at);
        const mealSatiety = { bento: 24, 'vegetable-soup': 24, 'mushroom-stew': 28, 'grilled-fish': 28, 'fish-rice': 32 };
        companion.satiety = Math.min(100, Number(companion.satiety || 0) + (mealSatiety[food.id] || 16));
        companion.energy = Math.min(100, Number(companion.energy || 0) + 4);
        companion.happiness = Math.min(100, Number(companion.happiness || 0) + 8);
        if (recordCompanionCare(companion, 'feed', { now: at, food: { id: `inventory:${food.name}`, name: food.name } })) companion.bond = Math.min(100, Number(companion.bond || 0) + 1);
        companion.lastFood = food.name;
        companion.lastAction = 'feed';
        companion.mood = '满足';
        message = `尝了尝亲手准备的${food.name}，开心地靠了过来。`;
    } else throw new Error('还没有学会这个小窝活动');
    advanceCompanionLife(companion, at);
    return finish(data, work, at, message);
}
