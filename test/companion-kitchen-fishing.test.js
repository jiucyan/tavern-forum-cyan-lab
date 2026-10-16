import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCompanionLife, startCompanionGame } from '../src/companion-life.js';
import { normalizeWorldState, classifyInventoryItem, getCompanionPackingRole, applyInventoryItemUse } from '../src/world.js';
import { PET_ITEMS, RECIPES, HOMESTEAD_PATHS, normalizeHomestead, addPetItem, getPetItemCount, getRecipeView,
    changeHomesteadLocation, performHomesteadAction, ensureFishingKit, castHomesteadLine, getFishingView,
    reelHomesteadFish, cancelHomesteadFishing } from '../src/companion-homestead.js';

const T = new Date(2026, 9, 7, 12).getTime();
function data(location = 'home') {
    return { world: normalizeWorldState({ companion: { name: '团子', species: '青蛙', status: 'home', satiety: 40, energy: 80,
        life: normalizeCompanionLife({ autoSleep: false }, T), homestead: normalizeHomestead({ location }) } }) };
}
const add = (state, itemId, amount = 1) => addPetItem(state, itemId, amount, T);
const cook = (state, recipeId) => performHomesteadAction(state, 'cook', { recipeId }, T);
const row = (state, itemId) => state.world.inventory.find(entry => entry.petItemId === itemId);
const fishing = state => state.world.companion.homestead.fishing;
const withRod = () => { const state = data('river'); ensureFishingKit(state, T); return state; };
const cast = (state, at = T, roll = .5) => castHomesteadLine(state, at, () => roll);
const fill = state => { while (state.world.inventory.length < 300) state.world.inventory.push({ id: `story-${state.world.inventory.length}`, quantity: 1 }); };

test('kitchen is a side room of home, with no shortcut to the river or garden', () => {
    const state = data();
    assert.deepEqual(HOMESTEAD_PATHS, [['home', 'yard'], ['yard', 'forest'], ['forest', 'river'], ['home', 'kitchen']]);
    changeHomesteadLocation(state, 'kitchen', T);
    assert.equal(state.world.companion.homestead.location, 'kitchen');
    assert.throws(() => changeHomesteadLocation(state, 'yard', T), /相邻/);
    assert.throws(() => changeHomesteadLocation(state, 'river', T), /相邻/);
    changeHomesteadLocation(state, 'home', T);
    for (const id of ['yard', 'forest', 'river']) changeHomesteadLocation(state, id, T);
    assert.throws(() => changeHomesteadLocation(state, 'kitchen', T), /相邻/);
});

test('old saves normalize fishing purely and invalid cast shapes cannot become rewards', () => {
    const blank = normalizeHomestead();
    assert.equal(blank.fishingKitGranted, false);
    assert.equal(blank.fishingReadyAt, 0);
    assert.equal(blank.fishing, null);
    const valid = { id: 'cast-1', startedAt: T, biteAt: T + 4500, endsAt: T + 10500, fishId: 'river-fish' };
    const raw = { location: 'river', fishing: valid, fishingKitGranted: true, fishingReadyAt: T + 3000 };
    const before = structuredClone(raw), normalized = normalizeHomestead(raw);
    assert.deepEqual(raw, before);
    assert.deepEqual(normalizeHomestead(normalized), normalized);
    assert.deepEqual(normalized.fishing, valid);
    for (const replacement of [{ fishId: 'bento' }, { id: '' }, { biteAt: T - 1 }, { endsAt: Infinity }, { startedAt: 0 }, { endsAt: T + 1000000 }]) {
        assert.equal(normalizeHomestead({ ...raw, fishing: { ...valid, ...replacement } }).fishing, null);
    }
    assert.equal(normalizeHomestead({ ...raw, location: 'home' }).fishing, null);
    assert.equal(data().world.inventory.length, 0);
});

test('all five recipes expose their exact ingredients and cook one meal atomically', () => {
    assert.equal(RECIPES.length, 5);
    for (const recipe of RECIPES) {
        const state = data('kitchen');
        if (recipe.flexible) { add(state, 'berry'); add(state, 'carrot'); }
        else for (const entry of recipe.ingredients) add(state, entry.itemId, entry.quantity);
        const before = structuredClone(state), view = getRecipeView(state, recipe.id, T);
        assert.equal(view.canCook, true, recipe.id);
        assert.deepEqual(state, before, 'recipe view must not spend ingredients');
        cook(state, recipe.id);
        assert.equal(getPetItemCount(state, recipe.outputId), 1, recipe.id);
        for (const ingredient of recipe.ingredients) assert.equal(getPetItemCount(state, ingredient.itemId), 0);
        const cooked = structuredClone(state);
        assert.throws(() => cook(state, recipe.id), /缺|两份/);
        assert.deepEqual(state, cooked);
    }
});

test('recipe views name missing ingredients, unknown recipes, wrong location, and blocked pets', () => {
    const state = data('kitchen');
    add(state, 'carrot');
    assert.match(getRecipeView(state, 'vegetable-soup', T).reason, /1 份小萝卜/);
    assert.equal(getRecipeView(state, 'unknown', T).recipe, null);
    assert.equal(getRecipeView(state, 'unknown', T).canCook, false);
    add(state, 'turnip');
    state.world.companion.life.mode = 'paused';
    assert.match(getRecipeView(state, 'vegetable-soup', T).reason, /暂停/);
    state.world.companion.life.mode = 'active';
    changeHomesteadLocation(state, 'home', T);
    assert.match(getRecipeView(state, 'vegetable-soup', T).reason, /小厨房/);
    assert.throws(() => cook(state, 'vegetable-soup'), /小厨房/);
});

test('fish dishes choose common fish before rare fish and expose the actual choice', () => {
    const state = data('kitchen');
    add(state, 'golden-fish'); add(state, 'silver-fish'); add(state, 'river-fish'); add(state, 'branch', 3);
    for (const expected of ['river-fish', 'silver-fish', 'golden-fish']) {
        const view = getRecipeView(state, 'grilled-fish', T);
        assert.equal(view.ingredients[0].itemId, expected);
        assert.equal(view.ingredients[0].name, PET_ITEMS[expected].name);
        cook(state, 'grilled-fish');
        assert.equal(getPetItemCount(state, expected), 0);
    }
    assert.equal(getPetItemCount(state, 'grilled-fish'), 3);
    assert.equal(getPetItemCount(state, 'branch'), 0);
});

test('legacy bento still works at home; explicit recipes need the kitchen', () => {
    const state = data(); add(state, 'berry', 4);
    performHomesteadAction(state, 'cook', {}, T);
    assert.equal(getPetItemCount(state, 'bento'), 1);
    assert.throws(() => cook(state, 'bento'), /小厨房/);
    changeHomesteadLocation(state, 'kitchen', T);
    cook(state, 'bento');
    assert.equal(getPetItemCount(state, 'bento'), 2);
    assert.throws(() => performHomesteadAction(state, 'cook', {}, T), /小窝/);
});

test('kitchen food can be fed and seeds exchanged while raw fish cannot be eaten or consumed as a story item', () => {
    const state = data('kitchen');
    add(state, 'grilled-fish'); add(state, 'carrot'); add(state, 'river-fish');
    const raw = row(state, 'river-fish');
    assert.equal(classifyInventoryItem(raw), 'story');
    assert.equal(getCompanionPackingRole(raw).kind, 'tool');
    assert.equal(applyInventoryItemUse(state, raw.id, 'companion').applied, false);
    const before = structuredClone(state);
    assert.throws(() => performHomesteadAction(state, 'feed', { itemId: 'river-fish' }, T), /生鱼/);
    assert.deepEqual(state, before);
    performHomesteadAction(state, 'feed', { itemId: 'grilled-fish' }, T);
    assert.equal(getPetItemCount(state, 'grilled-fish'), 0);
    assert.ok(state.world.companion.satiety > 40);
    performHomesteadAction(state, 'exchange', { cropId: 'carrot' }, T);
    assert.equal(getPetItemCount(state, 'carrot-seed'), 2);
});

test('full inventories and traveling ingredients never partially consume recipes', () => {
    const state = data('kitchen'); add(state, 'carrot'); add(state, 'turnip'); fill(state);
    const before = structuredClone(state);
    assert.match(getRecipeView(state, 'vegetable-soup', T).reason, /装满/);
    assert.throws(() => cook(state, 'vegetable-soup'), /装满/);
    assert.deepEqual(state, before);
    state.world.inventory.pop();
    state.world.trips.push({ status: 'away', packingItems: [{ id: row(state, 'turnip').id, consumed: 0 }] });
    assert.equal(getRecipeView(state, 'vegetable-soup', T).canCook, false);
    assert.throws(() => cook(state, 'vegetable-soup'), /缺/);
    state.world.trips[0].status = 'returned';
    cook(state, 'vegetable-soup');
    assert.equal(getPetItemCount(state, 'vegetable-soup'), 1);
});

test('fishing kit is explicitly claimed once by old saves and remains reusable after reload', () => {
    const state = data('river');
    assert.equal(getPetItemCount(state, 'fishing-rod'), 0);
    assert.throws(() => cast(state), /钓竿不足/);
    assert.equal(ensureFishingKit(state, T).changed, true);
    state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
    assert.equal(ensureFishingKit(state, T + 1).changed, false);
    assert.equal(getPetItemCount(state, 'fishing-rod'), 1);
    cast(state);
    const session = fishing(state);
    reelHomesteadFish(state, session.id, session.biteAt);
    assert.equal(getPetItemCount(state, 'fishing-rod'), 1);
    assert.throws(() => ensureFishingKit(data(), T), /河边/);
});

test('claiming the fishing kit is atomic at capacity and does not duplicate an existing rod', () => {
    const state = data('river'); fill(state);
    const before = structuredClone(state);
    assert.throws(() => ensureFishingKit(state, T), /装满/);
    assert.deepEqual(state, before);
    state.world.inventory.pop();
    ensureFishingKit(state, T);
    assert.equal(getPetItemCount(state, 'fishing-rod'), 1);
    const imported = data('river'); add(imported, 'fishing-rod');
    ensureFishingKit(imported, T);
    assert.equal(getPetItemCount(imported, 'fishing-rod'), 1);
});

test('casting persists its waiting and bite windows across normalization without awarding fish', () => {
    const state = withRod(), result = cast(state, T, .5), initial = structuredClone(fishing(state));
    assert.equal(result.castId, initial.id);
    assert.equal(initial.biteAt, T + 5500);
    assert.equal(initial.endsAt, T + 11500);
    assert.deepEqual(getFishingView(state.world.companion, T), { phase: 'waiting', remainingMs: 5500, castId: initial.id });
    assert.equal(getPetItemCount(state, 'river-fish'), 0);
    state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
    assert.deepEqual(fishing(state), initial);
    assert.equal(getFishingView(state.world.companion, initial.biteAt).phase, 'bite');
    assert.equal(getFishingView(state.world.companion, initial.endsAt).phase, 'bite');
    assert.equal(getFishingView(state.world.companion, initial.endsAt + 1).phase, 'escaped');
    assert.equal(getPetItemCount(state, 'river-fish'), 0);
});

test('reeling during the bite grants exactly one selected fish and a short cooldown', () => {
    for (const [roll, fishId] of [[0, 'river-fish'], [.8, 'silver-fish'], [1, 'golden-fish']]) {
        const state = withRod(); cast(state, T, roll);
        const session = structuredClone(fishing(state));
        const result = reelHomesteadFish(state, session.id, session.biteAt);
        assert.equal(result.caught, true); assert.equal(result.itemId, fishId);
        assert.equal(getPetItemCount(state, fishId), 1);
        assert.equal(fishing(state), null);
        assert.equal(getFishingView(state.world.companion, session.biteAt).phase, 'cooldown');
        const before = structuredClone(state);
        assert.equal(reelHomesteadFish(state, session.id, session.biteAt).changed, false);
        assert.deepEqual(state, before);
        assert.throws(() => cast(state, session.biteAt), /稍等/);
        cast(state, session.biteAt + 3000);
        assert.notEqual(fishing(state).id, session.id);
    }
});

test('early and late reeling clear their cast without granting or consuming anything', () => {
    for (const timing of ['early', 'late']) {
        const state = withRod(); cast(state);
        const session = fishing(state), inventory = structuredClone(state.world.inventory);
        const result = reelHomesteadFish(state, session.id, timing === 'early' ? session.biteAt - 1 : session.endsAt + 1);
        assert.equal(result.caught, false); assert.equal(result.changed, true);
        assert.match(result.message, timing === 'early' ? /早/ : /游走/);
        assert.equal(fishing(state), null);
        assert.deepEqual(state.world.inventory, inventory);
    }
});

test('stale clicks cannot reel or cancel another cast and duplicate casts do not replace the first', () => {
    const state = withRod(); cast(state);
    const session = fishing(state), before = structuredClone(state);
    assert.throws(() => cast(state), /鱼线已经/);
    assert.equal(reelHomesteadFish(state, 'old-cast', session.biteAt).changed, false);
    assert.equal(cancelHomesteadFishing(state, 'old-cast', session.biteAt).changed, false);
    assert.deepEqual(state, before);
});

test('full inventory catch failures preserve the fish and cast for a valid retry without duplication', () => {
    const state = withRod(); cast(state); fill(state);
    const session = structuredClone(fishing(state)), before = structuredClone(state);
    assert.throws(() => reelHomesteadFish(state, session.id, session.biteAt), /装满/);
    assert.deepEqual(state, before);
    state.world.inventory.pop();
    assert.equal(reelHomesteadFish(state, session.id, session.biteAt + 500).caught, true);
    assert.equal(getPetItemCount(state, 'river-fish'), 1);
    assert.equal(reelHomesteadFish(state, session.id, session.biteAt + 500).caught, false);
    assert.equal(getPetItemCount(state, 'river-fish'), 1);
});

test('a full inventory can still catch fish into an available existing stack', () => {
    const state = withRod(); add(state, 'river-fish'); fill(state); cast(state);
    const session = fishing(state);
    assert.equal(reelHomesteadFish(state, session.id, session.biteAt).caught, true);
    assert.equal(getPetItemCount(state, 'river-fish'), 2);
    assert.equal(state.world.inventory.length, 300);
});

test('travel-locked fishing rods cannot be used; blocked pets cannot cast, reel, or claim', () => {
    const state = withRod(), rod = row(state, 'fishing-rod');
    state.world.trips.push({ status: 'away', packingItems: [{ id: rod.id, consumed: 0 }] });
    assert.throws(() => cast(state), /正随旅伴旅行/);
    for (const setup of [
        pet => { pet.status = 'away'; }, pet => { pet.life.mode = 'paused'; }, pet => { pet.life.mode = 'daycare'; },
        pet => { pet.life.sleepUntil = T + 60000; }, pet => { startCompanionGame(pet, 'catch', T, () => .5); },
    ]) {
        const blocked = withRod(); cast(blocked); const session = fishing(blocked);
        setup(blocked.world.companion);
        const before = structuredClone(blocked);
        assert.throws(() => cast(blocked));
        assert.throws(() => reelHomesteadFish(blocked, session.id, session.biteAt));
        assert.throws(() => ensureFishingKit(blocked, T));
        assert.deepEqual(blocked, before);
        assert.equal(cancelHomesteadFishing(blocked, session.id, T).changed, true, 'navigation must always be able to clean up a cast');
    }
});

test('navigation and explicit cancellation clean up pending fishing without touching inventory', () => {
    const state = withRod(); cast(state);
    const before = structuredClone(state.world.inventory);
    changeHomesteadLocation(state, 'forest', T + 1000);
    assert.equal(fishing(state), null);
    assert.deepEqual(state.world.inventory, before);
    changeHomesteadLocation(state, 'river', T + 5000); cast(state, T + 5000);
    const session = fishing(state);
    assert.equal(cancelHomesteadFishing(state, session.id, T + 6000).changed, true);
    assert.equal(fishing(state), null);
    assert.deepEqual(state.world.inventory, before);
    assert.equal(cancelHomesteadFishing(state, session.id, T + 6000).changed, false);
});

test('offline expiry never awards fish and a new cast can replace the expired line', () => {
    const state = withRod(); cast(state);
    const session = fishing(state), later = T + 86400000;
    state.world = normalizeWorldState(JSON.parse(JSON.stringify(state.world)));
    assert.equal(getFishingView(state.world.companion, later).phase, 'escaped');
    assert.equal(getPetItemCount(state, 'river-fish'), 0);
    cast(state, later);
    assert.notEqual(fishing(state).id, session.id);
    assert.equal(reelHomesteadFish(state, session.id, later).changed, false);
    assert.equal(getPetItemCount(state, 'river-fish'), 0);
});
