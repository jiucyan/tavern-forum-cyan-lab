import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ROOM_COLORS, ROOM_FLOORS, ROOM_FURNITURE, ROOM_MAX_ITEMS, ROOM_WALLS,
    addRoomItem, createCompanionRoomPreset, getRoomItemBounds, normalizeCompanionRoom,
    removeRoomItem, renderCompanionRoom, renderRoomFurniture, updateRoomItem,
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

test('all quarter-turn bounds stay inside their wall or floor zone even at extreme positions', () => {
    for (const furniture of ROOM_FURNITURE) {
        for (const rotation of [0, 1, 2, 3]) {
            for (const [x, y] of [[-1e6, -1e6], [1e6, 1e6], [160, 190]]) {
                const item = normalizeCompanionRoom({ items: [{ id: 'item', type: furniture.id, x, y, rotation }] }).items[0];
                const bounds = getRoomItemBounds(item);
                assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320, `${furniture.id}/${rotation} horizontal bounds`);
                const minimum = furniture.category === 'wall' ? 18 : 142;
                const maximum = furniture.category === 'wall' ? 145 : 240;
                assert.ok(bounds.y >= minimum && bounds.y + bounds.height <= maximum, `${furniture.id}/${rotation} vertical bounds`);
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
    assert.deepEqual(getRoomItemBounds(changed.items[0]), { x: 0, y: 142, width: 46, height: 72 });
    const removed = removeRoomItem(changed, id);
    assert.equal(removed.items.length, 0);
    assert.equal(changed.items.length, 1);
    const another = addRoomItem(added, 'chair', 100, 190);
    assert.notEqual(another.items[0].id, another.items[1].id);
    assert.deepEqual(addRoomItem(added, 'unknown', 100, 190), added);
    const full = normalizeCompanionRoom({ items: new Array(ROOM_MAX_ITEMS).fill({ type: 'toy' }) });
    assert.deepEqual(addRoomItem(full, 'chair', 100, 190), full);
});

test('all starter layouts are independent editable rooms with different furnishings', () => {
    const presets = ['cozy', 'garden', 'study'].map(createCompanionRoomPreset);
    assert.equal(new Set(presets.map(room => JSON.stringify(room))).size, 3);
    for (const preset of presets) {
        assert.equal(preset.enabled, true);
        assert.ok(preset.items.length >= 4 && preset.items.length <= 6);
        assert.deepEqual(normalizeCompanionRoom(preset), preset);
        assert.equal(removeRoomItem(preset, preset.items[0].id).items.length, preset.items.length - 1);
    }
    presets[0].items[0].x = 1;
    assert.notEqual(createCompanionRoomPreset('cozy').items[0].x, 1);
    assert.deepEqual(createCompanionRoomPreset('unknown'), createCompanionRoomPreset('cozy'));
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
    assert.doesNotMatch(rendered, /<(?:image|foreignObject|script)\b|\son\w+=|(?:href|src)="https?:\/\//);
});
