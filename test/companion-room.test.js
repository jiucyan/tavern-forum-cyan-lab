import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ROOM_COLORS, ROOM_FLOORS, ROOM_FURNITURE, ROOM_MAX_ITEMS, ROOM_WALLS, ROOM_FLOOR_Y,
    addRoomItem, createCompanionRoomPreset, getRoomItemBounds, normalizeCompanionRoom, getRoomItemFootprint, getRoomItemDepth, getRoomInteraction,
    removeRoomItem, renderCompanionRoom, renderRoomFurniture, renderRoomPlacedFurniture, updateRoomItem,
} from '../src/companion-room.js';
import { normalizeForumDataShape } from '../src/forum.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';
import { applyWorldUpdates, normalizeWorldUpdates } from '../src/world.js';

test('old chats keep their scene and receive a disabled independent empty room', () => {
    const first = normalizeForumDataShape({ world: { companion: { habitat: 'forest', name: '豆包' } } });
    assert.deepEqual(first.world.companion.room, { enabled: false, wall: 'cream', floor: 'wood', items: [] });
    assert.equal(first.world.companion.habitat, 'forest');
    assert.equal(first.world.companion.name, '豆包');
    const second = normalizeForumDataShape({});
    first.world.companion.room.items.push({ id: 'one', type: 'chair', x: 80, y: 190 });
    assert.equal(second.world.companion.room.items.length, 0);
    assert.equal(normalizeCompanionRoom({ enabled: 'false' }).enabled, false);
    assert.equal(normalizeCompanionRoom({ enabled: 'true' }).enabled, false);
});

test('room layouts survive save/import normalization and companion world updates', () => {
    const expected = createCompanionRoomPreset('garden');
    const data = normalizeForumDataShape({ world: { companion: { name: '团子', room: expected } } });
    const restored = normalizeForumDataShape(JSON.parse(JSON.stringify(data)));
    assert.deepEqual(restored.world.companion.room, expected);
    const updates = normalizeWorldUpdates('<module_data>{"worldUpdates":{"companion":{"name":"豆包","mood":"开心"}}}</module_data>');
    applyWorldUpdates(restored, updates, structuredClone(DEFAULT_SETTINGS));
    assert.deepEqual(restored.world.companion.room, expected);
    assert.equal(restored.world.companion.name, '豆包');
});

test('the furniture redraw keeps an existing saved layout exactly where its owner placed it', () => {
    const oldRoom = {
        enabled: true, wall: 'cream', floor: 'wood',
        items: [
            { id: 'room-item-1', type: 'window', x: 84, y: 66, rotation: 0, color: 'natural' },
            { id: 'room-item-2', type: 'picture', x: 242, y: 67, rotation: 0, color: 'natural' },
            { id: 'room-item-3', type: 'bed', x: 62, y: 198, rotation: 0, color: 'natural' },
            { id: 'room-item-4', type: 'rug', x: 182, y: 212, rotation: 0, color: 'sage' },
            { id: 'room-item-5', type: 'lamp', x: 275, y: 181, rotation: 0, color: 'natural' },
            { id: 'room-item-6', type: 'food-bowl', x: 268, y: 223, rotation: 0, color: 'rose' },
        ],
    };
    const saved = normalizeForumDataShape({ world: { companion: { room: structuredClone(oldRoom) } } });
    assert.deepEqual(saved.world.companion.room, oldRoom);
    renderCompanionRoom(saved.world.companion.room);
    assert.deepEqual(saved.world.companion.room, oldRoom);
    assert.deepEqual(normalizeForumDataShape(JSON.parse(JSON.stringify(saved))).world.companion.room, oldRoom);
});

test('malformed import cleans unsafe identities and unknown pieces deterministically without mutation', () => {
    const raw = {
        enabled: true, wall: '<script>', floor: 'not-a-floor',
        items: [null, { id: 'unknown', type: 'something' }, { id: 'same', type: 'bed', x: -900, y: 2000, color: 'not-a-color', rotation: 7 }, { id: 'same', type: 'window', x: Infinity, y: NaN, rotation: -1 }, { id: '"><script>', type: 'toy', x: '150', y: null }],
    };
    const before = structuredClone(raw);
    const normalized = normalizeCompanionRoom(raw);
    assert.deepEqual(raw, before);
    assert.deepEqual(normalizeCompanionRoom(raw), normalized);
    assert.equal(normalized.wall, 'cream');
    assert.equal(normalized.floor, 'wood');
    assert.equal(normalized.items.length, 3);
    assert.equal(new Set(normalized.items.map(item => item.id)).size, 3);
    assert.ok(normalized.items.every(item => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(item.id)));
    assert.equal(normalized.items[0].color, 'natural');
    assert.equal(normalized.items[0].rotation, 3);
    assert.equal(normalized.items[1].rotation, 3);
    assert.equal(normalizeCompanionRoom({ items: new Array(100).fill({ type: 'chair' }) }).items.length, ROOM_MAX_ITEMS);
});

test('all quarter-turn bounds fit the canvas and tall floor furniture keeps its contact point on the floor', () => {
    for (const furniture of ROOM_FURNITURE) {
        for (const rotation of [0, 1, 2, 3]) {
            for (const [x, y] of [[-1e6, -1e6], [1e6, 1e6], [160, 190]]) {
                const item = normalizeCompanionRoom({ items: [{ id: 'item', type: furniture.id, x, y, rotation }] }).items[0];
                const bounds = getRoomItemBounds(item);
                assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320, `${furniture.id}/${rotation} horizontal bounds`);
                assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 240, `${furniture.id}/${rotation} canvas vertical bounds`);
                if (furniture.category === 'wall') assert.ok(bounds.y >= 18 && bounds.y + bounds.height <= 145, `${furniture.id}/${rotation} legacy wall zone`);
                else if (getRoomItemFootprint(item)) {
                    const footOffsets = [.44 * furniture.height, 0, -.44 * furniture.height, 0];
                    assert.ok(item.y + footOffsets[rotation] >= ROOM_FLOOR_Y + 4 - .000001, `${furniture.id}/${rotation} floor contact`);
                } else assert.ok(bounds.y >= ROOM_FLOOR_Y, `${furniture.id}/${rotation} soft floor furnishing`);
                assert.equal(bounds.width, rotation % 2 ? furniture.height : furniture.width);
                assert.equal(bounds.height, rotation % 2 ? furniture.width : furniture.height);
            }
        }
    }
});

test('item edits are immutable, identity is stable, and rotation clamps the complete piece', () => {
    const empty = normalizeCompanionRoom(null);
    const added = addRoomItem(empty, 'bed', 20, 160, 'rose');
    assert.equal(empty.items.length, 0);
    assert.equal(added.items.length, 1);
    const id = added.items[0].id;
    const changed = updateRoomItem(added, id, { id: 'stolen', type: 'clock', rotation: 1, x: 0, y: 0, color: 'sky' });
    assert.equal(added.items[0].rotation, 0);
    assert.equal(changed.items[0].id, id);
    assert.equal(changed.items[0].type, 'bed');
    assert.equal(changed.items[0].color, 'sky');
    assert.deepEqual(getRoomItemBounds(changed.items[0]), { x: 0, y: 60, width: 68, height: 112 });
    const removed = removeRoomItem(changed, id);
    assert.equal(removed.items.length, 0);
    assert.equal(changed.items.length, 1);
    const another = addRoomItem(added, 'chair', 100, 190);
    assert.notEqual(another.items[0].id, another.items[1].id);
    assert.deepEqual(addRoomItem(added, 'unknown', 100, 190), added);
    const full = normalizeCompanionRoom({ items: new Array(ROOM_MAX_ITEMS).fill({ type: 'toy' }) });
    assert.deepEqual(addRoomItem(full, 'chair', 100, 190), full);
});

test('newly placed or moved wall decorations stay on the wall while old lower positions remain compatible', () => {
    const legacy = normalizeCompanionRoom({ items: [{ id: 'old', type: 'picture', x: 160, y: 121, rotation: 0, color: 'rose' }] });
    assert.equal(legacy.items[0].y, 121);
    const added = addRoomItem(legacy, 'window', 250, 220);
    assert.equal(added.items[0].y, 121, 'adding another piece does not move an existing wall decoration');
    const newBounds = getRoomItemBounds(added.items[1]);
    assert.equal(newBounds.y + newBounds.height, ROOM_FLOOR_Y);
    const edited = updateRoomItem(legacy, 'old', { y: 220 });
    const editedBounds = getRoomItemBounds(edited.items[0]);
    assert.equal(editedBounds.y + editedBounds.height, ROOM_FLOOR_Y);
});

test('walking projections use furniture floor bases and rotate with the placed piece', () => {
    for (const type of ['window', 'picture', 'clock', 'wall-shelf', 'rug', 'cushion']) assert.equal(getRoomItemFootprint({ type, x: 160, y: 160 }), null);
    const original = getRoomItemFootprint({ type: 'bookshelf', x: 160, y: 170, rotation: 0 });
    const rotated = getRoomItemFootprint({ type: 'bookshelf', x: 160, y: 170, rotation: 1 });
    assert.ok(original.height < 88 / 4, 'the upper cupboard does not occupy the walking floor');
    assert.ok(Math.abs(original.width - rotated.height) < .000001);
    assert.ok(Math.abs(original.height - rotated.width) < .000001);
    assert.equal(getRoomItemDepth({ type: 'bookshelf', x: 160, y: 170 }), original.y + original.height);
    assert.equal(getRoomItemDepth({ type: 'window', x: 160, y: 60 }), 0);
    assert.equal(getRoomItemDepth({ type: 'rug', x: 160, y: 190 }), 1);
});

test('every furniture interaction has a rotated anchor and a legal approach outside its own walking projection', () => {
    const expected = { bed: 'rest', sofa: 'sit', cushion: 'lie', 'food-bowl': 'feed', toy: 'play', window: 'look' };
    for (const [type, kind] of Object.entries(expected)) for (const rotation of [0, 1, 2, 3]) for (const [x, y] of [[160, 150], [0, 0], [320, 240]]) {
        const item = normalizeCompanionRoom({ items: [{ id: 'placed', type, x, y, rotation }] }).items[0];
        const interaction = getRoomInteraction(item), footprint = getRoomItemFootprint(item);
        assert.equal(interaction.kind, kind);
        assert.equal(interaction.itemId, 'placed');
        assert.equal(interaction.rotation, rotation);
        assert.ok(interaction.approach.x >= 12 && interaction.approach.x <= 308);
        assert.ok(interaction.approach.y >= ROOM_FLOOR_Y + 8 && interaction.approach.y <= 232);
        if (footprint) assert.ok(interaction.approach.x <= footprint.x - 8 || interaction.approach.x >= footprint.x + footprint.width + 8 || interaction.approach.y <= footprint.y - 8 || interaction.approach.y >= footprint.y + footprint.height + 8, `${type}/${rotation} approach outside its own footprint`);
        const bounds = getRoomItemBounds(item);
        if (['rest', 'sit', 'lie'].includes(kind)) assert.ok(interaction.anchor.x >= bounds.x && interaction.anchor.x <= bounds.x + bounds.width && interaction.anchor.y >= bounds.y && interaction.anchor.y <= bounds.y + bounds.height);
        else assert.deepEqual(interaction.anchor, interaction.approach);
    }
    assert.equal(getRoomInteraction({ type: 'table' }), null);
    assert.equal(getRoomInteraction({ type: 'unknown' }), null);
    const sofa = { id: 'sofa', type: 'sofa', x: 160, y: 160, rotation: 0 };
    const anchor = getRoomInteraction(sofa).anchor, turned = getRoomInteraction({ ...sofa, rotation: 1 }).anchor;
    assert.ok(Math.abs(turned.x - (160 - (anchor.y - 160))) < .000001);
    assert.ok(Math.abs(turned.y - (160 + (anchor.x - 160))) < .000001);
});

test('all starter layouts are independent editable rooms with different furnishings', () => {
    const presets = ['cozy', 'garden', 'study'].map(createCompanionRoomPreset);
    assert.equal(new Set(presets.map(room => JSON.stringify(room))).size, 3);
    for (const preset of presets) {
        assert.equal(preset.enabled, true);
        assert.ok(preset.items.length >= 4 && preset.items.length <= ROOM_MAX_ITEMS);
        assert.deepEqual(normalizeCompanionRoom(preset), preset);
        assert.equal(removeRoomItem(preset, preset.items[0].id).items.length, preset.items.length - 1);
    }
    presets[0].items[0].x = 1;
    assert.notEqual(createCompanionRoomPreset('cozy').items[0].x, 1);
    assert.deepEqual(createCompanionRoomPreset('unknown'), createCompanionRoomPreset('cozy'));
    const cozyTypes = createCompanionRoomPreset('cozy').items.map(item => item.type);
    for (const type of ['sofa', 'bed', 'food-bowl', 'toy']) assert.ok(cozyTypes.includes(type), `${type}: complete companion interaction starter room`);
});

test('catalog renders distinct local SVG pieces with selectable palettes, without fixed furnishings', () => {
    assert.ok(ROOM_FURNITURE.length >= 16);
    assert.equal(new Set(ROOM_FURNITURE.map(item => item.id)).size, ROOM_FURNITURE.length);
    assert.ok(ROOM_WALLS.length >= 4 && ROOM_FLOORS.length >= 4 && ROOM_COLORS.length >= 4);
    const artwork = ROOM_FURNITURE.map(item => renderRoomFurniture(item.id));
    assert.equal(new Set(artwork).size, ROOM_FURNITURE.length);
    for (const svg of artwork) {
        assert.match(svg, /^<svg\b/);
        assert.match(svg, /<\/svg>$/);
        assert.match(svg, /aria-hidden="true"/);
        assert.doesNotMatch(svg, /<(?:image|foreignObject|script)\b|\son\w+=|(?:href|src)="https?:\/\//);
    }
    assert.notEqual(renderRoomFurniture('bed', 'natural'), renderRoomFurniture('bed', 'rose'));
    assert.match(renderRoomFurniture('bed', 'sky', 1), /rotate\(90\)/);
    assert.equal(renderRoomFurniture('unknown'), '');
    const empty = renderCompanionRoom(null);
    assert.match(empty, /data-scene="custom-room" data-indoor="true"/);
    assert.match(empty, /viewBox="0 0 320 240" preserveAspectRatio="none"/);
    assert.doesNotMatch(empty, /data-room-item=/);
    const room = createCompanionRoomPreset('cozy');
    const rendered = renderCompanionRoom(room);
    assert.equal((rendered.match(/data-room-item=/g) || []).length, room.items.length);
    const background = renderCompanionRoom(room, { furniture: false });
    assert.equal((background.match(/data-room-item=/g) || []).length, room.items.filter(item => ROOM_FURNITURE.find(type => type.id === item.type).category === 'wall' || item.type === 'rug').length);
    const placed = renderRoomPlacedFurniture(room.items.find(item => item.type === 'sofa'));
    assert.match(placed, /viewBox="0 0 320 240" preserveAspectRatio="none"/);
    assert.equal((placed.match(/data-room-item=/g) || []).length, 1);
    assert.doesNotMatch(placed, /data-scene="custom-room"/);
    assert.doesNotMatch(rendered, /<(?:image|foreignObject|script)\b|\son\w+=|(?:href|src)="https?:\/\//);
});
