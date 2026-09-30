import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCompanionArtwork } from '../src/companion-art.js';

const species = ['frog', 'cat', 'rabbit', 'fox', 'penguin', 'robo-bird', 'octopus', 'goldfish', 'soot'];
const accessories = ['scarf', 'satchel', 'flower', 'charm', 'ribbon', 'glasses', 'crown', 'leaf', 'headphones', 'cape', 'bell'];
const articulatedParts = {
    frog: 'tf-pixel-legs',
    cat: 'tf-cat-ear',
    rabbit: 'tf-rabbit-ear',
    fox: 'tf-fox-ear',
    penguin: 'tf-penguin-wing',
    'robo-bird': 'tf-pixel-antenna',
    octopus: 'tf-octopus-arm',
    goldfish: 'tf-betta-fin',
    soot: 'tf-pixel-arms',
};

test('every built-in companion uses the shared body, expression and action layers', () => {
    for (const kind of species) {
        const artwork = renderCompanionArtwork(kind, 'none');
        assert.match(artwork, /class="tf-pixel-character"/, `${kind} has no character layer`);
        assert.match(artwork, /class="tf-pixel-back-rig"/, `${kind} has no independently animated rear layer`);
        assert.match(artwork, /class="tf-pixel-body-rig"/, `${kind} has no independently animated body layer`);
        assert.match(artwork, /class="tf-pixel-face-rig"/, `${kind} has no independently animated face layer`);
        assert.match(artwork, /class="tf-pixel-pupils"/, `${kind} has no independently animated pupil layer`);
        assert.match(artwork, /class="tf-pixel-wearable-rig is-front-rig"/, `${kind} has no wearable motion layer`);
        assert.match(artwork, /class="tf-pixel-body"/, `${kind} has no body color layer`);
        assert.match(artwork, /tf-pixel-eyes-open/, `${kind} has no open-eye frame`);
        assert.match(artwork, /tf-pixel-eyes-happy/, `${kind} has no happy-eye frame`);
        assert.match(artwork, /tf-pixel-eyes-sleep/, `${kind} has no sleep-eye frame`);
        assert.match(artwork, /tf-pixel-mouth-feed/, `${kind} has no feeding mouth frame`);
        assert.match(artwork, new RegExp(articulatedParts[kind]), `${kind} has no species-specific articulated part`);
        assert.doesNotMatch(artwork, /data-accessory=/, `${kind} rendered an accessory while none was selected`);
    }
});

test('all accessories render as one fitted, species-aware wearable', () => {
    for (const kind of species) {
        for (const accessory of accessories) {
            const artwork = renderCompanionArtwork(kind, accessory);
            const matches = [...artwork.matchAll(/data-accessory="([^"]+)"/g)];
            assert.ok(matches.length >= 1 && matches.length <= 2, `${kind}/${accessory} has an invalid layer count`);
            assert.ok(matches.every(match => match[1] === accessory), `${kind}/${accessory} rendered another wearable`);
            assert.match(artwork, new RegExp(`data-fit="${kind}"`), `${kind}/${accessory} has no species fit`);
            assert.match(artwork, new RegExp(`data-design="${kind}:${accessory}"`), `${kind}/${accessory} reused a generic accessory design`);
            assert.match(artwork, /data-anchor="[^"]+"/, `${kind}/${accessory} has no anatomical anchor`);
            assert.match(artwork, /data-material="(cloth|leather|botanical|crystal|ribbon|glass|royal|tech|metal|pearl)"/, `${kind}/${accessory} has no material treatment`);
            assert.match(artwork, /data-slot="(head|face|neck|side|back)"/, `${kind}/${accessory} has no wearable slot`);
        }
    }
});

test('unknown companion and accessory values fall back safely', () => {
    const artwork = renderCompanionArtwork('unknown', 'unknown');
    assert.match(artwork, /tf-pixel-character/);
    assert.doesNotMatch(artwork, /data-accessory=/);
});

test('every growth stage has distinct anatomy and supports the expression and accessory layers', () => {
    for (const kind of [...species, 'mystery']) {
        const silhouettes = new Set();
        for (const stage of ['baby', 'young', 'adult']) {
            const art = renderCompanionArtwork(kind, 'none', stage);
            const body = art.match(/<g class="tf-pixel-body-rig">([\s\S]*?)<g class="tf-pixel-face-rig">/)[1];
            silhouettes.add(body);
            assert.match(art, new RegExp(`data-growth-stage="${stage}"`));
            for (const layer of ['tf-pixel-pupils', 'tf-pixel-eyes-sleep', 'tf-pixel-eyes-happy', 'tf-pixel-mouth-feed']) assert.ok(art.includes(layer), `${kind}/${stage}/${layer}`);
            if (kind === 'mystery') continue;
            for (const accessory of accessories) {
                const dressed = renderCompanionArtwork(kind, accessory, stage);
                assert.match(dressed, new RegExp(`data-growth-fit="${stage}"`));
                assert.match(dressed, new RegExp(`data-accessory="${accessory}"`));
                assert.doesNotMatch(dressed, /undefined|NaN/);
            }
        }
        assert.equal(silhouettes.size, 3, `${kind} only changes scale instead of anatomy`);
    }
    assert.equal(renderCompanionArtwork('cat', 'none', 'invalid'), renderCompanionArtwork('cat', 'none', 'adult'));
});
