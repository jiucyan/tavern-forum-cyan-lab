import test from 'node:test';
import assert from 'node:assert/strict';
import { planRoomPath, nearestRoomPoint, roomPathObstacles, roomSegmentClear } from '../src/companion-room-path.js';
import { getRoomItemFootprint } from '../src/companion-room.js';

const bounds = { minX: 12, minY: 116, maxX: 308, maxY: 232 };

function checkPath(start, path, obstacles) {
    assert.ok(path?.points.length);
    let previous = start;
    for (const point of path.points) {
        assert.ok(point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY);
        assert.ok(roomSegmentClear(previous, point, obstacles), `blocked segment ${JSON.stringify({ previous, point })}`);
        previous = point;
    }
    assert.deepEqual(previous, path.target);
}

test('a furniture contact rectangle bends a route without cutting a corner', () => {
    const start = { x: 30, y: 180 }, requested = { x: 290, y: 180 };
    const footprints = [{ x: 130, y: 150, width: 60, height: 50 }], obstacles = roomPathObstacles(footprints, 4);
    const path = planRoomPath(start, requested, bounds, footprints, { clearance: 4 });
    checkPath(start, path, obstacles);
    assert.deepEqual(path.target, requested);
    assert.ok(path.points.length >= 3 && path.distance > 260, 'the route travels around the table');
    assert.equal(roomSegmentClear(start, requested, obstacles), false);
});

test('a blocked click selects the nearest reachable contact boundary', () => {
    const footprints = [{ x: 130, y: 150, width: 60, height: 50 }], start = { x: 30, y: 180 };
    const path = planRoomPath(start, { x: 155, y: 170 }, bounds, footprints, { clearance: 4 });
    checkPath(start, path, roomPathObstacles(footprints, 4));
    assert.deepEqual(path.target, { x: 155, y: 146 });
    assert.equal(planRoomPath(start, { x: 155, y: 170 }, bounds, footprints, { exact: true }), null);
});

test('quarter-turn furniture uses its rotated footprint and disconnected rooms reject a route', () => {
    const item = { id: 'cabinet', type: 'bookshelf', x: 160, y: 175, rotation: 1 };
    const footprint = getRoomItemFootprint(item);
    assert.ok(footprint.height > footprint.width, 'the floor contact turns with the shelf');
    const start = { x: 30, y: 180 }, path = planRoomPath(start, { x: 290, y: 180 }, bounds, [footprint]);
    checkPath(start, path, roomPathObstacles([footprint]));
    const wall = { x: 140, y: 100, width: 40, height: 145 };
    assert.equal(planRoomPath(start, { x: 290, y: 180 }, bounds, [wall]), null, 'a cabinet wall cannot be crossed or teleported through');
});

test('safe room spawn resolves occupied feet without mutating furniture and impossible rooms have no point', () => {
    const footprints = [{ x: 130, y: 150, width: 60, height: 50 }], saved = structuredClone(footprints);
    assert.deepEqual(nearestRoomPoint({ x: 160, y: 180 }, bounds, footprints, 4), { x: 160, y: 204 });
    assert.deepEqual(footprints, saved);
    assert.equal(nearestRoomPoint({ x: 160, y: 180 }, bounds, [{ x: 0, y: 0, width: 320, height: 240 }]), null);
});
