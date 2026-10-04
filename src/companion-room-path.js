// Paths are planned in the room's 320 × 240 foot coordinates. Furniture blocks
// its floor contact area; tall artwork can overlap a pet behind it without
// making the complete illustrated rectangle impassable.
const EPSILON = .001;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pointIn = (point, rect) => point.x > rect.minX + EPSILON && point.x < rect.maxX - EPSILON
    && point.y > rect.minY + EPSILON && point.y < rect.maxY - EPSILON;
const inBounds = (point, bounds) => point.x >= bounds.minX - EPSILON && point.x <= bounds.maxX + EPSILON
    && point.y >= bounds.minY - EPSILON && point.y <= bounds.maxY + EPSILON;

export function roomPathObstacles(footprints, clearance = 5) {
    return footprints.filter(rect => rect && rect.width > 0 && rect.height > 0).map(rect => ({
        minX: rect.x - clearance, minY: rect.y - clearance,
        maxX: rect.x + rect.width + clearance, maxY: rect.y + rect.height + clearance,
    }));
}

// A line may follow a contact boundary, but may never cut a rectangular corner.
export function roomSegmentClear(start, end, obstacles) {
    for (const rect of obstacles) {
        let enter = 0, leave = 1;
        const dx = end.x - start.x, dy = end.y - start.y;
        for (const [origin, delta, min, max] of [
            [start.x, dx, rect.minX + EPSILON, rect.maxX - EPSILON],
            [start.y, dy, rect.minY + EPSILON, rect.maxY - EPSILON],
        ]) {
            if (Math.abs(delta) < EPSILON) {
                if (origin <= min || origin >= max) { enter = 2; break; }
            } else {
                const first = (min - origin) / delta, second = (max - origin) / delta;
                enter = Math.max(enter, Math.min(first, second));
                leave = Math.min(leave, Math.max(first, second));
            }
        }
        if (enter <= leave && leave >= 0 && enter <= 1) return false;
    }
    return true;
}

function candidates(point, bounds, obstacles) {
    const result = [{ x: clamp(point.x, bounds.minX, bounds.maxX), y: clamp(point.y, bounds.minY, bounds.maxY) }];
    for (const rect of obstacles) {
        const px = clamp(point.x, rect.minX, rect.maxX), py = clamp(point.y, rect.minY, rect.maxY);
        result.push({ x: rect.minX, y: py }, { x: rect.maxX, y: py }, { x: px, y: rect.minY }, { x: px, y: rect.maxY },
            { x: rect.minX, y: rect.minY }, { x: rect.maxX, y: rect.minY },
            { x: rect.minX, y: rect.maxY }, { x: rect.maxX, y: rect.maxY });
    }
    result.push({ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
        { x: bounds.minX, y: bounds.maxY }, { x: bounds.maxX, y: bounds.maxY });
    const seen = new Set();
    return result.filter(value => {
        const key = `${value.x.toFixed(3)},${value.y.toFixed(3)}`;
        if (seen.has(key) || !inBounds(value, bounds) || obstacles.some(rect => pointIn(value, rect))) return false;
        seen.add(key); return true;
    });
}

export function nearestRoomPoint(point, bounds, footprints = [], clearance = 5) {
    const obstacles = roomPathObstacles(footprints, clearance);
    return candidates(point, bounds, obstacles).sort((a, b) => distance(a, point) - distance(b, point))[0] || null;
}

export function planRoomPath(start, requested, bounds, footprints = [], { clearance = 5, exact = false } = {}) {
    if (!start || !requested || !bounds || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) return null;
    const obstacles = roomPathObstacles(footprints, clearance);
    if (!inBounds(start, bounds) || obstacles.some(rect => pointIn(start, rect))) return null;
    const clamped = { x: clamp(requested.x, bounds.minX, bounds.maxX), y: clamp(requested.y, bounds.minY, bounds.maxY) };
    const blocked = obstacles.some(rect => pointIn(clamped, rect));
    const targets = exact ? (!blocked && inBounds(requested, bounds) ? [requested] : [])
        : blocked ? candidates(clamped, bounds, obstacles) : [clamped];
    if (!targets.length) return null;
    const vertices = [start, ...candidates(clamped, bounds, obstacles), ...targets];
    const costs = vertices.map(() => Infinity), previous = vertices.map(() => -1), visited = new Set();
    costs[0] = 0;
    while (visited.size < vertices.length) {
        let next = -1;
        for (let index = 0; index < vertices.length; index++) if (!visited.has(index) && (next < 0 || costs[index] < costs[next])) next = index;
        if (next < 0 || !Number.isFinite(costs[next])) break;
        visited.add(next);
        for (let index = 1; index < vertices.length; index++) {
            if (visited.has(index) || !roomSegmentClear(vertices[next], vertices[index], obstacles)) continue;
            const cost = costs[next] + distance(vertices[next], vertices[index]);
            if (cost < costs[index]) { costs[index] = cost; previous[index] = next; }
        }
    }
    let selected = -1, miss = Infinity;
    for (let index = 1; index < vertices.length; index++) {
        if (!Number.isFinite(costs[index]) || !targets.some(target => distance(target, vertices[index]) < EPSILON)) continue;
        const currentMiss = distance(vertices[index], clamped);
        if (currentMiss < miss - EPSILON || Math.abs(currentMiss - miss) < EPSILON && (selected < 0 || costs[index] < costs[selected])) {
            selected = index; miss = currentMiss;
        }
    }
    if (selected < 0) return null;
    const points = [];
    for (let index = selected; index > 0; index = previous[index]) {
        if (index < 0) return null;
        points.unshift({ ...vertices[index] });
    }
    return { points, target: { ...vertices[selected] }, distance: costs[selected] };
}
