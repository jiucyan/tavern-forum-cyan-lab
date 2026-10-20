import test from 'node:test';
import assert from 'node:assert/strict';
import { AQUATIC_HABITATS, getAquaticHabitat, isAquaticCompanion, isAquaticPoint, renderAquaticHabitat } from '../src/companion-aquatic.js';
import { COMPANION_HABITATS, resolveCompanionDisplayScene } from '../src/companion-scenes.js';
import { getAquaticCompanionArtFrame } from '../src/companion-art.js';

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

test('selectable outdoor scenes resolve to their own natural water and indoor scenes still float freely', () => {
    for (const scene of COMPANION_HABITATS) {
        const descriptor = resolveCompanionDisplayScene({ habitat: scene.id, status: 'home', room: { enabled: false },
            life: { mode: 'active' }, homestead: { location: 'home' } }, { aquatic: true });
        const habitat = getAquaticHabitat(descriptor.aquaticLocation);
        const art = renderAquaticHabitat(descriptor.aquaticLocation);
        assert.equal(habitat.kind === 'free', scene.indoor === true, scene.id);
        if (scene.indoor) assert.equal(art, '');
        else {
            assert.notEqual(habitat, AQUATIC_HABITATS.home);
            for (const [x, y] of [habitat.spawn, habitat.rest]) {
                assert.ok(isAquaticPoint({ x, y }, habitat), scene.id);
                const [minX, maxX, minY, maxY] = habitat.bounds;
                assert.ok(x >= minX && x <= maxX && y >= minY && y <= maxY, scene.id);
            }
            if (['pond', 'beach'].includes(scene.id)) {
                assert.equal(habitat.nativeWater, true);
                assert.equal(art, '', 'existing scene water must not gain a second unrelated pool');
            } else assert.match(art, /tf-aquatic-habitat/);
        }
        assert.doesNotMatch(art, /tank|wheel|stool|support-stand/);
    }
});

test('native water fits visible fish and tadpole artwork inside its shoreline rather than testing the transparent hit target', () => {
    // Aquatic artwork uses 23.75cqi, or 76 scene units, independently of the
    // minimum 44 CSS-pixel pointer target. These boxes sit inside painted water:
    // pond: y115..143 between the reeds and central bank; beach: y90..150 sea.
    const spriteSize = 76;
    for (const id of ['pond', 'beach']) {
        const habitat = getAquaticHabitat(`habitat:${id}`), [left, top, width, height] = habitat.box;
        const [minX, maxX, minY, maxY] = habitat.bounds;
        for (const [kind, stage] of [['goldfish', 'baby'], ['goldfish', 'young'], ['goldfish', 'adult'], ['frog', 'baby']]) {
            const frame = getAquaticCompanionArtFrame(kind, stage);
            const halfWidth = frame.width * spriteSize * habitat.bodyScale / 2;
            const halfHeight = frame.height * spriteSize * habitat.bodyScale / 2;
            assert.ok(minX - halfWidth >= left && maxX + halfWidth <= left + width, `${id} ${kind}/${stage} body stays over water horizontally`);
            assert.ok(minY - halfHeight >= top && maxY + halfHeight <= top + height, `${id} ${kind}/${stage} body stays above the bank`);
        }
    }
    assert.equal(getAquaticHabitat('habitat:beach').bodyScale, 1);
    assert.ok(getAquaticHabitat('habitat:pond').bodyScale < 1, 'only the shallow distant pond needs a smaller visible body');
});

test('new scene water leaves the minimum touch target inside a narrow stage', () => {
    for (const scene of COMPANION_HABITATS.filter(scene => !scene.indoor)) {
        const habitat = getAquaticHabitat(`habitat:${scene.id}`);
        const [minX, maxX, minY, maxY] = habitat.bounds;
        for (const stageWidth of [200, 224, 320]) {
            const scale = stageWidth / 320, stageHeight = stageWidth * .75;
            assert.ok(minX * scale >= 22 && maxX * scale + 22 <= stageWidth, scene.id);
            assert.ok(minY * scale >= 22 && maxY * scale + 22 <= stageHeight, scene.id);
        }
    }
});

test('new scene mappings never alter the five original location habitats or legacy fallback', () => {
    assert.deepEqual(getAquaticHabitat('yard'), { kind: 'pond', label: '庭院小池', box: [221, 30, 90, 61], bounds: [245, 287, 53, 70], spawn: [266, 62], rest: [246, 69] });
    assert.deepEqual(getAquaticHabitat('forest'), { kind: 'stream', label: '林间浅溪', box: [189, 185, 121, 53], bounds: [215, 286, 207, 219], spawn: [253, 213], rest: [217, 217] });
    assert.deepEqual(getAquaticHabitat('river'), { kind: 'river', label: '河边水域', box: [20, 75, 180, 64], bounds: [46, 174, 99, 117], spawn: [132, 111], rest: [52, 116] });
    assert.equal(getAquaticHabitat('home'), AQUATIC_HABITATS.home);
    assert.equal(getAquaticHabitat('kitchen'), AQUATIC_HABITATS.kitchen);
    assert.equal(getAquaticHabitat('unknown'), AQUATIC_HABITATS.home);
});
