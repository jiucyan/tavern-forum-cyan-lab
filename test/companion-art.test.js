import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCompanionArtwork } from '../src/companion-art.js';

const species = ['frog', 'cat', 'rabbit', 'fox', 'penguin', 'robo-bird', 'octopus', 'goldfish', 'soot'];
const accessories = ['scarf', 'satchel', 'flower', 'charm', 'ribbon', 'glasses', 'crown', 'leaf', 'headphones', 'cape', 'bell'];

test('room resting art retains fitted heads and unique paint IDs across growth stages', () => {
    for (const kind of species) for (const stage of ['baby', 'young', 'adult']) {
        assert.doesNotMatch(renderCompanionArtwork(kind, 'crown', stage), /tf-room-pose-art/);
        const markup = renderCompanionArtwork(kind, 'crown', stage, { roomPoses: true });
        assert.match(markup, /class="tf-room-pose-art"/);
        assert.doesNotMatch(markup, /undefined|NaN|scale\([^)]*,/);
        const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
        assert.equal(new Set(ids).size, ids.length, `${kind}/${stage} has conflicting head and body paint IDs`);
        assert.match(markup.slice(markup.indexOf('class="tf-room-pose-art"')), /data-accessory="crown"/);
    }
});
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
        assert.match(artwork, /class="tf-pixel-wearable-rig is-front-rig"/, `${kind} has no wearable motion layer`);
        for (const frame of ['idle', 'happy', 'feed', 'sleep']) assert.match(artwork, new RegExp(`data-frame="${frame}"`));
        assert.match(artwork, new RegExp(`${kind}-pixel-a-v1\\.png`));
        assert.match(artwork, new RegExp(`tf-${kind === 'frog' ? 'frog' : 'animal'}-tint-body`));
        assert.match(artwork, new RegExp(`tf-${kind === 'frog' ? 'frog' : 'animal'}-tint-accent`));
        assert.doesNotMatch(artwork, /class="tf-pixel-pupils"/, `${kind} has legacy pupils layered over the sprite eyes`);
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
            const expressionLayers = kind !== 'mystery' && stage === 'adult' ? ['tf-raster-frame is-idle', 'tf-raster-frame is-happy', 'tf-raster-frame is-feed', 'tf-raster-frame is-sleep'] : ['tf-pixel-pupils', 'tf-pixel-eyes-sleep', 'tf-pixel-eyes-happy', 'tf-pixel-mouth-feed'];
            for (const layer of expressionLayers) assert.ok(art.includes(layer), `${kind}/${stage}/${layer}`);
            if (kind === 'mystery') continue;
            if (stage !== 'adult') {
                assert.doesNotMatch(art, /tf-(?:frog|animal)-raster/, `${kind}/${stage} unexpectedly uses adult artwork`);
                const articulated = kind === 'frog' && stage === 'baby' ? 'tf-growth-swim-tail' : articulatedParts[kind];
                assert.match(art, new RegExp(articulated), `${kind}/${stage} lost its articulated anatomy`);
            }
            for (const accessory of accessories) {
                const dressed = renderCompanionArtwork(kind, accessory, stage);
                assert.match(dressed, new RegExp(`data-growth-fit="${stage}"`));
                assert.match(dressed, new RegExp(`data-accessory="${accessory}"`));
                assert.doesNotMatch(dressed, /undefined|NaN/);
            }
        }
        assert.equal(silhouettes.size, 3, `${kind} only changes scale instead of anatomy`);
    }
    // Raster filter IDs are unique per render; stage fallback must select the adult art.
    const fallback = renderCompanionArtwork('cat', 'none', 'invalid');
    assert.match(fallback, /data-growth-stage="adult"/);
    assert.match(fallback, /cat-pixel-a-v1\.png/);
});
