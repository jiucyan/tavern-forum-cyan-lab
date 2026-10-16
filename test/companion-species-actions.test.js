import assert from 'node:assert/strict';
import test from 'node:test';
import { renderHomesteadMotion } from '../src/companion-homestead-motion-ui.js';

test('player tools stay at scene work points for aquatic and land companions', () => {
    for (const kind of ['goldfish', 'frog', 'cat', 'rabbit', 'penguin', 'octopus']) {
        const growthStage = kind === 'frog' ? 'baby' : 'adult';
        for (const action of ['plant', 'water', 'pack', 'cook']) {
            const art = renderHomesteadMotion(action, { kind, growthStage, itemId: 'bento', workPoint: { x: 160, y: 180 } });
            assert.match(art, new RegExp(`data-player-task="${action}"`));
            assert.match(art, /left:50%;top:75%/);
            assert.doesNotMatch(art, /data-work-arm|data-work-grip|data-work-stool|data-aquatic-support|tf-hm-finish/);
        }
    }
    for (const kind of ['cat', 'rabbit', 'penguin', 'octopus']) {
        assert.doesNotMatch(renderHomesteadMotion('water', { kind }), /data-aquatic-support/);
    }
    assert.doesNotMatch(renderHomesteadMotion('water', { kind: 'frog', growthStage: 'young' }), /data-aquatic-support/);
});

test('player work artwork keeps extreme or invalid task coordinates inside the scene', () => {
    const art = renderHomesteadMotion('plant', { workPoint: { x: -100, y: 999 } });
    assert.match(art, /left:15%;top:94\.166/);
    assert.doesNotMatch(renderHomesteadMotion('pack', { workPoint: { x: NaN, y: Infinity } }), /NaN|Infinity/);
    assert.doesNotMatch(renderHomesteadMotion('feed', { kind: 'cat' }), /data-player-task/);
});

test('aquatic food is delivered to the left-facing fish mouth in every growth stage', () => {
    const points = ['baby', 'young', 'adult'].map(growthStage => {
        const art = renderHomesteadMotion('feed', { kind: 'goldfish', growthStage, itemId: 'berry' });
        const point = [...art.matchAll(/--tf-hm-mouth-([xy]):([\d.]+)px/g)].reduce((point, match) => ({ ...point, [match[1]]: Number(match[2]) }), {});
        assert.ok(point.x >= 20 && point.x <= 32, `fish mouth stays on the left: ${JSON.stringify(point)}`);
        assert.ok(point.y > 50 && point.y < 70, 'food stays in the aquatic avatar area');
        assert.doesNotMatch(art, /tf-hm-crumbs|data-aquatic-support/);
        return point;
    });
    assert.ok(points[0].y > points[1].y && points[1].y > points[2].y, 'juvenile mouth heights follow their separate artwork');
    assert.ok(Math.abs(points[2].x - 20.8625) < .0001 && Math.abs(points[2].y - 51.65) < .0001, 'adult food meets the painted side muzzle after the aquatic fit');
    const tadpole = renderHomesteadMotion('feed', { kind: 'frog', growthStage: 'baby', itemId: 'berry' });
    assert.match(tadpole, /--tf-hm-mouth-x:45\.5px/);
    assert.doesNotMatch(renderHomesteadMotion('feed', { kind: 'frog', growthStage: 'young' }), /is-aquatic/);
});

test('aquatic decoration does not replace the shared kitchen or fishing pose player', () => {
    for (const action of ['cook', 'fish']) {
        const art = renderHomesteadMotion(action, { kind: 'goldfish', atStove: true });
        assert.match(art, /tf-work-pose-art/);
        assert.doesNotMatch(art, /data-aquatic-action|data-aquatic-support/);
    }
    assert.equal(renderHomesteadMotion('unsupported', { kind: 'goldfish' }), '');
});
