import { createArcadeGame, normalizeArcadeGame, advanceArcadeGame, arcadeInput, arcadeFrame } from './companion-games.js';
// Local pet simulation. No model requests, wall-clock intervals, or DOM dependencies.
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim().slice(0, 240) : '';
const number = (value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const keyOfDay = now => { const date = new Date(now); return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; };
const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const STAGES = ['baby', 'young', 'adult'];
export const PET_STAGES = { baby: '幼年', young: '少年', adult: '成年' };
export const PET_PERSONALITIES = { lively: '活泼', curious: '好奇', calm: '安稳', affectionate: '亲人' };
export const PET_GAMES = [
    { id: 'catch', name: '接星星', stage: 'baby', symbol: '★', note: '拖动或按住左右移动，连续接星星；确认键使用磁铁，避开雨滴。' },
    { id: 'memory', name: '记方向', stage: 'young', symbol: '◇', note: '记住整组亮灯顺序，再依次轻点或按左、中、右；每轮加长。' },
    { id: 'dodge', name: '躲雨滴', stage: 'adult', symbol: '☂', note: '连续移动穿过雨阵，收集晴天光点；确认键开启短暂护盾。' },
];
export const PET_SHOP = [
    { id: 'snack', name: '口袋点心', cost: 8, symbol: '●', kind: 'food' },
    { id: 'ball', name: '彩色皮球', cost: 16, symbol: '◉', kind: 'toy' },
    { id: 'blocks', name: '木头积木', cost: 20, symbol: '▦', kind: 'toy' },
    { id: 'cushion', name: '软软坐垫', cost: 24, symbol: '▰', kind: 'furniture' },
    { id: 'lamp', name: '星星夜灯', cost: 30, symbol: '✦', kind: 'furniture' },
];

export function normalizeCompanionLife(value, now = Date.now()) {
    const life = value && typeof value === 'object' ? value : {};
    const counts = values => Object.fromEntries(Object.entries(values || {}).slice(-30).map(([key, value]) => [key, number(value, 0, 0, 10000)]));
    return {
        startedAt: number(life.startedAt, now), lastTickAt: number(life.lastTickAt, now),
        mode: ['active', 'paused', 'daycare'].includes(life.mode) ? life.mode : 'active',
        cleanliness: number(life.cleanliness, 85, 0, 100), sleepStart: Math.floor(number(life.sleepStart, 22, 0, 23)), sleepEnd: Math.floor(number(life.sleepEnd, 8, 0, 23)),
        autoSleep: life.autoSleep !== false, awakeUntil: number(life.awakeUntil, 0), sleepUntil: number(life.sleepUntil, 0),
        growthMinutes: number(life.growthMinutes, 0), stage: STAGES.includes(life.stage) ? life.stage : 'baby',
        careDays: [...new Set(list(life.careDays).map(String))].slice(-90),
        traits: Object.fromEntries(Object.keys(PET_PERSONALITIES).map(key => [key, number(life.traits?.[key], 0, 0, 10000)])),
        actionAt: Object.fromEntries(Object.entries(life.actionAt || {}).slice(-30).map(([key, at]) => [key, number(at, 0)])), foodLikes: list(life.foodLikes).filter(item => text(item?.id)).slice(-16).map(item => ({ id: text(item.id), name: text(item.name), count: number(item.count, 0, 0, 999) })),
        toyLikes: counts(life.toyLikes), accessoryLikes: counts(life.accessoryLikes),
        remainders: Object.fromEntries(['satiety', 'energy', 'happiness', 'cleanliness'].map(key => [key, number(life.remainders?.[key], 0, -1, 1)])),
        diary: list(life.diary).filter(item => item?.id && text(item.text)).slice(-60).map(item => ({ id: text(item.id), text: text(item.text), at: number(item.at, now) })),
        milestones: [...new Set(list(life.milestones).map(String))].slice(-40),
        coins: Math.floor(number(life.coins, 0, 0, 9999)), rewardDay: text(life.rewardDay), dailyCoins: number(life.dailyCoins, 0, 0, 30),
        owned: [...new Set(list(life.owned).filter(key => PET_SHOP.some(item => item.id === key && item.kind !== 'food')))],
        furniture: PET_SHOP.some(item => item.kind === 'furniture' && item.id === life.furniture) ? life.furniture : '',
        displayItemId: text(life.displayItemId), game: normalizeGame(life.game), lastGameAt: number(life.lastGameAt, 0),
        gameRecords: Object.fromEntries(PET_GAMES.map(({ id }) => [id, { best: number(life.gameRecords?.[id]?.best, 0, 0, 100000), plays: number(life.gameRecords?.[id]?.plays, 0, 0, 100000), combo: number(life.gameRecords?.[id]?.combo, 0, 0, 1000) }])),
        lastGameResult: life.lastGameResult && PET_GAMES.some(item => item.id === life.lastGameResult.kind) ? { id: text(life.lastGameResult.id), kind: life.lastGameResult.kind, score: number(life.lastGameResult.score, 0, 0, 100000), combo: number(life.lastGameResult.combo, 0, 0, 1000), coins: number(life.lastGameResult.coins, 0, 0, 10), best: Boolean(life.lastGameResult.best) } : null,
    };
}

function normalizeGame(game) {
    const normalized = normalizeArcadeGame(game);
    if (!normalized) return null;
    // Keep the active simulation reference alive when the forum data is normalized.
    const particles = Array.isArray(game.particles) ? game.particles.slice(-35).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx) && Number.isFinite(p.vy) && Number.isFinite(p.ttl) && p.ttl > 0 && p.ttl <= 500) : [];
    return Object.assign(game, normalized, { particles });
}

function ensure(companion, now) {
    companion.life ||= normalizeCompanionLife(null, now);
    return companion.life;
}

export function addCompanionMilestone(companion, key, message, now = Date.now()) {
    const life = ensure(companion, now);
    if (life.milestones.includes(key)) return false;
    life.milestones.push(key); life.diary.push({ id: id('pet-note'), text: message, at: now }); life.diary = life.diary.slice(-60);
    return true;
}

export function getCompanionLifeView(companion, now = Date.now()) {
    const life = companion.life || normalizeCompanionLife(null, now);
    const hour = new Date(now).getHours();
    const night = life.autoSleep && life.sleepStart !== life.sleepEnd && (life.sleepStart < life.sleepEnd ? hour >= life.sleepStart && hour < life.sleepEnd : hour >= life.sleepStart || hour < life.sleepEnd);
    const away = companion.status === 'away';
    const sleeping = !away && life.mode === 'active' && (life.sleepUntil > now || (night && life.awakeUntil <= now));
    const trait = Object.entries(life.traits).sort((a, b) => b[1] - a[1])[0];
    const personality = trait?.[1] >= 3 ? PET_PERSONALITIES[trait[0]] : '正在形成';
    const favoriteFood = [...life.foodLikes].filter(item => item.count >= 3).sort((a, b) => b.count - a.count)[0];
    const favoriteToy = Object.entries(life.toyLikes).filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    let activity = 'idle', message = '';
    if (away) { activity = 'away'; message = companion.message; }
    else if (life.mode === 'paused') { activity = 'paused'; message = '养成已暂停，回来时会从这里继续。'; }
    else if (life.mode === 'daycare') { activity = 'daycare'; message = `${companion.name}正在托管小屋里安心生活。`; }
    else if (sleeping) { activity = 'sleep'; message = `${companion.name}缩在小窝里睡着了，梦里似乎还有今天的见闻。`; }
    else if (companion.satiety < 30) { activity = 'hungry'; message = `${companion.name}把小碗推到你面前，正等着开饭。`; }
    else if (life.cleanliness < 35) { activity = 'dirty'; message = `${companion.name}蹭了蹭身上的灰，想洗个澡、整理小窝。`; }
    else if (companion.energy < 25) { activity = 'tired'; message = `${companion.name}打着哈欠，想找个软软的地方休息。`; }
    else if (companion.happiness < 40) { activity = 'lonely'; message = `${companion.name}把玩具放到一边，靠过来想让你陪一会儿。`; }
    else if (now - Number(companion.lastInteractionAt || 0) < 30000) { activity = 'reaction'; message = companion.message; }
    else {
        const moment = Math.floor(now / (5 * MINUTE));
        activity = trait?.[1] >= 3 && moment % 2 === 0 ? { lively: 'toy', curious: 'look', calm: 'nap', affectionate: 'cuddle' }[trait[0]] : ['look', 'toy', 'nap'][moment % 3];
        message = activity === 'look' ? `${companion.name}正在窗边张望，对小窝外的声音很好奇。`
            : activity === 'toy' ? `${companion.name}${favoriteToy ? '抱着最喜欢的玩具' : '推来一只小皮球'}，偷偷看你有没有空。`
                : activity === 'cuddle' ? `${companion.name}悄悄挪到你身边，把脑袋靠过来，想和你多待一会儿。`
                : `${companion.name}舒舒服服地趴着，尾巴偶尔轻轻动一下。`;
    }
    return { life, sleeping, activity, message, personality, favoriteFood, favoriteToy, stage: life.stage, stageLabel: PET_STAGES[life.stage] };
}

function grow(companion, now) {
    const life = companion.life;
    const stage = life.growthMinutes >= 2880 && life.careDays.length >= 4 ? 'adult' : life.growthMinutes >= 720 && life.careDays.length >= 2 ? 'young' : 'baby';
    if (STAGES.indexOf(stage) > STAGES.indexOf(life.stage)) {
        life.stage = stage;
        addCompanionMilestone(companion, `stage-${stage}`, `一起生活的日子里，${companion.name}进入了${PET_STAGES[stage]}，学会了新的游戏。`, now);
    }
}

export function advanceCompanionLife(companion, now = Date.now()) {
    const life = ensure(companion, now);
    if (now <= life.lastTickAt || now - life.lastTickAt < MINUTE) return false;
    // Ignore unbounded offline decay and clock rollback. Reopening never simulates more than eight hours.
    const start = Math.max(life.lastTickAt, now - 8 * HOUR);
    life.lastTickAt = now;
    if (life.mode === 'paused') return true;
    life.growthMinutes += (now - start) / MINUTE;
    if (life.mode !== 'daycare' && companion.status !== 'away') {
        for (let at = start; at < now; at += 5 * MINUTE) {
            const hours = Math.min(5 * MINUTE, now - at) / HOUR;
            const sleeping = getCompanionLifeView(companion, at).sleeping;
            const rates = { satiety: sleeping ? -.8 : -2, energy: sleeping ? 12 : -3, happiness: sleeping ? 0 : -1, cleanliness: sleeping ? -1 : -3 };
            for (const [key, rate] of Object.entries(rates)) {
                const total = life.remainders[key] + rate * hours, change = Math.trunc(total + Math.sign(total) * 1e-9);
                life.remainders[key] = total - change;
                const holder = key === 'cleanliness' ? life : companion;
                const current = Number(holder[key] ?? 75);
                holder[key] = change < 0 ? Math.min(current, Math.max(10, current + change)) : Math.min(100, current + change);
            }
        }
        companion.status = getCompanionLifeView(companion, now).sleeping ? 'resting' : 'home';
    }
    grow(companion, now);
    companion.updatedAt = now;
    return true;
}

export function canCareForCompanion(companion, action, now = Date.now()) {
    const view = getCompanionLifeView(companion, now);
    if (companion.status === 'away') return '旅伴还在旅行，返家后再一起互动吧';
    if (view.life.mode !== 'active') return '请先结束暂停或托管';
    if (view.life.game && action !== 'game') return '先结束这一局小游戏吧';
    if (view.sleeping && !['rest', 'wake'].includes(action)) return '它正在睡觉，可以等它醒来，或轻轻叫醒';
    return '';
}

export function recordCompanionCare(companion, action, { now = Date.now(), food = null, toy = '' } = {}) {
    const life = ensure(companion, now);
    if (life.mode !== 'active') return false;
    const previous = life.actionAt[action] || 0;
    const rewarded = !previous || now - previous >= (action === 'feed' ? 10 : 5) * MINUTE;
    if (!rewarded) return false;
    life.actionAt[action] = now;
    const day = keyOfDay(now); if (!life.careDays.includes(day)) life.careDays.push(day);
    const trait = ['play', 'dance', 'hide', 'game'].includes(action) ? 'lively' : ['train', 'trip'].includes(action) ? 'curious' : ['rest', 'clean', 'brush', 'feed'].includes(action) ? 'calm' : 'affectionate';
    life.traits[trait] = Math.min(10000, life.traits[trait] + 1);
    if (food) {
        let preference = life.foodLikes.find(item => item.id === food.id);
        if (!preference) { preference = { id: text(food.id), name: text(food.name), count: 0 }; life.foodLikes.push(preference); }
        preference.count++; life.foodLikes = life.foodLikes.slice(-16);
        if (preference.count === 3) addCompanionMilestone(companion, `food-${food.id}`, `${companion.name}渐渐喜欢上了${food.name}，下次开饭会更期待。`, now);
    }
    if (toy) life.toyLikes[toy] = (life.toyLikes[toy] || 0) + 1;
    if (action === 'dress' && companion.accessory && companion.accessory !== 'none') life.accessoryLikes[companion.accessory] = (life.accessoryLikes[companion.accessory] || 0) + 1;
    addCompanionMilestone(companion, 'first-care', `第一次照顾${companion.name}，一起生活的记录从今天开始。`, now);
    grow(companion, now);
    return true;
}

export function setCompanionLifeMode(companion, mode, now = Date.now()) {
    if (!['active', 'paused', 'daycare'].includes(mode)) return false;
    advanceCompanionLife(companion, now);
    const life = ensure(companion, now);
    life.mode = mode; life.lastTickAt = now; life.game = null;
    return true;
}

export function getCompanionGameFrame(companion) { return arcadeFrame(companion.life?.game); }

export function startCompanionGame(companion, kind, now = Date.now(), random = Math.random) {
    advanceCompanionLife(companion, now);
    const blocked = canCareForCompanion(companion, 'game', now); if (blocked) throw new Error(blocked);
    const life = companion.life, definition = PET_GAMES.find(item => item.id === kind);
    if (!definition || STAGES.indexOf(life.stage) < STAGES.indexOf(definition.stage)) throw new Error('长大一些后就能解锁这个游戏');
    if (life.game) throw new Error('这一局还没有结束');
    if (companion.energy < 15) throw new Error('先休息一会儿，恢复体力再玩');
    life.game = createArcadeGame(kind, id('pet-game'), now, Math.floor(random() * 4294967295));
    return life.game;
}

export function advanceCompanionGame(companion, now = Date.now(), input = null) {
    const life = companion.life, game = life?.game;
    if (!game) return null;
    if (life.mode !== 'active' || companion.status === 'away') { life.game = null; return { cancelled: true }; }
    const result = advanceArcadeGame(game, now);
    if ([-1, 0, 1].includes(input)) arcadeInput(game, { type: 'press', direction: input });
    if (!result.completed) return result;
    life.game = null;
    if (life.rewardDay !== keyOfDay(now)) { life.rewardDay = keyOfDay(now); life.dailyCoins = 0; }
    const practiced = game.engagedMs >= 500 && game.moves >= 2;
    const coins = practiced ? Math.max(0, Math.min(30 - life.dailyCoins, 10, 2 + Math.floor(game.score / 40))) : 0;
    life.coins = Math.min(9999, life.coins + coins); life.dailyCoins += coins; life.lastGameAt = now;
    life.gameRecords ||= {};
    const record = life.gameRecords[game.kind] ||= { best: 0, plays: 0, combo: 0 };
    const best = practiced && game.score > record.best;
    if (practiced) {
        record.plays++; record.best = Math.max(record.best, game.score); record.combo = Math.max(record.combo, game.bestCombo);
        companion.energy = Math.max(0, companion.energy - 5); companion.happiness = Math.min(100, companion.happiness + 8);
        if (recordCompanionCare(companion, 'game', { now })) companion.bond = Math.min(100, companion.bond + 1);
        addCompanionMilestone(companion, 'first-game', `第一次一起玩${PET_GAMES.find(item => item.id === game.kind).name}，得了 ${game.score} 分。`, now);
    }
    life.lastGameResult = { id: game.id, kind: game.kind, score: game.score, combo: game.bestCombo, coins, best };
    companion.message = `这一局 ${game.score} 分，获得 ${coins} 枚陪伴币。${best ? '刷新了自己的纪录！' : practiced ? '一起玩得很开心！' : '下次试试移动和技能吧。'}`;
    companion.lastInteractionAt = now;
    return { completed: true, ...life.lastGameResult };
}

export function buyCompanionItem(data, itemId, now = Date.now()) {
    const companion = data.world.companion, life = ensure(companion, now), item = PET_SHOP.find(item => item.id === itemId);
    if (!item) throw new Error('物品不存在');
    if (life.owned.includes(item.id)) throw new Error('已经拥有这件物品');
    if (life.coins < item.cost) throw new Error('陪伴币还不够，可以一起玩小游戏获得');
    const existing = item.kind === 'food' ? data.world.inventory.find(entry => entry.source === '陪伴小铺' && entry.name === item.name) : null;
    if (existing?.quantity >= 9999) throw new Error('这种点心已经装满了');
    life.coins -= item.cost;
    if (item.kind === 'food') {
        if (existing) { existing.quantity++; existing.consumed = false; existing.updatedAt = now; }
        else data.world.inventory.push({ id: id('pet-food'), name: item.name, description: '适合旅伴的小点心。', quantity: 1, effect: '可喂食或装进行囊。', source: '陪伴小铺', usable: true, consumed: false, createdAt: now, updatedAt: now });
    } else { life.owned.push(item.id); if (item.kind === 'furniture') life.furniture = item.id; }
    addCompanionMilestone(companion, 'first-gift', `第一次送给${companion.name}的小礼物是${item.name}。`, now);
    return item;
}

export function tendCompanion(companion, action, now = Date.now()) {
    advanceCompanionLife(companion, now);
    const blocked = canCareForCompanion(companion, action, now); if (blocked) throw new Error(blocked);
    const life = companion.life;
    if (action === 'wake') {
        life.sleepUntil = 0; life.awakeUntil = now + 2 * HOUR; companion.status = 'home';
        companion.message = `${companion.name}揉揉眼睛醒来了，会陪你待上两个小时。`;
    } else if (action === 'rest') {
        life.sleepUntil = now + HOUR; companion.status = 'resting';
        recordCompanionCare(companion, 'rest', { now });
        companion.message = `${companion.name}钻进小窝，准备睡一小时，体力会慢慢恢复。`;
    } else if (action === 'clean') {
        if (recordCompanionCare(companion, 'clean', { now })) {
            life.cleanliness = Math.min(100, life.cleanliness + 35); companion.happiness = Math.min(100, companion.happiness + 5);
        }
        companion.message = `洗干净、整理好小窝，${companion.name}舒舒服服地伸了个懒腰。`;
    } else throw new Error('未知照顾动作');
    companion.lastInteractionAt = now; companion.updatedAt = now;
}

export function useCompanionToy(companion, toyId, now = Date.now()) {
    advanceCompanionLife(companion, now);
    const blocked = canCareForCompanion(companion, 'play', now); if (blocked) throw new Error(blocked);
    const toy = PET_SHOP.find(item => item.id === toyId && item.kind === 'toy');
    if (!toy || !companion.life.owned.includes(toyId)) throw new Error('还没有这件玩具');
    if (recordCompanionCare(companion, 'play', { now, toy: toyId })) {
        companion.happiness = Math.min(100, companion.happiness + 12); companion.energy = Math.max(0, companion.energy - 4);
        companion.bond = Math.min(100, companion.bond + 1);
    }
    companion.message = `${companion.name}把${toy.name}推过来，想和你再玩一会儿。`;
    companion.lastAction = 'play'; companion.lastInteractionAt = now; companion.updatedAt = now;
}

export function setCompanionDisplay(data, itemId) {
    if (itemId && !data.world.inventory.some(item => item.id === itemId && !item.consumed && item.quantity > 0 && /返程/.test(item.source))) throw new Error('这件纪念品已不在背包里');
    data.world.companion.life.displayItemId = itemId;
}
