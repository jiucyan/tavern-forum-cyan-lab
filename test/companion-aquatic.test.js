import test from 'node:test';
import assert from 'node:assert/strict';
import { AQUATIC_HABITATS, getAquaticHabitat, isAquaticCompanion, isAquaticPoint, renderAquaticHabitat } from '../src/companion-aquatic.js';

test('only fish and native tadpoles live in water; growth and photos release the constraint', () => {
    for (const age of ['baby', 'young', 'adult']) assert.equal(isAquaticCompanion('goldfish', age), true);
    assert.equal(isAquaticCompanion('frog', 'baby'), true);
    for (const age of ['young', 'adult']) assert.equal(isAquaticCompanion('frog', age), false);
    assert.equal(isAquaticCompanion('goldfish', 'adult', 'portrait.png'), false);
    assert.equal(isAquaticCompanion('cat'), false);
});

test('indoor swimmers have no container and can cross the room; outdoor water stays fixed', () => {
    for (const [location, habitat] of Object.entries(AQUATIC_HABITATS)) {
        const [minX,maxX,minY,maxY] = habitat.bounds;
        for (const [x,y] of [habitat.spawn,habitat.rest]) {
            assert.ok(x>=minX && x<=maxX && y>=minY && y<=maxY);
            assert.ok(isAquaticPoint({x,y},habitat));
        }
        const art=renderAquaticHabitat(location);
        if (['home','kitchen'].includes(location)) {
            assert.equal(habitat.kind,'free'); assert.equal(art,'');
            assert.ok(maxX-minX > 250 && maxY-minY > 170);
            for (const [x,y] of [[20,30],[290,40],[290,210],[25,210]]) assert.ok(isAquaticPoint({x,y},habitat));
        } else {
            assert.equal(isAquaticPoint({x:160,y:10},habitat),false);
            assert.match(art,/tf-aquatic-habitat/);
        }
        assert.doesNotMatch(art,/tank|wheel|stool|support-stand/);
        assert.equal(isAquaticPoint({x:-1,y:100},habitat),false);
        assert.equal(isAquaticPoint({x:NaN,y:100},habitat),false);
    }
    assert.equal(getAquaticHabitat('unknown'),AQUATIC_HABITATS.home);
});
